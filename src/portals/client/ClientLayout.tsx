import { NavLink, Routes, Route } from 'react-router-dom'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { VeraLogo } from '../../components/shared/VeraLogo'
import { PlaceholderPage } from '../../components/shared/PlaceholderPage'
import { useAuth } from '../../lib/auth'
import { ClientDashboard } from './Dashboard'
import { ClientAudit } from './Audit'

const NAV_ITEMS = [
  { to: '/client', label: 'Dashboard', end: true },
  { to: '/client/submit', label: 'Submit work' },
  { to: '/client/jobs', label: 'My jobs' },
  { to: '/client/audit', label: 'AI health & audit' },
  { to: '/client/subscription', label: 'Subscription' },
]

export function ClientLayout() {
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
            <nav className="flex gap-1">
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
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
            <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-700">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route index element={<ClientDashboard />} />
          <Route path="audit" element={<ClientAudit />} />
          <Route path="submit" element={
            <PlaceholderPage title="Submit work" icon="upload" items={['Upload AI-translated content for expert review', 'Select language pair, content type, and urgency', 'Track submission through to delivery']} />
          } />
          <Route path="jobs" element={
            <PlaceholderPage title="My jobs" icon="file-text" items={['View all submitted jobs with status tracking', 'Filter by status, language, date', 'Click through to full job detail and audit record']} />
          } />
          <Route path="subscription" element={
            <PlaceholderPage title="Subscription" icon="credit-card" items={['View current tier and word usage', 'Compare available plans', 'Manage payment method and view invoices']} />
          } />
          <Route path="*" element={<ClientDashboard />} />
        </Routes>
      </div>
    </div>
  )
}
