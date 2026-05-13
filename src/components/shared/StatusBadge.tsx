import type { JobStatus } from '../../types/database'

const STATUS_CONFIG: Record<JobStatus, { bg: string; color: string; label: string }> = {
  unallocated: { bg: '#D9211E20', color: '#D9211E', label: 'Unallocated' },
  in_review: { bg: '#1FA1D620', color: '#1FA1D6', label: 'In review' },
  awaiting_signoff: { bg: '#EE7C2420', color: '#EE7C24', label: 'Awaiting signoff' },
  delivered: { bg: '#0F8F4D20', color: '#0F8F4D', label: 'Delivered' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled' },
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span
      className="text-xs px-2 py-0.5 rounded inline-block"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}
