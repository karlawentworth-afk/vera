import { supabase } from './supabase'

interface InviteParams {
  email: string
  full_name: string
  role: 'client' | 'reviewer' | 'salesperson'
  organisation_name?: string
  organisation_id?: string
  tier_name?: string
  job_title?: string
  personal_note?: string
  languages?: string[]
  specialism?: string
  rate_per_word?: number
  default_finders_fee_pct?: number
  default_recurring_pct?: number
}

export async function inviteUser(params: InviteParams): Promise<{ success: boolean; user_id?: string; organisation_id?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { success: false, error: 'Not authenticated' }

  const resp = await fetch('/.netlify/functions/invite-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  })

  const data = await resp.json()
  if (!resp.ok) return { success: false, error: data.error }
  return { success: true, user_id: data.user_id, organisation_id: data.organisation_id }
}

export async function resendInvite(email: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return false

  // Generate a magic link via the admin API
  try {
    const resp = await fetch('/.netlify/functions/resend-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email }),
    })
    return resp.ok
  } catch {
    return false
  }
}
