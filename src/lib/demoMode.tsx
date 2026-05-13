import { createContext, useContext, useState, type ReactNode } from 'react'

interface DemoModeContextType {
  isDemoMode: boolean
  setDemoMode: (v: boolean) => void
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: false,
  setDemoMode: () => {},
})

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setDemoMode] = useState(() => {
    return sessionStorage.getItem('vera_demo_mode') === 'true'
  })

  function handleSetDemoMode(v: boolean) {
    setDemoMode(v)
    if (v) sessionStorage.setItem('vera_demo_mode', 'true')
    else sessionStorage.removeItem('vera_demo_mode')
  }

  return (
    <DemoModeContext.Provider value={{ isDemoMode, setDemoMode: handleSetDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  return useContext(DemoModeContext)
}

/**
 * Returns the is_demo filter value for Supabase queries.
 * Demo mode users see is_demo=true data.
 * Live mode users see is_demo=false data.
 * Non-admin users always see data matching their own is_demo flag.
 */
export function useIsDemo(): boolean {
  const { isDemoMode } = useDemoMode()
  return isDemoMode
}
