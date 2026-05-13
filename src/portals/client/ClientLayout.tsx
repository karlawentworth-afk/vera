import { Routes, Route } from 'react-router-dom'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { PortalNav } from '../../components/shared/PortalNav'
import { PlaceholderPage } from '../../components/shared/PlaceholderPage'
import { useAuth } from '../../lib/auth'
import { ClientDashboard } from './Dashboard'
import { ClientSubmit } from './Submit'
import { ClientAudit } from './Audit'
import { ClientAuditLog } from './AuditLog'
import { ClientGlossary } from './Glossary'
import { OnboardingOverlay } from '../../components/shared/OnboardingOverlay'

const NAV_ITEMS = [
  { to: '/client', label: 'Dashboard', end: true },
  { to: '/client/submit', label: 'Submit work' },
  { to: '/client/jobs', label: 'My jobs' },
  { to: '/client/audit', label: 'AI health' },
  { to: '/client/glossary', label: 'Glossary' },
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
      <PortalNav
        items={NAV_ITEMS}
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

      <OnboardingOverlay />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Routes>
          <Route index element={<ClientDashboard />} />
          <Route path="audit" element={<ClientAudit />} />
          <Route path="audit-log" element={<ClientAuditLog />} />
          <Route path="glossary" element={<ClientGlossary />} />
          <Route path="submit" element={<ClientSubmit />} />
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
