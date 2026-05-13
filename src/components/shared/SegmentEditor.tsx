import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MessageSquare, AlertTriangle } from 'lucide-react'

const SEVERITY_CONFIG = {
  fine: { label: 'Fine', bg: '#0F8F4D20', color: '#0F8F4D' },
  minor: { label: 'Minor', bg: '#1FA1D620', color: '#1FA1D6' },
  major: { label: 'Major', bg: '#EE7C2420', color: '#EE7C24' },
  critical: { label: 'Critical', bg: '#D9211E20', color: '#D9211E' },
} as const

type Severity = keyof typeof SEVERITY_CONFIG

interface PreflightData {
  glossary_violations?: { term: string; expected: string; severity: string }[]
  risky_segments?: { description: string; reason: string; severity: string }[]
  brand_voice_issues?: { description: string; severity: string }[]
}

interface SegmentEditorProps {
  jobId: string
  preflightData?: PreflightData | null
  readOnly?: boolean
}

export function SegmentEditor({ jobId, preflightData, readOnly }: SegmentEditorProps) {
  const queryClient = useQueryClient()

  const { data: segments, isLoading } = useQuery({
    queryKey: ['job-segments', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_segments')
        .select('*')
        .eq('job_id', jobId)
        .order('segment_index')
      if (error) throw error
      return data
    },
  })

  // Trigger segment parsing if none exist
  const { data: parseTriggered } = useQuery({
    queryKey: ['parse-segments-trigger', jobId],
    queryFn: async () => {
      if (segments && segments.length > 0) return true
      // Try to parse
      try {
        await fetch('/.netlify/functions/parse-segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        })
        queryClient.invalidateQueries({ queryKey: ['job-segments', jobId] })
      } catch { /* ignore */ }
      return true
    },
    enabled: !!segments && segments.length === 0,
  })

  // Stats
  const totalSegments = segments?.length ?? 0
  const editedCount = segments?.filter(s => s.edited).length ?? 0
  const criticalCount = segments?.filter(s => s.severity === 'critical').length ?? 0
  const majorCount = segments?.filter(s => s.severity === 'major').length ?? 0
  const minorCount = segments?.filter(s => s.severity === 'minor').length ?? 0

  if (isLoading) return <div className="h-48 bg-gray-100 rounded animate-pulse" />
  if (!segments || segments.length === 0) return <p className="text-sm text-gray-400 py-4 text-center">No segments available. Upload a source file to enable segment editing.{parseTriggered ? '' : ''}</p>

  return (
    <div className="space-y-3">
      {/* Sticky stats header */}
      <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className="font-medium text-gray-900">{totalSegments} segments</span>
        {editedCount > 0 && <span>{editedCount} edited</span>}
        {criticalCount > 0 && <span style={{ color: '#D9211E' }}>{criticalCount} critical</span>}
        {majorCount > 0 && <span style={{ color: '#EE7C24' }}>{majorCount} major</span>}
        {minorCount > 0 && <span style={{ color: '#1FA1D6' }}>{minorCount} minor</span>}
      </div>

      {/* Segments */}
      {segments.map(segment => (
        <SegmentRow
          key={segment.id}
          segment={segment}
          preflightData={preflightData}
          readOnly={readOnly}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['job-segments', jobId] })}
        />
      ))}
    </div>
  )
}

