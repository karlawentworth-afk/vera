import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Drawer } from '../../components/shared/Drawer'
import { Plus, Send, AlertTriangle } from 'lucide-react'
import { sendEmail } from '../../lib/email'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', orange: '#EE7C24', red: '#D9211E' }

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f3f4f6', color: '#6b7280' },
  submitted: { bg: COLORS.cyan + '20', color: COLORS.cyan },
  approved: { bg: COLORS.green + '20', color: COLORS.green },
  paid: { bg: COLORS.green + '20', color: COLORS.green },
  queried: { bg: COLORS.orange + '20', color: COLORS.orange },
  rejected: { bg: COLORS.red + '20', color: COLORS.red },
}

export function ReviewerInvoices() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['reviewer-invoices', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('reviewer_invoices').select('*').eq('reviewer_id', profile!.id).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const filtered = invoices?.filter(inv => !statusFilter || inv.status === statusFilter) ?? []

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            {['', 'draft', 'submitted', 'approved', 'paid', 'queried'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-sm px-3 py-1.5 rounded ${statusFilter === s ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Create invoice
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-4 sm:p-6">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No invoices{statusFilter ? ` with status "${statusFilter}"` : ''}. Create your first invoice above.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(inv => {
                  const st = STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-3 border border-gray-100 rounded">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-400">{inv.reference}</span>
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: st.bg, color: st.color }}>{inv.status}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {new Date(inv.period_start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · {(inv.line_items as unknown[])?.length ?? 0} jobs · £{(inv.total_pence / 100).toLocaleString()}
                        </p>
                        {inv.status === 'queried' && inv.admin_notes && (
                          <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{inv.admin_notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-light text-gray-900">£{(inv.total_pence / 100).toLocaleString()}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Drawer open={showCreate} onClose={() => setShowCreate(false)} title="Create invoice">
        <CreateInvoiceForm profileId={profile!.id} rate={Number(profile?.rate_per_word ?? 0)} onCreated={() => {
          setShowCreate(false)
          queryClient.invalidateQueries({ queryKey: ['reviewer-invoices'] })
        }} />
      </Drawer>
    </>
  )
}

function CreateInvoiceForm({ profileId, rate, onCreated }: { profileId: string; rate: number; onCreated: () => void }) {
  const now = new Date()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)

  const [notes, setNotes] = useState('')
  const [includeVat, setIncludeVat] = useState(false)
  const [vatRate, setVatRate] = useState('20')

  // Get delivered jobs for last month not yet invoiced
  const { data: availableJobs } = useQuery({
    queryKey: ['reviewer-uninvoiced-jobs', profileId],
    queryFn: async () => {
      const { data: jobs, error } = await supabase.from('jobs')
        .select('id, job_number, word_count, content_type, source_language, target_language, delivered_at, organisation:organisations(name)')
        .eq('reviewer_id', profileId).eq('status', 'delivered')
        .gte('delivered_at', lastMonthStart.toISOString())
        .lt('delivered_at', lastMonthEnd.toISOString())
      if (error) throw error

      // Filter out jobs already on invoices
      const { data: existing } = await supabase.from('reviewer_invoices').select('job_ids').eq('reviewer_id', profileId)
      const invoicedIds = new Set((existing ?? []).flatMap(inv => inv.job_ids ?? []))
      return jobs.filter(j => !invoicedIds.has(j.id))
    },
  })

  const lineItems = availableJobs?.map(j => ({
    job_id: j.id,
    reference: j.job_number,
    client: (j.organisation as unknown as { name: string })?.name ?? '—',
    languages: `${j.source_language} → ${j.target_language}`,
    words: j.word_count,
    rate,
    amount: Math.round(j.word_count * rate * 100),
  })) ?? []

  const subtotal = lineItems.reduce((s, l) => s + l.amount, 0)
  const vat = includeVat ? Math.round(subtotal * parseFloat(vatRate) / 100) : 0
  const total = subtotal + vat

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('reviewer_invoices').insert({
        reference: '',
        reviewer_id: profileId,
        period_start: lastMonthStart.toISOString().split('T')[0],
        period_end: lastMonthEnd.toISOString().split('T')[0],
        amount_pence: subtotal,
        vat_pence: vat,
        total_pence: total,
        job_ids: lineItems.map(l => l.job_id),
        line_items: lineItems,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        reviewer_notes: notes || null,
      }).select('reference').single()
      if (error) throw error

      await supabase.from('audit_log').insert({
        actor_id: profileId, action: 'reviewer_invoice_submitted', entity_type: 'reviewer_invoice', entity_id: data.reference,
        details: { total_pence: total, jobs: lineItems.length },
      })

      // Email Emma
      sendEmail({ to: 'emma@ecls-translations.com', template: 'job_submitted_client', data: {
        job_number: data.reference, content_type: `£${(total / 100).toLocaleString()} covering ${lineItems.length} jobs`,
        source_lang: lastMonthStart.toLocaleDateString('en-GB', { month: 'long' }), target_lang: '', word_count: '', urgency: 'standard',
      }})
    },
    onSuccess: onCreated,
  })

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Period</p>
        <p className="text-sm text-gray-900">{lastMonthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 font-medium flex">
          <span className="flex-1">Job</span><span className="w-16 text-right">Words</span><span className="w-20 text-right">Amount</span>
        </div>
        {lineItems.length === 0 ? (
          <p className="p-4 text-sm text-gray-400 text-center">No uninvoiced delivered jobs for this period.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {lineItems.map(l => (
              <div key={l.job_id} className="px-3 py-2 flex text-sm">
                <div className="flex-1"><span className="font-mono text-xs text-gray-400 mr-1">{l.reference}</span><span className="text-gray-700">{l.client}</span></div>
                <span className="w-16 text-right text-gray-600">{l.words.toLocaleString()}</span>
                <span className="w-20 text-right font-medium">£{(l.amount / 100).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>£{(subtotal / 100).toLocaleString()}</span></div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-gray-500">
            <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} className="rounded" />
            VAT
          </label>
          {includeVat && (
            <div className="flex items-center gap-1">
              <input type="number" value={vatRate} onChange={e => setVatRate(e.target.value)} className="w-14 border border-gray-200 rounded px-2 py-1 text-sm text-right" />
              <span className="text-gray-500">%</span>
              <span className="ml-2">£{(vat / 100).toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-medium pt-2 border-t border-gray-100"><span>Total</span><span>£{(total / 100).toLocaleString()}</span></div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Note to Emma (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this invoice..." className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-16 focus:outline-none focus:border-gray-400" />
      </div>

      {submitMutation.isError && <p className="text-sm text-red-600">{(submitMutation.error as Error).message}</p>}

      <button onClick={() => submitMutation.mutate()} disabled={lineItems.length === 0 || submitMutation.isPending}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
        <Send className="w-4 h-4" /> {submitMutation.isPending ? 'Submitting...' : 'Submit invoice'}
      </button>
    </div>
  )
}
