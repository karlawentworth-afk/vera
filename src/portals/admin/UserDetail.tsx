import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { MetricCard } from '../../components/shared/MetricCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { ArrowLeft, Clock } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6', purple: '#8E2882', pink: '#E5187A', orange: '#EE7C24' }
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#11182720', color: '#111827' }, client: { bg: '#1FA1D620', color: '#1FA1D6' },
  reviewer: { bg: '#0F8F4D20', color: '#0F8F4D' }, salesperson: { bg: '#8E288220', color: '#8E2882' },
}

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: user } = useQuery({
    queryKey: ['admin-user-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: org } = useQuery({
    queryKey: ['admin-user-org', user?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('name').eq('id', user!.organisation_id).single()
      if (error) throw error
      return data
    },
    enabled: !!user?.organisation_id,
  })

  const { data: auditEntries } = useQuery({
    queryKey: ['admin-user-audit', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_log').select('*').eq('actor_id', id!).eq('is_demo', getIsDemo()).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  // Role-specific data
  const { data: jobs } = useQuery({
    queryKey: ['admin-user-jobs', id, user?.role],
    queryFn: async () => {
      if (user?.role === 'reviewer') {
        const { data, error } = await supabase.from('jobs').select('id, job_number, status, content_type, word_count, submitted_at, organisation:organisations(name)').eq('reviewer_id', id!).eq('is_demo', getIsDemo()).order('submitted_at', { ascending: false }).limit(15)
        if (error) throw error
        return data
      }
      if (user?.role === 'client') {
        const { data, error } = await supabase.from('jobs').select('id, job_number, status, content_type, word_count, submitted_at').eq('organisation_id', user.organisation_id!).eq('is_demo', getIsDemo()).order('submitted_at', { ascending: false }).limit(15)
        if (error) throw error
        return data
      }
      return []
    },
    enabled: !!user && (user.role === 'reviewer' || user.role === 'client'),
  })

  const { data: leads } = useQuery({
    queryKey: ['admin-user-leads', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('id, reference, contact_name, company_name, stage').eq('owner_id', id!).eq('is_demo', getIsDemo()).order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data
    },
    enabled: !!user && user.role === 'salesperson',
  })

  if (!user) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const rc = ROLE_COLORS[user.role] ?? ROLE_COLORS.admin
  const initials = user.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()
  const isActive = !!user.onboarding_completed_at
  const statusLabel = isActive ? 'Active' : user.invited_at ? 'Invited' : 'Pending'
  const statusColor = isActive ? COLORS.green : COLORS.orange

  return (
    <div className="space-y-6">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to users
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6 flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-light text-gray-600">{initials}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-medium text-gray-900">{user.full_name}</h1>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: rc.bg, color: rc.color }}>{user.role}</span>
              <span className="text-xs" style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
            {user.job_title && <p className="text-sm text-gray-500">{user.job_title}</p>}
            {org && <p className="text-sm text-gray-500">{org.name}</p>}
            {user.bio && <p className="text-sm text-gray-600 mt-2">{user.bio}</p>}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Role" value={user.role} color={rc.color} />
        <MetricCard label="Status" value={statusLabel} color={statusColor} />
        <MetricCard label="Joined" value={user.invited_at ? new Date(user.invited_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'} color={COLORS.cyan} />
        {user.role === 'reviewer' && <MetricCard label="Rate" value={`£${Number(user.rate_per_word ?? 0).toFixed(3)}`} unit="/word" color={COLORS.green} />}
        {user.role === 'salesperson' && <MetricCard label="Commission" value={`${user.default_recurring_pct ?? 0}%`} trend="Recurring" color={COLORS.purple} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Jobs / Leads */}
          {jobs && jobs.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <RainbowStripe height={3} />
              <div className="p-6">
                <h3 className="font-medium text-gray-900 mb-4">{user.role === 'reviewer' ? 'Assigned jobs' : 'Organisation jobs'}</h3>
                <div className="space-y-2">
                  {jobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between p-2 border border-gray-100 rounded text-sm">
                      <div>
                        <span className="font-mono text-xs text-gray-400 mr-2">{j.job_number}</span>
                        <span className="text-gray-900">{j.content_type}</span>
                        {(j as unknown as { organisation?: { name: string } }).organisation && <span className="text-gray-500 ml-2">{(j as unknown as { organisation: { name: string } }).organisation.name}</span>}
                      </div>
                      <StatusBadge status={j.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {leads && leads.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <RainbowStripe height={3} />
              <div className="p-6">
                <h3 className="font-medium text-gray-900 mb-4">Leads</h3>
                <div className="space-y-2">
                  {leads.map(l => (
                    <Link key={l.id} to={`/admin/leads/${l.id}`} className="flex items-center justify-between p-2 border border-gray-100 rounded text-sm hover:border-gray-300">
                      <div>
                        <span className="font-mono text-xs text-gray-400 mr-2">{l.reference}</span>
                        <span className="text-gray-900">{l.contact_name}</span>
                        <span className="text-gray-500 ml-2">{l.company_name}</span>
                      </div>
                      <span className="text-xs text-gray-500">{l.stage}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Activity timeline */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-4">Recent activity</h3>
              {(!auditEntries || auditEntries.length === 0) ? (
                <p className="text-sm text-gray-400 py-4 text-center">No activity recorded</p>
              ) : (
                <div className="space-y-2">
                  {auditEntries.map(e => (
                    <div key={e.id} className="flex items-center gap-3 text-sm">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-400 w-24 shrink-0">{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">{e.action}</span>
                      <span className="text-xs text-gray-500">{e.entity_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Profile details</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="text-gray-900 truncate ml-2">{user.email}</span></div>
              {user.phone && <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{user.phone}</span></div>}
              {user.timezone && <div className="flex justify-between"><span className="text-gray-500">Timezone</span><span>{user.timezone}</span></div>}
              {user.linkedin_url && <div className="flex justify-between"><span className="text-gray-500">LinkedIn</span><a href={user.linkedin_url} target="_blank" className="text-cyan-600 truncate ml-2">Profile</a></div>}
              {user.role === 'reviewer' && user.languages && <div className="flex justify-between"><span className="text-gray-500">Languages</span><span className="text-right text-xs">{user.languages.join(', ')}</span></div>}
              {user.role === 'reviewer' && user.specialism && <div className="flex justify-between"><span className="text-gray-500">Specialism</span><span>{user.specialism}</span></div>}
              {user.stripe_onboarding_completed_at && <div className="flex justify-between"><span className="text-gray-500">Stripe</span><span style={{ color: COLORS.green }}>Connected</span></div>}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Account actions</p>
            <div className="space-y-2">
              <button className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-50 text-gray-700">Reset password</button>
              <button className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-50 text-gray-700">Resend invite</button>
              <button className="w-full text-left text-sm px-3 py-2 rounded hover:bg-red-50 text-red-600">Suspend account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
