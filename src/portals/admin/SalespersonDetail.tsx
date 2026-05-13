import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MetricCard } from '../../components/shared/MetricCard'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { ArrowLeft } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', orange: '#EE7C24' }

export function AdminSalespersonDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: sp } = useQuery({
    queryKey: ['admin-sp-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: agreements } = useQuery({
    queryKey: ['admin-sp-agreements', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('commission_agreements').select('*, organisation:organisations(name)').eq('salesperson_id', id!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: payouts } = useQuery({
    queryKey: ['admin-sp-payouts', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('commission_payouts').select('*').eq('salesperson_id', id!).order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: subscriptions } = useQuery({
    queryKey: ['admin-sp-subs', id],
    queryFn: async () => {
      const orgIds = agreements?.map(a => a.organisation_id) ?? []
      if (orgIds.length === 0) return []
      const { data, error } = await supabase.from('subscriptions').select('organisation_id, monthly_price_pence, status').in('organisation_id', orgIds).eq('status', 'active')
      if (error) throw error
      return data
    },
    enabled: !!agreements && agreements.length > 0,
  })

  if (!sp) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const activeAgreements = agreements?.filter(a => a.status === 'active') ?? []
  const totalMrr = subscriptions?.reduce((s, sub) => s + sub.monthly_price_pence, 0) ?? 0
  const ytdPaid = payouts?.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount_pence, 0) ?? 0
  const pending = payouts?.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount_pence, 0) ?? 0

  return (
    <div className="space-y-6">
      <Link to="/admin/sales" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to sales
      </Link>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h1 className="text-xl font-light text-gray-900">{sp.full_name}</h1>
          <p className="text-sm text-gray-500 mt-1">{sp.email}</p>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span>Default finder's: {sp.default_finders_fee_pct ? `${sp.default_finders_fee_pct}%` : '—'}</span>
            <span>Default recurring: {sp.default_recurring_pct ? `${sp.default_recurring_pct}%` : '—'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Clients introduced" value={String(activeAgreements.length)} color={COLORS.purple} />
        <MetricCard label="Combined MRR" value={`£${(totalMrr / 100).toLocaleString()}`} color={COLORS.cyan} />
        <MetricCard label="YTD earned" value={`£${(ytdPaid / 100).toLocaleString()}`} color={COLORS.green} />
        <MetricCard label="Pending" value={`£${(pending / 100).toLocaleString()}`} color={COLORS.orange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Agreements */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-4">Commission agreements</h3>
              <div className="space-y-3">
                {agreements?.map(a => {
                  const org = a.organisation as { name: string }
                  const sub = subscriptions?.find(s => s.organisation_id === a.organisation_id)
                  const mrr = sub?.monthly_price_pence ?? 0
                  const monthly = Math.round(mrr * Number(a.recurring_commission_pct) / 100)
                  return (
                    <div key={a.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">{org?.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                        <div>MRR: <span className="text-gray-900 font-medium">£{(mrr / 100).toLocaleString()}</span></div>
                        <div>Rate: <span className="text-gray-900 font-medium">{a.recurring_commission_pct}%</span></div>
                        <div>Monthly: <span className="text-gray-900 font-medium">£{(monthly / 100).toLocaleString()}</span></div>
                        <div>{a.recurring_duration_months ? `${a.recurring_duration_months}mo term` : 'Lifetime'}</div>
                      </div>
                      {a.finders_fee_pct && <p className="text-xs text-gray-500 mt-1">Finder's fee: {a.finders_fee_pct}%</p>}
                      <p className="text-xs text-gray-400 mt-1">Started {new Date(a.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  )
                })}
                {(!agreements || agreements.length === 0) && <p className="text-sm text-gray-400 py-4 text-center">No agreements</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Payouts sidebar */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 h-fit">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Payout history</p>
          {(!payouts || payouts.length === 0) ? (
            <p className="text-sm text-gray-400">No payouts yet</p>
          ) : (
            <div className="space-y-2">
              {payouts.slice(0, 12).map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-gray-400">{p.reference}</span>
                  <span className="font-medium">£{(p.amount_pence / 100).toLocaleString()}</span>
                  <span className={`px-1.5 py-0.5 rounded ${p.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
