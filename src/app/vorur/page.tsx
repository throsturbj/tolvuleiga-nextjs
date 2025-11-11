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

interface ScreenRow {
  id: string;
  framleidandi: string;
  skjastaerd: string;
  upplausn: string;
  skjataekni: string;
  endurnyjunartidni: string;
  gamingPC_id: number;
  falid?: boolean | null;
  uppselt?: boolean | null;
  created_at?: string | null;
}

type NewScreenRow = Omit<ScreenRow, "id" | "created_at">;

interface KeyboardRow {
  id: string;
  nafn: string;
  framleidandi: string;
  staerd: string;
  tengimoguleiki: string;
  created_at?: string | null;
}

type NewKeyboardRow = Omit<KeyboardRow, "id" | "created_at">;

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

  // Screens state
  const [activeTab, setActiveTab] = useState<"gaming" | "screens" | "keyboards">("gaming");
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [screensLoading, setScreensLoading] = useState<boolean>(false);
  const [screenCreating, setScreenCreating] = useState<boolean>(false);
  const [screenDeletingId, setScreenDeletingId] = useState<string | null>(null);
  const [screenUpdatingId, setScreenUpdatingId] = useState<string | null>(null);
  const [screenEditingId, setScreenEditingId] = useState<string | null>(null);
  const [screenForm, setScreenForm] = useState<NewScreenRow>({
    framleidandi: "",
    skjastaerd: "",
    upplausn: "",
    skjataekni: "",
    endurnyjunartidni: "",
    gamingPC_id: 0,
  });
  const [screenEditForm, setScreenEditForm] = useState<NewScreenRow | null>(null);
  const [screenFormPcIds, setScreenFormPcIds] = useState<number[]>([]);
  const [screenEditPcIds, setScreenEditPcIds] = useState<number[]>([]);
  const [screenIdToPcIds, setScreenIdToPcIds] = useState<Record<string, number[]>>({});
  const [createPcOpen, setCreatePcOpen] = useState<boolean>(false);
  const [editPcOpen, setEditPcOpen] = useState<boolean>(false);
  const [createPcMenuPos, setCreatePcMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editPcMenuPos, setEditPcMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Keyboards state
  const [keyboards, setKeyboards] = useState<KeyboardRow[]>([]);
  const [keyboardsLoading, setKeyboardsLoading] = useState<boolean>(false);
  const [keyboardCreating, setKeyboardCreating] = useState<boolean>(false);
  const [keyboardDeletingId, setKeyboardDeletingId] = useState<string | null>(null);
  const [keyboardUpdatingId, setKeyboardUpdatingId] = useState<string | null>(null);
  const [keyboardEditingId, setKeyboardEditingId] = useState<string | null>(null);
  const [keyboardForm, setKeyboardForm] = useState<NewKeyboardRow>({ nafn: "", framleidandi: "", staerd: "", tengimoguleiki: "" });
  const [keyboardEditForm, setKeyboardEditForm] = useState<NewKeyboardRow | null>(null);
  const [keyboardIdToPcIds, setKeyboardIdToPcIds] = useState<Record<string, number[]>>({});
  const [keyboardFormPcIds, setKeyboardFormPcIds] = useState<number[]>([]);
  const [keyboardEditPcIds, setKeyboardEditPcIds] = useState<number[]>([]);
  const [createKbOpen, setCreateKbOpen] = useState<boolean>(false);
  const [editKbOpen, setEditKbOpen] = useState<boolean>(false);
  const [createKbMenuPos, setCreateKbMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editKbMenuPos, setEditKbMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

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

  // Load screens when switching to screens tab
  useEffect(() => {
    const fetchScreens = async () => {
      if (activeTab !== "screens") return;
      if (!session?.user || !isAdmin) return;
      setScreensLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("screens")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          setError(error.message);
          setScreens([]);
        } else {
          setScreens((data as ScreenRow[]) ?? []);
          // Fetch relations for all loaded screens
          const ids = ((data as ScreenRow[]) ?? []).map((s) => s.id);
          if (ids.length > 0) {
            const { data: links } = await supabase
              .from("screen_gamingpcs")
              .select("screen_id,gamingpc_id")
              .in("screen_id", ids);
            const map: Record<string, number[]> = {};
            (links || []).forEach((l: { screen_id: string; gamingpc_id: number }) => {
              if (!map[l.screen_id]) map[l.screen_id] = [];
              map[l.screen_id].push(l.gamingpc_id);
            });
            setScreenIdToPcIds(map);
          } else {
            setScreenIdToPcIds({});
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setScreens([]);
      } finally {
        setScreensLoading(false);
      }
    };
    fetchScreens();
  }, [activeTab, session?.user, isAdmin]);

  // Load keyboards when switching to keyboards tab
  useEffect(() => {
    const fetchKeyboards = async () => {
      if (activeTab !== "keyboards") return;
      if (!session?.user || !isAdmin) return;
      setKeyboardsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("keyboards")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          setError(error.message);
          setKeyboards([]);
        } else {
          const list = (data as KeyboardRow[]) ?? [];
          setKeyboards(list);
          const ids = list.map((k) => k.id);
          if (ids.length > 0) {
            const { data: links } = await supabase
              .from("keyboard_gamingpcs")
              .select("keyboard_id,gamingpc_id")
              .in("keyboard_id", ids);
            const map: Record<string, number[]> = {};
            (links || []).forEach((l: { keyboard_id: string; gamingpc_id: number }) => {
              if (!map[l.keyboard_id]) map[l.keyboard_id] = [];
              map[l.keyboard_id].push(l.gamingpc_id);
            });
            setKeyboardIdToPcIds(map);
          } else {
            setKeyboardIdToPcIds({});
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setKeyboards([]);
      } finally {
        setKeyboardsLoading(false);
      }
    };
    fetchKeyboards();
  }, [activeTab, session?.user, isAdmin]);

  const onChange = (field: keyof NewRow, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const onChangeEdit = (field: keyof NewRow, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };
  const onChangeScreen = (field: keyof NewScreenRow, value: string) => {
    setScreenForm((prev) => ({
      ...prev,
      [field]: field === "gamingPC_id" ? Number(value.replace(/\D+/g, "")) || 0 : value,
    }));
  };
  const onChangeScreenEdit = (field: keyof NewScreenRow, value: string) => {
    setScreenEditForm((prev) =>
      prev
        ? {
            ...prev,
            [field]: field === "gamingPC_id" ? Number(value.replace(/\D+/g, "")) || 0 : value,
          }
        : prev
    );
  };
  const onChangeScreenPcMulti = (values: string[]) => {
    const ids = values.map((v) => Number(v)).filter((n) => Number.isFinite(n)) as number[];
    setScreenFormPcIds(ids);
  };
  const onChangeScreenEditPcMulti = (values: string[]) => {
    const ids = values.map((v) => Number(v)).filter((n) => Number.isFinite(n)) as number[];
    setScreenEditPcIds(ids);
  };
  const toggleCreatePc = (pcId: number) => {
    setScreenFormPcIds((prev) => (prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId]));
  };
  const toggleEditPc = (pcId: number) => {
    setScreenEditPcIds((prev) => (prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId]));
  };
  const openCreatePcMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setCreatePcMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setCreatePcOpen(true);
  };
  const openEditPcMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setEditPcMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setEditPcOpen(true);
  };
  useEffect(() => {
    if (!createPcOpen && !editPcOpen && !createKbOpen && !editKbOpen) return;
    const handler = () => {
      setCreatePcOpen(false);
      setEditPcOpen(false);
      setCreateKbOpen(false);
      setEditKbOpen(false);
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler, true);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler, true);
    };
  }, [createPcOpen, editPcOpen, createKbOpen, editKbOpen]);

  const onChangeKeyboard = (field: keyof NewKeyboardRow, value: string) => {
    setKeyboardForm((prev) => ({ ...prev, [field]: value }));
  };
  const onChangeKeyboardEdit = (field: keyof NewKeyboardRow, value: string) => {
    setKeyboardEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };
  const toggleCreateKbPc = (pcId: number) => {
    setKeyboardFormPcIds((prev) => (prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId]));
  };
  const toggleEditKbPc = (pcId: number) => {
    setKeyboardEditPcIds((prev) => (prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId]));
  };
  const openCreateKbMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setCreateKbMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setCreateKbOpen(true);
  };
  const openEditKbMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setEditKbMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setEditKbOpen(true);
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
  const validateScreen = (r: NewScreenRow): string[] => {
    const errs: string[] = [];
    if (!r.framleidandi.trim()) errs.push("Framleiðandi vantar");
    if (!r.skjastaerd.trim()) errs.push("Skjástærð vantar");
    if (!r.upplausn.trim()) errs.push("Upplausn vantar");
    if (!r.skjataekni.trim()) errs.push("Skjátækni vantar");
    if (!r.endurnyjunartidni.trim()) errs.push("Endurnýjunartíðni vantar");
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

  const handleCreateScreen = async () => {
    if (!isAdmin) return;
    const errs = validateScreen(screenForm);
    if (screenFormPcIds.length === 0) errs.push("Veldu að minnsta kosti eina tölvu");
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setScreenCreating(true);
    setError(null);
    try {
      const insertPayload = {
        framleidandi: screenForm.framleidandi,
        skjastaerd: screenForm.skjastaerd,
        upplausn: screenForm.upplausn,
        skjataekni: screenForm.skjataekni,
        endurnyjunartidni: screenForm.endurnyjunartidni,
      };
      const { data, error } = await supabase.from("screens").insert([insertPayload]).select("*").single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const created = data as ScreenRow;
        // Insert junction rows
        if (screenFormPcIds.length > 0) {
          const rowsToInsert = screenFormPcIds.map((pcId) => ({ screen_id: created.id, gamingpc_id: pcId }));
          await supabase.from("screen_gamingpcs").insert(rowsToInsert);
        }
        setScreens((prev) => [created, ...prev]);
        setScreenIdToPcIds((prev) => ({ ...prev, [created.id]: [...screenFormPcIds] }));
        setScreenForm({
          framleidandi: "",
          skjastaerd: "",
          upplausn: "",
          skjataekni: "",
          endurnyjunartidni: "",
          gamingPC_id: 0,
        });
        setScreenFormPcIds([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setScreenCreating(false);
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

  const handleStartScreenEdit = (row: ScreenRow) => {
    if (!isAdmin) return;
    setScreenEditingId(row.id);
    setScreenEditForm({
      framleidandi: row.framleidandi,
      skjastaerd: row.skjastaerd,
      upplausn: row.upplausn,
      skjataekni: row.skjataekni,
      endurnyjunartidni: row.endurnyjunartidni,
      gamingPC_id: row.gamingPC_id,
    });
    const selected = screenIdToPcIds[row.id] || [];
    setScreenEditPcIds(selected);
  };

  const handleCancelScreenEdit = () => {
    setScreenEditingId(null);
    setScreenEditForm(null);
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

  const handleUpdateScreen = async (id: string) => {
    if (!isAdmin || !screenEditForm) return;
    const errs = validateScreen(screenEditForm);
    if ((screenEditPcIds || []).length === 0) errs.push("Veldu að minnsta kosti eina tölvu");
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setScreenUpdatingId(id);
    try {
      const updatePayload = {
        framleidandi: screenEditForm.framleidandi,
        skjastaerd: screenEditForm.skjastaerd,
        upplausn: screenEditForm.upplausn,
        skjataekni: screenEditForm.skjataekni,
        endurnyjunartidni: screenEditForm.endurnyjunartidni,
      };
      const { data, error } = await supabase
        .from("screens")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const updated = data as ScreenRow;
        setScreens((prev) => prev.map((r) => (r.id === id ? updated : r)));
        // Reconcile junction links
        const existing = screenIdToPcIds[id] || [];
        const next = screenEditPcIds || [];
        const toAdd = next.filter((x) => !existing.includes(x));
        const toRemove = existing.filter((x) => !next.includes(x));
        if (toRemove.length > 0) {
          await supabase.from("screen_gamingpcs").delete().eq("screen_id", id).in("gamingpc_id", toRemove);
        }
        if (toAdd.length > 0) {
          const rowsToInsert = toAdd.map((pcId) => ({ screen_id: id, gamingpc_id: pcId }));
          await supabase.from("screen_gamingpcs").insert(rowsToInsert);
        }
        setScreenIdToPcIds((prev) => ({ ...prev, [id]: [...next] }));
        setScreenEditingId(null);
        setScreenEditForm(null);
        setScreenEditPcIds([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setScreenUpdatingId(null);
    }
  };

  // Keyboards CRUD
  const validateKeyboard = (r: NewKeyboardRow): string[] => {
    const errs: string[] = [];
    if (!r.nafn.trim()) errs.push("Nafn vantar");
    if (!r.framleidandi.trim()) errs.push("Framleiðandi vantar");
    if (!r.staerd.trim()) errs.push("Stærð vantar");
    if (!r.tengimoguleiki.trim()) errs.push("Tengimöguleiki vantar");
    return errs;
  };

  const handleCreateKeyboard = async () => {
    if (!isAdmin) return;
    const errs = validateKeyboard(keyboardForm);
    if (keyboardFormPcIds.length === 0) errs.push("Veldu að minnsta kosti eina tölvu");
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setKeyboardCreating(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("keyboards").insert([keyboardForm]).select("*").single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const created = data as KeyboardRow;
        if (keyboardFormPcIds.length > 0) {
          const rowsToInsert = keyboardFormPcIds.map((pcId) => ({ keyboard_id: created.id, gamingpc_id: pcId }));
          await supabase.from("keyboard_gamingpcs").insert(rowsToInsert);
        }
        setKeyboards((prev) => [created, ...prev]);
        setKeyboardIdToPcIds((prev) => ({ ...prev, [created.id]: [...keyboardFormPcIds] }));
        setKeyboardForm({ nafn: "", framleidandi: "", staerd: "", tengimoguleiki: "" });
        setKeyboardFormPcIds([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setKeyboardCreating(false);
    }
  };

  const handleStartKeyboardEdit = (row: KeyboardRow) => {
    if (!isAdmin) return;
    setKeyboardEditingId(row.id);
    setKeyboardEditForm({ nafn: row.nafn, framleidandi: row.framleidandi, staerd: row.staerd, tengimoguleiki: row.tengimoguleiki });
    const selected = keyboardIdToPcIds[row.id] || [];
    setKeyboardEditPcIds(selected);
  };

  const handleCancelKeyboardEdit = () => {
    setKeyboardEditingId(null);
    setKeyboardEditForm(null);
  };

  const handleUpdateKeyboard = async (id: string) => {
    if (!isAdmin || !keyboardEditForm) return;
    const errs = validateKeyboard(keyboardEditForm);
    if ((keyboardEditPcIds || []).length === 0) errs.push("Veldu að minnsta kosti eina tölvu");
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setKeyboardUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("keyboards")
        .update(keyboardEditForm)
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const updated = data as KeyboardRow;
        setKeyboards((prev) => prev.map((k) => (k.id === id ? updated : k)));
        const existing = keyboardIdToPcIds[id] || [];
        const next = keyboardEditPcIds || [];
        const toAdd = next.filter((x) => !existing.includes(x));
        const toRemove = existing.filter((x) => !next.includes(x));
        if (toRemove.length > 0) {
          await supabase.from("keyboard_gamingpcs").delete().eq("keyboard_id", id).in("gamingpc_id", toRemove);
        }
        if (toAdd.length > 0) {
          const rowsToInsert = toAdd.map((pcId) => ({ keyboard_id: id, gamingpc_id: pcId }));
          await supabase.from("keyboard_gamingpcs").insert(rowsToInsert);
        }
        setKeyboardIdToPcIds((prev) => ({ ...prev, [id]: [...next] }));
        setKeyboardEditingId(null);
        setKeyboardEditForm(null);
        setKeyboardEditPcIds([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setKeyboardUpdatingId(null);
    }
  };

  const handleDeleteKeyboard = async (id: string) => {
    if (!isAdmin) return;
    const ok = typeof window !== "undefined" ? window.confirm("Eyða þessu lyklaborði?") : false;
    if (!ok) return;
    setKeyboardDeletingId(id);
    try {
      const { error } = await supabase.from("keyboards").delete().eq("id", id);
      if (!error) {
        setKeyboards((prev) => prev.filter((k) => k.id !== id));
        setKeyboardIdToPcIds((prev) => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      } else {
        setError(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setKeyboardDeletingId(null);
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

  const handleScreenToggleFalid = async (id: string, currentFalid: boolean | null | undefined) => {
    if (!isAdmin) return;
    setScreenUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("screens")
        .update({ falid: !currentFalid })
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setScreens((prev) => prev.map((r) => (r.id === id ? (data as ScreenRow) : r)));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setScreenUpdatingId(null);
    }
  };

  const handleScreenToggleUppselt = async (id: string, currentUppselt: boolean | null | undefined) => {
    if (!isAdmin) return;
    setScreenUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("screens")
        .update({ uppselt: !currentUppselt })
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setScreens((prev) => prev.map((r) => (r.id === id ? (data as ScreenRow) : r)));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setScreenUpdatingId(null);
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

  const handleDeleteScreen = async (id: string) => {
    if (!isAdmin) return;
    const ok = typeof window !== "undefined" ? window.confirm("Eyða þessum skjá?") : false;
    if (!ok) return;
    setScreenDeletingId(id);
    try {
      const { error } = await supabase.from("screens").delete().eq("id", id);
      if (!error) {
        setScreens((prev) => prev.filter((r) => r.id !== id));
      } else {
        setError(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setScreenDeletingId(null);
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
          <div className="px-3 pt-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("gaming")}
                className={`px-3 py-1.5 text-sm rounded-t ${activeTab === "gaming" ? "bg-white border border-b-transparent border-gray-200 font-medium" : "text-gray-600 hover:text-gray-800"}`}
                aria-current={activeTab === "gaming" ? "page" : undefined}
              >
                Gaming PCs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("screens")}
                className={`px-3 py-1.5 text-sm rounded-t ${activeTab === "screens" ? "bg-white border border-b-transparent border-gray-200 font-medium" : "text-gray-600 hover:text-gray-800"}`}
                aria-current={activeTab === "screens" ? "page" : undefined}
              >
                Computer Screens
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("keyboards")}
                className={`px-3 py-1.5 text-sm rounded-t ${activeTab === "keyboards" ? "bg-white border border-b-transparent border-gray-200 font-medium" : "text-gray-600 hover:text-gray-800"}`}
                aria-current={activeTab === "keyboards" ? "page" : undefined}
              >
                Keyboards
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600">
                {activeTab === "gaming"
                  ? (loading ? "Sæki gögn…" : `${rows.length} vörur`)
                  : activeTab === "screens"
                    ? (screensLoading ? "Sæki gögn…" : `${screens.length} skjáir`)
                    : (keyboardsLoading ? "Sæki gögn…" : `${keyboards.length} lyklaborð`)}
              </div>
            </div>
          </div>
          {error ? <div className="px-4 py-2 text-sm text-red-600 border-b border-red-200 bg-red-50">{error}</div> : null}

          <div className="overflow-auto">
            {activeTab === "gaming" ? (
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
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-64">Aðgerðir</th>
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
                      <div className="grid grid-cols-4 gap-2 w-66">
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
            ) : activeTab === "screens" ? (
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Framleiðandi</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Skjástærð</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Upplausn</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Skjátækni</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Endurnýjunartíðni</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">GamingPC</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-70">Aðgerðir</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-2 py-3 align-top">
                    <input value={screenForm.framleidandi} onChange={(e) => onChangeScreen("framleidandi", e.target.value)} placeholder="Framleiðandi" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={screenForm.skjastaerd} onChange={(e) => onChangeScreen("skjastaerd", e.target.value)} placeholder='t.d. 27"' className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={screenForm.upplausn} onChange={(e) => onChangeScreen("upplausn", e.target.value)} placeholder="t.d. 2560×1440" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={screenForm.skjataekni} onChange={(e) => onChangeScreen("skjataekni", e.target.value)} placeholder="t.d. IPS" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={screenForm.endurnyjunartidni} onChange={(e) => onChangeScreen("endurnyjunartidni", e.target.value)} placeholder="t.d. 144Hz" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top w-16">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (createPcOpen) {
                            setCreatePcOpen(false);
                          } else {
                            openCreatePcMenu(e.currentTarget as HTMLElement);
                          }
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs"
                      >
                        {screenFormPcIds.length > 0
                          ? `${screenFormPcIds
                              .map((id) => rows.find((p) => p.id === id)?.name || `#${id}`)
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(", ")}${screenFormPcIds.length > 2 ? ` +${screenFormPcIds.length - 2}` : ""}`
                          : "Veldu tölvur"}
                        <svg className="ml-2 h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                      </button>
                      {createPcOpen && createPcMenuPos ? (
                        <div
                          className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                          style={{ top: createPcMenuPos.top, left: createPcMenuPos.left, minWidth: createPcMenuPos.width, width: Math.max(createPcMenuPos.width, 224) }}
                        >
                          <div className="max-h-60 overflow-auto p-1">
                            {rows.map((pc) => {
                              const checked = screenFormPcIds.includes(pc.id);
                              return (
                                <label key={pc.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-xs">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCreatePc(pc.id)}
                                    className="h-3 w-3"
                                  />
                                  <span className="truncate">{pc.name}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                            <button type="button" onClick={() => setScreenFormPcIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                            <button type="button" onClick={() => setCreatePcOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <button
                      type="button"
                      disabled={screenCreating}
                      onClick={handleCreateScreen}
                      className="inline-flex items-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50"
                    >
                      Bæta við
                    </button>
                  </td>
                </tr>
                {screens.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={r.framleidandi}>{r.framleidandi}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={r.skjastaerd}>{r.skjastaerd}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={r.upplausn}>{r.upplausn}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={r.skjataekni}>{r.skjataekni}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={r.endurnyjunartidni}>{r.endurnyjunartidni}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6">
                        {(() => {
                          const ids = screenIdToPcIds[r.id] || [];
                          if (ids.length === 0) return "—";
                          const names = ids
                            .map((id) => {
                              const pc = rows.find((p) => p.id === id);
                              return pc ? pc.name : `#${id}`;
                            })
                            .filter(Boolean);
                          return names.join(", ");
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="grid grid-cols-4 gap-2 w-64">
                        <button
                          type="button"
                          onClick={() => handleStartScreenEdit(r)}
                          disabled={screenUpdatingId === r.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50 w-full"
                        >
                          Uppfæra
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteScreen(r.id)}
                          disabled={screenDeletingId === r.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 text-xs disabled:opacity-50 w-full"
                        >
                          Eyða
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!screensLoading && screens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      Engir skjáir fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            ) : (
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">Nafn</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">Framleiðandi</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Stærð</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-28">Tengimöguleiki</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">GamingPC</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-66">Aðgerðir</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-2 py-3 align-top">
                    <input value={keyboardForm.nafn} onChange={(e) => onChangeKeyboard("nafn", e.target.value)} placeholder="Heiti" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={keyboardForm.framleidandi} onChange={(e) => onChangeKeyboard("framleidandi", e.target.value)} placeholder="Framleiðandi" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={keyboardForm.staerd} onChange={(e) => onChangeKeyboard("staerd", e.target.value)} placeholder="t.d. 60%" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={keyboardForm.tengimoguleiki} onChange={(e) => onChangeKeyboard("tengimoguleiki", e.target.value)} placeholder="USB / Bluetooth" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (createKbOpen) {
                            setCreateKbOpen(false);
                          } else {
                            openCreateKbMenu(e.currentTarget as HTMLElement);
                          }
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs"
                      >
                        {keyboardFormPcIds.length > 0
                          ? `${keyboardFormPcIds
                              .map((id) => rows.find((p) => p.id === id)?.name || `#${id}`)
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(", ")}${keyboardFormPcIds.length > 2 ? ` +${keyboardFormPcIds.length - 2}` : ""}`
                          : "Veldu tölvur"}
                        <svg className="ml-2 h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                      </button>
                      {createKbOpen && createKbMenuPos ? (
                        <div
                          className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                          style={{ top: createKbMenuPos.top, left: createKbMenuPos.left, minWidth: createKbMenuPos.width, width: Math.max(createKbMenuPos.width, 224) }}
                        >
                          <div className="max-h-60 overflow-auto p-1">
                            {rows.map((pc) => {
                              const checked = keyboardFormPcIds.includes(pc.id);
                              return (
                                <label key={pc.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-xs">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCreateKbPc(pc.id)}
                                    className="h-3 w-3"
                                  />
                                  <span className="truncate">{pc.name}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                            <button type="button" onClick={() => setKeyboardFormPcIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                            <button type="button" onClick={() => setCreateKbOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <button
                      type="button"
                      disabled={keyboardCreating}
                      onClick={handleCreateKeyboard}
                      className="inline-flex items-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50"
                    >
                      Bæta við
                    </button>
                  </td>
                </tr>
                {keyboards.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={k.nafn}>{k.nafn}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={k.framleidandi}>{k.framleidandi}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={k.staerd}>{k.staerd}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={k.tengimoguleiki}>{k.tengimoguleiki}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6">
                        {(() => {
                          const ids = keyboardIdToPcIds[k.id] || [];
                          if (ids.length === 0) return "—";
                          const names = ids
                            .map((id) => {
                              const pc = rows.find((p) => p.id === id);
                              return pc ? pc.name : `#${id}`;
                            })
                            .filter(Boolean);
                          return names.join(", ");
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="grid grid-cols-3 gap-2 w-66">
                        <button
                          type="button"
                          onClick={() => handleStartKeyboardEdit(k)}
                          disabled={keyboardUpdatingId === k.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50 w-full"
                        >
                          Uppfæra
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteKeyboard(k.id)}
                          disabled={keyboardDeletingId === k.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 text-xs disabled:opacity-50 w-full"
                        >
                          Eyða
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!keyboardsLoading && keyboards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      Engin lyklaborð fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            )}
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
      {screenEditingId !== null && screenEditForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelScreenEdit} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Uppfæra skjá</h2>
              <button type="button" onClick={handleCancelScreenEdit} className="text-gray-500 hover:text-gray-700 text-sm">Loka</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Framleiðandi</label>
                  <input value={screenEditForm.framleidandi} onChange={(e) => onChangeScreenEdit("framleidandi", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Skjástærð</label>
                  <input value={screenEditForm.skjastaerd} onChange={(e) => onChangeScreenEdit("skjastaerd", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Upplausn</label>
                  <input value={screenEditForm.upplausn} onChange={(e) => onChangeScreenEdit("upplausn", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Skjátækni</label>
                  <input value={screenEditForm.skjataekni} onChange={(e) => onChangeScreenEdit("skjataekni", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Endurnýjunartíðni</label>
                  <input value={screenEditForm.endurnyjunartidni} onChange={(e) => onChangeScreenEdit("endurnyjunartidni", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div className="relative">
                  <label className="block text-xs text-gray-600 mb-1">Tengdar tölvur</label>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (editPcOpen) {
                        setEditPcOpen(false);
                      } else {
                        openEditPcMenu(e.currentTarget as HTMLElement);
                      }
                    }}
                    className="inline-flex items-center w-full justify-between px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm"
                  >
                    <span className="truncate">
                      {screenEditPcIds.length > 0
                        ? screenEditPcIds
                            .map((id) => rows.find((p) => p.id === id)?.name || `#${id}`)
                            .filter(Boolean)
                            .slice(0, 3)
                            .join(", ") + (screenEditPcIds.length > 3 ? ` +${screenEditPcIds.length - 3}` : "")
                        : "Veldu tölvur"}
                    </span>
                    <svg className="ml-2 h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                  </button>
                  {editPcOpen && editPcMenuPos ? (
                    <div
                      className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                      style={{ top: editPcMenuPos.top, left: editPcMenuPos.left, minWidth: editPcMenuPos.width, width: editPcMenuPos.width }}
                    >
                      <div className="max-h-60 overflow-auto p-1">
                        {rows.map((pc) => {
                          const checked = screenEditPcIds.includes(pc.id);
                          return (
                            <label key={pc.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEditPc(pc.id)}
                                className="h-3 w-3"
                              />
                              <span className="truncate">{pc.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                        <button type="button" onClick={() => setScreenEditPcIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                        <button type="button" onClick={() => setEditPcOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button type="button" onClick={handleCancelScreenEdit} className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Hætta við</button>
              <button
                type="button"
                onClick={() => screenEditingId !== null ? handleUpdateScreen(screenEditingId) : undefined}
                disabled={screenUpdatingId === screenEditingId}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-sm disabled:opacity-50"
              >
                Uppfæra
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {keyboardEditingId !== null && keyboardEditForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelKeyboardEdit} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Uppfæra lyklaborð</h2>
              <button type="button" onClick={handleCancelKeyboardEdit} className="text-gray-500 hover:text-gray-700 text-sm">Loka</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Heiti</label>
                  <input value={keyboardEditForm.nafn} onChange={(e) => onChangeKeyboardEdit("nafn", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Framleiðandi</label>
                  <input value={keyboardEditForm.framleidandi} onChange={(e) => onChangeKeyboardEdit("framleidandi", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Stærð</label>
                  <input value={keyboardEditForm.staerd} onChange={(e) => onChangeKeyboardEdit("staerd", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tengimöguleiki</label>
                  <input value={keyboardEditForm.tengimoguleiki} onChange={(e) => onChangeKeyboardEdit("tengimoguleiki", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">Tengdar tölvur</label>
                <button
                  type="button"
                  onClick={(e) => {
                    if (editKbOpen) {
                      setEditKbOpen(false);
                    } else {
                      openEditKbMenu(e.currentTarget as HTMLElement);
                    }
                  }}
                  className="inline-flex items-center w-full justify-between px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm"
                >
                  <span className="truncate">
                    {keyboardEditPcIds.length > 0
                      ? keyboardEditPcIds
                          .map((id) => rows.find((p) => p.id === id)?.name || `#${id}`)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(", ") + (keyboardEditPcIds.length > 3 ? ` +${keyboardEditPcIds.length - 3}` : "")
                      : "Veldu tölvur"}
                  </span>
                  <svg className="ml-2 h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                </button>
                {editKbOpen && editKbMenuPos ? (
                  <div
                    className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                    style={{ top: editKbMenuPos.top, left: editKbMenuPos.left, minWidth: editKbMenuPos.width, width: editKbMenuPos.width }}
                  >
                    <div className="max-h-60 overflow-auto p-1">
                      {rows.map((pc) => {
                        const checked = keyboardEditPcIds.includes(pc.id);
                        return (
                          <label key={pc.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEditKbPc(pc.id)}
                              className="h-3 w-3"
                            />
                            <span className="truncate">{pc.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                      <button type="button" onClick={() => setKeyboardEditPcIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                      <button type="button" onClick={() => setEditKbOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button type="button" onClick={handleCancelKeyboardEdit} className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Hætta við</button>
              <button
                type="button"
                onClick={() => keyboardEditingId !== null ? handleUpdateKeyboard(keyboardEditingId) : undefined}
                disabled={keyboardUpdatingId === keyboardEditingId}
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


