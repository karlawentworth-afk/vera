import type { Context } from "@netlify/functions"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-04-30.basil" })
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
const SITE_URL = process.env.SITE_URL || process.env.URL || "https://ecls-vera.netlify.app"

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (!user) return new Response("Invalid token", { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, role, stripe_account_id").eq("id", user.id).single()
  if (!profile || !["reviewer", "salesperson"].includes(profile.role)) {
    return new Response(JSON.stringify({ error: "Reviewer or salesperson only" }), { status: 403 })
  }

  let accountId = profile.stripe_account_id

  // Create Connect Express account if doesn't exist
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: profile.email,
      metadata: { profile_id: profile.id, role: profile.role },
      capabilities: { transfers: { requested: true } },
    })
    accountId = account.id
    await supabase.from("profiles").update({ stripe_account_id: accountId }).eq("id", profile.id)
  }

  // Determine return URL based on role
  const returnPath = profile.role === "reviewer" ? "/reviewer/earnings" : "/sales/earnings"

  // Create account link for onboarding
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${SITE_URL}${returnPath}?stripe=refresh`,
    return_url: `${SITE_URL}${returnPath}?stripe=complete`,
    type: "account_onboarding",
  })

  return new Response(JSON.stringify({ url: link.url }), { status: 200, headers: { "Content-Type": "application/json" } })
}
