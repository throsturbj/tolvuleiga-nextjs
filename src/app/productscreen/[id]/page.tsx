"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type React from "react";
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
}

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
  const [insured, setInsured] = useState<boolean>(false);
  const [animatingInsurance, setAnimatingInsurance] = useState<boolean>(false);

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
          .select("id, framleidandi, skjastaerd, upplausn, skjataekni, endurnyjunartidni, verd")
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

  const durations = [1, 3, 6, 12] as const;
  const [durationIndex, setDurationIndex] = useState<number>(0);
  const sliderProgress = (durationIndex / (durations.length - 1)) * 100;
  type ProgressStyle = React.CSSProperties & { ['--progress']?: string };
  const progressStyle: ProgressStyle = { '--progress': `${sliderProgress}%` };

  const basePrice = (() => {
    const digits = (item?.verd || '').toString().replace(/\D+/g, '');
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
  })();
  const discountRates = [0, 0.04, 0.08, 0.12] as const;
  const discountRate = discountRates[durationIndex] ?? 0;
  const discountedPriceRaw = Math.max(0, Math.round(basePrice * (1 - discountRate)));
  const insuranceMultiplier = insured ? 1.1 : 1;
  const finalPriceRaw = Math.round(discountedPriceRaw * insuranceMultiplier);
  const finalPrice = Math.ceil(finalPriceRaw / 10) * 10;
  const formattedPrice = `${finalPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr`;

  const handleOrderClick = () => {
    try {
      if (typeof window !== 'undefined') {
        const selection = {
          productId: screenId,
          months: durations[durationIndex],
          insured,
          finalPrice,
        };
        window.sessionStorage.setItem('orderSelection', JSON.stringify(selection));
      }
    } catch {}
    if (session?.user) {
      router.push(`/orderscreen/${screenId}`);
    } else {
      router.push(`/auth?redirect=/orderscreen/${screenId}`);
    }
  };

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
    <div className="min-h-screen bg-gray-50 pt-3">
      <div className={
        `relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 rounded-lg border bg-white overflow-hidden ` +
        (insured ? 'border-green-500' : 'border-transparent')
      }>
        {animatingInsurance ? (
          <>
            <svg className="pointer-events-none absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="99" height="99" rx="2" ry="2" fill="none" stroke="rgb(34,197,94)" strokeWidth="1" vectorEffect="non-scaling-stroke" pathLength="100" className="draw-border" />
            </svg>
            <div className="pointer-events-none absolute inset-0 bg-green-500/10 animate-flash" aria-hidden="true" />
          </>
        ) : null}
        <div className="grid gap-8 md:grid-cols-2 items-start">
          {/* Left: Images */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center">
              {imagesLoading ? (
                <div className="text-gray-400 text-sm">Hleð myndum…</div>
              ) : images.length > 0 ? (
                <>
                  <img
                    key={images[activeImageIndex]?.path}
                    src={images[activeImageIndex]?.signedUrl}
                    alt={`${item.framleidandi} ${item.skjastaerd}`}
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
              <div className="flex items-baseline justify-between gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">{item.framleidandi}</h1>
                <p className="text-xl font-semibold text-[var(--color-secondary)]">{formattedPrice}/mánuði</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Upplausn</p>
                <p className="mt-1 font-medium text-gray-900">{item.upplausn}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Skjátegund</p>
                <p className="mt-1 font-medium text-gray-900">{item.skjataekni}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Endurnýjunartíðni</p>
                <p className="mt-1 font-medium text-gray-900">{item.endurnyjunartidni}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Skjástærð</p>
                <p className="mt-1 font-medium text-gray-900">{item.skjastaerd}</p>
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
                  max={3}
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  if (animatingInsurance) return;
                  if (insured) {
                    setInsured(false);
                    return;
                  }
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
              <button
                onClick={handleOrderClick}
                className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] cursor-pointer"
              >
                Leigja núna
              </button>
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
          </div>
        </div>
      </div>

      {/* Insured label */}
      {insured ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-2 mb-2 text-center">
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 ring-1 ring-green-500/30">
            Vara tryggð
          </span>
        </div>
      ) : null}

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

