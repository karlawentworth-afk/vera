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

  const body = await req.json() as { organisation_id: string }

  // Verify caller belongs to this organisation or is admin
  const { data: callerProfile } = await supabase.from("profiles").select("role, organisation_id").eq("id", user.id).single()
  if (callerProfile?.role !== "admin" && callerProfile?.organisation_id !== body.organisation_id) {
    return new Response(JSON.stringify({ error: "Access denied — you don't belong to this organisation" }), { status: 403 })
  }

  const { data: org } = await supabase.from("organisations").select("stripe_customer_id").eq("id", body.organisation_id).single()
  if (!org?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: "No Stripe customer linked to this organisation" }), { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${SITE_URL}/client/subscription`,
  })

  return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { "Content-Type": "application/json" } })
}
