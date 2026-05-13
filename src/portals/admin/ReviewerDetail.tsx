import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MetricCard } from '../../components/shared/MetricCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { ArrowLeft, TrendingUp } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A', orange: '#EE7C24' }

export function AdminReviewerDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: reviewer } = useQuery({
    queryKey: ['admin-reviewer-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: jobs } = useQuery({
    queryKey: ['admin-reviewer-jobs', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*, organisation:organisations(name)').eq('reviewer_id', id!).order('submitted_at', { ascending: false }).limit(30)
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: allJobs } = useQuery({
    queryKey: ['admin-reviewer-all-jobs', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('id, word_count, status').eq('reviewer_id', id!)
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: scores } = useQuery({
    queryKey: ['admin-reviewer-scores', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('scores').select('hter_score, created_at').eq('reviewer_id', id!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: payouts } = useQuery({
    queryKey: ['admin-reviewer-payouts', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('reviewer_payouts').select('*').eq('reviewer_id', id!).order('period_start', { ascending: false }).limit(12)
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  if (!reviewer) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const rate = Number(reviewer.rate_per_word ?? 0)
  const deliveredCount = allJobs?.filter(j => j.status === 'delivered').length ?? 0
  const totalWords = allJobs?.filter(j => j.status === 'delivered').reduce((s, j) => s + j.word_count, 0) ?? 0
  const totalEarned = Math.round(totalWords * rate)
  const hterValues = scores?.map(s => Number(s.hter_score)) ?? []
  const avgHter = hterValues.length > 0 ? hterValues.reduce((a, b) => a + b, 0) / hterValues.length : null
  const returnedJobs = jobs?.filter(j => j.iteration_count && j.iteration_count > 1).length ?? 0

  return (
    <div className="space-y-6">
      <Link to="/admin/reviewers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to reviewers
      </Link>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h1 className="text-xl font-light text-gray-900">{reviewer.full_name}</h1>
          <p className="text-sm text-gray-500 mt-1">{reviewer.languages?.join(', ')} · {reviewer.specialism}</p>
          <p className="text-sm text-gray-500">£{rate.toFixed(3)}/word · {reviewer.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            {reviewer.stripe_onboarding_completed_at ? 'Stripe connected' : 'Stripe not connected'}
            {reviewer.invited_at && ` · Joined ${new Date(reviewer.invited_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Jobs completed" value={String(deliveredCount)} color={COLORS.cyan} />
        <MetricCard label="Words reviewed" value={totalWords.toLocaleString()} color={COLORS.green} />
        <MetricCard label="Total earned" value={`£${totalEarned.toLocaleString()}`} color={COLORS.purple} />
        <MetricCard label="Avg hTER" value={avgHter !== null ? avgHter.toFixed(3) : '—'} trend={returnedJobs > 0 ? `${returnedJobs} returned` : 'No returns'} color={returnedJobs > 0 ? COLORS.orange : COLORS.green} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* hTER trend */}
          {hterValues.length > 3 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <RainbowStripe height={3} />
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <h3 className="font-medium text-gray-900">Quality trend (last {Math.min(hterValues.length, 20)} reviews)</h3>
                </div>
                <div className="flex items-end gap-1 h-20">
                  {hterValues.slice(0, 20).reverse().map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{
                      height: `${Math.max(10, (1 - h) * 100)}%`,
                      background: h < 0.15 ? COLORS.green : h < 0.25 ? COLORS.cyan : COLORS.orange,
                    }} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Each bar = one reviewed job. Taller = better quality (lower hTER).</p>
              </div>
            </div>
          )}

          {/* Recent jobs */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-4">Recent jobs</h3>
              <div className="space-y-2">
                {jobs?.slice(0, 15).map(j => (
                  <div key={j.id} className="flex items-center justify-between p-2 border border-gray-100 rounded text-sm">
                    <div>
                      <span className="font-mono text-xs text-gray-400 mr-2">{j.job_number}</span>
                      <span className="text-gray-900">{(j.organisation as { name: string })?.name}</span>
                      <span className="text-gray-500 ml-2">{j.source_language} → {j.target_language}</span>
                      {j.iteration_count > 1 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">Returned</span>}
                    </div>
                    <StatusBadge status={j.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Payout history</p>
            {(!payouts || payouts.length === 0) ? (
              <p className="text-sm text-gray-400">No payouts yet</p>
            ) : (
              <div className="space-y-2">
                {payouts.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{new Date(p.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                    <span className="font-medium">£{(p.amount_pence / 100).toLocaleString()}</span>
                    <span className={`px-1.5 py-0.5 rounded ${p.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Quality flags</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Returned jobs</span><span className={returnedJobs > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>{returnedJobs}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Active jobs</span><span>{allJobs?.filter(j => j.status === 'in_review' || j.status === 'awaiting_signoff').length ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total reviews</span><span>{scores?.length ?? 0}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
