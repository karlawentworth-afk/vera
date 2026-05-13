import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function logRun(jobName: string, fn: () => Promise<number>): Promise<{ success: boolean; processed: number; error?: string }> {
  const { data: run } = await supabase.from("cron_runs").insert({ job_name: jobName, status: "running" }).select("id").single()
  const runId = run?.id

  try {
    const processed = await fn()
    if (runId) {
      await supabase.from("cron_runs").update({ status: "success", completed_at: new Date().toISOString(), records_processed: processed }).eq("id", runId)
    }
    return { success: true, processed }
  } catch (err) {
    const msg = String(err)
    if (runId) {
      await supabase.from("cron_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: msg }).eq("id", runId)
    }
    return { success: false, processed: 0, error: msg }
  }
}

// ============================================================
// Jobs
// ============================================================

async function calculateMonthlyCommissions(): Promise<number> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodLabel = periodStart.toISOString().split("T")[0]

  const { data: agreements } = await supabase
    .from("commission_agreements")
    .select("id, salesperson_id, organisation_id, recurring_commission_pct")
    .eq("status", "active")

  let count = 0
  for (const a of agreements ?? []) {
    // Check for existing payout this period
    const { data: existing } = await supabase
      .from("commission_payouts")
      .select("id")
      .eq("agreement_id", a.id)
      .eq("period_start", periodLabel)
      .limit(1)
    if (existing && existing.length > 0) continue

    // Get org MRR
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("monthly_price_pence")
      .eq("organisation_id", a.organisation_id)
      .eq("status", "active")
      .single()
    if (!sub) continue

    const amount = Math.round(sub.monthly_price_pence * Number(a.recurring_commission_pct) / 100)
    if (amount <= 0) continue

    await supabase.from("commission_payouts").insert({
      reference: "",
      salesperson_id: a.salesperson_id,
      agreement_id: a.id,
      period_start: periodLabel,
      period_end: periodEnd.toISOString().split("T")[0],
      amount_pence: amount,
      kind: "recurring",
      status: "pending",
    })
    count++
  }
  return count
}

async function generateReviewerPayouts(): Promise<number> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const scheduledFor = new Date(now.getFullYear(), now.getMonth(), 28)

  const { data: reviewers } = await supabase
    .from("profiles")
    .select("id, rate_per_word")
    .eq("role", "reviewer")

  let count = 0
  for (const r of reviewers ?? []) {
    // Check existing
    const { data: existing } = await supabase
      .from("reviewer_payouts")
      .select("id")
      .eq("reviewer_id", r.id)
      .eq("period_start", periodStart.toISOString().split("T")[0])
      .limit(1)
    if (existing && existing.length > 0) continue

    // Sum words from delivered jobs in prior month
    const { data: jobs } = await supabase
      .from("jobs")
      .select("word_count")
      .eq("reviewer_id", r.id)
      .eq("status", "delivered")
      .gte("delivered_at", periodStart.toISOString())
      .lt("delivered_at", periodEnd.toISOString())

    const words = jobs?.reduce((s, j) => s + j.word_count, 0) ?? 0
    if (words === 0) continue

    const amount = Math.round(words * Number(r.rate_per_word ?? 0) * 100)

    await supabase.from("reviewer_payouts").insert({
      reference: "REV-" + (200 + count),
      reviewer_id: r.id,
      period_start: periodStart.toISOString().split("T")[0],
      period_end: periodEnd.toISOString().split("T")[0],
      words_reviewed: words,
      amount_pence: amount,
      status: "pending",
      scheduled_for: scheduledFor.toISOString().split("T")[0],
    })
    count++
  }
  return count
}

