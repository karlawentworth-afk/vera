import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Drawer } from '../../components/shared/Drawer'
import { CheckCircle, AlertTriangle, X } from 'lucide-react'
import { sendEmail } from '../../lib/email'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', orange: '#EE7C24', red: '#D9211E' }
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f3f4f6', color: '#6b7280' }, submitted: { bg: COLORS.cyan + '20', color: COLORS.cyan },
  approved: { bg: COLORS.green + '20', color: COLORS.green }, paid: { bg: COLORS.green + '20', color: COLORS.green },
  queried: { bg: COLORS.orange + '20', color: COLORS.orange }, rejected: { bg: COLORS.red + '20', color: COLORS.red },
}

export function AdminReviewerInvoices() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('submitted')

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['admin-reviewer-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('reviewer_invoices').select('*, reviewer:profiles!reviewer_invoices_reviewer_id_fkey(full_name, email)').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const filtered = invoices?.filter(inv => !statusFilter || inv.status === statusFilter) ?? []
  const selected = invoices?.find(inv => inv.id === selectedId)

  const approveMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.from('reviewer_invoices').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: profile!.id }).eq('id', invoiceId)
      if (error) throw error
      const inv = invoices?.find(i => i.id === invoiceId)
      if (inv) {
        await supabase.from('audit_log').insert({ actor_id: profile!.id, action: 'reviewer_invoice_approved', entity_type: 'reviewer_invoice', entity_id: inv.reference, details: { total: inv.total_pence } })
        const reviewer = inv.reviewer as { email: string }
        if (reviewer?.email) sendEmail({ to: reviewer.email, template: 'job_delivered_client', data: { job_number: inv.reference, hter_score: 'Approved', health_score: `£${(inv.total_pence / 100).toLocaleString()}` } })
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-reviewer-invoices'] }); setSelectedId(null) },
  })

  const [queryNotes, setQueryNotes] = useState('')
  const queryMutation = useMutation({
    mutationFn: async ({ invoiceId, notes }: { invoiceId: string; notes: string }) => {
      const { error } = await supabase.from('reviewer_invoices').update({ status: 'queried', admin_notes: notes, queried_at: new Date().toISOString() }).eq('id', invoiceId)
      if (error) throw error
      await supabase.from('audit_log').insert({ actor_id: profile!.id, action: 'reviewer_invoice_queried', entity_type: 'reviewer_invoice', entity_id: invoiceId, details: { notes } })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-reviewer-invoices'] }); setSelectedId(null); setQueryNotes('') },
  })

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const pendingCount = invoices?.filter(i => i.status === 'submitted').length ?? 0
  const pendingTotal = invoices?.filter(i => i.status === 'submitted').reduce((s, i) => s + i.total_pence, 0) ?? 0

  return (
    <>
      <div className="space-y-4">
        {pendingCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <p className="text-sm text-gray-900">{pendingCount} reviewer invoice{pendingCount > 1 ? 's' : ''} awaiting approval — £{(pendingTotal / 100).toLocaleString()} total</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {['', 'submitted', 'approved', 'paid', 'queried', 'rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-sm px-3 py-1.5 rounded ${statusFilter === s ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
              {s || 'All'}{s === 'submitted' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Reference</th>
                  <th className="text-left py-3 px-4 font-medium">Reviewer</th>
                  <th className="text-left py-3 px-4 font-medium">Period</th>
                  <th className="text-right py-3 px-4 font-medium">Jobs</th>
                  <th className="text-right py-3 px-4 font-medium">Total</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No invoices</td></tr>}
                {filtered.map(inv => {
                  const reviewer = inv.reviewer as { full_name: string }
                  const st = STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft
                  return (
                    <tr key={inv.id} onClick={() => setSelectedId(inv.id)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                      <td className="py-3 px-4 font-mono text-xs text-gray-400">{inv.reference}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{reviewer?.full_name}</td>
                      <td className="py-3 px-4 text-gray-600">{new Date(inv.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td>
                      <td className="py-3 px-4 text-right">{(inv.line_items as unknown[])?.length ?? 0}</td>
                      <td className="py-3 px-4 text-right font-medium">£{(inv.total_pence / 100).toLocaleString()}</td>
                      <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded" style={{ background: st.bg, color: st.color }}>{inv.status}</span></td>
                      <td className="py-3 px-4 text-xs text-gray-500">{inv.submitted_at ? new Date(inv.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Drawer open={!!selectedId} onClose={() => setSelectedId(null)} title={selected?.reference ?? 'Invoice'}>
        {selected && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500">{(selected.reviewer as { full_name: string })?.full_name}</p>
              <p className="text-xs text-gray-400">{new Date(selected.period_start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-medium flex">
                <span className="flex-1">Job</span><span className="w-20">Client</span><span className="w-16 text-right">Words</span><span className="w-20 text-right">Amount</span>
              </div>
              {(selected.line_items as Array<{ reference: string; client: string; words: number; amount: number }>)?.map((l, i) => (
                <div key={i} className="px-3 py-2 flex text-sm border-t border-gray-50">
                  <span className="flex-1 font-mono text-xs text-gray-400">{l.reference}</span>
                  <span className="w-20 text-gray-600 truncate">{l.client}</span>
                  <span className="w-16 text-right text-gray-600">{l.words?.toLocaleString()}</span>
                  <span className="w-20 text-right font-medium">£{(l.amount / 100).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>£{(selected.amount_pence / 100).toLocaleString()}</span></div>
              {selected.vat_pence > 0 && <div className="flex justify-between"><span className="text-gray-500">VAT</span><span>£{(selected.vat_pence / 100).toLocaleString()}</span></div>}
              <div className="flex justify-between font-medium pt-2 border-t border-gray-100"><span>Total</span><span>£{(selected.total_pence / 100).toLocaleString()}</span></div>
            </div>

            {selected.reviewer_notes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Reviewer note</p>
                <p className="text-sm text-gray-700">{selected.reviewer_notes}</p>
              </div>
            )}

            {selected.status === 'submitted' && (
              <div className="space-y-3">
                <button onClick={() => approveMutation.mutate(selected.id)} disabled={approveMutation.isPending}
                  className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {approveMutation.isPending ? 'Approving...' : 'Approve invoice'}
                </button>
                <details>
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Query or reject...</summary>
                  <div className="mt-2 space-y-2">
                    <textarea value={queryNotes} onChange={e => setQueryNotes(e.target.value)} placeholder="What needs clarifying?" className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-16 focus:outline-none focus:border-gray-400" />
                    <div className="flex gap-2">
                      <button onClick={() => queryMutation.mutate({ invoiceId: selected.id, notes: queryNotes })} disabled={!queryNotes || queryMutation.isPending}
                        className="flex-1 border border-orange-200 text-orange-700 rounded py-2 text-sm hover:bg-orange-50 disabled:opacity-50 flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Query
                      </button>
                      <button onClick={() => queryMutation.mutate({ invoiceId: selected.id, notes: queryNotes })} disabled={!queryNotes || queryMutation.isPending}
                        className="flex-1 border border-red-200 text-red-700 rounded py-2 text-sm hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}
