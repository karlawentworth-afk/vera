import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useClientOrgId } from '../../lib/useClientOrg'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { SegmentDiffView } from '../../components/shared/SegmentDiffView'
import { FileViewer } from '../../components/shared/FileViewer'
import { ArrowLeft, Clock, CheckCircle, Globe, FileText } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', orange: '#EE7C24' }

export function ClientJobDetail() {
  const { id: jobId } = useParams<{ id: string }>()
  const orgId = useClientOrgId()

  const { data: job, isLoading } = useQuery({
    queryKey: ['client-job-detail', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, reviewer:profiles!jobs_reviewer_id_fkey(full_name, specialism, languages)')
        .eq('id', jobId!)
        .eq('organisation_id', orgId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!jobId && !!orgId,
  })

  const { data: score } = useQuery({
    queryKey: ['client-job-score', jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from('scores').select('*').eq('job_id', jobId!).maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!jobId,
  })

  const { data: auditEntries } = useQuery({
    queryKey: ['client-job-audit', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*, actor:profiles!audit_log_actor_id_fkey(full_name)')
        .eq('entity_type', 'job')
        .eq('entity_id', jobId!)
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!jobId,
  })

  if (isLoading || !job) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const reviewer = job.reviewer as { full_name: string; specialism: string; languages: string[] } | null
  const criteria = score ? [
    { label: 'Accuracy', value: score.accuracy },
    { label: 'Terminology', value: score.terminology },
    { label: 'Tone & register', value: score.tone_register },
    { label: 'Brand voice', value: score.brand_voice },
    { label: 'Cultural fit', value: score.cultural_fit },
    { label: 'Risk', value: score.risk },
  ] : []

  // Timeline
  const timeline = [
    { label: 'Submitted', date: job.submitted_at, icon: FileText, done: true },
    { label: 'Allocated', date: job.allocated_at, icon: Globe, done: !!job.reviewer_id },
    { label: 'Reviewed', date: score ? score.created_at : null, icon: CheckCircle, done: !!score },
    { label: 'Delivered', date: job.delivered_at, icon: CheckCircle, done: job.status === 'delivered' },
  ]

  return (
    <div className="space-y-6">
      <Link to="/client/jobs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to jobs
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="font-mono text-sm text-gray-400">{job.job_number}</span>
            <StatusBadge status={job.status} />
            {job.ai_tool_used && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{job.ai_tool_used}</span>}
          </div>
          <h1 className="text-lg font-medium text-gray-900">{job.content_type}</h1>
          <p className="text-sm text-gray-500 mt-1">{job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words · {job.urgency}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Timeline</h3>
        <div className="flex items-center justify-between">
          {timeline.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="flex flex-col items-center text-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.done ? 'bg-green-50' : 'bg-gray-100'}`}>
                  <Icon className="w-4 h-4" style={{ color: step.done ? COLORS.green : '#9CA3AF' }} />
                </div>
                <p className="text-xs font-medium text-gray-900 mt-1">{step.label}</p>
                {step.date && <p className="text-[10px] text-gray-400">{new Date(step.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* hTER Score breakdown */}
          {score && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <RainbowStripe height={3} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">Quality score</h3>
                  <div className="text-right">
                    <p className="text-2xl font-light text-gray-900">{Number(score.hter_score).toFixed(3)}</p>
                    <p className="text-xs text-gray-500">hTER score</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {criteria.map(c => (
                    <div key={c.label} className="text-center p-3 border border-gray-100 rounded">
                      <p className="text-xl font-light" style={{ color: c.value >= 8 ? COLORS.green : c.value >= 6 ? COLORS.orange : '#D9211E' }}>{c.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                    </div>
                  ))}
                </div>
                {score.reviewer_notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Reviewer notes</p>
                    <p className="text-sm text-gray-700">{score.reviewer_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Segment diff */}
          {job.status === 'delivered' && <SegmentDiffView jobId={jobId!} />}

          {/* Audit trail */}
          {auditEntries && auditEntries.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4">Audit trail</h3>
              <div className="space-y-2">
                {auditEntries.map(e => (
                  <div key={e.id} className="flex items-center gap-3 text-sm">
                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-400 w-28 shrink-0">{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">{e.action}</span>
                    <span className="text-gray-500">{(e.actor as { full_name: string })?.full_name ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {reviewer && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Reviewer</p>
              <p className="text-sm font-medium text-gray-900">{reviewer.full_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{reviewer.specialism}</p>
              <p className="text-xs text-gray-500">{reviewer.languages?.join(', ')}</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Details</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Words</span><span>{job.word_count.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Urgency</span><span>{job.urgency}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">AI tool</span><span>{job.ai_tool_used || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Due</span><span>{new Date(job.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>
            </div>
          </div>

          {job.notes && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Notes</p>
              <p className="text-sm text-gray-700">{job.notes}</p>
            </div>
          )}

          <div className="space-y-2">
            <FileViewer bucket="job-files" path={`${job.organisation_id}/${jobId}/source`} label="Source file" />
            {job.status === 'delivered' && (
              <FileViewer bucket="job-files" path={`${job.organisation_id}/${jobId}/delivered`} label="Verified translation" accent />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
