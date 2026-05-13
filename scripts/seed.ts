/**
 * Vera seed script
 * Creates demo data: operator org, Emma admin, 3 client orgs, 5 reviewers, 15 jobs, scores.
 *
 * Usage:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY to .env (find it in Supabase > Settings > API > service_role)
 *   2. npm run seed
 *
 * Safe to re-run: deletes existing seed data first.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey || serviceKey === 'your-service-role-key-here') {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env — find it in Supabase > Settings > API')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================
// Helpers
// ============================================================

async function upsertUser(email: string, fullName: string): Promise<string> {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find(u => u.email === email)
  if (found) {
    console.log(`  User exists: ${email}`)
    return found.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw new Error(`Failed to create user ${email}: ${error.message}`)
  console.log(`  Created user: ${email}`)
  return data.user.id
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function hoursAgo(n: number): string {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d.toISOString()
}

function hoursFromNow(n: number): string {
  const d = new Date()
  d.setHours(d.getHours() + n)
  return d.toISOString()
}

// ============================================================
// Seed data
// ============================================================

async function seed() {
  console.log('Seeding Vera demo data...\n')

  // ----------------------------------------------------------
  // 1. Tier config
  // ----------------------------------------------------------
  console.log('1. Tier config')
  await supabase.from('tier_config').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { error: tierErr } = await supabase.from('tier_config').upsert([
    { name: 'Essentials', monthly_price_pence: 150000, word_allowance: 25000, overflow_rate_pence: 8, colour: '#1FA1D6', sort_order: 1 },
    { name: 'Governance', monthly_price_pence: 350000, word_allowance: 75000, overflow_rate_pence: 8, colour: '#8E2882', sort_order: 2 },
    { name: 'Embedded',   monthly_price_pence: 650000, word_allowance: null,  overflow_rate_pence: 8, colour: '#E5187A', sort_order: 3 },
  ], { onConflict: 'name' })
  if (tierErr) throw tierErr
  console.log('  Done\n')

  // ----------------------------------------------------------
  // 2. Organisations
  // ----------------------------------------------------------
  console.log('2. Organisations')

  // Clean up existing orgs (cascade deletes profiles, subs, jobs)
  await supabase.from('scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('organisations').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const orgs = [
    { name: 'ECLS Translations', type: 'operator' as const },
    { name: 'Springshot Aviation', type: 'client' as const },
    { name: 'Helix Pharma EMEA', type: 'client' as const },
    { name: 'Nordic Banking Group', type: 'client' as const },
  ]

  const { data: orgRows, error: orgErr } = await supabase.from('organisations').insert(orgs).select()
  if (orgErr) throw orgErr
  const orgMap = Object.fromEntries(orgRows!.map(o => [o.name, o.id]))
  console.log(`  Created ${orgRows!.length} organisations\n`)

  // ----------------------------------------------------------
  // 3. Users & profiles
  // ----------------------------------------------------------
  console.log('3. Users & profiles')

  // Emma (admin)
  const emmaId = await upsertUser('karla.wentworth@thatsclevermx.com', 'Emma Cheetham')

  // Reviewers — use fake emails (they won't log in for the demo)
  const annaId = await upsertUser('anna.muller@vera-demo.test', 'Anna Müller')
  const pierreId = await upsertUser('pierre.laurent@vera-demo.test', 'Pierre Laurent')
  const hiroshiId = await upsertUser('hiroshi.tanaka@vera-demo.test', 'Hiroshi Tanaka')
  const luciaId = await upsertUser('lucia.rossi@vera-demo.test', 'Lucia Rossi')
  const martaId = await upsertUser('marta.sanchez@vera-demo.test', 'Marta Sánchez')

  // Client contacts
  const springContactId = await upsertUser('james.wright@vera-demo.test', 'James Wright')
  const helixContactId = await upsertUser('sarah.chen@vera-demo.test', 'Sarah Chen')
  const nordicContactId = await upsertUser('erik.lindqvist@vera-demo.test', 'Erik Lindqvist')

  const profiles = [
    { id: emmaId, email: 'karla.wentworth@thatsclevermx.com', full_name: 'Emma Cheetham', role: 'admin' as const, organisation_id: orgMap['ECLS Translations'] },
    // Reviewers (no org — they're freelance)
    { id: annaId, email: 'anna.muller@vera-demo.test', full_name: 'Anna Müller', role: 'reviewer' as const, organisation_id: null, languages: ['EN → DE', 'DE → EN'], specialism: 'Technical, Compliance', rate_per_word: 0.045 },
    { id: pierreId, email: 'pierre.laurent@vera-demo.test', full_name: 'Pierre Laurent', role: 'reviewer' as const, organisation_id: null, languages: ['EN → FR', 'FR → EN'], specialism: 'Marketing, Brand', rate_per_word: 0.042 },
    { id: hiroshiId, email: 'hiroshi.tanaka@vera-demo.test', full_name: 'Hiroshi Tanaka', role: 'reviewer' as const, organisation_id: null, languages: ['EN → JA'], specialism: 'Technical, Training', rate_per_word: 0.055 },
    { id: luciaId, email: 'lucia.rossi@vera-demo.test', full_name: 'Lucia Rossi', role: 'reviewer' as const, organisation_id: null, languages: ['EN → IT', 'IT → EN'], specialism: 'Marketing, Travel', rate_per_word: 0.040 },
    { id: martaId, email: 'marta.sanchez@vera-demo.test', full_name: 'Marta Sánchez', role: 'reviewer' as const, organisation_id: null, languages: ['EN → ES'], specialism: 'Travel, Hospitality', rate_per_word: 0.038 },
    // Client contacts
    { id: springContactId, email: 'james.wright@vera-demo.test', full_name: 'James Wright', role: 'client' as const, organisation_id: orgMap['Springshot Aviation'] },
    { id: helixContactId, email: 'sarah.chen@vera-demo.test', full_name: 'Sarah Chen', role: 'client' as const, organisation_id: orgMap['Helix Pharma EMEA'] },
    { id: nordicContactId, email: 'erik.lindqvist@vera-demo.test', full_name: 'Erik Lindqvist', role: 'client' as const, organisation_id: orgMap['Nordic Banking Group'] },
  ]

  const { error: profErr } = await supabase.from('profiles').upsert(profiles)
  if (profErr) throw profErr
  console.log(`  Created ${profiles.length} profiles\n`)

  // ----------------------------------------------------------
  // 4. Subscriptions
  // ----------------------------------------------------------
  console.log('4. Subscriptions')

  const periodStart = new Date()
  periodStart.setDate(1)
  periodStart.setHours(0, 0, 0, 0)
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const subs = [
    { organisation_id: orgMap['Springshot Aviation'], tier_name: 'Governance', monthly_price_pence: 350000, word_allowance: 75000, overflow_rate_pence: 8, status: 'active' as const, current_period_start: periodStart.toISOString(), current_period_end: periodEnd.toISOString() },
    { organisation_id: orgMap['Helix Pharma EMEA'], tier_name: 'Embedded', monthly_price_pence: 650000, word_allowance: null, overflow_rate_pence: 8, status: 'active' as const, current_period_start: periodStart.toISOString(), current_period_end: periodEnd.toISOString() },
    { organisation_id: orgMap['Nordic Banking Group'], tier_name: 'Governance', monthly_price_pence: 350000, word_allowance: 75000, overflow_rate_pence: 8, status: 'active' as const, current_period_start: periodStart.toISOString(), current_period_end: periodEnd.toISOString() },
  ]

  const { error: subErr } = await supabase.from('subscriptions').insert(subs)
  if (subErr) throw subErr
  console.log(`  Created ${subs.length} subscriptions\n`)

  // ----------------------------------------------------------
  // 5. Jobs (15 across various statuses)
  // ----------------------------------------------------------
  console.log('5. Jobs')

  const jobs = [
    // UNALLOCATED (1)
    { job_number: '', organisation_id: orgMap['Springshot Aviation'], source_language: 'EN', target_language: 'ES', content_type: 'Website content', ai_tool_used: 'ChatGPT', word_count: 3200, urgency: 'standard' as const, status: 'unallocated' as const, reviewer_id: null, notes: null, submitted_at: hoursAgo(0.5), due_at: hoursFromNow(23.5) },

    // IN REVIEW (4)
    { job_number: '', organisation_id: orgMap['Springshot Aviation'], source_language: 'EN', target_language: 'DE', content_type: 'Compliance documentation', ai_tool_used: 'Claude', word_count: 4280, urgency: 'expedited' as const, status: 'in_review' as const, reviewer_id: annaId, notes: 'Safety-critical content — fire suppression procedures', submitted_at: hoursAgo(2), due_at: hoursFromNow(4) },
    { job_number: '', organisation_id: orgMap['Nordic Banking Group'], source_language: 'EN', target_language: 'DE', content_type: 'Customer communications', ai_tool_used: 'DeepL', word_count: 8900, urgency: 'standard' as const, status: 'in_review' as const, reviewer_id: annaId, notes: null, submitted_at: daysAgo(1), due_at: hoursFromNow(12) },
    { job_number: '', organisation_id: orgMap['Helix Pharma EMEA'], source_language: 'EN', target_language: 'FR', content_type: 'Clinical summaries', ai_tool_used: 'ChatGPT', word_count: 3400, urgency: 'standard' as const, status: 'in_review' as const, reviewer_id: pierreId, notes: 'Phase III trial summaries for regulatory submission', submitted_at: hoursAgo(8), due_at: hoursFromNow(16) },
    { job_number: '', organisation_id: orgMap['Springshot Aviation'], source_language: 'EN', target_language: 'JA', content_type: 'Training materials', ai_tool_used: 'ChatGPT', word_count: 5100, urgency: 'standard' as const, status: 'in_review' as const, reviewer_id: hiroshiId, notes: 'New cabin crew onboarding module', submitted_at: daysAgo(1), due_at: hoursFromNow(8) },

    // AWAITING SIGNOFF (2)
    { job_number: '', organisation_id: orgMap['Helix Pharma EMEA'], source_language: 'EN', target_language: 'FR', content_type: 'Marketing campaign', ai_tool_used: 'DeepL', word_count: 2150, urgency: 'standard' as const, status: 'awaiting_signoff' as const, reviewer_id: pierreId, notes: null, submitted_at: hoursAgo(6), due_at: hoursFromNow(18) },
    { job_number: '', organisation_id: orgMap['Nordic Banking Group'], source_language: 'EN', target_language: 'DE', content_type: 'Legal disclaimers', ai_tool_used: 'Claude', word_count: 1800, urgency: 'standard' as const, status: 'awaiting_signoff' as const, reviewer_id: annaId, notes: 'Annual T&C updates for retail banking', submitted_at: daysAgo(2), due_at: hoursFromNow(6) },

    // DELIVERED (8)
    { job_number: '', organisation_id: orgMap['Springshot Aviation'], source_language: 'EN', target_language: 'DE', content_type: 'Ground crew briefings', ai_tool_used: 'ChatGPT', word_count: 4100, urgency: 'standard' as const, status: 'delivered' as const, reviewer_id: annaId, submitted_at: daysAgo(5), due_at: daysAgo(4), delivered_at: daysAgo(4) },
    { job_number: '', organisation_id: orgMap['Springshot Aviation'], source_language: 'EN', target_language: 'JA', content_type: 'Training materials', ai_tool_used: 'ChatGPT', word_count: 5600, urgency: 'standard' as const, status: 'delivered' as const, reviewer_id: hiroshiId, submitted_at: daysAgo(7), due_at: daysAgo(6), delivered_at: daysAgo(6) },
    { job_number: '', organisation_id: orgMap['Helix Pharma EMEA'], source_language: 'EN', target_language: 'FR', content_type: 'Compliance documentation', ai_tool_used: 'Claude', word_count: 6400, urgency: 'standard' as const, status: 'delivered' as const, reviewer_id: pierreId, submitted_at: daysAgo(10), due_at: daysAgo(9), delivered_at: daysAgo(9) },
    { job_number: '', organisation_id: orgMap['Helix Pharma EMEA'], source_language: 'EN', target_language: 'IT', content_type: 'Marketing campaign', ai_tool_used: 'DeepL', word_count: 2800, urgency: 'standard' as const, status: 'delivered' as const, reviewer_id: luciaId, submitted_at: daysAgo(8), due_at: daysAgo(7), delivered_at: daysAgo(7) },
    { job_number: '', organisation_id: orgMap['Nordic Banking Group'], source_language: 'EN', target_language: 'DE', content_type: 'Customer communications', ai_tool_used: 'ChatGPT', word_count: 3200, urgency: 'standard' as const, status: 'delivered' as const, reviewer_id: annaId, submitted_at: daysAgo(12), due_at: daysAgo(11), delivered_at: daysAgo(11) },
    { job_number: '', organisation_id: orgMap['Nordic Banking Group'], source_language: 'EN', target_language: 'ES', content_type: 'Website content', ai_tool_used: 'ChatGPT', word_count: 4500, urgency: 'standard' as const, status: 'delivered' as const, reviewer_id: martaId, submitted_at: daysAgo(9), due_at: daysAgo(8), delivered_at: daysAgo(8) },
    { job_number: '', organisation_id: orgMap['Springshot Aviation'], source_language: 'EN', target_language: 'DE', content_type: 'Technical documentation', ai_tool_used: 'Claude', word_count: 7200, urgency: 'expedited' as const, status: 'delivered' as const, reviewer_id: annaId, submitted_at: daysAgo(4), due_at: daysAgo(3.75), delivered_at: daysAgo(3.8) },
    { job_number: '', organisation_id: orgMap['Helix Pharma EMEA'], source_language: 'EN', target_language: 'FR', content_type: 'Patient information leaflets', ai_tool_used: 'ChatGPT', word_count: 3800, urgency: 'standard' as const, status: 'delivered' as const, reviewer_id: pierreId, submitted_at: daysAgo(14), due_at: daysAgo(13), delivered_at: daysAgo(13) },
  ]

  const { data: jobRows, error: jobErr } = await supabase.from('jobs').insert(jobs).select()
  if (jobErr) throw jobErr
  console.log(`  Created ${jobRows!.length} jobs\n`)

  // ----------------------------------------------------------
  // 6. Scores for delivered + awaiting_signoff jobs
  // ----------------------------------------------------------
  console.log('6. Scores')

  const scorableJobs = jobRows!.filter(j =>
    j.status === 'delivered' || j.status === 'awaiting_signoff'
  )

  const scoreRecords = scorableJobs.map(job => {
    // Generate realistic scores (7-10 range mostly, with some variation)
    const accuracy = randomBetween(7, 10)
    const terminology = randomBetween(7, 10)
    const tone_register = randomBetween(6, 10)
    const brand_voice = randomBetween(7, 10)
    const cultural_fit = randomBetween(7, 10)
    const risk = randomBetween(7, 10)

    // hTER: lower is better, derived from scores. Approximate: (60 - avg) / 100
    const avg = (accuracy + terminology + tone_register + brand_voice + cultural_fit + risk) / 6
    const hter = Math.max(0.05, Math.min(0.35, parseFloat(((10 - avg) / 10 * 0.5).toFixed(3))))

    return {
      job_id: job.id,
      reviewer_id: job.reviewer_id!,
      accuracy,
      terminology,
      tone_register,
      brand_voice,
      cultural_fit,
      risk,
      hter_score: hter,
      reviewer_notes: null,
    }
  })

  const { error: scoreErr } = await supabase.from('scores').insert(scoreRecords)
  if (scoreErr) throw scoreErr
  console.log(`  Created ${scoreRecords.length} score records\n`)

  // ----------------------------------------------------------
  // 7. Sample quotes
  // ----------------------------------------------------------
  console.log('7. Quotes')

  const quotes = [
    { quote_number: 'Q-088', prospect_name: 'Aviation Partners EMEA', proposal: 'Governance tier + onboarding', monthly_value: 420000, status: 'sent' as const, sent_at: daysAgo(3) },
    { quote_number: 'Q-087', prospect_name: 'MediTech Solutions', proposal: 'Essentials tier', monthly_value: 150000, status: 'accepted' as const, sent_at: daysAgo(7) },
    { quote_number: 'Q-086', prospect_name: 'Northern Foods Group', proposal: 'AI Translation Health Check', monthly_value: 600000, status: 'sent' as const, sent_at: daysAgo(5) },
    { quote_number: 'Q-085', prospect_name: 'Lufthansa Cargo', proposal: 'Embedded tier (pending pilot)', monthly_value: 850000, status: 'draft' as const },
  ]

  const { error: quoteErr } = await supabase.from('quotes').insert(quotes)
  if (quoteErr) throw quoteErr
  console.log(`  Created ${quotes.length} quotes\n`)

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------
  console.log('============================================')
  console.log('Seed complete!')
  console.log('')
  console.log('Login as Emma: karla.wentworth@thatsclevermx.com')
  console.log('(Use magic link — check your email)')
  console.log('')
  console.log(`Organisations: ${orgRows!.length}`)
  console.log(`Profiles: ${profiles.length}`)
  console.log(`Subscriptions: ${subs.length}`)
  console.log(`Jobs: ${jobRows!.length}`)
  console.log(`Scores: ${scoreRecords.length}`)
  console.log(`Quotes: ${quotes.length}`)
  console.log('============================================')
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
