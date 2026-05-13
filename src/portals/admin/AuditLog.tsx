import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Download, ChevronDown, ChevronRight, Search } from 'lucide-react'

const COLORS = {
  admin: '#8E2882', client: '#1FA1D6', reviewer: '#0F8F4D', salesperson: '#EE7C24',
}

const PAGE_SIZE = 50

const ACTION_OPTIONS = [
  'job_created', 'job_allocated', 'job_delivered', 'score_submitted',
  'subscription_created', 'organisation_created', 'user_invited',
  'created', 'allocated', 'signed_off', 'submitted_for_signoff',
  'created_quote', 'sent_quote', 'accepted_quote_and_converted',
  'updated_pricing', 'invited_salesperson', 'submitted_job',
]

const ENTITY_OPTIONS = ['job', 'score', 'subscription', 'organisation', 'profile', 'quote', 'pricing']

export function AdminAuditLog() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: actors } = useQuery({
    queryKey: ['audit-actors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page, actionFilter, entityFilter, actorFilter, search],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*, actor:profiles!audit_log_actor_id_fkey(full_name, role)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (actionFilter) query = query.eq('action', actionFilter)
      if (entityFilter) query = query.eq('entity_type', entityFilter)
      if (actorFilter) query = query.eq('actor_id', actorFilter)
      if (search) query = query.or(`action.ilike.%${search}%,entity_id.ilike.%${search}%`)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data, total: count ?? 0 }
    },
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function exportCsv() {
    if (!rows.length) return
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Details']
    const csvRows = rows.map(r => {
      const actor = r.actor as { full_name: string; role: string } | null
      return [
        new Date(r.created_at).toISOString(),
        actor?.full_name ?? '—',
        actor?.role ?? '—',
        r.action,
        r.entity_type,
        r.entity_id,
        JSON.stringify(r.details ?? {}),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vera-audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatDetails(details: Record<string, unknown> | null): string {
    if (!details) return '—'
    return Object.entries(details)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search actions, entity IDs..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
          />
        </div>
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0) }} className="text-sm border border-gray-200 rounded px-3 py-1.5">
          <option value="">All actions</option>
          {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(0) }} className="text-sm border border-gray-200 rounded px-3 py-1.5">
          <option value="">All entities</option>
          {ENTITY_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={actorFilter} onChange={e => { setActorFilter(e.target.value); setPage(0) }} className="text-sm border border-gray-200 rounded px-3 py-1.5">
          <option value="">All actors</option>
          {actors?.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.role})</option>)}
        </select>
        <button onClick={exportCsv} className="text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="text-xs text-gray-400">{total} entries{totalPages > 1 ? ` · Page ${page + 1} of ${totalPages}` : ''}</div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        {isLoading ? (
          <div className="h-96 animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-3 px-4 font-medium w-8"></th>
                  <th className="text-left py-3 px-4 font-medium">Timestamp</th>
                  <th className="text-left py-3 px-4 font-medium">Actor</th>
                  <th className="text-left py-3 px-4 font-medium">Action</th>
                  <th className="text-left py-3 px-4 font-medium">Entity</th>
                  <th className="text-left py-3 px-4 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No audit entries found</td></tr>
                )}
                {rows.map(row => {
                  const actor = row.actor as { full_name: string; role: string } | null
                  const isExpanded = expandedId === row.id
                  const roleColor = COLORS[actor?.role as keyof typeof COLORS] ?? '#6B7280'

                  return (
                    <>
                      <tr
                        key={row.id}
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="py-2 px-4">
                          {row.details ? (
                            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          ) : <span className="w-3.5" />}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{actor?.full_name ?? '—'}</span>
                            {actor?.role && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: roleColor + '20', color: roleColor }}>
                                {actor.role}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">{row.action}</span>
                        </td>
                        <td className="py-2 px-4 text-gray-600">
                          <span className="text-xs">{row.entity_type}</span>
                          <span className="text-xs font-mono text-gray-400 ml-1">{row.entity_id.substring(0, 8)}...</span>
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-500 max-w-xs truncate">
                          {formatDetails(row.details)}
                        </td>
                      </tr>
                      {isExpanded && row.details && (
                        <tr key={`${row.id}-details`} className="bg-gray-50">
                          <td></td>
                          <td colSpan={5} className="py-3 px-4">
                            <pre className="text-xs text-gray-700 bg-white rounded border border-gray-100 p-3 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(row.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-sm border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
