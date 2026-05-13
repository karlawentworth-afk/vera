import { supabase } from './supabase'

interface SendEmailParams {
  to: string
  template: string
  data: Record<string, string | number | undefined | null>
}

export async function sendEmail({ to, template, data }: SendEmailParams): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ to, template, data: { ...data, login_url: window.location.origin + '/login' } }),
    })
    return resp.ok
  } catch {
    console.error('Email send failed')
    return false
  }
}
