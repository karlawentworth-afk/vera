import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { CreditCard, CheckCircle } from 'lucide-react'

const COLORS = { green: '#0F8F4D', orange: '#EE7C24' }

export function SalesSettings() {
  const { profile } = useAuth()
  const [connecting, setConnecting] = useState(false)
  const isOnboarded = !!profile?.stripe_onboarding_completed_at

  async function startOnboarding() {
    setConnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/.netlify/functions/stripe-connect-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await resp.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Failed to start onboarding')
    } catch { alert('Connection failed') }
    finally { setConnecting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <h3 className="font-medium text-gray-900 mb-4">Payout settings</h3>
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: isOnboarded ? COLORS.green + '20' : COLORS.orange + '20' }}>
                {isOnboarded ? <CheckCircle className="w-5 h-5" style={{ color: COLORS.green }} /> : <CreditCard className="w-5 h-5" style={{ color: COLORS.orange }} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{isOnboarded ? 'Bank account connected' : 'Connect your bank account'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isOnboarded ? 'Commission payouts are processed automatically on the 28th of each month.' : 'Set up your bank account to receive commission payouts via Stripe.'}
                </p>
                {!isOnboarded && (
                  <button onClick={startOnboarding} disabled={connecting} className="mt-3 text-sm bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50">
                    {connecting ? 'Connecting...' : 'Connect bank account'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
