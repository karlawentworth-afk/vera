import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env and fill in your values.')
}

// Using untyped client — queries return `any` rows.
// Replace with generated types (supabase gen types typescript) when schema stabilises.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
