import { Routes, Route } from 'react-router-dom'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { PortalNav } from '../../components/shared/PortalNav'
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
      <PortalNav
        items={NAV_ITEMS}
        badge={{ label: 'Sales', bg: '#8E288220', color: '#8E2882' }}
        rightContent={
          <>
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
            <button onClick={signOut} className="hidden sm:inline text-xs text-gray-400 hover:text-gray-700">
              Sign out
            </button>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Sales portal</p>
          <h1 className="text-xl sm:text-2xl font-light text-gray-900 mt-1">{profile?.full_name ?? 'Sales'}</h1>
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
