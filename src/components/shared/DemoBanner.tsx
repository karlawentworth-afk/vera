import { supabase } from '../../lib/supabase'
import { useDemoMode } from '../../lib/demoMode'

const RAINBOW = ['#E5187A', '#8E2882', '#1B4F9E', '#1FA1D6', '#0F8F4D', '#F4D31E', '#EE7C24', '#D9211E']

export function DemoBanner() {
  const { isDemoMode, setDemoMode } = useDemoMode()
  if (!isDemoMode) return null

  async function returnToChooser() {
    const adminEmail = sessionStorage.getItem('vera_demo_admin_email')
    setDemoMode(false)
    sessionStorage.removeItem('vera_demo_admin_email')

    await supabase.auth.signOut()
    if (adminEmail) {
      await supabase.auth.signInWithPassword({ email: adminEmail, password: 'VeraDemo2026!' })
    }
    window.location.href = '/portal-mode'
  }

  return (
    <div className="relative z-50">
      <div className="flex h-1">
        {RAINBOW.map((c, i) => <div key={i} style={{ background: c, flex: 1 }} />)}
      </div>
      <div className="bg-gray-900 text-white px-4 py-1.5 flex items-center justify-between text-xs">
        <span className="opacity-70">Demo mode — viewing seeded demo data</span>
        <button onClick={returnToChooser} className="hover:underline opacity-90">
          Return to chooser
        </button>
      </div>
    </div>
  )
}
