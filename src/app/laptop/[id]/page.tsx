"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { supabasePublic } from "@/lib/supabase-public";
import { useAuth } from "@/contexts/AuthContext";
import IncludedItems from "@/components/IncludedItems";

interface LaptopRow {
  id: string;
  name: string;
  description: string | null;
  innifalid?: string | null;
  active: boolean | null;
}

interface VariantRow {
  id: string;
  laptop_id: string;
  storage_gb: number;
  price: number;
  trygging: number | null;
  repeat_url: string | null;
  repeat_url_trygging: string | null;
}

interface ImageFile {
  name: string;
  path: string;
  signedUrl: string;
}

const formatMonthly = (n: number) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kr/mánuði`;

const formatStorage = (gb: number) =>
  gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`;

const formatKr = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export default function LaptopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const laptopId = String(params.id || "");

  const [ordering, setOrdering] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [item, setItem] = useState<LaptopRow | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  const [images, setImages] = useState<ImageFile[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [imagesLoading, setImagesLoading] = useState<boolean>(true);

  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [withInsurance, setWithInsurance] = useState<boolean>(false);
  const [pricePulse, setPricePulse] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      if (!laptopId) return;
      setLoading(true);
      setNotFound(false);
      const clients = [supabasePublic, supabase];
      let laptop: LaptopRow | null = null;
      let variantRows: VariantRow[] = [];
      for (const client of clients) {
        try {
          const { data, error } = await client
            .from("laptops")
            .select("id, name, description, innifalid, active")
            .eq("id", laptopId)
            .single();
          if (!error && data) {
            laptop = data as LaptopRow;
            const { data: vData } = await client
              .from("laptop_variants")
              .select("id, laptop_id, storage_gb, price, trygging, repeat_url, repeat_url_trygging")
              .eq("laptop_id", laptopId)
              .order("price", { ascending: true });
            variantRows = (vData as VariantRow[]) || [];
            break;
          }
        } catch {
          // try next client
        }
      }
      if (!alive) return;
      if (!laptop) {
        setNotFound(true);
        setItem(null);
        setLoading(false);
        return;
      }
      setItem(laptop);
      setVariants(variantRows);
      setLoading(false);
    };
    fetchData();
    return () => { alive = false; };
  }, [laptopId]);

  // Images live under laptopimages/<laptopId>/
  useEffect(() => {
    let alive = true;
    const fetchImages = async () => {
      if (!laptopId) return;
      setImagesLoading(true);
      try {
        const res = await fetch("/api/images/list-generic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: "laptopimages", folder: laptopId }),
        });
        if (!alive) return;
        if (res.ok) {
          const j = await res.json();
          setImages((j?.files as ImageFile[]) || []);
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
  }, [laptopId]);

  const allStorages = useMemo(
    () => Array.from(new Set(variants.map((v) => v.storage_gb))).sort((a, b) => a - b),
    [variants]
  );

  useEffect(() => {
    if (variants.length === 0) return;
    if (selectedStorage !== null) return;
    setSelectedStorage(Math.min(...variants.map((v) => v.storage_gb)));
  }, [variants, selectedStorage]);

  const selectedVariant = useMemo(() => {
    if (selectedStorage === null) return null;
    return variants.find((v) => v.storage_gb === selectedStorage) || null;
  }, [variants, selectedStorage]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [images.length]);

  useEffect(() => {
    // Drop insurance if the new variant can't support it
    if (!selectedVariant) {
      setWithInsurance(false);
      return;
    }
    const canInsure =
      selectedVariant.trygging != null &&
      Number.isFinite(Number(selectedVariant.trygging)) &&
      !!selectedVariant.repeat_url_trygging;
    if (!canInsure) setWithInsurance(false);
  }, [selectedVariant]);

  const insuranceAvailable =
    !!selectedVariant &&
    selectedVariant.trygging != null &&
    Number.isFinite(Number(selectedVariant.trygging)) &&
    !!selectedVariant.repeat_url_trygging;

  const displayPrice = useMemo(() => {
    if (!selectedVariant) return null;
    const base = Number(selectedVariant.price) || 0;
    const insurance = Number(selectedVariant.trygging) || 0;
    return withInsurance ? base + insurance : base;
  }, [selectedVariant, withInsurance]);

  const checkoutUrl = useMemo(() => {
    if (!selectedVariant) return null;
    if (withInsurance) return selectedVariant.repeat_url_trygging;
    return selectedVariant.repeat_url;
  }, [selectedVariant, withInsurance]);

  const toggleInsurance = () => {
    if (!insuranceAvailable) return;
    setWithInsurance((prev) => !prev);
    setPricePulse(true);
    window.setTimeout(() => setPricePulse(false), 420);
  };

  const handleTermsClick = () => {
    setTermsAccepted((prev) => !prev);
  };

  // Only hand off to Repeat — the order is created by the webhook after payment succeeds.
  const handlePanta = () => {
    if (ordering || !termsAccepted) return;
    if (!checkoutUrl) return;

    if (!session?.user) {
      router.push(`/auth?redirect=/laptop/${laptopId}`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0b0b12] via-[#11121c] to-[#1a0f1e] py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="aspect-[4/3] rounded-2xl bg-white/10 animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-3/5 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0b0b12] via-[#11121c] to-[#1a0f1e] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-white/70">Fann ekki fartölvuna.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            Til baka
          </button>
        </div>
      </div>
    );
  }

  const actionBtnBase =
    "relative overflow-hidden rounded-xl border px-1.5 sm:px-3 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition-all duration-300 ease-out cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed min-w-0";
  const actionBtnInner =
    "relative z-10 inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-w-0";

  const pantaReady = termsAccepted && !!checkoutUrl;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-gradient-to-br from-[#0b0b12] via-[#11121c] to-[#1a0f1e] py-6 sm:py-12">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[var(--color-accent)]/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push("/#laptops")}
          className="mb-4 sm:mb-6 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
        >
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L8.31 10l4.47 4.47a.75.75 0 010 1.06z" /></svg>
          Allar vörur
        </button>

        <div className="grid gap-5 sm:gap-8 md:grid-cols-2 items-start">
          {/* contents → phone reorders gallery/details/buttons; md → left column under gallery */}
          <div className="contents md:flex md:flex-col md:gap-4">
          <div className="order-1 min-w-0 space-y-3 sm:space-y-4 md:order-none">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
              <div className="relative aspect-[4/3] flex items-center justify-center bg-black/30 p-2 sm:p-0">
                {imagesLoading ? (
                  <div className="text-white/40 text-sm">Hleð myndum…</div>
                ) : images.length > 0 ? (
                  <>
                    <img
                      key={images[activeImageIndex]?.path}
                      src={images[activeImageIndex]?.signedUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                      loading="eager"
                    />
                    {images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveImageIndex((i) => (i - 1 + images.length) % images.length)}
                          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
                          aria-label="Fyrri mynd"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 111.06 1.06L9.31 10l3.47 3.47a.75.75 0 010 1.06z" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
                          aria-label="Næsta mynd"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7.22 4.47a.75.75 0 011.06 0l4 4c.3.3.3.77 0 1.06l-4 4a.75.75 0 11-1.06-1.06L10.69 10 7.22 6.53a.75.75 0 010-1.06z" /></svg>
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <div className="text-white/30 flex flex-col items-center gap-2">
                    <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l3.75-3h10.5L21 7.5v9l-3.75 3H6.75L3 16.5v-9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 14.25l4.5-4.5 6 6 2.25-2.25L21 16.5" />
                    </svg>
                  </div>
                )}
              </div>
              {images.length > 1 ? (
                <div className="p-2 sm:p-3 border-t border-white/10">
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {images.map((img, idx) => (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative flex-shrink-0 h-14 w-16 sm:h-16 sm:w-20 rounded-lg border bg-black/30 overflow-hidden ${activeImageIndex === idx ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/40" : "border-white/10 hover:border-white/30"}`}
                      >
                        <img src={img.signedUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="order-3 min-w-0 space-y-3 sm:space-y-4 md:order-none">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={toggleInsurance}
                disabled={!insuranceAvailable}
                aria-pressed={withInsurance}
                title={
                  insuranceAvailable
                    ? withInsurance
                      ? "Fjarlægja tryggingu"
                      : `Bæta við tryggingu (+${formatKr(Number(selectedVariant?.trygging || 0))} kr)`
                    : "Trygging ekki í boði fyrir þetta tilbrigði"
                }
                className={`${actionBtnBase} ${
                  withInsurance
                    ? "border-emerald-400/50 text-white shadow-[0_0_28px_-8px_rgba(16,185,129,0.85)]"
                    : "border-emerald-400/45 text-emerald-300/85 hover:border-emerald-400/70 hover:bg-emerald-500/10"
                } focus-visible:outline-emerald-400 disabled:opacity-40`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 origin-center bg-gradient-to-br from-emerald-500 to-teal-600 transition-all duration-500 ease-out ${
                    withInsurance ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                />
                <span className={actionBtnInner}>
                  <svg
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-500 ${withInsurance ? "scale-110 text-white" : "scale-100"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3z" />
                    {withInsurance ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8L15 10" />
                    ) : null}
                  </svg>
                  <span className={withInsurance ? "text-white" : undefined}>Trygging</span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleTermsClick}
                aria-pressed={termsAccepted}
                className={`${actionBtnBase} ${
                  termsAccepted
                    ? "border-sky-400/50 text-white shadow-[0_0_28px_-10px_rgba(56,189,248,0.7)]"
                    : "border-sky-400/45 text-sky-300/85 hover:border-sky-400/70 hover:bg-sky-500/10"
                } focus-visible:outline-sky-400`}
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

              <button
                type="button"
                onClick={handlePanta}
                disabled={!pantaReady || ordering}
                className={`${actionBtnBase} ${
                  pantaReady
                    ? "border-[var(--color-accent)]/60 text-white shadow-[0_0_28px_-8px_var(--color-accent)]"
                    : "border-[var(--color-accent)]/45 text-[var(--color-accent)]/85 hover:border-[var(--color-accent)]/70"
                } focus-visible:outline-[var(--color-accent)] disabled:opacity-45`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 origin-center bg-[var(--color-accent)] transition-all duration-500 ease-out delay-75 ${
                    pantaReady ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                />
                <span className={actionBtnInner}>
                  <svg
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-transform duration-500 ${pantaReady ? "scale-110 text-white" : "scale-100"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7h17l-1.2 11.2a2 2 0 01-2 1.8H6.7a2 2 0 01-2-1.8L3.5 7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5.5A2.5 2.5 0 0110.5 3h3A2.5 2.5 0 0116 5.5V7" />
                  </svg>
                  <span className={pantaReady ? "text-white" : undefined}>
                    {ordering ? "Andartak…" : "Panta"}
                  </span>
                </span>
              </button>
            </div>

            {!termsAccepted ? (
              <p className="text-center text-xs text-white/45">
                Samþykktu{" "}
                <Link href="/legal" target="_blank" rel="noopener noreferrer" className="text-white/70 underline underline-offset-2 hover:text-white">
                  skilmála
                </Link>{" "}
                til að panta
              </p>
            ) : withInsurance && selectedVariant?.trygging != null ? (
              <p className="text-center text-xs text-emerald-300/80">
                Trygging virk · +{formatKr(Number(selectedVariant.trygging))} kr/mán
              </p>
            ) : null}

            {orderError ? (
              <p className="text-center text-sm text-red-400 break-words">{orderError}</p>
            ) : null}
          </div>
          </div>

          <div className="order-2 min-w-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 md:order-none">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight break-words bg-gradient-to-r from-white via-white to-[var(--color-accent)] bg-clip-text text-transparent">
                {item.name}
              </h1>
              {displayPrice != null ? (
                <div className="mt-2 sm:mt-3">
                  <p
                    key={`${displayPrice}-${withInsurance}`}
                    className={`text-xl sm:text-2xl font-bold break-words transition-all duration-300 ${
                      withInsurance ? "text-emerald-400" : "text-[var(--color-accent)]"
                    } ${pricePulse ? "scale-[1.04]" : "scale-100"}`}
                  >
                    {formatMonthly(displayPrice)}
                  </p>
                  {withInsurance && selectedVariant ? (
                    <p className="mt-1 text-xs text-white/45">
                      {formatMonthly(Number(selectedVariant.price))} + {formatKr(Number(selectedVariant.trygging || 0))} kr trygging
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 sm:mt-3 text-base sm:text-lg font-medium text-white/50">Verð kemur fljótlega</p>
              )}
            </div>

            {item.description && item.description.split(",").map((s) => s.trim()).filter(Boolean).length > 0 ? (
              <ul className="space-y-1.5">
                {item.description.split(",").map((s) => s.trim()).filter(Boolean).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-white/60 min-w-0">
                    <svg className="mt-1.5 h-1 w-1 flex-shrink-0 text-[var(--color-accent)]" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    <span className="min-w-0 break-words">{feature}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <IncludedItems value={item.innifalid} tone="dark" />

            {variants.length > 0 ? (
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80">Geymsla</p>
                <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                  {allStorages.map((s) => {
                    const isSelected = selectedStorage === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedStorage(s)}
                        className={`rounded-xl px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold transition-all ${
                          isSelected
                            ? "bg-[var(--color-accent)] text-white shadow-[0_0_24px_-6px_var(--color-accent)]"
                            : "border border-white/15 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10"
                        }`}
                      >
                        {formatStorage(s)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {variants.length > 0 && !selectedVariant ? (
              <p className="text-sm text-white/50">Þessi samsetning er ekki í boði.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
