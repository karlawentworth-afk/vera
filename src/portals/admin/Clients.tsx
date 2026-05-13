import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Eye, MessageSquare, FileText } from 'lucide-react'

const TIER_COLORS: Record<string, string> = {
  Essentials: '#1FA1D6',
  Governance: '#8E2882',
  Embedded: '#E5187A',
}

export function AdminClients() {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions-detail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, organisation:organisations(id, name)')
        .eq('status', 'active')
      if (error) throw error
      return data
    },
  })

  const { data: jobs } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('organisation_id, word_count, status')
      if (error) throw error
      return data
    },
  })

  const { data: scores } = useQuery({
    queryKey: ['admin-scores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('job_id, hter_score')
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1,2,3].map(i => <div key={i} className="bg-white border border-gray-200 rounded-lg h-48 animate-pulse" />)}
      </div>
    )
  }

  // Build word usage per org
  const orgWordUsage: Record<string, number> = {}
  jobs?.forEach(j => {
    if (j.status !== 'cancelled') {
      orgWordUsage[j.organisation_id] = (orgWordUsage[j.organisation_id] ?? 0) + j.word_count
    }
  })

  // Get all jobs with org, match to scores
  const { data: allJobs } = useQuery({
    queryKey: ['admin-jobs-for-health'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('id, organisation_id')
      if (error) throw error
      return data
    },
  })

  const jobToOrg: Record<string, string> = {}
  allJobs?.forEach(j => { jobToOrg[j.id] = j.organisation_id })

  const orgScores: Record<string, number[]> = {}
  scores?.forEach(s => {
    const orgId = jobToOrg[s.job_id]
    if (orgId) {
      if (!orgScores[orgId]) orgScores[orgId] = []
      orgScores[orgId].push(Number(s.hter_score))
    }
  })

  const mrr = subscriptions?.reduce((sum, s) => sum + s.monthly_price_pence, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{subscriptions?.length ?? 0} active clients · MRR £{(mrr / 100).toLocaleString()}</p>
        <button className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add client
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {subscriptions?.map(sub => {
          const org = sub.organisation as { id: string; name: string }
          const color = TIER_COLORS[sub.tier_name] ?? '#1FA1D6'
          const wordsUsed = orgWordUsage[org.id] ?? 0
          const usagePct = sub.word_allowance ? (wordsUsed / sub.word_allowance) * 100 : 60

          // Health score: convert avg hTER to 0-100 (lower hTER = higher health)
          const hterScores = orgScores[org.id] ?? []
          const avgHter = hterScores.length > 0
            ? hterScores.reduce((a, b) => a + b, 0) / hterScores.length
            : 0
          const healthScore = hterScores.length > 0
            ? Math.round((1 - avgHter) * 100)
            : null

          return (
            <div key={sub.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="h-1" style={{ background: color }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-base font-medium text-gray-900">{org.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{sub.tier_name} · £{(sub.monthly_price_pence / 100).toLocaleString()}/mo</p>
                  </div>
                  {healthScore !== null && (
                    <div className="text-right">
                      <p className="text-2xl font-light text-gray-900">{healthScore}</p>
                      <p className="text-xs text-gray-500">AI Health</p>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{wordsUsed.toLocaleString()} / {sub.word_allowance?.toLocaleString() ?? '∞'} words</span>
                    <span>{Math.round(usagePct)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(usagePct, 100)}%`,
                        background: usagePct > 90 ? '#EE7C24' : color,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                  <button className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"><Eye className="w-3 h-3" /> View</button>
                  <button className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Contact</button>
                  <button className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"><FileText className="w-3 h-3" /> Invoices</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
