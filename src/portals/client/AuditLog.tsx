import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useClientOrgId } from '../../lib/useClientOrg'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { ChevronDown, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 30

export function ClientAuditLog() {
  const orgId = useClientOrgId()
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Get job IDs for this org to filter audit entries
  const { data: jobIds } = useQuery({
    queryKey: ['client-job-ids', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('id').eq('organisation_id', orgId!)
      if (error) throw error
      return data.map(j => j.id)
    },
    enabled: !!orgId,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['client-audit-log', orgId, page, jobIds],
    queryFn: async () => {
      if (!jobIds || jobIds.length === 0) return { rows: [], total: 0 }
      const { data, error, count } = await supabase
        .from('audit_log')
        .select('*, actor:profiles!audit_log_actor_id_fkey(full_name, role)', { count: 'exact' })
        .eq('entity_type', 'job')
        .in('entity_id', jobIds)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data, total: count ?? 0 }
    },
    enabled: !!jobIds,
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Audit log</p>
        <h2 className="text-xl font-light text-gray-900 mt-1">Activity on your jobs</h2>
        <p className="text-sm text-gray-500 mt-1">{total} entries — every action recorded for governance compliance</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        {isLoading ? (
          <div className="h-64 animate-pulse" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left py-3 px-4 font-medium w-8"></th>
                <th className="text-left py-3 px-4 font-medium">When</th>
                <th className="text-left py-3 px-4 font-medium">Who</th>
                <th className="text-left py-3 px-4 font-medium">Action</th>
                <th className="text-left py-3 px-4 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">No audit entries yet</td></tr>
              )}
              {rows.map(row => {
                const actor = row.actor as { full_name: string; role: string } | null
                const isExpanded = expandedId === row.id
                return (
                  <>
                    <tr key={row.id} onClick={() => setExpandedId(isExpanded ? null : row.id)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                      <td className="py-2 px-4">
                        {row.details ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />) : null}
                      </td>
                      <td className="py-2 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-4 text-gray-900">{actor?.full_name ?? '—'}</td>
                      <td className="py-2 px-4"><span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">{row.action}</span></td>
                      <td className="py-2 px-4 text-xs text-gray-500 max-w-xs truncate">
                        {row.details ? Object.entries(row.details as Record<string, unknown>).filter(([,v]) => v != null).map(([k,v]) => `${k}: ${v}`).join(', ') : '—'}
                      </td>
                    </tr>
                    {isExpanded && row.details && (
                      <tr key={`${row.id}-d`} className="bg-gray-50">
                        <td></td>
                        <td colSpan={4} className="py-3 px-4">
                          <pre className="text-xs text-gray-700 bg-white rounded border border-gray-100 p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(row.details, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  )
}
