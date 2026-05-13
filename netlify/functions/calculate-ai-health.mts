import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface BreakdownItem {
  key: string
  score: number
  hter: number
  words: number
  jobs: number
}

function calculateScore(hterValues: number[]): number {
  if (hterValues.length === 0) return 0
  const avg = hterValues.reduce((a, b) => a + b, 0) / hterValues.length
  return Math.round(Math.max(0, Math.min(100, (1 - avg) * 100)))
}

async function calculateForOrg(orgId: string, snapshotDate: string) {
  const now = new Date(snapshotDate)
  const periodStart = new Date(now)
  periodStart.setDate(periodStart.getDate() - 90)
  const prevPeriodStart = new Date(periodStart)
  prevPeriodStart.setDate(prevPeriodStart.getDate() - 90)

  // Current period: last 90 days
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, source_language, target_language, content_type, ai_tool_used, word_count")
    .eq("organisation_id", orgId)
    .eq("status", "delivered")
    .gte("delivered_at", periodStart.toISOString())
    .lte("delivered_at", now.toISOString())

  const jobIds = jobs?.map(j => j.id) ?? []
  const { data: scores } = jobIds.length > 0
    ? await supabase.from("scores").select("job_id, hter_score").in("job_id", jobIds)
    : { data: [] }

  const scoreMap: Record<string, number> = {}
  scores?.forEach(s => { scoreMap[s.job_id] = Number(s.hter_score) })

  const hterValues = jobIds.map(id => scoreMap[id]).filter(v => v !== undefined)
  const totalWords = jobs?.reduce((s, j) => s + j.word_count, 0) ?? 0
  const overallScore = calculateScore(hterValues)
  const avgHter = hterValues.length > 0
    ? parseFloat((hterValues.reduce((a, b) => a + b, 0) / hterValues.length).toFixed(3))
    : null

  // Previous period for trend
  const { data: prevJobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("organisation_id", orgId)
    .eq("status", "delivered")
    .gte("delivered_at", prevPeriodStart.toISOString())
    .lt("delivered_at", periodStart.toISOString())

  const prevJobIds = prevJobs?.map(j => j.id) ?? []
  const { data: prevScores } = prevJobIds.length > 0
    ? await supabase.from("scores").select("hter_score").in("job_id", prevJobIds)
    : { data: [] }

  const prevHterValues = prevScores?.map(s => Number(s.hter_score)) ?? []
  const prevScore = prevHterValues.length > 0 ? calculateScore(prevHterValues) : null

  // Breakdowns
  function buildBreakdown(keyFn: (j: typeof jobs extends (infer T)[] | null ? T : never) => string): BreakdownItem[] {
    const map: Record<string, { hterSum: number; count: number; words: number; jobs: number }> = {}
    jobs?.forEach(j => {
      const key = keyFn(j)
      const hter = scoreMap[j.id]
      if (!map[key]) map[key] = { hterSum: 0, count: 0, words: 0, jobs: 0 }
      map[key].words += j.word_count
      map[key].jobs += 1
      if (hter !== undefined) {
        map[key].hterSum += hter
        map[key].count += 1
      }
    })
    return Object.entries(map).map(([key, stats]) => ({
      key,
      score: stats.count > 0 ? calculateScore([stats.hterSum / stats.count]) : 0,
      hter: stats.count > 0 ? parseFloat((stats.hterSum / stats.count).toFixed(3)) : 0,
      words: stats.words,
      jobs: stats.jobs,
    }))
  }

  const byLanguagePair = buildBreakdown(j => `${j.source_language} → ${j.target_language}`)
  const byContentType = buildBreakdown(j => j.content_type)
  const byAiTool = buildBreakdown(j => j.ai_tool_used || "Unknown")

  // Upsert snapshot
  const { error } = await supabase
    .from("ai_health_snapshots")
    .upsert({
      organisation_id: orgId,
      snapshot_date: snapshotDate,
      overall_score: overallScore,
      prev_period_score: prevScore,
      jobs_in_period: jobIds.length,
      words_in_period: totalWords,
      avg_hter: avgHter,
      by_language_pair: byLanguagePair,
      by_content_type: byContentType,
      by_ai_tool: byAiTool,
    }, { onConflict: "organisation_id,snapshot_date" })

  if (error) throw error
  return { orgId, overallScore, jobs: jobIds.length, words: totalWords }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const orgId = (body as { organisation_id?: string }).organisation_id
    const today = new Date().toISOString().split("T")[0]

    if (orgId) {
      // Single org
      const result = await calculateForOrg(orgId, today)
      return new Response(JSON.stringify({ success: true, results: [result] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // All client orgs
    const { data: orgs } = await supabase
      .from("organisations")
      .select("id")
      .eq("type", "client")

    const results = []
    for (const org of orgs ?? []) {
      const result = await calculateForOrg(org.id, today)
      results.push(result)
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[calculate-ai-health] error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
