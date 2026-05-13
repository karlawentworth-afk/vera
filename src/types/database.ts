export type UserRole = 'admin' | 'client' | 'reviewer'

export type JobStatus = 'unallocated' | 'allocated' | 'in_review' | 'awaiting_signoff' | 'delivered' | 'cancelled'

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined'

export type UrgencyLevel = 'standard' | 'expedited'

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          type: 'operator' | 'client'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['organisations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['organisations']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: UserRole
          organisation_id: string | null
          languages: string[] | null
          specialism: string | null
          rate_per_word: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      subscriptions: {
        Row: {
          id: string
          organisation_id: string
          tier_name: string
          monthly_price_pence: number
          word_allowance: number | null
          overflow_rate_pence: number | null
          status: 'active' | 'cancelled' | 'past_due'
          current_period_start: string
          current_period_end: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
      jobs: {
        Row: {
          id: string
          job_number: string
          organisation_id: string
          source_language: string
          target_language: string
          content_type: string
          ai_tool_used: string | null
          word_count: number
          urgency: UrgencyLevel
          status: JobStatus
          reviewer_id: string | null
          notes: string | null
          submitted_at: string
          due_at: string
          delivered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'job_number' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>
      }
      scores: {
        Row: {
          id: string
          job_id: string
          reviewer_id: string
          accuracy: number
          terminology: number
          tone_register: number
          brand_voice: number
          cultural_fit: number
          risk: number
          hter_score: number
          reviewer_notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['scores']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['scores']['Insert']>
      }
      tier_config: {
        Row: {
          id: string
          name: string
          monthly_price_pence: number
          word_allowance: number | null
          overflow_rate_pence: number
          colour: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tier_config']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tier_config']['Insert']>
      }
      audit_log: {
        Row: {
          id: string
          actor_id: string
          action: string
          entity_type: string
          entity_id: string
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      job_status: JobStatus
      urgency_level: UrgencyLevel
    }
  }
}
