"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatKr, parsePrice } from "@/lib/products";

type OrderLite = {
  id: string;
  status: string;
  verd?: number | null;
  product_id?: string | null;
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
};

type RevenueRow = {
  id: string;
  asset_id: string;
  year: number;
  month: number;
  amount: number;
};

type ExpenseRow = {
  id: string;
  category: string;
  year: number;
  month: number;
  amount: number;
  note: string | null;
};

const MONTHS_IS = ["Jan", "Feb", "Mar", "Apr", "Maí", "Jún", "Júl", "Ágú", "Sep", "Okt", "Nóv", "Des"];
const EXPENSE_CATS = ["Húsnæði", "Birgðir", "Markaðssetning", "Laun", "Hugbúnaður", "Annað"];
const ACTIVE_STATUSES = new Set(["Bíður greiðslu", "Undirbúningur", "Í gangi", "Í vinnslu"]);

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function last12Months() {
  const now = new Date();
  const out: { year: number; month: number; label: string; key: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTHS_IS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      key: monthKey(d.getFullYear(), d.getMonth() + 1),
    });
  }
  return out;
}

function orderActiveInMonth(o: OrderLite, year: number, month: number) {
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 0, 23, 59, 59).getTime();
  const from = o.timabilFra ? new Date(o.timabilFra).getTime() : new Date(o.created_at).getTime();
  const to = o.timabilTil ? new Date(o.timabilTil).getTime() : end;
  return from <= end && to >= start;
}

