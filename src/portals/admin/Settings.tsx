import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'

const COLORS = {
  green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A',
}

interface TierRow {
  id: string
  name: string
  monthly_price_pence: number
  word_allowance: number | null
  overflow_rate_pence: number
  colour: string
  sort_order: number
  updated_at: string
}

interface PricingRow {
  id: string
  payg_rate_pence: number
  expedited_surcharge_pct: number
  health_check_fee_pence: number
  updated_at: string
}

export function AdminSettings() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['tier-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tier_config')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data as TierRow[]
    },
  })

  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ['pricing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('*')
        .limit(1)
        .single()
      if (error) throw error
      return data as PricingRow
    },
  })

  // Local form state
  const [tierEdits, setTierEdits] = useState<TierRow[]>([])
  const [pricingEdit, setPricingEdit] = useState<PricingRow | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (tiers) setTierEdits(tiers.map(t => ({ ...t })))
  }, [tiers])

  useEffect(() => {
    if (pricing) setPricingEdit({ ...pricing })
  }, [pricing])

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save all tiers
      for (const tier of tierEdits) {
        const { error } = await supabase
          .from('tier_config')
          .update({
            name: tier.name,
            monthly_price_pence: tier.monthly_price_pence,
            word_allowance: tier.word_allowance,
            overflow_rate_pence: tier.overflow_rate_pence,
          })
          .eq('id', tier.id)
        if (error) throw error
      }

      // Save pricing settings
      if (pricingEdit) {
        const { error } = await supabase
          .from('pricing_settings')
          .update({
            payg_rate_pence: pricingEdit.payg_rate_pence,
            expedited_surcharge_pct: pricingEdit.expedited_surcharge_pct,
            health_check_fee_pence: pricingEdit.health_check_fee_pence,
          })
          .eq('id', pricingEdit.id)
        if (error) throw error
      }

      // Audit log
      await supabase.from('audit_log').insert({
        actor_id: profile!.id,
        action: 'updated_pricing',
        entity_type: 'pricing',
        entity_id: 'global',
        details: {
          tiers: tierEdits.map(t => ({ name: t.name, monthly_price_pence: t.monthly_price_pence, word_allowance: t.word_allowance })),
          pricing: pricingEdit ? {
            payg_rate_pence: pricingEdit.payg_rate_pence,
            expedited_surcharge_pct: pricingEdit.expedited_surcharge_pct,
            health_check_fee_pence: pricingEdit.health_check_fee_pence,
          } : null,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tier-config'] })
      queryClient.invalidateQueries({ queryKey: ['pricing-settings'] })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  function updateTier(id: string, field: keyof TierRow, value: number | string | null) {
    setTierEdits(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  if (tiersLoading || pricingLoading) {
    return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />
  }

  const lastUpdated = tiers?.[0]?.updated_at
    ? new Date(tiers[0].updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6">
      {/* Tier config */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-gray-900">Subscription tiers</h3>
            {lastUpdated && <span className="text-xs text-gray-400">Last updated: {lastUpdated}</span>}
          </div>
          <p className="text-sm text-gray-500 mb-6">Edit pricing, allowances and tier names. Changes apply to new clients immediately; existing clients keep their original terms until renewal.</p>

          <div className="space-y-4">
            {tierEdits.map(tier => {
              const effectiveRate = tier.word_allowance && tier.monthly_price_pence > 0
                ? (tier.monthly_price_pence / 100 / tier.word_allowance).toFixed(3)
                : '—'

              return (
                <div key={tier.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="h-1" style={{ background: tier.colour }} />
                  <div className="p-4">
                    <div className="grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-2">
                        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Tier name</label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={e => updateTier(tier.id, 'name', e.target.value)}
                          className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm font-medium focus:outline-none focus:border-gray-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Monthly price (£)</label>
                        <input
                          type="number"
                          step="100"
                          value={tier.monthly_price_pence / 100}
                          onChange={e => updateTier(tier.id, 'monthly_price_pence', Math.round(parseFloat(e.target.value || '0') * 100))}
                          className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Words / month</label>
                        <input
                          type="text"
                          value={tier.word_allowance?.toLocaleString() ?? 'Unlimited'}
                          onChange={e => {
                            const v = e.target.value.replace(/,/g, '')
                            updateTier(tier.id, 'word_allowance', v.toLowerCase() === 'unlimited' || v === '' ? null : parseInt(v) || 0)
                          }}
                          className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Overflow £/word</label>
                        <input
                          type="number"
                          step="1"
                          value={tier.overflow_rate_pence}
                          onChange={e => updateTier(tier.id, 'overflow_rate_pence', parseInt(e.target.value || '0'))}
                          className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">pence per word</p>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Effective £/word</label>
                        <p className="mt-1 text-sm font-medium py-1.5">£{effectiveRate}</p>
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="w-3 h-3 rounded-full inline-block" style={{ background: tier.colour }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Other pricing */}
          {pricingEdit && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="font-medium text-gray-900 mb-3">Other pricing</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Pay-as-you-go (pence/word)</label>
                  <input
                    type="number"
                    step="1"
                    value={pricingEdit.payg_rate_pence}
                    onChange={e => setPricingEdit(prev => prev ? { ...prev, payg_rate_pence: parseInt(e.target.value || '0') } : prev)}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">= £{(pricingEdit.payg_rate_pence / 100).toFixed(2)}/word</p>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Expedited surcharge (%)</label>
                  <input
                    type="number"
                    step="5"
                    value={pricingEdit.expedited_surcharge_pct}
                    onChange={e => setPricingEdit(prev => prev ? { ...prev, expedited_surcharge_pct: parseInt(e.target.value || '0') } : prev)}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Health Check fee (£)</label>
                  <input
                    type="number"
                    step="500"
                    value={pricingEdit.health_check_fee_pence / 100}
                    onChange={e => setPricingEdit(prev => prev ? { ...prev, health_check_fee_pence: Math.round(parseFloat(e.target.value || '0') * 100) } : prev)}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save */}
          <div className="mt-6 flex items-center justify-end gap-3">
            {saveSuccess && (
              <span className="text-sm" style={{ color: COLORS.green }}>Changes saved</span>
            )}
            {saveMutation.isError && (
              <span className="text-sm text-red-600">Failed to save. Try again.</span>
            )}
            <button
              onClick={() => {
                if (tiers) setTierEdits(tiers.map(t => ({ ...t })))
                if (pricing) setPricingEdit({ ...pricing })
              }}
              className="text-sm border border-gray-200 rounded px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="text-sm bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-3">Integrations</h3>
        <div className="space-y-3">
          {[
            { name: 'Xero', desc: 'Accounting · Invoices and bills sync automatically', connected: false },
            { name: 'Stripe', desc: 'Payments · Subscriptions, overflow, expedited fees', connected: false },
            { name: 'Trados Studio', desc: 'Translation tool · Inbound and outbound XLIFF', connected: false },
            { name: 'XTM Cloud', desc: 'Translation management · API integration', connected: false },
          ].map(int => (
            <div key={int.name} className="flex items-center justify-between p-3 border border-gray-100 rounded">
              <div>
                <p className="text-sm font-medium text-gray-900">{int.name}</p>
                <p className="text-xs text-gray-500">{int.desc}</p>
              </div>
              <button className="text-xs border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
