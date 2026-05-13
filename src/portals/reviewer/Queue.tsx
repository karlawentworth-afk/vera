import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { MetricCard } from '../../components/shared/MetricCard'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { ChevronRight } from 'lucide-react'

const COLORS = { cyan: '#1FA1D6', green: '#0F8F4D', purple: '#8E2882', pink: '#E5187A' }

export function ReviewerQueue() {
  const { profile } = useAuth()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['reviewer-jobs', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, organisation:organisations(name)')
        .eq('reviewer_id', profile!.id)
        .in('status', ['allocated', 'in_review', 'awaiting_signoff'])
        .order('due_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const { data: completedJobs } = useQuery({
    queryKey: ['reviewer-completed', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('word_count')
        .eq('reviewer_id', profile!.id)
        .eq('status', 'delivered')
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-white border border-gray-200 rounded-lg animate-pulse" />)}</div></div>
  }

  const activeCount = jobs?.length ?? 0
  const totalActiveWords = jobs?.reduce((sum, j) => sum + j.word_count, 0) ?? 0
  const completedWords = completedJobs?.reduce((sum, j) => sum + j.word_count, 0) ?? 0
  const rate = Number(profile?.rate_per_word ?? 0)
  const estimatedEarnings = Math.round((totalActiveWords + completedWords) * rate)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Active jobs" value={String(activeCount)} trend={`${totalActiveWords.toLocaleString()} words`} color={COLORS.cyan} />
        <MetricCard label="Words this month" value={(totalActiveWords + completedWords).toLocaleString()} trend={`£${estimatedEarnings.toLocaleString()} est.`} color={COLORS.green} />
        <MetricCard label="Rate" value={`£${rate.toFixed(3)}`} unit="/word" color={COLORS.purple} />
        <MetricCard label="Completed" value={String(completedJobs?.length ?? 0)} trend={`${completedWords.toLocaleString()} words`} color={COLORS.pink} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h3 className="font-medium text-gray-900 mb-4">Your queue</h3>
          {jobs?.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No jobs in your queue right now.</p>
          ) : (
            <div className="space-y-2">
              {jobs?.map(job => {
                const org = job.organisation as { name: string }
                const dueDate = new Date(job.due_at)
                const now = new Date()
                const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
                const dueLabel = hoursLeft < 0 ? 'Overdue' : hoursLeft < 24 ? `${hoursLeft}h` : `${Math.round(hoursLeft / 24)}d`

                return (
                  <Link
                    key={job.id}
                    to={`/reviewer/review/${job.id}`}
                    className="block p-3 border border-gray-100 rounded hover:border-gray-300 transition"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org?.name}</p>
                        <p className="text-xs text-gray-500">{job.content_type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={job.status} />
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                      <span className="font-mono text-gray-400">{job.job_number}</span>
                      <span>{job.source_language} → {job.target_language}</span>
                      <span>{job.word_count.toLocaleString()}w</span>
                      {job.urgency === 'expedited' && <span className="px-1.5 py-0.5 rounded" style={{ background: '#EE7C2420', color: '#EE7C24' }}>Express</span>}
                      <span>Due {dueLabel}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
