"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { supabasePublic } from "@/lib/supabase-public";
import IncludedItems from "@/components/IncludedItems";
import {
  fetchProductByParam,
  formatKr,
  formatStorage,
  parsePrice,
  saveOrderSelection,
  specLines,
  specText,
  variantStorageGb,
  type Aukahlutur,
  type Product,
  type ProductVariant,
} from "@/lib/products";

type ImageFile = { name: string; path: string; signedUrl: string };

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const productIdParam = String(params.id || "");

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [compatScreens, setCompatScreens] = useState<Product[]>([]);
  const [keyboards, setKeyboards] = useState<Aukahlutur[]>([]);
  const [mouses, setMouses] = useState<Aukahlutur[]>([]);
  const [appleAccessories, setAppleAccessories] = useState<Aukahlutur[]>([]);
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [selectedKeyboardId, setSelectedKeyboardId] = useState<string | null>(null);
  const [selectedMouseId, setSelectedMouseId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<null | "screen" | "keyboard" | "mouse">(null);
  const [modalImages, setModalImages] = useState<ImageFile[]>([]);
  const [modalActiveIndex, setModalActiveIndex] = useState(0);
  const [modalLoading, setModalLoading] = useState(false);
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);
  const [addons, setAddons] = useState({ skjár: false, lyklabord: false, mus: false });
  const [insured, setInsured] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isWaitlisting, setIsWaitlisting] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [extraControllers, setExtraControllers] = useState(0);
  const [screenPreviewUrl, setScreenPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!productIdParam) return;
      setLoading(true);
      setError(null);
      const clients = [supabasePublic, supabase];
      let found: Product | null = null;
      for (const client of clients) {
        try {
          found = await fetchProductByParam(client, productIdParam);
          if (found) break;
        } catch {
          // try next
        }
      }
      if (!alive) return;
      if (!found) {
        setProduct(null);
        setError("not-found");
        setLoading(false);
        return;
      }
      setProduct(found);
      const client = supabasePublic;
      if (found.type === "laptop") {
        const { data } = await client.from("product_variants").select("*").eq("product_id", found.id).order("price", { ascending: true });
        const rows = (data as ProductVariant[]) || [];
        setVariants(rows);
      } else {
        setVariants([]);
      }

      const { data: compat } = await client.from("product_compat").select("compatible_product_id").eq("product_id", found.id);
      const screenIds = ((compat || []) as { compatible_product_id: string }[]).map((r) => r.compatible_product_id);
      if (screenIds.length > 0) {
        const { data: screens } = await client.from("products").select("*").in("id", screenIds);
        const list = (screens as Product[]) || [];
        setCompatScreens(list);
        setSelectedScreenId(list[0]?.id ?? null);
      } else {
        setCompatScreens([]);
        setSelectedScreenId(null);
      }

      const { data: links } = await client.from("product_aukahlutir").select("aukahlutur_id").eq("product_id", found.id);
      const aukIds = ((links || []) as { aukahlutur_id: string }[]).map((r) => r.aukahlutur_id);
      if (aukIds.length > 0) {
        const { data: auk } = await client.from("aukahlutir").select("*").in("id", aukIds);
        const list = (auk as Aukahlutur[]) || [];
        const kbs = list.filter((a) => a.type === "keyboard");
        const ms = list.filter((a) => a.type === "mouse");
        const apples = list.filter((a) => a.type === "apple_accessory");
        setKeyboards(kbs);
        setMouses(ms);
        setAppleAccessories(apples);
        setSelectedKeyboardId(kbs[0]?.id ?? null);
        setSelectedMouseId(ms[0]?.id ?? null);
      } else {
        setKeyboards([]);
        setMouses([]);
        setAppleAccessories([]);
        setSelectedKeyboardId(null);
        setSelectedMouseId(null);
      }
      setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [productIdParam]);

  useEffect(() => {
    let alive = true;
    const fetchImages = async () => {
      if (!product) return;
      const bucket = product.image_bucket;
      const folder = product.image_folder || product.id;
      if (!bucket || !folder) {
        setImages([]);
        return;
      }
      setImagesLoading(true);
      try {
        const res = await fetch("/api/images/list-generic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, folder }),
        });
        if (!alive) return;
        if (res.ok) {
          const j = await res.json();
          setImages((j?.files as ImageFile[]) || []);
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
    return () => {
      alive = false;
    };
  }, [product]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const screen = compatScreens.find((s) => s.id === selectedScreenId);
      if (!screen) {
        setScreenPreviewUrl(null);
        return;
      }
      const bucket = screen.image_bucket || "screens";
      const folder = screen.image_folder || screen.id;
      try {
        const res = await fetch("/api/images/list-generic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, folder }),
        });
        if (!alive) return;
        if (res.ok) {
          const j = await res.json();
          setScreenPreviewUrl(j?.files?.[0]?.signedUrl || null);
        } else setScreenPreviewUrl(null);
      } catch {
        if (alive) setScreenPreviewUrl(null);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [selectedScreenId, compatScreens]);

  const storages = useMemo(
    () => Array.from(new Set(variants.map((v) => variantStorageGb(v)).filter((n): n is number => n != null))).sort((a, b) => a - b),
    [variants]
  );

  useEffect(() => {
    if (variants.length === 0 || selectedStorage !== null) return;
    const first = variantStorageGb(variants[0]);
    if (first != null) setSelectedStorage(first);
  }, [variants, selectedStorage]);

  const selectedVariant = useMemo(() => {
    if (selectedStorage == null) return variants[0] || null;
    return variants.find((v) => variantStorageGb(v) === selectedStorage) || variants[0] || null;
  }, [variants, selectedStorage]);

  const selectedScreen = compatScreens.find((s) => s.id === selectedScreenId) || null;
  const screenAdded = addons.skjár && !!selectedScreen;
  const selectedAccessories = appleAccessories.filter((a) => selectedAccessoryIds.includes(a.id));
  const accessoryTotal = selectedAccessories.reduce((sum, a) => sum + parsePrice(a.price), 0);

  const monthlyBase = product?.type === "laptop" ? parsePrice(selectedVariant?.price) : parsePrice(product?.price);
  const insuranceAmount =
    product?.type === "laptop" ? parsePrice(selectedVariant?.trygging) : parsePrice(product?.trygging);
  const insuranceAvailable = insuranceAmount > 0;
  const screenPrice = screenAdded ? parsePrice(selectedScreen?.price) : 0;
  const keyboardPrice = addons.lyklabord && selectedKeyboardId ? parsePrice(keyboards.find((k) => k.id === selectedKeyboardId)?.price) : 0;
  const mousePrice = addons.mus && selectedMouseId ? parsePrice(mouses.find((m) => m.id === selectedMouseId)?.price) : 0;
  const extraCtrlPrice =
    product?.type === "console"
      ? extraControllers * parsePrice(specText(product.specs, "verdextracontrollers"))
      : 0;
  const maxExtra = product?.type === "console" ? parseInt(specText(product.specs, "numberofextracontrollers") || "0", 10) || 0 : 0;

  const finalPriceRaw = monthlyBase + screenPrice + keyboardPrice + mousePrice + accessoryTotal + extraCtrlPrice + (insured && insuranceAvailable ? insuranceAmount : 0);
  const finalPrice = Math.ceil(finalPriceRaw / 10) * 10;
  const formattedPrice = `${formatKr(finalPrice)} kr`;
  const bullets = product ? specLines(product).map((r) => `${r.label}: ${r.value}`) : [];

  const goOrder = () => {
    if (!product || ordering || !termsAccepted) return;
    if (!session?.user) {
      router.push(`/auth?redirect=/product/${product.id}`);
      return;
    }
    setOrderError(null);
    setOrdering(true);
    saveOrderSelection({
      months: 3,
      addons: { skjár: addons.skjár, lyklabord: addons.lyklabord, mus: addons.mus },
      insured,
      finalPrice,
      variantId: selectedVariant?.id ?? null,
      extraControllers,
      accessoryIds: selectedAccessoryIds,
      screenProductId: screenAdded ? selectedScreenId : null,
      keyboardId: addons.lyklabord ? selectedKeyboardId : null,
      mouseId: addons.mus ? selectedMouseId : null,
    });
    router.push(`/order/${product.id}`);
  };

  const handleWaitlistClick = async () => {
    if (!product || !termsAccepted) return;
    if (!session?.user) {
      router.push(`/auth?redirect=/product/${product.id}`);
      return;
    }
    if (isWaitlisting || waitlisted) return;
    setIsWaitlisting(true);
    setWaitlistError(null);
    try {
      const { error: insErr } = await supabase.from("preorders").insert({
        auth_uid: session.user.id,
        product_id: product.id,
      });
      if (insErr) {
        setWaitlistError(insErr.message || "Mistókst að skrá á biðlista");
        return;
      }
      setWaitlisted(true);
      try {
        await fetch("/api/preorders/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id, productName: product.name }),
        });
      } catch {
        // ignore
      }
      router.push("/dashboard");
    } catch (e) {
      setWaitlistError(e instanceof Error ? e.message : "Mistókst að skrá á biðlista");
    } finally {
      setIsWaitlisting(false);
    }
  };

  const openAccessoryModal = async (type: "screen" | "keyboard" | "mouse") => {
    setModalType(type);
    setModalActiveIndex(0);
    setModalImages([]);
    const item =
      type === "screen"
        ? compatScreens.find((s) => s.id === selectedScreenId)
        : type === "keyboard"
          ? keyboards.find((k) => k.id === selectedKeyboardId)
          : mouses.find((m) => m.id === selectedMouseId);
    if (!item) return;
    const bucket = "image_bucket" in item ? item.image_bucket : null;
    const folder = "image_folder" in item ? item.image_folder : null;
    const b = bucket || (type === "screen" ? "screens" : type === "keyboard" ? "keyboards" : "mouses");
    const f = folder || item.id;
    setModalLoading(true);
    try {
      const res = await fetch("/api/images/list-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: b, folder: f }),
      });
      if (res.ok) {
        const j = await res.json();
        setModalImages(j?.files || []);
      }
    } catch {
      setModalImages([]);
    } finally {
      setModalLoading(false);
    }
  };

  const actionBtnBase =
    "relative overflow-hidden rounded-xl border px-1.5 sm:px-3 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition-all duration-300 ease-out cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed min-w-0";
  const actionBtnInner = "relative z-10 inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-w-0";

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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Vörunni finnst ekki</h1>
          <p className="text-gray-600 mb-8">Því miður fannst vörunni ekki.</p>
          <Link href="/" className="rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white hover:brightness-95">
            Til baka
          </Link>
        </div>
      </div>
    );
  }

  const orderDisabled = !termsAccepted || ordering || (product.uppselt ? isWaitlisting || waitlisted : false);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-gray-50 py-6 sm:py-10">
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-4 sm:mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M12.78 15.53a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L8.31 10l4.47 4.47a.75.75 0 010 1.06z" />
          </svg>
          Allar vörur
        </button>

        <div className="grid gap-5 sm:gap-8 md:grid-cols-2 items-start">
          <div className="contents md:flex md:flex-col md:gap-4">
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
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M12.78 15.53a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 111.06 1.06L9.31 10l3.47 3.47a.75.75 0 010 1.06z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer"
                            aria-label="Næsta mynd"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M7.22 4.47a.75.75 0 011.06 0l4 4c.3.3.3.77 0 1.06l-4 4a.75.75 0 11-1.06-1.06L10.69 10 7.22 6.53a.75.75 0 010-1.06z" />
                            </svg>
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
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {images.map((img, idx) => (
                        <button
                          key={img.path}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={`relative flex-shrink-0 h-14 w-16 sm:h-16 sm:w-20 rounded-lg border ${activeImageIndex === idx ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30" : "border-gray-200"} bg-white overflow-hidden cursor-pointer`}
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

            <div className="order-3 min-w-0 space-y-3 sm:space-y-4 md:order-none">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => insuranceAvailable && setInsured((v) => !v)}
                  disabled={!insuranceAvailable}
                  aria-pressed={insured}
                  className={`${actionBtnBase} ${insured ? "border-emerald-500/50 text-white shadow-[0_0_28px_-8px_rgba(16,185,129,0.55)]" : "border-emerald-500/45 text-emerald-700"} focus-visible:outline-emerald-500 disabled:opacity-40`}
                >
                  <span aria-hidden className={`pointer-events-none absolute inset-0 origin-center bg-gradient-to-br from-emerald-500 to-teal-600 transition-all duration-500 ${insured ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} />
                  <span className={actionBtnInner}>
                    <span className={insured ? "text-white" : undefined}>Trygging</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTermsAccepted((v) => !v)}
                  aria-pressed={termsAccepted}
                  className={`${actionBtnBase} ${termsAccepted ? "border-sky-500/50 text-white" : "border-sky-500/45 text-sky-700"} focus-visible:outline-sky-500`}
                >
                  <span aria-hidden className={`pointer-events-none absolute inset-0 origin-center bg-gradient-to-br from-sky-500 to-sky-700 transition-all duration-500 ${termsAccepted ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} />
                  <span className={actionBtnInner}>
                    <span className={termsAccepted ? "text-white" : undefined}>Samþykkja Skilmála</span>
                  </span>
                </button>
                {product.uppselt ? (
                  <button type="button" onClick={handleWaitlistClick} disabled={orderDisabled} className={`${actionBtnBase} border-[var(--color-accent)]/60 text-[var(--color-accent)] disabled:opacity-45`}>
                    <span className={actionBtnInner}>{waitlisted ? "Skráð" : isWaitlisting ? "Skrái…" : "Panta"}</span>
                  </button>
                ) : (
                  <button type="button" onClick={goOrder} disabled={orderDisabled} className={`${actionBtnBase} border-[var(--color-accent)]/60 text-[var(--color-accent)] disabled:opacity-45`}>
                    <span aria-hidden className={`pointer-events-none absolute inset-0 origin-center bg-[var(--color-accent)] transition-all duration-500 ${termsAccepted ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} />
                    <span className={actionBtnInner}>
                      <span className={termsAccepted ? "text-white" : undefined}>{ordering ? "Andartak…" : "Panta"}</span>
                    </span>
                  </button>
                )}
              </div>
              {!termsAccepted ? (
                <p className="text-center text-xs text-gray-500">
                  Samþykktu{" "}
                  <Link href="/legal" target="_blank" rel="noopener noreferrer" className="text-gray-700 underline">
                    skilmála
                  </Link>{" "}
                  til að panta
                </p>
              ) : null}
              {orderError ? <p className="text-center text-sm text-red-600">{orderError}</p> : null}
              {waitlistError ? <p className="text-center text-sm text-red-600">{waitlistError}</p> : null}
            </div>
          </div>

          <div className="order-2 min-w-0 space-y-3 sm:space-y-4 md:order-none">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 break-words">{product.name}</h1>
                <p className={`mt-2 sm:mt-3 text-xl sm:text-2xl font-extrabold ${insured && insuranceAvailable ? "text-emerald-600" : "text-[var(--color-secondary)]"}`}>
                  {formattedPrice}/mánuði
                </p>
              </div>

              {storages.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Geymsla</p>
                  <div className="flex flex-wrap gap-2">
                    {storages.map((gb) => (
                      <button
                        key={gb}
                        type="button"
                        onClick={() => setSelectedStorage(gb)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${selectedStorage === gb ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-gray-200 text-gray-700"}`}
                      >
                        {formatStorage(gb)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {product.description ? <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.description}</p> : null}

              {bullets.length > 0 ? (
                <ul className="space-y-1.5">
                  {bullets.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-gray-600">
                      <svg className="mt-1.5 h-1 w-1 flex-shrink-0 text-[var(--color-accent)]" viewBox="0 0 8 8" fill="currentColor">
                        <circle cx="4" cy="4" r="4" />
                      </svg>
                      <span className="break-words">{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <IncludedItems value={product.innifalid} tone="light" />

              {maxExtra > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-700">Auka fjarstýringar</span>
                  <div className="flex items-center gap-2">
                    <button type="button" className="h-8 w-8 rounded-md border" onClick={() => setExtraControllers((n) => Math.max(0, n - 1))}>−</button>
                    <span className="w-6 text-center text-sm">{extraControllers}</span>
                    <button type="button" className="h-8 w-8 rounded-md border" onClick={() => setExtraControllers((n) => Math.min(maxExtra, n + 1))}>+</button>
                  </div>
                </div>
              ) : null}

              {appleAccessories.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Aukahlutir</p>
                  {appleAccessories.map((a) => (
                    <label key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                      <span>{a.name}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-gray-500">+{formatKr(parsePrice(a.price))} kr</span>
                        <input
                          type="checkbox"
                          checked={selectedAccessoryIds.includes(a.id)}
                          onChange={() =>
                            setSelectedAccessoryIds((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))
                          }
                        />
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}

              {keyboards.length > 0 || mouses.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 justify-items-center rounded-2xl border border-gray-200 bg-gray-50/40 p-3">
                  {keyboards.length > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={addons.lyklabord} onChange={(e) => setAddons({ ...addons, lyklabord: e.target.checked })} />
                        Lyklaborð
                      </label>
                      <button type="button" onClick={() => openAccessoryModal("keyboard")} className="text-xs text-[var(--color-accent)] underline">
                        Sjá nánar
                      </button>
                    </div>
                  ) : null}
                  {mouses.length > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={addons.mus} onChange={(e) => setAddons({ ...addons, mus: e.target.checked })} />
                        Mús
                      </label>
                      <button type="button" onClick={() => openAccessoryModal("mouse")} className="text-xs text-[var(--color-accent)] underline">
                        Sjá nánar
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {selectedScreen ? (
              <div className={`rounded-2xl border bg-white p-3.5 sm:p-4 ${screenAdded ? "border-[var(--color-accent)]/50" : "border-gray-200"}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Bæta við pöntun</p>
                    <h2 className="text-sm sm:text-base font-bold text-gray-900">Skjár</h2>
                  </div>
                  {compatScreens.length > 1 ? (
                    <button type="button" onClick={() => openAccessoryModal("screen")} className="text-xs font-medium text-[var(--color-accent)] hover:underline">
                      Skipta
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-3 items-stretch">
                  <button type="button" onClick={() => openAccessoryModal("screen")} className="relative flex-shrink-0 w-24 sm:w-28 aspect-[4/3] rounded-xl bg-gray-50 border border-gray-200 overflow-hidden">
                    {screenPreviewUrl ? <img src={screenPreviewUrl} alt="" className="h-full w-full object-contain p-1.5" /> : null}
                  </button>
                  <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{selectedScreen.name}</p>
                      <p className="mt-1.5 text-sm font-bold text-[var(--color-secondary)]">
                        {parsePrice(selectedScreen.price) > 0 ? `+${formatKr(parsePrice(selectedScreen.price))} kr/mán` : "Innifalið"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddons((prev) => ({ ...prev, skjár: !prev.skjár }))}
                      className={`self-start rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold ${screenAdded ? "bg-[var(--color-accent)] text-white" : "bg-gray-100 text-gray-800"}`}
                    >
                      {screenAdded ? "Fjarlægja" : "Bæta við"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {modalType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalType(null)}>
          <div className="max-w-lg w-full rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{modalType === "screen" ? "Skjáir" : modalType === "keyboard" ? "Lyklaborð" : "Mýs"}</h3>
              <button type="button" onClick={() => setModalType(null)} className="text-sm text-gray-500">
                Loka
              </button>
            </div>
            {modalType === "screen"
              ? compatScreens.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedScreenId(s.id);
                      setModalType(null);
                    }}
                    className={`block w-full text-left rounded-lg px-3 py-2 mb-1 ${selectedScreenId === s.id ? "bg-gray-100" : ""}`}
                  >
                    {s.name}
                  </button>
                ))
              : (modalType === "keyboard" ? keyboards : mouses).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (modalType === "keyboard") setSelectedKeyboardId(a.id);
                      else setSelectedMouseId(a.id);
                      setModalType(null);
                    }}
                    className="block w-full text-left rounded-lg px-3 py-2 mb-1 hover:bg-gray-50"
                  >
                    {a.name}
                  </button>
                ))}
            {modalLoading ? <p className="text-sm text-gray-500 mt-2">Hleð myndum…</p> : null}
            {modalImages[modalActiveIndex] ? (
              <img
                src={modalImages[modalActiveIndex].signedUrl}
                alt=""
                className="mt-3 max-h-64 w-full object-contain cursor-zoom-in"
                onClick={() => setZoomImageSrc(modalImages[modalActiveIndex].signedUrl)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {zoomImageSrc ? (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setZoomImageSrc(null)}>
          <img src={zoomImageSrc} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  );
}
