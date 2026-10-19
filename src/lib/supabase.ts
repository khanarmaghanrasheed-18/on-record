import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export type Profile = {
  id: string
  display_name: string
  friend_code: string
  created_at: string
}

export type Friendship = {
  id: string
  user_a: string
  user_b: string
  requested_by: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export type FriendConnection = Friendship & { person: Profile }
