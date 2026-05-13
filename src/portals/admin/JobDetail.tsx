import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Clock, FileText, Globe, Zap, User, CheckCircle, AlertCircle } from 'lucide-react'
import type { JobStatus } from '../../types/database'

const COLORS = {
  green: '#0F8F4D', orange: '#EE7C24', red: '#D9211E', cyan: '#1FA1D6', purple: '#8E2882',
}

interface JobDetailProps {
  jobId: string
  onClose: () => void
}

export function JobDetail({ jobId, onClose }: JobDetailProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('')
  const [signoffNotes, setSignoffNotes] = useState('')

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, organisation:organisations(name), reviewer:profiles!jobs_reviewer_id_fkey(id, full_name, email, languages, specialism, rate_per_word)')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: reviewers } = useQuery({
    queryKey: ['reviewers-for-allocation'],
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

  const { data: activeJobCounts } = useQuery({
    queryKey: ['reviewer-active-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('reviewer_id')
        .in('status', ['in_review', 'awaiting_signoff', 'allocated'])
        .not('reviewer_id', 'is', null)
      if (error) throw error
      const counts: Record<string, number> = {}
      data.forEach((j: { reviewer_id: string }) => {
        counts[j.reviewer_id] = (counts[j.reviewer_id] ?? 0) + 1
      })
      return counts
    },
  })

  const { data: scores } = useQuery({
    queryKey: ['job-scores', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .eq('job_id', jobId)
      if (error) throw error
      return data
    },
    enabled: !!job && (job.status === 'awaiting_signoff' || job.status === 'delivered'),
  })

  const allocateMutation = useMutation({
    mutationFn: async (reviewerId: string) => {
      const { error } = await supabase
        .from('jobs')
        .update({
          reviewer_id: reviewerId,
          status: 'in_review',
          allocated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
      if (error) throw error

      // Audit log
      await supabase.from('audit_log').insert({
        actor_id: profile!.id,
        action: 'allocated',
        entity_type: 'job',
        entity_id: jobId,
        details: { reviewer_id: reviewerId },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] })
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['reviewer-active-counts'] })
      setSelectedReviewerId('')
    },
  })

  const signoffMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'delivered' as JobStatus,
          delivered_at: new Date().toISOString(),
          signed_off_at: new Date().toISOString(),
          signed_off_by: profile!.id,
        })
        .eq('id', jobId)
      if (error) throw error

      await supabase.from('audit_log').insert({
        actor_id: profile!.id,
        action: 'signed_off',
        entity_type: 'job',
        entity_id: jobId,
        details: { notes: signoffNotes || null },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] })
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
      onClose()
    },
  })

  if (isLoading || !job) {
    return <div className="animate-pulse space-y-4"><div className="h-6 bg-gray-100 rounded w-48" /><div className="h-32 bg-gray-100 rounded" /></div>
  }

  const org = job.organisation as { name: string }
  const reviewer = job.reviewer as { id: string; full_name: string; email: string; languages: string[]; specialism: string; rate_per_word: number } | null
  const dueDate = new Date(job.due_at)
  const now = new Date()
  const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
  const isOverdue = hoursLeft < 0 && job.status !== 'delivered'
  const score = scores?.[0]

  // Sort reviewers: matching language pair first, then by fewest active jobs
  const targetLang = `${job.source_language} → ${job.target_language}`
  const sortedReviewers = [...(reviewers ?? [])].sort((a, b) => {
    const aMatch = a.languages?.some((l: string) => l === targetLang) ? 0 : 1
    const bMatch = b.languages?.some((l: string) => l === targetLang) ? 0 : 1
    if (aMatch !== bMatch) return aMatch - bMatch
    return (activeJobCounts?.[a.id] ?? 0) - (activeJobCounts?.[b.id] ?? 0)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-mono text-gray-400">{job.job_number}</span>
          <StatusBadge status={job.status} />
          {job.urgency === 'expedited' && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: COLORS.orange + '20', color: COLORS.orange }}>
              <Zap className="w-3 h-3 inline -mt-0.5 mr-0.5" />Expedited
            </span>
          )}
          {isOverdue && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: COLORS.red + '20', color: COLORS.red }}>
              Overdue
            </span>
          )}
        </div>
        <h3 className="text-lg font-medium text-gray-900">{org?.name}</h3>
        <p className="text-sm text-gray-500">{job.content_type}</p>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Language pair</p>
            <p className="text-sm font-medium text-gray-900">{job.source_language} → {job.target_language}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Word count</p>
            <p className="text-sm font-medium text-gray-900">{job.word_count.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Submitted</p>
            <p className="text-sm font-medium text-gray-900">{new Date(job.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Due</p>
            <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
              {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {!isOverdue && job.status !== 'delivered' && <span className="text-gray-500 font-normal"> ({hoursLeft}h left)</span>}
            </p>
          </div>
        </div>
      </div>

      {job.ai_tool_used && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">AI tool:</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">{job.ai_tool_used}</span>
        </div>
      )}

      {job.notes && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Client notes</p>
          <p className="text-sm text-gray-700">{job.notes}</p>
        </div>
      )}

      {/* Source / translated files placeholder */}
      <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
        <FileText className="w-5 h-5 text-gray-300 mx-auto mb-1" />
        <p className="text-xs text-gray-400">Source and translated files will appear here</p>
      </div>

      {/* Reviewer section */}
      <RainbowStripe height={2} />

      {/* UNALLOCATED: show allocation UI */}
      {(job.status === 'unallocated') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" style={{ color: COLORS.red }} />
            <h4 className="font-medium text-gray-900">Allocate reviewer</h4>
          </div>

          <div className="space-y-2">
            {sortedReviewers.map(r => {
              const matchesLang = r.languages?.some((l: string) => l === targetLang)
              const count = activeJobCounts?.[r.id] ?? 0
              const isSelected = selectedReviewerId === r.id

              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReviewerId(r.id)}
                  className={`w-full text-left p-3 rounded border transition ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{r.full_name}</span>
                      {matchesLang && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: COLORS.green + '20', color: COLORS.green }}>
                          Language match
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{count} active · £{Number(r.rate_per_word).toFixed(3)}/w</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{r.languages?.join(', ')} · {r.specialism}</p>
                </button>
              )
            })}
          </div>

          {selectedReviewerId && (
            <button
              onClick={() => allocateMutation.mutate(selectedReviewerId)}
              disabled={allocateMutation.isPending}
              className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {allocateMutation.isPending ? 'Allocating...' : `Allocate to ${sortedReviewers.find(r => r.id === selectedReviewerId)?.full_name}`}
            </button>
          )}

          {allocateMutation.isError && (
            <p className="text-sm text-red-600">Failed to allocate. Please try again.</p>
          )}
        </div>
      )}

      {/* IN REVIEW / ALLOCATED: show current reviewer with reassign */}
      {(job.status === 'in_review' || job.status === 'allocated') && reviewer && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: COLORS.cyan }} />
            <h4 className="font-medium text-gray-900">Current reviewer</h4>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">{reviewer.full_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{reviewer.languages?.join(', ')} · {reviewer.specialism}</p>
            <p className="text-xs text-gray-500 mt-0.5">£{Number(reviewer.rate_per_word).toFixed(3)}/word · Est. cost: £{Math.round(job.word_count * Number(reviewer.rate_per_word))}</p>
          </div>

          <details className="text-sm">
            <summary className="text-gray-500 hover:text-gray-700 cursor-pointer">Reassign to different reviewer</summary>
            <div className="mt-3 space-y-2">
              {sortedReviewers.filter(r => r.id !== reviewer.id).map(r => {
                const count = activeJobCounts?.[r.id] ?? 0
                const isSelected = selectedReviewerId === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReviewerId(r.id)}
                    className={`w-full text-left p-2 rounded border text-xs transition ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <span className="font-medium">{r.full_name}</span>
                    <span className="text-gray-500 ml-2">{count} active · {r.languages?.join(', ')}</span>
                  </button>
                )
              })}
              {selectedReviewerId && selectedReviewerId !== reviewer.id && (
                <button
                  onClick={() => allocateMutation.mutate(selectedReviewerId)}
                  disabled={allocateMutation.isPending}
                  className="w-full bg-gray-900 text-white rounded py-2 text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {allocateMutation.isPending ? 'Reassigning...' : 'Confirm reassignment'}
                </button>
              )}
            </div>
          </details>
        </div>
      )}

      {/* AWAITING SIGNOFF: show scores + signoff button */}
      {job.status === 'awaiting_signoff' && (
        <div className="space-y-4">
          {reviewer && (
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Reviewed by</p>
              <p className="text-sm font-medium text-gray-900">{reviewer.full_name}</p>
            </div>
          )}

          {score && (
            <>
              <h4 className="font-medium text-gray-900">Review scores</h4>
              <div className="space-y-3">
                {[
                  { label: 'Accuracy', desc: 'Source meaning preserved', value: score.accuracy },
                  { label: 'Terminology', desc: 'Technical terms correct', value: score.terminology },
                  { label: 'Tone & register', desc: 'Formality appropriate', value: score.tone_register },
                  { label: 'Brand voice', desc: 'Client style aligned', value: score.brand_voice },
                  { label: 'Cultural fit', desc: 'Natural for locale', value: score.cultural_fit },
                  { label: 'Risk', desc: '10 = no risk', value: score.risk },
                ].map((criterion) => (
                  <div key={criterion.label} className="border border-gray-100 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{criterion.label}</p>
                        <p className="text-xs text-gray-500">{criterion.desc}</p>
                      </div>
                      <div className="text-xl font-light" style={{
                        color: criterion.value >= 8 ? COLORS.green : criterion.value >= 6 ? COLORS.orange : COLORS.red
                      }}>
                        {criterion.value}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <div
                          key={n}
                          className="flex-1 h-1 rounded-full"
                          style={{
                            background: n <= criterion.value
                              ? (criterion.value >= 8 ? COLORS.green : criterion.value >= 6 ? COLORS.orange : COLORS.red)
                              : '#f3f4f6'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">Overall hTER score</p>
                  <p className="text-xl font-light text-gray-900">{Number(score.hter_score).toFixed(3)}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Number(score.hter_score) < 0.15 ? 'Excellent — minimal editing needed' :
                   Number(score.hter_score) < 0.25 ? 'Good — within normal range' :
                   'Needs attention — significant edits required'}
                </p>
              </div>

              {score.reviewer_notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Reviewer notes</p>
                  <p className="text-sm text-gray-700">{score.reviewer_notes}</p>
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Sign-off notes (optional)</label>
            <textarea
              value={signoffNotes}
              onChange={e => setSignoffNotes(e.target.value)}
              placeholder="Any notes for the audit trail..."
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-gray-400"
            />
          </div>

          <button
            onClick={() => signoffMutation.mutate()}
            disabled={signoffMutation.isPending}
            className="w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {signoffMutation.isPending ? 'Signing off...' : 'Sign off & deliver'}
          </button>

          {signoffMutation.isError && (
            <p className="text-sm text-red-600">Failed to sign off. Please try again.</p>
          )}
        </div>
      )}

      {/* DELIVERED: show final state */}
      {job.status === 'delivered' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: COLORS.green }} />
            <h4 className="font-medium text-gray-900">Delivered</h4>
          </div>

          {reviewer && (
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Reviewed by</p>
              <p className="text-sm font-medium text-gray-900">{reviewer.full_name}</p>
              {job.delivered_at && (
                <p className="text-xs text-gray-500 mt-1">Delivered {new Date(job.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          )}

          {score && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">hTER score</p>
                <p className="text-xl font-light text-gray-900">{Number(score.hter_score).toFixed(3)}</p>
              </div>
              <div className="grid grid-cols-6 gap-2 mt-3">
                {[
                  { label: 'ACC', value: score.accuracy },
                  { label: 'TRM', value: score.terminology },
                  { label: 'TON', value: score.tone_register },
                  { label: 'BRD', value: score.brand_voice },
                  { label: 'CUL', value: score.cultural_fit },
                  { label: 'RSK', value: score.risk },
                ].map(c => (
                  <div key={c.label} className="text-center">
                    <p className="text-lg font-light" style={{
                      color: c.value >= 8 ? COLORS.green : c.value >= 6 ? COLORS.orange : COLORS.red
                    }}>{c.value}</p>
                    <p className="text-[10px] text-gray-400">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
