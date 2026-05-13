import { NavLink, Outlet } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { VeraLogo } from '../../components/shared/VeraLogo'
import { useAuth } from '../../lib/auth'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/insights', label: 'AI Insights' },
  { to: '/admin/reviewers', label: 'Reviewers' },
  { to: '/admin/sales', label: 'Sales & commissions' },
  { to: '/admin/quotes', label: 'Quotes' },
  { to: '/admin/invoices', label: 'Invoices & Pay' },
  { to: '/admin/settings', label: 'Tiers & pricing' },
]

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-gray-50">
      <RainbowStripe height={4} />
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <VeraLogo size="sm" />
            <span className="text-xs px-2 py-0.5 rounded bg-gray-900 text-white">Admin</span>
            <nav className="flex gap-1 flex-wrap">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href="/client" className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">View as client</a>
            <a href="/reviewer" className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">View as reviewer</a>
            <Bell className="w-4 h-4 text-gray-400" />
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
            <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-700">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Admin</p>
          <h1 className="text-2xl font-light text-gray-900 mt-1">
            Good morning, {profile?.full_name?.split(' ')[0] ?? 'Admin'}
          </h1>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
