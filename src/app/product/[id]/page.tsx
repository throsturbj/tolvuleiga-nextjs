"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type React from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  title: string;
  beds: string;
  baths: string;
  sqft: string;
  price: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const productId = params.id as string;


  // Product data - in a real app, this would come from an API
  const products: Record<string, Product> = {
    "tolva-1": {
      id: "tolva-1",
      title: "Tölva 1",
      beds: "Nvidia RTX 5080",
      baths: "Ryzen 9",
      sqft: "1 TB SSD Samsung 990",
      price: "24990 kr"
    },
    "tolva-2": {
      id: "tolva-2", 
      title: "Tölva 2",
      beds: "Nvidia RTX 5070",
      baths: "Ryzen 7",
      sqft: "1 TB SSD Samsung 990",
      price: "19990 kr"
    },
    "playstation-5": {
      id: "playstation-5",
      title: "Playstation 5",
      beds: "4K@120 Hz",
      baths: "1 TB SSD",
      sqft: "8K leikjaspilun",
      price: "14990 kr"
    }
  };

  const product = products[productId];

  // Rental UI (kept on product page)
  const durations = [1, 3, 6, 12] as const;
  const [durationIndex, setDurationIndex] = useState<number>(1);
  const sliderProgress = (durationIndex / (durations.length - 1)) * 100;
  const [addons, setAddons] = useState({ skjár: false, lyklabord: false, mus: false });

  const handleOrderClick = () => {
    try {
      if (typeof window !== 'undefined') {
        const selection = {
          productId,
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
      router.push(`/order/${productId}`);
    } else {
      // User is not signed in, redirect to auth page
      router.push(`/auth?redirect=/order/${productId}`);
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Vörunni finnst ekki
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 md:grid-cols-2 items-start">
          {/* Left: Product Image */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Right: Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{product.title}</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Stutt samantekt á helstu eiginleikum</p>
            </div>

            {/* Key specs */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-gray-500 dark:text-gray-400">Skjákort</p>
                <p className="mt-1 font-medium text-gray-900 dark:text-white">{product.beds}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-gray-500 dark:text-gray-400">Örgjörvi</p>
                <p className="mt-1 font-medium text-gray-900 dark:text-white">{product.baths}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-gray-500 dark:text-gray-400">Geymsla</p>
                <p className="mt-1 font-medium text-gray-900 dark:text-white">{product.sqft}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-gray-500 dark:text-gray-400">Verð</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-secondary)]">{product.price}/mánuði</p>
              </div>
            </div>

            {/* Duration slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Tímabil</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{durations[durationIndex]} mánuðir</p>
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
                  style={{ ...( { ['--progress']: `${sliderProgress}%` } as unknown as React.CSSProperties ) }}
                  aria-label="Veldu leigutímabil"
                />
              </div>
              <div className="mt-1 w-full max-w-xs sm:max-w-sm mx-auto flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                {durations.map((m, idx) => (
                  <span key={m} className={idx === durationIndex ? 'text-[var(--color-accent)] font-medium' : ''}>{m}m</span>
                ))}
              </div>
            </div>

            {/* Add-on toggles */}
            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Aukahlutir</p>
              <div className="grid grid-cols-3 gap-3">
                {/* Skjár */}
                <label htmlFor="toggle-skrar" className="group flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                  <input id="toggle-skrar" type="checkbox" className="sr-only" checked={addons.skjár}
                    onChange={(e) => setAddons({ ...addons, skjár: e.target.checked })} />
                  <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                    <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                  </span>
                  Skjár
                </label>
                {/* Lyklaborð */}
                <label htmlFor="toggle-lyklabord" className="group flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                  <input id="toggle-lyklabord" type="checkbox" className="sr-only" checked={addons.lyklabord}
                    onChange={(e) => setAddons({ ...addons, lyklabord: e.target.checked })} />
                  <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 transition-colors group-has-[:checked]:bg-[var(--color-accent)]">
                    <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform duration-200 group-has-[:checked]:translate-x-4" />
                  </span>
                  Lyklaborð
                </label>
                {/* Mús */}
                <label htmlFor="toggle-mus" className="group flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
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
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleOrderClick}
                className="flex-1 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                Leigja núna
              </button>
              <button
                onClick={() => {
                  router.push('/');
                  setTimeout(() => {
                    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                  }, 100);
                }}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-center"
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
