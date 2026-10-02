"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatKr } from "@/lib/products";

type OrderLite = {
  id: string;
  status: string;
  verd?: number | null;
  product_id?: string | null;
  orderNumber?: string | null;
  auth_uid?: string | null;
  timabilFra?: string | null;
  timabilTil?: string | null;
  created_at: string;
};

type Asset = {
  id: string;
  product_id: string | null;
  name: string;
  purchase_date: string | null;
  purchase_cost: number;
  notes: string | null;
  current_order_id?: string | null;
};

type RevenueRow = {
  id: string;
  asset_id: string;
  amount: number;
  created_at?: string;
};

const ACTIVE_STATUSES = new Set(["Bíður greiðslu", "Undirbúningur", "Í gangi", "Í vinnslu", "Uppsögn í gangi"]);
const DONE_STATUSES = new Set(["Lokið", "Hætt við"]);
const FAR_FUTURE = 8.64e15;

function toIsoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isMissingTable(code?: string | null, message?: string | null) {
  return code === "PGRST205" || /does not exist|schema cache/i.test(message || "");
}

function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDateIs(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("is-IS", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function leftLabel(days: number | null) {
  if (days === null) return "Óvíst hvenær laus";
  if (days < 0) return "Laus núna";
  if (days === 0) return "Laus í dag";
  if (days === 1) return "1 dagur eftir";
  return `${days} dagar eftir`;
}

function orderIsOut(order: OrderLite | null) {
  if (!order || DONE_STATUSES.has(order.status)) return false;
  const days = daysUntil(order.timabilTil);
  if (days !== null && days < 0) return false;
  return ACTIVE_STATUSES.has(order.status) || Boolean(order.timabilTil);
}

function availabilityTime(order: OrderLite | null) {
  if (!orderIsOut(order)) return 0;
  const t = order?.timabilTil ? new Date(order.timabilTil).getTime() : NaN;
  return Number.isFinite(t) ? t : FAR_FUTURE;
}

export default function OverviewTab({
  orders,
}: {
  orders: OrderLite[];
  preorderCount?: number;
}) {
  const now = new Date();
  const [view, setView] = useState<"products" | "picture">("products");

  const [assets, setAssets] = useState<Asset[]>([]);
  const [revenues, setRevenues] = useState<RevenueRow[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [needsIncomeMigration, setNeedsIncomeMigration] = useState(false);
  const [needsOrderMigration, setNeedsOrderMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(toIsoDate(now));
  const [saving, setSaving] = useState(false);

  const [incomeByAsset, setIncomeByAsset] = useState<Record<string, string>>({});
  const [orderPickByAsset, setOrderPickByAsset] = useState<Record<string, string>>({});
  const [savingIncome, setSavingIncome] = useState<string | null>(null);
  const [linkingAsset, setLinkingAsset] = useState<string | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<string | null>(null);

  const loadLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, r, p] = await Promise.all([
        supabase.from("company_assets").select("*").order("created_at", { ascending: false }),
        supabase.from("asset_revenue").select("*").order("created_at", { ascending: true }),
        supabase.from("products").select("id,name").eq("hidden", false).order("name"),
      ]);
      if (isMissingTable(a.error?.code, a.error?.message) || isMissingTable(r.error?.code, r.error?.message)) {
        setSchemaReady(false);
        setAssets([]);
        setRevenues([]);
        return;
      }
      if (a.error) throw a.error;
      if (r.error) throw r.error;
      setSchemaReady(true);
      setAssets((a.data as Asset[]) || []);
      setRevenues((r.data as RevenueRow[]) || []);
      setProducts((p.data as Array<{ id: string; name: string }>) || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gat ekki sótt yfirlit";
      if (isMissingTable(null, msg)) setSchemaReady(false);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLedger();
  }, []);

  useEffect(() => {
    const uids = Array.from(new Set(orders.map((o) => o.auth_uid).filter((v): v is string => Boolean(v))));
    if (uids.length === 0) {
      setOwnerNames({});
      return;
    }
    void supabase
      .from("users")
      .select("auth_uid, full_name")
      .in("auth_uid", uids)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const row of (data as Array<{ auth_uid: string; full_name: string | null }> | null) || []) {
          map[row.auth_uid] = row.full_name || "";
        }
        setOwnerNames(map);
      });
  }, [orders]);

  const incomesByAsset = useMemo(() => {
    const map: Record<string, RevenueRow[]> = {};
    for (const row of revenues) (map[row.asset_id] ||= []).push(row);
    return map;
  }, [revenues]);

  const earnedByAsset = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, rows] of Object.entries(incomesByAsset)) {
      map[id] = rows.reduce((s, r) => s + r.amount, 0);
    }
    return map;
  }, [incomesByAsset]);

  const orderById = useMemo(() => {
    const map: Record<string, OrderLite> = {};
    for (const o of orders) map[o.id] = o;
    return map;
  }, [orders]);

  const usedOrderIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      if (a.current_order_id) set.add(a.current_order_id);
    }
    return set;
  }, [assets]);

  const linkableOrders = useMemo(
    () => orders.filter((o) => orderIsOut(o) && !usedOrderIds.has(o.id)),
    [orders, usedOrderIds]
  );

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      const oa = a.current_order_id ? orderById[a.current_order_id] || null : null;
      const ob = b.current_order_id ? orderById[b.current_order_id] || null : null;
      const ta = availabilityTime(oa);
      const tb = availabilityTime(ob);
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name, "is");
    });
  }, [assets, orderById]);

  const totalCost = assets.reduce((s, a) => s + a.purchase_cost, 0);
  const totalBack = assets.reduce((s, a) => s + (earnedByAsset[a.id] || 0), 0);
  const totalDiff = totalBack - totalCost;

  const renterName = (order: OrderLite | null) => {
    if (!order) return "";
    if (order.auth_uid && ownerNames[order.auth_uid]) return ownerNames[order.auth_uid];
    return order.orderNumber || "Óþekktur leigjandi";
  };

  const addProduct = async () => {
    const purchaseCost = parseInt(cost.replace(/\D+/g, ""), 10) || 0;
    const productName = name.trim() || products.find((p) => p.id === productId)?.name || "";
    if (!productName || purchaseCost <= 0) {
      setError("Veldu vöru og settu inn hvað hún kostaði.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("company_assets").insert({
      name: productName,
      product_id: productId || null,
      purchase_cost: purchaseCost,
      purchase_date: date || null,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    setProductId("");
    setCost("");
    await loadLedger();
  };

  const addIncome = async (assetId: string) => {
    const amount = parseInt((incomeByAsset[assetId] || "").replace(/\D+/g, ""), 10) || 0;
    if (amount <= 0) {
      setError("Settu inn upphæðina sem varan skilaði.");
      return;
    }
    setSavingIncome(assetId);
    setError(null);
    const { error: err } = await supabase.from("asset_revenue").insert({ asset_id: assetId, amount });
    setSavingIncome(null);
    if (err) {
      if (/null value.*(year|month)|asset_id_year_month|check constraint/i.test(err.message)) {
        setNeedsIncomeMigration(true);
        setError("Keyrðu sql/2026-10-02-asset-income-entries.sql í Supabase til að skrá hverja innkomu sér.");
      } else setError(err.message);
      return;
    }
    setIncomeByAsset((prev) => ({ ...prev, [assetId]: "" }));
    await loadLedger();
  };

  const linkOrder = async (assetId: string) => {
    const orderId = orderPickByAsset[assetId] || "";
    if (!orderId) {
      setError("Veldu pöntun til að tengja.");
      return;
    }
    setLinkingAsset(assetId);
    setError(null);
    const { error: err } = await supabase.from("company_assets").update({ current_order_id: orderId }).eq("id", assetId);
    setLinkingAsset(null);
    if (err) {
      if (/current_order_id|Could not find/i.test(err.message)) {
        setNeedsOrderMigration(true);
        setError("Keyrðu sql/2026-10-02-asset-current-order.sql í Supabase til að tengja pantanir við vörur.");
      } else if (/duplicate|unique/i.test(err.message)) {
        setError("Þessi pöntun er þegar tengd annarri vöru.");
      } else setError(err.message);
      return;
    }
    setOrderPickByAsset((prev) => ({ ...prev, [assetId]: "" }));
    await loadLedger();
  };

  const unlinkOrder = async (assetId: string) => {
    setLinkingAsset(assetId);
    setError(null);
    const { error: err } = await supabase.from("company_assets").update({ current_order_id: null }).eq("id", assetId);
    setLinkingAsset(null);
    if (err) {
      setError(err.message);
      return;
    }
    await loadLedger();
  };

  const removeIncome = async (id: string) => {
    setDeletingIncome(id);
    setError(null);
    const { error: err } = await supabase.from("asset_revenue").delete().eq("id", id);
    setDeletingIncome(null);
    if (err) {
      setError(err.message);
      return;
    }
    await loadLedger();
  };

  const removeAsset = async (id: string) => {
    if (!window.confirm("Eyða þessari vöru úr yfirlitinu?")) return;
    await supabase.from("company_assets").delete().eq("id", id);
    await loadLedger();
  };

  if (!schemaReady) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-lg font-semibold">Yfirlit er ekki tilbúið</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Keyrðu <code className="rounded bg-white px-1.5 py-0.5 text-xs">sql/2026-09-28-admin-overview.sql</code> og{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">sql/2026-10-02-asset-income-entries.sql</code> í
          Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Yfirlit</h2>
          <p className="mt-1 text-sm text-gray-500">
            {view === "products"
              ? "Næsta lausa vara efst. Tengdu pöntun til að sjá nafn og hvað er eftir."
              : "Ein súla per vöru. Grátt er kaupverð, grænt er hvað hún hefur skilað."}
          </p>
        </div>
        <div className="inline-flex rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setView("products")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              view === "products" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Hver vara
          </button>
          <button
            type="button"
            onClick={() => setView("picture")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              view === "picture" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Súlur
          </button>
        </div>
      </div>

      {needsIncomeMigration ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Keyrðu <code className="rounded bg-white px-1.5 py-0.5 text-xs">sql/2026-10-02-asset-income-entries.sql</code> í
          Supabase.
        </p>
      ) : null}
      {needsOrderMigration ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Keyrðu <code className="rounded bg-white px-1.5 py-0.5 text-xs">sql/2026-10-02-asset-current-order.sql</code> í
          Supabase til að tengja pöntun við vöru.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {view === "picture" ? (
        <PillarView
          rows={sortedAssets.map((asset) => {
            const order = asset.current_order_id ? orderById[asset.current_order_id] || null : null;
            const out = orderIsOut(order);
            return {
              id: asset.id,
              name: asset.name,
              renter: out ? renterName(order) : "Laus",
              cost: asset.purchase_cost,
              earned: earnedByAsset[asset.id] || 0,
            };
          })}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Keypt fyrir" value={`${formatKr(totalCost)} kr`} tone="neutral" />
            <SummaryCard label="Fengið til baka" value={`${formatKr(totalBack)} kr`} tone="good" />
            <SummaryCard
              label={totalDiff >= 0 ? "Hagnaður" : "Eftir að ná inn"}
              value={`${formatKr(Math.abs(totalDiff))} kr`}
              tone={totalDiff >= 0 ? "good" : "warn"}
            />
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Skrá nýja vöru</h3>
            <p className="mt-1 text-sm text-gray-500">Hvað kostaði tækið ykkur að kaupa?</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  const match = products.find((p) => p.id === e.target.value);
                  if (match && !name.trim()) setName(match.name);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              >
                <option value="">Veldu vöru</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nafn (ef annað)" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Kaupverð kr" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void addProduct()}
              className="mt-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Vista…" : "Skrá vöru"}
            </button>
          </section>

          {loading && assets.length === 0 ? <p className="text-sm text-gray-500">Hleður…</p> : null}

          {sortedAssets.length > 0 ? (
            <ol className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {sortedAssets.map((asset, i) => {
                const order = asset.current_order_id ? orderById[asset.current_order_id] || null : null;
                const out = orderIsOut(order);
                const days = out ? daysUntil(order?.timabilTil) : null;
                return (
                  <li key={asset.id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                    <span className="w-7 text-sm font-bold text-gray-400">{i + 1}.</span>
                    <span className="min-w-[8rem] flex-1 font-semibold text-gray-900">{asset.name}</span>
                    {out ? (
                      <>
                        <span className="text-sm text-gray-700">{renterName(order)}</span>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold ${days !== null && days <= 3 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-800"}`}>
                          {leftLabel(days)}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">Laus</span>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : null}

          {assets.length === 0 && !loading ? (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-500">
              Engar vörur skráðar enn. Byrjaðu á að skrá tæki og kaupverð.
            </p>
          ) : (
            <div className="grid gap-4">
              {sortedAssets.map((asset, i) => {
                const earned = earnedByAsset[asset.id] || 0;
                const leftMoney = asset.purchase_cost - earned;
                const paidBack = leftMoney <= 0;
                const progress = asset.purchase_cost > 0 ? Math.min(100, Math.round((earned / asset.purchase_cost) * 100)) : 0;
                const history = incomesByAsset[asset.id] || [];
                const nextNumber = history.length + 1;
                const order = asset.current_order_id ? orderById[asset.current_order_id] || null : null;
                const out = orderIsOut(order);
                const days = out ? daysUntil(order?.timabilTil) : null;
                const matching = linkableOrders.filter((o) => asset.product_id && o.product_id === asset.product_id);
                const others = linkableOrders.filter((o) => !asset.product_id || o.product_id !== asset.product_id);

                return (
                  <article key={asset.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className={`px-5 py-4 ${out ? "bg-[var(--color-secondary)] text-white" : "bg-emerald-600 text-white"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                            {i + 1}. {out ? "Í útleigu" : "Næst laus"}
                          </div>
                          <h3 className="mt-1 text-2xl font-black leading-tight">{asset.name}</h3>
                        </div>
                        <button type="button" onClick={() => void removeAsset(asset.id)} className="text-xs text-white/60 hover:text-white">
                          Eyða
                        </button>
                      </div>
                      {out ? (
                        <div className="mt-3">
                          <div className="text-xl font-bold">{renterName(order)}</div>
                          <div className="mt-1 text-3xl font-black">{leftLabel(days)}</div>
                          {order?.timabilTil ? <div className="mt-1 text-sm text-white/75">til {formatDateIs(order.timabilTil)}</div> : null}
                          {order?.orderNumber ? <div className="text-sm text-white/75">pöntun {order.orderNumber}</div> : null}
                        </div>
                      ) : (
                        <div className="mt-3 text-3xl font-black">Laus núna</div>
                      )}
                    </div>

                    <div className="p-5">
                      {!out ? (
                        linkableOrders.length > 0 ? (
                          <div className="mb-5 flex flex-wrap items-end gap-2">
                            <label className="min-w-[14rem] flex-1 text-sm">
                              <span className="mb-1 block text-xs text-gray-500">Tengja pöntun við þessa vöru</span>
                              <select
                                value={orderPickByAsset[asset.id] || ""}
                                onChange={(e) => setOrderPickByAsset((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                              >
                                <option value="">Veldu pöntun</option>
                                {matching.length > 0 ? (
                                  <optgroup label="Þessi vara">
                                    {matching.map((o) => (
                                      <option key={o.id} value={o.id}>
                                        {renterName(o)} · {o.orderNumber || o.id.slice(0, 8)} · {leftLabel(daysUntil(o.timabilTil))}
                                      </option>
                                    ))}
                                  </optgroup>
                                ) : null}
                                {others.length > 0 ? (
                                  <optgroup label={matching.length > 0 ? "Aðrar pantanir" : "Pantanir"}>
                                    {others.map((o) => (
                                      <option key={o.id} value={o.id}>
                                        {renterName(o)} · {o.orderNumber || o.id.slice(0, 8)} · {leftLabel(daysUntil(o.timabilTil))}
                                      </option>
                                    ))}
                                  </optgroup>
                                ) : null}
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={linkingAsset === asset.id}
                              onClick={() => void linkOrder(asset.id)}
                              className="rounded-xl bg-[var(--color-secondary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {linkingAsset === asset.id ? "Vista…" : "Tengja"}
                            </button>
                          </div>
                        ) : (
                          <p className="mb-5 text-sm text-gray-500">Engin virk pöntun til að tengja.</p>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled={linkingAsset === asset.id}
                          onClick={() => void unlinkOrder(asset.id)}
                          className="mb-5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Losa vöru
                        </button>
                      )}

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-gray-500">Kostaði okkur</div>
                          <div className="text-xl font-bold text-gray-900">{formatKr(asset.purchase_cost)} kr</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Skilaði til baka</div>
                          <div className="text-xl font-bold text-[var(--color-secondary)]">{formatKr(earned)} kr</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">{paidBack ? "Komið með hagnað" : "Eftir að ná inn"}</div>
                          <div className={`text-xl font-bold ${paidBack ? "text-emerald-700" : "text-amber-700"}`}>
                            {formatKr(Math.abs(leftMoney))} kr
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1 flex justify-between text-xs text-gray-500">
                          <span>{paidBack ? "Greidd upp" : `${progress}% til baka`}</span>
                          <span>
                            {formatKr(earned)} / {formatKr(asset.purchase_cost)}
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${paidBack ? "bg-emerald-500" : "bg-[var(--color-secondary)]"}`}
                            style={{ width: `${Math.max(progress, earned > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 text-sm font-medium text-gray-900">Innkoma</div>
                        {history.length === 0 ? (
                          <p className="mb-3 text-sm text-gray-500">Engin innkoma skráð enn.</p>
                        ) : (
                          <ul className="mb-3 divide-y divide-gray-100 rounded-xl border border-gray-100">
                            {history.map((row, index) => (
                              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                <span className="text-gray-600">Innkoma {index + 1}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-gray-900">{formatKr(row.amount)} kr</span>
                                  <button
                                    type="button"
                                    disabled={deletingIncome === row.id}
                                    onClick={() => void removeIncome(row.id)}
                                    className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                                  >
                                    Eyða
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="min-w-[10rem] flex-1 text-sm">
                            <span className="mb-1 block text-xs text-gray-500">Bæta við innkomu {nextNumber}</span>
                            <input
                              value={incomeByAsset[asset.id] || ""}
                              onChange={(e) => setIncomeByAsset((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                              placeholder="Upphæð kr"
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={savingIncome === asset.id}
                            onClick={() => void addIncome(asset.id)}
                            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {savingIncome === asset.id ? "Vista…" : `Skrá innkomu ${nextNumber}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PillarView({
  rows,
}: {
  rows: Array<{ id: string; name: string; renter: string; cost: number; earned: number }>;
}) {
  const peak = Math.max(1, ...rows.flatMap((r) => [r.cost, r.earned]));

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-500">
        Engar vörur skráðar enn. Skráðu þær fyrst undir „Hver vara“.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-gray-600">
          <span className="h-3 w-3 rounded-sm bg-gray-300" />
          Kostaði
        </span>
        <span className="inline-flex items-center gap-2 text-gray-600">
          <span className="h-3 w-3 rounded-sm bg-[var(--color-secondary)]" />
          Skilaði
        </span>
      </div>
      <div className="flex items-end gap-8 overflow-x-auto pb-2">
        {rows.map((row) => {
          const costH = Math.max(8, Math.round((row.cost / peak) * 260));
          const earnH = row.earned > 0 ? Math.max(8, Math.round((row.earned / peak) * 260)) : 0;
          const ahead = row.earned >= row.cost && row.cost > 0;
          return (
            <div key={row.id} className="flex w-32 shrink-0 flex-col items-center">
              <div className="flex h-[280px] items-end justify-center gap-2">
                <div className="flex flex-col items-center">
                  <div className="mb-1 text-[11px] font-semibold text-gray-500">{formatKr(row.cost)}</div>
                  <div className="w-11 rounded-t-md bg-gray-300" style={{ height: costH }} title={`Kostaði ${formatKr(row.cost)} kr`} />
                </div>
                <div className="flex flex-col items-center">
                  {row.earned > 0 ? (
                    <div className={`mb-1 text-[11px] font-semibold ${ahead ? "text-emerald-700" : "text-[var(--color-secondary)]"}`}>
                      {formatKr(row.earned)}
                    </div>
                  ) : (
                    <div className="mb-1 text-[11px] text-gray-400">0</div>
                  )}
                  <div
                    className={`w-11 rounded-t-md ${ahead ? "bg-emerald-500" : "bg-[var(--color-secondary)]"}`}
                    style={{ height: Math.max(earnH, 4) }}
                    title={`Skilaði ${formatKr(row.earned)} kr`}
                  />
                </div>
              </div>
              <div className="mt-3 w-full border-t border-gray-200 pt-3 text-center">
                <div className="text-sm font-bold leading-tight text-gray-900">{row.name}</div>
                <div className="mt-1 text-xs text-gray-500">{row.renter}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : "border-gray-200 bg-white";
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
