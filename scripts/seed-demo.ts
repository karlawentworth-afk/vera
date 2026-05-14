/**
 * Massive demo seed — creates a fully populated demo environment.
 * Run: npx tsx scripts/seed-demo.ts
 *
 * Creates: 8 client orgs, 8 reviewers, 3 salespeople, 80+ jobs,
 * glossaries, commission agreements, quotes, health snapshots,
 * recommendations, audit log history — spread across 90 days.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ============================================================
// Helpers
// ============================================================
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[rand(0, arr.length - 1)] }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }
function hoursAgo(n: number) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

async function createUser(email: string, name: string): Promise<string> {
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find(u => u.email === email)
  if (found) return found.id
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, password: 'VeraDemo2026!', user_metadata: { full_name: name } })
  if (error) throw new Error(`Create user ${email}: ${error.message}`)
  return data.user.id
}

// ============================================================
// Data definitions
// ============================================================
const CLIENTS = [
  { name: 'Springshot Aviation', tier: 'Governance', industry: 'Aviation', langs: ['EN→DE', 'EN→FR', 'EN→JA'], contacts: [{ first: 'James', last: 'Wright', email: 'james.wright@vera-demo.test', title: 'Head of Content Ops' }, { first: 'Claire', last: 'Foster', email: 'claire.foster@vera-demo.test', title: 'Compliance Manager' }] },
  { name: 'Helix Pharma EMEA', tier: 'Embedded', industry: 'Pharmaceutical', langs: ['EN→FR', 'EN→IT', 'EN→DE'], contacts: [{ first: 'Sarah', last: 'Chen', email: 'sarah.chen@vera-demo.test', title: 'Regulatory Affairs Director' }, { first: 'Marco', last: 'Bellini', email: 'marco.bellini@vera-demo.test', title: 'Clinical Documentation Lead' }] },
  { name: 'Nordic Banking Group', tier: 'Governance', industry: 'Finance', langs: ['EN→DE', 'EN→ES', 'EN→SV'], contacts: [{ first: 'Erik', last: 'Lindqvist', email: 'erik.lindqvist@vera-demo.test', title: 'VP Digital Communications' }, { first: 'Astrid', last: 'Holm', email: 'astrid.holm@vera-demo.test', title: 'Compliance Officer' }] },
  { name: 'Wanderly Travel Co', tier: 'Essentials', industry: 'Travel', langs: ['EN→ES', 'EN→IT'], contacts: [{ first: 'Tom', last: 'Haley', email: 'tom.haley@vera-demo.test', title: 'Marketing Director' }] },
  { name: 'TerraGrid Energy', tier: 'Governance', industry: 'Energy', langs: ['EN→DE', 'EN→FR', 'EN→PL'], contacts: [{ first: 'Lena', last: 'Braun', email: 'lena.braun@vera-demo.test', title: 'Head of Sustainability Comms' }, { first: 'Pawel', last: 'Nowak', email: 'pawel.nowak@vera-demo.test', title: 'Technical Documentation' }] },
  { name: 'Calix Health', tier: 'Essentials', industry: 'MedTech', langs: ['EN→FR', 'EN→DE'], contacts: [{ first: 'Rachel', last: 'Murray', email: 'rachel.murray@vera-demo.test', title: 'Product Marketing' }] },
  { name: 'Northern Foods Group', tier: 'Governance', industry: 'Food Retail', langs: ['EN→PL', 'EN→ES', 'EN→RO'], contacts: [{ first: 'Ian', last: 'Whitfield', email: 'ian.whitfield@vera-demo.test', title: 'Supply Chain Director' }] },
  { name: 'Lufthansa Cargo', tier: 'Embedded', industry: 'Aviation', langs: ['EN→DE', 'EN→FR', 'EN→JA', 'EN→ZH'], contacts: [{ first: 'Thomas', last: 'Richter', email: 'thomas.richter@vera-demo.test', title: 'International Ops Manager' }, { first: 'Yuki', last: 'Tanaka', email: 'yuki.tanaka@vera-demo.test', title: 'Asia-Pacific Liaison' }] },
]

const REVIEWERS = [
  { first: 'Anna', last: 'Müller', email: 'anna.muller@vera-demo.test', langs: ['EN → DE', 'DE → EN'], spec: 'Technical, Compliance', rate: 0.045 },
  { first: 'Pierre', last: 'Laurent', email: 'pierre.laurent@vera-demo.test', langs: ['EN → FR', 'FR → EN'], spec: 'Marketing, Brand', rate: 0.042 },
  { first: 'Hiroshi', last: 'Tanaka', email: 'hiroshi.tanaka@vera-demo.test', langs: ['EN → JA'], spec: 'Technical, Training', rate: 0.055 },
  { first: 'Lucia', last: 'Rossi', email: 'lucia.rossi@vera-demo.test', langs: ['EN → IT', 'IT → EN'], spec: 'Marketing, Travel', rate: 0.040 },
  { first: 'Marta', last: 'Sánchez', email: 'marta.sanchez@vera-demo.test', langs: ['EN → ES'], spec: 'Travel, Hospitality', rate: 0.038 },
  { first: 'Klaus', last: 'Bauer', email: 'klaus.bauer@vera-demo.test', langs: ['EN → DE', 'DE → EN'], spec: 'Automotive, Energy', rate: 0.048 },
  { first: 'Sophie', last: 'Bernard', email: 'sophie.bernard@vera-demo.test', langs: ['EN → FR', 'FR → EN'], spec: 'Healthcare', rate: 0.050 },
  { first: 'Magdalena', last: 'Kowalski', email: 'magdalena.kowalski@vera-demo.test', langs: ['EN → PL'], spec: 'Retail, Manufacturing', rate: 0.040 },
]

const SALESPEOPLE = [
  { first: 'Karla', last: 'Wentworth', email: 'karla.sales@vera-demo.test', finders: 15, recurring: 5, duration: 24, clients: ['Springshot Aviation', 'TerraGrid Energy'] },
  { first: 'David', last: 'Mitchell', email: 'david.mitchell@vera-demo.test', finders: 10, recurring: 3, duration: null, clients: ['Nordic Banking Group', 'Calix Health'] },
  { first: 'Priya', last: 'Sharma', email: 'priya.sharma@vera-demo.test', finders: 20, recurring: 0, duration: null, clients: ['Wanderly Travel Co', 'Northern Foods Group'] },
]

const CONTENT_TYPES = ['Compliance documentation', 'Marketing campaign', 'Training materials', 'Customer communications', 'Technical documentation', 'Clinical summaries', 'Legal disclaimers', 'Website content']
const AI_TOOLS = ['ChatGPT', 'ChatGPT', 'ChatGPT', 'DeepL', 'DeepL', 'Claude', 'Claude', 'Google Translate', 'Google Translate', 'Gemini', 'Microsoft Translator']
const REVIEWER_NOTES = [
  'Clean output. Minor terminology adjustment in paragraph 3.',
  'Two terminology choices flagged for client glossary update. Otherwise excellent AI output.',
  'Significant rework needed — tone registers consistently informal for this premium brand.',
  'Excellent output from Claude on regulated content. Near-publishable quality.',
  'Google Translate struggled with banking register. Multiple formal tone corrections needed.',
  'Strong DeepL output for technical content. One EASA terminology correction.',
  'Brand voice issues — ChatGPT defaulted to conversational rather than professional register.',
  'Glossary alignment good. Two risk segments flagged for legal review.',
  'Clean medical terminology throughout. One consent language adjustment.',
  'Minor cultural adaptation needed for Japanese honorifics in training context.',
]

const TIERS: Record<string, { price: number; words: number | null }> = {
  Essentials: { price: 150000, words: 25000 },
  Governance: { price: 350000, words: 75000 },
  Embedded: { price: 650000, words: null },
}

// ============================================================
// Main seed
// ============================================================
async function seed() {
  console.log('=== Vera Demo Seed (Expanded) ===\n')

  // Clean existing demo data
  console.log('Cleaning existing data...')
  for (const t of ['job_segments', 'scores', 'usage_charges', 'email_log', 'cron_runs', 'stripe_events', 'recommendations', 'ai_health_snapshots', 'glossary_entries', 'brand_voice_notes', 'audit_log', 'commission_payouts', 'reviewer_payouts', 'invoices']) {
    await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }
  await supabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('commission_agreements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // Delete non-admin profiles
  const { data: nonAdmin } = await supabase.from('profiles').select('id').neq('role', 'admin')
  for (const p of nonAdmin ?? []) {
    await supabase.from('profiles').delete().eq('id', p.id)
    try { await supabase.auth.admin.deleteUser(p.id) } catch {}
  }
  await supabase.from('organisations').delete().eq('type', 'client')
  console.log('Clean done.\n')

  // Get admin + operator
  const { data: adminProfile } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single()
  const adminId = adminProfile!.id
  const { data: operatorOrg } = await supabase.from('organisations').select('id').eq('type', 'operator').single()

  // ---- TIER CONFIG ----
  console.log('1. Tier config')
  await supabase.from('tier_config').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('tier_config').upsert([
    { name: 'Essentials', monthly_price_pence: 150000, word_allowance: 25000, overflow_rate_pence: 8, colour: '#1FA1D6', sort_order: 1 },
    { name: 'Governance', monthly_price_pence: 350000, word_allowance: 75000, overflow_rate_pence: 8, colour: '#8E2882', sort_order: 2 },
    { name: 'Embedded', monthly_price_pence: 650000, word_allowance: null, overflow_rate_pence: 8, colour: '#E5187A', sort_order: 3 },
  ], { onConflict: 'name' })

  // ---- ORGANISATIONS + SUBSCRIPTIONS + CLIENT USERS ----
  console.log('2. Organisations & clients')
  const orgMap: Record<string, string> = {}
  const periodStart = new Date(); periodStart.setDate(1); periodStart.setHours(0,0,0,0)
  const periodEnd = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth() + 1)

  for (const client of CLIENTS) {
    const { data: org } = await supabase.from('organisations').insert({
      name: client.name, type: 'client',
      recommendations: [],
    }).select('id').single()
    orgMap[client.name] = org!.id

    const tier = TIERS[client.tier]
    await supabase.from('subscriptions').insert({
      organisation_id: org!.id, tier_name: client.tier,
      monthly_price_pence: tier.price, word_allowance: tier.words,
      overflow_rate_pence: 8, status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })

    for (const contact of client.contacts) {
      const userId = await createUser(contact.email, `${contact.first} ${contact.last}`)
      await supabase.from('profiles').upsert({
        id: userId, email: contact.email, full_name: `${contact.first} ${contact.last}`,
        role: 'client', organisation_id: org!.id, job_title: contact.title,
        invited_at: daysAgo(rand(30, 90)),
      })
    }

    // Glossary entries
    const glossaryTerms = [
      { source_term: client.name.split(' ')[0], target_language: client.langs[0]?.split('→')[1]?.trim() || 'DE', preferred_translation: client.name.split(' ')[0], do_not_translate: true },
      { source_term: 'compliance', target_language: 'DE', preferred_translation: 'Konformität', notes: 'Use in regulatory context' },
      { source_term: 'stakeholder', target_language: 'FR', preferred_translation: 'partie prenante', notes: 'Not "actionnaire"' },
    ]
    for (const term of glossaryTerms) {
      await supabase.from('glossary_entries').insert({ organisation_id: org!.id, ...term })
    }

    // Brand voice
    await supabase.from('brand_voice_notes').insert({
      organisation_id: org!.id,
      guidelines: `${client.name} uses a professional, authoritative tone. Formal register for external communications. Industry: ${client.industry}.`,
      tone_descriptors: ['professional', 'authoritative', 'precise'],
      forbidden_phrases: ['ASAP', 'touch base', 'synergy'],
    })

    console.log(`  ${client.name} (${client.tier})`)
  }

  // ---- REVIEWERS ----
  console.log('3. Reviewers')
  const revMap: Record<string, string> = {}
  for (const rev of REVIEWERS) {
    const userId = await createUser(rev.email, `${rev.first} ${rev.last}`)
    await supabase.from('profiles').upsert({
      id: userId, email: rev.email, full_name: `${rev.first} ${rev.last}`,
      role: 'reviewer', languages: rev.langs, specialism: rev.spec, rate_per_word: rev.rate,
      invited_at: daysAgo(rand(60, 120)),
    })
    revMap[`${rev.first} ${rev.last}`] = userId
    console.log(`  ${rev.first} ${rev.last}`)
  }

  // ---- SALESPEOPLE + COMMISSIONS ----
  console.log('4. Salespeople & commissions')
  for (const sp of SALESPEOPLE) {
    const userId = await createUser(sp.email, `${sp.first} ${sp.last}`)
    await supabase.from('profiles').upsert({
      id: userId, email: sp.email, full_name: `${sp.first} ${sp.last}`,
      role: 'salesperson', default_finders_fee_pct: sp.finders, default_recurring_pct: sp.recurring,
      invited_at: daysAgo(rand(60, 120)),
    })

    for (const clientName of sp.clients) {
      const orgId = orgMap[clientName]
      if (!orgId) continue
      await supabase.from('organisations').update({ introducing_salesperson_id: userId }).eq('id', orgId)
      await supabase.from('commission_agreements').insert({
        salesperson_id: userId, organisation_id: orgId,
        finders_fee_pct: sp.finders, recurring_commission_pct: sp.recurring || 0,
        recurring_duration_months: sp.duration, starts_at: new Date(Date.now() - rand(90, 180) * 86400000).toISOString().split('T')[0],
        status: 'active',
      })

      // Commission payouts for past months
      for (let m = 1; m <= rand(3, 6); m++) {
        const pStart = new Date(); pStart.setMonth(pStart.getMonth() - m); pStart.setDate(1)
        const pEnd = new Date(pStart); pEnd.setMonth(pEnd.getMonth() + 1)
        const tier = CLIENTS.find(c => c.name === clientName)?.tier ?? 'Governance'
        const mrr = TIERS[tier]?.price ?? 350000
        const amount = Math.round(mrr * (sp.recurring || 5) / 100)
        await supabase.from('commission_payouts').insert({
          reference: '', salesperson_id: userId, agreement_id: (await supabase.from('commission_agreements').select('id').eq('salesperson_id', userId).eq('organisation_id', orgId).single()).data!.id,
          period_start: pStart.toISOString().split('T')[0], period_end: pEnd.toISOString().split('T')[0],
          amount_pence: amount, kind: 'recurring', status: m > 1 ? 'paid' : 'pending',
          paid_at: m > 1 ? pEnd.toISOString() : null,
        })
      }
    }
    console.log(`  ${sp.first} ${sp.last} → ${sp.clients.join(', ')}`)
  }

  // ---- JOBS (80+) ----
  console.log('5. Jobs')
  const clientNames = CLIENTS.map(c => c.name)
  const revNames = REVIEWERS.map(r => `${r.first} ${r.last}`)
  const auditEntries: Array<{ actor_id: string; action: string; entity_type: string; entity_id: string; details: Record<string, unknown>; created_at: string }> = []
  let jobCount = 0

  // Delivered jobs (50+)
  for (let i = 0; i < 55; i++) {
    const client = pick(CLIENTS)
    const lang = pick(client.langs)
    const [src, tgt] = lang.split('→')
    const langPair = `EN → ${tgt}`
    const matchingRevs = REVIEWERS.filter(r => r.langs.some(l => l.includes(tgt)))
    const reviewer = matchingRevs.length > 0 ? pick(matchingRevs) : pick(REVIEWERS)
    const revName = `${reviewer.first} ${reviewer.last}`
    const submitted = daysAgo(rand(3, 85))
    const delivered = new Date(new Date(submitted).getTime() + rand(8, 36) * 3600000).toISOString()
    const words = rand(1200, 12000)
    const tool = pick(AI_TOOLS)

    const { data: job } = await supabase.from('jobs').insert({
      job_number: '', organisation_id: orgMap[client.name],
      source_language: src.trim(), target_language: tgt.trim(),
      content_type: pick(CONTENT_TYPES), ai_tool_used: tool,
      word_count: words, urgency: Math.random() < 0.15 ? 'expedited' : 'standard',
      status: 'delivered', reviewer_id: revMap[revName],
      notes: Math.random() < 0.3 ? 'Priority content — client CEO reviewing.' : null,
      submitted_at: submitted, due_at: new Date(new Date(submitted).getTime() + 86400000).toISOString(),
      delivered_at: delivered,
    }).select('id, job_number').single()

    if (!job) continue

    // Score
    const acc = rand(7, 10), term = rand(6, 10), tone = rand(5, 10), brand = rand(6, 10), cult = rand(7, 10), risk = rand(7, 10)
    const avg = (acc + term + tone + brand + cult + risk) / 6
    const hter = parseFloat(Math.max(0.05, Math.min(0.35, (10 - avg) / 10 * 0.5)).toFixed(3))

    await supabase.from('scores').insert({
      job_id: job.id, reviewer_id: revMap[revName],
      accuracy: acc, terminology: term, tone_register: tone, brand_voice: brand, cultural_fit: cult, risk,
      hter_score: hter, reviewer_notes: pick(REVIEWER_NOTES),
    })

    auditEntries.push(
      { actor_id: adminId, action: 'job_created', entity_type: 'job', entity_id: job.id, details: { job_number: job.job_number }, created_at: submitted },
      { actor_id: adminId, action: 'job_allocated', entity_type: 'job', entity_id: job.id, details: { reviewer: revName }, created_at: new Date(new Date(submitted).getTime() + 1800000).toISOString() },
      { actor_id: adminId, action: 'job_delivered', entity_type: 'job', entity_id: job.id, details: { job_number: job.job_number }, created_at: delivered },
    )
    jobCount++
  }

  // In review (12)
  for (let i = 0; i < 12; i++) {
    const client = pick(CLIENTS)
    const lang = pick(client.langs)
    const [src, tgt] = lang.split('→')
    const reviewer = pick(REVIEWERS)
    const revName = `${reviewer.first} ${reviewer.last}`
    const submitted = hoursAgo(rand(4, 72))

    const { data: job } = await supabase.from('jobs').insert({
      job_number: '', organisation_id: orgMap[client.name],
      source_language: src.trim(), target_language: tgt.trim(),
      content_type: pick(CONTENT_TYPES), ai_tool_used: pick(AI_TOOLS),
      word_count: rand(1500, 9000), urgency: Math.random() < 0.2 ? 'expedited' : 'standard',
      status: 'in_review', reviewer_id: revMap[revName],
      submitted_at: submitted, due_at: new Date(new Date(submitted).getTime() + 86400000).toISOString(),
    }).select('id, job_number').single()
    if (job) {
      auditEntries.push({ actor_id: adminId, action: 'job_created', entity_type: 'job', entity_id: job.id, details: { job_number: job.job_number }, created_at: submitted })
      jobCount++
    }
  }

  // Awaiting signoff (8)
  for (let i = 0; i < 8; i++) {
    const client = pick(CLIENTS)
    const lang = pick(client.langs)
    const [src, tgt] = lang.split('→')
    const reviewer = pick(REVIEWERS)
    const revName = `${reviewer.first} ${reviewer.last}`
    const submitted = hoursAgo(rand(12, 96))

    const { data: job } = await supabase.from('jobs').insert({
      job_number: '', organisation_id: orgMap[client.name],
      source_language: src.trim(), target_language: tgt.trim(),
      content_type: pick(CONTENT_TYPES), ai_tool_used: pick(AI_TOOLS),
      word_count: rand(2000, 8000), urgency: 'standard',
      status: 'awaiting_signoff', reviewer_id: revMap[revName],
      submitted_at: submitted, due_at: new Date(new Date(submitted).getTime() + 86400000).toISOString(),
    }).select('id, job_number').single()

    if (job) {
      const acc = rand(6, 10), term = rand(6, 10), tone = rand(5, 9), brand = rand(6, 10), cult = rand(7, 10), risk = rand(7, 10)
      const avg = (acc + term + tone + brand + cult + risk) / 6
      const hter = parseFloat(Math.max(0.08, Math.min(0.35, (10 - avg) / 10 * 0.5)).toFixed(3))
      await supabase.from('scores').insert({
        job_id: job.id, reviewer_id: revMap[revName],
        accuracy: acc, terminology: term, tone_register: tone, brand_voice: brand, cultural_fit: cult, risk,
        hter_score: hter, reviewer_notes: pick(REVIEWER_NOTES),
      })
      auditEntries.push({ actor_id: adminId, action: 'job_created', entity_type: 'job', entity_id: job.id, details: { job_number: job.job_number }, created_at: submitted })
      jobCount++
    }
  }

  // Unallocated (6)
  for (let i = 0; i < 6; i++) {
    const client = pick(CLIENTS)
    const lang = pick(client.langs)
    const [src, tgt] = lang.split('→')
    const submitted = hoursAgo(rand(0, 8))

    const { data: job } = await supabase.from('jobs').insert({
      job_number: '', organisation_id: orgMap[client.name],
      source_language: src.trim(), target_language: tgt.trim(),
      content_type: pick(CONTENT_TYPES), ai_tool_used: pick(AI_TOOLS),
      word_count: rand(1000, 7000), urgency: Math.random() < 0.3 ? 'expedited' : 'standard',
      status: 'unallocated', submitted_at: submitted,
      due_at: new Date(new Date(submitted).getTime() + 86400000).toISOString(),
    }).select('id, job_number').single()
    if (job) {
      auditEntries.push({ actor_id: adminId, action: 'job_created', entity_type: 'job', entity_id: job.id, details: { job_number: job.job_number }, created_at: submitted })
      jobCount++
    }
  }

  // Returned for revision (4)
  for (let i = 0; i < 4; i++) {
    const client = pick(CLIENTS)
    const lang = pick(client.langs)
    const [src, tgt] = lang.split('→')
    const reviewer = pick(REVIEWERS)
    const revName = `${reviewer.first} ${reviewer.last}`
    const submitted = hoursAgo(rand(24, 120))

    const { data: job } = await supabase.from('jobs').insert({
      job_number: '', organisation_id: orgMap[client.name],
      source_language: src.trim(), target_language: tgt.trim(),
      content_type: pick(CONTENT_TYPES), ai_tool_used: pick(AI_TOOLS),
      word_count: rand(2000, 6000), urgency: 'standard',
      status: 'in_review', reviewer_id: revMap[revName],
      submitted_at: submitted, due_at: new Date(new Date(submitted).getTime() + 86400000).toISOString(),
      iteration_count: 2,
      review_iterations: [{ iteration_number: 1, returned_at: hoursAgo(rand(6, 48)), returned_by: adminId, feedback_text: 'Please double-check the formal register throughout — several segments feel too informal for this client.' }],
    }).select('id, job_number').single()
    if (job) { auditEntries.push({ actor_id: adminId, action: 'job_created', entity_type: 'job', entity_id: job.id, details: { job_number: job.job_number }, created_at: submitted }); jobCount++ }
  }

  console.log(`  ${jobCount} jobs created`)

  // ---- AUDIT LOG ----
  console.log('6. Audit log')
  // Batch insert
  for (let i = 0; i < auditEntries.length; i += 50) {
    await supabase.from('audit_log').insert(auditEntries.slice(i, i + 50))
  }
  console.log(`  ${auditEntries.length} entries`)

  // ---- QUOTES ----
  console.log('7. Quotes')
  const quotes = [
    { quote_number: 'Q-101', prospect_name: 'Martijn de Vries', prospect_company: 'Rotterdam Logistics BV', proposal: 'Governance tier + onboarding', proposed_tier: 'Governance', monthly_value: 420000, status: 'sent', sent_at: daysAgo(3) },
    { quote_number: 'Q-102', prospect_name: 'Fabienne Leclerc', prospect_company: 'Aéroports de Lyon', proposal: 'Embedded tier (pilot programme)', proposed_tier: 'Embedded', monthly_value: 650000, status: 'draft' },
    { quote_number: 'Q-103', prospect_name: 'Henrik Svensson', prospect_company: 'Scandinavian Motors', proposal: 'Essentials tier', proposed_tier: 'Essentials', monthly_value: 150000, status: 'sent', sent_at: daysAgo(7) },
    { quote_number: 'Q-104', prospect_name: 'Giulia Conti', prospect_company: 'Farmacia Centrale', proposal: 'AI Translation Health Check', proposed_tier: null, monthly_value: 600000, status: 'accepted', sent_at: daysAgo(14), accepted_at: daysAgo(10) },
    { quote_number: 'Q-105', prospect_name: 'Maria Kowalska', prospect_company: 'Warsaw Retail Group', proposal: 'Governance tier', proposed_tier: 'Governance', monthly_value: 350000, status: 'declined', sent_at: daysAgo(21) },
    { quote_number: 'Q-106', prospect_name: 'Alex Thompson', prospect_company: 'Pacific Shipping Corp', proposal: 'Embedded tier + Trados integration', proposed_tier: 'Embedded', monthly_value: 850000, status: 'draft' },
  ]
  await supabase.from('quotes').insert(quotes)

  // ---- HEALTH SNAPSHOTS ----
  console.log('8. Health snapshots')
  const now = new Date()
  for (const clientName of Object.keys(orgMap)) {
    for (let m = 0; m < 6; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const score = rand(72, 95) - m * rand(0, 3)
      await supabase.from('ai_health_snapshots').upsert({
        organisation_id: orgMap[clientName],
        snapshot_date: d.toISOString().split('T')[0],
        overall_score: Math.max(65, score),
        prev_period_score: Math.max(60, score - rand(2, 6)),
        jobs_in_period: rand(3, 15),
        words_in_period: rand(8000, 45000),
        avg_hter: parseFloat((rand(8, 25) / 100).toFixed(3)),
        by_language_pair: [], by_content_type: [], by_ai_tool: [],
      }, { onConflict: 'organisation_id,snapshot_date' })
    }
  }

  // ---- RECOMMENDATIONS ----
  console.log('9. Recommendations')
  const recTemplates = [
    { title: 'Technical terminology performing strongly', body: 'hTER consistently below 0.15 for compliance content. AI prompts well-calibrated.', severity: 'positive' },
    { title: 'Marketing copy needs prompt tuning', body: 'Tone registers informal — add "professional, formal register" to AI prompts.', severity: 'attention' },
    { title: 'Consider dedicated glossary for this language pair', body: 'Frequent terminology corrections suggest a glossary would reduce editing time.', severity: 'neutral' },
    { title: 'Claude outperforming on regulated content', body: 'Clinical/compliance content from Claude scores significantly better than alternatives.', severity: 'positive' },
    { title: 'Approaching word allowance', body: 'Current pace suggests exceeding allowance by mid-month. Consider proactive upgrade.', severity: 'attention' },
  ]
  for (const clientName of Object.keys(orgMap)) {
    const numRecs = rand(2, 4)
    for (let i = 0; i < numRecs; i++) {
      const rec = pick(recTemplates)
      await supabase.from('recommendations').insert({ organisation_id: orgMap[clientName], ...rec })
    }
  }

  // ---- EMAIL LOG ----
  console.log('10. Email log')
  const emailEntries = []
  for (const client of CLIENTS) {
    for (const contact of client.contacts) {
      emailEntries.push({ recipient: contact.email, template: 'welcome_client', subject: `Welcome to Vera, ${contact.first}`, status: 'sent', created_at: daysAgo(rand(30, 90)) })
    }
  }
  for (const rev of REVIEWERS) {
    emailEntries.push({ recipient: rev.email, template: 'welcome_reviewer', subject: `Welcome to Vera's reviewer team, ${rev.first}`, status: 'sent', created_at: daysAgo(rand(60, 120)) })
  }
  for (let i = 0; i < 20; i++) {
    emailEntries.push({ recipient: pick(REVIEWERS).email, template: 'job_allocated_reviewer', subject: `New job assigned: V-${rand(2900, 2999)}`, status: 'sent', created_at: daysAgo(rand(1, 60)) })
  }
  await supabase.from('email_log').insert(emailEntries)
  console.log(`  ${emailEntries.length} email log entries`)

  // ---- LEADS ----
  console.log('11. Leads')
  // Get salesperson IDs
  const { data: spProfiles } = await supabase.from('profiles').select('id, full_name').eq('role', 'salesperson')
  const spIds = spProfiles?.map(p => p.id) ?? []

  const leadData = [
    // Karla's leads
    { owner: 0, contact: 'Martijn de Vries', email: 'martijn@rotterdamlogistics.nl', company: 'Rotterdam Logistics BV', industry: 'Logistics', size: 'large', source: 'Event', stage: 'proposal_sent', value: 420000, next: 'Follow up on proposal', nextDate: 1 },
    { owner: 0, contact: 'Fabienne Leclerc', email: 'fabienne@aeroportslyon.fr', company: 'Aéroports de Lyon', industry: 'Aviation', size: 'enterprise', source: 'Referral', stage: 'demo_booked', value: 650000, next: 'Prepare demo environment', nextDate: 3 },
    { owner: 0, contact: 'Chen Wei', email: 'chen.wei@pacificshipping.hk', company: 'Pacific Shipping Corp', industry: 'Shipping', size: 'enterprise', source: 'LinkedIn', stage: 'contacted', value: 850000, next: 'Send intro deck', nextDate: 2 },
    { owner: 0, contact: 'Sofia Andersson', email: 'sofia@nordicpharma.se', company: 'Nordic Pharma AB', industry: 'Pharma', size: 'medium', source: 'Cold outreach', stage: 'new', value: 350000 },
    { owner: 0, contact: 'João Silva', email: 'joao@brasiltransport.br', company: 'Brasil Transport SA', industry: 'Logistics', size: 'large', source: 'Event', stage: 'won', value: 350000 },
    { owner: 0, contact: 'Emma Fitzgerald', email: 'emma.f@dublintech.ie', company: 'Dublin Tech Solutions', industry: 'Technology', size: 'small', source: 'Website', stage: 'lost', value: 150000 },
    // David's leads
    { owner: 1, contact: 'Henrik Svensson', email: 'henrik@scandmotors.se', company: 'Scandinavian Motors', industry: 'Automotive', size: 'large', source: 'Referral', stage: 'negotiating', value: 350000, next: 'Final pricing discussion', nextDate: 2 },
    { owner: 1, contact: 'Giulia Conti', email: 'giulia@farmaciacentrale.it', company: 'Farmacia Centrale', industry: 'Healthcare', size: 'medium', source: 'Event', stage: 'qualified', value: 150000, next: 'Schedule discovery call', nextDate: 5 },
    { owner: 1, contact: 'Alexander Braun', email: 'alex@berlinfin.de', company: 'Berlin Finance Group', industry: 'Finance', size: 'large', source: 'LinkedIn', stage: 'demo_booked', value: 650000, next: 'Demo prep with tech team', nextDate: 1 },
    { owner: 1, contact: 'Yuki Nakamura', email: 'yuki@tokyoretail.jp', company: 'Tokyo Retail Corp', industry: 'Retail', size: 'enterprise', source: 'Cold outreach', stage: 'contacted', value: 350000 },
    { owner: 1, contact: 'Pierre Moreau', email: 'pierre@lyonfood.fr', company: 'Lyon Food Industries', industry: 'Food', size: 'medium', source: 'Referral', stage: 'lost', value: 350000 },
    // Priya's leads
    { owner: 2, contact: 'Maria Kowalska', email: 'maria@warsawretail.pl', company: 'Warsaw Retail Group', industry: 'Retail', size: 'large', source: 'Event', stage: 'proposal_sent', value: 350000, next: 'Awaiting board decision', nextDate: 7 },
    { owner: 2, contact: 'Antonio Rossi', email: 'antonio@milanfashion.it', company: 'Milan Fashion House', industry: 'Fashion', size: 'medium', source: 'Referral', stage: 'qualified', value: 150000, next: 'Send case study', nextDate: 3 },
    { owner: 2, contact: 'Lars Eriksen', email: 'lars@copenhagenenergy.dk', company: 'Copenhagen Energy AS', industry: 'Energy', size: 'large', source: 'LinkedIn', stage: 'new', value: 650000 },
    { owner: 2, contact: 'Aisha Patel', email: 'aisha@mumbaihealth.in', company: 'Mumbai Health Tech', industry: 'Healthcare', size: 'medium', source: 'Website', stage: 'contacted', value: 150000, next: 'Follow up email', nextDate: 1 },
    { owner: 2, contact: 'Thomas Weber', email: 'thomas@zurichinsurance.ch', company: 'Zurich Re Insurance', industry: 'Insurance', size: 'enterprise', source: 'Cold outreach', stage: 'won', value: 650000 },
  ]

  let leadCount = 0
  for (const l of leadData) {
    if (!spIds[l.owner]) continue
    const nextDate = l.nextDate ? new Date(Date.now() + l.nextDate * 86400000).toISOString().split('T')[0] : null
    const { data: lead } = await supabase.from('leads').insert({
      reference: '', owner_id: spIds[l.owner], contact_name: l.contact,
      contact_email: l.email, company_name: l.company, industry: l.industry,
      company_size: l.size, source: l.source, stage: l.stage,
      estimated_value_pence: l.value, next_action: l.next ?? null,
      next_action_date: nextDate,
      lost_reason: l.stage === 'lost' ? 'Budget constraints — revisit Q2' : null,
    }).select('id').single()

    if (lead) {
      // Add some activities
      await supabase.from('lead_activities').insert([
        { lead_id: lead.id, type: 'note', summary: `Lead created from ${l.source}`, created_by: spIds[l.owner], occurred_at: daysAgo(rand(15, 60)) },
        ...(l.stage !== 'new' ? [{ lead_id: lead.id, type: 'email' as const, summary: 'Sent intro email with Vera overview deck', created_by: spIds[l.owner], occurred_at: daysAgo(rand(10, 30)) }] : []),
        ...(l.stage === 'demo_booked' || l.stage === 'proposal_sent' || l.stage === 'negotiating' || l.stage === 'won' ? [{ lead_id: lead.id, type: 'meeting' as const, summary: 'Discovery call — discussed AI translation governance needs', created_by: spIds[l.owner], occurred_at: daysAgo(rand(5, 15)) }] : []),
        ...(l.stage === 'won' ? [{ lead_id: lead.id, type: 'stage_change' as const, summary: 'Deal won — contract signed', created_by: spIds[l.owner], occurred_at: daysAgo(rand(1, 5)) }] : []),
      ])
      // Add a note
      await supabase.from('lead_notes').insert({
        lead_id: lead.id, author_id: spIds[l.owner],
        body: l.stage === 'won' ? 'Great outcome — they were impressed by the AI Health Score demo.' :
              l.stage === 'lost' ? 'Budget frozen for this quarter. Keep warm for Q2 review.' :
              `Good initial conversation. ${l.company} has ${l.size} translation volume, primarily ${l.industry} content. Interested in Vera's governance angle.`,
      })
      leadCount++
    }
  }
  console.log(`  ${leadCount} leads created`)

  // ---- INTERNAL NOTES ----
  console.log('12. Internal notes')
  // Get a few job IDs for notes
  const { data: recentJobs } = await supabase.from('jobs').select('id, job_number').order('submitted_at', { ascending: false }).limit(5)
  if (recentJobs && recentJobs.length >= 3) {
    const noteData = [
      { job_id: recentJobs[0].id, author_id: adminId, body: `Client (Springshot) requested expedited — confirmed verbally with James, will absorb the 50% surcharge as goodwill given they introduced us to Lufthansa Cargo.`, is_pinned: true, is_demo: true },
      { job_id: recentJobs[1].id, author_id: adminId, body: `Putting on hold — client legal review pending until Wednesday. Don't allocate yet.`, is_pinned: true, is_demo: true },
      { job_id: recentJobs[0].id, author_id: revMap['Anna Müller'] ?? adminId, body: `This Japanese training content reuses much of the terminology from the previous delivery — worth a quick consistency check.`, is_pinned: false, is_demo: true },
      { job_id: recentJobs[2].id, author_id: adminId, body: `@reviewer — client asked if we can include their new product name in the next glossary update. Adding 'Springshot Verify' as do-not-translate.`, is_pinned: false, is_demo: true },
      { job_id: recentJobs[1].id, author_id: revMap['Pierre Laurent'] ?? adminId, body: `Brand voice consistently informal where client's style guide requires neutral-formal. Flagged three specific segments for Emma's review.`, is_pinned: false, is_demo: true },
    ]
    await supabase.from('job_internal_notes').insert(noteData)
    console.log(`  ${noteData.length} internal notes created`)
  }

  // ---- MARK ALL AS DEMO ----
  console.log('13. Marking all records is_demo=true')
  const demoTables = [
    'organisations', 'subscriptions', 'jobs', 'job_segments', 'scores', 'quotes',
    'invoices', 'usage_charges', 'reviewer_payouts', 'commission_agreements',
    'commission_payouts', 'recommendations', 'ai_health_snapshots', 'audit_log',
    'email_log', 'glossary_entries', 'brand_voice_notes', 'cron_runs',
    'leads', 'lead_notes', 'lead_activities', 'job_internal_notes',
  ]
  for (const table of demoTables) {
    await supabase.from(table).update({ is_demo: true }).eq('is_demo', false)
  }
  // Mark non-admin profiles as demo
  await supabase.from('profiles').update({ is_demo: true }).neq('role', 'admin')
  // Mark client orgs as demo (operator stays live)
  await supabase.from('organisations').update({ is_demo: true }).eq('type', 'client')
  await supabase.from('organisations').update({ is_demo: false }).eq('type', 'operator')
  console.log('  Done')

  console.log('\n=== Demo seed complete! ===')
  console.log(`${Object.keys(orgMap).length} clients, ${REVIEWERS.length} reviewers, ${SALESPEOPLE.length} salespeople, ${jobCount} jobs`)
}

seed().catch(console.error)
