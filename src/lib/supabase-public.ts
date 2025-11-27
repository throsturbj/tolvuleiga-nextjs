import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

// A stateless, anonymous client that never adopts the user session.
// Useful for public reads that should ignore logged-in RLS context.
export const supabasePublic = (() => {
	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
	}
	return createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
			storage: undefined,
		},
	})
})()


