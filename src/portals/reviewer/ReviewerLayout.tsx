import { Routes, Route } from 'react-router-dom'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { VeraLogo } from '../../components/shared/VeraLogo'
import { PlaceholderPage } from '../../components/shared/PlaceholderPage'
import { useAuth } from '../../lib/auth'

export function ReviewerLayout() {
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
              {['My queue', 'Active review', 'Completed', 'Earnings'].map(label => (
                <span key={label} className="px-3 py-1.5 text-sm text-gray-400 cursor-default">
                  {label}
                </span>
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
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Reviewer portal</p>
          <h1 className="text-2xl font-light text-gray-900 mt-1">{profile?.full_name ?? 'Reviewer'}</h1>
        </div>

        <Routes>
          <Route path="*" element={
            <PlaceholderPage
              title="Reviewer Portal"
              icon="clipboard"
              items={[
                'View your assigned jobs queue with SLA deadlines',
                'Score AI translations across six quality criteria',
                'Track your earnings and download monthly statements',
              ]}
            />
          } />
        </Routes>
      </div>
    </div>
  )
}
