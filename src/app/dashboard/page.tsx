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
  verd?: number;
  gamingpc_uuid?: number | null;
  pdf_url?: string | null;
}

interface GamingPCItem {
  id: number;
  name: string;
  verd?: string | null;
  cpu?: string | null;
  gpu?: string | null;
  storage?: string | null;
  motherboard?: string | null;
  powersupply?: string | null;
  cpucooler?: string | null;
  ram?: string | null;
}

export default function DashboardPage() {
  const { user, loading: authLoading, session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fetchedUserRef = useRef<string | null>(null);
  const [pcNamesById, setPcNamesById] = useState<Record<number, string>>({});
  const [pcById, setPcById] = useState<Record<number, GamingPCItem>>({});
  const [openPcId, setOpenPcId] = useState<number | null>(null);
  const [busyOpenPdfById, setBusyOpenPdfById] = useState<Record<string, boolean>>({});

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
        // Clear any previous errors
        if (isMounted) setError(null)

        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('auth_uid', session.user.id)
          .order('created_at', { ascending: false })

        if (ordersError) {
          if (isMounted) {
            setError(`Failed to load orders: ${ordersError.message}`)
            setOrders([])
            setLoading(false)
          }
          return
        }

        const ids = Array.from(
          new Set((ordersData || []).map(o => o.gamingpc_uuid).filter((v: unknown): v is number => typeof v === 'number'))
        )
        if (ids.length > 0) {
          try {
            const { data: pcRows } = await supabase
              .from('GamingPC')
              .select('id,name,verd,cpu,gpu,storage,motherboard,powersupply,cpucooler,ram')
              .in('id', ids as number[])
            const map: Record<number, string> = {}
            const byId: Record<number, GamingPCItem> = {}
            ;(pcRows || []).forEach((r: GamingPCItem) => { map[r.id] = r.name; byId[r.id] = r })
            setPcNamesById(map)
            setPcById(byId)
          } catch {}
        } else {
          setPcNamesById({})
          setPcById({})
        }

        setOrders(ordersData || [])
        setError(null)
        setLoading(false)
        return
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

  // Removed legacy getStatusColor (no longer used)

  const getStatusMeta = (status: string) => {
    const accentBadge = 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30';
    const neutralBadge = 'bg-gray-100 text-gray-800 ring-1 ring-gray-300';
    const progress = 'from-[var(--color-accent)] to-[var(--color-accent)]';
    switch (status) {
      case 'Undirbúningur':
        return { step: 0, badge: accentBadge, progress };
      case 'Í gangi':
        return { step: 1, badge: accentBadge, progress };
      case 'Í vinnslu': // collapsed into the second milestone visually
        return { step: 1, badge: accentBadge, progress };
      case 'Lokið':
        return { step: 2, badge: accentBadge, progress };
      case 'Hætt við':
        return { step: 2, badge: neutralBadge, progress };
      default:
        return { step: 0, badge: neutralBadge, progress };
    }
  };

  const formatPrice = (value: unknown) => {
    const n = typeof value === 'number' ? value : parseInt((value as string | undefined || '').toString().replace(/\D+/g, ''), 10);
    if (!Number.isFinite(n)) return null;
    return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr/mánuði`;
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

  const handleOpenPdf = async (orderId: string, url?: string | null, orderNumber?: string | null) => {
    if (orderNumber && typeof window !== 'undefined') {
      window.open(`/${encodeURIComponent(orderNumber)}/pdf`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!url) return;
    setBusyOpenPdfById((p) => ({ ...p, [orderId]: true }));
    try {
      try { await supabase.auth.refreshSession(); } catch {}
      // Try parsing bucket/path from signed URL
      let bucket: string | null = null;
      let objectPath: string | null = null;
      try {
        const u = new URL(url);
        const marker = '/storage/v1/object/sign/';
        const idx = u.pathname.indexOf(marker);
        if (idx !== -1) {
          const after = u.pathname.slice(idx + marker.length);
          const parts = after.split('/');
          bucket = parts.shift() || null;
          objectPath = parts.length > 0 ? decodeURIComponent(parts.join('/')) : null;
        }
      } catch {}

      if (bucket && objectPath) {
        // Prefer server route to sign fresh URL
        const apiRes = await fetch(`/api/pdf?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(objectPath)}`);
        if (apiRes.ok) {
          const json = await apiRes.json();
          const signedUrl: string | undefined = json?.signedUrl;
          if (signedUrl) {
            window.open(signedUrl, '_blank', 'noopener,noreferrer');
            return;
          }
        }
        // Fallback to client download
        const { data: file } = await supabase.storage.from(bucket).download(objectPath);
        if (file) {
          const blobUrl = URL.createObjectURL(file);
          window.open(blobUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        // Last resort: sign via url param
        const apiRes2 = await fetch(`/api/pdf?url=${encodeURIComponent(url)}`);
        if (apiRes2.ok) {
          const json = await apiRes2.json();
          const signedUrl2: string | undefined = json?.signedUrl;
          if (signedUrl2) {
            window.open(signedUrl2, '_blank', 'noopener,noreferrer');
            return;
          }
        }
        throw new Error('Gat ekki opnað PDF');
      }

      // If not signed URL format, try direct fetch with auth header
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Open PDF failed', e);
    } finally {
      setBusyOpenPdfById((p) => ({ ...p, [orderId]: false }));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-4 text-gray-600">Hleður...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Simple header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {(() => {
              const fallbackName =
                (session?.user as unknown as { user_metadata?: { full_name?: string } })?.user_metadata?.full_name ||
                session?.user?.email ||
                "Notandi";
              const displayName = (user?.full_name && user.full_name.trim().length > 0) ? user.full_name : fallbackName;
              return (
                <>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 truncate">{displayName}</h1>
                </>
              );
            })()}
          </div>
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs md:text-sm font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30 whitespace-nowrap">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
            {orders.length} pantanir
          </span>
        </div>

        {/* Orders content */}
        <div>
            {error ? (
              <div className="text-center py-12 rounded-2xl bg-red-50 ring-1 ring-red-200">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-red-900 mb-2">Villa við að hlaða pöntunum</h4>
                <p className="text-red-700 mb-5">{error}</p>
                <button
                  onClick={retryFetchOrders}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white bg-[var(--color-accent)] hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Hleður...
                    </>
                  ) : (
                    'Reyna aftur'
                  )}
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <div className="mb-4">
                  <svg className="mx-auto h-14 w-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900">Engar pantanir ennþá</h4>
                <p className="mt-2 text-gray-600">Byrjaðu ferðina – finndu rétta tölvuna fyrir þig.</p>
                <div className="mt-6">
                  <button
                    onClick={() => {
                      router.push('/#products');
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-[var(--color-accent)] hover:brightness-110 shadow"
                  >
                    Sjá vörur
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map((order: Order) => {
                  const addons: string[] = [];
                  if (order.skjar) addons.push('Skjár');
                  if (order.lyklabord) addons.push('Lyklaborð');
                  if (order.mus) addons.push('Mús');
                  const meta = getStatusMeta(order.status);
                  const progressMap = [10, 57, 100];
                  const progressWidth = `${progressMap[Math.min(Math.max(meta.step, 0), 2)]}%`;

                  return (
                    <div key={order.id} className="group relative rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="rounded-2xl p-5 h-full flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-gray-900 tracking-tight">
                                Pöntun #{order.orderNumber || order.id.slice(-8)}
                              </h4>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                              {order.gamingpc_uuid ? (
                                <button
                                  type="button"
                                  onClick={() => setOpenPcId(order.gamingpc_uuid!)}
                                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/5 hover:bg-black/10 text-gray-900 text-xs font-medium"
                                >
                                  {pcNamesById[order.gamingpc_uuid] || 'Vara'}
                                </button>
                              ) : 'Vara'}
                              {(() => { const p = formatPrice(order.verd); return p ? (<span className="ml-1 text-gray-900 font-semibold">{p}</span>) : null; })()}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${meta.badge} shadow-sm`}>{order.status}</span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mt-4">
                          <div className="relative h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div className={`relative h-full bg-gradient-to-r ${meta.progress} transition-[width] duration-500 ease-out`} style={{ width: progressWidth }}>
                              {(order.status !== 'Lokið' && order.status !== 'Hætt við') ? (
                                <div
                                  className="absolute inset-0 opacity-25"
                                  style={{
                                    backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 10px, transparent 10px, transparent 20px)',
                                    backgroundSize: '40px 40px',
                                    animation: 'progressShift 1.2s linear infinite'
                                  }}
                                />
                              ) : null}
                            </div>
                            {meta.step < 2 ? (
                              <div
                                className="absolute top-1/2 h-3 w-3 rounded-full bg-[var(--color-accent)] ring-2 ring-white shadow transform -translate-x-1/2 -translate-y-1/2"
                                style={{ left: progressWidth }}
                              />
                            ) : null}
                          </div>
                          <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                            <span>Undirbúningur</span>
                            <span>Í gangi</span>
                            <span>Lokið</span>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs items-stretch">
                          <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 h-full flex flex-col justify-between">
                            <p className="text-gray-500 whitespace-nowrap">Byrjun tímabils</p>
                            <p className="mt-1 font-semibold text-gray-900 text-sm">{formatDateOnly(order.timabilFra)}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 h-full flex flex-col justify-between">
                            <p className="text-gray-500 whitespace-nowrap">Tímabil lýkur</p>
                            <p className="mt-1 font-semibold text-gray-900 text-sm">{formatDateOnly(order.timabilTil)}</p>
                          </div>
                        </div>

                        {/* Addons label above created line */}
                        <div className="mt-3 text-xs md:text-sm text-gray-700 text-center">
                          <span className="text-gray-500">Aukahlutir:</span> <span className="font-medium text-gray-900">{addons.length ? addons.join(', ') : '—'}</span>
                        </div>

                        {/* Created line between boxes and buttons */}
                        <div className="mt-4 text-xs md:text-sm text-gray-600 text-center">Stofnað: {formatDate(order.created_at)}</div>

                        <div className="mt-5 flex items-center justify-center gap-3">
                          {order.pdf_url || order.orderNumber ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPdf(order.id, order.pdf_url, order.orderNumber)}
                              disabled={!!busyOpenPdfById[order.id]}
                              className="inline-flex items-center justify-center gap-2 rounded-full w-40 px-3 py-2 text-xs font-semibold text-white bg-[var(--color-accent)] hover:brightness-110 disabled:opacity-50"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11v8m0 0l-3-3m3 3l3-3M5 7h14"/></svg>
                              Sækja reikning
                            </button>
                          ) : null}
                          {order.gamingpc_uuid ? (
                            <button
                              type="button"
                              onClick={() => setOpenPcId(order.gamingpc_uuid!)}
                              className="inline-flex items-center justify-center gap-2 rounded-full w-40 px-3 py-2 text-xs font-semibold text-[var(--color-accent)] bg-white ring-1 ring-[var(--color-accent)]/30 hover:bg-gray-50"
                            >
                              Sjá vöru
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Product modal */}
        {openPcId && pcById[openPcId] ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpenPcId(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 z-10">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{pcById[openPcId].name}</h3>
                <button onClick={() => setOpenPcId(null)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="aspect-video rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 mb-3" />
                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
                    <div className="rounded-xl ring-1 ring-gray-200 p-3 min-h-[88px] h-full flex flex-col justify-between">
                      <p className="text-gray-500">Skjákort</p>
                      <p className="mt-1 font-semibold text-gray-900">{pcById[openPcId].gpu || '—'}</p>
                    </div>
                    <div className="rounded-xl ring-1 ring-gray-200 p-3 min-h-[88px] h-full flex flex-col justify-between">
                      <p className="text-gray-500">Örgjörvi</p>
                      <p className="mt-1 font-semibold text-gray-900">{pcById[openPcId].cpu || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm content-start">
                  <div className="rounded-xl ring-1 ring-gray-200 p-3 min-h-[88px] h-full flex flex-col justify-between">
                    <p className="text-gray-500">Geymsla</p>
                    <p className="mt-1 font-semibold text-gray-900">{pcById[openPcId].storage || '—'}</p>
                  </div>
                  <div className="rounded-xl ring-1 ring-gray-200 p-3 min-h-[88px] h-full flex flex-col justify-between">
                    <p className="text-gray-500">Móðurborð</p>
                    <p className="mt-1 font-semibold text-gray-900">{pcById[openPcId].motherboard || '—'}</p>
                  </div>
                  <div className="rounded-xl ring-1 ring-gray-200 p-3 min-h-[88px] h-full flex flex-col justify-between">
                    <p className="text-gray-500">Vinnsluminni</p>
                    <p className="mt-1 font-semibold text-gray-900">{pcById[openPcId].ram || '—'}</p>
                  </div>
                  <div className="rounded-xl ring-1 ring-gray-200 p-3 min-h-[88px] h-full flex flex-col justify-between">
                    <p className="text-gray-500">Aflgjafi</p>
                    <p className="mt-1 font-semibold text-gray-900">{pcById[openPcId].powersupply || '—'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-right">
                <button onClick={() => setOpenPcId(null)} className="inline-flex items-center px-3 py-1.5 text-sm rounded-full ring-1 ring-gray-300 text-gray-700 hover:bg-gray-50">Loka</button>
              </div>
            </div>
          </div>
        ) : null}
        <style jsx global>{`
          @keyframes progressShift {
            0% { background-position: 0 0; }
            100% { background-position: 40px 0; }
          }
        `}</style>
      </div>
    </div>
  );
}
