import type { Context } from "@netlify/functions"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.EMAIL_FROM || "Vera <vera@vera-app.netlify.app>"
const TEST_MODE = process.env.VITE_EMAIL_MODE === "test"
const TEST_REDIRECT = process.env.EMAIL_TEST_REDIRECT || "karla.wentworth@thatsclevermx.com"

// ============================================================
// Templates
// ============================================================

const RAINBOW_STRIPE = `<div style="display:flex;height:4px;width:100%">
  <div style="flex:1;background:#E5187A"></div><div style="flex:1;background:#8E2882"></div>
  <div style="flex:1;background:#1B4F9E"></div><div style="flex:1;background:#1FA1D6"></div>
  <div style="flex:1;background:#0F8F4D"></div><div style="flex:1;background:#F4D31E"></div>
  <div style="flex:1;background:#EE7C24"></div><div style="flex:1;background:#D9211E"></div>
</div>`

const FOOTER = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;font-size:12px;color:#9CA3AF">
  <p>Vera — Human-verified AI translation governance</p>
  <p>ECLS Translations Ltd · Manchester, UK</p>
</div>`

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="font-family:Inter,system-ui,sans-serif;color:#111827;background:#ffffff;max-width:600px;margin:0 auto;padding:0">
    ${RAINBOW_STRIPE}
    <div style="padding:32px 24px">
      <div style="margin-bottom:24px">
        <span style="font-size:24px;font-weight:300;letter-spacing:-0.5px;color:#111827">vera</span>
      </div>
      ${body}
      ${FOOTER}
    </div>
  </body></html>`
}

interface TemplateData {
  [key: string]: string | number | undefined | null
}

