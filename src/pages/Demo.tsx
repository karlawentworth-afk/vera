import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { RainbowStripe } from '../components/shared/RainbowStripe'
import { VeraLogo } from '../components/shared/VeraLogo'
import { ArrowLeft } from 'lucide-react'

const ROLE_ORDER = ['admin', 'client', 'reviewer', 'salesperson']
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', client: 'Clients', reviewer: 'Reviewers', salesperson: 'Salespeople' }
const ROLE_COLORS: Record<string, { bg: string; color: string; accent: string }> = {
  admin: { bg: '#11182720', color: '#111827', accent: '#111827' },
  client: { bg: '#1FA1D620', color: '#1FA1D6', accent: '#1FA1D6' },
  reviewer: { bg: '#0F8F4D20', color: '#0F8F4D', accent: '#0F8F4D' },
  salesperson: { bg: '#8E288220', color: '#8E2882', accent: '#8E2882' },
}

export function DemoPage() {
  const { profile, loading } = useAuth()
  const [switching, setSwitching] = useState<string | null>(null)

  const { data: allProfiles } = useQuery({
    queryKey: ['demo-all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, organisation_id, languages, specialism, rate_per_word')
        .order('role')
        .order('full_name')
      if (error) throw error
      return data
    },
    enabled: !!profile && profile.role === 'admin',
  })

  const { data: orgs } = useQuery({
    queryKey: ['demo-orgs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('id, name').order('name')
      if (error) throw error
      return Object.fromEntries(data.map(o => [o.id, o.name])) as Record<string, string>
    },
    enabled: !!profile && profile.role === 'admin',
  })

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse text-gray-400 text-sm">Loading...</div></div>
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  // Group by role
  const grouped: Record<string, typeof allProfiles> = {}
  allProfiles?.forEach(p => {
    if (!grouped[p.role]) grouped[p.role] = []
    grouped[p.role]!.push(p)
  })

  async function switchToUser(userId: string, _role: string) {
    setSwitching(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/.netlify/functions/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await resp.json()

      if (!resp.ok) {
        alert(data.error || 'Failed to switch user')
        setSwitching(null)
        return
      }

      // The action_link contains tokens we can use
      // Navigate to it to complete the auth flow
      if (data.action_link) {
        // Store demo mode flag
        sessionStorage.setItem('vera_demo_mode', 'true')
        sessionStorage.setItem('vera_demo_admin_email', profile!.email)
        window.location.href = data.action_link
      }
    } catch (err) {
      alert('Switch failed: ' + err)
      setSwitching(null)
    }
  }

  function getDescription(p: { role: string; languages?: string[] | null; specialism?: string | null; rate_per_word?: number | null }): string {
    if (p.role === 'admin') return 'Platform administrator'
    if (p.role === 'reviewer') {
      const parts = []
      if (p.languages?.length) parts.push(p.languages.join(', '))
      if (p.specialism) parts.push(p.specialism.toLowerCase())
      if (p.rate_per_word) parts.push(`£${Number(p.rate_per_word).toFixed(3)}/word`)
      return parts.join(' · ') || 'Freelance reviewer'
    }
    if (p.role === 'salesperson') return 'Sales partner'
    return 'Client user'
  }

  return (
    <div className="min-h-screen bg-white">
      <RainbowStripe height={6} />
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-24">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/portal-mode" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <VeraLogo size="md" />
            <p className="mt-1 text-sm text-gray-500">Demo mode — choose a user to log in as</p>
          </div>
        </div>

        <div className="space-y-8">
          {ROLE_ORDER.map(role => {
            const users = grouped[role]
            if (!users?.length) return null
            const rc = ROLE_COLORS[role]

            return (
              <div key={role}>
                <h3 className="text-xs uppercase tracking-widest text-gray-400 font-medium mb-3">
                  {ROLE_LABELS[role] ?? role}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {users.map(u => {
                    const orgName = u.organisation_id && orgs ? orgs[u.organisation_id] : null
                    const isSwitching = switching === u.id
                    const isCurrent = u.id === profile.id

                    return (
                      <button
                        key={u.id}
                        onClick={() => !isCurrent && switchToUser(u.id, u.role)}
                        disabled={!!switching || isCurrent}
                        className={`text-left rounded-lg border overflow-hidden transition ${
                          isCurrent ? 'border-gray-900 bg-gray-50' :
                          isSwitching ? 'border-gray-300 opacity-60' :
                          'border-gray-200 hover:border-gray-400 hover:shadow-sm'
                        }`}
                      >
                        <div className="h-1" style={{ background: rc.accent }} />
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{u.full_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: rc.bg, color: rc.color }}>{role}</span>
                          </div>
                          {orgName && <p className="text-xs text-gray-600">{orgName}</p>}
                          <p className="text-xs text-gray-400 mt-1">{getDescription(u)}</p>
                          {isCurrent && <p className="text-[10px] text-gray-400 mt-2">Currently logged in</p>}
                          {isSwitching && <p className="text-[10px] text-gray-400 mt-2">Switching...</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
