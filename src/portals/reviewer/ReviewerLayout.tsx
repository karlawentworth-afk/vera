import { Routes, Route } from 'react-router-dom'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { PortalNav } from '../../components/shared/PortalNav'
import { useAuth } from '../../lib/auth'
import { ReviewerQueue } from './Queue'
import { ReviewerScoring } from './Scoring'
import { ReviewerCompleted } from './Completed'
import { ReviewerEarnings } from './Earnings'
import { ReviewerSettings } from './Settings'

const NAV_ITEMS = [
  { to: '/reviewer', label: 'My queue', end: true },
  { to: '/reviewer/review', label: 'Active review' },
  { to: '/reviewer/completed', label: 'Completed' },
  { to: '/reviewer/earnings', label: 'Earnings' },
  { to: '/reviewer/settings', label: 'Settings' },
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Reviewer portal</p>
          <h1 className="text-xl sm:text-2xl font-light text-gray-900 mt-1">{profile?.full_name ?? 'Reviewer'}</h1>
          {profile?.specialism && (
            <p className="text-sm text-gray-500 mt-1">{profile.languages?.join(', ')} · {profile.specialism}</p>
          )}
        </div>

        <Routes>
          <Route index element={<ReviewerQueue />} />
          <Route path="review/:jobId" element={<ReviewerScoring />} />
          <Route path="review" element={<ReviewerQueue />} />
          <Route path="completed" element={<ReviewerCompleted />} />
          <Route path="earnings" element={<ReviewerEarnings />} />
          <Route path="settings" element={<ReviewerSettings />} />
        </Routes>
      </div>
    </div>
  )
}
