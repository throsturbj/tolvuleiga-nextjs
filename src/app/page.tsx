"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { supabasePublic } from "@/lib/supabase-public";
import { useAuth } from "@/contexts/AuthContext";
import { debug } from "@/lib/debug";
import heroImage from "../../img/forsidumynd1.jpg";

function LaptopImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % images.length);
    }, 3000);
    return () => clearInterval(t);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white/25">
        <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l3.75-3h10.5L21 7.5v9l-3.75 3H6.75L3 16.5v-9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 14.25l4.5-4.5 6 6 2.25-2.25L21 16.5" />
        </svg>
      </div>
    );
  }

  return (
    <>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={alt}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ease-in-out ${i === idx ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </>
  );
}

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

  interface LaptopItem {
    id: string;
    name: string;
    images: string[];
  }

  interface ScreenItem {
    id: string;
    framleidandi: string;
    skjastaerd: string;
    upplausn: string;
    skjataekni: string;
    endurnyjunartidni: string;
    verd?: string | null;
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
  const [itemsLoading, setItemsLoading] = useState<boolean>(true);
  const [consoles, setConsoles] = useState<GamingConsoleItem[]>([]);
  const [laptops, setLaptops] = useState<LaptopItem[]>([]);
  const [laptopsLoading, setLaptopsLoading] = useState<boolean>(true);
  const [screens, setScreens] = useState<ScreenItem[]>([]);
  const [screensLoading, setScreensLoading] = useState<boolean>(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const { loading: authLoading, session } = useAuth();
  const router = useRouter();
  // Clean native snap-scrolling carousel with center-on-card logic
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const centerToIndex = (idx: number, behavior: ScrollBehavior = 'smooth') => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-review-card="true"]'));
    if (cards.length === 0) return;
    const bounded = Math.max(0, Math.min(idx, cards.length - 1));
    const card = cards[bounded];
    const targetLeft = card.offsetLeft - (el.clientWidth - card.clientWidth) / 2;
    el.scrollTo({ left: Math.max(0, targetLeft), behavior });
  };
  const nextSlide = () => centerToIndex(Math.min(activeIndex + 1, reviews.length - 1));
  const prevSlide = () => centerToIndex(Math.max(activeIndex - 1, 0));
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const updateActive = () => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-review-card="true"]'));
      if (cards.length === 0) { setActiveIndex(0); return; }
      const containerCenter = el.scrollLeft + el.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.clientWidth / 2;
        const dist = Math.abs(cardCenter - containerCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      setActiveIndex(bestIdx);
    };
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          updateActive();
          ticking = false;
        });
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions);
    // Center first card after layout
    requestAnimationFrame(() => {
      centerToIndex(0, 'auto');
      updateActive();
    });
    const onResize = () => {
      centerToIndex(activeIndex, 'auto');
      updateActive();
    };
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', onScroll as EventListener);
      window.removeEventListener('resize', onResize);
    };
  }, [reviews.length]);

  useEffect(() => {
    let isMounted = true;
    const fetchItems = async () => {
      try {
        if (isMounted) setItemsLoading(true);
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
          setItemsLoading(false);
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
          // Batch fetch first images; card price comes from GamingPC.verd
          try {
            const ids = sorted.map((p) => p.id);
            let imageMap: Record<number, { path: string; signedUrl: string } | null> = {};
            if (ids.length > 0) {
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
            }
            const merged = sorted.map((p) => ({
              ...p,
              imageUrl: imageMap[p.id]?.signedUrl,
            }));
            setItems(merged);
            setItemsLoading(false);
            debug('Home/PCs/setItems', { count: merged.length, withImages: !!Object.keys(imageMap).length });
          } catch {
            setItems(sorted);
            setItemsLoading(false);
            debug('Home/PCs/setItems', { count: sorted.length, withImages: false, reason: 'aux fetch error' });
          }
        }
      } catch (e) {
        if (isMounted) {
          console.error('Home: Unexpected error fetching products', e);
          setItems([]);
          setItemsLoading(false);
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
    const fetchLaptops = async () => {
      try {
        if (isMounted) setLaptopsLoading(true);
        const clients = session?.user ? [supabase, supabasePublic] : [supabasePublic, supabase];
        debug('Home/Laptops/start', { hasUser: !!session?.user });
        // 1) Fetch laptops (id + name + active)
        let laptopRows: { id: string; name: string; active: boolean | null }[] | null = null;
        for (const client of clients) {
          try {
            const { data, error } = await client
              .from("laptops")
              .select("id, name, active")
              .order("created_at", { ascending: false });
            if (error) {
              debug('Home/Laptops/error', { client: client === supabase ? 'authed' : 'anon', error });
              continue;
            }
            laptopRows = (data as { id: string; name: string; active: boolean | null }[]) || [];
            debug('Home/Laptops/result', { client: client === supabase ? 'authed' : 'anon', count: laptopRows.length });
            if (laptopRows.length > 0) break;
          } catch (e) {
            debug('Home/Laptops/exception', { error: e });
          }
        }
        if (!isMounted) return;
        const visible = (laptopRows || []).filter((l) => l.active !== false);
        if (visible.length === 0) {
          setLaptops([]);
          setLaptopsLoading(false);
          return;
        }
        // 2) For each laptop, list images under laptopimages/<id>/ and cycle through them
        const merged: LaptopItem[] = await Promise.all(
          visible.map(async (l) => {
            try {
              const res = await fetch("/api/images/list-generic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bucket: "laptopimages", folder: l.id }),
              });
              if (res.ok) {
                const j = await res.json();
                const files: { signedUrl: string }[] = j?.files || [];
                return { id: l.id, name: l.name, images: files.map((f) => f.signedUrl).filter(Boolean) };
              }
            } catch {
              // ignore
            }
            return { id: l.id, name: l.name, images: [] as string[] };
          })
        );
        if (isMounted) {
          setLaptops(merged);
          setLaptopsLoading(false);
          debug('Home/Laptops/set', { count: merged.length });
        }
      } catch (e) {
        if (isMounted) {
          console.error('Home: Unexpected error fetching laptops', e);
          setLaptops([]);
          setLaptopsLoading(false);
        }
      }
    };
    fetchLaptops();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchScreens = async () => {
      try {
        if (isMounted) setScreensLoading(true);
        const clients = session?.user ? [supabase, supabasePublic] : [supabasePublic, supabase];
        debug('Home/Screens/start', { hasUser: !!session?.user });
        let data: ScreenItem[] | null = null;
        let lastError: unknown = null;
        for (const client of clients) {
          try {
            const { data: d, error } = await client
              .from("screens")
              .select("id, framleidandi, skjastaerd, upplausn, skjataekni, endurnyjunartidni, verd")
              .order("created_at", { ascending: false });
            if (error) {
              lastError = error;
              debug('Home/Screens/error', { client: client === supabase ? 'authed' : 'anon', error });
              continue;
            }
            const arr = (d as ScreenItem[]) || [];
            data = arr;
            debug('Home/Screens/result', { client: client === supabase ? 'authed' : 'anon', count: arr.length });
            if (arr.length > 0) break;
          } catch (e) {
            lastError = e;
            debug('Home/Screens/exception', { error: e });
          }
        }
        if (!isMounted) return;
        if (!data) {
          console.error('Home: Error fetching screens', lastError);
          setScreens([]);
          setScreensLoading(false);
          return;
        }
        if (data.length === 0) {
          setScreens([]);
          setScreensLoading(false);
          return;
        }
        try {
          const ids = data.map((s) => s.id);
          const res = await fetch("/api/images/first-generic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bucket: "screens", folders: ids }),
          });
          if (res.ok) {
            const j = await res.json();
            const map: Record<string, { path: string; signedUrl: string } | null> = j?.results || {};
            const merged = data.map((s) => ({
              ...s,
              imageUrl: map[s.id]?.signedUrl || null,
            }));
            setScreens(merged);
            debug('Home/Screens/set', { count: merged.length, withImages: true });
          } else {
            setScreens(data);
            debug('Home/Screens/set', { count: data.length, withImages: false, reason: 'images api !ok' });
          }
        } catch {
          setScreens(data);
          debug('Home/Screens/set', { count: data.length, withImages: false, reason: 'images api error' });
        }
        if (isMounted) setScreensLoading(false);
      } catch (e) {
        if (isMounted) {
          console.error('Home: Unexpected error fetching screens', e);
          setScreens([]);
          setScreensLoading(false);
        }
      }
    };
    fetchScreens();
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
          <span>debug: items={items.length} consoles={consoles.length} screens={screens.length}</span>
        </div>
      ) : null}
      {/* Hero Section */}
      <section className="relative isolate min-h-[min(88vh,920px)] overflow-hidden bg-[#0a0f0c]">
        <Image
          src={heroImage}
          alt="Nemendur að vinna á fartölvum"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%] hero-image-zoom"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/25" />

        <div className="relative mx-auto flex min-h-[min(88vh,920px)] max-w-7xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
          <div className="max-w-xl">
            <h1 className="hero-fade-up text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Tölvuleiga
            </h1>
            <p className="hero-fade-up hero-delay-1 mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
              Hágæða tölvubúnaður fyrir leik, vinnu og nám.
            </p>
            <div className="hero-fade-up hero-delay-2 mt-8">
              <button
                onClick={() => {
                  const el = document.getElementById("laptops");
                  if (el && typeof el.scrollIntoView === "function") {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else {
                    window.location.hash = "#laptops";
                  }
                }}
                className="rounded-md bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_-12px_var(--color-accent)] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                Sjá Vörur
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-3 sm:gap-10">
            <div className="flex flex-col items-center text-center">
              <svg className="h-14 w-14 text-[var(--color-accent)] sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" strokeWidth="1.25" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="mt-5 block h-px w-8 bg-[var(--color-accent)]/70" aria-hidden="true" />
              <h3 className="mt-4 text-xs font-medium uppercase tracking-[0.28em] text-foreground/85 sm:text-sm">
                Nýjasti búnaðurinn
              </h3>
            </div>
            <div className="flex flex-col items-center text-center">
              <svg className="h-14 w-14 text-[var(--color-accent)] sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" strokeWidth="1.25" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span className="mt-5 block h-px w-8 bg-[var(--color-accent)]/70" aria-hidden="true" />
              <h3 className="mt-4 text-xs font-medium uppercase tracking-[0.28em] text-foreground/85 sm:text-sm">
                Fjölbreytt úrval
              </h3>
            </div>
            <div className="flex flex-col items-center text-center">
              <svg className="h-14 w-14 text-[var(--color-accent)] sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" strokeWidth="1.25" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              <span className="mt-5 block h-px w-8 bg-[var(--color-accent)]/70" aria-hidden="true" />
              <h3 className="mt-4 text-xs font-medium uppercase tracking-[0.28em] text-foreground/85 sm:text-sm">
                Hagkvæm lausn
              </h3>
            </div>
          </div>
        </div>
      </section>

      {/* Laptops Section */}
      <section id="laptops" className="relative overflow-hidden bg-gradient-to-br from-[#0b0b12] via-[#11121c] to-[#1a0f1e] py-20">
        {/* Poppy glow accents to make the new launch pop */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[var(--color-accent)]/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Fartölvur og iPadar
            </h2>
            <p className="mt-4 text-lg text-white/70 max-w-2xl mx-auto">
              Fartölvur og iPadar til leigu fullkomnar fyrir vinnu, leik og allt þar á milli.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {laptopsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`lap-sk-${i}`} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="aspect-[4/3] w-full bg-white/10 animate-pulse" />
                  <div className="p-6">
                    <div className="h-6 w-3/5 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : laptops.length === 0 ? (
              <div className="col-span-full text-center text-white/60">
                Fartölvur væntanlegar fljótlega.
              </div>
            ) : (
              laptops.map((l) => (
                <div
                  key={l.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/laptop/${l.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/laptop/${l.id}`); }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-[var(--color-accent)]/60 hover:bg-white/[0.08] hover:shadow-[0_0_40px_-12px_var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <div className="pointer-events-none absolute inset-x-0 -top-px z-10 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/30">
                    <LaptopImageCarousel images={l.images} alt={l.name} />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-[var(--color-accent)] bg-clip-text text-transparent transition-all duration-300 group-hover:from-[var(--color-accent)] group-hover:to-white">
                      {l.name}
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); router.push(`/laptop/${l.id}`); }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_-8px_var(--color-accent)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    >
                      Sjá nánar
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7.22 4.47a.75.75 0 011.06 0l4 4c.3.3.3.77 0 1.06l-4 4a.75.75 0 11-1.06-1.06L10.69 10 7.22 6.53a.75.75 0 010-1.06z" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Properties Preview */}
      <section id="products" className="bg-gray-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Borðtölvur
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Þær allra öflugustu tölvurnar.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {itemsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`sk-${i}`} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="relative aspect-video bg-gray-200 animate-pulse" />
                  <div className="p-6 space-y-2">
                    <div className="h-5 w-3/5 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-4/5 bg-gray-100 rounded animate-pulse" />
                    <div className="mt-4 flex items-center gap-2">
                      <div className="h-9 w-28 bg-gray-200 rounded animate-pulse" />
                      <div className="h-9 w-28 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))
            ) : null}
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
                        const digits = (pc.verd || '').toString().replace(/\D+/g, '');
                        const num = parseInt(digits, 10) || 0;
                        const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                        return `${formatted} kr/mánuði`;
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

      {/* Screens Section */}
      <section id="screens" className="relative overflow-hidden bg-gradient-to-br from-[#0c1216] via-[#101820] to-[#0e1a1c] py-20">
        <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-teal-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-sky-600/15 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Skjáir
            </h2>
            <p className="mt-4 text-lg text-white/70 max-w-2xl mx-auto">
              Flottir skjáir fyrir auka vinnu.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {screensLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`scr-sk-${i}`} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="aspect-[4/3] w-full bg-white/10 animate-pulse" />
                  <div className="p-6 space-y-2">
                    <div className="h-6 w-3/5 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-4/5 bg-white/5 rounded animate-pulse" />
                    <div className="h-5 w-2/5 bg-white/10 rounded animate-pulse mt-2" />
                  </div>
                </div>
              ))
            ) : screens.length === 0 ? (
              <div className="col-span-full text-center text-white/60">
                Skjáir væntanlegir fljótlega.
              </div>
            ) : (
              screens.map((s) => (
                <div
                  key={s.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/productscreen/${s.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/productscreen/${s.id}`); }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-teal-400/50 hover:bg-white/[0.08] hover:shadow-[0_0_40px_-12px_rgba(45,212,191,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                >
                  <div className="pointer-events-none absolute inset-x-0 -top-px z-10 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/30">
                    {s.imageUrl ? (
                      <img
                        src={s.imageUrl}
                        alt={`${s.framleidandi} ${s.skjastaerd}`}
                        className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-white/25">
                        <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25A1.5 1.5 0 015.25 3.75h13.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V5.25z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 20.25h7.5M12 17.25v3" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-teal-300 bg-clip-text text-transparent transition-all duration-300 group-hover:from-teal-300 group-hover:to-white">
                      {s.framleidandi} {s.skjastaerd}
                    </h3>
                    <p className="mt-1 text-sm text-white/60">
                      {[s.upplausn, s.skjataekni, s.endurnyjunartidni].filter(Boolean).join(' · ')}
                    </p>
                    {s.verd ? (
                      <p className="mt-2 text-lg font-bold text-teal-300/90">
                        {(() => {
                          const digits = (s.verd || '').toString().replace(/\D+/g, '');
                          const num = parseInt(digits, 10) || 0;
                          const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                          return `${formatted} kr/mánuði`;
                        })()}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); router.push(`/productscreen/${s.id}`); }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_-8px_rgba(13,148,136,0.7)] hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                    >
                      Sjá nánar
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7.22 4.47a.75.75 0 011.06 0l4 4c.3.3.3.77 0 1.06l-4 4a.75.75 0 11-1.06-1.06L10.69 10 7.22 6.53a.75.75 0 010-1.06z" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
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
          <div className="relative">
            {reviews.length === 0 ? (
              <div className="w-full text-center text-sm text-gray-500">
                Engar umsagnir tiltækar enn.
              </div>
            ) : reviews.length === 1 ? (
              <div className="flex justify-center">
                <div className="w-80 flex-none rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[22rem]">
                  <p
                    className="text-base text-gray-900 flex-1 overflow-hidden"
                    style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
                  >
                    {reviews[0].content}
                  </p>
                  <div className="mt-4">
                    <div className="text-sm text-gray-500">{reviews[0].reviewer_name}</div>
                    <div className="mt-2">{renderStars(reviews[0].rating)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <div
                    ref={scrollerRef}
                    className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory px-2
                    [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {reviews.map((r, idx) => (
                      <div
                        key={r.id}
                        data-review-card="true"
                        className="flex-none w-80 snap-center rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col h-[22rem]"
                      >
                        <p
                          className="text-base text-gray-900 flex-1 overflow-hidden"
                          style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
                        >
                          {r.content}
                        </p>
                        <div className="mt-4">
                          <div className="text-sm text-gray-500">{r.reviewer_name}</div>
                          <div className="mt-2">{renderStars(r.rating)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Fyrri umsögn"
                    onClick={prevSlide}
                    className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 hover:bg-gray-50"
                  >
                    <svg className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.78 15.53a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L8.31 10l4.47 4.47a.75.75 0 010 1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Næsta umsögn"
                    onClick={nextSlide}
                    className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 hover:bg-gray-50"
                  >
                    <svg className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.22 4.47a.75.75 0 011.06 0l5 5c.3.3.3.77 0 1.06l-5 5a.75.75 0 11-1.06-1.06L11.69 10 7.22 5.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="mt-6 flex items-center justify-center gap-2">
                  {reviews.map((_, i) => (
                    <button
                      key={`dot-${i}`}
                      type="button"
                      aria-label={`Fara á umsögn ${i + 1}`}
                      onClick={() => centerToIndex(i)}
                      className={`h-2.5 rounded-full transition-all ${activeIndex === i ? 'w-5 bg-[var(--color-accent)]' : 'w-2.5 bg-gray-300 hover:bg-gray-400'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
