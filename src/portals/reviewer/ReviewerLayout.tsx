import { NavLink, Routes, Route } from 'react-router-dom'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { VeraLogo } from '../../components/shared/VeraLogo'
import { PlaceholderPage } from '../../components/shared/PlaceholderPage'
import { useAuth } from '../../lib/auth'
import { ReviewerQueue } from './Queue'
import { ReviewerScoring } from './Scoring'

const NAV_ITEMS = [
  { to: '/reviewer', label: 'My queue', end: true },
  { to: '/reviewer/review', label: 'Active review' },
  { to: '/reviewer/completed', label: 'Completed' },
  { to: '/reviewer/earnings', label: 'Earnings' },
]

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
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Reviewer portal</p>
          <h1 className="text-2xl font-light text-gray-900 mt-1">{profile?.full_name ?? 'Reviewer'}</h1>
          {profile?.specialism && (
            <p className="text-sm text-gray-500 mt-1">{profile.languages?.join(', ')} · {profile.specialism}</p>
          )}
        </div>

        <Routes>
          <Route index element={<ReviewerQueue />} />
          <Route path="review/:jobId" element={<ReviewerScoring />} />
          <Route path="review" element={<ReviewerQueue />} />
          <Route path="completed" element={
            <PlaceholderPage title="Completed" icon="clock" items={['Read-only list of past reviews with hTER scores', 'Earnings per job', 'Downloadable audit records']} />
          } />
          <Route path="earnings" element={
            <PlaceholderPage title="Earnings" icon="credit-card" items={['Current month estimate', 'Past payouts on the 28th', 'Downloadable monthly statements']} />
          } />
        </Routes>
      </div>
    </div>
  )
}
