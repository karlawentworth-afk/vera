import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MetricCard } from '../../components/shared/MetricCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { AlertCircle, Clock, CheckCircle, Bell, Plus, Send, CreditCard, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { JobStatus } from '../../types/database'

const COLORS = {
  pink: '#E5187A', purple: '#8E2882', cyan: '#1FA1D6',
  green: '#0F8F4D', orange: '#EE7C24', red: '#D9211E',
}

export function AdminDashboard() {
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, organisation:organisations(name), reviewer:profiles!jobs_reviewer_id_fkey(full_name)')
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: subscriptions } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, organisation:organisations(name)')
        .eq('status', 'active')
      if (error) throw error
      return data
    },
  })

  const { data: reviewers } = useQuery({
    queryKey: ['admin-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'reviewer')
      if (error) throw error
      return data
    },
  })

  if (jobsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 h-24 animate-pulse" />)}
        </div>
      </div>
    )
  }

  const activeJobs = jobs?.filter(j => j.status !== 'delivered' && j.status !== 'cancelled') ?? []
  const unallocated = jobs?.filter(j => j.status === 'unallocated') ?? []
  const expedited = activeJobs.filter(j => j.urgency === 'expedited')
  const awaitingSignoff = jobs?.filter(j => j.status === 'awaiting_signoff') ?? []
  const mrr = subscriptions?.reduce((sum, s) => sum + s.monthly_price_pence, 0) ?? 0

  // Clients near allowance
  const nearAllowance = subscriptions?.filter(s => {
    if (!s.word_allowance) return false
    const orgJobs = jobs?.filter(j => j.organisation_id === s.organisation_id) ?? []
    const wordsUsed = orgJobs
      .filter(j => j.status !== 'cancelled')
      .reduce((sum, j) => sum + j.word_count, 0)
    return wordsUsed / s.word_allowance > 0.85
  }) ?? []

  // Reviewer active job counts
  const reviewerJobCounts: Record<string, number> = {}
  activeJobs.forEach(j => {
    if (j.reviewer_id) reviewerJobCounts[j.reviewer_id] = (reviewerJobCounts[j.reviewer_id] ?? 0) + 1
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="MRR" value={`£${(mrr / 100).toLocaleString()}`} trend={`${subscriptions?.length ?? 0} active subscriptions`} color={COLORS.green} href="/admin/invoices" />
        <MetricCard label="Active clients" value={String(subscriptions?.length ?? 0)} trend={`${nearAllowance.length} near allowance`} color={COLORS.cyan} href="/admin/clients" />
        <MetricCard label="Jobs in flight" value={String(activeJobs.length)} trend={`${expedited.length} expedited, ${unallocated.length} unallocated`} color={COLORS.purple} href="/admin/jobs" />
        <MetricCard label="Reviewers" value={String(reviewers?.length ?? 0)} trend={`${reviewers?.filter(r => !reviewerJobCounts[r.id]).length ?? 0} free`} color={COLORS.pink} href="/admin/reviewers" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Priorities */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Today's priorities</h3>
              <Link to="/admin/jobs" className="text-sm text-gray-600 hover:text-gray-900">All jobs &rarr;</Link>
            </div>

            <div className="space-y-3">
              {unallocated.map(job => (
                <div key={job.id} className="flex items-start gap-3 p-3 rounded border" style={{ borderColor: COLORS.red + '40', background: COLORS.red + '08' }}>
                  <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: COLORS.red }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Unallocated job — {(job.organisation as { name: string })?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{job.job_number} · {job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words</p>
                  </div>
                  <StatusBadge status={job.status as JobStatus} />
                </div>
              ))}

              {expedited.filter(j => j.status !== 'unallocated').map(job => (
                <div key={job.id} className="flex items-start gap-3 p-3 rounded border" style={{ borderColor: COLORS.orange + '40', background: COLORS.orange + '08' }}>
                  <Clock className="w-5 h-5 mt-0.5" style={{ color: COLORS.orange }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Expedited — {(job.organisation as { name: string })?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{job.job_number} · {job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words · {(job.reviewer as { full_name: string })?.full_name}</p>
                  </div>
                  <StatusBadge status={job.status as JobStatus} />
                </div>
              ))}

              {awaitingSignoff.map(job => (
                <div key={job.id} className="flex items-start gap-3 p-3 rounded border" style={{ borderColor: COLORS.cyan + '40', background: COLORS.cyan + '08' }}>
                  <CheckCircle className="w-5 h-5 mt-0.5" style={{ color: COLORS.cyan }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Awaiting your sign-off — {(job.organisation as { name: string })?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{job.job_number} · {job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words · {(job.reviewer as { full_name: string })?.full_name}</p>
                  </div>
                  <StatusBadge status={job.status as JobStatus} />
                </div>
              ))}

              {nearAllowance.map(sub => (
                <div key={sub.id} className="flex items-start gap-3 p-3 rounded border" style={{ borderColor: COLORS.purple + '40', background: COLORS.purple + '08' }}>
                  <Bell className="w-5 h-5 mt-0.5" style={{ color: COLORS.purple }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{(sub.organisation as { name: string })?.name} nearing allowance</p>
                    <p className="text-xs text-gray-500 mt-1">{sub.tier_name} tier · {sub.word_allowance?.toLocaleString()} word allowance</p>
                  </div>
                </div>
              ))}

              {unallocated.length === 0 && expedited.length === 0 && awaitingSignoff.length === 0 && nearAllowance.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">All clear — no urgent items right now.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">This month</p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Revenue (MRR)</span>
                <span className="font-medium">£{(mrr / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Active jobs</span>
                <span className="font-medium">{activeJobs.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Delivered this month</span>
                <span className="font-medium">{jobs?.filter(j => j.status === 'delivered').length ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Reviewer capacity</p>
            <div className="space-y-2">
              {reviewers?.map(r => {
                const count = reviewerJobCounts[r.id] ?? 0
                const isFree = count === 0
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">{r.full_name}</span>
                    <span className="px-2 py-0.5 rounded" style={{
                      background: isFree ? COLORS.green + '20' : COLORS.cyan + '20',
                      color: isFree ? COLORS.green : COLORS.cyan,
                    }}>
                      {isFree ? 'Free' : `${count} active`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Quick actions</p>
            <div className="space-y-2">
              <Link to="/admin/quotes" className="w-full text-left text-sm py-2 px-3 rounded hover:bg-gray-50 flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> New quote
              </Link>
              <Link to="/admin/invoices" className="w-full text-left text-sm py-2 px-3 rounded hover:bg-gray-50 flex items-center gap-2">
                <Send className="w-3.5 h-3.5" /> Run monthly invoices
              </Link>
              <Link to="/admin/invoices" className="w-full text-left text-sm py-2 px-3 rounded hover:bg-gray-50 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" /> Process reviewer payouts
              </Link>
              <Link to="/admin/settings" className="w-full text-left text-sm py-2 px-3 rounded hover:bg-gray-50 flex items-center gap-2">
                <Download className="w-3.5 h-3.5" /> Export to Xero
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
