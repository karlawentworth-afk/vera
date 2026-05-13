import { Navigate } from 'react-router-dom'
import { useAuth } from './auth'
import type { UserRole } from '../types/database'

interface RequireAuthProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

function roleToPath(role: UserRole): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'client': return '/client'
    case 'reviewer': return '/reviewer'
    case 'salesperson': return '/sales'
  }
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500 text-sm">Setting up your profile...</div>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={roleToPath(profile.role)} replace />
  }

  return <>{children}</>
}
