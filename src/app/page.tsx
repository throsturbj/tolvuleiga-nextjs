"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { supabasePublic } from "@/lib/supabase-public";
import { useAuth } from "@/contexts/AuthContext";

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
    imageUrl?: string;
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

  const [items, setItems] = useState<GamingPCItem[]>([]);
  const [consoles, setConsoles] = useState<GamingConsoleItem[]>([]);
  const { loading: authLoading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    // Wait for auth to initialize so RLS reads (if any) see the right session
    if (authLoading) return;
    const fetchItems = async () => {
      try {
        // Helper: resilient fetch of GamingPC with one refresh attempt, then anon retry
        const loadPcs = async () => {
          const run = async () => {
            return await supabase
              .from("GamingPC")
              .select("id, name, verd, cpu, gpu, storage, uppselt, falid")
              .order("id", { ascending: false });
          };
          let result = await run();
          if (result.error && session?.user) {
            try { await supabase.auth.refreshSession(); } catch {}
            result = await run();
          }
          if (result.error && session?.user) {
            try { await supabase.auth.signOut(); } catch {}
            result = await run();
          }
          return result;
        };

        let { data, error } = await loadPcs();
        // If authenticated read returns empty set (possible RLS), retry anonymously
        if (!error && session?.user && Array.isArray(data) && data.length === 0) {
          try {
            const { data: anonData, error: anonErr } = await supabasePublic
              .from("GamingPC")
              .select("id, name, verd, cpu, gpu, storage, uppselt, falid")
              .order("id", { ascending: false });
            if (!anonErr && Array.isArray(anonData)) {
              data = anonData as typeof data;
            }
          } catch {}
        }
        if (!isMounted) return;
        if (error) {
          console.error('Home: Error fetching products', error);
          setItems([]);
        } else {
          const all = (data as GamingPCItem[]) || [];
          const visible = all.filter((pc) => !pc.falid);
          // Batch fetch first images for visible PCs
          try {
            const ids = visible.map((p) => p.id);
            if (ids.length > 0) {
              const res = await fetch("/api/images/first", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pcIds: ids }),
              });
              if (res.ok) {
                const j = await res.json();
                const map: Record<number, { path: string; signedUrl: string } | null> = j?.results || {};
                const merged = visible.map((p) => ({
                  ...p,
                  imageUrl: map[p.id]?.signedUrl,
                }));
                setItems(merged);
              } else {
                setItems(visible);
              }
            } else {
              setItems(visible);
            }
          } catch {
            setItems(visible);
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
  }, [authLoading, session?.user?.id, session?.access_token]);

  useEffect(() => {
    let isMounted = true;
    if (authLoading) return;
    const fetchConsoles = async () => {
      try {
        // Helper: resilient fetch of consoles with one refresh attempt, then anon retry
        const loadConsoles = async () => {
          const run = async () => {
            return await supabase
              .from("gamingconsoles")
              .select("id, nafn, verd, geymsluplass, numberofextracontrollers, verdextracontrollers, tengi")
              .order("inserted_at", { ascending: false });
          };
          let result = await run();
          if (result.error && session?.user) {
            try { await supabase.auth.refreshSession(); } catch {}
            result = await run();
          }
          if (result.error && session?.user) {
            try { await supabase.auth.signOut(); } catch {}
            result = await run();
          }
          return result;
        };

        let { data, error } = await loadConsoles();
        // If authenticated read returns empty set (possible RLS), retry anonymously
        if (!error && session?.user && Array.isArray(data) && data.length === 0) {
          try {
            const { data: anonData, error: anonErr } = await supabasePublic
              .from("gamingconsoles")
              .select("id, nafn, verd, geymsluplass, numberofextracontrollers, verdextracontrollers, tengi")
              .order("inserted_at", { ascending: false });
            if (!anonErr && Array.isArray(anonData)) {
              data = anonData as typeof data;
            }
          } catch {}
        }
        if (!isMounted) return;
        if (error) {
          console.error('Home: Error fetching consoles', error);
          setConsoles([]);
        } else {
          const all = (data as GamingConsoleItem[]) || [];
          if (all.length === 0) {
            setConsoles([]);
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
            } else {
              setConsoles(all);
            }
          } catch {
            setConsoles(all);
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
  }, [authLoading, session?.user?.id, session?.access_token]);
  return (
    <div className="min-h-screen">
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
                  <p className="text-xl font-bold text-[var(--color-secondary)] mt-2">
                    {(() => {
                      const digits = (pc.verd || '').toString().replace(/\D+/g, '');
                      const base = parseInt(digits, 10) || 0;
                      const raw = Math.round(base * 0.88); // 12% off total price
                      const rounded = Math.ceil(raw / 10) * 10;
                      const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                      return `Frá ${formatted} kr/mánuði`;
                    })()}
                  </p>
                  <Link
                    href={`/product/${pc.id}`}
                    className="mt-4 inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Sjá nánar
                  </Link>
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
    </div>
  );
}
