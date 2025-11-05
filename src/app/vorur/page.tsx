"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface GamingPCRow {
  id: number;
  name: string;
  verd: string;
  motherboard: string;
  powersupply: string;
  cpu: string;
  cpucooler: string;
  ram: string;
  storage: string;
  gpu: string;
  uppselt?: boolean;
  falid?: boolean;
  created_at?: string;
}

type NewRow = Omit<GamingPCRow, "id" | "created_at">;

export default function VorurAdminPage() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<GamingPCRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<NewRow | null>(null);

  const [form, setForm] = useState<NewRow>({
    name: "",
    verd: "",
    motherboard: "",
    powersupply: "",
    cpu: "",
    cpucooler: "",
    ram: "",
    storage: "",
    gpu: "",
  });

  const isAdmin = !!user?.isAdmin;

  useEffect(() => {
    if (authLoading) return;
    if (!session?.user) {
      router.replace("/auth?redirect=/vorur");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }
  }, [authLoading, session?.user, isAdmin, router]);

  useEffect(() => {
    const fetchRows = async () => {
      if (!session?.user || !isAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("GamingPC")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          setError(error.message);
          setRows([]);
        } else {
          setRows((data as GamingPCRow[]) ?? []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRows();
  }, [session?.user, isAdmin]);

  const onChange = (field: keyof NewRow, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const onChangeEdit = (field: keyof NewRow, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const validate = (r: NewRow): string[] => {
    const errs: string[] = [];
    if (!r.name.trim()) errs.push("Nafn vantar");
    if (!r.verd.trim()) errs.push("Verð vantar");
    if (!r.motherboard.trim()) errs.push("Motherboard vantar");
    if (!r.powersupply.trim()) errs.push("Aflgjafi vantar");
    if (!r.cpu.trim()) errs.push("Örgjörvi vantar");
    if (!r.cpucooler.trim()) errs.push("Kæling vantar");
    if (!r.ram.trim()) errs.push("Vinnsluminni vantar");
    if (!r.storage.trim()) errs.push("Geymsla vantar");
    if (!r.gpu.trim()) errs.push("Skjákort vantar");
    return errs;
  };

  const handleCreate = async () => {
    if (!isAdmin) return;
    const errs = validate(form);
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("GamingPC")
        .insert([{ ...form }])
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setRows((prev) => [data as GamingPCRow, ...prev]);
        setForm({ name: "", verd: "", motherboard: "", powersupply: "", cpu: "", cpucooler: "", ram: "", storage: "", gpu: "" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (row: GamingPCRow) => {
    if (!isAdmin) return;
    setEditingId(row.id);
    setEditForm({
      name: row.name,
      verd: row.verd,
      motherboard: row.motherboard,
      powersupply: row.powersupply,
      cpu: row.cpu,
      cpucooler: row.cpucooler,
      ram: row.ram,
      storage: row.storage,
      gpu: row.gpu,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleUpdate = async (id: number) => {
    if (!isAdmin || !editForm) return;
    const errs = validate(editForm);
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("GamingPC")
        .update({ ...editForm })
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setRows((prev) => prev.map((r) => (r.id === id ? (data as GamingPCRow) : r)));
        setEditingId(null);
        setEditForm(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleFalid = async (id: number, currentFalid: boolean | undefined) => {
    if (!isAdmin) return;
    setUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("GamingPC")
        .update({ falid: !currentFalid })
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setRows((prev) => prev.map((r) => (r.id === id ? (data as GamingPCRow) : r)));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleUppselt = async (id: number, currentUppselt: boolean | undefined) => {
    if (!isAdmin) return;
    setUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("GamingPC")
        .update({ uppselt: !currentUppselt })
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setRows((prev) => prev.map((r) => (r.id === id ? (data as GamingPCRow) : r)));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
    const ok = typeof window !== "undefined" ? window.confirm("Eyða þessari vél?") : false;
    if (!ok) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("GamingPC")
        .delete()
        .eq("id", id);
      if (!error) {
        setRows((prev) => prev.filter((r) => r.id !== id));
      } else {
        setError(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setDeletingId(null);
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

  if (!isAdmin) return null;

  return (
    <main id="main" className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Vörur</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">{rows.length} vörur</div>
          </div>
          {error ? <div className="px-4 py-2 text-sm text-red-600 border-b border-red-200 bg-red-50">{error}</div> : null}

          <div className="overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-12">Nafn</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-12">Verð</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Motherboard</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Power Supply</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">CPU</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">CPU Cooler</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">RAM</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Storage</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">GPU</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-40">Aðgerðir</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-2 py-3 align-top w-14">
                    <input value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Nafn" className="border border-gray-300 rounded px-2 py-1 text-xs w-16" />
                  </td>
                  <td className="px-2 py-3 align-top w-12">
                    <input value={form.verd} onChange={(e) => onChange("verd", e.target.value)} placeholder="Verð" className="border border-gray-300 rounded px-2 py-1 text-xs w-12" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={form.motherboard} onChange={(e) => onChange("motherboard", e.target.value)} placeholder="Motherboard" className="border border-gray-300 rounded px-2 py-1 text-xs w-20" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={form.powersupply} onChange={(e) => onChange("powersupply", e.target.value)} placeholder="Power" className="border border-gray-300 rounded px-2 py-1 text-xs w-20" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={form.cpu} onChange={(e) => onChange("cpu", e.target.value)} placeholder="CPU" className="border border-gray-300 rounded px-2 py-1 text-xs w-20" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={form.cpucooler} onChange={(e) => onChange("cpucooler", e.target.value)} placeholder="Cooler" className="border border-gray-300 rounded px-2 py-1 text-xs w-20" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={form.ram} onChange={(e) => onChange("ram", e.target.value)} placeholder="RAM" className="border border-gray-300 rounded px-2 py-1 text-xs w-16" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={form.storage} onChange={(e) => onChange("storage", e.target.value)} placeholder="Storage" className="border border-gray-300 rounded px-2 py-1 text-xs w-20" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={form.gpu} onChange={(e) => onChange("gpu", e.target.value)} placeholder="GPU" className="border border-gray-300 rounded px-2 py-1 text-xs w-20" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <button
                      type="button"
                      disabled={creating}
                      onClick={handleCreate}
                      className="inline-flex items-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50"
                    >
                      Bæta við
                    </button>
                  </td>
                </tr>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.name}>{r.name}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.verd}>{r.verd}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.motherboard}>{r.motherboard}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.powersupply}>{r.powersupply}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.cpu}>{r.cpu}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.cpucooler}>{r.cpucooler}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.ram}>{r.ram}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.storage}>{r.storage}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800 w-16">
                      <div className="truncate max-w-[4rem] leading-6" title={r.gpu}>{r.gpu}</div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="grid grid-cols-4 gap-2 w-65">
                        <button
                          type="button"
                          onClick={() => handleToggleFalid(r.id, r.falid)}
                          disabled={updatingId === r.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-blue-500 text-blue-600 hover:bg-blue-50 text-xs disabled:opacity-50 w-full"
                        >
                          {r.falid ? "Sýna" : "Fela"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUppselt(r.id, r.uppselt)}
                          disabled={updatingId === r.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-blue-500 text-blue-600 hover:bg-blue-50 text-xs disabled:opacity-50 w-full"
                        >
                          {r.uppselt ? "Til" : "Ekki til"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(r)}
                          disabled={updatingId === r.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50 w-full"
                        >
                          Uppfæra
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 text-xs disabled:opacity-50 w-full"
                        >
                          Eyða
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      Engar vörur fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editingId !== null && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelEdit} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Uppfæra vöru</h2>
              <button type="button" onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 text-sm">Loka</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nafn</label>
                  <input value={editForm.name} onChange={(e) => onChangeEdit("name", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Verð</label>
                  <input value={editForm.verd} onChange={(e) => onChangeEdit("verd", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Motherboard</label>
                  <textarea rows={2} value={editForm.motherboard} onChange={(e) => onChangeEdit("motherboard", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-y" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Power Supply</label>
                  <textarea rows={2} value={editForm.powersupply} onChange={(e) => onChangeEdit("powersupply", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-y" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">CPU</label>
                  <textarea rows={2} value={editForm.cpu} onChange={(e) => onChangeEdit("cpu", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-y" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">CPU Cooler</label>
                  <textarea rows={2} value={editForm.cpucooler} onChange={(e) => onChangeEdit("cpucooler", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-y" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">RAM</label>
                  <textarea rows={2} value={editForm.ram} onChange={(e) => onChangeEdit("ram", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-y" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Storage</label>
                  <textarea rows={2} value={editForm.storage} onChange={(e) => onChangeEdit("storage", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-y" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">GPU</label>
                <textarea rows={2} value={editForm.gpu} onChange={(e) => onChangeEdit("gpu", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-y" />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button type="button" onClick={handleCancelEdit} className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Hætta við</button>
              <button
                type="button"
                onClick={() => editingId !== null ? handleUpdate(editingId) : undefined}
                disabled={updatingId === editingId}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-sm disabled:opacity-50"
              >
                Uppfæra
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}


