import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useDemoMode } from '../lib/demoMode'
import { RainbowStripe } from '../components/shared/RainbowStripe'
import { VeraLogo } from '../components/shared/VeraLogo'
import { Monitor, Users } from 'lucide-react'

export function PortalMode() {
  const { profile, loading } = useAuth()
  const { setDemoMode } = useDemoMode()
  const navigate = useNavigate()

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse text-gray-400 text-sm">Loading...</div></div>
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-white">
      <RainbowStripe height={6} />
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        <div className="mb-12">
          <VeraLogo size="lg" />
          <p className="mt-4 text-lg font-light text-gray-500">Choose your mode</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={() => { setDemoMode(false); navigate('/admin') }}
            className="text-left bg-white border-2 border-gray-900 rounded-lg p-8 hover:bg-gray-50 transition group"
          >
            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mb-4">
              <Monitor className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Live system</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Real client data, real operations. This is production.
            </p>
            <p className="mt-4 text-sm font-medium text-gray-900 group-hover:underline">
              Enter as Emma &rarr;
            </p>
          </button>

          <button
            onClick={() => { setDemoMode(true); navigate('/demo') }}
            className="text-left bg-white border border-gray-200 rounded-lg p-8 hover:border-gray-400 transition group overflow-hidden relative"
          >
            <div className="absolute top-0 left-0 right-0">
              <RainbowStripe height={3} />
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 mt-1">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Demo system</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Walkthrough mode with seeded demo accounts. Perfect for showing prospects.
            </p>
            <p className="mt-4 text-sm text-gray-600 group-hover:text-gray-900 group-hover:underline">
              Choose a user &rarr;
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
