import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useClientOrgId } from '../../lib/useClientOrg'

const COLORS = { cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A', orange: '#EE7C24' }
const TIER_COLORS: Record<string, string> = { Essentials: COLORS.cyan, Governance: COLORS.purple, Embedded: COLORS.pink }

export function ClientSubscription() {
  const orgId = useClientOrgId()

  const { data: subscription } = useQuery({
    queryKey: ['client-sub', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('organisation_id', orgId!).eq('status', 'active').single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: tiers } = useQuery({
    queryKey: ['tier-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tier_config').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })

  const { data: usedWords } = useQuery({
    queryKey: ['client-sub-usage', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('word_count').eq('organisation_id', orgId!).neq('status', 'cancelled')
      if (error) throw error
      return data.reduce((s: number, j: { word_count: number }) => s + j.word_count, 0) as number
    },
    enabled: !!orgId,
  })

  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const { data: usageCharges } = useQuery({
    queryKey: ['client-usage-charges', orgId, currentPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_charges')
        .select('kind, amount_pence')
        .eq('organisation_id', orgId!)
        .eq('billing_period', currentPeriod)
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const overflowTotal = usageCharges?.filter(c => c.kind === 'overflow').reduce((s, c) => s + c.amount_pence, 0) ?? 0
  const expeditedTotal = usageCharges?.filter(c => c.kind === 'expedited').reduce((s, c) => s + c.amount_pence, 0) ?? 0
  const subscriptionAmount = subscription?.monthly_price_pence ?? 0
  const estimatedTotal = subscriptionAmount + overflowTotal + expeditedTotal

  const [portalLoading, setPortalLoading] = useState(false)

  async function openStripePortal() {
    if (!orgId) return
    setPortalLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/.netlify/functions/stripe-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ organisation_id: orgId }),
      })
      const data = await resp.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Could not open billing portal')
    } catch { alert('Failed to open billing portal') }
    finally { setPortalLoading(false) }
  }

  if (!subscription || !tiers) {
    return <div className="bg-white border border-gray-200 rounded-lg h-64 animate-pulse" />
  }

  const allowance = subscription.word_allowance
  const used = usedWords ?? 0
  const pct = allowance ? Math.round((used / allowance) * 100) : 0
  const effectiveRate = allowance && subscription.monthly_price_pence > 0
    ? (subscription.monthly_price_pence / 100 / allowance).toFixed(3)
    : null

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Subscription</p>
      </div>

      {/* Current plan */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-1" style={{ background: TIER_COLORS[subscription.tier_name] ?? COLORS.purple }} />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Current plan</p>
              <h2 className="text-2xl font-light text-gray-900 mt-1">{subscription.tier_name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {allowance ? `${allowance.toLocaleString()} words / month` : 'Unlimited (fair-use)'}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-3xl font-light text-gray-900">£{(subscription.monthly_price_pence / 100).toLocaleString()}<span className="text-sm text-gray-500">/mo</span></p>
              {effectiveRate && <p className="text-xs text-gray-500 mt-1">Effective £{effectiveRate}/word</p>}
            </div>
          </div>

          {allowance && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-700">Used this month</span>
                <span className="text-sm font-medium">{used.toLocaleString()} / {allowance.toLocaleString()} words</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 90 ? COLORS.orange : TIER_COLORS[subscription.tier_name] ?? COLORS.purple }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {pct < 80 ? `On track — ${Math.max(0, allowance - used).toLocaleString()} words remaining` :
                 pct < 100 ? 'Approaching allowance. Consider overflow or tier upgrade.' :
                 'Allowance exceeded. Overflow rate applies.'}
              </p>
            </div>
          )}

          {(overflowTotal > 0 || expeditedTotal > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Estimated next invoice</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subscription</span>
                  <span>£{(subscriptionAmount / 100).toLocaleString()}</span>
                </div>
                {overflowTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Overflow</span>
                    <span>£{(overflowTotal / 100).toLocaleString()}</span>
                  </div>
                )}
                {expeditedTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expedited</span>
                    <span>£{(expeditedTotal / 100).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-100 font-medium">
                  <span>Total</span>
                  <span>£{(estimatedTotal / 100).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={openStripePortal}
            disabled={portalLoading}
            className="mt-4 text-sm border border-gray-200 rounded px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            {portalLoading ? 'Opening...' : 'Manage subscription & billing'}
          </button>
        </div>
      </div>

      {/* Other plans */}
      <div>
        <h3 className="font-medium text-gray-900 mb-4">Other plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {tiers.map(tier => {
            const isCurrent = tier.name === subscription.tier_name
            const color = TIER_COLORS[tier.name] ?? COLORS.cyan
            return (
              <div key={tier.id} className={`bg-white border ${isCurrent ? 'border-2 border-gray-900' : 'border-gray-200'} rounded-lg overflow-hidden`}>
                <div className="h-1" style={{ background: color }} />
                <div className="p-5">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">{isCurrent ? 'Current plan' : 'Available'}</p>
                  <h4 className="text-lg font-medium text-gray-900 mt-1">{tier.name}</h4>
                  <p className="text-2xl font-light text-gray-900 mt-3">£{(tier.monthly_price_pence / 100).toLocaleString()}<span className="text-sm text-gray-500">/mo</span></p>
                  <p className="text-xs text-gray-500 mt-2">{tier.word_allowance ? `${tier.word_allowance.toLocaleString()} words/month` : 'Unlimited fair-use'}</p>
                  {!isCurrent && (
                    <button className="mt-4 w-full text-sm border border-gray-200 rounded py-2 hover:bg-gray-50">
                      {tier.monthly_price_pence > subscription.monthly_price_pence ? 'Upgrade' : 'Downgrade'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">Upgrades take effect immediately. Downgrades take effect next quarter. Contact your account team for one-month upgrades.</p>
      </div>
    </div>
  )
}
