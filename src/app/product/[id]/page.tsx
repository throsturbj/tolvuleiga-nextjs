"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import IncludedItems from "@/components/IncludedItems";

interface GamingPCRow {
  id: number;
  name: string;
  verd: string;
  trygging?: string | null;
  innifalid?: string | null;
  repeat_url?: string | null;
  repeat_url_trygging?: string | null;
  repeat_url_screen?: string | null;
  repeat_url_screen_trygging?: string | null;
  cpu: string;
  gpu: string;
  storage: string;
  motherboard?: string;
  powersupply?: string;
  cpucooler?: string;
  ram?: string;
  uppselt?: boolean;
  tilbod?: boolean;
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
  // Insurance UI
  const [insured, setInsured] = useState<boolean>(false);
  const [ordering, setOrdering] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
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

  const [addons, setAddons] = useState({ skjár: false, lyklabord: false, mus: false });
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [screenPreviewUrl, setScreenPreviewUrl] = useState<string | null>(null);
  const [screenPreviewLoading, setScreenPreviewLoading] = useState<boolean>(false);

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

  const parsePrice = (s: string | null | undefined) => {
    const digits = String(s || "").replace(/\D+/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
  };

  // Preview image for the screen add-on card
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!selectedScreenId) {
        setScreenPreviewUrl(null);
        return;
      }
      setScreenPreviewLoading(true);
      try {
        const res = await fetch("/api/images/list-generic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: "screens", folder: String(selectedScreenId) }),
        });
        if (!alive) return;
        if (res.ok) {
          const j = await res.json();
          setScreenPreviewUrl(j?.files?.[0]?.signedUrl || null);
        } else {
          setScreenPreviewUrl(null);
        }
      } catch {
        if (alive) setScreenPreviewUrl(null);
      } finally {
        if (alive) setScreenPreviewLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [selectedScreenId]);

  const selectedScreen = screens.find((s) => s.id === selectedScreenId) || screens[0] || null;
  const screenAdded = addons.skjár && !!selectedScreen;
  const screenPrice = screenAdded ? parsePrice(selectedScreen?.verd) : 0;
  const keyboardPrice = addons.lyklabord && selectedKeyboardId
    ? parsePrice(keyboards.find(k => k.id === selectedKeyboardId)?.verd)
    : 0;
  const mousePrice = addons.mus && selectedMouseId !== null
    ? parsePrice(mouses.find(m => String(m.id) === String(selectedMouseId))?.verd)
    : 0;
  const addOnTotal = screenPrice + keyboardPrice + mousePrice;

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

  // Monthly price from GamingPC.verd (+ trygging / screen when selected)
  const monthlyBase = parsePrice(product.verd);
  const insuranceAmount = parsePrice(product.trygging);
  const insuranceUrl = screenAdded
    ? (product.repeat_url_screen_trygging || null)
    : (product.repeat_url_trygging || null);
  const baseCheckoutUrl = screenAdded
    ? (product.repeat_url_screen || null)
    : (product.repeat_url || null);
  const insuranceAvailable =
    insuranceAmount > 0 && !!insuranceUrl?.trim();
  const checkoutUrl = (insured && insuranceAvailable ? insuranceUrl : baseCheckoutUrl)?.trim() || null;
  const finalPriceRaw = monthlyBase + addOnTotal + (insured && insuranceAvailable ? insuranceAmount : 0);
  const finalPrice = Math.ceil(finalPriceRaw / 10) * 10;
  const formattedPrice = `${finalPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr`;
  const formatKr = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const screenMonthlyPrice = selectedScreen ? parsePrice(selectedScreen.verd) : 0;

  // Only hand off to Repeat — the order is created by the webhook after payment succeeds.
  const handlePanta = () => {
    if (ordering || !termsAccepted) return;
    if (!checkoutUrl) return;

    if (!session?.user) {
      router.push(`/auth?redirect=/product/${productIdParam}`);
      return;
    }

    setOrderError(null);
    setOrdering(true);
    try {
      window.location.href = checkoutUrl;
    } catch {
      setOrderError("Ekki tókst að opna greiðslusíðu. Reyndu aftur.");
      setOrdering(false);
    }
  };

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
    if (!product || !termsAccepted) return;
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

  const actionBtnBase =
    "relative overflow-hidden rounded-xl border px-1.5 sm:px-3 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition-all duration-300 ease-out cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed min-w-0";
  const actionBtnInner =
    "relative z-10 inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-w-0";

  const toggleInsurance = () => {
    if (!insuranceAvailable) return;
    setInsured((prev) => !prev);
  };

  const specBullets = [
    product.gpu ? `Skjákort: ${product.gpu}` : null,
    product.cpu ? `Örgjörvi: ${product.cpu}` : null,
    product.storage ? `Geymsla: ${product.storage}` : null,
    product.motherboard ? `Móðurborð: ${product.motherboard}` : null,
    product.ram ? `Vinnsluminni: ${product.ram}` : null,
    product.powersupply ? `Aflgjafi: ${product.powersupply}` : null,
    product.cpucooler ? `Kæling: ${product.cpucooler}` : null,
  ].filter((x): x is string => Boolean(x));

  const orderDisabled =
    !termsAccepted ||
    ordering ||
    (product.uppselt
      ? isWaitlisting || waitlisted
      : !checkoutUrl);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-gray-50 py-6 sm:py-10">
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/#products")}
          className="mb-4 sm:mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L8.31 10l4.47 4.47a.75.75 0 010 1.06z" /></svg>
          Allar vörur
        </button>

        <div className="grid gap-5 sm:gap-8 md:grid-cols-2 items-start">
          {/* contents → phone reorders gallery/details/buttons; md → left column under gallery */}
          <div className="contents md:flex md:flex-col md:gap-4">
          {/* Left: Product Images */}
          <div className="order-1 min-w-0 space-y-3 sm:space-y-4 md:order-none">
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center p-2 sm:p-0">
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
                            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
                            aria-label="Fyrri mynd"
                            title="Fyrri mynd"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 111.06 1.06L9.31 10l3.47 3.47a.75.75 0 010 1.06z"/></svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
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
                  <div className="p-2 sm:p-3 border-t border-gray-200">
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {images.map((img, idx) => (
                        <button
                          key={img.path}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={`relative flex-shrink-0 h-14 w-16 sm:h-16 sm:w-20 rounded-lg border ${activeImageIndex === idx ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30" : "border-gray-200 hover:border-gray-300"} bg-white overflow-hidden cursor-pointer`}
                          title={img.name}
                        >
                          <img src={img.signedUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {product.uppselt ? (
                <div className="rounded-xl border border-gray-300 bg-gray-100 text-gray-700 text-sm px-3 py-2 text-center">
                  Því miður er þessi vara uppseld
                </div>
              ) : null}
            </div>

          {/* Actions — bottom on phone only; under gallery on desktop */}
          <div className="order-3 min-w-0 space-y-3 sm:space-y-4 md:order-none">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={toggleInsurance}
                disabled={!insuranceAvailable}
                aria-pressed={insured}
                title={
                  insuranceAvailable
                    ? insured
                      ? "Fjarlægja tryggingu"
                      : `Bæta við tryggingu (+${formatKr(insuranceAmount)} kr)`
                    : "Trygging ekki í boði"
                }
                className={`${actionBtnBase} ${
                  insured
                    ? "border-emerald-500/50 text-white shadow-[0_0_28px_-8px_rgba(16,185,129,0.55)]"
                    : "border-emerald-500/45 text-emerald-700 hover:border-emerald-500/70 hover:bg-emerald-50"
                } focus-visible:outline-emerald-500 disabled:opacity-40`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 origin-center bg-gradient-to-br from-emerald-500 to-teal-600 transition-all duration-500 ease-out ${
                    insured ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                />
                <span className={actionBtnInner}>
                  <svg
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-500 ${insured ? "scale-110 text-white" : "scale-100"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3z" />
                    {insured ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8L15 10" />
                    ) : null}
                  </svg>
                  <span className={insured ? "text-white" : undefined}>Trygging</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTermsAccepted((prev) => !prev)}
                aria-pressed={termsAccepted}
                className={`${actionBtnBase} ${
                  termsAccepted
                    ? "border-sky-500/50 text-white shadow-[0_0_28px_-10px_rgba(56,189,248,0.55)]"
                    : "border-sky-500/45 text-sky-700 hover:border-sky-500/70 hover:bg-sky-50"
                } focus-visible:outline-sky-500`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 origin-center bg-gradient-to-br from-sky-500 to-sky-700 transition-all duration-500 ease-out ${
                    termsAccepted ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                />
                <span className={actionBtnInner}>
                  <svg
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-500 ${termsAccepted ? "scale-110 text-white" : "scale-100"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M8 4h8l1 2h3v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6h3l1-2z" />
                    {termsAccepted ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5l1.6 1.6L15 10" />
                    ) : null}
                  </svg>
                  <span className={`leading-tight text-center ${termsAccepted ? "text-white" : ""}`}>
                    <span className="sm:hidden flex flex-col items-center">
                      <span>Samþykkja</span>
                      <span className="text-[10px] font-medium tracking-tight opacity-90">Skilmála</span>
                    </span>
                    <span className="hidden sm:inline">Samþykkja Skilmála</span>
                  </span>
                </span>
              </button>

              {product.uppselt ? (
                <button
                  type="button"
                  onClick={handleWaitlistClick}
                  disabled={orderDisabled}
                  className={`${actionBtnBase} ${
                    termsAccepted
                      ? "border-[var(--color-accent)]/60 text-white shadow-[0_0_28px_-8px_var(--color-accent)]"
                      : "border-[var(--color-accent)]/45 text-[var(--color-accent)]/85"
                  } focus-visible:outline-[var(--color-accent)] disabled:opacity-45`}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 origin-center bg-[var(--color-accent)] transition-all duration-500 ease-out delay-75 ${
                      termsAccepted ? "scale-100 opacity-100" : "scale-75 opacity-0"
                    }`}
                  />
                  <span className={actionBtnInner}>
                    <svg
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-500 ${termsAccepted ? "scale-110 text-white" : "scale-100"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5.5A2.5 2.5 0 0110.5 3h3A2.5 2.5 0 0116 5.5V7M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9z" />
                    </svg>
                    <span className={`leading-tight text-center ${termsAccepted ? "text-white" : ""}`}>
                      {waitlisted ? "Skráð" : (isWaitlisting ? "Skrái…" : "Panta")}
                    </span>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePanta}
                  disabled={orderDisabled}
                  className={`${actionBtnBase} ${
                    termsAccepted && checkoutUrl
                      ? "border-[var(--color-accent)]/60 text-white shadow-[0_0_28px_-8px_var(--color-accent)]"
                      : "border-[var(--color-accent)]/45 text-[var(--color-accent)]/85"
                  } focus-visible:outline-[var(--color-accent)] disabled:opacity-45`}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 origin-center bg-[var(--color-accent)] transition-all duration-500 ease-out delay-75 ${
                      termsAccepted && checkoutUrl ? "scale-100 opacity-100" : "scale-75 opacity-0"
                    }`}
                  />
                  <span className={actionBtnInner}>
                    <svg
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-500 ${termsAccepted && checkoutUrl ? "scale-110 text-white" : "scale-100"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7h17l-1.2 11.2a2 2 0 01-2 1.8H6.7a2 2 0 01-2-1.8L3.5 7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5.5A2.5 2.5 0 0110.5 3h3A2.5 2.5 0 0116 5.5V7" />
                    </svg>
                    <span className={termsAccepted && checkoutUrl ? "text-white" : undefined}>
                      {ordering ? "Andartak…" : "Panta"}
                    </span>
                  </span>
                </button>
              )}
            </div>

            {!termsAccepted ? (
              <p className="text-center text-xs text-gray-500">
                Samþykktu{" "}
                <Link href="/legal" target="_blank" rel="noopener noreferrer" className="text-gray-700 underline underline-offset-2 hover:text-gray-900">
                  skilmála
                </Link>{" "}
                til að panta
              </p>
            ) : insured && insuranceAvailable ? (
              <p className="text-center text-xs text-emerald-700">
                Vara tryggð · +{formatKr(insuranceAmount)} kr/mán
                {screenAdded ? " · skjár innifalinn" : ""}
              </p>
            ) : screenAdded ? (
              <p className="text-center text-xs text-[var(--color-secondary)]">
                Skjár bætt við pöntun
              </p>
            ) : !checkoutUrl && !product.uppselt ? (
              <p className="text-center text-xs text-amber-700">
                Greiðsluhlekk vantar fyrir þessa vöru
              </p>
            ) : null}
            {orderError ? (
              <p className="text-center text-sm text-red-600 break-words">{orderError}</p>
            ) : null}
            {product.uppselt && waitlistError ? (
              <p className="text-center text-sm text-red-600 break-words">{waitlistError}</p>
            ) : null}
          </div>
          </div>

            {/* Right: Details + screen add-on */}
            <div className="order-2 min-w-0 space-y-3 sm:space-y-4 md:order-none">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 break-words">
                    {product.name}
                  </h1>
                  <p className={`mt-2 sm:mt-3 text-xl sm:text-2xl font-extrabold break-words ${insured && insuranceAvailable ? "text-emerald-600" : "text-[var(--color-secondary)]"}`}>
                    {formattedPrice}/mánuði
                  </p>
                  {(insured && insuranceAvailable) || addOnTotal > 0 ? (
                    <p className="mt-1 text-xs text-gray-500 break-words">
                      {formatKr(monthlyBase)} kr
                      {insured && insuranceAvailable ? ` + ${formatKr(insuranceAmount)} kr trygging` : ""}
                      {screenPrice > 0 ? ` + ${formatKr(screenPrice)} kr skjár` : ""}
                      {(keyboardPrice + mousePrice) > 0 ? ` + ${formatKr(keyboardPrice + mousePrice)} kr aukahlutir` : ""}
                    </p>
                  ) : null}
                </div>

                {specBullets.length > 0 ? (
                  <ul className="space-y-1.5">
                    {specBullets.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-gray-600 min-w-0">
                        <svg className="mt-1.5 h-1 w-1 flex-shrink-0 text-[var(--color-accent)]" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
                          <circle cx="4" cy="4" r="4" />
                        </svg>
                        <span className="min-w-0 break-words">{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <IncludedItems value={product.innifalid} tone="light" />

                {(keyboards.length > 0 || mouses.length > 0) ? (
                  <div className="grid grid-cols-2 gap-3 justify-center justify-items-center rounded-2xl border border-gray-200 bg-gray-50/40 p-3">
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
                ) : null}
              </div>

              {selectedScreen ? (
                <div
                  className={`rounded-2xl border bg-white p-3.5 sm:p-4 transition-all duration-300 ${
                    screenAdded
                      ? "border-[var(--color-accent)]/50 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_12px_40px_-20px_var(--color-accent)]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Bæta við pöntun</p>
                      <h2 className="text-sm sm:text-base font-bold text-gray-900">Skjár</h2>
                    </div>
                    {screens.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => openAccessoryModal("screen")}
                        className="text-xs font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
                      >
                        Skipta
                      </button>
                    ) : null}
                  </div>

                  <div className="flex gap-3 sm:gap-4 items-stretch">
                    <button
                      type="button"
                      onClick={() => openAccessoryModal("screen")}
                      className="relative flex-shrink-0 w-24 sm:w-28 aspect-[4/3] rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 overflow-hidden cursor-pointer group"
                      aria-label="Skoða skjá"
                    >
                      {screenPreviewLoading ? (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">…</span>
                      ) : screenPreviewUrl ? (
                        <img
                          src={screenPreviewUrl}
                          alt=""
                          className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <svg className="h-8 w-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                            <rect x="2.5" y="4" width="19" height="13" rx="2" />
                            <path d="M8 20h8M12 17v3" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {selectedScreen.framleidandi} {selectedScreen.skjastaerd}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 truncate">
                          {[selectedScreen.upplausn, selectedScreen.skjataekni, selectedScreen.endurnyjunartidni]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="mt-1.5 text-sm font-bold text-[var(--color-secondary)]">
                          {screenMonthlyPrice > 0
                            ? `+${formatKr(screenMonthlyPrice)} kr/mán`
                            : "Innifalið"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !addons.skjár;
                          setAddons((prev) => ({ ...prev, skjár: next }));
                          // Screen checkout URLs may not support trygging — drop it if needed
                          if (next && insured) {
                            const screenInsureOk =
                              insuranceAmount > 0 && !!product.repeat_url_screen_trygging?.trim();
                            if (!screenInsureOk) setInsured(false);
                          }
                        }}
                        aria-pressed={screenAdded}
                        className={`self-start inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                          screenAdded
                            ? "bg-[var(--color-accent)] text-white shadow-sm hover:brightness-95"
                            : "border border-[var(--color-accent)]/50 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5"
                        }`}
                      >
                        {screenAdded ? (
                          <>
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.42l2.793 2.793 6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Bætt við
                          </>
                        ) : (
                          "Bæta við"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
        </div>
      </div>
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
    </div>
  );
}
