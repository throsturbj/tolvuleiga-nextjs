"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface ScreenRow {
  id: string;
  framleidandi: string;
  skjastaerd: string;
  upplausn: string;
  skjataekni: string;
  endurnyjunartidni: string;
  verd?: string | null;
  repeat_url?: string | null;
  repeat_url_trygging?: string | null;
}

const formatKr = (n: number) =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export default function ProductScreenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const screenId = String(params.id || "");
  const [item, setItem] = useState<ScreenRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [images, setImages] = useState<{ name: string; path: string; signedUrl: string }[]>([]);
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [ordering, setOrdering] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchItem = async () => {
      if (!screenId) {
        setItem(null);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("screens")
          .select("id, framleidandi, skjastaerd, upplausn, skjataekni, endurnyjunartidni, verd, repeat_url, repeat_url_trygging")
          .eq("id", screenId)
          .single();
        if (!isMounted) return;
        if (error) {
          setItem(null);
        } else {
          setItem(data as ScreenRow);
        }
      } catch {
        if (isMounted) setItem(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchItem();
    return () => { isMounted = false; };
  }, [screenId]);

  useEffect(() => {
    let alive = true;
    const fetchImages = async () => {
      if (!screenId) return;
      setImagesLoading(true);
      try {
        const res = await fetch("/api/images/list-generic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: "screens", folder: String(screenId) }),
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
  }, [screenId]);

  const basePrice = (() => {
    const digits = (item?.verd || "").toString().replace(/\D+/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
  })();
  const finalPrice = Math.ceil(basePrice / 10) * 10;
  const formattedPrice = `${formatKr(finalPrice)} kr`;
  const checkoutUrl = item?.repeat_url?.trim() || null;

  const title = item ? `${item.framleidandi} ${item.skjastaerd}` : "";
  const specBullets = item
    ? [
        item.skjastaerd ? `Skjástærð: ${item.skjastaerd}` : null,
        item.upplausn ? `Upplausn: ${item.upplausn}` : null,
        item.skjataekni ? `Skjátegund: ${item.skjataekni}` : null,
        item.endurnyjunartidni ? `Endurnýjunartíðni: ${item.endurnyjunartidni}` : null,
        item.framleidandi ? `Framleiðandi: ${item.framleidandi}` : null,
      ].filter((x): x is string => Boolean(x))
    : [];

  // Only hand off to Repeat — the order is created by the webhook after payment succeeds.
  const handlePanta = () => {
    if (ordering || !termsAccepted) return;
    if (!checkoutUrl) return;

    if (!session?.user) {
      router.push(`/auth?redirect=/productscreen/${screenId}`);
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

  const actionBtnBase =
    "relative overflow-hidden rounded-xl border px-1.5 sm:px-3 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition-all duration-300 ease-out cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed min-w-0";
  const actionBtnInner =
    "relative z-10 inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-w-0";

  const pantaReady = termsAccepted && !!checkoutUrl;
  const orderDisabled = !pantaReady || ordering;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">Hleður vörunni…</div>
      </div>
    );
  }

  if (!item) {
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

  return (
    <div className="relative min-h-screen overflow-x-clip bg-gray-50 py-6 sm:py-10">
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/#screens")}
          className="mb-4 sm:mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L8.31 10l4.47 4.47a.75.75 0 010 1.06z" /></svg>
          Allar vörur
        </button>

        <div className="grid gap-5 sm:gap-8 md:grid-cols-2 items-start">
          <div className="contents md:flex md:flex-col md:gap-4">
            {/* Left: Product Images */}
            <div className="order-1 min-w-0 space-y-3 sm:space-y-4 md:order-none">
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center p-2 sm:p-0">
                  {imagesLoading ? (
                    <div className="text-gray-400 text-sm">Hleð myndum…</div>
                  ) : images.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const src = images[activeImageIndex]?.signedUrl;
                          if (src) setZoomImageSrc(src);
                        }}
                        className="h-full w-full flex items-center justify-center cursor-zoom-in"
                        aria-label="Stækka mynd"
                      >
                        <img
                          key={images[activeImageIndex]?.path}
                          src={images[activeImageIndex]?.signedUrl}
                          alt={title}
                          className="max-h-full max-w-full object-contain"
                          loading="eager"
                        />
                      </button>
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
            </div>

            {/* Actions — bottom on phone; under gallery on desktop */}
            <div className="order-3 min-w-0 space-y-3 sm:space-y-4 md:order-none">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
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

                <button
                  type="button"
                  onClick={handlePanta}
                  disabled={orderDisabled}
                  className={`${actionBtnBase} ${
                    pantaReady
                      ? "border-[var(--color-accent)]/60 text-white shadow-[0_0_28px_-8px_var(--color-accent)]"
                      : "border-[var(--color-accent)]/45 text-[var(--color-accent)]/85"
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
                <p className="text-center text-xs text-gray-500">
                  Samþykktu{" "}
                  <Link href="/legal" target="_blank" rel="noopener noreferrer" className="text-gray-700 underline underline-offset-2 hover:text-gray-900">
                    skilmála
                  </Link>{" "}
                  til að panta
                </p>
              ) : !checkoutUrl ? (
                <p className="text-center text-xs text-amber-700">
                  Greiðsluhlekk vantar fyrir þessa vöru
                </p>
              ) : null}
              {orderError ? (
                <p className="text-center text-sm text-red-600 break-words">{orderError}</p>
              ) : null}
            </div>
          </div>

          {/* Right: Details */}
          <div className="order-2 min-w-0 space-y-3 sm:space-y-4 md:order-none">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 break-words">
                  {title}
                </h1>
                <p className="mt-2 sm:mt-3 text-xl sm:text-2xl font-extrabold break-words text-[var(--color-secondary)]">
                  {formattedPrice}/mánuði
                </p>
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
            </div>
          </div>
        </div>
      </div>

      {/* Image lightbox overlay */}
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
