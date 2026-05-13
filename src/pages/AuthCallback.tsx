import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { RainbowStripe } from '../components/shared/RainbowStripe'
import { VeraLogo } from '../components/shared/VeraLogo'
import type { UserRole } from '../types/database'

function roleToPath(role: UserRole): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'client': return '/client'
    case 'reviewer': return '/reviewer'
    case 'salesperson': return '/sales'
  }
}

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      try {
        // Supabase picks up the token from the URL hash automatically
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

        if (sessionErr) {
          console.error('Session error:', sessionErr)
          setError(sessionErr.message)
          return
        }

        if (!session) {
          // Try exchanging the hash params — some Supabase versions need this
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            const { error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (setErr) {
              setError(setErr.message)
              return
            }
          } else {
            // No tokens at all — might be an expired link
            setError('No valid session found. The magic link may have expired.')
            return
          }
        }

        // Now get the profile to determine role
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Could not retrieve user.')
          return
        }

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profErr || !profile) {
          setError('Profile not found. Contact your administrator.')
          return
        }

        // Redirect to the right portal
        navigate(roleToPath(profile.role as UserRole), { replace: true })
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(String(err))
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-white">
      <RainbowStripe height={6} />
      <div className="max-w-sm mx-auto px-6 pt-24 text-center">
        <VeraLogo size="lg" />
        {error ? (
          <div className="mt-8">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <a href="/login" className="text-sm text-gray-600 hover:text-gray-900 underline">
              Back to login
            </a>
          </div>
        ) : (
          <div className="mt-8">
            <div className="animate-pulse text-gray-400 text-sm">Signing you in...</div>
          </div>
        )}
      </div>
    </div>
  )
}
