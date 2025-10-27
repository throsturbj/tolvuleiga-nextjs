"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { checkSession, refreshSession } from '@/lib/auth-utils';

interface User {
  id: string;
  auth_uid: string;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  session: any | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ data: any; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    // Get initial session - properly await it
    const getInitialSession = async () => {
      try {
        console.log('AuthContext: Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        console.log('AuthContext: Session:', session);
        setSession(session);
        
        if (error) {
          console.error('AuthContext: Session error:', error);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          console.log('AuthContext: User found, fetching profile...', {
            user_id: session.user.id,
            email: session.user.email
          });
          try {
            await fetchUserProfile(session.user.id);
          } catch (error) {
            console.error('AuthContext: Error fetching profile in getInitialSession:', error);
            setUser(null);
            setLoading(false);
          }
        } else {
          console.log('AuthContext: No user found, setting loading to false');
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('AuthContext: Error getting session:', error);
        if (isMounted) setLoading(false);
      }
    };

    getInitialSession();

    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('AuthContext: Timeout reached, setting loading to false');
      if (isMounted) setLoading(false);
    }, 5000);

    // Listen for auth changes - this is crucial for tab switching
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        console.log('AuthContext: Auth event:', event, session?.user?.id);
        setSession(session);
        
        if (event === 'SIGNED_OUT') {
          console.log('AuthContext: User signed out - clearing all state');
          setUser(null);
          setLoading(false);
          // Clear localStorage on sign out
          if (typeof window !== 'undefined') {
            localStorage.removeItem('rentify.supabase.auth.token');
            localStorage.removeItem('sb-aowkzhwmazgsuxuyfhgb-auth-token');
            Object.keys(localStorage).forEach(key => {
              if (key.includes('supabase') || key.includes('auth')) {
                localStorage.removeItem(key);
              }
            });
          }
        } else if (event === 'SIGNED_IN' || event === 'SIGNED_UP' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
          console.log('AuthContext: User signed in/up or token refreshed, event:', event);
          if (session?.user) {
            console.log('AuthContext: Fetching profile for user:', session.user.id);
            await fetchUserProfile(session.user.id);
          } else {
            console.log('AuthContext: No session user found for event:', event);
          }
        } else {
          console.log('AuthContext: Unhandled auth event:', event);
        }
      }
    );

    // Handle tab visibility changes to refresh session
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isMounted) {
        console.log('AuthContext: Tab became visible, checking session...');
        try {
          const sessionInfo = await checkSession();
          if (sessionInfo.isValid && !user) {
            console.log('AuthContext: Session restored on tab focus');
            await fetchUserProfile(sessionInfo.user.id);
          } else if (!sessionInfo.isValid && user) {
            console.log('AuthContext: Session invalid on tab focus, clearing user');
            setUser(null);
            setLoading(false);
          }
        } catch (error) {
          console.error('AuthContext: Error checking session on tab focus:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Run once on mount to avoid re-subscribing on every session change

  const fetchUserProfile = async (authUid: string) => {
    try {
      console.log('AuthContext: Fetching profile for auth_uid:', authUid);
      
      // Check if we already have this user profile to prevent unnecessary fetches
      if (user && user.auth_uid === authUid) {
        console.log('AuthContext: User profile already loaded for this auth_uid');
        setLoading(false);
        return;
      }
      
      // Check if we have a valid session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('AuthContext: No valid session, skipping profile fetch');
        setUser(null);
        setLoading(false);
        return;
      }
      
      console.log('AuthContext: Session details:', {
        user_id: session.user.id,
        email: session.user.email,
        expires_at: session.expires_at
      });
      
      // Use Supabase client instead of direct fetch
      console.log('AuthContext: Using Supabase client...');
      
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', authUid)
        .single();
      
      console.log('AuthContext: Supabase query completed:', { 
        profileData, 
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null,
        authUid
      });
      
      if (error) {
        console.log('AuthContext: Supabase error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        
        if (error.code === 'PGRST116') {
          // No rows returned - profile doesn't exist
          console.log('AuthContext: Profile not found for existing user - this is normal for new users');
          // Don't set a user object if there's no profile - let them complete their profile first
          setUser(null);
          setLoading(false);
        } else {
          console.error('AuthContext: Unexpected Supabase error:', error);
          setUser(null);
          setLoading(false);
        }
      } else if (profileData) {
        // Profile exists
        console.log('AuthContext: Profile found:', profileData);
        
        // Get email from current session
        const email = session?.user?.email || '';

        // Combine profile data with email
        const userWithEmail = {
          ...profileData,
          email: email
        };

        console.log('AuthContext: Profile fetched:', userWithEmail);
        setUser(userWithEmail);
        setLoading(false);
      } else {
        // Profile doesn't exist
        console.log('AuthContext: Profile not found for existing user');
        setUser(null);
        setLoading(false);
      }
      
    } catch (error) {
      console.error('AuthContext: Error fetching user profile:', error);
      setUser(null);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Starting sign in...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('AuthContext: Sign in error:', error);
      } else {
        console.log('AuthContext: Successfully signed in');
      }
      
      return { data, error };
    } catch (error) {
      console.error('AuthContext: Unexpected error during sign in:', error);
      return { data: null, error };
    }
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    try {
      console.log('AuthContext: Starting sign up...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: metadata ? { data: metadata } : undefined,
      });
      
      if (error) {
        console.error('AuthContext: Sign up error:', error);
      } else {
        console.log('AuthContext: Successfully signed up');
      }
      
      return { data, error };
    } catch (error) {
      console.error('AuthContext: Unexpected error during sign up:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting sign out...');
      
      // Clear session state first
      setSession(null);
      setUser(null);
      setLoading(false);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthContext: Sign out error:', error);
      } else {
        console.log('AuthContext: Successfully signed out');
      }
      
      // Clear localStorage manually to ensure clean state
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rentify.supabase.auth.token');
        localStorage.removeItem('sb-aowkzhwmazgsuxuyfhgb-auth-token');
        // Clear any other Supabase related storage
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      // Navigate to home page
      router.push('/');
      console.log('AuthContext: Navigated to home page');
      
    } catch (error) {
      console.error('AuthContext: Unexpected error during sign out:', error);
      // Still clear local state even if there's an error
      setSession(null);
      setUser(null);
      setLoading(false);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, session, signOut, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}