import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const c = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

async function wipe() {
  console.log('=== Wiping live data (is_demo=false) ===\n')

  const tables = ['job_segments', 'scores', 'usage_charges', 'email_log', 'cron_runs', 'recommendations', 'ai_health_snapshots', 'glossary_entries', 'brand_voice_notes', 'audit_log', 'commission_payouts', 'reviewer_payouts', 'invoices']
  for (const t of tables) {
    const r = await c.from(t).delete().eq('is_demo', false)
    console.log(`  ${t}: ${r.error ? 'ERR ' + r.error.message : 'cleared'}`)
  }

  await c.from('jobs').delete().eq('is_demo', false)
  console.log('  jobs: cleared')
  await c.from('quotes').delete().eq('is_demo', false)
  console.log('  quotes: cleared')
  await c.from('commission_agreements').delete().eq('is_demo', false)
  console.log('  commission_agreements: cleared')
  await c.from('subscriptions').delete().eq('is_demo', false)
  console.log('  subscriptions: cleared')

  // Delete non-admin live profiles
  const { data: liveProfiles } = await c.from('profiles').select('id, email, role').eq('is_demo', false).neq('role', 'admin')
  for (const p of liveProfiles ?? []) {
    await c.from('profiles').delete().eq('id', p.id)
    try { await c.auth.admin.deleteUser(p.id) } catch {}
    console.log(`  Deleted live profile: ${p.email} (${p.role})`)
  }

  // Delete non-operator live orgs
  const { data: opOrg } = await c.from('organisations').select('id').eq('type', 'operator').single()
  if (opOrg) {
    await c.from('organisations').delete().eq('is_demo', false).neq('id', opOrg.id)
    console.log('  Deleted live orgs (except operator)')
  }

  // Verify
  console.log('\n=== Verification ===')
  const { count: liveProf } = await c.from('profiles').select('*', { count: 'exact', head: true }).eq('is_demo', false)
  const { count: liveOrg } = await c.from('organisations').select('*', { count: 'exact', head: true }).eq('is_demo', false)
  const { count: liveJobs } = await c.from('jobs').select('*', { count: 'exact', head: true }).eq('is_demo', false)
  const { count: demoProf } = await c.from('profiles').select('*', { count: 'exact', head: true }).eq('is_demo', true)
  const { count: demoJobs } = await c.from('jobs').select('*', { count: 'exact', head: true }).eq('is_demo', true)

  console.log(`Live profiles: ${liveProf} (should be 2 — Emma + Karla)`)
  console.log(`Live orgs: ${liveOrg} (should be 1 — operator)`)
  console.log(`Live jobs: ${liveJobs} (should be 0)`)
  console.log(`Demo profiles: ${demoProf}`)
  console.log(`Demo jobs: ${demoJobs} (should be 85)`)
  console.log('\nDone.')
}

wipe().catch(console.error)
