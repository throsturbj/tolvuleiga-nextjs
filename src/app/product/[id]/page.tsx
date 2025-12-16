"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface GamingPCRow {
  id: number;
  name: string;
  verd: string;
  cpu: string;
  gpu: string;
  storage: string;
  motherboard?: string;
  powersupply?: string;
  cpucooler?: string;
  ram?: string;
  uppselt?: boolean;
}

interface ScreenItem {
  id: string;
  framleidandi: string;
  skjastaerd: string;
  upplausn: string;
  skjataekni: string;
  endurnyjunartidni: string;
  verd?: string | null;
}

interface KeyboardItem {
  id: string;
  nafn: string;
  framleidandi: string;
  staerd: string;
  tengimoguleiki: string;
  verd?: string | null;
}

interface MouseItem {
  id: string | number;
  nafn: string;
  framleidandi: string;
  fjolditakk: string;
  toltakka: string;
  tengimoguleiki: string;
  verd?: string | null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const productIdParam = params.id as string;
  const productIdNum = Number(productIdParam);
  const [product, setProduct] = useState<GamingPCRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<{ name: string; path: string; signedUrl: string }[]>([]);
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  // Linked accessories
  const [screens, setScreens] = useState<ScreenItem[]>([]);
  const [keyboards, setKeyboards] = useState<KeyboardItem[]>([]);
  const [mouses, setMouses] = useState<MouseItem[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [selectedKeyboardId, setSelectedKeyboardId] = useState<string | null>(null);
  const [selectedMouseId, setSelectedMouseId] = useState<string | number | null>(null);
  // Accessory modal
  const [modalType, setModalType] = useState<null | 'screen' | 'keyboard' | 'mouse'>(null);
  const [modalImages, setModalImages] = useState<{ name: string; path: string; signedUrl: string }[]>([]);
  const [modalActiveIndex, setModalActiveIndex] = useState<number>(0);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);
  // Screen hero (when it's the only accessory)
  const [screenHeroImages, setScreenHeroImages] = useState<{ name: string; path: string; signedUrl: string }[]>([]);
  const [screenLightboxOpen, setScreenLightboxOpen] = useState<boolean>(false);
  const [screenLightboxIndex, setScreenLightboxIndex] = useState<number>(0);
  // Mobile bubble position control
  const [bubbleBottomPx, setBubbleBottomPx] = useState<number>(32);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  // Insurance UI
  const [insured, setInsured] = useState<boolean>(false);
  const [animatingInsurance, setAnimatingInsurance] = useState<boolean>(false);
  // Waitlist state
  const [isWaitlisting, setIsWaitlisting] = useState<boolean>(false);
  const [waitlisted, setWaitlisted] = useState<boolean>(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProduct = async () => {
      if (!productIdNum || Number.isNaN(productIdNum)) {
        setError("Röng vöruauðkenni");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("GamingPC")
          .select("*")
          .eq("id", productIdNum)
          .single();
        if (!isMounted) return;
        if (error) {
          setError(error.message);
          setProduct(null);
        } else {
          setProduct(data as GamingPCRow);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Unknown error");
          setProduct(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProduct();
    return () => { isMounted = false; };
  }, [productIdNum]);

  useEffect(() => {
    let alive = true;
    const fetchImages = async () => {
      if (!productIdNum || Number.isNaN(productIdNum)) return;
      setImagesLoading(true);
      try {
        const res = await fetch("/api/images/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pcId: productIdNum }),
        });
        if (!alive) return;
        if (res.ok) {
          const j = await res.json();
          const files: { name: string; path: string; signedUrl: string }[] = j?.files || [];
          setImages(files);
          setActiveImageIndex(0);
        } else {
          setImages([]);
        }
      } catch {
        if (alive) setImages([]);
      } finally {
        if (alive) setImagesLoading(false);
      }
    };
    fetchImages();
    return () => { alive = false; };
  }, [productIdNum]);

  // Rental UI (kept on product page)
  const durations = [1, 3, 6, 9, 12] as const;
  const [durationIndex, setDurationIndex] = useState<number>(0);
  const sliderProgress = (durationIndex / (durations.length - 1)) * 100;
  const [addons, setAddons] = useState({ skjár: false, lyklabord: false, mus: false });
  type ProgressStyle = React.CSSProperties & { ['--progress']?: string };
  const progressStyle: ProgressStyle = { '--progress': `${sliderProgress}%` };

  // Load linked accessories
  useEffect(() => {
    let alive = true;
    const fetchLinks = async () => {
      if (!productIdNum || Number.isNaN(productIdNum)) return;
      try {
        // Screens
        const { data: screenLinks } = await supabase
          .from("screen_gamingpcs")
          .select("screen_id")
          .eq("gamingpc_id", productIdNum);
        const screenIds = (screenLinks || []).map((x: { screen_id: string }) => x.screen_id);
        if (screenIds.length > 0) {
          const { data: screenRows } = await supabase
            .from("screens")
            .select("id, framleidandi, skjastaerd, upplausn, skjataekni, endurnyjunartidni, verd")
            .in("id", screenIds);
          if (alive) {
            const list = (screenRows || []) as unknown as ScreenItem[];
            setScreens(list);
            setSelectedScreenId(list[0]?.id ?? null);
          }
        } else if (alive) {
          setScreens([]);
          setSelectedScreenId(null);
        }
        // Keyboards
        const { data: kbLinks } = await supabase
          .from("keyboard_gamingpcs")
          .select("keyboard_id")
          .eq("gamingpc_id", productIdNum);
        const kbIds = (kbLinks || []).map((x: { keyboard_id: string }) => x.keyboard_id);
        if (kbIds.length > 0) {
          const { data: kbRows } = await supabase
            .from("keyboards")
            .select("id, nafn, framleidandi, staerd, tengimoguleiki, verd")
            .in("id", kbIds);
          if (alive) {
            const list = (kbRows || []) as unknown as KeyboardItem[];
            setKeyboards(list);
            setSelectedKeyboardId(list[0]?.id ?? null);
          }
        } else if (alive) {
          setKeyboards([]);
          setSelectedKeyboardId(null);
        }
        // Mouses
        const { data: msLinks } = await supabase
          .from("mouse_gamingpcs")
          .select("mouse_id")
          .eq("gamingpc_id", productIdNum);
        const msIds = (msLinks || []).map((x: { mouse_id: string | number }) => x.mouse_id);
        if (msIds.length > 0) {
          const { data: msRows } = await supabase
            .from("mouses")
            .select("id, nafn, framleidandi, fjolditakk, toltakka, tengimoguleiki, verd")
            .in("id", msIds as (string | number)[]);
          if (alive) {
            const list = (msRows || []) as unknown as MouseItem[];
            setMouses(list);
            setSelectedMouseId(list[0]?.id ?? null);
          }
        } else if (alive) {
          setMouses([]);
          setSelectedMouseId(null);
        }
      } catch {}
    };
    fetchLinks();
    return () => { alive = false; };
  }, [productIdNum]);

  // Fetch monthly prices from `prices` table
  const [priceRow, setPriceRow] = useState<null | {
    "1month"?: string | null;
    "3month"?: string | null;
    "6month"?: string | null;
    "9month"?: string | null;
    "12month"?: string | null;
  }>(null);
  useEffect(() => {
    let alive = true;
    const fetchPrices = async () => {
      try {
        const { data, error } = await supabase
          .from("prices")
          .select(' "1month", "3month", "6month", "9month", "12month" ')
          .eq("gamingpc_id", productIdNum)
          .single();
        if (!alive) return;
        if (!error && data) {
          setPriceRow(data as typeof priceRow);
        } else {
          setPriceRow(null);
        }
      } catch {
        if (alive) setPriceRow(null);
      }
    };
    if (productIdNum && Number.isFinite(productIdNum)) {
      fetchPrices();
    } else {
      setPriceRow(null);
    }
    return () => { alive = false; };
  }, [productIdNum]);

  const parsePrice = (s: string | null | undefined) => {
    const digits = String(s || "").replace(/\D+/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const screenPrice = addons.skjár && selectedScreenId
    ? parsePrice(screens.find(s => s.id === selectedScreenId)?.verd)
    : 0;
  const keyboardPrice = addons.lyklabord && selectedKeyboardId
    ? parsePrice(keyboards.find(k => k.id === selectedKeyboardId)?.verd)
    : 0;
  const mousePrice = addons.mus && selectedMouseId !== null
    ? parsePrice(mouses.find(m => String(m.id) === String(selectedMouseId))?.verd)
    : 0;
  const addOnTotal = screenPrice + keyboardPrice + mousePrice;

  const handleOrderClick = () => {
    try {
      if (typeof window !== 'undefined') {
        const selection = {
          productId: productIdParam,
          months: durations[durationIndex],
          addons: {
            skjár: addons.skjár,
            lyklabord: addons.lyklabord,
            mus: addons.mus,
          },
          insured,
          finalPrice,
          selected: {
            screenId: selectedScreenId,
            keyboardId: selectedKeyboardId,
            mouseId: selectedMouseId,
          },
        };
        window.sessionStorage.setItem('orderSelection', JSON.stringify(selection));
      }
    } catch {}
    if (session?.user) {
      // User is signed in, redirect to order confirmation page
      router.push(`/order/${productIdParam}`);
    } else {
      // User is not signed in, redirect to auth page
      router.push(`/auth?redirect=/order/${productIdParam}`);
    }
  };

  const onlyScreen = screens.length > 0 && keyboards.length === 0 && mouses.length === 0;

  // Load hero image for screen if it's the only accessory
  useEffect(() => {
    let alive = true;
    const loadScreenHero = async () => {
      if (!onlyScreen) {
        if (alive) setScreenHeroImages([]);
        return;
      }
      const id = selectedScreenId || screens[0]?.id;
      if (!id) {
        if (alive) setScreenHeroImages([]);
        return;
      }
      try {
        const res = await fetch('/api/images/list-generic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket: 'screens', folder: String(id) }),
        });
        if (!alive) return;
        if (res.ok) {
          const j = await res.json();
          setScreenHeroImages(j?.files || []);
        } else {
          setScreenHeroImages([]);
        }
      } catch {
        if (alive) setScreenHeroImages([]);
      }
    };
    loadScreenHero();
    return () => { alive = false; };
  }, [onlyScreen, selectedScreenId, screens]);

  // Keep mobile bubble above footer
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const base = 32; // px
    const spacing = 8; // px extra clearance above footer
    const update = () => {
      try {
        const footer = document.querySelector('footer') as HTMLElement | null;
        if (!footer) {
          setBubbleBottomPx(base);
          return;
        }
        const rect = footer.getBoundingClientRect();
        const vh = window.innerHeight || 0;
        const overlap = vh - rect.top; // >0 when footer enters viewport
        if (overlap > 0) {
          setBubbleBottomPx(base + overlap + spacing);
        } else {
          setBubbleBottomPx(base);
        }
      } catch {
        setBubbleBottomPx(base);
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true } as EventListenerOptions);
    window.addEventListener('resize', update);
    const id = window.setInterval(update, 500); // mitigate layout shifts
    return () => {
      window.removeEventListener('scroll', update as unknown as EventListener);
      window.removeEventListener('resize', update as unknown as EventListener);
      window.clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">Hleður vörunni…</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Vörunni finnst ekki
          </h1>
          <p className="text-gray-600 mb-8">
            Því miður fannst vörunni ekki.
          </p>
          <Link
            href="/"
            className="rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            Til baka
          </Link>
        </div>
      </div>
    );
  }

  const basePrice = (() => {
    const digits = (product.verd || '').toString().replace(/\D+/g, '');
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
  })();
  // Derive monthly base either from prices table or fallback discount
  const durationValue = durations[durationIndex];
  const monthlyFromTable = (() => {
    if (!priceRow) return null;
    if (durationValue === 1) return parsePrice(priceRow["1month"] || "");
    if (durationValue === 3) return parsePrice(priceRow["3month"] || "");
    if (durationValue === 6) return parsePrice(priceRow["6month"] || "");
    if (durationValue === 9) return parsePrice(priceRow["9month"] || "");
    if (durationValue === 12) return parsePrice(priceRow["12month"] || "");
    return null;
  })();
  const fallbackDiscountRates = [0, 0.04, 0.08, 0.10, 0.12] as const; // includes 9 months fallback
  const fallbackRate = fallbackDiscountRates[durationIndex] ?? 0;
  const fallbackMonthly = Math.max(0, Math.round(basePrice * (1 - fallbackRate)));
  const monthlyBase = Number.isFinite(monthlyFromTable ?? NaN) && (monthlyFromTable ?? 0) > 0 ? (monthlyFromTable as number) : fallbackMonthly;

  // Accessories are added on top (not discounted)
  const insuranceMultiplier = insured ? 1.1 : 1;
  const finalPriceRaw = Math.round((monthlyBase + addOnTotal) * insuranceMultiplier);
  const finalPrice = Math.ceil(finalPriceRaw / 10) * 10;
  const formattedPrice = `${finalPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr`;

  const openAccessoryModal = async (type: 'screen' | 'keyboard' | 'mouse') => {
    setModalType(type);
    setModalActiveIndex(0);
    setModalImages([]);
    const list = type === 'screen' ? screens : type === 'keyboard' ? keyboards : mouses;
    const id = type === 'screen'
      ? (selectedScreenId || list[0]?.id)
      : type === 'keyboard'
        ? (selectedKeyboardId || list[0]?.id)
        : (selectedMouseId ?? list[0]?.id ?? null);
    if (!id) return;
    setModalLoading(true);
    try {
      const bucket = type === 'screen' ? 'screens' : type === 'keyboard' ? 'keyboards' : 'mouses';
      const res = await fetch('/api/images/list-generic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, folder: String(id) }),
      });
      if (res.ok) {
        const j = await res.json();
        setModalImages(j?.files || []);
      } else {
        setModalImages([]);
      }
    } catch {
      setModalImages([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleWaitlistClick = async () => {
    if (!product) return;
    // Require auth similar to order flow
    if (!session?.user) {
      router.push(`/auth?redirect=/product/${productIdParam}`);
      return;
    }
    if (isWaitlisting || waitlisted) return;
    setIsWaitlisting(true);
    setWaitlistError(null);
    try {
      const { error } = await supabase
        .from('preorders')
        .insert({
          auth_uid: session.user.id,
          gamingpc_uuid: productIdNum,
        });
      if (error) {
        setWaitlistError(error.message || 'Mistókst að skrá á biðlista');
        return;
      }
      setWaitlisted(true);
      // Best-effort admin email notification
      try {
        await fetch('/api/preorders/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: productIdNum, productName: product.name }),
        });
      } catch {}
      // Go to dashboard after success
      router.push('/dashboard');
    } catch (e) {
      setWaitlistError(e instanceof Error ? e.message : 'Mistókst að skrá á biðlista');
    } finally {
      setIsWaitlisting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-3">
      <div className={
        `relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 rounded-lg border bg-white overflow-hidden ` +
        (insured ? 'border-green-500' : 'border-transparent')
      }>
        {/* Insurance border draw animation overlay */}
        {animatingInsurance ? (
          <>
            <svg className="pointer-events-none absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="99" height="99" rx="2" ry="2" fill="none" stroke="rgb(34,197,94)" strokeWidth="1" vectorEffect="non-scaling-stroke" pathLength="100" className="draw-border" />
            </svg>
            <div className="pointer-events-none absolute inset-0 bg-green-500/10 animate-flash" aria-hidden="true" />
          </>
        ) : null}
        <div className="grid gap-8 md:grid-cols-2 items-start">
          {/* Left: Product Images */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center">
              {imagesLoading ? (
                <div className="text-gray-400 text-sm">Hleð myndum…</div>
              ) : images.length > 0 ? (
                <>
                  <img
                    key={images[activeImageIndex]?.path}
                    src={images[activeImageIndex]?.signedUrl}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain"
                    loading="eager"
                  />
                  {images.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveImageIndex((i) => (i - 1 + images.length) % images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
                        aria-label="Fyrri mynd"
                        title="Fyrri mynd"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 111.06 1.06L9.31 10l3.47 3.47a.75.75 0 010 1.06z"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
                        aria-label="Næsta mynd"
                        title="Næsta mynd"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7.22 4.47a.75.75 0 011.06 0l4 4c.3.3.3.77 0 1.06l-4 4a.75.75 0 11-1.06-1.06L10.69 10 7.22 6.53a.75.75 0 010-1.06z"/></svg>
                      </button>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="text-gray-400 text-sm">Engar myndir til</div>
              )}
            </div>
            {images.length > 1 ? (
              <div className="p-3 border-t border-gray-100">
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((img, idx) => (
                    <button
                      key={img.path}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative flex-shrink-0 h-16 w-20 rounded border ${activeImageIndex === idx ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : 'border-gray-200 hover:border-gray-300'} bg-gray-100 overflow-hidden cursor-pointer`}
                      title={img.name}
                    >
                      <img src={img.signedUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                      <span className="absolute top-0.5 left-0.5 text-[10px] px-1 py-0.5 rounded bg-black/50 text-white">{idx + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Right: Details */}
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            <div>
              <div className="hidden sm:flex items-baseline justify-between gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
                <p className="text-xl font-semibold text-[var(--color-secondary)]">{formattedPrice}/mánuði</p>
              </div>
            </div>

            {/* Key specs */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Skjákort</p>
                <p className="mt-1 font-medium text-gray-900">{product.gpu}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Örgjörvi</p>
                <p className="mt-1 font-medium text-gray-900">{product.cpu}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Geymsla</p>
                <p className="mt-1 font-medium text-gray-900">{product.storage}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Móðurborð</p>
                <p className="mt-1 font-medium text-gray-900">{product.motherboard}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Vinnsluminni</p>
                <p className="mt-1 font-medium text-gray-900">{product.ram || '—'}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Aflgjafi</p>
                <p className="mt-1 font-medium text-gray-900">{product.powersupply || '—'}</p>
              </div>
            </div>

            {/* Duration slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700 font-medium">Leigutímabil</p>
                <p className="text-sm text-gray-500">{durations[durationIndex]} mánuðir</p>
              </div>
              <div className="w-full max-w-xs sm:max-w-sm mx-auto">
                <input
                  type="range"
                  min={0}
                  max={durations.length - 1}
                  step={1}
                  value={durationIndex}
                  onChange={(e) => setDurationIndex(parseInt(e.target.value))}
                  className="range-compact cursor-pointer"
                  style={progressStyle}
                  aria-label="Veldu leigutímabil"
                />
              </div>
              <div className="mt-1 w-full max-w-xs sm:max-w-sm mx-auto flex justify-between text-[11px] text-gray-500">
                {durations.map((m, idx) => (
                  <span key={m} className={idx === durationIndex ? 'text-[var(--color-accent)] font-medium' : ''}>{m}m</span>
                ))}
              </div>
            </div>

            {/* Add-on section */}
            <div className="space-y-3">
              {onlyScreen ? (
                <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-[var(--color-accent)]/5 to-transparent p-3 relative">
                  {(() => {
                    const s = screens.find(x => x.id === (selectedScreenId || screens[0]?.id));
                    const price = s ? parsePrice(s.verd || null) : 0;
                    const priceStr = price ? `${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr/mánuði` : '';
                    return priceStr ? (
                      <div className="absolute top-2 right-2 inline-flex items-center rounded-md bg-white/90 px-2.5 py-1 text-xs font-semibold text-[var(--color-secondary)] shadow border border-gray-200">
                        + {priceStr}
                      </div>
                    ) : null;
                  })()}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/30 px-2 py-0.5 rounded">
                        Mælum með
                      </div>
                      {(() => {
                        const s = screens.find(x => x.id === (selectedScreenId || screens[0]?.id));
                        const price = s ? parsePrice(s.verd || null) : 0;
                        const priceStr = price ? `${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr/mánuði` : '';
                        return (
                          <>
                            <ul className="mt-2 text-sm text-gray-700 space-y-1">
                              {s?.skjastaerd ? <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />{s.framleidandi} · {s.skjastaerd}</li> : null}
                              {s?.upplausn ? <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />{s.upplausn}</li> : null}
                              {s?.endurnyjunartidni ? <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />{s.endurnyjunartidni} endurnýjunartíðni</li> : null}
                            </ul>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setAddons({ ...addons, skjár: !addons.skjár })}
                                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-white ${addons.skjár ? 'bg-green-600 hover:bg-green-500' : 'bg-[var(--color-accent)] hover:brightness-95'} cursor-pointer`}
                              >
                                {addons.skjár ? 'Fjarlægja skjá' : 'Bæta við skjá'}
                              </button>
                            </div>
                            {screens.length > 1 ? (
                              <div className="mt-3">
                                <label htmlFor="select-screen" className="block text-xs text-gray-500 mb-1">Veldu skjá</label>
                                <select
                                  id="select-screen"
                                  value={selectedScreenId || screens[0]?.id}
                                  onChange={(e) => setSelectedScreenId(e.target.value)}
                                  className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                                >
                                  {screens.map(sc => {
                                    const p = parsePrice(sc.verd || null);
                                    const pStr = p ? `${p.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr/mánuði` : '';
                                    return (
                                      <option key={sc.id} value={sc.id}>
                                        {sc.framleidandi} {sc.skjastaerd} {pStr ? `— ${pStr}` : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (screenHeroImages.length === 0) {
                          // Best-effort load in case images not preloaded yet
                          try {
                            const id = selectedScreenId || screens[0]?.id;
                            if (id) {
                              const res = await fetch('/api/images/list-generic', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bucket: 'screens', folder: String(id) }),
                              });
                              if (res.ok) {
                                const j = await res.json();
                                setScreenHeroImages(j?.files || []);
                              }
                            }
                          } catch {}
                        }
                        setScreenLightboxIndex(0);
                        setScreenLightboxOpen(true);
                      }}
                      className="w-full sm:w-56 aspect-[4/3] bg-white rounded-md border border-gray-200 flex items-center justify-center overflow-hidden cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                      aria-label="Skoða myndir af skjá"
                      title="Smelltu til að skoða allar myndir af skjá"
                    >
                      {screenHeroImages[0]?.signedUrl ? (
                        <img src={screenHeroImages[0]?.signedUrl} alt="Skjár" className="max-h-full max-w-full object-contain pointer-events-none" />
                      ) : (
                        <div className="text-gray-400 text-xs">Mynd af skjá birtist hér</div>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 justify-center justify-items-center">
                  {/* Skjár (show only if linked) */}
                  {screens.length > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <label htmlFor="toggle-skrar" className="group inline-flex items-center justify-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input id="toggle-skrar" type="checkbox" className="sr-only" checked={addons.skjár}
                          onChange={(e) => setAddons({ ...addons, skjár: e.target.checked })} />
                        <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                          <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                        </span>
                        Skjár
                      </label>
                      <button type="button" onClick={() => openAccessoryModal('screen')} className="text-xs text-[var(--color-accent)] underline cursor-pointer">
                        Sjá nánar
                      </button>
                    </div>
                  ) : null}
                  {/* Lyklaborð */}
                  {keyboards.length > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <label htmlFor="toggle-lyklabord" className="group inline-flex items-center justify-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input id="toggle-lyklabord" type="checkbox" className="sr-only" checked={addons.lyklabord}
                          onChange={(e) => setAddons({ ...addons, lyklabord: e.target.checked })} />
                        <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                          <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                        </span>
                        Lyklaborð
                      </label>
                      <button type="button" onClick={() => openAccessoryModal('keyboard')} className="text-xs text-[var(--color-accent)] underline cursor-pointer">
                        Sjá nánar
                      </button>
                    </div>
                  ) : null}
                  {/* Mús */}
                  {mouses.length > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <label htmlFor="toggle-mus" className="group inline-flex items-center justify-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input id="toggle-mus" type="checkbox" className="sr-only" checked={addons.mus}
                          onChange={(e) => setAddons({ ...addons, mus: e.target.checked })} />
                        <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                          <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                        </span>
                        Mús
                      </label>
                      <button type="button" onClick={() => openAccessoryModal('mouse')} className="text-xs text-[var(--color-accent)] underline cursor-pointer">
                        Sjá nánar
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Actions */}
            {product.uppselt ? (
              <div className="rounded-md border border-gray-300 bg-gray-100 text-gray-700 text-sm px-3 py-2">
                Því miður er þessi vara uppseld
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  if (animatingInsurance) return;
                  if (insured) {
                    // Turn insurance off instantly, no animation
                    setInsured(false);
                    return;
                  }
                  // Turn insurance on immediately, keep animation purely visual
                  setInsured(true);
                  setAnimatingInsurance(true);
                  window.setTimeout(() => {
                    setAnimatingInsurance(false);
                  }, 1000);
                }}
                disabled={animatingInsurance}
                aria-pressed={insured}
                className={
                  `flex-1 rounded-md px-4 py-2 text-sm font-medium text-white ` +
                  (animatingInsurance
                    ? 'bg-green-600/70 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 cursor-pointer')
                }
              >
                {insured ? 'Enga Tryggingu' : 'Kaupa Tryggingu'}
              </button>
              {product.uppselt ? (
                <button
                  onClick={handleWaitlistClick}
                  disabled={isWaitlisting || waitlisted}
                  className={
                    `flex-1 rounded-md px-4 py-2 text-sm font-medium text-white ` +
                    ((isWaitlisting || waitlisted)
                      ? 'bg-[var(--color-accent)]/60 cursor-not-allowed'
                      : 'bg-[var(--color-accent)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] cursor-pointer')
                  }
                >
                  {waitlisted ? 'Skráð á biðlista' : (isWaitlisting ? 'Skrái…' : 'Skrá á biðlista')}
                </button>
              ) : (
                <button
                  onClick={handleOrderClick}
                  className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] cursor-pointer"
                >
                  Leigja núna
                </button>
              )}
              <button
                onClick={() => {
                  router.push('/');
                  setTimeout(() => {
                    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                  }, 400);
                }}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center cursor-pointer"
              >
                Sjá allar vörur
              </button>
            </div>
            {product.uppselt && waitlistError ? (
              <div className="text-sm text-red-600 pt-1">{waitlistError}</div>
            ) : null}
          </div>
        </div>
      </div>
      {/* Insured label below the border */}
      {insured ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-2 mb-2 text-center">
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 ring-1 ring-green-500/30">
            Vara tryggð
          </span>
        </div>
      ) : null}
      {/* Screen-only lightbox (no specs) */}
      {screenLightboxOpen ? (
        <div className="fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setScreenLightboxOpen(false)}
            aria-hidden="true"
          />
          <div role="dialog" aria-modal="true" className="relative z-[71] h-full w-full flex flex-col items-center justify-center p-4 gap-3">
            <div className="relative max-h-[80vh] w-full max-w-5xl bg-transparent flex items-center justify-center">
              {screenHeroImages.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setScreenLightboxIndex((i) => (i - 1 + screenHeroImages.length) % screenHeroImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
                  aria-label="Fyrri mynd"
                  title="Fyrri mynd"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 111.06 1.06L9.31 10l3.47 3.47a.75.75 0 010 1.06z"/></svg>
                </button>
              ) : null}
              <img
                src={screenHeroImages[Math.min(screenLightboxIndex, Math.max(0, screenHeroImages.length - 1))]?.signedUrl}
                alt=""
                className="max-h-[80vh] max-w-full object-contain"
              />
              {screenHeroImages.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setScreenLightboxIndex((i) => (i + 1) % screenHeroImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
                  aria-label="Næsta mynd"
                  title="Næsta mynd"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.22 4.47a.75.75 0 011.06 0l4 4c.3.3.3.77 0 1.06l-4 4a.75.75 0 11-1.06-1.06L10.69 10 7.22 6.53a.75.75 0 010-1.06z"/></svg>
                </button>
              ) : null}
            </div>
            {screenHeroImages.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto">
                {screenHeroImages.map((img, idx) => (
                  <button
                    key={img.path}
                    type="button"
                    onClick={() => setScreenLightboxIndex(idx)}
                    className={`relative flex-shrink-0 h-14 w-18 rounded border ${screenLightboxIndex === idx ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40' : 'border-white/20 hover:border-white/40'} bg-black/30 overflow-hidden cursor-pointer`}
                    aria-label={`Velja mynd ${idx + 1}`}
                    title={`Mynd ${idx + 1}`}
                  >
                    <img src={img.signedUrl} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setScreenLightboxOpen(false)}
              className="absolute top-4 right-4 h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
              aria-label="Loka"
              title="Loka"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 6.22a.75.75 0 011.06 0L10 8.88l2.66-2.66a.75.75 0 111.06 1.06L11.06 9.94l2.66 2.66a.75.75 0 11-1.06 1.06L10 11l-2.66 2.66a.75.75 0 11-1.06-1.06L8.94 9.94 6.28 7.28a.75.75 0 010-1.06z"/></svg>
            </button>
          </div>
        </div>
      ) : null}
      {/* Accessory modal */}
      {modalType !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 cursor-pointer" onClick={() => setModalType(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {modalType === 'screen' ? 'Skjáir' : modalType === 'keyboard' ? 'Lyklaborð' : 'Mýs'}
              </h2>
              <button type="button" onClick={() => setModalType(null)} className="text-gray-500 hover:text-gray-700 text-sm cursor-pointer">Loka</button>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                {(modalType === 'screen' ? screens : modalType === 'keyboard' ? keyboards : mouses).map((item, idx) => {
                  const active = idx === modalActiveIndex;
                  const onClick = () => {
                    setModalActiveIndex(idx);
                    // Load images for this item
                    (async () => {
                      setModalLoading(true);
                      try {
                        const bucket = modalType === 'screen' ? 'screens' : modalType === 'keyboard' ? 'keyboards' : 'mouses';
                        const folder = String((item as ScreenItem).id ?? (item as KeyboardItem).id ?? (item as MouseItem).id);
                        const res = await fetch('/api/images/list-generic', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bucket, folder }),
                        });
                        if (res.ok) {
                          const j = await res.json();
                          setModalImages(j?.files || []);
                        } else {
                          setModalImages([]);
                        }
                      } catch {
                        setModalImages([]);
                      } finally {
                        setModalLoading(false);
                      }
                    })();
                    // Update selected id for price
                    if (modalType === 'screen') setSelectedScreenId((item as ScreenItem).id);
                    if (modalType === 'keyboard') setSelectedKeyboardId((item as KeyboardItem).id);
                    if (modalType === 'mouse') setSelectedMouseId((item as MouseItem).id);
                  };
                  const price = parsePrice((item as ScreenItem).verd ?? (item as KeyboardItem).verd ?? (item as MouseItem).verd).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                  return (
                    <button key={String((item as ScreenItem).id ?? (item as KeyboardItem).id ?? (item as MouseItem).id)} type="button" onClick={onClick}
                      className={`w-full text-left border rounded px-3 py-2 text-sm ${active ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40' : 'border-gray-200 hover:border-gray-300'} cursor-pointer`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 truncate">
                          {modalType === 'screen' ? `${(item as ScreenItem).framleidandi} ${(item as ScreenItem).skjastaerd}` :
                           modalType === 'keyboard' ? `${(item as KeyboardItem).nafn}` :
                           `${(item as MouseItem).nafn}`}
                        </div>
                        <div className="text-gray-600">{price ? `${price} kr` : ''}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {modalType === 'screen'
                          ? `${(item as ScreenItem).upplausn} · ${(item as ScreenItem).skjataekni} · ${(item as ScreenItem).endurnyjunartidni}`
                          : modalType === 'keyboard'
                            ? `${(item as KeyboardItem).framleidandi} · ${(item as KeyboardItem).staerd} · ${(item as KeyboardItem).tengimoguleiki}`
                            : `${(item as MouseItem).framleidandi} · ${(item as MouseItem).fjolditakk} takkar · ${(item as MouseItem).tengimoguleiki}`}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="min-h-[16rem]">
                {modalLoading ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">Hleð myndum…</div>
                ) : modalImages.length > 0 ? (
                  <div className="space-y-3">
                    <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center rounded">
                      <button
                        type="button"
                        onClick={() => {
                          const src = modalImages[Math.min(modalActiveIndex, modalImages.length - 1)]?.signedUrl;
                          if (src) setZoomImageSrc(src);
                        }}
                        className="h-full w-full flex items-center justify-center cursor-zoom-in"
                        aria-label="Stækka mynd"
                        title="Smelltu til að stækka"
                      >
                        <img
                          src={modalImages[Math.min(modalActiveIndex, modalImages.length - 1)]?.signedUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                      {modalImages.map((img, idx) => (
                        <button key={img.path} type="button" onClick={() => setModalActiveIndex(idx)}
                          className={`relative flex-shrink-0 h-14 w-18 rounded border ${modalActiveIndex === idx ? 'border-[var(--color-accent)]' : 'border-gray-200 hover:border-gray-300'} bg-gray-100 overflow-hidden cursor-pointer`}>
                          <img src={img.signedUrl} alt="" className="h-full w-full object-contain" />
                          <span className="absolute top-0.5 left-0.5 text-[10px] px-1 py-0.5 rounded bg-black/50 text-white">{idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">Engar myndir til</div>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end">
              <button type="button" onClick={() => setModalType(null)} className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm cursor-pointer">Loka</button>
            </div>
          </div>
        </div>
      ) : null}
      {/* Image lightbox overlay (modal image zoom) */}
      {zoomImageSrc ? (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setZoomImageSrc(null)}
            aria-hidden="true"
          />
          <div role="dialog" aria-modal="true" className="relative z-[61] h-full w-full flex items-center justify-center p-4">
            <img
              src={zoomImageSrc}
              alt=""
              className="max-h-[95vh] max-w-[95vw] object-contain shadow-2xl rounded"
            />
            <button
              type="button"
              onClick={() => setZoomImageSrc(null)}
              className="absolute top-4 right-4 h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
              aria-label="Loka"
              title="Loka"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 6.22a.75.75 0 011.06 0L10 8.88l2.66-2.66a.75.75 0 111.06 1.06L11.06 9.94l2.66 2.66a.75.75 0 11-1.06 1.06L10 11l-2.66 2.66a.75.75 0 11-1.06-1.06L8.94 9.94 6.28 7.28a.75.75 0 010-1.06z"/></svg>
            </button>
          </div>
        </div>
      ) : null}
      {/* Mobile-only floating name + price bubble */}
      <div className="sm:hidden fixed left-1/2 -translate-x-1/2" style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bubbleBottomPx}px)` }}>
        <div ref={bubbleRef} className="inline-flex max-w-[96vw] items-center gap-3 rounded-full bg-white/95 backdrop-blur px-6 py-3 shadow-2xl border border-white ring-2 ring-[var(--color-accent)]/60">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)] shadow-sm" aria-hidden="true" />
          <span className="text-base font-semibold text-gray-900 truncate max-w-[56vw]">{product.name}</span>
          <span className="text-xl font-extrabold text-[var(--color-secondary)] whitespace-nowrap">{formattedPrice}/mánuði</span>
        </div>
      </div>
      {/* Styles for insurance animations */}
      <style jsx>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        .draw-border {
          stroke-linejoin: round;
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: draw 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes flash {
          0% { opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-flash {
          animation: flash 1s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .draw-border { animation-duration: 0.001ms; animation-iteration-count: 1; }
          .animate-flash { animation-duration: 0.001ms; animation-iteration-count: 1; }
        }
      `}</style>
    </div>
  );
}