const templates: Record<string, (d: TemplateData) => { subject: string; html: string }> = {
  welcome_client: (d) => ({
    subject: `Welcome to Vera, ${d.name}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Welcome to Vera${d.name ? `, ${d.name}` : ''}</h2>
      <p style="color:#6B7280;margin:0 0 16px">Your <strong>${d.tier}</strong> subscription is now active.</p>
      ${d.personal_note ? `<div style="border-left:3px solid #8E2882;padding:8px 16px;margin:16px 0;background:#F9FAFB"><p style="font-style:italic;color:#374151;margin:0">${d.personal_note}</p></div>` : ''}
      <h3 style="font-size:16px;font-weight:500;margin:24px 0 8px">What to expect in your first week</h3>
      <ul style="color:#6B7280;padding-left:20px">
        <li style="margin-bottom:8px"><strong>Submit your first job</strong> — upload AI-translated content and we'll assign an expert reviewer</li>
        <li style="margin-bottom:8px"><strong>Check your AI Health Score</strong> — see how your AI tools perform across languages</li>
        <li style="margin-bottom:8px"><strong>Add your glossary</strong> — terminology and brand voice notes improve review quality</li>
      </ul>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">Sign in to Vera</a>
      <p style="color:#9CA3AF;font-size:13px;margin-top:24px">Emma Cheetham, Vera<br>ECLS Translations Ltd</p>
    `),
  }),

  welcome_reviewer: (d) => ({
    subject: `Welcome to Vera's reviewer team, ${d.name}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Welcome, ${d.name}</h2>
      <p style="color:#6B7280;margin:0 0 16px">You've been added as a freelance reviewer on Vera.</p>
      <p style="color:#6B7280">Your rate: <strong>£${d.rate}/word</strong> · Languages: ${d.languages}</p>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">Sign in to Vera</a>
    `),
  }),

  welcome_salesperson: (d) => ({
    subject: `Welcome to Vera's sales team, ${d.name}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Welcome, ${d.name}</h2>
      <p style="color:#6B7280;margin:0 0 16px">You've been added as a salesperson on Vera. Track your introduced clients and commissions in the Sales portal.</p>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">Sign in to Vera</a>
    `),
  }),

  job_submitted_client: (d) => ({
    subject: `Job ${d.job_number} submitted — ${d.content_type}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Job submitted</h2>
      <p style="color:#6B7280;margin:0 0 16px">Your job <strong>${d.job_number}</strong> is in our queue.</p>
      <table style="width:100%;font-size:14px;color:#374151">
        <tr><td style="padding:4px 0;color:#6B7280">Content</td><td>${d.content_type}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Languages</td><td>${d.source_lang} → ${d.target_lang}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Words</td><td>${d.word_count}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Turnaround</td><td>${d.urgency === 'expedited' ? '6 hours (expedited)' : '24 hours (standard)'}</td></tr>
      </table>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">Track in Vera</a>
    `),
  }),

  job_allocated_reviewer: (d) => ({
    subject: `New job assigned: ${d.job_number} — ${d.client_name}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">New job assigned to you</h2>
      <table style="width:100%;font-size:14px;color:#374151">
        <tr><td style="padding:4px 0;color:#6B7280">Job</td><td><strong>${d.job_number}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Client</td><td>${d.client_name}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Languages</td><td>${d.source_lang} → ${d.target_lang}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Words</td><td>${d.word_count}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Due</td><td>${d.due_date}</td></tr>
      </table>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">Open in Vera</a>
    `),
  }),

  job_returned_reviewer: (d) => ({
    subject: `Revision needed: ${d.job_number}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Your review needs adjustments</h2>
      <p style="color:#6B7280;margin:0 0 16px">Emma has returned <strong>${d.job_number}</strong> for revision.</p>
      <div style="border-left:3px solid #EE7C24;padding:8px 16px;margin:16px 0;background:#FFF7ED">
        <p style="color:#374151;margin:0">${d.feedback}</p>
      </div>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">Open in Vera</a>
    `),
  }),

  job_delivered_client: (d) => ({
    subject: `Job ${d.job_number} delivered — AI Health: ${d.health_score}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Your verified translation is ready</h2>
      <p style="color:#6B7280;margin:0 0 16px">Job <strong>${d.job_number}</strong> has been reviewed, scored, and signed off.</p>
      <div style="display:flex;gap:24px;margin:16px 0">
        <div><p style="font-size:32px;font-weight:300;color:#0F8F4D;margin:0">${d.hter_score}</p><p style="font-size:12px;color:#6B7280;margin:0">hTER score</p></div>
        <div><p style="font-size:32px;font-weight:300;color:#111827;margin:0">${d.health_score}</p><p style="font-size:12px;color:#6B7280;margin:0">AI Health</p></div>
      </div>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">View in Vera</a>
    `),
  }),

  near_allowance_client: (d) => ({
    subject: `${d.usage_pct}% of your monthly allowance used`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Allowance alert</h2>
      <p style="color:#6B7280;margin:0 0 16px">You've used <strong>${d.usage_pct}%</strong> of your ${d.tier} tier's monthly word allowance (${d.used} / ${d.allowance} words).</p>
      <p style="color:#6B7280">Options: pay overflow at £0.08/word, upgrade your tier, or wait for next month's reset.</p>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">Manage subscription</a>
    `),
  }),

  monthly_statement_reviewer: (d) => ({
    subject: `Your ${d.month} statement — £${d.amount}`,
    html: wrap(`
      <h2 style="font-size:20px;font-weight:400;margin:0 0 8px">Monthly statement</h2>
      <p style="color:#6B7280;margin:0 0 16px">Your ${d.month} payout has been processed.</p>
      <table style="width:100%;font-size:14px;color:#374151">
        <tr><td style="padding:4px 0;color:#6B7280">Words reviewed</td><td>${d.words}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Amount</td><td><strong>£${d.amount}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#6B7280">Paid on</td><td>${d.paid_date}</td></tr>
      </table>
      <a href="${d.login_url}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:16px">View in Vera</a>
    `),
  }),
}

// ============================================================
// Handler
// ============================================================

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 })
  }

  const body = await req.json() as {
    to: string
    template: string
    data: TemplateData
  }

  if (!body.to || !body.template) {
    return new Response(JSON.stringify({ error: "to and template required" }), { status: 400 })
  }

  const templateFn = templates[body.template]
  if (!templateFn) {
    return new Response(JSON.stringify({ error: `Unknown template: ${body.template}` }), { status: 400 })
  }

  const { subject, html } = templateFn(body.data || {})
  const recipient = TEST_MODE ? TEST_REDIRECT : body.to

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [recipient],
      subject: TEST_MODE ? `[TEST → ${body.to}] ${subject}` : subject,
      html,
    })

    // Log
    await supabase.from("email_log").insert({
      recipient: body.to,
      template: body.template,
      subject,
      status: "sent",
      resend_id: result.data?.id ?? null,
    })

    console.log(`[send-email] sent ${body.template} to ${recipient}${TEST_MODE ? ` (redirected from ${body.to})` : ""}`)

    return new Response(JSON.stringify({ success: true, id: result.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    // Log failure
    await supabase.from("email_log").insert({
      recipient: body.to,
      template: body.template,
      subject,
      status: "failed",
      error: String(err),
    })

    console.error("[send-email] failed:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
