import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { MetricCard } from '../../components/shared/MetricCard'
import { RainbowStripe } from '../../components/shared/RainbowStripe'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A', orange: '#EE7C24' }

interface MonthBucket {
  key: string          // "2026-05"
  label: string        // "May 2026"
  words: number
  amountPence: number
  isCurrent: boolean
  payoutDate: string   // "28 May"
}

export function ReviewerEarnings() {
  const { profile } = useAuth()
  const rate = Number(profile?.rate_per_word ?? 0)

  // All delivered jobs for this reviewer
  const { data: deliveredJobs, isLoading } = useQuery({
    queryKey: ['reviewer-delivered-all', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, word_count, delivered_at')
        .eq('reviewer_id', profile!.id)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  // Active jobs (in_review / awaiting_signoff) for current month estimate
  const { data: activeJobs } = useQuery({
    queryKey: ['reviewer-active-earnings', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('word_count')
        .eq('reviewer_id', profile!.id)
        .in('status', ['in_review', 'awaiting_signoff', 'allocated'])
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white border border-gray-200 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  // Group delivered jobs by month
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const monthMap: Record<string, { words: number }> = {}
  deliveredJobs?.forEach(j => {
    if (!j.delivered_at) return
    const d = new Date(j.delivered_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap[key]) monthMap[key] = { words: 0 }
    monthMap[key].words += j.word_count
  })

  // Also add active jobs to current month
  const activeWords = activeJobs?.reduce((sum, j) => sum + j.word_count, 0) ?? 0

  // Ensure current month exists
  if (!monthMap[currentMonthKey]) monthMap[currentMonthKey] = { words: 0 }
  // Current month includes active (in-progress) jobs as estimate
  const currentMonthDeliveredWords = monthMap[currentMonthKey].words
  const currentMonthTotalWords = currentMonthDeliveredWords + activeWords

  // Build sorted month buckets (last 12 months)
  const buckets: MonthBucket[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    const isCurrent = key === currentMonthKey
    const words = isCurrent ? currentMonthTotalWords : (monthMap[key]?.words ?? 0)
    if (words === 0 && !isCurrent) continue
    const payoutDate = `28 ${d.toLocaleDateString('en-GB', { month: 'short' })}`
    buckets.push({
      key,
      label,
      words,
      amountPence: Math.round(words * rate * 100),
      isCurrent,
      payoutDate,
    })
  }

  // Metrics
  const thisMonthEarnings = buckets.find(b => b.isCurrent)?.amountPence ?? 0
  const lastMonthKey = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const lastMonthEarnings = buckets.find(b => b.key === lastMonthKey)?.amountPence ?? 0

  const ytdStart = `${now.getFullYear()}-01`
  const ytdEarnings = buckets
    .filter(b => b.key >= ytdStart)
    .reduce((sum, b) => sum + b.amountPence, 0)

  function toastPlaceholder() {
    alert('PDF statement generation coming soon.')
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="This month"
          value={`£${(thisMonthEarnings / 100).toLocaleString()}`}
          trend={`${(buckets.find(b => b.isCurrent)?.words ?? 0).toLocaleString()} words reviewed`}
          color={COLORS.green}
        />
        <MetricCard
          label="Last month"
          value={`£${(lastMonthEarnings / 100).toLocaleString()}`}
          trend={lastMonthEarnings > 0 && thisMonthEarnings > 0
            ? `${thisMonthEarnings >= lastMonthEarnings ? '↑' : '↓'} ${Math.abs(Math.round((thisMonthEarnings / lastMonthEarnings - 1) * 100))}% vs prior`
            : undefined}
          color={COLORS.cyan}
        />
        <MetricCard
          label="YTD earnings"
          value={`£${(ytdEarnings / 100).toLocaleString()}`}
          color={COLORS.purple}
        />
        <MetricCard
          label="Avg. £/word"
          value={`£${rate.toFixed(3)}`}
          trend="Specialism rate"
          color={COLORS.pink}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h3 className="font-medium text-gray-900 mb-1">Monthly statements</h3>
          <p className="text-sm text-gray-500 mb-4">Auto-generated. Paid by Vera every 28th.</p>

          {buckets.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No earnings data yet.</p>
          ) : (
            <div className="space-y-2">
              {buckets.map(b => (
                <div key={b.key} className="grid grid-cols-5 gap-4 p-3 border border-gray-100 rounded items-center text-sm">
                  <span className="font-medium text-gray-900">{b.label}</span>
                  <span className="text-gray-600">{b.words.toLocaleString()} words</span>
                  <span className="text-gray-900 font-medium">£{(b.amountPence / 100).toLocaleString()}</span>
                  <span className="text-xs" style={{ color: b.isCurrent ? COLORS.orange : COLORS.green }}>
                    {b.isCurrent ? 'Pending' : 'Paid'} · {b.payoutDate}
                  </span>
                  <button
                    onClick={toastPlaceholder}
                    className="text-xs text-gray-500 hover:text-gray-900 text-right"
                  >
                    Download statement
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
