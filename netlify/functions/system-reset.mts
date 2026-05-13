import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const DATA_TABLES = [
  "job_segments", "scores", "usage_charges", "email_log", "cron_runs",
  "stripe_events", "recommendations", "ai_health_snapshots",
  "glossary_entries", "brand_voice_notes", "audit_log",
  "commission_payouts", "reviewer_payouts", "invoices",
]

const OPTIONAL_TABLES = ["reviewer_invoices", "lead_activities", "lead_notes", "leads"]

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (!caller) return new Response("Invalid token", { status: 401 })

  const { data: callerProfile } = await supabase.from("profiles").select("role, id, email").eq("id", caller.id).single()
  if (callerProfile?.role !== "admin") return new Response("Admin only", { status: 403 })

  const body = await req.json() as { mode: "demo" | "live" | "reinstall" }
  const mode = body.mode

  if (!["demo", "live", "reinstall"].includes(mode)) {
    return new Response(JSON.stringify({ error: "mode must be 'demo', 'live', or 'reinstall'" }), { status: 400 })
  }

  const isDemoFlag = mode === "live" ? false : true

  try {
    for (const table of [...DATA_TABLES, ...OPTIONAL_TABLES]) {
      try { await supabase.from(table).delete().eq("is_demo", isDemoFlag) } catch {}
    }

    await supabase.from("jobs").delete().eq("is_demo", isDemoFlag)
    await supabase.from("quotes").delete().eq("is_demo", isDemoFlag)
    await supabase.from("commission_agreements").delete().eq("is_demo", isDemoFlag)
    await supabase.from("subscriptions").delete().eq("is_demo", isDemoFlag)

    if (mode === "live") {
      const { data: profiles } = await supabase.from("profiles").select("id").eq("is_demo", false).neq("role", "admin")
      for (const p of profiles ?? []) {
        await supabase.from("profiles").delete().eq("id", p.id)
        try { await supabase.auth.admin.deleteUser(p.id) } catch {}
      }
      const { data: operatorOrg } = await supabase.from("organisations").select("id").eq("type", "operator").single()
      if (operatorOrg) await supabase.from("organisations").delete().eq("is_demo", false).neq("id", operatorOrg.id)
    } else {
      const { data: profiles } = await supabase.from("profiles").select("id").eq("is_demo", true)
      for (const p of profiles ?? []) {
        await supabase.from("profiles").delete().eq("id", p.id)
        try { await supabase.auth.admin.deleteUser(p.id) } catch {}
      }
      await supabase.from("organisations").delete().eq("is_demo", true)
    }

    await supabase.from("audit_log").insert({
      actor_id: callerProfile.id, action: `system_reset_${mode}`, entity_type: "system", entity_id: "global",
      details: { mode, performed_by: callerProfile.email }, is_demo: false,
    })

    const message = mode === "reinstall"
      ? "Demo data wiped. Run seed-demo to reinstall."
      : mode === "demo" ? "Demo data wiped."
      : "Live data wiped. Only admin accounts and tier config remain."

    return new Response(JSON.stringify({ success: true, message }), { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (err) {
    console.error("[system-reset] error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
