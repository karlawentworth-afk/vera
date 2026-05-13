import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { RainbowStripe } from './RainbowStripe'

const SEVERITY_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  fine: { bg: '#0F8F4D20', color: '#0F8F4D', label: 'Fine' },
  minor: { bg: '#1FA1D620', color: '#1FA1D6', label: 'Minor edit' },
  major: { bg: '#EE7C2420', color: '#EE7C24', label: 'Major edit' },
  critical: { bg: '#D9211E20', color: '#D9211E', label: 'Critical edit' },
}

export function SegmentDiffView({ jobId }: { jobId: string }) {
  const { data: segments, isLoading } = useQuery({
    queryKey: ['job-segments-diff', jobId],
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

  if (isLoading) return <div className="h-24 bg-gray-100 rounded animate-pulse" />
  if (!segments || segments.length === 0) return null

  const totalSegments = segments.length
  const editedSegments = segments.filter(s => s.edited)
  const criticalCount = segments.filter(s => s.severity === 'critical').length
  const majorCount = segments.filter(s => s.severity === 'major').length
  const minorCount = segments.filter(s => s.severity === 'minor').length

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <RainbowStripe height={3} />
      <div className="p-4 sm:p-6">
        <h3 className="font-medium text-gray-900 mb-1">Segment review</h3>
        <p className="text-sm text-gray-500 mb-4">
          Out of {totalSegments} segments, {editedSegments.length} needed editing
          {criticalCount > 0 && <span> — <span style={{ color: '#D9211E' }}>{criticalCount} critical</span></span>}
          {majorCount > 0 && <span>, <span style={{ color: '#EE7C24' }}>{majorCount} major</span></span>}
          {minorCount > 0 && <span>, <span style={{ color: '#1FA1D6' }}>{minorCount} minor</span></span>}
          .
        </p>

        <div className="space-y-2">
          {segments.filter(s => s.edited).map(seg => (
            <div key={seg.id} className="border border-gray-100 rounded p-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Source</p>
                  <p className="text-gray-600">{seg.source_text}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">AI translation</p>
                  <p className="text-gray-600 line-through opacity-60">{seg.ai_translation}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: '#1FA1D6' }}>Verified</p>
                  <p className="text-gray-900">{seg.reviewer_translation}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {seg.severity && (
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: SEVERITY_COLORS[seg.severity]?.bg, color: SEVERITY_COLORS[seg.severity]?.color }}>
                    {SEVERITY_COLORS[seg.severity]?.label}
                  </span>
                )}
                {seg.reviewer_comment && <span className="text-xs text-gray-500">{seg.reviewer_comment}</span>}
              </div>
            </div>
          ))}
          {editedSegments.length === 0 && (
            <p className="text-sm text-gray-400 py-2 text-center">No segments were edited — AI output was approved as-is.</p>
          )}
        </div>
      </div>
    </div>
  )
}
