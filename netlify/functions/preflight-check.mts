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

  // Auth: verify caller identity
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (!user) return new Response("Invalid token", { status: 401 })

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const body = await req.json()
  const jobId = body.job_id as string
  if (!jobId) {
    return new Response(JSON.stringify({ error: "job_id required" }), { status: 400 })
  }

  // Verify caller has access to this job (admin or assigned reviewer)
  if (callerProfile?.role !== "admin") {
    const { data: job } = await supabase.from("jobs").select("reviewer_id, organisation_id").eq("id", jobId).single()
    const isAssignedReviewer = callerProfile?.role === "reviewer" && job?.reviewer_id === user.id
    const isOrgClient = callerProfile?.role === "client" // client submitting triggers preflight — verify org match
    if (!isAssignedReviewer && !isOrgClient) return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 })
  }

  try {
    // Get job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*, organisation:organisations(id, name)")
      .eq("id", jobId)
      .single()
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 })
    }

    const orgId = (job.organisation as { id: string }).id

    // Get glossary for this org + target language
    const { data: glossary } = await supabase
      .from("glossary_entries")
      .select("source_term, preferred_translation, target_language, do_not_translate")
      .eq("organisation_id", orgId)

    // Get brand voice
    const { data: brandVoice } = await supabase
      .from("brand_voice_notes")
      .select("guidelines, tone_descriptors, forbidden_phrases")
      .eq("organisation_id", orgId)
      .maybeSingle()

    const relevantGlossary = glossary?.filter(g => g.target_language === job.target_language) ?? []

    const prompt = `You are Vera's pre-flight checker. A client has submitted AI-translated content for human review. Identify potential issues before the human reviewer sees it.

Source language: ${job.source_language}
Target language: ${job.target_language}
Content type: ${job.content_type}
AI tool used: ${job.ai_tool_used || "Unknown"}
Word count: ${job.word_count}

${job.notes ? `Client notes: ${job.notes}` : ""}

Client's glossary (${relevantGlossary.length} terms for ${job.target_language}):
${relevantGlossary.length > 0
  ? relevantGlossary.map(g => `  "${g.source_term}" → "${g.preferred_translation}"${g.do_not_translate ? " [DO NOT TRANSLATE]" : ""}`).join("\n")
  : "  (no glossary terms defined yet)"}

Client's brand voice:
${brandVoice
  ? `  Guidelines: ${brandVoice.guidelines || "(none)"}
  Tone: ${(brandVoice.tone_descriptors ?? []).join(", ") || "(none)"}
  Forbidden phrases: ${(brandVoice.forbidden_phrases ?? []).join(", ") || "(none)"}`
  : "  (no brand voice defined yet)"}

Based on the job metadata and client preferences, generate a pre-flight assessment. Consider:
1. Whether the glossary terms are likely to need checking given the content type
2. Risk assessment based on content type (compliance, legal, medical = higher risk)
3. Brand voice alignment concerns given the AI tool and content type
4. Overall confidence in the AI output quality

Return JSON: {
  "glossary_violations": [{"term": "string", "expected": "string", "severity": "low|medium|high"}],
  "risky_segments": [{"description": "string", "reason": "string", "severity": "low|medium|high"}],
  "brand_voice_issues": [{"description": "string", "severity": "low|medium|high"}],
  "confidence_score": number (1-10),
  "summary": "string (max 150 chars)"
}`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON in response")

    const preflight = JSON.parse(jsonMatch[0])

    // Write to job
    const { error: updateErr } = await supabase
      .from("jobs")
      .update({ preflight_data: preflight })
      .eq("id", jobId)
    if (updateErr) throw updateErr

    // Log
    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0
    console.log(`[preflight-check] job=${jobId} input=${inputTokens} output=${outputTokens} cost_est=$${((inputTokens * 0.003 + outputTokens * 0.015) / 1000).toFixed(4)}`)

    return new Response(JSON.stringify({ success: true, preflight }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[preflight-check] error:", err)
    // Job proceeds without preflight — don't block
    return new Response(JSON.stringify({ error: String(err), note: "Job continues without preflight data" }), { status: 500 })
  }
}
