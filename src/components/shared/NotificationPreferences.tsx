import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Bell, Save, CheckCircle } from 'lucide-react'

const NOTIFICATION_TYPES = [
  { key: 'job_submitted', label: 'Job submitted confirmation', desc: 'When you submit a job for review', roles: ['client'] },
  { key: 'job_delivered', label: 'Job delivered', desc: 'When your reviewed job is ready', roles: ['client'] },
  { key: 'near_allowance', label: 'Allowance warning', desc: 'When you approach your word limit', roles: ['client'] },
  { key: 'job_allocated', label: 'New job assigned', desc: 'When a job is allocated to you', roles: ['reviewer'] },
  { key: 'job_returned', label: 'Work returned for revision', desc: 'When Emma returns work with feedback', roles: ['reviewer'] },
  { key: 'monthly_statement', label: 'Monthly statement', desc: 'Your monthly earnings summary', roles: ['reviewer', 'salesperson'] },
  { key: 'invoice_approved', label: 'Invoice approved', desc: 'When your invoice is approved for payment', roles: ['reviewer'] },
  { key: 'invoice_queried', label: 'Invoice queried', desc: 'When Emma has questions about your invoice', roles: ['reviewer'] },
  { key: 'commission_payout', label: 'Commission payout', desc: 'Your monthly commission summary', roles: ['salesperson'] },
  { key: 'internal_note_mention', label: 'Mentioned in a note', desc: 'When someone @-mentions you in an internal note', roles: ['admin', 'reviewer', 'salesperson'] },
  { key: 'reviewer_invoice_submitted', label: 'Reviewer invoice submitted', desc: 'When a reviewer submits an invoice', roles: ['admin'] },
  { key: 'job_signoff_pending', label: 'Job awaiting signoff', desc: 'When a reviewed job needs your approval', roles: ['admin'] },
]

export function NotificationPreferences() {
  const { profile } = useAuth()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if ((profile as unknown as Record<string, unknown>)?.notification_preferences) {
      setPrefs((profile as unknown as Record<string, unknown>).notification_preferences as Record<string, boolean>)
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({ notification_preferences: prefs }).eq('id', profile!.id)
      if (error) throw error
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000) },
  })

  if (!profile) return null

  const relevant = NOTIFICATION_TYPES.filter(n => n.roles.includes(profile.role))

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-gray-400" />
        <h3 className="font-medium text-gray-900">Email notifications</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Choose which emails you receive. Critical system emails (password reset, security) are always sent.</p>

      <div className="space-y-3">
        {relevant.map(n => {
          const enabled = prefs[n.key] !== false // Default to enabled
          return (
            <label key={n.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setPrefs(prev => ({ ...prev, [n.key]: e.target.checked }))}
                className="mt-1 rounded border-gray-300"
              />
              <div>
                <p className="text-sm text-gray-900">{n.label}</p>
                <p className="text-xs text-gray-500">{n.desc}</p>
              </div>
            </label>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Saved</span>}
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="text-sm bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1">
          <Save className="w-3.5 h-3.5" /> {saveMutation.isPending ? 'Saving...' : 'Save preferences'}
        </button>
      </div>
    </div>
  )
}