async function generateClientInvoices(): Promise<number> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, organisation_id, monthly_price_pence, word_allowance, overflow_rate_pence, tier_name")
    .eq("status", "active")

  let count = 0
  for (const sub of subs ?? []) {
    // Check existing
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("organisation_id", sub.organisation_id)
      .eq("period_start", periodStart.toISOString().split("T")[0])
      .limit(1)
    if (existing && existing.length > 0) continue

    // Calculate overflow from prior month
    const priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const { data: priorJobs } = await supabase
      .from("jobs")
      .select("word_count, urgency")
      .eq("organisation_id", sub.organisation_id)
      .neq("status", "cancelled")
      .gte("submitted_at", priorStart.toISOString())
      .lt("submitted_at", periodStart.toISOString())

    const totalWords = priorJobs?.reduce((s, j) => s + j.word_count, 0) ?? 0
    const overflowWords = sub.word_allowance ? Math.max(0, totalWords - sub.word_allowance) : 0
    const overflowAmount = overflowWords * (sub.overflow_rate_pence ?? 8)

    const expeditedJobs = priorJobs?.filter(j => j.urgency === "expedited") ?? []
    const expeditedWords = expeditedJobs.reduce((s, j) => s + j.word_count, 0)
    const expeditedAmount = Math.round(expeditedWords * (sub.overflow_rate_pence ?? 8) * 0.5)

    const total = sub.monthly_price_pence + overflowAmount + expeditedAmount

    await supabase.from("invoices").insert({
      invoice_number: "INV-" + (1040 + count),
      organisation_id: sub.organisation_id,
      period_start: periodStart.toISOString().split("T")[0],
      period_end: periodEnd.toISOString().split("T")[0],
      subscription_amount_pence: sub.monthly_price_pence,
      overflow_amount_pence: overflowAmount,
      expedited_amount_pence: expeditedAmount,
      total_amount_pence: total,
      status: "draft",
    })
    count++
  }
  return count
}

async function checkAllowanceWarnings(): Promise<number> {
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, organisation_id, word_allowance, current_period_start")
    .eq("status", "active")
    .not("word_allowance", "is", null)

  let count = 0
  for (const sub of subs ?? []) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("word_count")
      .eq("organisation_id", sub.organisation_id)
      .neq("status", "cancelled")
      .gte("submitted_at", sub.current_period_start)

    const used = jobs?.reduce((s, j) => s + j.word_count, 0) ?? 0
    const pct = sub.word_allowance ? Math.round((used / sub.word_allowance) * 100) : 0

    if (pct >= 90) {
      // Check if already warned this period
      const { data: warned } = await supabase
        .from("email_log")
        .select("id")
        .eq("template", "near_allowance_client")
        .gte("created_at", sub.current_period_start)
        .limit(1)
      if (warned && warned.length > 0) continue

      // Would send email here — for now just count
      count++
    }
  }
  return count
}

// ============================================================
// Handler
// ============================================================

async function billUsageCharges(): Promise<number> {
  const now = new Date()
  const priorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const billingPeriod = `${priorMonth.getFullYear()}-${String(priorMonth.getMonth() + 1).padStart(2, '0')}`

  // Get unbilled charges from prior month
  const { data: charges } = await supabase
    .from("usage_charges")
    .select("id, organisation_id, kind, words, amount_pence")
    .eq("billing_period", billingPeriod)
    .eq("invoiced", false)

  if (!charges || charges.length === 0) return 0

  // Group by org
  const byOrg: Record<string, typeof charges> = {}
  charges.forEach(c => {
    if (!byOrg[c.organisation_id]) byOrg[c.organisation_id] = []
    byOrg[c.organisation_id].push(c)
  })

  let count = 0
  for (const [orgId, orgCharges] of Object.entries(byOrg)) {
    const overflowTotal = orgCharges.filter(c => c.kind === "overflow").reduce((s, c) => s + c.amount_pence, 0)
    const expeditedTotal = orgCharges.filter(c => c.kind === "expedited").reduce((s, c) => s + c.amount_pence, 0)

    // Update the invoice record if exists
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("period_start", priorMonth.toISOString().split("T")[0])
      .maybeSingle()

    if (invoice) {
      await supabase.from("invoices").update({
        overflow_amount_pence: overflowTotal,
        expedited_amount_pence: expeditedTotal,
        total_amount_pence: overflowTotal + expeditedTotal, // subscription amount already set
      }).eq("id", invoice.id)
    }

    // Mark as invoiced
    const chargeIds = orgCharges.map(c => c.id)
    await supabase.from("usage_charges").update({ invoiced: true }).in("id", chargeIds)
    count += chargeIds.length
  }

  return count
}

const JOBS: Record<string, () => Promise<number>> = {
  "calculate-monthly-commissions": calculateMonthlyCommissions,
  "generate-reviewer-payouts": generateReviewerPayouts,
  "generate-client-invoices": generateClientInvoices,
  "bill-usage-charges": billUsageCharges,
  "check-allowance-warnings": checkAllowanceWarnings,
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 })
  }

  const body = await req.json().catch(() => ({})) as { job_name?: string }
  const jobName = body.job_name

  if (!jobName || !JOBS[jobName]) {
    return new Response(JSON.stringify({
      error: "job_name required",
      available: Object.keys(JOBS),
    }), { status: 400 })
  }

  const result = await logRun(jobName, JOBS[jobName])

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  })
}
