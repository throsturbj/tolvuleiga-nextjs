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
  gamingpc_uuid?: number | null;
  pdf_url?: string | null;
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
  const [busyOpenPdfById, setBusyOpenPdfById] = useState<Record<string, boolean>>({});
  const [busyRemindById, setBusyRemindById] = useState<Record<string, boolean>>({});

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
          const pcIds = Array.from(new Set(rows.map(r => r.gamingpc_uuid).filter((v): v is number => typeof v === 'number')));
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
    return orders.map((o) => {
      const nowMs = Date.now();
      const tilMs = o.timabilTil ? new Date(o.timabilTil).getTime() : NaN;
      const daysLeft = Number.isFinite(tilMs) ? Math.ceil((tilMs - nowMs) / (1000 * 60 * 60 * 24)) : null;
      const expiringSoon = typeof daysLeft === 'number' && daysLeft <= 2;
      return {
        ...o,
        periodFmt:
          o.timabilFra && o.timabilTil
            ? `${formatDate(o.timabilFra)} → ${formatDate(o.timabilTil)}`
            : "—",
        expiringSoon,
      };
    });
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
      // Call server endpoint to delete order and associated PDF from storage
      const res = await fetch('/api/order/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setPendingStatusById((prev) => {
          const copy = { ...prev };
          delete copy[orderId];
          return copy;
        });
      } else {
        const json = await res.json().catch(() => null) as { error?: string } | null;
        setError(json?.error || 'Gat ekki eytt pöntun');
      }
    } finally {
      setBusyDeleteById((p) => ({ ...p, [orderId]: false }));
    }
  };

  const handleSendReminder = async (orderId: string) => {
    if (!isAdmin) return;
    setBusyRemindById((p) => ({ ...p, [orderId]: true }));
    setError(null);
    try {
      const res = await fetch('/api/order/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null) as { error?: string } | null;
        setError(json?.error || 'Gat ekki sent minningarpóst');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Villa við að senda minningu');
    } finally {
      setBusyRemindById((p) => ({ ...p, [orderId]: false }));
    }
  };

  const handleOpenPdf = async (orderId: string, url?: string | null, orderNumber?: string | null) => {
    // Prefer clean URL if we have an orderNumber
    if (orderNumber && typeof window !== 'undefined') {
      window.open(`/${encodeURIComponent(orderNumber)}/pdf`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!url) return;
    setBusyOpenPdfById((p) => ({ ...p, [orderId]: true }));
    try {
      // Refresh session to ensure valid JWT (used for storage.download if needed)
      try { await supabase.auth.refreshSession(); } catch {}

      // Try to extract bucket and object path from a signed URL
      let bucket: string | null = null;
      let objectPath: string | null = null;
      try {
        const u = new URL(url);
        const marker = '/storage/v1/object/sign/';
        const idx = u.pathname.indexOf(marker);
        if (idx !== -1) {
          const after = u.pathname.slice(idx + marker.length); // e.g., "order-pdfs/path/to.pdf"
          const parts = after.split('/');
          bucket = parts.shift() || null;
          objectPath = parts.length > 0 ? decodeURIComponent(parts.join('/')) : null;
        }
      } catch {}

      if (bucket && objectPath) {
        // Prefer server-side fresh signed URL (avoids client RLS/policy issues)
        const apiRes = await fetch(`/api/pdf?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(objectPath)}`);
        if (apiRes.ok) {
          const json = await apiRes.json();
          const signedUrl: string | undefined = json?.signedUrl;
          if (signedUrl) {
            window.open(signedUrl, '_blank', 'noopener,noreferrer');
            return;
          }
        }
        // Fallback: try direct download with current auth
        const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(objectPath);
        if (!dlErr && file) {
          const blobUrl = URL.createObjectURL(file);
          window.open(blobUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        // Last resort: ask server to sign via url param
        const apiRes2 = await fetch(`/api/pdf?url=${encodeURIComponent(url)}`);
        if (apiRes2.ok) {
          const json = await apiRes2.json();
          const signedUrl2: string | undefined = json?.signedUrl;
          if (signedUrl2) {
            window.open(signedUrl2, '_blank', 'noopener,noreferrer');
            return;
          }
        }
        throw new Error('Gat ekki opnað PDF');
      }

      // If not a signed URL (or parsing failed), attempt direct fetch with current access token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF opnun mistókst');
    } finally {
      setBusyOpenPdfById((p) => ({ ...p, [orderId]: false }));
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
                  <tr key={o.id} className={`border-b border-gray-100 hover:bg-gray-50/60 ${o.expiringSoon ? 'bg-red-50' : ''}`}>
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
                      {o.gamingpc_uuid ? (pcNamesById[o.gamingpc_uuid] || '—') : '—'}
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
                        {o.pdf_url || o.orderNumber ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPdf(o.id, o.pdf_url, o.orderNumber)}
                            disabled={!!busyOpenPdfById[o.id]}
                            className="inline-flex items-center text-blue-600 hover:underline disabled:opacity-50"
                            title="Sækja reikning"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <path d="M14 2v6h6" />
                            </svg>
                          </button>
                        ) : null}
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
                          disabled={!!busyRemindById[o.id]}
                          onClick={() => handleSendReminder(o.id)}
                          className="inline-flex items-center px-2.5 py-1.5 rounded border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs disabled:opacity-50 whitespace-nowrap"
                        >
                          Minna á
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


