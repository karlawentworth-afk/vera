import type { Context } from "@netlify/functions"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-04-30.basil" })
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

export default async (req: Request, _context: Context) => {
  const sig = req.headers.get("stripe-signature")
  if (!sig) return new Response("Missing signature", { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return new Response("Invalid signature", { status: 400 })
  }

  // Idempotency check
  const { data: existing } = await supabase.from("stripe_events").select("id").eq("id", event.id).maybeSingle()
  if (existing) return new Response("Already processed", { status: 200 })

  // Record event
  await supabase.from("stripe_events").insert({ id: event.id, type: event.type, payload: event.data.object as Record<string, unknown> })

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.organisation_id
        const subId = session.metadata?.subscription_id
        if (orgId && subId && session.subscription) {
          await supabase.from("subscriptions").update({
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: "active",
          }).eq("id", subId)
          console.log(`[stripe-webhook] checkout completed: org=${orgId} sub=${subId}`)
        }
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const { data: localSub } = await supabase.from("subscriptions").select("id").eq("stripe_subscription_id", sub.id).maybeSingle()
        if (localSub) {
          const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "cancelled"
          await supabase.from("subscriptions").update({
            status,
            current_period_start: new Date((sub as unknown as { current_period_start: number }).current_period_start * 1000).toISOString(),
            current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
          }).eq("id", localSub.id)
          console.log(`[stripe-webhook] subscription updated: ${sub.id} → ${status}`)
        }
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await supabase.from("subscriptions").update({ status: "cancelled" }).eq("stripe_subscription_id", sub.id)
        console.log(`[stripe-webhook] subscription deleted: ${sub.id}`)
        break
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice
        console.log(`[stripe-webhook] invoice paid: ${inv.id} amount=${inv.amount_paid}`)
        break
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice
        const customerId = inv.customer as string
        const { data: sub } = await supabase.from("subscriptions").select("id").eq("stripe_customer_id", customerId).maybeSingle()
        if (sub) {
          await supabase.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id)
        }
        console.log(`[stripe-webhook] invoice payment failed: ${inv.id}`)
        break
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] error processing ${event.type}:`, err)
    return new Response("Processing error", { status: 500 })
  }

  return new Response("OK", { status: 200 })
}
