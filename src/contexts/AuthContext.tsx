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

    const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
    const setCookie = (key: string, value: string, maxAgeSeconds: number) => {
      try {
        document.cookie = `${key}=${value}; Path=/; Max-Age=${maxAgeSeconds}`;
      } catch {}
    };
    const clearCookie = (key: string) => {
      try {
        document.cookie = `${key}=; Path=/; Max-Age=0`;
      } catch {}
    };
    const getCookie = (key: string): string | null => {
      try {
        const m = document.cookie.match(new RegExp(`(?:^|; )${key.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}=([^;]*)`));
        return m ? decodeURIComponent(m[1]) : null;
      } catch {
        return null;
      }
    };

    // Get initial session - properly await it
    const getInitialSession = async () => {
      try {
        const initial = await supabase.auth.getSession();
        let { session } = initial.data;
        const error = initial.error;
        
        if (!isMounted) return;

        // Initialize session-start timestamp if missing (do NOT extend on refresh)
        try {
          if (session?.user) {
            const existing = getCookie('session-start');
            if (!existing) {
              setCookie('session-start', String(Date.now()), 60 * 60 * 24 * 7); // client-visible, short-lived policy enforced elsewhere
            }
          } else {
            clearCookie('session-start');
          }
        } catch {}

        // If the session exists but is expired (or about to), refresh it before proceeding
        try {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const expiresAt = (session as { expires_at?: number } | null)?.expires_at;
          if (session?.user && typeof expiresAt === 'number' && expiresAt <= nowSeconds + 5) {
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('AuthContext: Error refreshing expired session on init:', refreshError);
            } else {
              session = refreshed.session;
            }
          }
        } catch (refreshCheckErr) {
          console.error('AuthContext: Failed checking/refreshing session expiry on init:', refreshCheckErr);
        }

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
          // Clear session-start cookie
          try { document.cookie = 'session-start=; Path=/; Max-Age=0'; } catch {}
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
          // Only set session-start when we first sign in (do NOT extend on token refresh)
          if (event === 'SIGNED_IN' && session?.user) {
            const existing = getCookie('session-start');
            if (!existing) {
              setCookie('session-start', String(Date.now()), 2 * 60 * 60); // 2 hours
            }
            try { localStorage.setItem('sessionStartedAt', String(Date.now())); } catch {}
          }
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

    // Strict 2-hour session cap: check periodically and force sign-out if exceeded
    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const startedAtStr = (typeof window !== 'undefined' && localStorage.getItem('sessionStartedAt')) || getCookie('session-start');
        const startedAt = startedAtStr ? parseInt(startedAtStr, 10) : NaN;
        if (Number.isFinite(startedAt)) {
          const age = Date.now() - startedAt;
          if (age > SESSION_MAX_AGE_MS) {
            // Force sign out and clear markers
            try { clearCookie('session-start'); } catch {}
            try { localStorage.removeItem('sessionStartedAt'); } catch {}
            try { await supabase.auth.signOut(); } catch (e) { console.error('AuthContext: Forced sign-out error', e); }
            setSession(null);
            setUser(null);
            setLoading(false);
            router.push('/auth');
          }
        }
      } catch (e) {
        // No-op
      }
    }, 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      clearInterval(interval);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Run once on mount to avoid re-subscribing on every session change

  const fetchUserProfile = useCallback(async (authUid: string) => {
    try {
      // Avoid unnecessary refetches of the same user
      if (user && user.auth_uid === authUid) {
        setLoading(false);
        return;
      }

      // Ensure we have a valid session before querying the profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Add a small retry to smooth over occasional transient failures
      let attempt = 0;
      let lastError: unknown = null;
      while (attempt < 2) {
        try {
          const { data: profileData, error } = await supabase
            .from('users')
            .select('*')
            .eq('auth_uid', authUid)
            .single();

          if (error) {
            // PGRST116 = no rows; don't retry in that case
            if ((error as { code?: string }).code === 'PGRST116') {
              setUser(null);
              setLoading(false);
              return;
            }
            lastError = error;
            attempt += 1;
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 350));
              continue;
            }
            console.error('AuthContext: Supabase error fetching profile:', error);
            setUser(null);
            setLoading(false);
            return;
          }

          if (profileData) {
            const email = session?.user?.email || '';
            const userWithEmail = { ...profileData, email };
            setUser(userWithEmail);
            setLoading(false);
            return;
          }

          // No data returned
          setUser(null);
          setLoading(false);
          return;
        } catch (innerErr) {
          lastError = innerErr;
          attempt += 1;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          console.error('AuthContext: Error fetching user profile (final):', innerErr);
          setUser(null);
          setLoading(false);
          return;
        }
      }

      if (lastError) {
        console.error('AuthContext: Failed to fetch profile after retries:', lastError);
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
    // Fire-and-forget welcome email if user object exists
    try {
      const authUid = result.data.user?.id;
      const userEmail = result.data.user?.email;
      if (authUid && userEmail) {
        fetch('/api/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authUid, email: userEmail }),
        }).catch(() => {});
      }
    } catch {}
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