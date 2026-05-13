import type { Context } from "@netlify/functions"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-04-30.basil" })
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  // Log cron run
  const { data: run } = await supabase.from("cron_runs").insert({ job_name: "process-payouts", status: "running" }).select("id").single()

  try {
    let processed = 0
    const failures: string[] = []

    // 1. Reviewer payouts
    const { data: reviewerPayouts } = await supabase
      .from("reviewer_payouts")
      .select("id, reviewer_id, amount_pence, reference")
      .eq("status", "pending")

    for (const payout of reviewerPayouts ?? []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_account_id, stripe_onboarding_completed_at, full_name, email")
        .eq("id", payout.reviewer_id)
        .single()

      if (!profile?.stripe_account_id || !profile.stripe_onboarding_completed_at) {
        continue // Skip — not onboarded
      }

      try {
        // Mark processing
        await supabase.from("reviewer_payouts").update({ status: "processing" }).eq("id", payout.id)

        const transfer = await stripe.transfers.create({
          amount: payout.amount_pence,
          currency: "gbp",
          destination: profile.stripe_account_id,
          description: `Vera reviewer payout ${payout.reference}`,
          metadata: { payout_id: payout.id, type: "reviewer" },
        })

        await supabase.from("reviewer_payouts").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
        }).eq("id", payout.id)

        processed++
      } catch (err) {
        await supabase.from("reviewer_payouts").update({ status: "pending" }).eq("id", payout.id)
        failures.push(`Reviewer ${profile.full_name}: ${err}`)
      }
    }

    // 2. Commission payouts
    const { data: commPayouts } = await supabase
      .from("commission_payouts")
      .select("id, salesperson_id, amount_pence, reference")
      .eq("status", "pending")

    for (const payout of commPayouts ?? []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_account_id, stripe_onboarding_completed_at, full_name")
        .eq("id", payout.salesperson_id)
        .single()

      if (!profile?.stripe_account_id || !profile.stripe_onboarding_completed_at) {
        continue
      }

      try {
        await supabase.from("commission_payouts").update({ status: "processing" }).eq("id", payout.id)

        const transfer = await stripe.transfers.create({
          amount: payout.amount_pence,
          currency: "gbp",
          destination: profile.stripe_account_id,
          description: `Vera commission payout ${payout.reference}`,
          metadata: { payout_id: payout.id, type: "commission" },
        })

        await supabase.from("commission_payouts").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
        }).eq("id", payout.id)

        processed++
      } catch (err) {
        await supabase.from("commission_payouts").update({ status: "pending" }).eq("id", payout.id)
        failures.push(`Salesperson ${profile.full_name}: ${err}`)
      }
    }

    // Log result
    if (run) {
      await supabase.from("cron_runs").update({
        status: failures.length > 0 ? "failed" : "success",
        completed_at: new Date().toISOString(),
        records_processed: processed,
        error_message: failures.length > 0 ? failures.join("; ") : null,
      }).eq("id", run.id)
    }

    return new Response(JSON.stringify({
      success: true,
      processed,
      failures: failures.length,
      details: failures,
    }), { status: 200, headers: { "Content-Type": "application/json" } })

  } catch (err) {
    if (run) {
      await supabase.from("cron_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: String(err) }).eq("id", run.id)
    }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
