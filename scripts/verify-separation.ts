import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const c = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

async function verify() {
  console.log('=== Live/Demo Data Verification ===\n')

  const tables = ['organisations', 'profiles', 'subscriptions', 'jobs', 'job_segments', 'scores', 'quotes', 'invoices', 'usage_charges', 'reviewer_payouts', 'commission_agreements', 'commission_payouts', 'recommendations', 'ai_health_snapshots', 'audit_log', 'email_log', 'glossary_entries', 'brand_voice_notes', 'leads', 'lead_notes', 'lead_activities']

  console.log('Table'.padEnd(28), 'Live'.padStart(6), 'Demo'.padStart(6))
  console.log('-'.repeat(42))

  for (const t of tables) {
    try {
      const { count: live } = await c.from(t).select('*', { count: 'exact', head: true }).eq('is_demo', false)
      const { count: demo } = await c.from(t).select('*', { count: 'exact', head: true }).eq('is_demo', true)
      console.log(t.padEnd(28), String(live ?? 0).padStart(6), String(demo ?? 0).padStart(6))
    } catch {
      console.log(t.padEnd(28), '  ERR', '   ERR')
    }
  }

  console.log('\n=== Expected: Live has 2 profiles (admin), 1 org (operator), 0 everything else ===')
  console.log('=== Expected: Demo has 24 profiles, 9 orgs, 85 jobs, etc. ===')
}

verify().catch(console.error)
