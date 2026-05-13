import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface InviteRequest {
  // Common
  email: string
  full_name: string
  role: "client" | "reviewer" | "salesperson"
  password?: string

  // Client-specific
  organisation_name?: string
  organisation_id?: string
  tier_name?: string
  job_title?: string
  personal_note?: string

  // Reviewer-specific
  languages?: string[]
  specialism?: string
  rate_per_word?: number

  // Salesperson-specific
  default_finders_fee_pct?: number
  default_recurring_pct?: number
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 })
  }

  // Verify admin auth
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  const token = authHeader.replace("Bearer ", "")
  const { data: { user: caller } } = await supabase.auth.getUser(token)
  if (!caller) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 })

  const { data: callerProfile } = await supabase.from("profiles").select("role, id").eq("id", caller.id).single()
  if (callerProfile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin only" }), { status: 403 })
  }

  const body = await req.json() as InviteRequest

  if (!body.email || !body.full_name || !body.role) {
    return new Response(JSON.stringify({ error: "email, full_name, and role required" }), { status: 400 })
  }

  try {
    // 1. Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password || "VeraDemo2026!",
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    })
    if (authErr) throw new Error(`Auth: ${authErr.message}`)
    const userId = authData.user.id

    // 2. Handle organisation for clients
    let organisationId: string | null = null

    if (body.role === "client") {
      if (body.organisation_id) {
        organisationId = body.organisation_id
      } else if (body.organisation_name) {
        const { data: org, error: orgErr } = await supabase
          .from("organisations")
          .insert({ name: body.organisation_name, type: "client" })
          .select("id")
          .single()
        if (orgErr) throw new Error(`Org: ${orgErr.message}`)
        organisationId = org.id

        // Create subscription if tier specified
        if (body.tier_name) {
          const { data: tier } = await supabase
            .from("tier_config")
            .select("monthly_price_pence, word_allowance, overflow_rate_pence")
            .eq("name", body.tier_name)
            .single()

          if (tier) {
            const periodStart = new Date()
            periodStart.setDate(1)
            periodStart.setHours(0, 0, 0, 0)
            const periodEnd = new Date(periodStart)
            periodEnd.setMonth(periodEnd.getMonth() + 1)

            await supabase.from("subscriptions").insert({
              organisation_id: organisationId,
              tier_name: body.tier_name,
              monthly_price_pence: tier.monthly_price_pence,
              word_allowance: tier.word_allowance,
              overflow_rate_pence: tier.overflow_rate_pence,
              status: "active",
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
            })
          }
        }
      }
    }

    // 3. Create profile
    const profileData: Record<string, unknown> = {
      id: userId,
      email: body.email,
      full_name: body.full_name,
      role: body.role,
      organisation_id: organisationId,
      invited_at: new Date().toISOString(),
    }

    if (body.role === "client" && body.job_title) {
      profileData.job_title = body.job_title
    }

    if (body.role === "reviewer") {
      profileData.languages = body.languages || []
      profileData.specialism = body.specialism || null
      profileData.rate_per_word = body.rate_per_word || null
    }

    if (body.role === "salesperson") {
      profileData.default_finders_fee_pct = body.default_finders_fee_pct || null
      profileData.default_recurring_pct = body.default_recurring_pct || null
    }

    const { error: profErr } = await supabase.from("profiles").insert(profileData)
    if (profErr) throw new Error(`Profile: ${profErr.message}`)

    // 4. Audit log
    await supabase.from("audit_log").insert({
      actor_id: callerProfile.id,
      action: `invited_${body.role}`,
      entity_type: "profile",
      entity_id: userId,
      details: {
        email: body.email,
        name: body.full_name,
        role: body.role,
        organisation_id: organisationId,
      },
    })

    // 5. Send welcome email (fire-and-forget via the send-email function)
    const siteUrl = process.env.SITE_URL || process.env.URL || "https://ecls-vera.netlify.app"
    const emailTemplate = body.role === "client" ? "welcome_client"
      : body.role === "reviewer" ? "welcome_reviewer"
      : "welcome_salesperson"

    // Call send-email function internally
    try {
      const { Resend } = await import("resend")
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const resend = new Resend(resendKey)
        const loginUrl = `${siteUrl}/login`

        const subjects: Record<string, string> = {
          welcome_client: `Welcome to Vera, ${body.full_name.split(" ")[0]}`,
          welcome_reviewer: `Welcome to Vera's reviewer team, ${body.full_name.split(" ")[0]}`,
          welcome_salesperson: `Welcome to Vera's sales team, ${body.full_name.split(" ")[0]}`,
        }

        await resend.emails.send({
          from: process.env.EMAIL_FROM || "Vera <onboarding@resend.dev>",
          to: [process.env.VITE_EMAIL_MODE === "test" ? (process.env.EMAIL_TEST_REDIRECT || body.email) : body.email],
          subject: subjects[emailTemplate] || "Welcome to Vera",
          html: `<p>Welcome to Vera, ${body.full_name}.</p><p>Sign in at: <a href="${loginUrl}">${loginUrl}</a></p><p>Password: VeraDemo2026!</p>${body.personal_note ? `<p>Note from Emma: ${body.personal_note}</p>` : ""}`,
        })

        await supabase.from("email_log").insert({
          recipient: body.email,
          template: emailTemplate,
          subject: subjects[emailTemplate],
          status: "sent",
        })
      }
    } catch (emailErr) {
      console.error("Email send failed (non-blocking):", emailErr)
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      organisation_id: organisationId,
      message: `${body.full_name} invited as ${body.role}`,
    }), { status: 200, headers: { "Content-Type": "application/json" } })

  } catch (err) {
    console.error("[invite-user] error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
