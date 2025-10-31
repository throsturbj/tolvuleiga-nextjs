import { createClient } from '@supabase/supabase-js'

// Temporary hardcoded values for testing
const supabaseUrl = 'https://aowkzhwmazgsuxuyfhgb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2t6aHdtYXpnc3V4dXlmaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDgyOTMsImV4cCI6MjA3NjE4NDI5M30.B-Slkijbt_fjHVpY8-Z8_O-q8P5qNgqRWbpcu1STIAY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
