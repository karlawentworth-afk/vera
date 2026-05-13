import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (!user) return new Response("Invalid token", { status: 401 })
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return new Response("Admin only", { status: 403 })

  const { email } = await req.json() as { email: string }
  if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400 })

  // Generate a new magic link
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: (process.env.SITE_URL || "https://ecls-vera.netlify.app") + "/auth/callback" },
  })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Send via Resend if available
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && data.properties?.action_link) {
      const { Resend } = await import("resend")
      const resend = new Resend(resendKey)
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Vera <onboarding@resend.dev>",
        to: [email],
        subject: "Your Vera login link",
        html: `<p>Click here to sign in to Vera:</p><p><a href="${data.properties.action_link}">Sign in to Vera</a></p>`,
      })
    }
  } catch (e) {
    console.error("Email failed:", e)
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
