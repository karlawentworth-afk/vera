import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from './RainbowStripe'
import { Users, X, RotateCcw } from 'lucide-react'

const DEMO_ENABLED = import.meta.env.VITE_ENABLE_DEMO_SWITCHER === 'true'
const DEMO_PASSWORD = 'VeraDemo2026!'

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#11182720', color: '#111827' },
  client: { bg: '#1FA1D620', color: '#1FA1D6' },
  reviewer: { bg: '#0F8F4D20', color: '#0F8F4D' },
  salesperson: { bg: '#8E288220', color: '#8E2882' },
}

const ROLE_ORDER = ['admin', 'client', 'reviewer', 'salesperson']

function roleToPath(role: string): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'client': return '/client'
    case 'reviewer': return '/reviewer'
    case 'salesperson': return '/sales'
    default: return '/login'
  }
}

export function DemoSwitcher() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const { data: allProfiles } = useQuery({
    queryKey: ['demo-switcher-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, organisation_id')
        .order('role')
        .order('full_name')
      if (error) throw error
      return data
    },
    enabled: open && profile?.role === 'admin',
  })

  const { data: orgs } = useQuery({
    queryKey: ['demo-switcher-orgs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('id, name').order('name')
      if (error) throw error
      return Object.fromEntries(data.map(o => [o.id, o.name])) as Record<string, string>
    },
    enabled: open && profile?.role === 'admin',
  })

  if (!DEMO_ENABLED || !profile || profile.role !== 'admin') return null

  async function switchTo(email: string, role: string) {
    setSwitching(email)
    try {
      await supabase.auth.signOut()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: DEMO_PASSWORD,
      })
      if (error) throw error
      window.location.href = roleToPath(role)
    } catch (err) {
      console.error('Switch failed:', err)
      setSwitching(null)
      alert(`Failed to switch to ${email}. Make sure demo password is set.`)
    }
  }

  async function resetDemoData() {
    setResetting(true)
    try {
      // Delete transactional data
      await supabase.from('scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // Reset all jobs to seed state — delete and re-run would need server-side.
      // Simpler: delete jobs and let user re-run npm run seed
      await supabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      setShowResetConfirm(false)
      alert('Transactional data cleared (jobs, scores, audit log). Run "npm run seed" to restore demo data, then refresh.')
      window.location.reload()
    } catch (err) {
      console.error('Reset failed:', err)
      alert('Reset failed. Check console.')
    } finally {
      setResetting(false)
    }
  }

  // Group profiles by role
  const grouped: Record<string, typeof allProfiles> = {}
  allProfiles?.forEach(p => {
    if (!grouped[p.role]) grouped[p.role] = []
    grouped[p.role]!.push(p)
  })

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 flex items-center justify-center"
        title="Demo user switcher"
      >
        <Users className="w-5 h-5" />
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fixed bottom-20 right-4 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Demo user switcher</h3>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 max-h-80 overflow-y-auto">
                {ROLE_ORDER.map(role => {
                  const users = grouped[role]
                  if (!users?.length) return null
                  const rc = ROLE_COLORS[role] ?? { bg: '#f3f4f6', color: '#6b7280' }

                  return (
                    <div key={role}>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-1">
                        {role === 'admin' ? 'Admin' : role === 'client' ? 'Clients' : role === 'reviewer' ? 'Reviewers' : 'Salespeople'}
                      </p>
                      <div className="space-y-1">
                        {users.map(u => {
                          const isCurrent = u.id === profile.id
                          const orgName = u.organisation_id && orgs ? orgs[u.organisation_id] : null

                          return (
                            <button
                              key={u.id}
                              onClick={() => !isCurrent && switchTo(u.email, u.role)}
                              disabled={isCurrent || !!switching}
                              className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                                isCurrent
                                  ? 'bg-gray-100 cursor-default'
                                  : switching === u.email
                                  ? 'bg-gray-50 opacity-60'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{u.full_name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: rc.bg, color: rc.color }}>
                                  {role}
                                </span>
                              </div>
                              {orgName && <p className="text-xs text-gray-500">{orgName}</p>}
                              {isCurrent && <p className="text-[10px] text-gray-400 mt-0.5">Currently logged in</p>}
                              {switching === u.email && <p className="text-[10px] text-gray-400 mt-0.5">Switching...</p>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Reset */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                {showResetConfirm ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Reset all demo data? This wipes jobs, scores, and audit log. Run <code className="bg-gray-100 px-1 rounded">npm run seed</code> after to restore.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={resetDemoData}
                        disabled={resetting}
                        className="flex-1 text-xs bg-red-600 text-white rounded py-1.5 hover:bg-red-700 disabled:opacity-50"
                      >
                        {resetting ? 'Resetting...' : 'Confirm reset'}
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 text-xs border border-gray-200 rounded py-1.5 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full text-xs text-red-600 hover:text-red-700 flex items-center justify-center gap-1 py-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset demo data
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
