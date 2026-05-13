import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Drawer } from '../../components/shared/Drawer'
import { JobDetail } from './JobDetail'
import { Eye, Plus } from 'lucide-react'
import type { JobStatus } from '../../types/database'

const STATUS_TABS: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All jobs', value: 'all' },
  { label: 'Unallocated', value: 'unallocated' },
  { label: 'In review', value: 'in_review' },
  { label: 'Awaiting signoff', value: 'awaiting_signoff' },
  { label: 'Delivered', value: 'delivered' },
]

const COLORS = { red: '#D9211E' }

export function AdminJobs() {
  const [activeTab, setActiveTab] = useState<JobStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, organisation:organisations(name), reviewer:profiles!jobs_reviewer_id_fkey(full_name, rate_per_word)')
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const filtered = jobs?.filter(j => {
    if (activeTab !== 'all' && j.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      const orgName = (j.organisation as { name: string })?.name?.toLowerCase() ?? ''
      const reviewerName = (j.reviewer as { full_name: string })?.full_name?.toLowerCase() ?? ''
      return (
        j.job_number.toLowerCase().includes(q) ||
        orgName.includes(q) ||
        j.content_type.toLowerCase().includes(q) ||
        reviewerName.includes(q)
      )
    }
    return true
  }) ?? []

  const unallocatedCount = jobs?.filter(j => j.status === 'unallocated').length ?? 0

  if (isLoading) {
    return <div className="bg-white border border-gray-200 rounded-lg p-8 animate-pulse h-96" />
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`text-sm px-3 py-1.5 rounded ${activeTab === tab.value ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
              >
                {tab.label}
                {tab.value === 'unallocated' && unallocatedCount > 0 && (
                  <span className="ml-1 text-xs" style={{ color: activeTab === 'unallocated' ? '#fff' : COLORS.red }}>{unallocatedCount}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-gray-400"
            />
            <button className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Manual entry
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Job</th>
                  <th className="text-left py-3 px-4 font-medium">Client</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Lang</th>
                  <th className="text-right py-3 px-4 font-medium">Words</th>
                  <th className="text-left py-3 px-4 font-medium">Reviewer</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Due</th>
                  <th className="text-right py-3 px-4 font-medium">Cost / Rev</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(job => {
                  const reviewer = job.reviewer as { full_name: string; rate_per_word: number } | null
                  const cost = reviewer?.rate_per_word ? Math.round(job.word_count * Number(reviewer.rate_per_word)) : 0
                  const rev = Math.round(job.word_count * 0.08)
                  const dueDate = new Date(job.due_at)
                  const now = new Date()
                  const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
                  const dueLabel = job.status === 'delivered'
                    ? 'Done'
                    : hoursLeft < 0 ? 'Overdue' : hoursLeft < 24 ? `${hoursLeft}h` : `${Math.round(hoursLeft / 24)}d`

                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-gray-400">{job.job_number}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{(job.organisation as { name: string })?.name}</td>
                      <td className="py-3 px-4 text-gray-600">{job.content_type}</td>
                      <td className="py-3 px-4 text-gray-600">{job.source_language} → {job.target_language}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{job.word_count.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        {reviewer ? (
                          <span className="text-gray-600">{reviewer.full_name}</span>
                        ) : (
                          <span className="text-xs bg-gray-900 text-white rounded px-2 py-1">Allocate</span>
                        )}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={job.status as JobStatus} /></td>
                      <td className="py-3 px-4 text-xs text-gray-500">{dueLabel}</td>
                      <td className="py-3 px-4 text-right text-xs">
                        <div className="text-gray-500">£{cost}</div>
                        <div className="text-gray-900 font-medium">£{rev}</div>
                      </td>
                      <td className="py-3 px-4 text-right"><Eye className="w-4 h-4 text-gray-400" /></td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-sm text-gray-400">No jobs found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Drawer
        open={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
        title="Job detail"
      >
        {selectedJobId && (
          <JobDetail jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
        )}
      </Drawer>
    </>
  )
}
