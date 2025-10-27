import { supabase } from './supabase';

export interface SessionInfo {
  isValid: boolean;
  user: any | null;
  error: string | null;
}

/**
 * Check if the current session is valid and get user info
 */
export async function checkSession(): Promise<SessionInfo> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session check error:', error);
      return {
        isValid: false,
        user: null,
        error: error.message
      };
    }
    
    if (!session?.user) {
      return {
        isValid: false,
        user: null,
        error: 'No active session'
      };
    }
    
    return {
      isValid: true,
      user: session.user,
      error: null
    };
  } catch (error) {
    console.error('Unexpected error checking session:', error);
    return {
      isValid: false,
      user: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<SessionInfo> {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Session refresh error:', error);
      return {
        isValid: false,
        user: null,
        error: error.message
      };
    }
    
    if (!session?.user) {
      return {
        isValid: false,
        user: null,
        error: 'No session after refresh'
      };
    }
    
    return {
      isValid: true,
      user: session.user,
      error: null
    };
  } catch (error) {
    console.error('Unexpected error refreshing session:', error);
    return {
      isValid: false,
      user: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get user profile from the users table
 */
export async function getUserProfile(authUid: string) {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', authUid)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return { profile: null, error: error.message };
    }

    return { profile, error: null };
  } catch (error) {
    console.error('Unexpected error fetching user profile:', error);
    return { 
      profile: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
