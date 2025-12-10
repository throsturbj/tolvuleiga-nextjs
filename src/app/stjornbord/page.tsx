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
  trygging?: boolean | null;
  verd?: number | null;
  gamingpc_uuid?: number | null;
  gamingconsole_uuid?: string | null;
  screen_uuid?: string | null;
  numberofextracon?: number | null;
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
  const [busyGeneratePdfById, setBusyGeneratePdfById] = useState<Record<string, boolean>>({});
  const [busyRemindById, setBusyRemindById] = useState<Record<string, boolean>>({});
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editDraft, setEditDraft] = useState<{
    status: string;
    timabilFra: string | null;
    timabilTil: string | null;
    verd: number | null;
    skjar: boolean;
    lyklabord: boolean;
    mus: boolean;
    trygging: boolean;
    numberofextracon: number;
    gamingpc_uuid: number | null;
    gamingconsole_uuid: string | null;
    screen_uuid: string | null;
  } | null>(null);
  const [allPcs, setAllPcs] = useState<Array<{ id: number; name: string }>>([]);
  const [allConsoles, setAllConsoles] = useState<Array<{ id: string; nafn: string }>>([]);
  const [allScreens, setAllScreens] = useState<Array<{ id: string; label: string }>>([]);
  // Framlengingar (extensions) admin review
  const [framlengingarByOrderId, setFramlengingarByOrderId] = useState<Record<string, { id: string; approved: boolean; newtimabilfra: string | null; newtimabiltil: string | null; newverd: string | null; nafn?: string | null }>>({});
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);

  const isAdmin = !!user?.isAdmin;
  const [activeTab, setActiveTab] = useState<'orders' | 'preorders'>('orders');
  const [preorders, setPreorders] = useState<Array<{ id: string; auth_uid: string | null; created_at: string; gamingpc_uuid?: number | null }>>([]);
  const [preorderUserNameByUid, setPreorderUserNameByUid] = useState<Record<string, string>>({});
  const [preorderEmailByUid, setPreorderEmailByUid] = useState<Record<string, string>>({});

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
          // Fetch any framlengingar linked to these orders
          try {
            const orderIds = rows.map((r) => r.id);
            if (orderIds.length > 0) {
              const { data: frows } = await supabase
                .from('framlengingar')
                .select('id, order_id, approved, newtimabilfra, newtimabiltil, newverd, nafn')
                .in('order_id', orderIds);
              if (Array.isArray(frows)) {
                const map: Record<string, { id: string; approved: boolean; newtimabilfra: string | null; newtimabiltil: string | null; newverd: string | null; nafn?: string | null }> = {};
                (frows as Array<{ id: string; order_id: string; approved: boolean; newtimabilfra: string | null; newtimabiltil: string | null; newverd: string | null; nafn?: string | null }>).forEach((r) => {
                  if (!(r.order_id in map)) {
                    map[r.order_id] = { id: r.id, approved: !!r.approved, newtimabilfra: r.newtimabilfra, newtimabiltil: r.newtimabiltil, newverd: r.newverd, nafn: r.nafn || null };
                  }
                });
                // Fix potential typo key if present
                Object.keys(map).forEach((k) => {
                  // no-op, ensure structure
                });
                setFramlengingarByOrderId(map);
              } else {
                setFramlengingarByOrderId({});
              }
            } else {
              setFramlengingarByOrderId({});
            }
          } catch {
            setFramlengingarByOrderId({});
          }
          // Fetch owner names for displayed orders
          const uidsFromOrders = Array.from(
            new Set(
              rows
                .map((o) => o.auth_uid)
                .filter((v): v is string => typeof v === "string" && v.length > 0)
            )
          );
          const uids = uidsFromOrders;
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
            } else {
              setOwnersByUid({});
              setKennitalaByUid({});
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
          // Fetch all product lists for modal selection
          try {
            const [pcsRes, consRes, scrRes] = await Promise.all([
              supabase.from('GamingPC').select('id,name'),
              supabase.from('gamingconsoles').select('id, nafn'),
              supabase.from('screens').select('id, framleidandi, skjastaerd, upplausn'),
            ]);
            if (!pcsRes.error && Array.isArray(pcsRes.data)) {
              setAllPcs((pcsRes.data as Array<{ id: number; name?: string | null }>).map(r => ({ id: r.id, name: r.name || String(r.id) })));
            } else {
              setAllPcs([]);
            }
            if (!consRes.error && Array.isArray(consRes.data)) {
              setAllConsoles((consRes.data as Array<{ id: string; nafn?: string | null }>).map(r => ({ id: r.id, nafn: r.nafn || r.id })));
            } else {
              setAllConsoles([]);
            }
            if (!scrRes.error && Array.isArray(scrRes.data)) {
              setAllScreens((scrRes.data as Array<{ id: string; framleidandi?: string | null; skjastaerd?: string | null; upplausn?: string | null }>).map(r => {
                const parts = [r.framleidandi, r.skjastaerd, r.upplausn].filter(Boolean);
                return { id: r.id, label: parts.length > 0 ? parts.join(' · ') : r.id };
              }));
            } else {
              setAllScreens([]);
            }
          } catch {
            setAllPcs([]);
            setAllConsoles([]);
            setAllScreens([]);
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

  // Fetch all preorders and hydrate names/emails when Biðlisti tab is active
  useEffect(() => {
    const fetchPreorders = async () => {
      if (!isAdmin || activeTab !== 'preorders') return;
      try {
        const { data, error } = await supabase
          .from('preorders')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          return;
        }
        const rows = (data as Array<{ id: string; auth_uid: string | null; created_at: string; gamingpc_uuid?: number | null }>) || [];
        setPreorders(rows);

        // Ensure we have product names for all referenced PCs
        try {
          const prePcIds = Array.from(
            new Set(rows.map(r => r.gamingpc_uuid).filter((v): v is number => typeof v === 'number'))
          );
          const missing = prePcIds.filter(id => pcNamesById[id] === undefined);
          if (missing.length > 0) {
            const { data: pcData } = await supabase
              .from('GamingPC')
              .select('id,name')
              .in('id', missing);
            if (Array.isArray(pcData)) {
              const add: Record<number, string> = {};
              pcData.forEach((r: { id: number; name?: string | null }) => { add[r.id] = (r.name || '').trim(); });
              setPcNamesById(prev => ({ ...prev, ...add }));
            }
          }
        } catch {}

        const uids = Array.from(
          new Set(rows.map(r => r.auth_uid).filter((v): v is string => typeof v === 'string' && v.length > 0))
        );
        if (uids.length === 0) {
          setPreorderUserNameByUid({});
          setPreorderEmailByUid({});
          return;
        }
        // Fetch names from users (service route) and emails from auth
        try {
          const [usersRes, emailsRes] = await Promise.all([
            fetch('/api/admin/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uids }),
            }),
            fetch('/api/admin/auth-emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uids }),
            }),
          ]);
          if (usersRes.ok) {
            const j = await usersRes.json() as { users?: Array<{ auth_uid: string; full_name?: string | null }> };
            const map: Record<string, string> = {};
            (j.users || []).forEach(u => { map[u.auth_uid] = (u.full_name || '').trim(); });
            setPreorderUserNameByUid(map);
          } else {
            setPreorderUserNameByUid({});
          }
          if (emailsRes.ok) {
            const ej = await emailsRes.json() as { emails?: Record<string, string> };
            setPreorderEmailByUid(ej.emails || {});
          } else {
            setPreorderEmailByUid({});
          }
        } catch {
          setPreorderUserNameByUid({});
          setPreorderEmailByUid({});
        }
      } catch {}
    };
    fetchPreorders();
  }, [activeTab, isAdmin, supabase]);

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

  const isoToLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    } catch {
      return '';
    }
  };

  const localInputToIso = (val: string) => {
    if (!val) return null;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const roundToNearest10 = (n: number) => {
    return Math.round(n / 10) * 10;
  };

  const openEditModal = (order: AdminOrderRow) => {
    setEditOrderId(order.id);
    setEditDraft({
      status: order.status,
      timabilFra: order.timabilFra || null,
      timabilTil: order.timabilTil || null,
      verd: typeof order.verd === 'number' ? order.verd : (typeof order.verd === 'string' ? parseInt(String(order.verd).replace(/\D+/g, ''), 10) || null : null),
      skjar: !!order.skjar,
      lyklabord: !!order.lyklabord,
      mus: !!order.mus,
      trygging: !!order.trygging,
      numberofextracon: typeof order.numberofextracon === 'number' ? order.numberofextracon : 0,
      gamingpc_uuid: typeof order.gamingpc_uuid === 'number' ? order.gamingpc_uuid : null,
      gamingconsole_uuid: order.gamingconsole_uuid || null,
      screen_uuid: order.screen_uuid || null,
    });
  };

  const closeEditModal = () => {
    setEditOrderId(null);
    setEditDraft(null);
    setSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!isAdmin || !editOrderId || !editDraft) return;
    setSavingEdit(true);
    setError(null);
    const payload = {
      status: editDraft.status,
      timabilFra: editDraft.timabilFra,
      timabilTil: editDraft.timabilTil,
      verd: editDraft.verd,
      skjar: editDraft.skjar,
      lyklabord: editDraft.lyklabord,
      mus: editDraft.mus,
      trygging: editDraft.trygging,
      numberofextracon: editDraft.numberofextracon,
      gamingpc_uuid: editDraft.gamingpc_uuid,
      gamingconsole_uuid: editDraft.gamingconsole_uuid,
      screen_uuid: editDraft.screen_uuid,
    } as Record<string, unknown>;
    try {
      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', editOrderId);
      if (error) {
        setError(error.message);
      } else {
        setOrders((prev) => prev.map((o) => (o.id === editOrderId ? { ...o, ...payload } as AdminOrderRow : o)));
        closeEditModal();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uppfærsla mistókst');
    } finally {
      setSavingEdit(false);
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
        // Force delete any related framlengingar rows for this order
        try {
          await supabase.from('framlengingar').delete().eq('order_id', orderId);
          setFramlengingarByOrderId((prev) => {
            const copy = { ...prev };
            delete copy[orderId];
            return copy;
          });
        } catch {}
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

  const handleGenerateAdminPdf = async (orderId: string) => {
    if (!isAdmin) return;
    setBusyGeneratePdfById((p) => ({ ...p, [orderId]: true }));
    try {
      const res = await fetch('/api/order/generate-admin-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null) as { pdfUrl?: string } | null;
        if (json?.pdfUrl) {
          setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, pdf_url: json.pdfUrl } : o)));
        }
        // After successful PDF generation, delete framlenging entry if it matches current order values and is approved
        try {
          const ord = orders.find((o) => o.id === orderId);
          const fr = framlengingarByOrderId[orderId];
          const toNum = (v: unknown) => {
            const n = typeof v === 'number' ? v : parseInt(String(v || '').replace(/\D+/g, ''), 10);
            return Number.isFinite(n) ? n : 0;
          };
          const eqIso = (a?: string | null, b?: string | null) => {
            if (!a || !b) return false;
            const ta = new Date(a).getTime();
            const tb = new Date(b).getTime();
            return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
          };
          if (ord && fr && fr.approved) {
            const match =
              eqIso(fr.newtimabilfra, ord.timabilFra) &&
              eqIso(fr.newtimabiltil, ord.timabilTil) &&
              toNum(fr.newverd) === toNum(ord.verd);
            if (match) {
              const { error: delErr } = await supabase
                .from('framlengingar')
                .delete()
                .eq('id', fr.id);
              if (!delErr) {
                setFramlengingarByOrderId((prev) => {
                  const copy = { ...prev };
                  delete copy[orderId];
                  return copy;
                });
              }
            }
          }
        } catch {}
      } else {
        const json = await res.json().catch(() => null) as { error?: string } | null;
        setError(json?.error || 'Gat ekki búið til PDF');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Villa við að búa til PDF');
    } finally {
      setBusyGeneratePdfById((p) => ({ ...p, [orderId]: false }));
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
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex gap-4" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                activeTab === 'orders'
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pantanir
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preorders')}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                activeTab === 'preorders'
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Biðlisti
            </button>
          </nav>
        </div>
        {activeTab === 'orders' ? (
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[20rem]">Tímabil</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aukahlutir</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Trygging</th>
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">{o.status}</span>
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
                    <td className="px-4 py-3 align-top text-gray-700 min-w-[20rem] whitespace-nowrap">{o.periodFmt}</td>
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
                    <td className="px-4 py-3 align-top text-gray-700">
                      {o.trygging ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">Já</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs">Nei</span>
                      )}
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
                          onClick={() => openEditModal(o)}
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
                        <button
                          type="button"
                          disabled={!!busyGeneratePdfById[o.id]}
                          onClick={() => handleGenerateAdminPdf(o.id)}
                          className="inline-flex items-center px-2.5 py-1.5 rounded border border-purple-600 text-purple-600 hover:bg-purple-50 text-xs disabled:opacity-50 whitespace-nowrap"
                          title="Endurskapa PDF og senda á admin"
                        >
                          PDF
                        </button>
                        {framlengingarByOrderId[o.id] ? (
                          <button
                            type="button"
                            onClick={() => setReviewOrderId(o.id)}
                            className="inline-flex items-center px-2.5 py-1.5 rounded border border-orange-600 text-orange-700 hover:bg-orange-50 text-xs disabled:opacity-50 whitespace-nowrap"
                            title="Skoða framlengingu"
                          >
                            Ósk
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                      Engar pantanir fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {`${preorders.length} biðlistar-skráningar`}
              </div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Dagsetning</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Notandi</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Netfang</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vara</th>
                  </tr>
                </thead>
                <tbody>
                  {preorders.map((po) => {
                    const uid = po.auth_uid || '';
                    const name = (uid && (preorderUserNameByUid[uid] || '') || '').trim();
                    const email = uid ? (preorderEmailByUid[uid] || '') : '';
                    return (
                      <tr key={po.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                        <td className="px-4 py-3 align-top">{formatDate(po.created_at)}</td>
                        <td className="px-4 py-3 align-top">{name || '—'}</td>
                        <td className="px-4 py-3 align-top">{email || '—'}</td>
                        <td className="px-4 py-3 align-top">{(typeof po.gamingpc_uuid === 'number' && pcNamesById[po.gamingpc_uuid]) ? pcNamesById[po.gamingpc_uuid] : '—'}</td>
                      </tr>
                    );
                  })}
                  {preorders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                        Engar skráningar á biðlista fundust.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Edit modal */}
        {editOrderId && editDraft ? (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={savingEdit ? undefined : closeEditModal} />
            <div className="relative z-10 mx-auto mt-20 w-full max-w-2xl rounded-lg bg-white shadow-xl">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Uppfæra pöntun</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={closeEditModal} disabled={savingEdit}>✕</button>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Staða</label>
                    <select
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      value={editDraft.status}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, status: e.target.value } : d)}
                    >
                      {allowedStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Verð (kr/mánuði)</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      value={editDraft.verd ?? ''}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, verd: e.target.value === '' ? null : Number(e.target.value) } : d)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Frá</label>
                    <input
                      type="datetime-local"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      value={isoToLocalInput(editDraft.timabilFra)}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, timabilFra: localInputToIso(e.target.value) } : d)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Til</label>
                    <input
                      type="datetime-local"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      value={isoToLocalInput(editDraft.timabilTil)}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, timabilTil: localInputToIso(e.target.value) } : d)}
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vara</label>
                    <select
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      value={
                        editDraft.gamingpc_uuid ? `pc:${editDraft.gamingpc_uuid}` :
                        editDraft.gamingconsole_uuid ? `console:${editDraft.gamingconsole_uuid}` :
                        editDraft.screen_uuid ? `screen:${editDraft.screen_uuid}` : ''
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditDraft((d) => {
                          if (!d) return d;
                          if (!v) return { ...d, gamingpc_uuid: null, gamingconsole_uuid: null, screen_uuid: null };
                          const [kind, id] = v.split(':', 2);
                          if (kind === 'pc') {
                            return { ...d, gamingpc_uuid: Number(id), gamingconsole_uuid: null, screen_uuid: null };
                          } else if (kind === 'console') {
                            return { ...d, gamingpc_uuid: null, gamingconsole_uuid: id, screen_uuid: null };
                          } else {
                            return { ...d, gamingpc_uuid: null, gamingconsole_uuid: null, screen_uuid: id };
                          }
                        });
                      }}
                    >
                      <option value="">—</option>
                      {allPcs.length > 0 ? <optgroup label="Tölvur (PC)"></optgroup> : null}
                      {allPcs.map((p) => (
                        <option key={`pc:${p.id}`} value={`pc:${p.id}`}>{p.name}</option>
                      ))}
                      {allConsoles.length > 0 ? <optgroup label="Leikjatölvur"></optgroup> : null}
                      {allConsoles.map((c) => (
                        <option key={`console:${c.id}`} value={`console:${c.id}`}>{c.nafn}</option>
                      ))}
                      {allScreens.length > 0 ? <optgroup label="Skjáir"></optgroup> : null}
                      {allScreens.map((s) => (
                        <option key={`screen:${s.id}`} value={`screen:${s.id}`}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {(!!editDraft.gamingconsole_uuid) ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Auka fjarstýringar</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        value={editDraft.numberofextracon}
                        onChange={(e) => setEditDraft((d) => d ? { ...d, numberofextracon: Math.max(0, Number(e.target.value || 0)) } : d)}
                      />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    {(!!editDraft.gamingpc_uuid || !!editDraft.gamingconsole_uuid) ? (
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={editDraft.skjar} onChange={(e) => setEditDraft((d) => d ? { ...d, skjar: e.target.checked } : d)} />
                        Skjár
                      </label>
                    ) : null}
                    {(!!editDraft.gamingpc_uuid) ? (
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={editDraft.lyklabord} onChange={(e) => setEditDraft((d) => d ? { ...d, lyklabord: e.target.checked } : d)} />
                        Lyklaborð
                      </label>
                    ) : null}
                    {(!!editDraft.gamingpc_uuid) ? (
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={editDraft.mus} onChange={(e) => setEditDraft((d) => d ? { ...d, mus: e.target.checked } : d)} />
                        Mús
                      </label>
                    ) : null}
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={editDraft.trygging}
                        onChange={(e) => setEditDraft((d) => {
                          if (!d) return d;
                          const nextChecked = e.target.checked;
                          let nextPrice = d.verd;
                          if (typeof nextPrice === 'number') {
                            if (nextChecked && !d.trygging) {
                              nextPrice = roundToNearest10(nextPrice * 1.1);
                            } else if (!nextChecked && d.trygging) {
                              nextPrice = roundToNearest10(nextPrice / 1.1);
                            }
                          }
                          return { ...d, trygging: nextChecked, verd: nextPrice };
                        })}
                      />
                      Trygging
                    </label>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={savingEdit}
                  className="inline-flex items-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50"
                >
                  Hætta við
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="inline-flex items-center px-3 py-1.5 rounded border border-green-600 text-green-700 hover:bg-green-50 text-sm disabled:opacity-50"
                >
                  Vista
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {/* Review Framlenging modal */}
        {reviewOrderId && framlengingarByOrderId[reviewOrderId] ? (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setReviewOrderId(null)} />
            <div className="relative z-10 mx-auto mt-24 w-full max-w-xl rounded-lg bg-white shadow-xl">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Framlenging</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setReviewOrderId(null)}>✕</button>
              </div>
              <div className="px-6 py-4 space-y-3 text-sm">
                {(() => {
                  const ord = orders.find(o => o.id === reviewOrderId);
                  const fr = framlengingarByOrderId[reviewOrderId]!;
                  const fmt = (v: unknown) => {
                    const n = typeof v === 'number' ? v : parseInt(String(v || '').replace(/\D+/g, ''), 10);
                    return Number.isFinite(n) ? `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr/mánuði` : '—';
                  };
                  return (
                    <>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Nafn:</span>{' '}
                        {ord?.auth_uid ? (ownersByUid[ord.auth_uid] || '—') : (fr.nafn || '—')}
                      </div>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Gamalt verð:</span>{' '}
                        {fmt(ord?.verd ?? null)}
                      </div>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Nýtt verð:</span>{' '}
                        {fmt(fr.newverd)}
                      </div>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Gamalt tímabil:</span>{' '}
                        {ord?.timabilFra && ord?.timabilTil ? `${formatDate(ord.timabilFra)} → ${formatDate(ord.timabilTil)}` : '—'}
                      </div>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Nýtt tímabil:</span>{' '}
                        {fr.newtimabilfra && fr.newtimabiltil ? `${formatDate(fr.newtimabilfra)} → ${formatDate(fr.newtimabiltil)}` : '—'}
                      </div>
                      <div className="text-gray-700">
                        <span className="text-gray-500">Staða samþykkis:</span>{' '}
                        {fr.approved ? 'Samþykkt' : 'Í bið'}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const ordId = reviewOrderId;
                    if (!ordId) return;
                    const fr = framlengingarByOrderId[ordId];
                    if (!fr) return;
                    const next = !fr.approved;
                    try {
                      const { error } = await supabase
                        .from('framlengingar')
                        .update({ approved: next })
                        .eq('id', fr.id);
                      if (!error) {
                        setFramlengingarByOrderId((prev) => ({ ...prev, [ordId]: { ...fr, approved: next } }));
                      }
                    } catch {}
                  }}
                  className="inline-flex items-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
                >
                  {framlengingarByOrderId[reviewOrderId]?.approved ? 'Ekki samþykkja' : 'Samþykkja'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ordId = reviewOrderId;
                    if (!ordId) return;
                    const fr = framlengingarByOrderId[ordId];
                    if (!fr) return;
                    const newVerdNum = parseInt(String(fr.newverd || '').replace(/\D+/g, ''), 10);
                    const payload: Record<string, unknown> = {};
                    if (Number.isFinite(newVerdNum)) payload.verd = newVerdNum;
                    if (fr.newtimabilfra) payload.timabilFra = fr.newtimabilfra;
                    if (fr.newtimabiltil) payload.timabilTil = fr.newtimabiltil;
                    try {
                      const { error } = await supabase
                        .from('orders')
                        .update(payload)
                        .eq('id', ordId);
                      if (!error) {
                        setOrders((prev) => prev.map((o) => (o.id === ordId ? { ...o, ...(payload as Partial<AdminOrderRow>) } : o)));
                        setReviewOrderId(null);
                      }
                    } catch {}
                  }}
                  className="inline-flex items-center px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-sm"
                >
                  Uppfæra gildi
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}


