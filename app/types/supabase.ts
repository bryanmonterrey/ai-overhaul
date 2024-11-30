// types/supabase.ts

export type EngagementTarget = Database['public']['Tables']['engagement_targets']['Row']
export type EngagementHistory = Database['public']['Tables']['engagement_history']['Row']

// Add to your existing Database interface:
export interface Database {
  public: {
    Tables: {
      engagement_targets: {
        Row: {
          id: string
          username: string
          topics: string[]
          reply_probability: number
          last_interaction: string | null
          relationship_level: 'new' | 'familiar' | 'close'
          preferred_style: string
          created_at: string
        }
        Insert: Omit<EngagementTarget, 'id' | 'created_at'>
        Update: Partial<Omit<EngagementTarget, 'id' | 'created_at'>>
      }
      engagement_history: {
        Row: {
          id: string
          target_id: string
          tweet_id: string
          reply_id: string
          engagement_type: string
          timestamp: string
          metrics: {
            likes: number
            retweets: number
            replies: number
            impressions: number
            engagement_rate: number
          } | null
          created_at: string
        }
        Insert: Omit<EngagementHistory, 'id' | 'created_at'>
        Update: Partial<Omit<EngagementHistory, 'id' | 'created_at'>>
      }
      // ... your existing tables
    }
  }
}