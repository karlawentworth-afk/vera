import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { inviteUser, resendInvite } from '../../lib/invite'
import { Drawer } from '../../components/shared/Drawer'
import { Plus, Eye, MessageSquare, FileText, Send } from 'lucide-react'

const TIER_COLORS: Record<string, string> = {
  Essentials: '#1FA1D6',
  Governance: '#8E2882',
  Embedded: '#E5187A',
}

export function AdminClients() {
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions-detail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, organisation:organisations(id, name)')
        .eq('status', 'active')
      if (error) throw error
      return data
    },
  })

  const { data: jobs } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('organisation_id, word_count, status')
      if (error) throw error
      return data
    },
  })

  const { data: scores } = useQuery({
    queryKey: ['admin-scores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('scores').select('job_id, hter_score')
      if (error) throw error
      return data
    },
  })

  const { data: allJobs } = useQuery({
    queryKey: ['admin-jobs-for-health'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('id, organisation_id')
      if (error) throw error
      return data
    },
  })

  // Client profiles for invite status
  const { data: clientProfiles } = useQuery({
    queryKey: ['admin-client-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, email, full_name, organisation_id, onboarding_completed_at, invited_at, created_at').eq('role', 'client')
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1,2,3].map(i => <div key={i} className="bg-white border border-gray-200 rounded-lg h-48 animate-pulse" />)}
      </div>
    )
  }

  const orgWordUsage: Record<string, number> = {}
  jobs?.forEach(j => {
    if (j.status !== 'cancelled') orgWordUsage[j.organisation_id] = (orgWordUsage[j.organisation_id] ?? 0) + j.word_count
  })

  const jobToOrg: Record<string, string> = {}
  allJobs?.forEach(j => { jobToOrg[j.id] = j.organisation_id })
  const orgScores: Record<string, number[]> = {}
  scores?.forEach(s => {
    const orgId = jobToOrg[s.job_id]
    if (orgId) { if (!orgScores[orgId]) orgScores[orgId] = []; orgScores[orgId].push(Number(s.hter_score)) }
  })

  const mrr = subscriptions?.reduce((sum, s) => sum + s.monthly_price_pence, 0) ?? 0

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{subscriptions?.length ?? 0} active clients · MRR £{(mrr / 100).toLocaleString()}</p>
          <button onClick={() => setShowInvite(true)} className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add client
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subscriptions?.map(sub => {
            const org = sub.organisation as { id: string; name: string }
            const color = TIER_COLORS[sub.tier_name] ?? '#1FA1D6'
            const wordsUsed = orgWordUsage[org.id] ?? 0
            const usagePct = sub.word_allowance ? (wordsUsed / sub.word_allowance) * 100 : 60
            const hterScores = orgScores[org.id] ?? []
            const avgHter = hterScores.length > 0 ? hterScores.reduce((a, b) => a + b, 0) / hterScores.length : 0
            const healthScore = hterScores.length > 0 ? Math.round((1 - avgHter) * 100) : null

            // Find client contact for this org
            const contact = clientProfiles?.find(p => p.organisation_id === org.id)
            const isInvited = contact && !contact.onboarding_completed_at
            const inviteDate = contact?.invited_at || contact?.created_at

            return (
              <div key={sub.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="h-1" style={{ background: color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-base font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{sub.tier_name} · £{(sub.monthly_price_pence / 100).toLocaleString()}/mo</p>
                      {contact && (
                        <p className="text-xs mt-1" style={{ color: isInvited ? '#EE7C24' : '#0F8F4D' }}>
                          {isInvited ? `Invited ${inviteDate ? new Date(inviteDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}` : `Active since ${inviteDate ? new Date(inviteDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}`}
                        </p>
                      )}
                    </div>
                    {healthScore !== null && (
                      <div className="text-right">
                        <p className="text-2xl font-light text-gray-900">{healthScore}</p>
                        <p className="text-xs text-gray-500">AI Health</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{wordsUsed.toLocaleString()} / {sub.word_allowance?.toLocaleString() ?? '∞'} words</span>
                      <span>{Math.round(usagePct)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${Math.min(usagePct, 100)}%`, background: usagePct > 90 ? '#EE7C24' : color }} />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                    <button className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"><Eye className="w-3 h-3" /> View</button>
                    <button className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Contact</button>
                    <button className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"><FileText className="w-3 h-3" /> Invoices</button>
                    {isInvited && contact?.email && (
                      <button
                        onClick={async () => {
                          const ok = await resendInvite(contact.email)
                          alert(ok ? `Invite resent to ${contact.email}` : 'Failed to resend')
                        }}
                        className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 ml-auto"
                      >
                        <Send className="w-3 h-3" /> Resend invite
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Drawer open={showInvite} onClose={() => setShowInvite(false)} title="Add client">
        <ClientInviteForm onSuccess={() => {
          setShowInvite(false)
          queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-detail'] })
          queryClient.invalidateQueries({ queryKey: ['admin-client-profiles'] })
        }} />
      </Drawer>
    </>
  )
}

function ClientInviteForm({ onSuccess }: { onSuccess: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [orgName, setOrgName] = useState('')
  const [tierName, setTierName] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { data: tiers } = useQuery({
    queryKey: ['tier-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tier_config').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    const result = await inviteUser({
      email,
      full_name: `${firstName} ${lastName}`.trim(),
      role: 'client',
      organisation_name: orgName,
      tier_name: tierName,
      job_title: jobTitle || undefined,
      personal_note: note || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      alert(`${orgName} onboarded. Welcome email sent to ${email}`)
      onSuccess()
    } else {
      setError(result.error || 'Failed to invite')
    }
  }

  const valid = firstName && email && orgName && tierName

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">First name</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Last name</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="james@springshot.com" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Job title (optional)</label>
        <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Head of Content" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Organisation name</label>
        <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Springshot Aviation" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Subscription tier</label>
        <select value={tierName} onChange={e => setTierName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400">
          <option value="">Select tier...</option>
          {tiers?.map(t => <option key={t.id} value={t.name}>{t.name} — £{(t.monthly_price_pence / 100).toLocaleString()}/mo</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Personal note from Emma (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Welcome aboard! Looking forward to working with your team..." className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-gray-400" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={handleSubmit} disabled={!valid || submitting} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
        {submitting ? 'Creating...' : 'Add client & send invite'}
      </button>
    </div>
  )
}
