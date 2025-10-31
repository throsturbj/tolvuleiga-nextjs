"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface AdminOrderRow {
  id: string;
  auth_uid: string | null;
  status: string;
  orderNumber?: string | null;
  created_at: string;
  updated_at: string;
  timabilFra?: string | null;
  timabilTil?: string | null;
  skjar?: boolean | null;
  lyklabord?: boolean | null;
  mus?: boolean | null;
  verd?: number | null;
  GamingPC_uuid?: number | null;
}

export default function AdminDashboardPage() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ownersByUid, setOwnersByUid] = useState<Record<string, string>>({});
  const [kennitalaByUid, setKennitalaByUid] = useState<Record<string, string>>({});
  const [pcNamesById, setPcNamesById] = useState<Record<number, string>>({});
  const [pendingStatusById, setPendingStatusById] = useState<Record<string, string>>({});
  const [busyUpdateById, setBusyUpdateById] = useState<Record<string, boolean>>({});
  const [busyDeleteById, setBusyDeleteById] = useState<Record<string, boolean>>({});

  const isAdmin = !!user?.isAdmin;

  useEffect(() => {
    if (authLoading) return;
    if (!session?.user) {
      router.replace("/auth?redirect=/stjornbord");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }
  }, [authLoading, session?.user, isAdmin, router]);

  useEffect(() => {
    const fetchAllOrders = async () => {
      if (!session?.user || !isAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          setError(error.message);
          setOrders([]);
        } else {
          const rows = (data as AdminOrderRow[]) ?? [];
          setOrders(rows);
          // Initialize pending statuses for inline edits
          const nextPending: Record<string, string> = {};
          for (const r of rows) {
            nextPending[r.id] = r.status;
          }
          setPendingStatusById(nextPending);
          // Fetch owner names for displayed orders
          const uids = Array.from(
            new Set(
              rows
                .map((o) => o.auth_uid)
                .filter((v): v is string => typeof v === "string" && v.length > 0)
            )
          );
          if (uids.length > 0) {
            const { data: usersData, error: usersError } = await supabase
              .from("users")
              .select("auth_uid, full_name, kennitala")
              .in("auth_uid", uids);
            if (!usersError && usersData) {
              const map: Record<string, string> = {};
              const ktMap: Record<string, string> = {};
              for (const u of usersData as { auth_uid: string; full_name: string | null; kennitala?: string | null }[]) {
                map[u.auth_uid] = u.full_name || "";
                ktMap[u.auth_uid] = u.kennitala || "";
              }
              setOwnersByUid(map);
              setKennitalaByUid(ktMap);
            }
          } else {
            setOwnersByUid({});
            setKennitalaByUid({});
          }
          // Fetch GamingPC names
          const pcIds = Array.from(new Set(rows.map(r => r.GamingPC_uuid).filter((v): v is number => typeof v === 'number')));
          if (pcIds.length > 0) {
            const { data: pcData } = await supabase
              .from('GamingPC')
              .select('id,name')
              .in('id', pcIds);
            const mapPc: Record<number, string> = {};
            (pcData || []).forEach((r: { id: number; name: string }) => { mapPc[r.id] = r.name; });
            setPcNamesById(mapPc);
          } else {
            setPcNamesById({});
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllOrders();
  }, [session?.user, isAdmin]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("is-IS", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return iso;
    }
  };

  const tableRows = useMemo(() => {
    return orders.map((o) => ({
      ...o,
      periodFmt:
        o.timabilFra && o.timabilTil
          ? `${formatDate(o.timabilFra)} → ${formatDate(o.timabilTil)}`
          : "—",
    }));
  }, [orders]);

  const formatPrice = (value: unknown) => {
    const n = typeof value === 'number' ? value : parseInt((value as string | undefined || '').toString().replace(/\D+/g, ''), 10);
    if (!Number.isFinite(n)) return null;
    return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr/mánuði`;
  };

  const allowedStatuses = ["Undirbúningur", "Í gangi", "Í vinnslu", "Lokið", "Hætt við"] as const;

  const handleChangeStatus = (orderId: string, status: string) => {
    setPendingStatusById((prev) => ({ ...prev, [orderId]: status }));
  };

  const handleUpdateOrder = async (orderId: string) => {
    if (!isAdmin) return;
    const newStatus = pendingStatusById[orderId];
    if (!newStatus) return;
    setBusyUpdateById((p) => ({ ...p, [orderId]: true }));
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (!error) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      }
    } finally {
      setBusyUpdateById((p) => ({ ...p, [orderId]: false }));
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!isAdmin) return;
    const confirmDelete = typeof window !== "undefined" ? window.confirm("Eyða þessari pöntun?") : false;
    if (!confirmDelete) return;
    setBusyDeleteById((p) => ({ ...p, [orderId]: true }));
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      if (!error) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setPendingStatusById((prev) => {
          const copy = { ...prev };
          delete copy[orderId];
          return copy;
        });
      }
    } finally {
      setBusyDeleteById((p) => ({ ...p, [orderId]: false }));
    }
  };

  if (authLoading || (!session?.user && typeof window !== "undefined")) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse h-8 w-40 bg-gray-200 rounded mb-6" />
          <div className="h-64 bg-white border border-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main id="main" className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Stjórnborð</h1>
          <div className="text-sm text-gray-500">Allar pantanir</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {loading ? "Sæki gögn…" : `${orders.length} pantanir fundust`}
              {error ? (
                <span className="ml-3 text-red-600">Villa: {error}</span>
              ) : null}
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pöntun</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Staða</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Notandi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kennitala</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Vara</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Verð</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tímabil</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aukahlutir</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aðgerðir</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((o) => (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-[13px] text-gray-800">
                        {o.orderNumber ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                        value={pendingStatusById[o.id] ?? o.status}
                        onChange={(e) => handleChangeStatus(o.id, e.target.value)}
                      >
                        {allowedStatuses.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[13px] text-gray-700">{o.auth_uid ? (ownersByUid[o.auth_uid] || "—") : "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">{o.auth_uid ? (kennitalaByUid[o.auth_uid] || '—') : '—'}</td>
                    <td className="px-4 py-3 align-top text-gray-700 min-w-[6rem] pr-3">
                      {o.GamingPC_uuid ? (pcNamesById[o.GamingPC_uuid] || '—') : '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">
                      {(() => { const p = formatPrice(o.verd); return p ? p : '—'; })()}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">{o.periodFmt}</td>
                    <td className="px-4 py-3 align-top text-gray-700">
                      <div className="flex flex-wrap gap-2">
                        {o.skjar ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">Skjár</span>
                        ) : null}
                        {o.lyklabord ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">Lyklaborð</span>
                        ) : null}
                        {o.mus ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">Mús</span>
                        ) : null}
                        {!o.skjar && !o.lyklabord && !o.mus ? <span className="text-xs text-gray-400">—</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!!busyUpdateById[o.id]}
                          onClick={() => handleUpdateOrder(o.id)}
                          className="inline-flex items-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50"
                        >
                          Uppfæra
                        </button>
                        <button
                          type="button"
                          disabled={!!busyDeleteById[o.id]}
                          onClick={() => handleDeleteOrder(o.id)}
                          className="inline-flex items-center px-2.5 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 text-xs disabled:opacity-50"
                        >
                          Eyða
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      Engar pantanir fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}


