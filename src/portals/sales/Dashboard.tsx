import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { MetricCard } from '../../components/shared/MetricCard'
import { RainbowStripe } from '../../components/shared/RainbowStripe'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', orange: '#EE7C24' }

export function SalesDashboard() {
  const { profile } = useAuth()

  const { data: agreements, isLoading } = useQuery({
    queryKey: ['sales-agreements', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agreements')
        .select('*, organisation:organisations(name)')
        .eq('salesperson_id', profile!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const { data: payouts } = useQuery({
    queryKey: ['sales-payouts', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_payouts')
        .select('*')
        .eq('salesperson_id', profile!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const { data: subscriptions } = useQuery({
    queryKey: ['sales-client-subs', profile?.id],
    queryFn: async () => {
      const orgIds = agreements?.map(a => a.organisation_id) ?? []
      if (orgIds.length === 0) return []
      const { data, error } = await supabase
        .from('subscriptions')
        .select('organisation_id, monthly_price_pence, status')
        .in('organisation_id', orgIds)
        .eq('status', 'active')
      if (error) throw error
      return data
    },
    enabled: !!agreements && agreements.length > 0,
  })

  if (isLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-white border border-gray-200 rounded-lg animate-pulse" />)}</div>
  }

  const activeAgreements = agreements?.filter(a => a.status === 'active') ?? []
  const totalMrr = subscriptions?.reduce((sum, s) => sum + s.monthly_price_pence, 0) ?? 0
  const ytdPaid = payouts?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount_pence, 0) ?? 0
  const pendingAmount = payouts?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount_pence, 0) ?? 0

  // Agreements expiring in next 90 days
  const soon = activeAgreements.filter(a => {
    if (!a.ends_at) return false
    const end = new Date(a.ends_at)
    const now = new Date()
    const daysLeft = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysLeft > 0 && daysLeft <= 90
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="My clients" value={String(activeAgreements.length)} trend={`£${(totalMrr / 100).toLocaleString()} combined MRR`} color={COLORS.purple} />
        <MetricCard label="YTD earned" value={`£${(ytdPaid / 100).toLocaleString()}`} color={COLORS.green} />
        <MetricCard label="Owed this month" value={`£${(pendingAmount / 100).toLocaleString()}`} color={COLORS.orange} />
        <MetricCard label="Expiring soon" value={String(soon.length)} trend={soon.length > 0 ? 'Within 90 days' : 'All stable'} color={COLORS.cyan} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client list */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-4">My client agreements</h3>
            {activeAgreements.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No active agreements yet.</p>
            ) : (
              <div className="space-y-3">
                {activeAgreements.map(a => {
                  const org = a.organisation as { name: string }
                  const sub = subscriptions?.find(s => s.organisation_id === a.organisation_id)
                  const mrr = sub?.monthly_price_pence ?? 0
                  const monthlyCommission = Math.round(mrr * Number(a.recurring_commission_pct) / 100)

                  return (
                    <div key={a.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">{org?.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">Active</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-gray-500">
                        <div>MRR: <span className="text-gray-900 font-medium">£{(mrr / 100).toLocaleString()}</span></div>
                        <div>Commission: <span className="text-gray-900 font-medium">{a.recurring_commission_pct}%</span></div>
                        <div>Monthly: <span className="text-gray-900 font-medium">£{(monthlyCommission / 100).toLocaleString()}</span></div>
                        <div>{a.recurring_duration_months ? `${a.recurring_duration_months}mo term` : 'Lifetime'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Recent payouts</p>
            {(!payouts || payouts.length === 0) ? (
              <p className="text-sm text-gray-400">No payouts yet.</p>
            ) : (
              <div className="space-y-2">
                {payouts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-400">{p.reference}</span>
                    <span className="font-medium">£{(p.amount_pence / 100).toLocaleString()}</span>
                    <span className={`px-1.5 py-0.5 rounded ${p.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {soon.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Expiring soon</p>
              <div className="space-y-2">
                {soon.map(a => {
                  const org = a.organisation as { name: string }
                  return (
                    <div key={a.id} className="text-xs">
                      <p className="text-gray-900 font-medium">{org?.name}</p>
                      <p className="text-gray-500">Expires {new Date(a.ends_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
