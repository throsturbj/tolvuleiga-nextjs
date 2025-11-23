"use client";


import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface ConsoleRow {
  id: string;
  nafn: string;
  verd: string;
  geymsluplass: string;
  numberofextracontrollers: string;
  verdextracontrollers: string;
  tengi: string;
}

export default function ConsoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { loading: authLoading, session } = useAuth();
  const consoleId = String(params.id || "");
  const [item, setItem] = useState<ConsoleRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<{ name: string; path: string; signedUrl: string }[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);

  // Accessories and rental UI (mirror product page)
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
  const [screens, setScreens] = useState<ScreenItem[]>([]);
  const [keyboards, setKeyboards] = useState<KeyboardItem[]>([]);
  const [mouses, setMouses] = useState<MouseItem[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [selectedKeyboardId, setSelectedKeyboardId] = useState<string | null>(null);
  const [selectedMouseId, setSelectedMouseId] = useState<string | number | null>(null);
  const [modalType, setModalType] = useState<null | 'screen' | 'keyboard' | 'mouse'>(null);
  const [modalImages, setModalImages] = useState<{ name: string; path: string; signedUrl: string }[]>([]);
  const [modalActiveIndex, setModalActiveIndex] = useState<number>(0);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const durations = [1, 3, 6, 12] as const;
  const [durationIndex, setDurationIndex] = useState<number>(0);
  const sliderProgress = (durationIndex / (durations.length - 1)) * 100;
  type ProgressStyle = React.CSSProperties & { ['--progress']?: string };
  const progressStyle: ProgressStyle = { '--progress': `${sliderProgress}%` };
  const [addons, setAddons] = useState({ skjár: false, lyklabord: false, mus: false });
  const [insured, setInsured] = useState<boolean>(false);
  const [animatingInsurance, setAnimatingInsurance] = useState<boolean>(false);
  const [extraControllers, setExtraControllers] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("gamingconsoles")
          .select("*")
          .eq("id", consoleId)
          .single();
        if (!isMounted) return;
        if (error) {
          setError(error.message);
          setItem(null);
        } else {
          setItem(data as ConsoleRow);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Unknown error");
          setItem(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (consoleId) fetchData();
    return () => { isMounted = false; };
  }, [consoleId]);

  // Load accessories linked to this console (junction tables)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sRes, kRes, mRes] = await Promise.all([
          supabase.from("screen_gamingconsoles").select("screen_id").eq("console_id", consoleId),
          supabase.from("keyboard_gamingconsoles").select("keyboard_id").eq("console_id", consoleId),
          supabase.from("mouse_gamingconsoles").select("mouse_id").eq("console_id", consoleId),
        ] as const);
        type ScreenLink = { screen_id: string };
        type KeyboardLink = { keyboard_id: string };
        type MouseLink = { mouse_id: string | number };
        const sLinks = (sRes?.data as ScreenLink[] | null) ?? [];
        const kLinks = (kRes?.data as KeyboardLink[] | null) ?? [];
        const mLinks = (mRes?.data as MouseLink[] | null) ?? [];
        if (!alive) return;
        const screenIds = Array.isArray(sLinks) ? sLinks.map(x => x.screen_id) : [];
        const keyboardIds = Array.isArray(kLinks) ? kLinks.map(x => x.keyboard_id) : [];
        const mouseIds = Array.isArray(mLinks) ? mLinks.map(x => x.mouse_id) : [];
        const [{ data: sRows }, { data: kRows }, { data: mRows }] = await Promise.all([
          screenIds.length > 0 ? supabase.from("screens").select("id, framleidandi, skjastaerd, upplausn, skjataekni, endurnyjunartidni, verd").in("id", screenIds) : Promise.resolve({ data: [] as ScreenItem[] } as unknown as { data: ScreenItem[] }),
          keyboardIds.length > 0 ? supabase.from("keyboards").select("id, nafn, framleidandi, staerd, tengimoguleiki, verd").in("id", keyboardIds) : Promise.resolve({ data: [] as KeyboardItem[] } as unknown as { data: KeyboardItem[] }),
          mouseIds.length > 0 ? supabase.from("mouses").select("id, nafn, framleidandi, fjolditakk, toltakka, tengimoguleiki, verd").in("id", mouseIds as (string | number)[]) : Promise.resolve({ data: [] as MouseItem[] } as unknown as { data: MouseItem[] }),
        ] as const);
        const sList = ((sRows as unknown) || []) as ScreenItem[];
        const kList = ((kRows as unknown) || []) as KeyboardItem[];
        const mList = ((mRows as unknown) || []) as MouseItem[];
        setScreens(sList);
        setKeyboards(kList);
        setMouses(mList);
        setSelectedScreenId((sList[0]?.id as string) ?? null);
        setSelectedKeyboardId((kList[0]?.id as string) ?? null);
        setSelectedMouseId((mList[0]?.id as string | number) ?? null);
      } catch {
        if (!alive) return;
        setScreens([]); setKeyboards([]); setMouses([]);
        setSelectedScreenId(null); setSelectedKeyboardId(null); setSelectedMouseId(null);
      }
    })();
    return () => { alive = false; };
  }, []);

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
  const extraControllersMax = (() => {
    const raw = String(item?.numberofextracontrollers || '').trim();
    const n = parseInt(raw.replace(/\D+/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  })();
  const extraControllerUnit = parsePrice(item?.verdextracontrollers);
  const extraControllersClamped = Math.min(Math.max(extraControllers, 0), extraControllersMax);
  const extraControllersTotal = extraControllersClamped * extraControllerUnit;
  const addOnTotal = screenPrice + keyboardPrice + mousePrice + extraControllersTotal;

  const basePrice = (() => {
    const digits = (item?.verd || '').toString().replace(/\D+/g, '');
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
  })();
  const discountRates = [0, 0.04, 0.08, 0.12] as const;
  const discountRate = discountRates[durationIndex] ?? 0;
  const discountedPriceRaw = Math.max(0, Math.round(basePrice * (1 - discountRate)));
  const insuranceMultiplier = insured ? 1.1 : 1;
  const finalPriceRaw = Math.round((discountedPriceRaw + addOnTotal) * insuranceMultiplier);
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

  useEffect(() => {
    let alive = true;
    const fetchImages = async () => {
      if (!consoleId) return;
      setImagesLoading(true);
      try {
        const res = await fetch("/api/images/list-generic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: "consoles", folder: consoleId }),
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
  }, [consoleId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse h-8 w-40 bg-gray-200 rounded mb-6" />
          <div className="h-64 bg-white border border-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Fann ekki leikjatölvuna.</p>
          <button onClick={() => router.push("/")} className="mt-4 inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95">
            Til baka
          </button>
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
          {/* Left: Images gallery */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center">
              {imagesLoading ? (
                <div className="text-gray-400 text-sm">Hleð myndum…</div>
              ) : images.length > 0 ? (
                <>
                  <img
                    key={images[activeImageIndex]?.path}
                    src={images[activeImageIndex]?.signedUrl}
                    alt={item.nafn}
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
                <h1 className="text-2xl font-semibold text-gray-900">{item.nafn}</h1>
                <p className="text-xl font-semibold text-[var(--color-secondary)]">{formattedPrice}/mánuði</p>
              </div>
            </div>
            {/* Key specs */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Geymslupláss</p>
                <p className="mt-1 font-medium text-gray-900">{item.geymsluplass}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-gray-500">Tengi</p>
                <p className="mt-1 font-medium text-gray-900">{item.tengi}</p>
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
            {/* Add-on toggles */}
            {(screens.length + keyboards.length + mouses.length > 0) || (extraControllersMax > 0) ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 font-medium">Aukahlutir</p>
              <div className="grid grid-cols-3 gap-3 justify-center justify-items-center">
                {extraControllersMax > 0 ? (
                  <div className="col-span-3 sm:col-span-1 flex flex-col items-center gap-2">
                    <div className="text-sm text-gray-700">Auka fjarðstýringar</div>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExtraControllers((v) => Math.max(0, v - 1))}
                        disabled={extraControllers <= 0}
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Minnka fjölda"
                        title="Minnka"
                      >
                        −
                      </button>
                      <div className="min-w-[2rem] text-center text-sm font-medium text-gray-900">{extraControllers}</div>
                      <button
                        type="button"
                        onClick={() => setExtraControllers((v) => Math.min(extraControllersMax, v + 1))}
                        disabled={extraControllers >= extraControllersMax}
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Auka fjölda"
                        title="Auka"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">{`Hámark ${extraControllersMax}`}</div>
                  </div>
                ) : null}
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
            </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  if (animatingInsurance) return;
                  if (insured) {
                    setInsured(false);
                    return;
                  }
                  setAnimatingInsurance(true);
                  window.setTimeout(() => {
                    setInsured(true);
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
                onClick={() => {
                  try {
                    if (typeof window !== 'undefined') {
                      const selection = {
                        productId: consoleId,
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
                    router.push(`/orderconsole/${consoleId}`);
                  } else {
                    router.push(`/auth?redirect=/orderconsole/${consoleId}`);
                  }
                }}
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
      {/* Insured label below the border */}
      {insured ? (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-2 mb-2 text-center">
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 ring-1 ring-green-500/30">
            Vara trygð
          </span>
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
                {(modalType === 'screen' ? screens : modalType === 'keyboard' ? keyboards : mouses).map((acc, idx) => {
                  const active = idx === modalActiveIndex;
                  const onClick = () => {
                    setModalActiveIndex(idx);
                    (async () => {
                      setModalLoading(true);
                      try {
                        const bucket = modalType === 'screen' ? 'screens' : modalType === 'keyboard' ? 'keyboards' : 'mouses';
                        const folder = String((acc as ScreenItem).id ?? (acc as KeyboardItem).id ?? (acc as MouseItem).id);
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
                    if (modalType === 'screen') setSelectedScreenId((acc as ScreenItem).id);
                    if (modalType === 'keyboard') setSelectedKeyboardId((acc as KeyboardItem).id);
                    if (modalType === 'mouse') setSelectedMouseId((acc as MouseItem).id);
                  };
                  const price = parsePrice((acc as ScreenItem).verd ?? (acc as KeyboardItem).verd ?? (acc as MouseItem).verd).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                  return (
                    <button key={String((acc as ScreenItem).id ?? (acc as KeyboardItem).id ?? (acc as MouseItem).id)} type="button" onClick={onClick}
                      className={`w-full text-left border rounded px-3 py-2 text-sm ${active ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40' : 'border-gray-200 hover:border-gray-300'} cursor-pointer`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 truncate">
                          {modalType === 'screen' ? `${(acc as ScreenItem).framleidandi} ${(acc as ScreenItem).skjastaerd}` :
                           modalType === 'keyboard' ? `${(acc as KeyboardItem).nafn}` :
                           `${(acc as MouseItem).nafn}`}
                        </div>
                        <div className="text-gray-600">{price ? `${price} kr` : ''}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {modalType === 'screen'
                          ? `${(acc as ScreenItem).upplausn} · ${(acc as ScreenItem).skjataekni} · ${(acc as ScreenItem).endurnyjunartidni}`
                          : modalType === 'keyboard'
                            ? `${(acc as KeyboardItem).framleidandi} · ${(acc as KeyboardItem).staerd} · ${(acc as KeyboardItem).tengimoguleiki}`
                            : `${(acc as MouseItem).framleidandi} · ${(acc as MouseItem).fjolditakk} takkar · ${(acc as MouseItem).tengimoguleiki}`}
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
                      <img
                        src={modalImages[Math.min(modalActiveIndex, modalImages.length - 1)]?.signedUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
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