function SegmentRow({ segment, preflightData, readOnly, onUpdate }: {
  segment: { id: string; segment_index: number; source_text: string; ai_translation: string; reviewer_translation: string | null; reviewer_comment: string | null; severity: string | null; edited: boolean }
  preflightData?: PreflightData | null
  readOnly?: boolean
  onUpdate: () => void
}) {
  const [translation, setTranslation] = useState(segment.reviewer_translation ?? segment.ai_translation)
  const [comment, setComment] = useState(segment.reviewer_comment ?? '')
  const [severity, setSeverity] = useState<Severity | null>(segment.severity as Severity | null)
  const [showComment, setShowComment] = useState(!!segment.reviewer_comment)
  const [saving, setSaving] = useState(false)

  const isEdited = translation !== segment.ai_translation
  const matchingFlags = [
    ...(preflightData?.glossary_violations?.filter(v => segment.source_text.toLowerCase().includes(v.term.toLowerCase())) ?? []).map(v => `Glossary: "${v.term}" → expected "${v.expected}"`),
    ...(preflightData?.brand_voice_issues?.filter(() => segment.segment_index === 0) ?? []).map(b => `Brand voice: ${b.description}`),
  ]

  const saveSegment = useCallback(async () => {
    if (readOnly) return
    setSaving(true)
    await supabase.from('job_segments').update({
      reviewer_translation: isEdited ? translation : null,
      reviewer_comment: comment || null,
      severity,
      edited: isEdited,
    }).eq('id', segment.id)

    // Audit log (fire and forget)
    if (isEdited || comment) {
      supabase.from('audit_log').insert({
        actor_id: null, // Will be set by RLS context
        action: 'segment_edited',
        entity_type: 'job_segment',
        entity_id: segment.id,
        details: { segment_index: segment.segment_index, severity, edited: isEdited, has_comment: !!comment },
      }).then(() => {})
    }

    setSaving(false)
    onUpdate()
  }, [translation, comment, severity, isEdited, segment.id, segment.segment_index, readOnly, onUpdate])

  const borderColor = isEdited
    ? severity === 'critical' ? '#D9211E' : severity === 'major' ? '#EE7C24' : '#1FA1D6'
    : '#e5e7eb'

  return (
    <div className={`border rounded-lg overflow-hidden ${isEdited ? 'border-l-4' : ''}`} style={{ borderLeftColor: isEdited ? borderColor : undefined }}>
      {/* Pre-flight flags */}
      {matchingFlags.length > 0 && (
        <div className="bg-orange-50 px-3 py-1.5 flex items-center gap-2 text-xs text-orange-700 border-b border-orange-100">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {matchingFlags.map((f, i) => <span key={i}>{f}</span>)}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {/* Source */}
        <div className="p-3 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-100">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Source · #{segment.segment_index + 1}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{segment.source_text}</p>
        </div>

        {/* AI Translation / Reviewer edit */}
        <div className="p-3">
          <p className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: isEdited ? '#1FA1D6' : '#9CA3AF' }}>
            {isEdited ? 'Edited' : 'AI translation'}
            {saving && <span className="ml-1 text-gray-400">(saving...)</span>}
          </p>
          {readOnly ? (
            <p className="text-sm text-gray-700 leading-relaxed">{segment.reviewer_translation ?? segment.ai_translation}</p>
          ) : (
            <textarea
              value={translation}
              onChange={e => setTranslation(e.target.value)}
              onBlur={saveSegment}
              className="w-full text-sm text-gray-700 leading-relaxed border-0 bg-transparent resize-none focus:outline-none focus:ring-0 min-h-[60px]"
              rows={Math.max(2, Math.ceil(translation.length / 80))}
            />
          )}
        </div>
      </div>

      {/* Controls */}
      {!readOnly && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          {/* Severity pills */}
          {(Object.entries(SEVERITY_CONFIG) as [Severity, typeof SEVERITY_CONFIG[Severity]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setSeverity(severity === key ? null : key); setTimeout(saveSegment, 0) }}
              className={`text-[10px] px-2 py-0.5 rounded transition ${severity === key ? 'ring-1 ring-offset-1' : 'opacity-60 hover:opacity-100'}`}
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </button>
          ))}

          <div className="flex-1" />

          <button
            onClick={() => setShowComment(!showComment)}
            className={`text-[10px] flex items-center gap-1 ${comment ? 'text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <MessageSquare className="w-3 h-3" />
            {comment ? 'Edit comment' : 'Add comment'}
          </button>
        </div>
      )}

      {/* Comment */}
      {showComment && !readOnly && (
        <div className="px-3 pb-3">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            onBlur={saveSegment}
            placeholder="Note for audit trail..."
            className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-gray-400"
            rows={2}
          />
        </div>
      )}

      {/* Read-only comment display */}
      {readOnly && segment.reviewer_comment && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500"><MessageSquare className="w-3 h-3 inline mr-1" />{segment.reviewer_comment}</p>
        </div>
      )}

      {/* Read-only severity display */}
      {readOnly && segment.severity && (
        <div className="px-3 py-1 bg-gray-50 border-t border-gray-100">
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: SEVERITY_CONFIG[segment.severity as Severity]?.bg, color: SEVERITY_CONFIG[segment.severity as Severity]?.color }}>
            {SEVERITY_CONFIG[segment.severity as Severity]?.label}
          </span>
        </div>
      )}
    </div>
  )
}
