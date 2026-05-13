import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'

export function SalesClients() {
  const { profile } = useAuth()

  const { data: agreements, isLoading } = useQuery({
    queryKey: ['sales-my-agreements', profile?.id],
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

  const { data: subscriptions } = useQuery({
    queryKey: ['sales-client-subs-detail', profile?.id],
    queryFn: async () => {
      const orgIds = agreements?.map(a => a.organisation_id) ?? []
      if (orgIds.length === 0) return []
      const { data, error } = await supabase.from('subscriptions').select('organisation_id, tier_name, monthly_price_pence, status').in('organisation_id', orgIds)
      if (error) throw error
      return data
    },
    enabled: !!agreements && agreements.length > 0,
  })

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const subMap: Record<string, { tier_name: string; monthly_price_pence: number }> = {}
  subscriptions?.forEach(s => { if (s.status === 'active') subMap[s.organisation_id] = s })

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left py-3 px-4 font-medium">Client</th>
                <th className="text-left py-3 px-4 font-medium">Tier</th>
                <th className="text-right py-3 px-4 font-medium">MRR</th>
                <th className="text-right py-3 px-4 font-medium">Commission %</th>
                <th className="text-right py-3 px-4 font-medium">Monthly est.</th>
                <th className="text-left py-3 px-4 font-medium">Duration</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(!agreements || agreements.length === 0) && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No client agreements yet.</td></tr>
              )}
              {agreements?.map(a => {
                const org = a.organisation as { name: string }
                const sub = subMap[a.organisation_id]
                const mrr = sub?.monthly_price_pence ?? 0
                const monthly = Math.round(mrr * Number(a.recurring_commission_pct) / 100)
                return (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{org?.name}</td>
                    <td className="py-3 px-4 text-gray-600">{sub?.tier_name ?? '—'}</td>
                    <td className="py-3 px-4 text-right">£{(mrr / 100).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">{a.recurring_commission_pct}%</td>
                    <td className="py-3 px-4 text-right font-medium">£{(monthly / 100).toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-600">{a.recurring_duration_months ? `${a.recurring_duration_months}mo` : 'Lifetime'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
