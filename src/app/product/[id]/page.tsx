"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

  const handleOrderClick = () => {
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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Til baka
          </button>
        </div>
      </div>

      {/* Product Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {/* Product Image */}
          <div className="aspect-video bg-gray-200 dark:bg-gray-700" />

          {/* Product Details */}
          <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {product.title}
            </h1>
            
            {/* Specifications */}
            <div className="grid gap-6 sm:grid-cols-2 mb-8">
              <div className="space-y-4">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Skjákort
                  </h3>
                  <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {product.beds}
                  </p>
                </div>
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Örgjörvi
                  </h3>
                  <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {product.baths}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Geymsla
                  </h3>
                  <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {product.sqft}
                  </p>
                </div>
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Verð
                  </h3>
              <p className="mt-2 text-2xl font-bold text-[var(--color-secondary)]">
                    {product.price}/mánuði
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Um vöruna
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Þetta er hágæða tölva sem er tilbúin fyrir allt sem þú getur ímyndað þér. 
                Með nýjustu tækni og öflugustu íhlutum er þetta fullkomna valið fyrir leikja, 
                vinnu og skemmtun. Tölvan kemur með öllum nauðsynlegum íhlutum og er tilbúin 
                til notkunar strax.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleOrderClick}
                className="flex-1 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
                Leigja núna
              </button>
               <button
                 onClick={() => {
                   router.push('/');
                   setTimeout(() => {
                     window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                   }, 100);
                 }}
                 className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-center">
                 Sjá allar vörur
               </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
