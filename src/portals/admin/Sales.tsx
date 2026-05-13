import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { inviteUser } from '../../lib/invite'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Drawer } from '../../components/shared/Drawer'
import { MetricCard } from '../../components/shared/MetricCard'
import { Plus, ChevronRight, UserPlus } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A', orange: '#EE7C24' }

export function AdminSales() {
  const queryClient = useQueryClient()
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteDefaultFinders, setInviteDefaultFinders] = useState('5')
  const [inviteDefaultRecurring, setInviteDefaultRecurring] = useState('10')

  const { data: salespeople, isLoading } = useQuery({
    queryKey: ['admin-salespeople'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'salesperson')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  const { data: agreements } = useQuery({
    queryKey: ['admin-agreements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agreements')
        .select('*, organisation:organisations(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: payouts } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_payouts')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const result = await inviteUser({
        email: inviteEmail,
        full_name: inviteName,
        role: 'salesperson',
        default_finders_fee_pct: parseFloat(inviteDefaultFinders) || undefined,
        default_recurring_pct: parseFloat(inviteDefaultRecurring) || undefined,
      })
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-salespeople'] })
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
    },
  })

  // Aggregate stats per salesperson
  const salespersonStats: Record<string, { activeAgreements: number; ytdEarned: number; owedThisMonth: number }> = {}
  salespeople?.forEach(sp => {
    const spAgreements = agreements?.filter(a => a.salesperson_id === sp.id) ?? []
    const activeCount = spAgreements.filter(a => a.status === 'active').length
    const spPayouts = payouts?.filter(p => p.salesperson_id === sp.id) ?? []
    const ytdEarned = spPayouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount_pence, 0)
    const owedThisMonth = spPayouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount_pence, 0)
    salespersonStats[sp.id] = { activeAgreements: activeCount, ytdEarned, owedThisMonth }
  })

  const totalActiveAgreements = agreements?.filter(a => a.status === 'active').length ?? 0
  const totalYtdEarned = payouts?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount_pence, 0) ?? 0
  const totalOwed = payouts?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount_pence, 0) ?? 0

  // Selected salesperson detail
  const selectedSp = salespeople?.find(sp => sp.id === selectedSalespersonId)
  const selectedAgreements = agreements?.filter(a => a.salesperson_id === selectedSalespersonId) ?? []

  if (isLoading) {
    return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Salespeople" value={String(salespeople?.length ?? 0)} trend={`${totalActiveAgreements} active agreements`} color={COLORS.purple} />
          <MetricCard label="Active agreements" value={String(totalActiveAgreements)} color={COLORS.cyan} />
          <MetricCard label="YTD earned" value={`£${(totalYtdEarned / 100).toLocaleString()}`} color={COLORS.green} />
          <MetricCard label="Owed this month" value={`£${(totalOwed / 100).toLocaleString()}`} color={COLORS.orange} />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{salespeople?.length ?? 0} salespeople</p>
          <button
            onClick={() => setShowInvite(true)}
            className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Add salesperson
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-right py-3 px-4 font-medium">Active agreements</th>
                  <th className="text-right py-3 px-4 font-medium">Default finder's %</th>
                  <th className="text-right py-3 px-4 font-medium">Default recurring %</th>
                  <th className="text-right py-3 px-4 font-medium">YTD earned</th>
                  <th className="text-right py-3 px-4 font-medium">Owed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {salespeople?.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-400">No salespeople yet. Click "Add salesperson" to get started.</td></tr>
                )}
                {salespeople?.map(sp => {
                  const stats = salespersonStats[sp.id] ?? { activeAgreements: 0, ytdEarned: 0, owedThisMonth: 0 }
                  return (
                    <tr
                      key={sp.id}
                      onClick={() => setSelectedSalespersonId(sp.id)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">{sp.full_name}</td>
                      <td className="py-3 px-4 text-gray-500">{sp.email}</td>
                      <td className="py-3 px-4 text-right">{stats.activeAgreements}</td>
                      <td className="py-3 px-4 text-right">{sp.default_finders_fee_pct ? `${sp.default_finders_fee_pct}%` : '—'}</td>
                      <td className="py-3 px-4 text-right">{sp.default_recurring_pct ? `${sp.default_recurring_pct}%` : '—'}</td>
                      <td className="py-3 px-4 text-right font-medium">£{(stats.ytdEarned / 100).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium">£{(stats.owedThisMonth / 100).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right"><ChevronRight className="w-4 h-4 text-gray-400" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Salesperson detail drawer */}
      <Drawer
        open={!!selectedSalespersonId}
        onClose={() => setSelectedSalespersonId(null)}
        title={selectedSp?.full_name ?? 'Salesperson'}
      >
        {selectedSp && (
          <SalespersonDetail
            salesperson={selectedSp}
            agreements={selectedAgreements}
            payouts={payouts?.filter(p => p.salesperson_id === selectedSp.id) ?? []}
          />
        )}
      </Drawer>

      {/* Invite drawer */}
      <Drawer open={showInvite} onClose={() => setShowInvite(false)} title="Add salesperson">
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Full name</label>
            <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" placeholder="Sarah Palmer" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" placeholder="sarah@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Default finder's fee %</label>
              <input type="number" step="0.5" value={inviteDefaultFinders} onChange={e => setInviteDefaultFinders(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Default recurring %</label>
              <input type="number" step="0.5" value={inviteDefaultRecurring} onChange={e => setInviteDefaultRecurring(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
            </div>
          </div>
          {inviteMutation.isError && (
            <p className="text-sm text-red-600">{(inviteMutation.error as Error).message}</p>
          )}
          <button
            onClick={() => inviteMutation.mutate()}
            disabled={!inviteName || !inviteEmail || inviteMutation.isPending}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {inviteMutation.isPending ? 'Creating...' : 'Add salesperson'}
          </button>
        </div>
      </Drawer>
    </>
  )
}

// ============================================================
// Salesperson detail sub-component
// ============================================================

function SalespersonDetail({ salesperson, agreements, payouts }: {
  salesperson: Record<string, unknown>
  agreements: Record<string, unknown>[]
  payouts: Record<string, unknown>[]
}) {
  const sp = salesperson as { id: string; full_name: string; email: string; default_finders_fee_pct: number | null; default_recurring_pct: number | null }
  const activeAgreements = agreements.filter(a => (a as { status: string }).status === 'active')
  const ytdPaid = payouts.filter(p => (p as { status: string }).status === 'paid').reduce((sum, p) => sum + ((p as { amount_pence: number }).amount_pence), 0)
  const pending = payouts.filter(p => (p as { status: string }).status === 'pending').reduce((sum, p) => sum + ((p as { amount_pence: number }).amount_pence), 0)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">{sp.email}</p>
        <div className="flex gap-4 mt-3">
          <div>
            <p className="text-xs text-gray-500">Default finder's fee</p>
            <p className="text-sm font-medium">{sp.default_finders_fee_pct ? `${sp.default_finders_fee_pct}%` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Default recurring</p>
            <p className="text-sm font-medium">{sp.default_recurring_pct ? `${sp.default_recurring_pct}%` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">YTD earned</p>
            <p className="text-sm font-medium">£{(ytdPaid / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-sm font-medium">£{(pending / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <RainbowStripe height={2} />

      <h4 className="font-medium text-gray-900">Agreements ({activeAgreements.length} active)</h4>

      {agreements.length === 0 ? (
        <p className="text-sm text-gray-400">No agreements yet.</p>
      ) : (
        <div className="space-y-3">
          {agreements.map(rawA => {
            const a = rawA as {
              id: string; organisation: { name: string }; status: string
              recurring_commission_pct: number; finders_fee_pct: number | null
              finders_fee_pence: number | null; recurring_duration_months: number | null
              starts_at: string; ends_at: string | null; notes: string | null
            }
            return (
              <div key={a.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{a.organisation?.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {a.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>
                    Recurring: <span className="text-gray-900 font-medium">{a.recurring_commission_pct}%</span>
                    {a.recurring_duration_months ? ` for ${a.recurring_duration_months}mo` : ' (lifetime)'}
                  </div>
                  <div>
                    Finder's: <span className="text-gray-900 font-medium">
                      {a.finders_fee_pct ? `${a.finders_fee_pct}%` : a.finders_fee_pence ? `£${(a.finders_fee_pence / 100).toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div>
                    Started: <span className="text-gray-900">{new Date(a.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                {a.notes && <p className="text-xs text-gray-500 mt-2 italic">{a.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {payouts.length > 0 && (
        <>
          <h4 className="font-medium text-gray-900 mt-6">Recent payouts</h4>
          <div className="space-y-2">
            {payouts.slice(0, 10).map(rawP => {
              const p = rawP as { id: string; reference: string; amount_pence: number; kind: string; status: string; period_start: string; period_end: string }
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                  <span className="font-mono text-xs text-gray-400">{p.reference}</span>
                  <span className="text-gray-600">{p.kind === 'finders_fee' ? "Finder's fee" : 'Recurring'}</span>
                  <span className="text-gray-500">{new Date(p.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                  <span className="font-medium">£{(p.amount_pence / 100).toLocaleString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'paid' ? 'bg-green-50 text-green-700' : p.status === 'pending' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.status}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
