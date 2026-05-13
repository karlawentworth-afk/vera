import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'

const COLORS = { green: '#0F8F4D' }

export function ReviewerCompleted() {
  const { profile } = useAuth()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['reviewer-completed-jobs', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_number, word_count, delivered_at, content_type, source_language, target_language, organisation:organisations(name)')
        .eq('reviewer_id', profile!.id)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const { data: scores } = useQuery({
    queryKey: ['reviewer-completed-scores', profile?.id],
    queryFn: async () => {
      const ids = jobs?.map(j => j.id) ?? []
      if (ids.length === 0) return []
      const { data, error } = await supabase.from('scores').select('job_id, hter_score').in('job_id', ids)
      if (error) throw error
      return data
    },
    enabled: !!jobs && jobs.length > 0,
  })

  const scoreMap: Record<string, number> = {}
  scores?.forEach(s => { scoreMap[s.job_id] = Number(s.hter_score) })
  const rate = Number(profile?.rate_per_word ?? 0)

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-4 sm:p-6">
          <h3 className="font-medium text-gray-900 mb-4">Completed work</h3>
          {(!jobs || jobs.length === 0) ? (
            <p className="text-sm text-gray-400 py-8 text-center">No completed jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => {
                const org = (job.organisation as unknown as { name: string }) ?? { name: '—' }
                const hter = scoreMap[job.id]
                const paid = Math.round(job.word_count * rate)
                return (
                  <div key={job.id} className="p-3 border border-gray-100 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org?.name}</p>
                        <p className="text-xs text-gray-500">{job.content_type}</p>
                      </div>
                      <span className="text-xs" style={{ color: COLORS.green }}>Paid</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                      <span className="font-mono text-gray-400">{job.job_number}</span>
                      <span>{job.source_language} → {job.target_language}</span>
                      <span>{job.word_count.toLocaleString()} words</span>
                      {hter !== undefined && <span>hTER: <span className="font-mono">{hter.toFixed(3)}</span></span>}
                      <span className="font-medium text-gray-900">£{paid}</span>
                      {job.delivered_at && <span>{new Date(job.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
