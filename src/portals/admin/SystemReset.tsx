import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { AlertTriangle } from 'lucide-react'

export function AdminSystemReset() {
  const [password, setPassword] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleReset() {
    setResetting(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/.netlify/functions/system-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ confirm_password: password }),
      })
      const data = await resp.json()
      if (resp.ok) {
        setResult('Live system cleared. Only your admin account and tier config remain. You can now start fresh.')
        setConfirming(false)
        setPassword('')
      } else {
        setResult(`Error: ${data.error}`)
      }
    } catch (err) {
      setResult(`Failed: ${err}`)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Reset live system</h3>
              <p className="text-xs text-gray-500">Clear all data and start fresh</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 font-medium mb-2">This will permanently delete:</p>
            <ul className="text-sm text-red-700 space-y-1 list-disc pl-5">
              <li>All client organisations and their users</li>
              <li>All subscriptions and invoices</li>
              <li>All jobs, scores, and segments</li>
              <li>All reviewer and salesperson accounts</li>
              <li>All quotes and commission agreements</li>
              <li>All glossaries, recommendations, and audit history</li>
            </ul>
            <p className="text-sm text-red-800 font-medium mt-3">What's preserved:</p>
            <ul className="text-sm text-red-700 space-y-1 list-disc pl-5">
              <li>Your admin account (Emma)</li>
              <li>Tier configuration and pricing</li>
              <li>Database schema and RLS policies</li>
            </ul>
          </div>

          {result && (
            <div className={`p-3 rounded-lg mb-4 text-sm ${result.startsWith('Error') || result.startsWith('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {result}
            </div>
          )}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="w-full bg-red-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-red-700"
            >
              Reset live system...
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">Enter your password to confirm:</p>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => { setConfirming(false); setPassword('') }} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={!password || resetting}
                  className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {resetting ? 'Resetting...' : 'Confirm reset'}
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4 text-center">Demo mode is separate and unaffected by this reset.</p>
        </div>
      </div>
    </div>
  )
}
