import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { useAuth } from '../../lib/auth'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { SegmentEditor } from '../../components/shared/SegmentEditor'
import { FileViewer } from '../../components/shared/FileViewer'
import { InternalNotes } from '../../components/shared/InternalNotes'
import { ArrowLeft, Globe, FileText, Clock, Zap, AlertTriangle } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', orange: '#EE7C24' }

export function ReviewerJobDetail() {
  const { id: jobId } = useParams<{ id: string }>()
  const { profile } = useAuth()

  const { data: job, isLoading } = useQuery({
    queryKey: ['reviewer-job-detail', jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*, organisation:organisations(name, id)').eq('id', jobId!).eq('is_demo', getIsDemo()).single()
      if (error) throw error
      return data
    },
    enabled: !!jobId,
  })

  const { data: glossary } = useQuery({
    queryKey: ['reviewer-job-glossary', job?.organisation],
    queryFn: async () => {
      const orgId = (job?.organisation as { id: string })?.id
      if (!orgId) return []
      const { data, error } = await supabase.from('glossary_entries').select('source_term, preferred_translation, target_language').eq('organisation_id', orgId).eq('target_language', job!.target_language).eq('is_demo', getIsDemo())
      if (error) throw error
      return data
    },
    enabled: !!job,
  })

  const { data: brandVoice } = useQuery({
    queryKey: ['reviewer-job-brandvoice', job?.organisation],
    queryFn: async () => {
      const orgId = (job?.organisation as { id: string })?.id
      if (!orgId) return null
      const { data, error } = await supabase.from('brand_voice_notes').select('guidelines, tone_descriptors, forbidden_phrases').eq('organisation_id', orgId).eq('is_demo', getIsDemo()).maybeSingle()
      if (error) return null
      return data
    },
    enabled: !!job,
  })

  const { data: score } = useQuery({
    queryKey: ['reviewer-job-score', jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from('scores').select('*').eq('job_id', jobId!).eq('reviewer_id', profile!.id).eq('is_demo', getIsDemo()).maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!jobId && !!profile,
  })

  if (isLoading || !job) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const org = job.organisation as { name: string; id: string }
  const iterations = (job.review_iterations ?? []) as Array<{ returned_at: string; feedback_text: string }>
  const latestFeedback = iterations[iterations.length - 1]
  const isCompleted = job.status === 'delivered' || job.status === 'awaiting_signoff'

  return (
    <div className="space-y-6">
      <Link to="/reviewer" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to queue
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-gray-400">{job.job_number}</span>
                <StatusBadge status={job.status} />
                {job.urgency === 'expedited' && <span className="text-xs px-2 py-0.5 rounded inline-flex items-center gap-0.5" style={{ background: COLORS.orange + '20', color: COLORS.orange }}><Zap className="w-3 h-3" />Expedited</span>}
                {job.iteration_count > 1 && <span className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700">Iteration {job.iteration_count}</span>}
              </div>
              <h1 className="text-lg font-medium text-gray-900 mt-2">{org?.name} — {job.content_type}</h1>
              <p className="text-sm text-gray-500">{job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words</p>
            </div>
            {job.status === 'in_review' && (
              <Link to={`/reviewer/review/${jobId}`} className="text-sm bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800 shrink-0">
                Open in scoring view
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Returned feedback banner */}
      {latestFeedback && job.status === 'in_review' && (
        <div className="border-2 border-orange-200 bg-orange-50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Returned for revision</p>
              <p className="text-sm text-gray-700 mt-1">{latestFeedback.feedback_text}</p>
              <p className="text-xs text-gray-500 mt-2">Returned {new Date(latestFeedback.returned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Pre-flight */}
          {job.preflight_data && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Vera's pre-flight check</p>
              <p className="text-sm text-gray-700">{(job.preflight_data as { summary?: string }).summary}</p>
              <p className="text-xs text-gray-500 mt-1">Confidence: {(job.preflight_data as { confidence_score?: number }).confidence_score}/10</p>
            </div>
          )}

          {/* Segments */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Content segments</h3>
            <SegmentEditor
              jobId={jobId!}
              preflightData={job.preflight_data as { glossary_violations?: { term: string; expected: string; severity: string }[]; risky_segments?: { description: string; reason: string; severity: string }[]; brand_voice_issues?: { description: string; severity: string }[] } | null}
              readOnly={isCompleted}
            />
          </div>

          {/* Score summary if completed */}
          {score && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Your scoring</h3>
                <span className="text-xl font-light text-gray-900">hTER {Number(score.hter_score).toFixed(3)}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[{ l: 'ACC', v: score.accuracy }, { l: 'TRM', v: score.terminology }, { l: 'TON', v: score.tone_register }, { l: 'BRD', v: score.brand_voice }, { l: 'CUL', v: score.cultural_fit }, { l: 'RSK', v: score.risk }].map(c => (
                  <div key={c.l} className="text-center p-2 border border-gray-100 rounded">
                    <p className="text-lg font-light" style={{ color: c.v >= 8 ? COLORS.green : c.v >= 6 ? COLORS.orange : '#D9211E' }}>{c.v}</p>
                    <p className="text-[10px] text-gray-400">{c.l}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* Internal notes */}
          <InternalNotes jobId={jobId!} />

        {/* Sidebar — client context */}
        <div className="space-y-4">
          {/* Files */}
          <FileViewer bucket="job-files" path={`${org.id}/${jobId}/source`} label="Source file" />

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Job details</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2"><Globe className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-xs text-gray-500">Languages</p><p className="text-gray-900">{job.source_language} → {job.target_language}</p></div></div>
              <div className="flex items-start gap-2"><FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-xs text-gray-500">Words</p><p className="text-gray-900">{job.word_count.toLocaleString()}</p></div></div>
              <div className="flex items-start gap-2"><Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><div><p className="text-xs text-gray-500">Due</p><p className="text-gray-900">{new Date(job.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div></div>
            </div>
            {job.ai_tool_used && <p className="text-xs text-gray-500 mt-3">AI tool: <span className="text-gray-700">{job.ai_tool_used}</span></p>}
            {job.notes && <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-500 mb-1">Client notes</p><p className="text-sm text-gray-700">{job.notes}</p></div>}
          </div>

          {/* Glossary */}
          {glossary && glossary.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Client glossary ({glossary.length})</p>
              <div className="space-y-1">
                {glossary.slice(0, 10).map((g, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{g.source_term}</span>
                    <span className="text-gray-900 font-medium">{g.preferred_translation}</span>
                  </div>
                ))}
                {glossary.length > 10 && <p className="text-xs text-gray-400">+{glossary.length - 10} more</p>}
              </div>
            </div>
          )}

          {/* Brand voice */}
          {brandVoice && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Brand voice</p>
              {brandVoice.guidelines && <p className="text-xs text-gray-700 mb-2">{brandVoice.guidelines}</p>}
              {brandVoice.tone_descriptors?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {brandVoice.tone_descriptors.map((t: string, i: number) => (
                    <span key={i} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{t}</span>
                  ))}
                </div>
              )}
              {brandVoice.forbidden_phrases?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {brandVoice.forbidden_phrases.map((f: string, i: number) => (
                    <span key={i} className="text-[10px] bg-red-50 text-red-600 rounded px-1.5 py-0.5">{f}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
