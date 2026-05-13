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

  const body = await req.json() as { organisation_id: string; tier_name: string; subscription_id: string }

  // Get tier with Stripe price
  const { data: tier } = await supabase.from("tier_config").select("stripe_price_id, name").eq("name", body.tier_name).single()
  if (!tier?.stripe_price_id) {
    return new Response(JSON.stringify({ error: `No Stripe price configured for ${body.tier_name}. Add stripe_price_id to tier_config.` }), { status: 400 })
  }

  // Get or create Stripe customer
  const { data: org } = await supabase.from("organisations").select("id, name, stripe_customer_id").eq("id", body.organisation_id).single()
  let customerId = org?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org?.name,
      metadata: { organisation_id: body.organisation_id },
    })
    customerId = customer.id
    await supabase.from("organisations").update({ stripe_customer_id: customerId }).eq("id", body.organisation_id)
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
    success_url: `${SITE_URL}/client/subscription?checkout=success`,
    cancel_url: `${SITE_URL}/client/subscription?checkout=cancelled`,
    metadata: {
      organisation_id: body.organisation_id,
      subscription_id: body.subscription_id,
      tier_name: body.tier_name,
    },
  })

  return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { "Content-Type": "application/json" } })
}
