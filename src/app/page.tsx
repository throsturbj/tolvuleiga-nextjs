"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { supabasePublic } from "@/lib/supabase-public";
import { useAuth } from "@/contexts/AuthContext";
import { debug } from "@/lib/debug";

export default function Home() {
  interface GamingPCItem {
    id: number;
    name: string;
    verd: string;
    cpu: string;
    gpu: string;
    storage: string;
    uppselt?: boolean;
    falid?: boolean;
    tilbod?: boolean;
    imageUrl?: string;
    price12?: string | null;
  }

  interface GamingConsoleItem {
    id: string;
    nafn: string;
    verd: string;
    geymsluplass: string;
    numberofextracontrollers: string;
    verdextracontrollers: string;
    tengi: string;
    imageUrl?: string | null;
  }

  interface Review {
    id: string;
    content: string;
    reviewer_name: string;
    rating: number;
    created_at?: string;
  }

 

  const [items, setItems] = useState<GamingPCItem[]>([]);
  const [consoles, setConsoles] = useState<GamingConsoleItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const { loading: authLoading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const fetchItems = async () => {
      try {
        // Prefer authed client if user exists; otherwise anon; fallback to the other on failure/empty
        const clients = session?.user ? [supabase, supabasePublic] : [supabasePublic, supabase];
        debug('Home/PCs/start', { hasUser: !!session?.user, order: clients.map((c) => (c === supabase ? 'authed' : 'anon')) });
        let data: GamingPCItem[] | null = null;
        let lastError: unknown = null;
        for (const client of clients) {
          try {
            const { data: d, error } = await client
              .from("GamingPC")
              .select("id, name, verd, cpu, gpu, storage, uppselt, falid, tilbod")
              .order("id", { ascending: false });
            if (error) {
              lastError = error;
              debug('Home/PCs/error', { client: client === supabase ? 'authed' : 'anon', error });
              continue;
            }
            const arr = (d as GamingPCItem[]) || [];
            debug('Home/PCs/result', { client: client === supabase ? 'authed' : 'anon', count: arr.length });
            if (arr.length > 0) {
              data = arr;
              break;
            } else {
              // keep trying next client if current returned empty
              data = arr;
            }
          } catch (e) {
            lastError = e;
            debug('Home/PCs/exception', { client: client === supabase ? 'authed' : 'anon', error: e });
          }
        }
        if (!isMounted) return;
        if (!data) {
          console.error('Home: Error fetching products', lastError);
          setItems([]);
        } else {
          const visible = data.filter((pc) => pc.falid === true ? false : true);
          // Sort by numeric verd ascending (smallest price first)
          const sorted = [...visible].sort((a, b) => {
            const aDigits = (a.verd || '').toString().replace(/\D+/g, '');
            const bDigits = (b.verd || '').toString().replace(/\D+/g, '');
            const aNum = parseInt(aDigits, 10) || 0;
            const bNum = parseInt(bDigits, 10) || 0;
            return aNum - bNum;
          });
          debug('Home/PCs/visible', { count: sorted.length });
          // Batch fetch auxiliary data (images + 12-month prices)
          try {
            const ids = sorted.map((p) => p.id);
            let imageMap: Record<number, { path: string; signedUrl: string } | null> = {};
            let priceMap: Record<number, string | null> = {};
            if (ids.length > 0) {
              // 1) Images via server route
              try {
                const res = await fetch("/api/images/first", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pcIds: ids }),
                });
                if (res.ok) {
                  const j = await res.json();
                  imageMap = (j?.results || {}) as Record<number, { path: string; signedUrl: string } | null>;
                }
              } catch {
                // ignore, keep empty map
              }
              // 2) Prices from Supabase (try authed/anon in same order)
              const clientsForPrices = session?.user ? [supabase, supabasePublic] : [supabasePublic, supabase];
              for (const c of clientsForPrices) {
                try {
                  const { data: pricesRows, error: pricesErr } = await c
                    .from("prices")
                    .select('gamingpc_id, "12month"')
                    .in("gamingpc_id", ids);
                  if (!pricesErr && Array.isArray(pricesRows)) {
                    priceMap = {};
                    for (const row of pricesRows as Array<{ gamingpc_id: number; "12month": string | null }>) {
                      priceMap[row.gamingpc_id] = row["12month"] ?? null;
                    }
                    break;
                  }
                } catch {
                  // try next client
                }
              }
            }
            const merged = sorted.map((p) => ({
              ...p,
              imageUrl: imageMap[p.id]?.signedUrl,
              price12: priceMap[p.id] ?? null,
            }));
            setItems(merged);
            debug('Home/PCs/setItems', { count: merged.length, withImages: !!Object.keys(imageMap).length, withPrices: !!Object.keys(priceMap).length });
          } catch {
            setItems(sorted);
            debug('Home/PCs/setItems', { count: sorted.length, withImages: false, withPrices: false, reason: 'aux fetch error' });
          }
        }
      } catch (e) {
        if (isMounted) {
          console.error('Home: Unexpected error fetching products', e);
          setItems([]);
        }
      }
    };
    fetchItems();
    return () => { isMounted = false; };
    // Re-run when auth state finishes initializing or when user identity changes
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchConsoles = async () => {
      try {
        // Prefer authed client if user exists; otherwise anon; fallback to the other on failure/empty
        const clients = session?.user ? [supabase, supabasePublic] : [supabasePublic, supabase];
        debug('Home/Consoles/start', { hasUser: !!session?.user, order: clients.map((c) => (c === supabase ? 'authed' : 'anon')) });
        let data: GamingConsoleItem[] | null = null;
        let lastError: unknown = null;
        for (const client of clients) {
          try {
            const { data: d, error } = await client
              .from("gamingconsoles")
              .select("id, nafn, verd, geymsluplass, numberofextracontrollers, verdextracontrollers, tengi")
              .order("inserted_at", { ascending: false });
            if (error) {
              lastError = error;
              debug('Home/Consoles/error', { client: client === supabase ? 'authed' : 'anon', error });
              continue;
            }
            const arr = (d as GamingConsoleItem[]) || [];
            // Accept empty arrays too; we just prefer a non-empty source if available
            data = arr;
            debug('Home/Consoles/result', { client: client === supabase ? 'authed' : 'anon', count: arr.length });
            if (arr.length > 0) break;
          } catch (e) {
            lastError = e;
            debug('Home/Consoles/exception', { client: client === supabase ? 'authed' : 'anon', error: e });
          }
        }
        if (!isMounted) return;
        if (!data) {
          console.error('Home: Error fetching consoles', lastError);
          setConsoles([]);
        } else {
          const all = data || [];
          if (all.length === 0) {
            setConsoles([]);
            debug('Home/Consoles/set', { count: 0 });
            return;
          }
          try {
            const ids = all.map((c) => c.id);
            const res = await fetch("/api/images/first-generic", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bucket: "consoles", folders: ids }),
            });
            if (res.ok) {
              const j = await res.json();
              const map: Record<string, { path: string; signedUrl: string } | null> = j?.results || {};
              const merged = all.map((c) => ({
                ...c,
                imageUrl: map[c.id]?.signedUrl || null,
              }));
              setConsoles(merged);
              debug('Home/Consoles/set', { count: merged.length, withImages: true });
            } else {
              setConsoles(all);
              debug('Home/Consoles/set', { count: all.length, withImages: false, reason: 'images api !ok' });
            }
          } catch {
            setConsoles(all);
            debug('Home/Consoles/set', { count: all.length, withImages: false, reason: 'images api error' });
          }
        }
      } catch (e) {
        if (isMounted) {
          console.error('Home: Unexpected error fetching consoles', e);
          setConsoles([]);
        }
      }
    };
    fetchConsoles();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      try {
        // Public reads should work via anon due to RLS policy
        // Fall back to authed if needed
        const clients = session?.user ? [supabasePublic, supabase] : [supabasePublic, supabase];
        let data: Review[] | null = null;
        for (const client of clients) {
          try {
            const { data: rows, error } = await client
              .from("reviews")
              .select("id, content, reviewer_name, rating, created_at")
              .eq("is_published", true)
              .order("created_at", { ascending: false });
            if (!error && Array.isArray(rows)) {
              data = rows as Review[];
              break;
            }
          } catch {
            // try next
          }
        }
        if (!isMounted) return;
        setReviews(data ?? []);
      } catch {
        if (isMounted) setReviews([]);
      }
    };
    fetchReviews();
    return () => { isMounted = false; };
  }, []);

  const renderStars = (rating: number) => {
    const stars = [];
    const clamped = Math.max(0, Math.min(5, Number(rating) || 0));
    for (let i = 1; i <= 5; i++) {
      const filled = i <= clamped;
      stars.push(
        <svg
          key={i}
          className={`h-4 w-4 ${filled ? 'text-yellow-500' : 'text-gray-300'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.036a1 1 0 00-1.176 0l-2.802 2.036c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
    return <div className="flex gap-1" aria-label={`${clamped} stjörnur`}>{stars}</div>;
  };

 
  return (
    <div className="min-h-screen">
      {process.env.NEXT_PUBLIC_DEBUG === 'true' ? (
        <div className="fixed bottom-2 right-2 z-50 text-[10px] bg-black/70 text-white px-2 py-1 rounded">
          <span>debug: items={items.length} consoles={consoles.length}</span>
        </div>
      ) : null}
      {/* Hero Section */}
      <section className="bg-[var(--color-primary)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
              <span className="text-[var(--color-secondary)]">Tölvuleiga</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Við bjóðum upp á hágæða leikjatölvur á sanngjörnu verði – fyrir þá sem vilja afköst, gæði og áreiðanleika í einni vél.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => {
                  const el = document.getElementById('products');
                  if (el && typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    window.location.hash = '#products';
                  }
                }}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
                Sjá Vörur
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
                <svg className="h-6 w-6 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Nýjar tölvur</h3>
              <p className="mt-2 text-gray-600">Nýjar tölvur með nýjustu tækni, öflugustu örgjörvunum og glæsilegustu íhlutunum – tilbúnar fyrir allt sem þú krefst.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
                <svg className="h-6 w-6 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Auðveldar uppfærslur</h3>
              <p className="mt-2 text-gray-600">Auðvelt er að uppfæra íhluti samkvæmt samningi, svo tölvan þín heldur alltaf í við nýjustu tækni.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
                <svg className="h-6 w-6 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Besta verðið</h3>
              <p className="mt-2 text-gray-600">Það er engin þörf á að eyða fúlgum fjár í nýja tölvu. Leigðu hjá okkur á sanngjörnu verði og fáðu hámarksafköst án þess að tæma veskið.</p>
            </div>
          </div>
        </div>
      </section>

      

      {/* Featured Properties Preview */}
      <section id="products" className="bg-gray-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Tölvur
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Finndu tölvu sem hentar þér best.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((pc) => (
              <div
                key={pc.id}
                className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer"
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/product/${pc.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/product/${pc.id}`); }}
              >
                <div className="relative aspect-video overflow-hidden bg-gray-200">
                  {pc.imageUrl ? (
                    <>
                      <img
                        src={pc.imageUrl}
                        alt={pc.name}
                        className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                      {pc.tilbod ? (
                        <div className="pointer-events-none absolute top-0 left-0 z-[2] w-full h-0">
                          <span className="absolute -left-10 top-3 w-44 rotate-[-18deg] text-center inline-block bg-gradient-to-r from-amber-600 to-orange-500 text-white text-[11px] sm:text-xs font-extrabold uppercase tracking-wide px-0 py-1.5 shadow-xl ring-1 ring-white/70">
                            Nýárstilboð
                          </span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l3.75-3h10.5L21 7.5v9l-3.75 3H6.75L3 16.5v-9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 14.25l4.5-4.5 6 6 2.25-2.25L21 16.5" />
                      </svg>
                    </div>
                  )}
                  {pc.uppselt ? (
                    <div className="absolute bottom-0 left-0 right-0">
                      <div className="mx-2 mb-2 rounded border border-gray-400 bg-gray-800/80 text-white text-xs font-semibold text-center py-1">
                        Uppselt!
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900">{pc.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {pc.gpu} · {pc.cpu} · {pc.storage}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xl font-bold text-[var(--color-secondary)]">
                      {(() => {
                        const digits = (pc.price12 || '').toString().replace(/\D+/g, '');
                        const num = parseInt(digits, 10) || 0;
                        const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                        return `Frá ${formatted} kr/mánuði`;
                      })()}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/product/${pc.id}`}
                      className="inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Sjá nánar
                    </Link>
                    {pc.uppselt ? (
                      <Link
                        href={`/product/${pc.id}`}
                        className="inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Skrá á biðlista
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {consoles.map((c) => (
              <div
                key={c.id}
                className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer"
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/console/${c.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/console/${c.id}`); }}
              >
                <div className="relative aspect-video overflow-hidden bg-gray-200">
                  {c.imageUrl ? (
                    <>
                      <img
                        src={c.imageUrl}
                        alt={c.nafn}
                        className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l3.75-3h10.5L21 7.5v9l-3.75 3H6.75L3 16.5v-9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 14.25l4.5-4.5 6 6 2.25-2.25L21 16.5" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900">{c.nafn}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {c.geymsluplass} · {c.tengi}
                  </p>
                  <p className="text-xl font-bold text-[var(--color-secondary)] mt-2">
                    {(() => {
                      const digits = (c.verd || '').toString().replace(/\D+/g, '');
                      const base = parseInt(digits, 10) || 0;
                      const raw = Math.round(base * 0.88); // 12% off total price
                      const rounded = Math.ceil(raw / 10) * 10;
                      const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                      return `Frá ${formatted} kr/mánuði`;
                    })()}
                  </p>
                  <Link
                    href={`/console/${c.id}`}
                    className="mt-4 inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Sjá nánar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Umsagnir viðskiptavina
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="w-full sm:w-80 lg:w-72 flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              >
                <p className="text-base text-gray-900">
                  {r.content}
                </p>
                <div className="mt-4">
                  <div className="text-sm text-gray-500">
                    {r.reviewer_name}
                  </div>
                  <div className="mt-2">
                    {renderStars(r.rating)}
                  </div>
                </div>
              </div>
            ))}
            {reviews.length === 0 ? (
              <div className="w-full text-center text-sm text-gray-500">
                Engar umsagnir tiltækar enn.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
