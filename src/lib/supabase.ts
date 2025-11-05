import { createClient } from '@supabase/supabase-js'

// Read from environment variables (browser-safe)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

function createBrowserClient() {
  // Avoid constructing a Supabase client during SSR/build to prevent env errors
  if (typeof window === 'undefined') {
    // Return a proxy that throws on use, but does not execute at import time
    return new Proxy({}, {
      get() {
        throw new Error('Supabase client is not available on the server during build/prerender.');
      },
    }) as unknown as ReturnType<typeof createClient>;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    // Helpful diagnostic in the browser; still return a proxy to avoid crashes
    console.error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return new Proxy({}, {
      get() {
        throw new Error('Supabase environment variables are missing.');
      },
    }) as unknown as ReturnType<typeof createClient>;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'rentify.supabase.auth.token',
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
}

export const supabase = createBrowserClient()

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
