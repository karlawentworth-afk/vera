import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (!caller) return new Response("Invalid token", { status: 401 })

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", caller.id).single()
  if (callerProfile?.role !== "admin") return new Response("Admin only", { status: 403 })

  const { user_id } = await req.json() as { user_id: string }
  if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 })

  // Get the target user's email
  const { data: targetUser, error: userErr } = await supabase.auth.admin.getUserById(user_id)
  if (userErr || !targetUser?.user?.email) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 })
  }

  // Ensure they have the demo password set
  await supabase.auth.admin.updateUserById(user_id, { password: "VeraDemo2026!" })

  return new Response(JSON.stringify({
    email: targetUser.user.email,
    password: "VeraDemo2026!",
  }), { status: 200, headers: { "Content-Type": "application/json" } })
}
