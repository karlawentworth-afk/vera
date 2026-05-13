import type { Context } from "@netlify/functions"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY! })

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 })
  }

  // Verify auth — extract token from Authorization header
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const token = authHeader.replace("Bearer ", "")
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 })
  }

  // Check admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin only" }), { status: 403 })
  }

  const body = await req.json()
  const orgId = body.organisation_id as string
  if (!orgId) {
    return new Response(JSON.stringify({ error: "organisation_id required" }), { status: 400 })
  }

  // Check 24h cooldown
  const { data: recent } = await supabase
    .from("recommendations")
    .select("generated_at")
    .eq("organisation_id", orgId)
    .order("generated_at", { ascending: false })
    .limit(1)

  if (recent?.[0]) {
    const lastGen = new Date(recent[0].generated_at)
    const hoursSince = (Date.now() - lastGen.getTime()) / (1000 * 60 * 60)
    if (hoursSince < 24) {
      return new Response(JSON.stringify({
        error: `Recommendations generated ${Math.round(hoursSince)}h ago. Wait 24h between generations.`,
      }), { status: 429 })
    }
  }

  // Gather org data
  const { data: org } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", orgId)
    .single()

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, source_language, target_language, content_type, ai_tool_used, word_count, status, submitted_at")
    .eq("organisation_id", orgId)
    .gte("submitted_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("submitted_at", { ascending: false })

  const jobIds = jobs?.map(j => j.id) ?? []
  const { data: scores } = jobIds.length > 0
    ? await supabase.from("scores").select("job_id, accuracy, terminology, tone_register, brand_voice, cultural_fit, risk, hter_score, reviewer_notes").in("job_id", jobIds)
    : { data: [] }

  // Build summary
  const scoreMap: Record<string, typeof scores extends (infer T)[] | null ? T : never> = {}
  scores?.forEach(s => { scoreMap[s.job_id] = s })

  const jobSummaries = jobs?.map(j => {
    const s = scoreMap[j.id]
    return {
      language: `${j.source_language} → ${j.target_language}`,
      content_type: j.content_type,
      ai_tool: j.ai_tool_used,
      words: j.word_count,
      status: j.status,
      hter: s ? Number(s.hter_score) : null,
      scores: s ? { accuracy: s.accuracy, terminology: s.terminology, tone: s.tone_register, brand: s.brand_voice, cultural: s.cultural_fit, risk: s.risk } : null,
      reviewer_notes: s?.reviewer_notes || null,
    }
  }) ?? []

  // Aggregate by tool + language
  const toolLangStats: Record<string, { hterSum: number; count: number }> = {}
  jobSummaries.forEach(j => {
    if (j.hter === null) return
    const key = `${j.ai_tool} | ${j.language}`
    if (!toolLangStats[key]) toolLangStats[key] = { hterSum: 0, count: 0 }
    toolLangStats[key].hterSum += j.hter
    toolLangStats[key].count += 1
  })

  const prompt = `You are Vera's AI translation analyst. Review the performance data for ${org?.name ?? "this organisation"} from the last 30 days and generate specific, actionable recommendations.

DATA SUMMARY:
- Total jobs: ${jobSummaries.length}
- Total words: ${jobSummaries.reduce((s, j) => s + j.words, 0).toLocaleString()}

JOBS BY AI TOOL + LANGUAGE (avg hTER — lower is better):
${Object.entries(toolLangStats).map(([key, stats]) =>
  `  ${key}: avg hTER ${(stats.hterSum / stats.count).toFixed(3)} (${stats.count} jobs)`
).join("\n")}

RECENT REVIEWER NOTES:
${jobSummaries.filter(j => j.reviewer_notes).slice(0, 5).map(j =>
  `  [${j.ai_tool}, ${j.language}]: "${j.reviewer_notes}"`
).join("\n") || "  (none)"}

Generate 3-5 specific, actionable recommendations. Focus on:
- Which AI tools work best/worst for which content types
- Language pairs needing prompt tuning
- Patterns in reviewer feedback
- Risk areas

Return a JSON array. Each item: { "title": "max 80 chars", "body": "max 200 chars practical advice", "severity": "positive|neutral|attention", "related_language_pair": "EN → DE" or null, "related_ai_tool": "ChatGPT" or null }`

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error("No JSON array in response")
    }

    const recs = JSON.parse(jsonMatch[0]) as Array<{
      title: string
      body: string
      severity: string
      related_language_pair: string | null
      related_ai_tool: string | null
    }>

    // Delete old recommendations for this org
    await supabase.from("recommendations").delete().eq("organisation_id", orgId)

    // Insert new
    const { error: insertErr } = await supabase.from("recommendations").insert(
      recs.map(r => ({
        organisation_id: orgId,
        title: r.title.slice(0, 80),
        body: r.body.slice(0, 200),
        severity: ["positive", "neutral", "attention"].includes(r.severity) ? r.severity : "neutral",
        related_language_pair: r.related_language_pair || null,
        related_ai_tool: r.related_ai_tool || null,
      }))
    )
    if (insertErr) throw insertErr

    // Log usage
    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0
    console.log(`[generate-recommendations] org=${orgId} input=${inputTokens} output=${outputTokens} cost_est=$${((inputTokens * 0.003 + outputTokens * 0.015) / 1000).toFixed(4)}`)

    return new Response(JSON.stringify({ success: true, count: recs.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[generate-recommendations] error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}
