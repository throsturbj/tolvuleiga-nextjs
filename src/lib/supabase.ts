import { createClient } from '@supabase/supabase-js'

// Read from environment variables (browser-safe)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // Provide helpful diagnostics in development
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'rentify.supabase.auth.token', // More specific storage key
    storage: {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
      },
    },
  },
})

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
