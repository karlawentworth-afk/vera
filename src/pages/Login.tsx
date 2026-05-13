import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { RainbowStripe } from '../components/shared/RainbowStripe'
import { VeraLogo } from '../components/shared/VeraLogo'
import type { UserRole } from '../types/database'

const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true'

function roleToPath(role: UserRole): string {
  if (role === 'admin' && DEMO_ENABLED) return '/portal-mode'
  switch (role) {
    case 'admin': return '/admin'
    case 'client': return '/client'
    case 'reviewer': return '/reviewer'
    case 'salesperson': return '/sales'
  }
}

export function LoginPage() {
  const { session, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (session && profile) {
    return <Navigate to={roleToPath(profile.role)} replace />
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)
    if (error) {
      setError(error.message)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/auth/callback',
      },
    })

    setSubmitting(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <RainbowStripe height={6} />
      <div className="max-w-sm mx-auto px-6 pt-24">
        <div className="mb-10">
          <VeraLogo size="lg" />
          <p className="mt-4 text-lg font-light text-gray-500">
            The human-verified governance layer for AI translation.
          </p>
        </div>

        <h2 className="text-base font-medium text-gray-900 mb-6">Sign in to Vera</h2>

        {sent ? (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-base font-medium text-gray-900 mb-2">Check your email</h3>
            <p className="text-sm text-gray-500">
              We've sent a magic link to <span className="font-medium text-gray-700">{email}</span>.
              Click it to sign in.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-4 text-sm text-gray-600 hover:text-gray-900"
            >
              Try a different email
            </button>
          </div>
        ) : mode === 'password' ? (
          <form onSubmit={handlePasswordLogin}>
            <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-400"
            />
            <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2 mt-4">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-400"
            />
            {error && (
              <p className="mt-2 text-sm text-vera-red">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => setMode('magic')}
              className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Use magic link instead
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink}>
            <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-400"
            />
            {error && (
              <p className="mt-2 text-sm text-vera-red">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send magic link'}
            </button>
            <button
              type="button"
              onClick={() => setMode('password')}
              className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Use password instead
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-gray-400 text-center">
          Don't have an account? Contact your administrator.
        </p>
      </div>
    </div>
  )
}
