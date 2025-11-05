"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { checkSession } from '@/lib/auth-utils';
import type { Session } from '@supabase/supabase-js';

interface User {
  id: string;
  auth_uid: string;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  kennitala?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  session: Session | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<Awaited<ReturnType<typeof supabase.auth.signUp>>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();
  const userRef = useRef<User | null>(null);
  const fetchUserProfileRef = useRef<(authUid: string) => Promise<void>>(async () => {});

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Intentional single-subscribe effect
  useEffect(() => {
    let isMounted = true;

    // Get initial session - properly await it
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(session);
        // Keep a lightweight client-visible auth flag for middleware UX redirects
        try {
          if (session?.user) {
            document.cookie = `is-authenticated=true; Path=/; Max-Age=${60 * 60 * 24 * 7}`;
          } else {
            document.cookie = 'is-authenticated=; Path=/; Max-Age=0';
          }
        } catch {}
        
        if (error) {
          console.error('AuthContext: Session error:', error);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          try {
            await fetchUserProfileRef.current(session.user.id);
          } catch (error) {
            console.error('AuthContext: Error fetching profile in getInitialSession:', error);
            setUser(null);
            setLoading(false);
          }
        } else {
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
      if (isMounted) setLoading(false);
    }, 5000);

    // Listen for auth changes - this is crucial for tab switching
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        setSession(session);
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
          // Clear auth flag cookie for middleware UX redirects
          try { document.cookie = 'is-authenticated=; Path=/; Max-Age=0'; } catch {}
          // Clear localStorage on sign out
          if (typeof window !== 'undefined') {
            localStorage.removeItem('rentify.supabase.auth.token');
            Object.keys(localStorage).forEach(key => {
              if (key.includes('supabase') || key.includes('auth')) {
                localStorage.removeItem(key);
              }
            });
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          // Set auth flag cookie so middleware can allow access before server cookies sync
          try { document.cookie = `is-authenticated=${session?.user ? 'true' : ''}; Path=/; Max-Age=${60 * 60 * 24 * 7}`; } catch {}
          if (session?.user) {
            await fetchUserProfileRef.current(session.user.id);
          } else {
          }
        } else {
        }
      }
    );

    // Handle tab visibility changes to refresh session
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isMounted) {
        try {
          const sessionInfo = await checkSession();
          if (sessionInfo.isValid && sessionInfo.user && !userRef.current) {
            await fetchUserProfileRef.current(sessionInfo.user.id);
          } else if (!sessionInfo.isValid && userRef.current) {
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

  const fetchUserProfile = useCallback(async (authUid: string) => {
    try {
      
      // Check if we already have this user profile to prevent unnecessary fetches
      if (user && user.auth_uid === authUid) {
        setLoading(false);
        return;
      }
      
      // Check if we have a valid session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Use Supabase client instead of direct fetch
      
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', authUid)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - profile doesn't exist
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
        // Get email from current session
        const email = session?.user?.email || '';

        // Combine profile data with email
        const userWithEmail = {
          ...profileData,
          email: email
        };

        setUser(userWithEmail);
        setLoading(false);
      } else {
        // Profile doesn't exist
        setUser(null);
        setLoading(false);
      }
      
    } catch (error) {
      console.error('AuthContext: Error fetching user profile:', error);
      setUser(null);
      setLoading(false);
    }
  }, [user]);

  // Keep a ref pointer to the latest fetch function to avoid effect deps
  useEffect(() => {
    fetchUserProfileRef.current = fetchUserProfile;
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      console.error('AuthContext: Sign in error:', result.error);
    }
    return result;
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });
    if (result.error) {
      console.error('AuthContext: Sign up error:', result.error);
    }
    return result;
  };

  const signOut = async () => {
    try {
      
      // Clear session state first
      setSession(null);
      setUser(null);
      setLoading(false);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthContext: Sign out error:', error);
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