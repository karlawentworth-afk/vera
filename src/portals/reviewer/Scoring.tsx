import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { FileText, Zap } from 'lucide-react'

const COLORS = { green: '#0F8F4D', orange: '#EE7C24', red: '#D9211E', cyan: '#1FA1D6' }

const CRITERIA = [
  { key: 'accuracy', label: 'Accuracy', desc: 'Does the translation preserve the source meaning?' },
  { key: 'terminology', label: 'Terminology', desc: 'Are technical and specialist terms correctly used?' },
  { key: 'tone_register', label: 'Tone & register', desc: 'Is the formality and voice appropriate?' },
  { key: 'brand_voice', label: 'Brand voice', desc: 'Does it align with client style and brand?' },
  { key: 'cultural_fit', label: 'Cultural fit', desc: 'Is it natural and appropriate for the target locale?' },
  { key: 'risk', label: 'Risk', desc: 'Are there safety, legal or reputational concerns? (10 = no risk)' },
] as const

type ScoreKey = typeof CRITERIA[number]['key']

function scoreColor(value: number): string {
  if (value >= 8) return COLORS.green
  if (value >= 6) return COLORS.orange
  return COLORS.red
}

function calculateHter(scores: Record<ScoreKey, number>): number {
  const values = Object.values(scores)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Math.max(0.05, Math.min(0.50, parseFloat(((10 - avg) / 10 * 0.5).toFixed(3))))
}

export function ReviewerScoring() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    accuracy: 0,
    terminology: 0,
    tone_register: 0,
    brand_voice: 0,
    cultural_fit: 0,
    risk: 0,
  })
  const [notes, setNotes] = useState('')

  const { data: job, isLoading } = useQuery({
    queryKey: ['reviewer-job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, organisation:organisations(name)')
        .eq('id', jobId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!jobId,
  })

  // Check for existing score (draft or re-edit)
  const { data: existingScore } = useQuery({
    queryKey: ['existing-score', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .eq('job_id', jobId!)
        .eq('reviewer_id', profile!.id)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setScores({
          accuracy: data.accuracy,
          terminology: data.terminology,
          tone_register: data.tone_register,
          brand_voice: data.brand_voice,
          cultural_fit: data.cultural_fit,
          risk: data.risk,
        })
        setNotes(data.reviewer_notes ?? '')
      }
      return data
    },
    enabled: !!jobId && !!profile,
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const hter = calculateHter(scores)

      if (existingScore) {
        // Update existing score
        const { error } = await supabase
          .from('scores')
          .update({ ...scores, hter_score: hter, reviewer_notes: notes || null })
          .eq('id', existingScore.id)
        if (error) throw error
      } else {
        // Insert new score
        const { error } = await supabase
          .from('scores')
          .insert({
            job_id: jobId!,
            reviewer_id: profile!.id,
            ...scores,
            hter_score: hter,
            reviewer_notes: notes || null,
          })
        if (error) throw error
      }

      // Update job status to awaiting_signoff
      const { error: jobErr } = await supabase
        .from('jobs')
        .update({ status: 'awaiting_signoff' })
        .eq('id', jobId!)
      if (jobErr) throw jobErr

      // Audit log
      await supabase.from('audit_log').insert({
        actor_id: profile!.id,
        action: 'submitted_for_signoff',
        entity_type: 'job',
        entity_id: jobId!,
        details: { hter_score: hter, scores },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewer-jobs'] })
      navigate('/reviewer')
    },
  })

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const hter = calculateHter(scores)
      if (existingScore) {
        const { error } = await supabase
          .from('scores')
          .update({ ...scores, hter_score: hter, reviewer_notes: notes || null })
          .eq('id', existingScore.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('scores')
          .insert({
            job_id: jobId!,
            reviewer_id: profile!.id,
            ...scores,
            hter_score: hter,
            reviewer_notes: notes || null,
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['existing-score', jobId] })
    },
  })

  if (isLoading || !job) {
    return <div className="bg-white border border-gray-200 rounded-lg p-8 h-96 animate-pulse" />
  }

  const org = job.organisation as { name: string }
  const allScored = Object.values(scores).every(v => v > 0)
  const hter = allScored ? calculateHter(scores) : null

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-xs font-mono text-gray-400">{job.job_number}</span>
              <h3 className="font-medium text-gray-900 mt-1">{org?.name} — {job.content_type}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {job.source_language} → {job.target_language} · {job.word_count.toLocaleString()} words
                {job.urgency === 'expedited' && (
                  <span className="ml-2 inline-flex items-center text-xs" style={{ color: COLORS.orange }}>
                    <Zap className="w-3 h-3 mr-0.5" />Expedited
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending || !allScored}
                className="text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                {saveDraftMutation.isPending ? 'Saving...' : 'Save draft'}
              </button>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !allScored}
                className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit for sign-off'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <StatusBadge status={job.status} />
            {job.notes && <span className="text-xs text-gray-500">· Has client notes</span>}
          </div>

          {/* Client notes */}
          {job.notes && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Client notes</p>
              <p className="text-sm text-gray-700">{job.notes}</p>
            </div>
          )}

          {/* File placeholder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="border border-gray-100 rounded p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Source ({job.source_language})</p>
              <div className="flex items-center gap-2 text-gray-400">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Source file will appear here</span>
              </div>
            </div>
            <div className="border-2 rounded p-4" style={{ borderColor: COLORS.cyan + '60' }}>
              <p className="text-xs uppercase tracking-wide font-medium mb-2" style={{ color: COLORS.cyan }}>AI translation ({job.target_language})</p>
              <div className="flex items-center gap-2 text-gray-400">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Translated file will appear here</span>
              </div>
            </div>
          </div>

          {/* Scoring */}
          <h4 className="font-medium text-gray-900 mb-4">Your scoring — rate 1-10 across each criterion</h4>
          <div className="space-y-4">
            {CRITERIA.map(criterion => {
              const value = scores[criterion.key]
              return (
                <div key={criterion.key} className="border border-gray-100 rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{criterion.label}</p>
                      <p className="text-xs text-gray-500">{criterion.desc}</p>
                    </div>
                    {value > 0 && (
                      <div className="text-2xl font-light" style={{ color: scoreColor(value) }}>
                        {value}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        onClick={() => setScores(prev => ({ ...prev, [criterion.key]: n }))}
                        className={`flex-1 h-6 sm:h-3 rounded-full transition-all ${n <= value ? '' : 'bg-gray-100 hover:bg-gray-200'}`}
                        style={n <= value ? { background: scoreColor(value) } : {}}
                        aria-label={`${criterion.label}: ${n}`}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Live hTER */}
          {hter !== null && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">Overall hTER score</p>
                <p className="text-xl font-light text-gray-900">{hter.toFixed(3)}</p>
              </div>
              <p className="text-xs text-gray-500">
                {hter < 0.15 ? 'Excellent — minimal editing needed. This AI output performed very well.' :
                 hter < 0.25 ? 'Good — within normal range. Some edits required.' :
                 'Needs attention — significant edits were required.'}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="mt-6">
            <label className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2 block">
              Reviewer notes (for audit trail)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Terminology choices flagged, style observations, recommendations for client..."
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-24 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* Bottom actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => navigate('/reviewer')}
              className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50"
            >
              Back to queue
            </button>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !allScored}
              className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit for sign-off'}
            </button>
          </div>

          {submitMutation.isError && (
            <p className="mt-3 text-sm text-red-600">Failed to submit. Please try again.</p>
          )}
        </div>
      </div>
    </div>
  )
}
