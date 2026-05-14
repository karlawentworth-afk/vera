import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { MetricCard } from '../../components/shared/MetricCard'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Search, List, LayoutGrid, Building2, Plus } from 'lucide-react'

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#11182720', color: '#111827' },
  client: { bg: '#1FA1D620', color: '#1FA1D6' },
  reviewer: { bg: '#0F8F4D20', color: '#0F8F4D' },
  salesperson: { bg: '#8E288220', color: '#8E2882' },
}

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A', orange: '#EE7C24' }

type ViewMode = 'grouped' | 'flat' | 'org'

export function AdminUsers() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [view, setView] = useState<ViewMode>('grouped')

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['admin-all-users', getIsDemo()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      if (error) throw error
      // Show both admin (is_demo=false) and demo users based on mode
      return data
    },
  })

  const { data: orgs } = useQuery({
    queryKey: ['admin-all-orgs', getIsDemo()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name, type')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const orgMap = Object.fromEntries(orgs?.map(o => [o.id, o.name]) ?? [])

  const filtered = profiles?.filter(p => {
    if (roleFilter && p.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const orgName = p.organisation_id ? (orgMap[p.organisation_id] ?? '').toLowerCase() : ''
      return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || orgName.includes(q) || (p.job_title ?? '').toLowerCase().includes(q)
    }
    return true
  }) ?? []

  // Stats
  const total = profiles?.length ?? 0
  const admins = profiles?.filter(p => p.role === 'admin').length ?? 0
  const clients = profiles?.filter(p => p.role === 'client').length ?? 0
  const reviewers = profiles?.filter(p => p.role === 'reviewer').length ?? 0
  const salespeople = profiles?.filter(p => p.role === 'salesperson').length ?? 0
  const invited = profiles?.filter(p => !p.onboarding_completed_at && p.invited_at).length ?? 0

  // Group by category
  const adminUsers = filtered.filter(p => p.role === 'admin')
  const salespeopleUsers = filtered.filter(p => p.role === 'salesperson')
  const reviewerUsers = filtered.filter(p => p.role === 'reviewer')
  const clientUsers = filtered.filter(p => p.role === 'client')

  // Group clients by org
  const clientsByOrg: Record<string, typeof filtered> = {}
  clientUsers.forEach(p => {
    const orgName = p.organisation_id ? (orgMap[p.organisation_id] ?? 'Unknown') : 'No organisation'
    if (!clientsByOrg[orgName]) clientsByOrg[orgName] = []
    clientsByOrg[orgName].push(p)
  })

  function getStatus(p: { onboarding_completed_at?: string | null; invited_at?: string | null }): { label: string; color: string } {
    if (p.onboarding_completed_at) return { label: 'Active', color: COLORS.green }
    if (p.invited_at) return { label: 'Invited', color: COLORS.orange }
    return { label: 'Pending', color: '#6B7280' }
  }

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total users" value={String(total)} color={COLORS.purple} href="/admin/users" />
        <MetricCard label="Admins" value={String(admins)} color="#111827" />
        <MetricCard label="Clients" value={String(clients)} color={COLORS.cyan} />
        <MetricCard label="Reviewers" value={String(reviewers)} color={COLORS.green} />
        <MetricCard label="Salespeople" value={String(salespeople)} color={COLORS.purple} />
        <MetricCard label="Invited" value={String(invited)} trend="Not yet logged in" color={COLORS.orange} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, organisation..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="text-sm border border-gray-200 rounded px-3 py-1.5">
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="client">Client</option>
          <option value="reviewer">Reviewer</option>
          <option value="salesperson">Salesperson</option>
        </select>
        <div className="flex gap-1">
          <button onClick={() => setView('grouped')} className={`text-sm px-2 py-1.5 rounded ${view === 'grouped' ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
          <button onClick={() => setView('flat')} className={`text-sm px-2 py-1.5 rounded ${view === 'flat' ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}><List className="w-3.5 h-3.5" /></button>
          <button onClick={() => setView('org')} className={`text-sm px-2 py-1.5 rounded ${view === 'org' ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}><Building2 className="w-3.5 h-3.5" /></button>
        </div>
        <Link to="/admin/clients" className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add user
        </Link>
      </div>

      {/* FLAT VIEW */}
      {view === 'flat' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Role</th>
                  <th className="text-left py-3 px-4 font-medium">Organisation</th>
                  <th className="text-left py-3 px-4 font-medium">Title</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const rc = ROLE_COLORS[p.role]
                  const status = getStatus(p)
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/admin/users/${p.id}`}>
                      <td className="py-3 px-4 font-medium text-gray-900">{p.full_name}</td>
                      <td className="py-3 px-4 text-gray-500">{p.email}</td>
                      <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded" style={{ background: rc?.bg, color: rc?.color }}>{p.role}</span></td>
                      <td className="py-3 px-4 text-gray-600">{p.organisation_id ? orgMap[p.organisation_id] ?? '—' : '—'}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{p.job_title ?? '—'}</td>
                      <td className="py-3 px-4"><span className="text-xs" style={{ color: status.color }}>{status.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GROUPED VIEW */}
      {view === 'grouped' && (
        <div className="space-y-6">
          {adminUsers.length > 0 && <UserSection title="Internal — Admin" users={adminUsers} orgMap={orgMap} getStatus={getStatus} />}
          {salespeopleUsers.length > 0 && <UserSection title="Internal — Sales" users={salespeopleUsers} orgMap={orgMap} getStatus={getStatus} />}
          {reviewerUsers.length > 0 && <UserSection title="External — Reviewers" users={reviewerUsers} orgMap={orgMap} getStatus={getStatus} />}
          {clientUsers.length > 0 && <UserSection title="External — Clients" users={clientUsers} orgMap={orgMap} getStatus={getStatus} />}
        </div>
      )}

      {/* ORG VIEW */}
      {view === 'org' && (
        <div className="space-y-4">
          {/* Non-org users */}
          {[...adminUsers, ...salespeopleUsers, ...reviewerUsers].length > 0 && (
            <UserSection title="ECLS Team & Freelancers" users={[...adminUsers, ...salespeopleUsers, ...reviewerUsers]} orgMap={orgMap} getStatus={getStatus} />
          )}
          {/* Client orgs */}
          {Object.entries(clientsByOrg).map(([orgName, users]) => (
            <div key={orgName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{orgName}</p>
                  <p className="text-xs text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {users.map(p => <UserRow key={p.id} profile={p} orgMap={orgMap} getStatus={getStatus} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UserSection({ title, users, orgMap, getStatus }: { title: string; users: Array<Record<string, unknown>>; orgMap: Record<string, string>; getStatus: (p: Record<string, unknown>) => { label: string; color: string } }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <RainbowStripe height={3} />
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {users.map(p => <UserRow key={p.id as string} profile={p} orgMap={orgMap} getStatus={getStatus} />)}
      </div>
    </div>
  )
}

function UserRow({ profile: p, orgMap, getStatus }: { profile: Record<string, unknown>; orgMap: Record<string, string>; getStatus: (p: Record<string, unknown>) => { label: string; color: string } }) {
  const rc = ROLE_COLORS[p.role as string] ?? ROLE_COLORS.admin
  const status = getStatus(p)
  const initials = (p.full_name as string)?.split(' ').map(n => n[0]).join('').toUpperCase()
  const orgName = p.organisation_id ? orgMap[p.organisation_id as string] ?? '' : ''

  return (
    <div onClick={() => window.location.href = `/profile`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium shrink-0">{initials}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{p.full_name as string}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: rc.bg, color: rc.color }}>{p.role as string}</span>
          <span className="text-[10px]" style={{ color: status.color }}>{status.label}</span>
        </div>
        <p className="text-xs text-gray-500 truncate">{p.email as string}{orgName ? ` · ${orgName}` : ''}{p.job_title ? ` · ${p.job_title}` : ''}</p>
      </div>
      {p.role === 'reviewer' && (
        <div className="text-xs text-gray-400 hidden sm:block">
          {(p.languages as string[])?.join(', ') ?? ''}
        </div>
      )}
    </div>
  )
}
