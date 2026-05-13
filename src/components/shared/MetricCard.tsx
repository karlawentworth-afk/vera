interface MetricCardProps {
  label: string
  value: string
  unit?: string
  trend?: string
  color?: string
}

export function MetricCard({ label, value, unit, trend, color }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color || '#e5e7eb' }} />
      <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-light text-gray-900 mt-1">
        {value}{unit && <span className="text-sm text-gray-500"> {unit}</span>}
      </p>
      {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
    </div>
  )
}
