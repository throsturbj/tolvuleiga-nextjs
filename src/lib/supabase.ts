import { createBrowserClient } from '@supabase/ssr'

// Read from environment variables (browser-safe)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

export const supabase = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Keep a runtime error that surfaces clearly in development
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
})()

// Database types
export interface User {
  id: string
  auth_uid: string
  full_name: string
  phone: string
  address: string
  city: string
  postal_code: string
  created_at: string
  updated_at: string
  isAdmin?: boolean
  kennitala?: string
}

export interface AuthUser {
  id: string
  email: string
  created_at: string
}
