import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { MetricCard } from '../../components/shared/MetricCard'
import { RainbowStripe } from '../../components/shared/RainbowStripe'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', orange: '#EE7C24' }

export function SalesEarnings() {
  const { profile } = useAuth()

  const { data: payouts, isLoading } = useQuery({
    queryKey: ['sales-all-payouts', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_payouts')
        .select('*')
        .eq('salesperson_id', profile!.id)
        .order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const { data: agreements } = useQuery({
    queryKey: ['sales-agreements-for-earnings', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_agreements')
        .select('id, organisation_id, recurring_commission_pct, status, organisation:organisations(name)')
        .eq('salesperson_id', profile!.id)
        .eq('status', 'active')
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const { data: subscriptions } = useQuery({
    queryKey: ['sales-subs-for-earnings', profile?.id],
    queryFn: async () => {
      const orgIds = agreements?.map(a => a.organisation_id) ?? []
      if (orgIds.length === 0) return []
      const { data, error } = await supabase.from('subscriptions').select('organisation_id, monthly_price_pence').in('organisation_id', orgIds).eq('status', 'active')
      if (error) throw error
      return data
    },
    enabled: !!agreements && agreements.length > 0,
  })

  if (isLoading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-lg animate-pulse" />)}</div>

  const ytdPaid = payouts?.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount_pence, 0) ?? 0
  const pending = payouts?.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount_pence, 0) ?? 0

  // Estimated monthly from active agreements
  const subMap: Record<string, number> = {}
  subscriptions?.forEach(s => { subMap[s.organisation_id] = s.monthly_price_pence })
  const monthlyEst = agreements?.reduce((s, a) => {
    const mrr = subMap[a.organisation_id] ?? 0
    return s + Math.round(mrr * Number(a.recurring_commission_pct) / 100)
  }, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="YTD earned" value={`£${(ytdPaid / 100).toLocaleString()}`} color={COLORS.green} />
        <MetricCard label="Pending" value={`£${(pending / 100).toLocaleString()}`} color={COLORS.orange} />
        <MetricCard label="Monthly est." value={`£${(monthlyEst / 100).toLocaleString()}`} trend="From active agreements" color={COLORS.purple} />
        <MetricCard label="Active agreements" value={String(agreements?.length ?? 0)} color={COLORS.cyan} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-4 sm:p-6">
          <h3 className="font-medium text-gray-900 mb-1">Payout history</h3>
          <p className="text-sm text-gray-500 mb-4">Commission payouts processed by Vera.</p>

          {(!payouts || payouts.length === 0) ? (
            <p className="text-sm text-gray-400 py-8 text-center">No payouts yet. Commissions are calculated monthly from active agreements.</p>
          ) : (
            <div className="space-y-2">
              {payouts.map(p => (
                <div key={p.id} className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-3 border border-gray-100 rounded items-center text-sm">
                  <span className="font-mono text-xs text-gray-400">{p.reference}</span>
                  <span className="text-gray-600">{p.kind === 'finders_fee' ? "Finder's fee" : 'Recurring'}</span>
                  <span className="text-gray-500">{new Date(p.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                  <span className="font-medium text-gray-900">£{(p.amount_pence / 100).toLocaleString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded w-fit ${p.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
