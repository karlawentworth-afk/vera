import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { RainbowStripe } from '../components/shared/RainbowStripe'
import { Camera, Save, CheckCircle, ArrowLeft } from 'lucide-react'
import { NotificationPreferences } from '../components/shared/NotificationPreferences'

const TIMEZONES = ['Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome', 'Europe/Warsaw', 'Europe/Stockholm', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai']
const RAINBOW = ['#E5187A', '#8E2882', '#1B4F9E', '#1FA1D6', '#0F8F4D', '#F4D31E', '#EE7C24', '#D9211E']

function getAvatarUrl(profile: { avatar_path?: string | null; full_name: string; id: string }): string {
  if (profile.avatar_path && profile.avatar_path.startsWith('http')) {
    return profile.avatar_path
  }
  const initials = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
  const color = RAINBOW[profile.id.charCodeAt(0) % RAINBOW.length].replace('#', '')
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=200&bold=true&format=svg`
}

export function ProfilePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [bio, setBio] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [timezone, setTimezone] = useState('Europe/London')
  const [contactMethod, setContactMethod] = useState('email')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setPhone((profile as any).phone ?? '')
      setJobTitle(profile.job_title ?? '')
      setBio((profile as any).bio ?? '')
      setLinkedin((profile as any).linkedin_url ?? '')
      setTimezone((profile as any).timezone ?? 'Europe/London')
      setContactMethod((profile as any).preferred_contact_method ?? 'email')
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        phone: phone || null,
        job_title: jobTitle || null,
        bio: bio || null,
        linkedin_url: linkedin || null,
        timezone,
        preferred_contact_method: contactMethod,
      }).eq('id', profile!.id)
      if (error) throw error

      await supabase.from('audit_log').insert({
        actor_id: profile!.id, action: 'profile_updated', entity_type: 'profile', entity_id: profile!.id,
        details: { fields_updated: ['name', 'phone', 'title', 'bio', 'timezone'] },
      })
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      queryClient.invalidateQueries()
    },
  })

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) throw new Error('Max 2MB')
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${profile!.id}.${ext}`

      // Try upload — if bucket doesn't exist, create it first
      let { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error && (error.message.includes('Bucket not found') || error.message.includes('bucket'))) {
        await supabase.storage.createBucket('avatars', { public: true })
        const retry = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
        error = retry.error
      }
      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_path: urlData.publicUrl }).eq('id', profile!.id)
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })

  if (!profile) return null

  const avatarUrl = getAvatarUrl(profile)
  const isReviewer = profile.role === 'reviewer'
  const isSalesperson = profile.role === 'salesperson'

  // Completeness
  const fields = [fullName, phone, jobTitle, bio, linkedin, timezone]
  const filled = fields.filter(Boolean).length
  const completeness = Math.round((filled / fields.length) * 100)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={4} />
        <div className="p-6">
          {/* Avatar */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
              <button onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-700 shadow">
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]
                if (f) avatarMutation.mutate(f)
              }} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">{profile.full_name}</h2>
              <p className="text-sm text-gray-500">{profile.email}</p>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 mt-1 inline-block">{profile.role}</span>
            </div>
          </div>

          {/* Completeness */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Profile completeness</span>
              <span>{completeness}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${completeness}%`, background: completeness >= 80 ? '#0F8F4D' : completeness >= 50 ? '#1FA1D6' : '#EE7C24' }} />
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Full name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Email</label>
                <input type="email" value={profile.email} disabled className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Title / role</label>
                <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Head of Content" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Bio <span className="text-gray-400 normal-case">({bio.length}/500)</span></label>
              <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 500))} placeholder="Tell us about yourself..." className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-gray-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">LinkedIn</label>
                <input type="url" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm">
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Preferred contact</label>
              <div className="flex gap-2">
                {['email', 'phone', 'platform'].map(m => (
                  <button key={m} onClick={() => setContactMethod(m)}
                    className={`text-sm px-3 py-1.5 rounded ${contactMethod === m ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Reviewer-specific */}
            {isReviewer && (
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Reviewer details</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Languages</span><span>{profile.languages?.join(', ') || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Specialism</span><span>{profile.specialism || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Rate</span><span>£{Number(profile.rate_per_word ?? 0).toFixed(3)}/word</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Stripe</span><span>{profile.stripe_onboarding_completed_at ? 'Connected' : 'Not connected'}</span></div>
                </div>
              </div>
            )}

            {/* Salesperson-specific */}
            {isSalesperson && (
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Commission defaults</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Finder's fee</span><span>{profile.default_finders_fee_pct ? `${profile.default_finders_fee_pct}%` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Recurring</span><span>{profile.default_recurring_pct ? `${profile.default_recurring_pct}%` : '—'}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="mt-6 flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved</span>}
            {saveMutation.isError && <span className="text-sm text-red-600">{(saveMutation.error as Error).message}</span>}
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="bg-gray-900 text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> {saveMutation.isPending ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </div>
      </div>

      <NotificationPreferences />
    </div>
  )
}

/**
 * Avatar component — shows user avatar or initial fallback.
 * Use throughout the app to replace initials circles.
 */
export function UserAvatar({ profile, size = 32 }: { profile: { avatar_path?: string | null; full_name: string; id: string }; size?: number }) {
  const url = getAvatarUrl(profile)
  return <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
}
