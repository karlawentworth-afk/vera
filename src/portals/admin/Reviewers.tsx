import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Plus, Edit3 } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6' }

export function AdminReviewers() {
  const { data: reviewers, isLoading } = useQuery({
    queryKey: ['admin-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'reviewer')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  const { data: activeJobs } = useQuery({
    queryKey: ['admin-active-jobs-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('reviewer_id, word_count, status')
        .not('reviewer_id', 'is', null)
        .in('status', ['in_review', 'awaiting_signoff'])
      if (error) throw error
      return data
    },
  })

  const { data: deliveredJobs } = useQuery({
    queryKey: ['admin-delivered-jobs-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('reviewer_id, word_count')
        .eq('status', 'delivered')
      if (error) throw error
      return data
    },
  })

  const { data: scores } = useQuery({
    queryKey: ['admin-reviewer-scores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('reviewer_id, hter_score')
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />
  }

  // Active job counts per reviewer
  const activeJobCounts: Record<string, number> = {}
  activeJobs?.forEach(j => {
    if (j.reviewer_id) activeJobCounts[j.reviewer_id] = (activeJobCounts[j.reviewer_id] ?? 0) + 1
  })

  // Delivered word counts per reviewer (for earnings estimate)
  const deliveredWords: Record<string, number> = {}
  deliveredJobs?.forEach(j => {
    if (j.reviewer_id) deliveredWords[j.reviewer_id] = (deliveredWords[j.reviewer_id] ?? 0) + j.word_count
  })

  // Active words (for current month owed estimate)
  const activeWords: Record<string, number> = {}
  activeJobs?.forEach(j => {
    if (j.reviewer_id) activeWords[j.reviewer_id] = (activeWords[j.reviewer_id] ?? 0) + j.word_count
  })

  // Avg hTER per reviewer
  const reviewerHter: Record<string, number[]> = {}
  scores?.forEach(s => {
    if (!reviewerHter[s.reviewer_id]) reviewerHter[s.reviewer_id] = []
    reviewerHter[s.reviewer_id].push(Number(s.hter_score))
  })

  const freeCount = reviewers?.filter(r => !activeJobCounts[r.id]).length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{reviewers?.length ?? 0} active freelance reviewers · {freeCount} free</p>
        <button className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add reviewer
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left py-3 px-4 font-medium">Name</th>
                <th className="text-left py-3 px-4 font-medium">Languages</th>
                <th className="text-left py-3 px-4 font-medium">Specialism</th>
                <th className="text-right py-3 px-4 font-medium">Rate / word</th>
                <th className="text-right py-3 px-4 font-medium">Active</th>
                <th className="text-right py-3 px-4 font-medium">Avg. hTER</th>
                <th className="text-right py-3 px-4 font-medium">Owed (est.)</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reviewers?.map(r => {
                const count = activeJobCounts[r.id] ?? 0
                const isFree = count === 0
                const rate = Number(r.rate_per_word ?? 0)
                const totalWords = (deliveredWords[r.id] ?? 0) + (activeWords[r.id] ?? 0)
                const owed = Math.round(totalWords * rate)
                const hterArr = reviewerHter[r.id] ?? []
                const avgHter = hterArr.length > 0
                  ? (hterArr.reduce((a, b) => a + b, 0) / hterArr.length).toFixed(2)
                  : '—'

                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{r.full_name}</td>
                    <td className="py-3 px-4 text-gray-600">{r.languages?.join(', ') ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{r.specialism ?? '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-900">£{rate.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{count}</td>
                    <td className="py-3 px-4 text-right text-gray-600 font-mono">{avgHter}</td>
                    <td className="py-3 px-4 text-right font-medium">£{owed.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded" style={{
                        background: isFree ? COLORS.green + '20' : COLORS.cyan + '20',
                        color: isFree ? COLORS.green : COLORS.cyan,
                      }}>
                        {isFree ? 'Free' : 'Available'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right"><Edit3 className="w-4 h-4 text-gray-400" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
