"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Global flag to prevent duplicate fetches across React Strict Mode
let globalFetchInProgress = false;
let lastFetchTime = 0;

interface Order {
  id: string;
  auth_uid: string;
  status: string;
  created_at: string;
  updated_at: string;
  orderNumber?: string;
  timabilFra?: string;
  timabilTil?: string;
  skjar?: boolean;
  lyklabord?: boolean;
  mus?: boolean;
}

export default function DashboardPage() {
  const { user, loading: authLoading, session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fetchedUserRef = useRef<string | null>(null);

  // Redirect to home if signed out
  useEffect(() => {
    if (!authLoading && !session?.user) {
      router.replace("/");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      if (!isMounted) {
        console.log('Dashboard: Component unmounted, skipping fetch');
        return;
      }

      if (authLoading) {
        console.log('Dashboard: Auth still loading...');
        return;
      }

      if (!session?.user) {
        console.log('Dashboard: No user found, checking session before redirecting...');
        
        // Try to recover session before redirecting
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Dashboard: Session check error:', error);
            if (isMounted) router.push("/");
            return;
          }
          
          if (session?.user) {
            console.log('Dashboard: Session found, waiting for auth context to update...');
            // Wait a bit for auth context to update, then try again
            setTimeout(() => {
              if (isMounted && !user) {
                console.log('Dashboard: Still no user after session found, redirecting to home');
                router.push("/");
              }
            }, 2000);
            return;
          } else {
            console.log('Dashboard: No session found, redirecting to home');
            if (isMounted) router.push("/");
            return;
          }
        } catch (error) {
          console.error('Dashboard: Error checking session:', error);
          if (isMounted) router.push("/");
          return;
        }
      }

      // Check if we've already fetched for this user
      if (fetchedUserRef.current === session.user.id) {
        console.log('Dashboard: Already fetched for this user, skipping');
        return;
      }

      // Prevent duplicate fetches using global flag and time check
      const now = Date.now();
      if (globalFetchInProgress || (now - lastFetchTime < 1000)) {
        console.log('Dashboard: Fetch already in progress or too recent, skipping duplicate');
        return;
      }

      globalFetchInProgress = true;
      lastFetchTime = now;
      fetchedUserRef.current = session.user.id;

      try {
        console.log('Dashboard: User found, fetching orders for auth_uid:', session.user.id);
        
        // Clear any previous errors
        if (isMounted) {
          setError(null);
        }
        
        // Try a simple orders query with a reasonable timeout
        console.log('Dashboard: Starting orders query...');
        console.log('Dashboard: Query details:', {
          auth_uid: session.user.id,
          timestamp: new Date().toISOString()
        });
        
        // Test with a simpler approach first
        console.log('Dashboard: Testing simple query without order...');
        
        try {
          // Try using direct REST API call instead of Supabase client
          console.log('Dashboard: Using direct REST API call...');
          
          const url = `https://aowkzhwmazgsuxuyfhgb.supabase.co/rest/v1/orders?auth_uid=eq.${session.user.id}&select=*`;
          console.log('Dashboard: API URL:', url);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2t6aHdtYXpnc3V4dXlmaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDgyOTMsImV4cCI6MjA3NjE4NDI5M30.B-Slkijbt_fjHVpY8-Z8_O-q8P5qNgqRWbpcu1STIAY',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2t6aHdtYXpnc3V4dXlmaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDgyOTMsImV4cCI6MjA3NjE4NDI5M30.B-Slkijbt_fjHVpY8-Z8_O-q8P5qNgqRWbpcu1STIAY',
              'Content-Type': 'application/json'
            }
          });
          
          console.log('Dashboard: Response status:', response.status);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const ordersData = await response.json();
          console.log('Dashboard: REST API query completed:', ordersData);
          
          // Always update state, even if component is unmounting
          setOrders(ordersData || []);
          setError(null);
          setLoading(false);
          console.log('Dashboard: State updated successfully');
          return;
        } catch (error) {
          console.error('Dashboard: Simple query failed:', error);
          if (isMounted) {
            setError(`Failed to load orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setOrders([]);
            setLoading(false);
          }
          return;
        }
      } catch (error) {
        console.error('Dashboard: Unexpected error:', error);
        console.log('Dashboard: Error fetching orders, setting empty array');
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          setError(`Failed to load orders: ${errorMessage}`);
          setOrders([]);
          setLoading(false);
        }
      } finally {
        globalFetchInProgress = false;
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
      globalFetchInProgress = false;
      console.log('Dashboard: Cleanup function called');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]); // Depend on session instead of authLoading

  // Handle page focus/visibility - refresh data when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Dashboard: Tab became visible, checking if we need to refresh data...');
        
        // If we have a user but no orders, try to fetch again
        if (user && orders.length === 0 && !loading && !error) {
          console.log('Dashboard: User exists but no orders, attempting to refresh...');
          await retryFetchOrders();
        }
      } else {
        console.log('Dashboard: Tab became hidden');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentional empty deps to avoid loops

  // Removed unused handleLogout

  const retryFetchOrders = async () => {
    if (globalFetchInProgress) {
      console.log('Dashboard: Retry already in progress globally, skipping');
      return;
    }

    globalFetchInProgress = true;
    setLoading(true);
    setError(null);
    
    if (!user) {
      globalFetchInProgress = false;
      return;
    }
    
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("auth_uid", user.auth_uid)
        .order("created_at", { ascending: false });
      
      if (ordersError) {
        setError(`Error loading orders: ${ordersError.message}`);
        setOrders([]);
      } else {
        setOrders(ordersData || []);
        setError(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(`Failed to load orders: ${errorMessage}`);
      setOrders([]);
    } finally {
      setLoading(false);
      globalFetchInProgress = false;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Undirbúningur':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Í vinnslu':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Lokið':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Hætt við':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('is-IS', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (dateString?: string) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('is-IS');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Hleður...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pantanir
            </h1>
          </div>

          <div className="mb-6">
            {(() => {
              const fallbackName =
                (session?.user as unknown as { user_metadata?: { full_name?: string } })?.user_metadata?.full_name ||
                session?.user?.email ||
                "Notandi";
              const displayName = (user?.full_name && user.full_name.trim().length > 0) ? user.full_name : fallbackName;
              return (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Velkomin, {displayName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Hér getur þú séð stöðu þinna pantana.
                  </p>
                </>
              );
            })()}
          </div>


          {/* Orders Section */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Mínar pantanir
            </h3>
            
            {error ? (
              <div className="text-center py-12 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-red-900 dark:text-red-200 mb-2">
                  Villa við að hlaða pöntunum
                </h4>
                <p className="text-red-700 dark:text-red-300 mb-4">
                  {error}
                </p>
                <button
                  onClick={retryFetchOrders}
                  disabled={loading}
                  className="inline-flex items-center px-3.5 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Hleður...
                    </>
                  ) : (
                    'Reyna aftur'
                  )}
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Engar pantanir
                </h4>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Þú hefur engar pantanir í gangi.
                </p>
                <button
                  onClick={() => {
                    router.push('/');
                    setTimeout(() => {
                      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                    }, 100);
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-md hover:brightness-95"
                >
                  Sjá vörur
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order: Order) => {
                  const addons: string[] = [];
                  if (order.skjar) addons.push('Skjár');
                  if (order.lyklabord) addons.push('Lyklaborð');
                  if (order.mus) addons.push('Mús');

                  return (
                    <div key={order.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                              Pöntun #{order.orderNumber || order.id.slice(-8)}
                            </h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-300">Stofnað: {formatDate(order.created_at)}</p>
                            {order.updated_at !== order.created_at && (
                              <p className="text-sm text-gray-600 dark:text-gray-300">Uppfært: {formatDate(order.updated_at)}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-3 text-sm">
                          <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 p-3">
                            <p className="text-gray-500 dark:text-gray-400">Byrjun tímabils</p>
                            <p className="mt-1 font-medium text-gray-900 dark:text-white">{formatDateOnly(order.timabilFra)}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 p-3">
                            <p className="text-gray-500 dark:text-gray-400">Tímabil lýkur</p>
                            <p className="mt-1 font-medium text-gray-900 dark:text-white">{formatDateOnly(order.timabilTil)}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 p-3">
                            <p className="text-gray-500 dark:text-gray-400">Aukahlutir</p>
                            <p className="mt-1 font-medium text-gray-900 dark:text-white">{addons.length ? addons.join(', ') : '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
