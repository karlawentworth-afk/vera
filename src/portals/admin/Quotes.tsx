import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Drawer } from '../../components/shared/Drawer'
import { Plus, Send, CheckCircle, X, UserPlus } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', orange: '#EE7C24' }

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined'

const STATUS_TABS: { label: string; value: QuoteStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
]

function statusStyle(status: string) {
  switch (status) {
    case 'accepted': return { bg: COLORS.green + '20', color: COLORS.green }
    case 'sent': return { bg: COLORS.cyan + '20', color: COLORS.cyan }
    case 'declined': return { bg: '#f3f4f6', color: '#6b7280' }
    default: return { bg: '#f3f4f6', color: '#6b7280' }
  }
}

export function AdminQuotes() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<QuoteStatus | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['admin-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const filtered = quotes?.filter(q => activeTab === 'all' || q.status === activeTab) ?? []

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`text-sm px-3 py-1.5 rounded ${activeTab === tab.value ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowNew(true)} className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> New quote
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left py-3 px-4 font-medium">Quote</th>
                <th className="text-left py-3 px-4 font-medium">Prospect</th>
                <th className="text-left py-3 px-4 font-medium">Proposal</th>
                <th className="text-left py-3 px-4 font-medium">Tier</th>
                <th className="text-right py-3 px-4 font-medium">Monthly value</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Sent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-400">No quotes found</td></tr>
              )}
              {filtered.map(q => {
                const s = statusStyle(q.status)
                return (
                  <tr key={q.id} onClick={() => setSelectedQuoteId(q.id)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <td className="py-3 px-4 font-mono text-xs text-gray-400">{q.quote_number}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{q.prospect_name}</p>
                      {q.prospect_company && q.prospect_company !== q.prospect_name && (
                        <p className="text-xs text-gray-500">{q.prospect_company}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{q.proposal}</td>
                    <td className="py-3 px-4 text-gray-600">{q.proposed_tier || '—'}</td>
                    <td className="py-3 px-4 text-right font-medium">£{(q.monthly_value / 100).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>{q.status}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{q.sent_at ? new Date(q.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className="py-3 px-4 text-right text-xs text-gray-400">View →</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={showNew} onClose={() => setShowNew(false)} title="New quote">
        <NewQuoteForm
          profileId={profile!.id}
          onCreated={(id) => { setShowNew(false); setSelectedQuoteId(id) }}
        />
      </Drawer>

      <Drawer open={!!selectedQuoteId} onClose={() => setSelectedQuoteId(null)} title="Quote detail">
        {selectedQuoteId && (
          <QuoteDetail
            quoteId={selectedQuoteId}
            profileId={profile!.id}
            onClose={() => setSelectedQuoteId(null)}
          />
        )}
      </Drawer>
    </>
  )
}

// ============================================================
// New Quote Form
// ============================================================

function NewQuoteForm({ profileId, onCreated }: { profileId: string; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient()
  const [prospectName, setProspectName] = useState('')
  const [prospectEmail, setProspectEmail] = useState('')
  const [prospectCompany, setProspectCompany] = useState('')
  const [proposedTier, setProposedTier] = useState('')
  const [proposal, setProposal] = useState('')
  const [oneOffFee, setOneOffFee] = useState('')
  const [notes, setNotes] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [salespersonId, setSalespersonId] = useState('')

  const { data: tiers } = useQuery({
    queryKey: ['tier-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tier_config').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })

  const { data: salespeople } = useQuery({
    queryKey: ['salespeople-for-quote'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'salesperson').order('full_name')
      if (error) throw error
      return data
    },
  })

  const selectedTier = tiers?.find(t => t.name === proposedTier)
  const monthlyValue = selectedTier?.monthly_price_pence ?? 0

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          quote_number: '',
          prospect_name: prospectName,
          prospect_email: prospectEmail || null,
          prospect_company: prospectCompany || prospectName,
          proposed_tier: proposedTier || null,
          proposal: proposal || `${proposedTier} tier`,
          monthly_value: monthlyValue,
          one_off_fee_pence: oneOffFee ? Math.round(parseFloat(oneOffFee) * 100) : null,
          notes: notes || null,
          expiry_date: expiryDate || null,
          salesperson_id: salespersonId || null,
          status: 'draft',
        })
        .select('id')
        .single()
      if (error) throw error

      await supabase.from('audit_log').insert({
        actor_id: profileId,
        action: 'created_quote',
        entity_type: 'quote',
        entity_id: data.id,
        details: { prospect: prospectName, tier: proposedTier },
      })

      return data.id as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-quotes'] })
      onCreated(id)
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Contact name</label>
        <input type="text" value={prospectName} onChange={e => setProspectName(e.target.value)} placeholder="James Wright" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Email</label>
        <input type="email" value={prospectEmail} onChange={e => setProspectEmail(e.target.value)} placeholder="james@company.com" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Company</label>
        <input type="text" value={prospectCompany} onChange={e => setProspectCompany(e.target.value)} placeholder="Springshot Aviation" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Proposed tier</label>
        <select value={proposedTier} onChange={e => setProposedTier(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400">
          <option value="">Select tier...</option>
          {tiers?.map(t => <option key={t.id} value={t.name}>{t.name} — £{(t.monthly_price_pence / 100).toLocaleString()}/mo</option>)}
        </select>
        {selectedTier && <p className="text-xs text-gray-500 mt-1">{selectedTier.word_allowance ? `${selectedTier.word_allowance.toLocaleString()} words/mo` : 'Unlimited'} · £{(monthlyValue / 100).toLocaleString()}/mo</p>}
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Proposal summary</label>
        <input type="text" value={proposal} onChange={e => setProposal(e.target.value)} placeholder="Governance tier + onboarding" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">One-off fee (£, optional)</label>
          <input type="number" step="100" value={oneOffFee} onChange={e => setOneOffFee(e.target.value)} placeholder="e.g. 5000 for Health Check" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Expiry date</label>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Introducing salesperson (optional)</label>
        <select value={salespersonId} onChange={e => setSalespersonId(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400">
          <option value="">None</option>
          {salespeople?.map(sp => <option key={sp.id} value={sp.id}>{sp.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Internal notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for internal use..." className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-gray-400" />
      </div>

      {createMutation.isError && <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>}

      <button
        onClick={() => createMutation.mutate()}
        disabled={!prospectName || !proposedTier || createMutation.isPending}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
      >
        {createMutation.isPending ? 'Creating...' : 'Create quote'}
      </button>
    </div>
  )
}

// ============================================================
// Quote Detail
// ============================================================

function QuoteDetail({ quoteId, profileId, onClose }: { quoteId: string; profileId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [convertedOrgId, setConvertedOrgId] = useState<string | null>(null)

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote-detail', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('quotes').select('*').eq('id', quoteId).single()
      if (error) throw error
      return data
    },
  })

  const { data: tiers } = useQuery({
    queryKey: ['tier-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tier_config').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })

  const { data: salesperson } = useQuery({
    queryKey: ['quote-salesperson', quote?.salesperson_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, default_finders_fee_pct, default_recurring_pct').eq('id', quote!.salesperson_id).single()
      if (error) throw error
      return data
    },
    enabled: !!quote?.salesperson_id,
  })

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quoteId)
      if (error) throw error
      await supabase.from('audit_log').insert({ actor_id: profileId, action: 'sent_quote', entity_type: 'quote', entity_id: quoteId })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] }),
  })

  const declineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('quotes').update({ status: 'declined' }).eq('id', quoteId)
      if (error) throw error
      await supabase.from('audit_log').insert({ actor_id: profileId, action: 'declined_quote', entity_type: 'quote', entity_id: quoteId })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] }); queryClient.invalidateQueries({ queryKey: ['admin-quotes'] }) },
  })

  // Conversion: accept → create org + subscription + commission agreement
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const tier = tiers?.find(t => t.name === quote!.proposed_tier)
      if (!tier) throw new Error('Tier not found')

      // 1. Create organisation
      const { data: org, error: orgErr } = await supabase
        .from('organisations')
        .insert({
          name: quote!.prospect_company || quote!.prospect_name,
          type: 'client',
          introducing_salesperson_id: quote!.salesperson_id || null,
        })
        .select('id')
        .single()
      if (orgErr) throw orgErr

      // 2. Create subscription
      const periodStart = new Date(); periodStart.setDate(1); periodStart.setHours(0,0,0,0)
      const periodEnd = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth() + 1)

      const { error: subErr } = await supabase.from('subscriptions').insert({
        organisation_id: org.id,
        tier_name: tier.name,
        monthly_price_pence: tier.monthly_price_pence,
        word_allowance: tier.word_allowance,
        overflow_rate_pence: tier.overflow_rate_pence,
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      if (subErr) throw subErr

      // 3. Commission agreement if salesperson
      if (quote!.salesperson_id && salesperson) {
        const { error: commErr } = await supabase.from('commission_agreements').insert({
          salesperson_id: quote!.salesperson_id,
          organisation_id: org.id,
          finders_fee_pct: salesperson.default_finders_fee_pct || null,
          recurring_commission_pct: salesperson.default_recurring_pct || 10,
          starts_at: new Date().toISOString().split('T')[0],
          status: 'active',
        })
        if (commErr) console.error('Commission agreement error:', commErr)
      }

      // 4. Update quote
      const { error: qErr } = await supabase.from('quotes').update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        converted_to_organisation_id: org.id,
      }).eq('id', quoteId)
      if (qErr) throw qErr

      // 5. Audit
      await supabase.from('audit_log').insert({
        actor_id: profileId,
        action: 'accepted_quote_and_converted',
        entity_type: 'quote',
        entity_id: quoteId,
        details: { organisation_id: org.id, tier: tier.name, salesperson_id: quote!.salesperson_id },
      })

      setConvertedOrgId(org.id)
      setInviteEmail(quote!.prospect_email || '')
      setInviteName(quote!.prospect_name || '')
      return org.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] })
      queryClient.invalidateQueries({ queryKey: ['admin-quotes'] })
      setShowConvertModal(true)
    },
  })

  // Invite client user after conversion
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!convertedOrgId || !inviteEmail) throw new Error('Missing data')
      // This needs the admin API — will fail from browser. Show instructions instead.
      throw new Error(`Create user in Supabase Auth dashboard:\nEmail: ${inviteEmail}\nThen add profile: role=client, org=${convertedOrgId}`)
    },
  })

  if (isLoading || !quote) return <div className="animate-pulse h-48 bg-gray-100 rounded" />

  const isDraft = quote.status === 'draft'
  const isSent = quote.status === 'sent'
  const s = statusStyle(quote.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-gray-400">{quote.quote_number}</span>
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>{quote.status}</span>
      </div>

      <div className="space-y-3">
        <div><p className="text-xs text-gray-500">Prospect</p><p className="text-sm font-medium text-gray-900">{quote.prospect_name}</p></div>
        {quote.prospect_company && <div><p className="text-xs text-gray-500">Company</p><p className="text-sm text-gray-900">{quote.prospect_company}</p></div>}
        {quote.prospect_email && <div><p className="text-xs text-gray-500">Email</p><p className="text-sm text-gray-900">{quote.prospect_email}</p></div>}
        <div><p className="text-xs text-gray-500">Proposal</p><p className="text-sm text-gray-900">{quote.proposal}</p></div>
        {quote.proposed_tier && <div><p className="text-xs text-gray-500">Proposed tier</p><p className="text-sm text-gray-900">{quote.proposed_tier} — £{(quote.monthly_value / 100).toLocaleString()}/mo</p></div>}
        {quote.one_off_fee_pence && <div><p className="text-xs text-gray-500">One-off fee</p><p className="text-sm text-gray-900">£{(quote.one_off_fee_pence / 100).toLocaleString()}</p></div>}
        {quote.expiry_date && <div><p className="text-xs text-gray-500">Expires</p><p className="text-sm text-gray-900">{new Date(quote.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>}
        {salesperson && <div><p className="text-xs text-gray-500">Introducing salesperson</p><p className="text-sm text-gray-900">{salesperson.full_name}</p></div>}
        {quote.notes && <div><p className="text-xs text-gray-500">Notes</p><p className="text-sm text-gray-700">{quote.notes}</p></div>}
        {quote.sent_at && <div><p className="text-xs text-gray-500">Sent</p><p className="text-sm text-gray-900">{new Date(quote.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>}
        {quote.accepted_at && <div><p className="text-xs text-gray-500">Accepted</p><p className="text-sm text-gray-900">{new Date(quote.accepted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>}
        {quote.converted_to_organisation_id && <div><p className="text-xs text-gray-500">Converted to organisation</p><p className="text-sm font-medium" style={{ color: COLORS.green }}>Onboarded</p></div>}
      </div>

      <RainbowStripe height={2} />

      {/* Actions */}
      {isDraft && (
        <div className="flex gap-3">
          <button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> {sendMutation.isPending ? 'Sending...' : 'Mark as sent'}
          </button>
        </div>
      )}

      {isSent && (
        <div className="flex gap-3">
          <button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending} className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> {acceptMutation.isPending ? 'Converting...' : 'Accept & convert'}
          </button>
          <button onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2">
            <X className="w-4 h-4" /> Decline
          </button>
        </div>
      )}

      {acceptMutation.isError && <p className="text-sm text-red-600">{(acceptMutation.error as Error).message}</p>}

      {/* Convert modal — invite client user */}
      {showConvertModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => { setShowConvertModal(false); onClose() }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-2 mb-4" style={{ color: COLORS.green }}>
                <CheckCircle className="w-5 h-5" />
                <h3 className="text-base font-medium text-gray-900">Quote converted</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                <span className="font-medium text-gray-900">{quote.prospect_company || quote.prospect_name}</span> has been onboarded with a <span className="font-medium">{quote.proposed_tier}</span> subscription.
                {salesperson && <span> Commission agreement created for {salesperson.full_name}.</span>}
              </p>

              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Invite client user</p>
                <div className="space-y-3">
                  <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                </div>
                <button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteEmail || inviteMutation.isPending}
                  className="mt-3 w-full bg-gray-900 text-white rounded py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Send invite
                </button>
                {inviteMutation.isError && <p className="mt-2 text-xs text-orange-600">{(inviteMutation.error as Error).message}</p>}
              </div>

              <button onClick={() => { setShowConvertModal(false); queryClient.invalidateQueries(); onClose() }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                Skip for now
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
