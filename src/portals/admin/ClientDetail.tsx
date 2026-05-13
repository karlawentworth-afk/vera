import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MetricCard } from '../../components/shared/MetricCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { ArrowLeft, Users, FileText, Receipt, BookOpen, TrendingUp } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A', orange: '#EE7C24' }
const TIER_COLORS: Record<string, string> = { Essentials: COLORS.cyan, Governance: COLORS.purple, Embedded: COLORS.pink }

export function AdminClientDetail() {
  const { id: orgId } = useParams<{ id: string }>()

  const { data: org } = useQuery({
    queryKey: ['admin-client-detail-org', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('*').eq('id', orgId!).single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: subscription } = useQuery({
    queryKey: ['admin-client-detail-sub', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('organisation_id', orgId!).eq('status', 'active').maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: users } = useQuery({
    queryKey: ['admin-client-detail-users', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('organisation_id', orgId!).order('full_name')
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: jobs } = useQuery({
    queryKey: ['admin-client-detail-jobs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*, reviewer:profiles!jobs_reviewer_id_fkey(full_name)').eq('organisation_id', orgId!).order('submitted_at', { ascending: false }).limit(20)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: allJobs } = useQuery({
    queryKey: ['admin-client-detail-all-jobs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('id, word_count, status').eq('organisation_id', orgId!)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: scores } = useQuery({
    queryKey: ['admin-client-detail-scores', orgId],
    queryFn: async () => {
      const ids = allJobs?.map(j => j.id) ?? []
      if (ids.length === 0) return []
      const { data, error } = await supabase.from('scores').select('job_id, hter_score').in('job_id', ids)
      if (error) throw error
      return data
    },
    enabled: !!allJobs && allJobs.length > 0,
  })

  const { data: snapshots } = useQuery({
    queryKey: ['admin-client-detail-snapshots', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_health_snapshots').select('*').eq('organisation_id', orgId!).order('snapshot_date', { ascending: false }).limit(6)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: glossaryCount } = useQuery({
    queryKey: ['admin-client-detail-glossary', orgId],
    queryFn: async () => {
      const { count, error } = await supabase.from('glossary_entries').select('*', { count: 'exact', head: true }).eq('organisation_id', orgId!)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!orgId,
  })

  const { data: salesperson } = useQuery({
    queryKey: ['admin-client-detail-salesperson', orgId],
    queryFn: async () => {
      if (!org?.introducing_salesperson_id) return null
      const { data, error } = await supabase.from('profiles').select('full_name, default_recurring_pct').eq('id', org.introducing_salesperson_id).single()
      if (error) return null
      return data
    },
    enabled: !!org,
  })

  if (!org) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const totalWords = allJobs?.reduce((s, j) => s + j.word_count, 0) ?? 0
  const deliveredCount = allJobs?.filter(j => j.status === 'delivered').length ?? 0
  const hterValues = scores?.map(s => Number(s.hter_score)) ?? []
  const avgHter = hterValues.length > 0 ? hterValues.reduce((a, b) => a + b, 0) / hterValues.length : null
  const healthScore = avgHter !== null ? Math.round((1 - avgHter) * 100) : null
  const tierColor = TIER_COLORS[subscription?.tier_name ?? ''] ?? COLORS.cyan
  const lifetimeValue = subscription ? subscription.monthly_price_pence * 12 : 0

  return (
    <div className="space-y-6">
      <Link to="/admin/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to clients
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-1" style={{ background: tierColor }} />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-light text-gray-900">{org.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{subscription?.tier_name ?? 'No subscription'} · {subscription ? `£${(subscription.monthly_price_pence / 100).toLocaleString()}/mo` : ''}</p>
              {salesperson && <p className="text-xs text-gray-400 mt-1">Introduced by {salesperson.full_name} ({salesperson.default_recurring_pct}% commission)</p>}
            </div>
            {healthScore !== null && (
              <div className="text-right">
                <p className="text-3xl font-light text-gray-900">{healthScore}</p>
                <p className="text-xs text-gray-500">AI Health</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total jobs" value={String(allJobs?.length ?? 0)} trend={`${deliveredCount} delivered`} color={COLORS.cyan} />
        <MetricCard label="Words processed" value={totalWords.toLocaleString()} color={COLORS.green} />
        <MetricCard label="Avg hTER" value={avgHter !== null ? avgHter.toFixed(3) : '—'} trend="Industry: 0.31" color={COLORS.purple} />
        <MetricCard label="Lifetime value" value={`£${(lifetimeValue / 100).toLocaleString()}`} trend="Annualised" color={COLORS.pink} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Health trend */}
          {snapshots && snapshots.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <RainbowStripe height={3} />
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <h3 className="font-medium text-gray-900">AI Health trend</h3>
                </div>
                <div className="flex items-end gap-2 h-24">
                  {[...snapshots].reverse().map((s, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{s.overall_score}</span>
                      <div className="w-full rounded-t" style={{ height: `${s.overall_score}%`, background: i === snapshots.length - 1 ? COLORS.green : '#e5e7eb' }} />
                      <span className="text-[10px] text-gray-400">{new Date(s.snapshot_date).toLocaleDateString('en-GB', { month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent jobs */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="font-medium text-gray-900">Recent jobs</h3>
              </div>
              <div className="space-y-2">
                {jobs?.map(j => (
                  <div key={j.id} className="flex items-center justify-between p-2 border border-gray-100 rounded text-sm">
                    <div>
                      <span className="font-mono text-xs text-gray-400 mr-2">{j.job_number}</span>
                      <span className="text-gray-900">{j.content_type}</span>
                      <span className="text-gray-500 ml-2">{j.source_language} → {j.target_language}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {j.ai_tool_used && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{j.ai_tool_used}</span>}
                      <StatusBadge status={j.status} />
                    </div>
                  </div>
                ))}
                {(!jobs || jobs.length === 0) && <p className="text-sm text-gray-400 py-4 text-center">No jobs yet</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Users */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Users ({users?.length ?? 0})</p>
            </div>
            <div className="space-y-2">
              {users?.map(u => (
                <div key={u.id} className="text-sm">
                  <p className="text-gray-900">{u.full_name}</p>
                  <p className="text-xs text-gray-500">{u.job_title || u.email}</p>
                  <p className="text-[10px] text-gray-400">{u.onboarding_completed_at ? 'Active' : u.invited_at ? `Invited ${new Date(u.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Pending'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Glossary */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-gray-400" />
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Glossary</p>
            </div>
            <p className="text-sm text-gray-700">{glossaryCount} terms defined</p>
          </div>

          {/* Subscription */}
          {subscription && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-gray-400" />
                <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Subscription</p>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Tier</span><span>{subscription.tier_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Monthly</span><span>£{(subscription.monthly_price_pence / 100).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Allowance</span><span>{subscription.word_allowance?.toLocaleString() ?? '∞'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span style={{ color: COLORS.green }}>{subscription.status}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
