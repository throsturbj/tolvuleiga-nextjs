"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { supabasePublic } from "@/lib/supabase-public";
import { useAuth } from "@/contexts/AuthContext";

interface LaptopRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean | null;
}

interface VariantRow {
  id: string;
  laptop_id: string;
  storage_gb: number;
  price: number;
  repeat_url: string | null;
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
            .select("id, name, description, active")
            .eq("id", laptopId)
            .single();
          if (!error && data) {
            laptop = data as LaptopRow;
            const { data: vData } = await client
              .from("laptop_variants")
              .select("id, laptop_id, storage_gb, price, repeat_url")
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

  const generateOrderNumber = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };

  const handlePanta = async () => {
    if (ordering) return;
    if (!selectedVariant?.repeat_url) return;

    if (!session?.user) {
      router.push("/auth?redirect=/dashboard");
      return;
    }

    setOrderError(null);
    setOrdering(true);
    try {
      const orderNumber = generateOrderNumber();
      const { error } = await supabase.from("orders").insert([
        {
          auth_uid: session.user.id,
          status: "Bíður greiðslu",
          orderNumber,
          verd: String(selectedVariant.price),
          timabilFra: new Date().toISOString(),
          laptop_variant_uuid: selectedVariant.id,
        },
      ]);

      if (error) {
        setOrderError("Ekki tókst að stofna pöntun. Reyndu aftur.");
        setOrdering(false);
        return;
      }

      const url = new URL(selectedVariant.repeat_url);
      url.searchParams.set("reference", orderNumber);
      window.location.href = url.toString();
    } catch {
      setOrderError("Ekki tókst að stofna pöntun. Reyndu aftur.");
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0b0b12] via-[#11121c] to-[#1a0f1e] py-12">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[var(--color-accent)]/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push("/#laptops")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L8.31 10l4.47 4.47a.75.75 0 010 1.06z" /></svg>
          Allar vörur
        </button>

        <div className="grid gap-8 md:grid-cols-2 items-start">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
              <div className="relative aspect-[4/3] flex items-center justify-center bg-black/30">
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
                          className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
                          aria-label="Fyrri mynd"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.78 15.53a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 111.06 1.06L9.31 10l3.47 3.47a.75.75 0 010 1.06z" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
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
                <div className="p-3 border-t border-white/10">
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative flex-shrink-0 h-16 w-20 rounded-lg border bg-black/30 overflow-hidden ${activeImageIndex === idx ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/40" : "border-white/10 hover:border-white/30"}`}
                      >
                        <img src={img.signedUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {selectedVariant?.repeat_url ? (
              <button
                type="button"
                onClick={handlePanta}
                disabled={ordering}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3.5 text-base font-bold text-white shadow-[0_0_30px_-8px_var(--color-accent)] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {ordering ? "Andartak…" : "Panta"}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3.5 text-base font-bold text-white/40 cursor-not-allowed"
              >
                Panta
              </button>
            )}
            {orderError ? (
              <p className="text-center text-sm text-red-400">{orderError}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 sm:p-8 space-y-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-[var(--color-accent)] bg-clip-text text-transparent">
                {item.name}
              </h1>
              {selectedVariant ? (
                <p className="mt-3 text-2xl font-bold text-[var(--color-accent)]">
                  {formatMonthly(Number(selectedVariant.price))}
                </p>
              ) : (
                <p className="mt-3 text-lg font-medium text-white/50">Verð kemur fljótlega</p>
              )}
            </div>

            {item.description && item.description.split(",").map((s) => s.trim()).filter(Boolean).length > 0 ? (
              <ul className="space-y-1.5">
                {item.description.split(",").map((s) => s.trim()).filter(Boolean).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-white/60">
                    <svg className="mt-1.5 h-1 w-1 flex-shrink-0 text-[var(--color-accent)]" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {variants.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-white/80">Geymsla</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {allStorages.map((s) => {
                    const isSelected = selectedStorage === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedStorage(s)}
                        className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
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