function AreaBarChart({
  labels,
  series,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
}) {
  const w = 640;
  const h = 220;
  const pad = { l: 44, r: 12, t: 16, b: 28 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const pathFor = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const areaFor = (values: number[]) =>
    `${pathFor(values)} L ${x(values.length - 1).toFixed(1)} ${pad.t + innerH} L ${x(0).toFixed(1)} ${pad.t + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full">
      {[0, 0.5, 1].map((t) => {
        const yy = pad.t + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} stroke="#e5e7eb" strokeWidth="1" />
            <text x={8} y={yy + 4} className="fill-gray-400" fontSize="10">
              {formatKr(Math.round(max * t))}
            </text>
          </g>
        );
      })}
      {series.map((s) => (
        <g key={s.name}>
          <path d={areaFor(s.values)} fill={s.color} opacity="0.12" />
          <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
          {s.values.map((v, i) => (
            <circle key={`${s.name}-${i}`} cx={x(i)} cy={y(v)} r="3" fill={s.color} />
          ))}
        </g>
      ))}
      {labels.map((label, i) => (
        <text key={label} x={x(i)} y={h - 8} textAnchor="middle" className="fill-gray-400" fontSize="9">
          {label}
        </text>
      ))}
    </svg>
  );
}

export default function OverviewTab({
  orders,
  preorderCount,
}: {
  orders: OrderLite[];
  preorderCount: number;
}) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const months = last12Months();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [revenues, setRevenues] = useState<RevenueRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assetName, setAssetName] = useState("");
  const [assetProductId, setAssetProductId] = useState("");
  const [assetCost, setAssetCost] = useState("");
  const [assetDate, setAssetDate] = useState(toIsoDate(now));
  const [assetNotes, setAssetNotes] = useState("");
  const [savingAsset, setSavingAsset] = useState(false);

  const [revAssetId, setRevAssetId] = useState("");
  const [revAmount, setRevAmount] = useState("");
  const [revMonth, setRevMonth] = useState(monthKey(thisYear, thisMonth));
  const [savingRev, setSavingRev] = useState(false);

  const [expCat, setExpCat] = useState("Annað");
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");
  const [savingExp, setSavingExp] = useState(false);

  const loadLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, r, e, p] = await Promise.all([
        supabase.from("company_assets").select("*").order("created_at", { ascending: false }),
        supabase.from("asset_revenue").select("*"),
        supabase.from("company_expenses").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id,name,type,price").eq("hidden", false).order("name"),
      ]);
      const missing =
        a.error?.message?.includes("does not exist") ||
        r.error?.message?.includes("does not exist") ||
        e.error?.message?.includes("schema cache") ||
        e.error?.code === "PGRST205" ||
        a.error?.code === "PGRST205";
      if (missing) {
        setSchemaReady(false);
        setAssets([]);
        setRevenues([]);
        setExpenses([]);
        return;
      }
      if (a.error) throw a.error;
      if (r.error) throw r.error;
      if (e.error) throw e.error;
      setSchemaReady(true);
      setAssets((a.data as Asset[]) || []);
      setRevenues((r.data as RevenueRow[]) || []);
      setExpenses((e.data as ExpenseRow[]) || []);
      setProducts((p.data as Array<{ id: string; name: string }>) || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gat ekki sótt yfirlit";
      if (/does not exist|PGRST205|schema cache/i.test(msg)) setSchemaReady(false);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLedger();
  }, []);

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const mrr = activeOrders.reduce((sum, o) => sum + parsePrice(o.verd), 0);
  const expiringSoon = orders.filter((o) => {
    if (!o.timabilTil || !ACTIVE_STATUSES.has(o.status)) return false;
    const days = Math.ceil((new Date(o.timabilTil).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 14;
  }).length;

  const computedByMonth = months.map((m) =>
    orders.reduce((sum, o) => (orderActiveInMonth(o, m.year, m.month) ? sum + parsePrice(o.verd) : sum), 0)
  );
  const bookedByMonth = months.map((m) =>
    revenues.filter((r) => r.year === m.year && r.month === m.month).reduce((sum, r) => sum + r.amount, 0)
  );
  const expenseByMonth = months.map((m) =>
    expenses.filter((r) => r.year === m.year && r.month === m.month).reduce((sum, r) => sum + r.amount, 0)
  );

  const fleetCost = assets.reduce((s, a) => s + a.purchase_cost, 0);
  const bookedTotal = revenues.reduce((s, r) => s + r.amount, 0);
  const bookedThisMonth = revenues
    .filter((r) => r.year === thisYear && r.month === thisMonth)
    .reduce((s, r) => s + r.amount, 0);
  const expensesThisMonth = expenses
    .filter((r) => r.year === thisYear && r.month === thisMonth)
    .reduce((s, r) => s + r.amount, 0);
  const profitThisMonth = bookedThisMonth - expensesThisMonth;
  const paybackMonths = mrr > 0 ? Math.ceil(fleetCost / mrr) : null;

  const productIncome = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of activeOrders) {
      const id = o.product_id || "unknown";
      map[id] = (map[id] || 0) + parsePrice(o.verd);
    }
    return Object.entries(map)
      .map(([id, amount]) => ({
        id,
        name: products.find((p) => p.id === id)?.name || (id === "unknown" ? "Óþekkt vara" : "Vara"),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [activeOrders, products]);

  const suggestedForAsset = (asset: Asset) => {
    if (!asset.product_id) return 0;
    return activeOrders.filter((o) => o.product_id === asset.product_id).reduce((s, o) => s + parsePrice(o.verd), 0);
  };

  const addAsset = async () => {
    const cost = parseInt(assetCost.replace(/\D+/g, ""), 10) || 0;
    const name = assetName.trim() || products.find((p) => p.id === assetProductId)?.name || "";
    if (!name || cost <= 0) {
      setError("Settu nafn og kaupverð.");
      return;
    }
    setSavingAsset(true);
    setError(null);
    const { error: err } = await supabase.from("company_assets").insert({
      name,
      product_id: assetProductId || null,
      purchase_cost: cost,
      purchase_date: assetDate || null,
      notes: assetNotes.trim() || null,
    });
    setSavingAsset(false);
    if (err) {
      setError(err.message);
      return;
    }
    setAssetName("");
    setAssetProductId("");
    setAssetCost("");
    setAssetNotes("");
    await loadLedger();
  };

  const addRevenue = async () => {
    const amount = parseInt(revAmount.replace(/\D+/g, ""), 10) || 0;
    const [y, m] = revMonth.split("-").map((n) => parseInt(n, 10));
    if (!revAssetId || amount <= 0) {
      setError("Veldu eign og upphæð tekna.");
      return;
    }
    setSavingRev(true);
    setError(null);
    const { error: err } = await supabase.from("asset_revenue").upsert(
      { asset_id: revAssetId, year: y, month: m, amount },
      { onConflict: "asset_id,year,month" }
    );
    setSavingRev(false);
    if (err) {
      setError(err.message);
      return;
    }
    setRevAmount("");
    await loadLedger();
  };

  const addExpense = async () => {
    const amount = parseInt(expAmount.replace(/\D+/g, ""), 10) || 0;
    if (amount <= 0) {
      setError("Settu upphæð kostnaðar.");
      return;
    }
    setSavingExp(true);
    setError(null);
    const { error: err } = await supabase.from("company_expenses").insert({
      category: expCat,
      year: thisYear,
      month: thisMonth,
      amount,
      note: expNote.trim() || null,
    });
    setSavingExp(false);
    if (err) {
      setError(err.message);
      return;
    }
    setExpAmount("");
    setExpNote("");
    await loadLedger();
  };

  const removeAsset = async (id: string) => {
    if (!window.confirm("Eyða þessari eign og tekjuskráningu hennar?")) return;
    await supabase.from("company_assets").delete().eq("id", id);
    await loadLedger();
  };

  if (!schemaReady) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="text-lg font-semibold">Eignabókhald ekki virkt enn</h2>
          <p className="mt-2 text-sm">
            Keyrðu <code className="rounded bg-white px-1.5 py-0.5 text-xs">sql/2026-09-28-admin-overview.sql</code> í
            Supabase til að skrá innkaup, mánaðarlegar tekjur og rekstrarkostnað. Yfirlit pöntunum hér fyrir neðan virkar samt.
          </p>
        </div>
        <KpiRow
          activeCount={activeOrders.length}
          expiringSoon={expiringSoon}
          mrr={mrr}
          bookedThisMonth={0}
          expensesThisMonth={0}
          fleetCost={0}
          paybackMonths={null}
          preorderCount={preorderCount}
        />
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Áætlaðar leigutekjur síðustu 12 mánuði</h2>
          <AreaBarChart
            labels={months.map((m) => m.label)}
            series={[{ name: "Leigur", color: "#004932", values: computedByMonth }]}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KpiRow
        activeCount={activeOrders.length}
        expiringSoon={expiringSoon}
        mrr={mrr}
        bookedThisMonth={bookedThisMonth}
        expensesThisMonth={expensesThisMonth}
        fleetCost={fleetCost}
        paybackMonths={paybackMonths}
        preorderCount={preorderCount}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">12 mánaða sjóðsstreymi</h2>
              <p className="text-xs text-gray-500">Bókaðar tekjur, áætlaðar leigutekjur og rekstrarkostnaður</p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
              <Legend color="#FF5733" label="Bókað" />
              <Legend color="#004932" label="Leigur (áætlað)" />
              <Legend color="#9ca3af" label="Kostnaður" />
            </div>
          </div>
          <AreaBarChart
            labels={months.map((m) => m.label)}
            series={[
              { name: "Bókað", color: "#FF5733", values: bookedByMonth },
              { name: "Leigur", color: "#004932", values: computedByMonth },
              { name: "Kostnaður", color: "#9ca3af", values: expenseByMonth },
            ]}
          />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-orange-50 px-2 py-2">
              <div className="text-gray-500">Hagnaður þessa mánaðar</div>
              <div className={`font-semibold ${profitThisMonth >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatKr(profitThisMonth)} kr
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 px-2 py-2">
              <div className="text-gray-500">Heildartekjur bókaðar</div>
              <div className="font-semibold text-gray-900">{formatKr(bookedTotal)} kr</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-2 py-2">
              <div className="text-gray-500">Óendurheimtur floti</div>
              <div className="font-semibold text-gray-900">{formatKr(Math.max(0, fleetCost - bookedTotal))} kr</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Vinsælasta leigan</h2>
          <p className="mb-4 text-xs text-gray-500">Mánaðartekjur úr virkum pöntunum</p>
          {productIncome.length === 0 ? (
            <p className="text-sm text-gray-500">Engar virkar pantanir.</p>
          ) : (
            <div className="space-y-3">
              {productIncome.map((row) => {
                const pct = mrr > 0 ? Math.round((row.amount / mrr) * 100) : 0;
                return (
                  <div key={row.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="truncate pr-2 font-medium text-gray-800">{row.name}</span>
                      <span className="text-gray-500">{formatKr(row.amount)} kr</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[var(--color-secondary)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Eignir sem þið keyptuð</h2>
          <p className="mb-4 text-xs text-gray-500">Skráðu innkaupaverð. ROI og endurheimt reiknast sjálfkrafa.</p>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <select value={assetProductId} onChange={(e) => setAssetProductId(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">Tengja við vöru (valfrjálst)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Nafn eignar" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input value={assetCost} onChange={(e) => setAssetCost(e.target.value)} placeholder="Kaupverð kr" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input type="date" value={assetDate} onChange={(e) => setAssetDate(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input value={assetNotes} onChange={(e) => setAssetNotes(e.target.value)} placeholder="Athugasemd" className="sm:col-span-2 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <button
              type="button"
              disabled={savingAsset}
              onClick={() => void addAsset()}
              className="sm:col-span-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingAsset ? "Vista…" : "Skrá eign"}
            </button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="pb-2">Eign</th>
                  <th className="pb-2">Kaup</th>
                  <th className="pb-2">Tekjur</th>
                  <th className="pb-2">Staða</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const earned = revenues.filter((r) => r.asset_id === a.id).reduce((s, r) => s + r.amount, 0);
                  const left = a.purchase_cost - earned;
                  const roi = a.purchase_cost > 0 ? Math.round((earned / a.purchase_cost) * 100) : 0;
                  return (
                    <tr key={a.id} className="border-t border-gray-100">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900">{a.name}</div>
                        <div className="text-[11px] text-gray-400">{a.purchase_date || "—"}</div>
                      </td>
                      <td className="py-2">{formatKr(a.purchase_cost)}</td>
                      <td className="py-2">{formatKr(earned)}</td>
                      <td className="py-2">
                        <span className={`text-xs font-medium ${left <= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                          {left <= 0 ? `Greidd upp · ${roi}%` : `${formatKr(left)} eftir · ${roi}%`}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => void removeAsset(a.id)} className="text-xs text-red-500 hover:underline">
                          Eyða
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && assets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      Engar eignir skráðar enn.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Skrá mánaðartekjur</h2>
            <p className="mb-4 text-xs text-gray-500">
              Hvað þessi eign skilaði ykkur í þessum mánuði. Tillaga byggir á virkum leigum.
            </p>
            <div className="grid gap-2">
              <select
                value={revAssetId}
                onChange={(e) => {
                  setRevAssetId(e.target.value);
                  const asset = assets.find((a) => a.id === e.target.value);
                  if (asset) setRevAmount(String(suggestedForAsset(asset) || ""));
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Veldu eign</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select value={revMonth} onChange={(e) => setRevMonth(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  {months.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input value={revAmount} onChange={(e) => setRevAmount(e.target.value)} placeholder="Upphæð kr" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <button
                type="button"
                disabled={savingRev}
                onClick={() => void addRevenue()}
                className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingRev ? "Vista…" : "Bóka tekjur"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Rekstrarkostnaður · {MONTHS_IS[thisMonth - 1]}</h2>
            <div className="mt-3 grid gap-2">
              <select value={expCat} onChange={(e) => setExpCat(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                {EXPENSE_CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="Upphæð kr" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input value={expNote} onChange={(e) => setExpNote(e.target.value)} placeholder="Lýsing" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <button
                type="button"
                disabled={savingExp}
                onClick={() => void addExpense()}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {savingExp ? "Vista…" : "Skrá kostnað"}
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {expenses
                .filter((e) => e.year === thisYear && e.month === thisMonth)
                .slice(0, 6)
                .map((e) => (
                  <li key={e.id} className="flex justify-between text-sm text-gray-700">
                    <span>
                      {e.category}
                      {e.note ? <span className="text-gray-400"> · {e.note}</span> : null}
                    </span>
                    <span>{formatKr(e.amount)} kr</span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function KpiRow({
  activeCount,
  expiringSoon,
  mrr,
  bookedThisMonth,
  expensesThisMonth,
  fleetCost,
  paybackMonths,
  preorderCount,
}: {
  activeCount: number;
  expiringSoon: number;
  mrr: number;
  bookedThisMonth: number;
  expensesThisMonth: number;
  fleetCost: number;
  paybackMonths: number | null;
  preorderCount: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Virkar leigur" value={String(activeCount)} hint={`${expiringSoon} á enda innan 14 daga`} />
      <Kpi label="MRR úr pöntunum" value={`${formatKr(mrr)} kr`} hint="Samtala mánaðarverðs á virkum pöntunum" />
      <Kpi label="Bókaðar tekjur í mánuði" value={`${formatKr(bookedThisMonth)} kr`} hint={`Kostnaður ${formatKr(expensesThisMonth)} kr`} accent />
      <Kpi
        label="Floti / endurheimt"
        value={`${formatKr(fleetCost)} kr`}
        hint={paybackMonths ? `~${paybackMonths} mán. á núverandi MRR` : `${preorderCount} á biðlista`}
      />
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accent ? "border-[var(--color-accent)]/30 bg-orange-50" : "border-gray-200 bg-white"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{hint}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function toIsoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
