import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'

/**
 * Returns the organisation ID to use for client portal views.
 * - For client users: their own organisation_id
 * - For admin users: the first client org (for "View as client" demo)
 */
export function useClientOrgId(): string | null {
  const { profile } = useAuth()

  const { data: firstClientOrg } = useQuery({
    queryKey: ['first-client-org'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('id')
        .eq('type', 'client')
        .order('name')
        .limit(1)
        .single()
      if (error) throw error
      return data.id as string
    },
    enabled: profile?.role === 'admin',
  })

  if (!profile) return null
  if (profile.role === 'client') return profile.organisation_id
  // Admin viewing as client — use first client org
  return firstClientOrg ?? null
}
