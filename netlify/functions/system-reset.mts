import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  // Verify admin auth
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (!caller) return new Response("Invalid token", { status: 401 })

  const { data: callerProfile } = await supabase.from("profiles").select("role, id, email, full_name, organisation_id").eq("id", caller.id).single()
  if (callerProfile?.role !== "admin") return new Response("Admin only", { status: 403 })

  const body = await req.json() as { confirm_password: string }
  if (!body.confirm_password) return new Response(JSON.stringify({ error: "Password confirmation required" }), { status: 400 })

  // Verify password
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: callerProfile.email,
    password: body.confirm_password,
  })
  if (authErr) return new Response(JSON.stringify({ error: "Password incorrect" }), { status: 403 })

  try {
    // Get operator org ID (preserve this)
    const { data: operatorOrg } = await supabase.from("organisations").select("id").eq("type", "operator").single()
    const operatorOrgId = operatorOrg?.id

    // Delete in dependency order
    const tables = [
      "job_segments",
      "scores",
      "usage_charges",
      "email_log",
      "cron_runs",
      "stripe_events",
      "recommendations",
      "ai_health_snapshots",
      "glossary_entries",
      "brand_voice_notes",
      "audit_log",
      "commission_payouts",
      "reviewer_payouts",
      "invoices",
    ]

    for (const table of tables) {
      await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000")
    }

    // Jobs (after segments and scores deleted)
    await supabase.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    // Quotes
    await supabase.from("quotes").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    // Commission agreements
    await supabase.from("commission_agreements").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    // Subscriptions
    await supabase.from("subscriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    // Delete non-admin profiles and their auth users
    const { data: nonAdminProfiles } = await supabase.from("profiles").select("id").neq("role", "admin")
    for (const p of nonAdminProfiles ?? []) {
      await supabase.from("profiles").delete().eq("id", p.id)
      await supabase.auth.admin.deleteUser(p.id)
    }

    // Delete non-operator organisations
    if (operatorOrgId) {
      await supabase.from("organisations").delete().neq("id", operatorOrgId)
    }

    console.log("[system-reset] Live system cleared. Only admin profiles and operator org remain.")

    return new Response(JSON.stringify({
      success: true,
      message: "Live system cleared. Only admin accounts and tier config remain.",
    }), { status: 200, headers: { "Content-Type": "application/json" } })

  } catch (err) {
    console.error("[system-reset] error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
