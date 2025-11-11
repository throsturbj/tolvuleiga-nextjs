"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const productIdParam = params.id as string;
  const productIdNum = Number(productIdParam);
  const [product, setProduct] = useState<GamingPCRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // Rental UI (kept on product page)
  const durations = [1, 3, 6, 12] as const;
  const [durationIndex, setDurationIndex] = useState<number>(0);
  const sliderProgress = (durationIndex / (durations.length - 1)) * 100;
  const [addons, setAddons] = useState({ skjár: false, lyklabord: false, mus: false });
  type ProgressStyle = React.CSSProperties & { ['--progress']?: string };
  const progressStyle: ProgressStyle = { '--progress': `${sliderProgress}%` };

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
          }
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
  const discountRates = [0, 0.04, 0.08, 0.12] as const;
  const discountRate = discountRates[durationIndex] ?? 0;
  const discountedPriceRaw = Math.max(0, Math.round(basePrice * (1 - discountRate)));
  const discountedPrice = Math.ceil(discountedPriceRaw / 10) * 10; // round up to next 10 kr
  const formattedPrice = `${discountedPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 md:grid-cols-2 items-start">
          {/* Left: Product Image */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="aspect-[4/3] bg-gray-200" />
          </div>

          {/* Right: Details */}
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            <div>
              <div className="flex items-baseline justify-between gap-4">
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
                <p className="text-sm text-gray-700 font-medium">Tímabil</p>
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
                  className="range-compact"
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

            {/* Add-on toggles */}
            <div className="space-y-3">
              <p className="text-sm text-gray-700 font-medium">Aukahlutir</p>
              <div className="grid grid-cols-3 gap-3 justify-center justify-items-center">
                {/* Skjár */}
                <label htmlFor="toggle-skrar" className="group inline-flex items-center justify-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input id="toggle-skrar" type="checkbox" className="sr-only" checked={addons.skjár}
                    onChange={(e) => setAddons({ ...addons, skjár: e.target.checked })} />
                  <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                    <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                  </span>
                  Skjár
                </label>
                {/* Lyklaborð */}
                <label htmlFor="toggle-lyklabord" className="group inline-flex items-center justify-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input id="toggle-lyklabord" type="checkbox" className="sr-only" checked={addons.lyklabord}
                    onChange={(e) => setAddons({ ...addons, lyklabord: e.target.checked })} />
                  <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                    <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                  </span>
                  Lyklaborð
                </label>
                {/* Mús */}
                <label htmlFor="toggle-mus" className="group inline-flex items-center justify-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input id="toggle-mus" type="checkbox" className="sr-only" checked={addons.mus}
                    onChange={(e) => setAddons({ ...addons, mus: e.target.checked })} />
                  <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                    <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                  </span>
                  Mús
                </label>
              </div>
            </div>

            {/* Actions */}
            {product.uppselt ? (
              <div className="rounded-md border border-gray-300 bg-gray-100 text-gray-700 text-sm px-3 py-2">
                Því miður er þessi vara uppseld
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleOrderClick}
                disabled={!!product.uppselt}
                className={
                  `flex-1 rounded-md px-4 py-2 text-sm font-medium text-white ` +
                  (product.uppselt
                    ? 'bg-[var(--color-accent)]/60 cursor-not-allowed'
                    : 'bg-[var(--color-accent)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]')
                }
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
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center"
              >
                Sjá allar vörur
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
