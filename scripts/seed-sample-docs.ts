/**
 * Seeds the five sample documents as jobs across various statuses.
 * Run: npx tsx scripts/seed-sample-docs.ts
 *
 * Requires: seed.ts to have run first (creates orgs, profiles).
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString()
}
function hoursAgo(n: number): string {
  const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString()
}
function hoursFromNow(n: number): string {
  const d = new Date(); d.setHours(d.getHours() + n); return d.toISOString()
}

async function seed() {
  console.log('Seeding sample document jobs...\n')

  // Get org IDs
  const { data: orgs } = await supabase.from('organisations').select('id, name').eq('type', 'client')
  const orgMap = Object.fromEntries(orgs!.map(o => [o.name, o.id]))

  // Get reviewer IDs
  const { data: reviewers } = await supabase.from('profiles').select('id, email, full_name').eq('role', 'reviewer')
  const revMap = Object.fromEntries(reviewers!.map(r => [r.full_name, r.id]))

  // Get admin ID for audit log
  const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single()
  const adminId = admin!.id

  const sampleDir = join(process.cwd(), 'prototype', 'sample-content')

  // ============================================================
  // Job definitions
  // ============================================================
  const jobs = [
    {
      file: '01_DE_compliance_documentation.docx',
      org: 'Springshot Aviation',
      source_language: 'EN', target_language: 'DE',
      content_type: 'Compliance documentation',
      ai_tool_used: 'DeepL',
      word_count: 4280,
      urgency: 'expedited' as const,
      status: 'delivered' as const,
      reviewer: 'Anna Müller',
      submitted_at: daysAgo(5), due_at: daysAgo(4.75), delivered_at: daysAgo(4.5),
      notes: 'Safety-critical content — fire suppression procedures for cargo holds. Must match EASA terminology exactly.',
      score: { accuracy: 9, terminology: 7, tone_register: 9, brand_voice: 8, cultural_fit: 9, risk: 8, hter_score: 0.18 },
      reviewer_notes: 'Two terminology choices flagged for client glossary update: "Feuerlöschleitung" should be "Brandschutzsystem" per EASA standards. "Laderaum" acceptable. Otherwise clean output from DeepL.',
      preflight: {
        confidence_score: 7,
        summary: 'DeepL output generally strong but two EASA terminology mismatches detected.',
        glossary_violations: [
          { term: 'fire suppression line', expected: 'Brandschutzsystem', severity: 'high' },
          { term: 'cargo hold', expected: 'Frachtraum', severity: 'medium' },
        ],
        risky_segments: [
          { description: 'Safety-critical loading height reference', reason: 'Regulatory compliance — incorrect translation could cause operational error', severity: 'high' },
        ],
        brand_voice_issues: [],
      },
    },
    {
      file: '02_FR_marketing_campaign.docx',
      org: 'Springshot Aviation',
      source_language: 'EN', target_language: 'FR',
      content_type: 'Marketing campaign',
      ai_tool_used: 'ChatGPT',
      word_count: 2150,
      urgency: 'standard' as const,
      status: 'awaiting_signoff' as const,
      reviewer: 'Pierre Laurent',
      submitted_at: daysAgo(1), due_at: hoursFromNow(10),
      notes: 'New brand campaign for European airports. Tone should be premium but approachable.',
      score: { accuracy: 8, terminology: 8, tone_register: 6, brand_voice: 6, cultural_fit: 7, risk: 9, hter_score: 0.29 },
      reviewer_notes: 'Tone registers consistently informal — ChatGPT defaulted to conversational French rather than the premium register Springshot uses. Recommend adding "professional, formal register" to AI prompts. Brand tagline translation needs rework — direct translation loses the wordplay.',
      preflight: {
        confidence_score: 6,
        summary: 'ChatGPT tone likely too informal for premium aviation brand. Brand tagline needs human review.',
        glossary_violations: [],
        risky_segments: [
          { description: 'Brand tagline direct translation', reason: 'Wordplay/pun does not translate — needs creative adaptation', severity: 'medium' },
        ],
        brand_voice_issues: [
          { description: 'Conversational register detected — Springshot brand voice is premium/formal', severity: 'high' },
        ],
      },
    },
    {
      file: '03_ES_customer_communication.docx',
      org: 'Nordic Banking Group',
      source_language: 'EN', target_language: 'ES',
      content_type: 'Customer communications',
      ai_tool_used: 'Google Translate',
      word_count: 3200,
      urgency: 'standard' as const,
      status: 'in_review' as const,
      reviewer: 'Marta Sánchez',
      submitted_at: hoursAgo(2), due_at: hoursFromNow(22),
      notes: 'Monthly customer newsletter for Latin American retail banking clients. Formal but warm tone.',
    },
    {
      file: '04_IT_pharma_compliance.docx',
      org: 'Helix Pharma EMEA',
      source_language: 'EN', target_language: 'IT',
      content_type: 'Compliance documentation',
      ai_tool_used: 'Claude',
      word_count: 6400,
      urgency: 'expedited' as const,
      status: 'delivered' as const,
      reviewer: 'Lucia Rossi',
      submitted_at: daysAgo(3), due_at: daysAgo(2.75), delivered_at: daysAgo(2.5),
      notes: 'Phase III clinical trial patient information leaflet. Must comply with EMA linguistic validation requirements.',
      score: { accuracy: 10, terminology: 9, tone_register: 9, brand_voice: 9, cultural_fit: 10, risk: 9, hter_score: 0.11 },
      reviewer_notes: 'Excellent output from Claude on regulated pharmaceutical content. Terminology accurate against EMA glossary. One minor register adjustment in the consent section. This is near-publishable quality — recommend Claude for all IT pharma going forward.',
      preflight: {
        confidence_score: 9,
        summary: 'Claude performing exceptionally well on regulated pharmaceutical Italian. Near-publishable.',
        glossary_violations: [],
        risky_segments: [
          { description: 'Patient consent language', reason: 'Legal/regulatory — must match approved wording exactly', severity: 'medium' },
        ],
        brand_voice_issues: [],
      },
    },
    {
      file: '05_JA_training_material.docx',
      org: 'Springshot Aviation',
      source_language: 'EN', target_language: 'JA',
      content_type: 'Training materials',
      ai_tool_used: 'Gemini',
      word_count: 5100,
      urgency: 'standard' as const,
      status: 'unallocated' as const,
      reviewer: null,
      submitted_at: hoursAgo(0.5), due_at: hoursFromNow(23.5),
      notes: 'New cabin crew safety briefing module. Technical aviation terminology must be precise. Allocate to Hiroshi.',
    },
  ]

  for (const job of jobs) {
    console.log(`Creating: ${job.file} → ${job.org} (${job.status})`)

    // Create job
    const { data: jobRecord, error: jobErr } = await supabase.from('jobs').insert({
      job_number: '',
      organisation_id: orgMap[job.org],
      source_language: job.source_language,
      target_language: job.target_language,
      content_type: job.content_type,
      ai_tool_used: job.ai_tool_used,
      word_count: job.word_count,
      urgency: job.urgency,
      status: job.status,
      reviewer_id: job.reviewer ? revMap[job.reviewer] : null,
      notes: job.notes,
      submitted_at: job.submitted_at,
      due_at: job.due_at,
      delivered_at: (job as { delivered_at?: string }).delivered_at || null,
      preflight_data: (job as { preflight?: unknown }).preflight || null,
    }).select('id, job_number').single()

    if (jobErr) { console.error('  Job error:', jobErr.message); continue }
    console.log(`  → ${jobRecord!.job_number}`)

    // Upload file to storage
    try {
      const fileData = readFileSync(join(sampleDir, job.file))
      const storagePath = `${orgMap[job.org]}/${jobRecord!.id}/source/${job.file}`
      const { error: uploadErr } = await supabase.storage
        .from('job-files')
        .upload(storagePath, fileData, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      if (uploadErr) console.log(`  Upload: ${uploadErr.message}`)
      else console.log(`  Uploaded to job-files/${storagePath}`)
    } catch (e) {
      console.log(`  Upload skipped: ${e}`)
    }

    // Create score if exists
    const score = (job as { score?: { accuracy: number; terminology: number; tone_register: number; brand_voice: number; cultural_fit: number; risk: number; hter_score: number } }).score
    if (score && job.reviewer) {
      const { error: scoreErr } = await supabase.from('scores').insert({
        job_id: jobRecord!.id,
        reviewer_id: revMap[job.reviewer],
        ...score,
        reviewer_notes: (job as { reviewer_notes?: string }).reviewer_notes || null,
      })
      if (scoreErr) console.log(`  Score error: ${scoreErr.message}`)
      else console.log(`  Score: hTER ${score.hter_score}`)
    }

    // Audit log entries
    const auditEntries = [
      { actor_id: adminId, action: 'job_created', entity_type: 'job', entity_id: jobRecord!.id, details: { job_number: jobRecord!.job_number }, created_at: job.submitted_at },
    ]

    if (job.reviewer) {
      auditEntries.push({
        actor_id: adminId, action: 'job_allocated', entity_type: 'job', entity_id: jobRecord!.id,
        details: { job_number: jobRecord!.job_number, reviewer: job.reviewer },
        created_at: new Date(new Date(job.submitted_at).getTime() + 1800000).toISOString(),
      })
    }

    if (job.status === 'delivered') {
      auditEntries.push({
        actor_id: adminId, action: 'job_delivered', entity_type: 'job', entity_id: jobRecord!.id,
        details: { job_number: jobRecord!.job_number },
        created_at: (job as { delivered_at?: string }).delivered_at!,
      })
    }

    if (job.status === 'awaiting_signoff' && score) {
      auditEntries.push({
        actor_id: revMap[job.reviewer!], action: 'submitted_for_signoff', entity_type: 'job', entity_id: jobRecord!.id,
        details: { job_number: jobRecord!.job_number, hter_score: score.hter_score },
        created_at: new Date(new Date(job.submitted_at).getTime() + 14400000).toISOString(),
      })
    }

    await supabase.from('audit_log').insert(auditEntries)
    console.log(`  ${auditEntries.length} audit entries`)
    console.log()
  }

  console.log('Done. 5 sample document jobs seeded.')
}

seed().catch(console.error)
