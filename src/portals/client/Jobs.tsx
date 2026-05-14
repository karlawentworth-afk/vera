import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { useClientOrgId } from '../../lib/useClientOrg'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Link } from 'react-router-dom'

export function ClientJobs() {
  const orgId = useClientOrgId()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: org } = useQuery({
    queryKey: ['client-org-name', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('name').eq('id', orgId!).eq('is_demo', getIsDemo()).single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['client-all-jobs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, reviewer:profiles!jobs_reviewer_id_fkey(full_name)')
        .eq('organisation_id', orgId!)
        .eq('is_demo', getIsDemo())
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: scores } = useQuery({
    queryKey: ['client-job-scores', orgId],
    queryFn: async () => {
      const ids = jobs?.map(j => j.id) ?? []
      if (ids.length === 0) return []
      const { data, error } = await supabase.from('scores').select('job_id, hter_score').in('job_id', ids).eq('is_demo', getIsDemo())
      if (error) throw error
      return data
    },
    enabled: !!jobs && jobs.length > 0,
  })

  const scoreMap: Record<string, number> = {}
  scores?.forEach(s => { scoreMap[s.job_id] = Number(s.hter_score) })

  const filtered = jobs?.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return j.job_number.toLowerCase().includes(q) || j.content_type.toLowerCase().includes(q)
    }
    return true
  }) ?? []

  const statuses = ['', 'unallocated', 'in_review', 'awaiting_signoff', 'delivered']

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">My jobs</p>
        <h1 className="text-xl sm:text-2xl font-light text-gray-900 mt-1">{org?.name}</h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded px-3 py-1.5">
          <option value="">All statuses</option>
          {statuses.filter(Boolean).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="text-sm border border-gray-200 rounded px-3 py-1.5 flex-1 min-w-[150px] focus:outline-none focus:border-gray-400" />
        <Link to="/client/submit" className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800">Submit work</Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-4 sm:p-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No jobs found</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(job => {
                const reviewer = job.reviewer as { full_name: string } | null
                const hter = scoreMap[job.id]
                const dueDate = new Date(job.due_at)
                const now = new Date()
                const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
                const dueLabel = job.status === 'delivered' ? 'Done' : hoursLeft < 0 ? 'Overdue' : hoursLeft < 24 ? `${hoursLeft}h` : `${Math.round(hoursLeft / 24)}d`

                return (
                  <Link key={job.id} to={`/client/jobs/${job.id}`} className="block p-3 border border-gray-100 rounded hover:border-gray-300 transition">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{job.content_type}</p>
                        <p className="text-xs text-gray-500">{job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words{reviewer ? ` · ${reviewer.full_name}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.ai_tool_used && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{job.ai_tool_used}</span>}
                        <StatusBadge status={job.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="font-mono text-gray-400">{job.job_number}</span>
                      <span>Due {dueLabel}</span>
                      {hter !== undefined && <span className="font-mono">hTER {hter.toFixed(3)}</span>}
                      <span>{new Date(job.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
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
