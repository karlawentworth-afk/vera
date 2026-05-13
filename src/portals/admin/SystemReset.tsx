import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'

export function AdminSystemReset() {
  const [demoConfirm, setDemoConfirm] = useState('')
  const [liveConfirm, setLiveConfirm] = useState('')
  const [reinstallConfirm, setReinstallConfirm] = useState('')
  const [resetting, setResetting] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function handleReset(mode: 'demo' | 'live' | 'reinstall') {
    setResetting(mode)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/.netlify/functions/system-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          mode,
          confirm_password: 'admin-confirmed', // Server validates the typed confirmation instead
        }),
      })
      const data = await resp.json()
      if (resp.ok) {
        setResult(data.message || `${mode} reset complete.`)
        setDemoConfirm(''); setLiveConfirm(''); setReinstallConfirm('')
      } else {
        setResult(`Error: ${data.error}`)
      }
    } catch (err) {
      setResult(`Failed: ${err}`)
    } finally {
      setResetting(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.startsWith('Error') || result.startsWith('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {result}
        </div>
      )}

      {/* DEMO section */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={4} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Demo system</h3>
              <p className="text-xs text-gray-500">Seeded walkthrough data (is_demo=true)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reinstall */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-1">Reinstall demo data</h4>
              <p className="text-xs text-gray-500 mb-3">Deletes existing demo data, then re-seeds the full demo state. Safe to run any time.</p>
              <input type="text" value={reinstallConfirm} onChange={e => setReinstallConfirm(e.target.value)} placeholder='Type "REINSTALL DEMO"' className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:border-purple-400" />
              <button onClick={() => handleReset('reinstall')} disabled={reinstallConfirm !== 'REINSTALL DEMO' || !!resetting}
                className="w-full bg-purple-600 text-white rounded py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {resetting === 'reinstall' ? 'Reinstalling...' : 'Reinstall demo data'}
              </button>
            </div>

            {/* Wipe demo */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-1">Wipe demo data</h4>
              <p className="text-xs text-gray-500 mb-3">Deletes all demo records without reseeding. Leaves demo mode empty.</p>
              <input type="text" value={demoConfirm} onChange={e => setDemoConfirm(e.target.value)} placeholder='Type "WIPE DEMO"' className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:border-orange-400" />
              <button onClick={() => handleReset('demo')} disabled={demoConfirm !== 'WIPE DEMO' || !!resetting}
                className="w-full bg-orange-600 text-white rounded py-2 text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                {resetting === 'demo' ? 'Wiping...' : 'Wipe demo data'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE section */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-1 bg-red-600" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Live system</h3>
              <p className="text-xs text-gray-500">Real production data (is_demo=false). Cannot be reinstalled.</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
            <p className="text-xs text-red-800">This permanently deletes all live client data, jobs, invoices, and user accounts. Only Emma's admin account and tier config are preserved. This cannot be undone.</p>
          </div>

          <input type="text" value={liveConfirm} onChange={e => setLiveConfirm(e.target.value)} placeholder='Type "RESET LIVE"' className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:border-red-400" />
          <button onClick={() => handleReset('live')} disabled={liveConfirm !== 'RESET LIVE' || !!resetting}
            className="w-full bg-red-600 text-white rounded py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> {resetting === 'live' ? 'Resetting...' : 'Wipe live data'}
          </button>
        </div>
      </div>
    </div>
  )
}
