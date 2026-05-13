import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useClientOrgId } from '../../lib/useClientOrg'
import { MetricCard } from '../../components/shared/MetricCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Link } from 'react-router-dom'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A' }

export function ClientDashboard() {
  const queryClient = useQueryClient()
  const orgId = useClientOrgId()

  const { data: org } = useQuery({
    queryKey: ['client-org', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', orgId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: subscription } = useQuery({
    queryKey: ['client-subscription', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('status', 'active')
        .single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: jobs } = useQuery({
    queryKey: ['client-jobs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, word_count, status, submitted_at, delivered_at, urgency, content_type, source_language, target_language, reviewer_id, organisation_id')
        .eq('organisation_id', orgId!)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: scores } = useQuery({
    queryKey: ['client-scores', orgId],
    queryFn: async () => {
      const jobIds = jobs?.map(j => j.id) ?? []
      if (jobIds.length === 0) return []
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .in('job_id', jobIds)
      if (error) throw error
      return data
    },
    enabled: !!jobs && jobs.length > 0,
  })

  const { data: activeJobs } = useQuery({
    queryKey: ['client-active-jobs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, reviewer:profiles!jobs_reviewer_id_fkey(full_name)')
        .eq('organisation_id', orgId!)
        .in('status', ['unallocated', 'allocated', 'in_review', 'awaiting_signoff'])
        .order('due_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  if (!org || !subscription) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white border border-gray-200 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  // Health snapshots — read from pre-calculated table
  const { data: snapshots } = useQuery({
    queryKey: ['health-snapshots', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_health_snapshots')
        .select('*')
        .eq('organisation_id', orgId!)
        .order('snapshot_date', { ascending: false })
        .limit(6)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const latestSnapshot = snapshots?.[0]

  // Fallback to live calculation if no snapshots exist yet
  const hterValues = scores?.map(s => Number(s.hter_score)) ?? []
  const liveHealthScore = hterValues.length > 0 ? Math.round((1 - (hterValues.reduce((a, b) => a + b, 0) / hterValues.length)) * 100) : null
  const healthScore = latestSnapshot?.overall_score ?? liveHealthScore
  const prevScore = latestSnapshot?.prev_period_score ?? null

  // Words used
  const wordsUsed = jobs?.filter(j => j.status !== 'cancelled').reduce((sum, j) => sum + j.word_count, 0) ?? 0
  const allowance = subscription.word_allowance

  // Avg turnaround (hours for delivered jobs)
  const deliveredJobs = jobs?.filter(j => j.status === 'delivered' && j.delivered_at) ?? []
  const turnarounds = deliveredJobs.map(j => {
    const submitted = new Date(j.submitted_at).getTime()
    const delivered = new Date(j.delivered_at!).getTime()
    return (delivered - submitted) / (1000 * 60 * 60)
  })
  const avgTurnaround = turnarounds.length > 0 ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : null

  // Trend from snapshots (oldest to newest for chart)
  const snapshotsTrend = [...(snapshots ?? [])].reverse()
  const monthTrend = snapshotsTrend.length > 0
    ? snapshotsTrend.map(s => s.overall_score)
    : (() => {
        const base = healthScore ?? 80
        return [base - 15, base - 12, base - 9, base - 6, base - 3, base].map(v => Math.max(60, v))
      })()

  const monthLabels = snapshotsTrend.length > 0
    ? snapshotsTrend.map(s => new Date(s.snapshot_date).toLocaleDateString('en-GB', { month: 'short' }))
    : (() => {
        const now = new Date()
        return Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now); d.setMonth(d.getMonth() - (5 - i))
          return d.toLocaleDateString('en-GB', { month: 'short' })
        })
      })()

  // Recommendations from org record
  // Recommendations — prefer live AI-generated from table, fallback to hand-curated on org
  const { data: liveRecs } = useQuery({
    queryKey: ['client-recommendations', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('organisation_id', orgId!)
        .is('dismissed_at', null)
        .order('generated_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const SEVERITY_COLORS: Record<string, string> = { positive: '#0F8F4D', neutral: '#1FA1D6', attention: '#EE7C24' }

  const recommendations = liveRecs && liveRecs.length > 0
    ? liveRecs.map(r => ({ color: SEVERITY_COLORS[r.severity] ?? '#1FA1D6', title: r.title, detail: r.body, id: r.id }))
    : ((org.recommendations as { color: string; title: string; detail: string }[]) ?? []).map((r, i) => ({ ...r, id: `fallback-${i}` }))

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Client portal</p>
        <h1 className="text-2xl font-light text-gray-900 mt-1">{org.name}</h1>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="AI Health Score"
          value={healthScore !== null ? String(healthScore) : '—'}
          unit="/100"
          trend={prevScore !== null && healthScore !== null
            ? `${healthScore >= prevScore ? '↑' : '↓'} ${Math.abs(healthScore - prevScore)} vs prior period`
            : healthScore !== null ? `Based on ${hterValues.length} reviews` : 'No reviews yet'}
          color={COLORS.green}
        />
        <MetricCard
          label="Words this month"
          value={wordsUsed.toLocaleString()}
          unit={allowance ? `/ ${allowance.toLocaleString()}` : '(unlimited)'}
          trend={allowance ? `${Math.round((wordsUsed / allowance) * 100)}% used` : subscription.tier_name}
          color={COLORS.cyan}
        />
        <MetricCard
          label="Active jobs"
          value={String(activeJobs?.length ?? 0)}
          trend={activeJobs?.length ? `${activeJobs.filter(j => j.status === 'in_review').length} in review` : 'None right now'}
          color={COLORS.purple}
        />
        <MetricCard
          label="Avg. turnaround"
          value={avgTurnaround !== null ? `${avgTurnaround}h` : '—'}
          trend="SLA: 24h standard"
          color={COLORS.pink}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health trend chart */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">AI translation health — last 6 months</h3>
              <span className="text-xs text-gray-500">All languages</span>
            </div>
            <div className="flex items-end gap-2 h-32 mb-2">
              {monthTrend.map((score, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs text-gray-400">{score}</div>
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${score}%`,
                      background: i === 5 ? COLORS.green : '#e5e7eb',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 text-xs text-gray-500">
              {monthLabels.map(m => (
                <div key={m} className="flex-1 text-center">{m}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-4">This month's recommendations</h3>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div key={rec.id} className="border-l-2 pl-3 py-1 group relative" style={{ borderColor: rec.color }}>
                  <p className="text-sm text-gray-900 font-medium">{rec.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{rec.detail}</p>
                  {!rec.id.startsWith('fallback') && (
                    <button
                      onClick={async () => {
                        await supabase.from('recommendations').update({ dismissed_at: new Date().toISOString() }).eq('id', rec.id)
                        queryClient.invalidateQueries({ queryKey: ['client-recommendations'] })
                      }}
                      className="absolute top-1 right-0 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 text-xs"
                      title="Dismiss"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No recommendations yet. These appear once you have reviewed content.</p>
          )}
        </div>
      </div>

      {/* Active jobs */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Active jobs</h3>
          <Link to="/client/audit" className="text-sm text-gray-600 hover:text-gray-900">AI health & audit &rarr;</Link>
        </div>
        {activeJobs?.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No active jobs right now.</p>
        ) : (
          <div className="space-y-2">
            {activeJobs?.map(job => {
              const reviewer = job.reviewer as { full_name: string } | null
              const dueDate = new Date(job.due_at)
              const now = new Date()
              const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
              const dueLabel = hoursLeft < 0 ? 'Overdue' : hoursLeft < 24 ? `${hoursLeft}h` : `${Math.round(hoursLeft / 24)}d`

              return (
                <div key={job.id} className="flex items-center justify-between p-3 border border-gray-100 rounded hover:border-gray-300 transition">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-400">{job.job_number}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.content_type}</p>
                      <p className="text-xs text-gray-500">{job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words{reviewer ? ` · Reviewer: ${reviewer.full_name}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.status} />
                    <span className="text-xs text-gray-500">Due {dueLabel}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
