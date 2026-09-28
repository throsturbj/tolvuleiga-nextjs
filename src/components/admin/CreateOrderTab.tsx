"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  formatKr,
  formatStorage,
  parsePrice,
  productSubtitle,
  specText,
  variantStorageGb,
  type Aukahlutur,
  type Product,
  type ProductVariant,
} from "@/lib/products";

type Customer = {
  auth_uid: string;
  full_name: string;
  kennitala: string;
  phone: string;
  email: string;
};

const MONTH_OPTIONS = [1, 3, 6, 12] as const;
const STATUSES = ["Bíður greiðslu", "Undirbúningur", "Í gangi"] as const;
const TYPE_LABEL: Record<string, string> = {
  gaming_pc: "Borðtölva",
  laptop: "Fartölva / spjald",
  console: "Leikjatölva",
  screen: "Skjár",
};

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CreateOrderTab({ onCreated }: { onCreated?: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<Customer | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [compatScreens, setCompatScreens] = useState<Product[]>([]);
  const [keyboards, setKeyboards] = useState<Aukahlutur[]>([]);
  const [mouses, setMouses] = useState<Aukahlutur[]>([]);
  const [skjar, setSkjar] = useState(false);
  const [screenId, setScreenId] = useState<string | null>(null);
  const [lyklabord, setLyklabord] = useState(false);
  const [keyboardId, setKeyboardId] = useState<string | null>(null);
  const [mus, setMus] = useState(false);
  const [mouseId, setMouseId] = useState<string | null>(null);
  const [trygging, setTrygging] = useState(false);
  const [extraControllers, setExtraControllers] = useState(0);
  const [months, setMonths] = useState<number>(3);
  const [fromDate, setFromDate] = useState(toDateInput(new Date()));
  const [toDate, setToDate] = useState(toDateInput(addMonths(new Date(), 3)));
  const [status, setStatus] = useState<string>("Undirbúningur");
  const [priceOverride, setPriceOverride] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loadingLists, setLoadingLists] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoadingLists(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const [custRes, prodRes] = await Promise.all([
          fetch("/api/admin/customers", { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          supabase.from("products").select("*").eq("hidden", false).order("name"),
        ]);
        if (!alive) return;
        if (custRes.ok) {
          const j = (await custRes.json()) as { customers?: Customer[] };
          setCustomers(j.customers || []);
        }
        setProducts((prodRes.data as Product[]) || []);
      } finally {
        if (alive) setLoadingLists(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const from = new Date(fromDate);
    if (Number.isNaN(from.getTime())) return;
    setToDate(toDateInput(addMonths(from, months)));
  }, [months, fromDate]);

  useEffect(() => {
    let alive = true;
    const loadExtras = async () => {
      if (!product) {
        setVariants([]);
        setCompatScreens([]);
        setKeyboards([]);
        setMouses([]);
        setVariantId(null);
        setScreenId(null);
        setKeyboardId(null);
        setMouseId(null);
        setSkjar(false);
        setLyklabord(false);
        setMus(false);
        setTrygging(false);
        setExtraControllers(0);
        setPriceOverride("");
        return;
      }
      const [{ data: vRows }, { data: compat }, { data: links }] = await Promise.all([
        supabase.from("product_variants").select("*").eq("product_id", product.id).order("price"),
        supabase.from("product_compat").select("compatible_product_id").eq("product_id", product.id),
        supabase.from("product_aukahlutir").select("aukahlutur_id").eq("product_id", product.id),
      ]);
      if (!alive) return;
      const vars = (vRows as ProductVariant[]) || [];
      setVariants(vars);
      setVariantId(vars[0]?.id ?? null);

      const screenIds = ((compat || []) as { compatible_product_id: string }[]).map((r) => r.compatible_product_id);
      if (screenIds.length > 0) {
        const { data: screens } = await supabase.from("products").select("*").in("id", screenIds);
        const list = (screens as Product[]) || [];
        setCompatScreens(list);
        setScreenId(list[0]?.id ?? null);
      } else {
        setCompatScreens([]);
        setScreenId(null);
      }

      const aukIds = ((links || []) as { aukahlutur_id: string }[]).map((r) => r.aukahlutur_id);
      if (aukIds.length > 0) {
        const { data: auk } = await supabase.from("aukahlutir").select("*").in("id", aukIds);
        const list = (auk as Aukahlutur[]) || [];
        const kbs = list.filter((a) => a.type === "keyboard");
        const ms = list.filter((a) => a.type === "mouse");
        setKeyboards(kbs);
        setMouses(ms);
        setKeyboardId(kbs[0]?.id ?? null);
        setMouseId(ms[0]?.id ?? null);
      } else {
        setKeyboards([]);
        setMouses([]);
        setKeyboardId(null);
        setMouseId(null);
      }
    };
    loadExtras();
    return () => {
      alive = false;
    };
  }, [product?.id]);

  const selectedVariant = variants.find((v) => v.id === variantId) || null;
  const selectedScreen = compatScreens.find((s) => s.id === screenId) || null;
  const monthlyBase = product?.type === "laptop" ? parsePrice(selectedVariant?.price) : parsePrice(product?.price);
  const insuranceAmount = product?.type === "laptop" ? parsePrice(selectedVariant?.trygging) : parsePrice(product?.trygging);
  const screenPrice = skjar && selectedScreen ? parsePrice(selectedScreen.price) : 0;
  const keyboardPrice = lyklabord && keyboardId ? parsePrice(keyboards.find((k) => k.id === keyboardId)?.price) : 0;
  const mousePrice = mus && mouseId ? parsePrice(mouses.find((m) => m.id === mouseId)?.price) : 0;
  const extraCtrlPrice =
    product?.type === "console" ? extraControllers * parsePrice(specText(product.specs, "verdextracontrollers")) : 0;
  const maxExtra = product?.type === "console" ? parseInt(specText(product.specs, "numberofextracontrollers") || "0", 10) || 0 : 0;
  const computed = Math.ceil((monthlyBase + screenPrice + keyboardPrice + mousePrice + extraCtrlPrice + (trygging ? insuranceAmount : 0)) / 10) * 10;
  const overrideNum = parseInt(priceOverride.replace(/\D+/g, ""), 10);
  const finalPrice = Number.isFinite(overrideNum) && overrideNum > 0 ? overrideNum : computed;

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => [c.full_name, c.email, c.kennitala, c.phone].join(" ").toLowerCase().includes(q))
      .slice(0, 12);
  }, [customers, customerQuery]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!q) return true;
      return `${p.name} ${productSubtitle(p)}`.toLowerCase().includes(q);
    });
  }, [products, productQuery, typeFilter]);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!selectedUser) {
      setError("Veldu viðskiptavin.");
      return;
    }
    if (!product) {
      setError("Veldu vöru.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          authUid: selectedUser.auth_uid,
          productId: product.id,
          variantId,
          screenProductId: skjar ? screenId : null,
          months,
          skjar,
          lyklabord,
          mus,
          trygging,
          extraControllers,
          verd: finalPrice,
          status,
          message,
          timabilFra: new Date(`${fromDate}T12:00:00`).toISOString(),
          timabilTil: new Date(`${toDate}T12:00:00`).toISOString(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error || "Mistókst að stofna pöntun");
        return;
      }
      setSuccess(`Pöntun stofnuð. Staðfestingarpóstur var sendur á ${selectedUser.email} og á Tölvuleigu.`);
      setProduct(null);
      setMessage("");
      setPriceOverride("");
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Villa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">1. Viðskiptavinur</p>
              <h2 className="text-lg font-semibold text-gray-900">Hver á að fá pöntunina?</h2>
            </div>
            {selectedUser ? (
              <button type="button" className="text-xs text-gray-500 underline" onClick={() => setSelectedUser(null)}>
                Skipta
              </button>
            ) : null}
          </div>
          {selectedUser ? (
            <div className="rounded-xl border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/5 px-4 py-3">
              <div className="font-semibold text-gray-900">{selectedUser.full_name || "Ónefndur"}</div>
              <div className="mt-1 text-sm text-gray-600">{selectedUser.email}</div>
              <div className="mt-1 text-xs text-gray-500">
                {selectedUser.kennitala || "Kennitala vantar"} · {selectedUser.phone || "Sími vantar"}
              </div>
            </div>
          ) : (
            <>
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Leita eftir nafni, netfangi eða kennitölu"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <div className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
                {loadingLists ? (
                  <div className="px-4 py-6 text-sm text-gray-500">Sæki viðskiptavini…</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500">Enginn fannst.</div>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.auth_uid}
                      type="button"
                      onClick={() => setSelectedUser(c)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <span>
                        <span className="block text-sm font-medium text-gray-900">{c.full_name || "Ónefndur"}</span>
                        <span className="block text-xs text-gray-500">{c.email || "Ekkert netfang"}</span>
                      </span>
                      <span className="text-xs text-gray-400">{c.kennitala}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">2. Vara</p>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Hvað á að leigja?</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ["all", "Allt"],
              ["gaming_pc", "Borðtölvur"],
              ["laptop", "Fartölvur"],
              ["console", "Leikjatölvur"],
              ["screen", "Skjáir"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTypeFilter(id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  typeFilter === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Leita í vörum"
            className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <div className="grid max-h-[22rem] gap-2 overflow-auto sm:grid-cols-2">
            {filteredProducts.map((p) => {
              const active = product?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProduct(p)}
                  className={`rounded-xl border px-3 py-3 text-left ${
                    active ? "border-[var(--color-accent)] bg-orange-50" : "border-gray-150 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{TYPE_LABEL[p.type] || p.type}</div>
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-gray-500">{productSubtitle(p) || `${formatKr(parsePrice(p.price))} kr/mán`}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 self-start">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">3. Útfærsla</p>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Tímabil, aukahlutir og verð</h2>
          {!product ? (
            <p className="text-sm text-gray-500">Veldu vöru til að stilla pöntunina.</p>
          ) : (
            <div className="space-y-4">
              {variants.length > 0 ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-500">Geymsla</span>
                  <select
                    value={variantId || ""}
                    onChange={(e) => setVariantId(e.target.value || null)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    {variants.map((v) => {
                      const gb = variantStorageGb(v);
                      return (
                        <option key={v.id} value={v.id}>
                          {gb ? formatStorage(gb) : "Útgáfa"} · {formatKr(parsePrice(v.price))} kr
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : null}

              <div>
                <div className="mb-1 text-xs font-medium text-gray-500">Tímabil</div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {MONTH_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        months === m ? "bg-[var(--color-secondary)] text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {m} mán.
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>

              {compatScreens.length > 0 ? (
                <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                  <span className="text-sm">
                    Skjár
                    {selectedScreen ? <span className="block text-xs text-gray-500">{selectedScreen.name} · +{formatKr(parsePrice(selectedScreen.price))}</span> : null}
                  </span>
                  <input type="checkbox" checked={skjar} onChange={(e) => setSkjar(e.target.checked)} />
                </label>
              ) : null}
              {keyboards.length > 0 ? (
                <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                  <span className="text-sm">
                    Lyklaborð
                    <span className="block text-xs text-gray-500">+{formatKr(keyboardId ? parsePrice(keyboards.find((k) => k.id === keyboardId)?.price) : 0)}</span>
                  </span>
                  <input type="checkbox" checked={lyklabord} onChange={(e) => setLyklabord(e.target.checked)} />
                </label>
              ) : null}
              {mouses.length > 0 ? (
                <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                  <span className="text-sm">
                    Mús
                    <span className="block text-xs text-gray-500">+{formatKr(mouseId ? parsePrice(mouses.find((m) => m.id === mouseId)?.price) : 0)}</span>
                  </span>
                  <input type="checkbox" checked={mus} onChange={(e) => setMus(e.target.checked)} />
                </label>
              ) : null}
              {insuranceAmount > 0 ? (
                <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                  <span className="text-sm">
                    Trygging
                    <span className="block text-xs text-gray-500">+{formatKr(insuranceAmount)} kr/mán</span>
                  </span>
                  <input type="checkbox" checked={trygging} onChange={(e) => setTrygging(e.target.checked)} />
                </label>
              ) : null}
              {maxExtra > 0 ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-500">Auka stýringar</span>
                  <input
                    type="number"
                    min={0}
                    max={maxExtra}
                    value={extraControllers}
                    onChange={(e) => setExtraControllers(Math.max(0, Math.min(maxExtra, parseInt(e.target.value, 10) || 0)))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              ) : null}

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Staða</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Mánaðarverð (autt = reiknað {formatKr(computed)} kr)</span>
                <input
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  placeholder={`${formatKr(computed)} kr`}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-500">Skilaboð í pósti (valfrjálst)</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="T.d. afhending, sérkjör eða athugasemd"
                />
              </label>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-[var(--color-secondary)] p-5 text-white shadow-sm">
          <div className="text-xs uppercase tracking-wide text-white/70">Samantekt</div>
          <div className="mt-2 text-sm text-white/80">{selectedUser?.full_name || "Enginn viðskiptavinur"}</div>
          <div className="text-sm text-white/80">{product?.name || "Engin vara"}</div>
          <div className="mt-4 text-3xl font-bold">{formatKr(finalPrice)} kr<span className="text-base font-medium text-white/70">/mán</span></div>
          <button
            type="button"
            disabled={submitting || !selectedUser || !product}
            onClick={() => void submit()}
            className="mt-5 w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Stofna og senda…" : "Stofna pöntun og senda póst"}
          </button>
          <p className="mt-3 text-xs text-white/60">Sendir staðfestingu á viðskiptavin og afrit á tolvuleiga@tolvuleiga.is, með PDF.</p>
          {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-emerald-200">{success}</p> : null}
        </section>
      </aside>
    </div>
  );
}
