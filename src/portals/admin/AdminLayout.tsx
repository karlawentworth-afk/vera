import { Outlet } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { AdminNav } from './AdminNav'
import { useAuth } from '../../lib/auth'

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
      <AdminNav
        rightContent={
          <>
            <a href="/client" className="hidden lg:inline text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">Client</a>
            <a href="/reviewer" className="hidden lg:inline text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">Reviewer</a>
            <Bell className="w-4 h-4 text-gray-400 hidden sm:block" />
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-medium">
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
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Admin</p>
          <h1 className="text-xl sm:text-2xl font-light text-gray-900 mt-1">
            Good morning, {profile?.full_name?.split(' ')[0] ?? 'Admin'}
          </h1>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
