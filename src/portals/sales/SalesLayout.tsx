import { NavLink, Routes, Route } from 'react-router-dom'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { VeraLogo } from '../../components/shared/VeraLogo'
import { PlaceholderPage } from '../../components/shared/PlaceholderPage'
import { useAuth } from '../../lib/auth'
import { SalesDashboard } from './Dashboard'

const NAV_ITEMS = [
  { to: '/sales', label: 'Dashboard', end: true },
  { to: '/sales/clients', label: 'My clients' },
  { to: '/sales/earnings', label: 'Earnings' },
]

export function SalesLayout() {
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
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#8E288220', color: '#8E2882' }}>Sales</span>
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
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Sales portal</p>
          <h1 className="text-2xl font-light text-gray-900 mt-1">{profile?.full_name ?? 'Sales'}</h1>
        </div>

        <Routes>
          <Route index element={<SalesDashboard />} />
          <Route path="clients" element={
            <PlaceholderPage title="My Clients" icon="clipboard" items={['Organisations you introduced and their MRR', 'Commission earned per client', 'Agreement status and expiry dates']} />
          } />
          <Route path="earnings" element={
            <PlaceholderPage title="Earnings" icon="credit-card" items={['Payout history with references', 'Upcoming payout estimate', 'Monthly statements']} />
          } />
        </Routes>
      </div>
    </div>
  )
}
