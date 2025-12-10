"use client";

import { useEffect, useRef, useState } from "react";
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
  verd?: string;
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
  verd?: string;
  created_at?: string | null;
}

type NewKeyboardRow = Omit<KeyboardRow, "id" | "created_at">;

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
}

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
  const [activeTab, setActiveTab] = useState<"gaming" | "screens" | "keyboards" | "mouses" | "consoles">("gaming");
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
    verd: "",
    gamingPC_id: 0,
  });
  const [screenEditForm, setScreenEditForm] = useState<NewScreenRow | null>(null);
  const [screenFormPcIds, setScreenFormPcIds] = useState<number[]>([]);
  const [screenEditPcIds, setScreenEditPcIds] = useState<number[]>([]);
  const [screenIdToPcIds, setScreenIdToPcIds] = useState<Record<string, number[]>>({});
  // Screen <-> Console linking
  const [screenFormConsoleIds, setScreenFormConsoleIds] = useState<string[]>([]);
  const [screenEditConsoleIds, setScreenEditConsoleIds] = useState<string[]>([]);
  const [screenIdToConsoleIds, setScreenIdToConsoleIds] = useState<Record<string, string[]>>({});
  const [createPcOpen, setCreatePcOpen] = useState<boolean>(false);
  const [editPcOpen, setEditPcOpen] = useState<boolean>(false);
  const [createPcMenuPos, setCreatePcMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editPcMenuPos, setEditPcMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [createConsoleOpen, setCreateConsoleOpen] = useState<boolean>(false);
  const [editConsoleOpen, setEditConsoleOpen] = useState<boolean>(false);
  const [createConsoleMenuPos, setCreateConsoleMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editConsoleMenuPos, setEditConsoleMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Keyboards state
  const [keyboards, setKeyboards] = useState<KeyboardRow[]>([]);
  const [keyboardsLoading, setKeyboardsLoading] = useState<boolean>(false);
  const [keyboardCreating, setKeyboardCreating] = useState<boolean>(false);
  const [keyboardDeletingId, setKeyboardDeletingId] = useState<string | null>(null);
  const [keyboardUpdatingId, setKeyboardUpdatingId] = useState<string | null>(null);
  const [keyboardEditingId, setKeyboardEditingId] = useState<string | null>(null);
  const [keyboardForm, setKeyboardForm] = useState<NewKeyboardRow>({ nafn: "", framleidandi: "", staerd: "", tengimoguleiki: "", verd: "" });
  const [keyboardEditForm, setKeyboardEditForm] = useState<NewKeyboardRow | null>(null);
  const [keyboardIdToPcIds, setKeyboardIdToPcIds] = useState<Record<string, number[]>>({});
  const [keyboardFormPcIds, setKeyboardFormPcIds] = useState<number[]>([]);
  const [keyboardEditPcIds, setKeyboardEditPcIds] = useState<number[]>([]);
  const [createKbOpen, setCreateKbOpen] = useState<boolean>(false);
  const [editKbOpen, setEditKbOpen] = useState<boolean>(false);
  const [createKbMenuPos, setCreateKbMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editKbMenuPos, setEditKbMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Mouses state
  interface MouseRow {
    id: string | number;
    nafn: string;
    framleidandi: string;
    fjolditakk: string;
    toltakka: string;
    tengimoguleiki: string;
    verd?: string;
    created_at?: string | null;
  }
  type NewMouseRow = Omit<MouseRow, "id" | "created_at">;
  const [mouses, setMouses] = useState<MouseRow[]>([]);
  const [mousesLoading, setMousesLoading] = useState<boolean>(false);
  const [mouseCreating, setMouseCreating] = useState<boolean>(false);
  const [mouseDeletingId, setMouseDeletingId] = useState<string | number | null>(null);
  const [mouseUpdatingId, setMouseUpdatingId] = useState<string | number | null>(null);
  const [mouseEditingId, setMouseEditingId] = useState<string | number | null>(null);
  const [mouseForm, setMouseForm] = useState<NewMouseRow>({ nafn: "", framleidandi: "", fjolditakk: "", toltakka: "", tengimoguleiki: "", verd: "" });
  const [mouseEditForm, setMouseEditForm] = useState<NewMouseRow | null>(null);
  const [mouseIdToPcIds, setMouseIdToPcIds] = useState<Record<string, number[]>>({});
  const [mouseFormPcIds, setMouseFormPcIds] = useState<number[]>([]);
  const [mouseEditPcIds, setMouseEditPcIds] = useState<number[]>([]);
  const [createMsOpen, setCreateMsOpen] = useState<boolean>(false);
  const [editMsOpen, setEditMsOpen] = useState<boolean>(false);
  const [createMsMenuPos, setCreateMsMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editMsMenuPos, setEditMsMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Images modal state
  const [imagesEditingPcId, setImagesEditingPcId] = useState<number | null>(null);
  const [imagesEditingScreenId, setImagesEditingScreenId] = useState<string | null>(null);
  const [imagesEditingKeyboardId, setImagesEditingKeyboardId] = useState<string | null>(null);
  const [imagesEditingMouseId, setImagesEditingMouseId] = useState<string | number | null>(null);
  const [imagesEditingConsoleId, setImagesEditingConsoleId] = useState<string | null>(null);
  const [imagesItems, setImagesItems] = useState<ImageItem[]>([]);
  const [imagesBusy, setImagesBusy] = useState<boolean>(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Prices modal state
  const [pricesEditingPcId, setPricesEditingPcId] = useState<number | null>(null);
  const [pricesBusy, setPricesBusy] = useState<boolean>(false);
  const [pricesForm, setPricesForm] = useState<{
    "1month": string;
    "3month": string;
    "6month": string;
    "9month": string;
    "12month": string;
  }>({
    "1month": "",
    "3month": "",
    "6month": "",
    "9month": "",
    "12month": "",
  });

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
            // Fetch console links
            const { data: consoleLinks } = await supabase
              .from("screen_gamingconsoles")
              .select("screen_id,gamingconsole_id")
              .in("screen_id", ids);
            const cmap: Record<string, string[]> = {};
            (consoleLinks || []).forEach((l: { screen_id: string; gamingconsole_id: string }) => {
              if (!cmap[l.screen_id]) cmap[l.screen_id] = [];
              cmap[l.screen_id].push(l.gamingconsole_id);
            });
            setScreenIdToConsoleIds(cmap);
          } else {
            setScreenIdToPcIds({});
            setScreenIdToConsoleIds({});
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

  // Load mouses when switching to mouses tab
  useEffect(() => {
    const fetchMouses = async () => {
      if (activeTab !== "mouses") return;
      if (!session?.user || !isAdmin) return;
      setMousesLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("mouses")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          setError(error.message);
          setMouses([]);
        } else {
          const list = (data as MouseRow[]) ?? [];
          setMouses(list);
          const ids = list.map((m) => m.id);
          if (ids.length > 0) {
            const { data: links } = await supabase
              .from("mouse_gamingpcs")
              .select("mouse_id,gamingpc_id")
              .in("mouse_id", ids as (string | number)[]);
            const map: Record<string, number[]> = {};
            (links || []).forEach((l: { mouse_id: string | number; gamingpc_id: number }) => {
              const key = String(l.mouse_id);
              if (!map[key]) map[key] = [];
              map[key].push(l.gamingpc_id);
            });
            setMouseIdToPcIds(map);
          } else {
            setMouseIdToPcIds({});
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setMouses([]);
      } finally {
        setMousesLoading(false);
      }
    };
    fetchMouses();
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
  const toggleCreateConsole = (consoleId: string) => {
    setScreenFormConsoleIds((prev) =>
      prev.includes(consoleId) ? prev.filter((id) => id !== consoleId) : [...prev, consoleId]
    );
  };
  const toggleEditConsole = (consoleId: string) => {
    setScreenEditConsoleIds((prev) =>
      prev.includes(consoleId) ? prev.filter((id) => id !== consoleId) : [...prev, consoleId]
    );
  };
  const openCreateConsoleMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setCreateConsoleMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setCreateConsoleOpen(true);
  };
  const openEditConsoleMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setEditConsoleMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setEditConsoleOpen(true);
  };
  useEffect(() => {
    if (!createPcOpen && !editPcOpen && !createKbOpen && !editKbOpen && !createMsOpen && !editMsOpen && !createConsoleOpen && !editConsoleOpen) return;
    const handler = () => {
      setCreatePcOpen(false);
      setEditPcOpen(false);
      setCreateKbOpen(false);
      setEditKbOpen(false);
      setCreateMsOpen(false);
      setEditMsOpen(false);
      setCreateConsoleOpen(false);
      setEditConsoleOpen(false);
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler, true);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler, true);
    };
  }, [createPcOpen, editPcOpen, createKbOpen, editKbOpen, createMsOpen, editMsOpen, createConsoleOpen, editConsoleOpen]);

  const sanitizeFileName = (name: string) => {
    return name
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  };
  const padIndex = (i: number) => String(i).padStart(3, "0");
  const openImagesModal = async (pcId: number) => {
    setImagesEditingPcId(pcId);
    setImagesBusy(true);
    try {
      // Use server route to list and generate signed download URLs (works with private buckets)
      const res = await fetch("/api/images/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pcId }),
      });
      if (!res.ok) {
        setImagesItems([]);
        return;
      }
      const j = await res.json();
      const files: { name: string; path: string; signedUrl: string }[] = j?.files || [];
      if (!files || files.length === 0) {
        setImagesItems([]);
        return;
      }
      // Fetch blobs from signed URLs in parallel for preview + local re-save
      const items: ImageItem[] = await Promise.all(
        files.map(async (f, idx) => {
          const blob = await fetch(f.signedUrl).then((r) => r.blob());
          const baseName = f.name.replace(/^\d{3}-/, "");
          const file = new File([blob], baseName, { type: blob.type || "image/*" });
          const url = URL.createObjectURL(blob);
          return {
            id: `${f.path}`,
            file,
            previewUrl: url,
            originalName: baseName,
          };
        })
      );
      // Order is already by numeric prefix from the server listing; keep as-is.
      setImagesItems(items);
    } catch {
      setImagesItems([]);
    } finally {
      setImagesBusy(false);
    }
  };
  const openScreenImagesModal = async (screenId: string) => {
    setImagesEditingScreenId(screenId);
    setImagesBusy(true);
    try {
      const res = await fetch("/api/images/list-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "screens", folder: screenId }),
      });
      if (!res.ok) {
        setImagesItems([]);
        return;
      }
      const j = await res.json();
      const files: { name: string; path: string; signedUrl: string }[] = j?.files || [];
      if (!files || files.length === 0) {
        setImagesItems([]);
        return;
      }
      const items: ImageItem[] = await Promise.all(
        files.map(async (f) => {
          const blob = await fetch(f.signedUrl).then((r) => r.blob());
          const baseName = f.name.replace(/^\d{3}-/, "");
          const file = new File([blob], baseName, { type: blob.type || "image/*" });
          const url = URL.createObjectURL(blob);
          return {
            id: `${f.path}`,
            file,
            previewUrl: url,
            originalName: baseName,
          };
        })
      );
      setImagesItems(items);
    } catch {
      setImagesItems([]);
    } finally {
      setImagesBusy(false);
    }
  };

  // Prices modal handlers
  const openPricesModal = async (pcId: number) => {
    setPricesEditingPcId(pcId);
    setPricesBusy(true);
    try {
      const { data, error } = await supabase
        .from("prices")
        .select('gamingpc_id, "1month", "3month", "6month", "9month", "12month"')
        .eq("gamingpc_id", pcId)
        .limit(1);
      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0] as Record<string, string | number | null>;
        setPricesForm({
          "1month": (row["1month"] as string) || "",
          "3month": (row["3month"] as string) || "",
          "6month": (row["6month"] as string) || "",
          "9month": (row["9month"] as string) || "",
          "12month": (row["12month"] as string) || "",
        });
      } else {
        setPricesForm({
          "1month": "",
          "3month": "",
          "6month": "",
          "9month": "",
          "12month": "",
        });
      }
    } finally {
      setPricesBusy(false);
    }
  };
  const closePricesModal = () => {
    if (pricesBusy) return;
    setPricesEditingPcId(null);
  };
  const handleSavePrices = async () => {
    if (pricesEditingPcId === null) return;
    setPricesBusy(true);
    try {
      const payload = {
        gamingpc_id: pricesEditingPcId,
        "1month": pricesForm["1month"],
        "3month": pricesForm["3month"],
        "6month": pricesForm["6month"],
        "9month": pricesForm["9month"],
        "12month": pricesForm["12month"],
      };
      const { error } = await supabase
        .from("prices")
        .upsert([payload], { onConflict: "gamingpc_id" })
        .select("gamingpc_id")
        .single();
      if (!error) {
        closePricesModal();
      }
    } finally {
      setPricesBusy(false);
    }
  };
  const openKeyboardImagesModal = async (keyboardId: string) => {
    setImagesEditingKeyboardId(keyboardId);
    setImagesBusy(true);
    try {
      const res = await fetch("/api/images/list-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "keyboards", folder: keyboardId }),
      });
      if (!res.ok) {
        setImagesItems([]);
        return;
      }
      const j = await res.json();
      const files: { name: string; path: string; signedUrl: string }[] = j?.files || [];
      if (!files || files.length === 0) {
        setImagesItems([]);
        return;
      }
      const items: ImageItem[] = await Promise.all(
        files.map(async (f) => {
          const blob = await fetch(f.signedUrl).then((r) => r.blob());
          const baseName = f.name.replace(/^\d{3}-/, "");
          const file = new File([blob], baseName, { type: blob.type || "image/*" });
          const url = URL.createObjectURL(blob);
          return {
            id: `${f.path}`,
            file,
            previewUrl: url,
            originalName: baseName,
          };
        })
      );
      setImagesItems(items);
    } catch {
      setImagesItems([]);
    } finally {
      setImagesBusy(false);
    }
  };
  const openMouseImagesModal = async (mouseId: string | number) => {
    setImagesEditingMouseId(mouseId);
    setImagesBusy(true);
    try {
      const res = await fetch("/api/images/list-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "mouses", folder: String(mouseId) }),
      });
      if (!res.ok) {
        setImagesItems([]);
        return;
      }
      const j = await res.json();
      const files: { name: string; path: string; signedUrl: string }[] = j?.files || [];
      if (!files || files.length === 0) {
        setImagesItems([]);
        return;
      }
      const items: ImageItem[] = await Promise.all(
        files.map(async (f) => {
          const blob = await fetch(f.signedUrl).then((r) => r.blob());
          const baseName = f.name.replace(/^\d{3}-/, "");
          const file = new File([blob], baseName, { type: blob.type || "image/*" });
          const url = URL.createObjectURL(blob);
          return {
            id: `${f.path}`,
            file,
            previewUrl: url,
            originalName: baseName,
          };
        })
      );
      setImagesItems(items);
    } catch {
      setImagesItems([]);
    } finally {
      setImagesBusy(false);
    }
  };
  const openConsoleImagesModal = async (consoleId: string) => {
    setImagesEditingConsoleId(consoleId);
    setImagesBusy(true);
    try {
      const res = await fetch("/api/images/list-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "consoles", folder: consoleId }),
      });
      if (!res.ok) {
        setImagesItems([]);
        return;
      }
      const j = await res.json();
      const files: { name: string; path: string; signedUrl: string }[] = j?.files || [];
      if (!files || files.length === 0) {
        setImagesItems([]);
        return;
      }
      const items: ImageItem[] = await Promise.all(
        files.map(async (f) => {
          const blob = await fetch(f.signedUrl).then((r) => r.blob());
          const baseName = f.name.replace(/^\d{3}-/, "");
          const file = new File([blob], baseName, { type: blob.type || "image/*" });
          const url = URL.createObjectURL(blob);
          return {
            id: `${f.path}`,
            file,
            previewUrl: url,
            originalName: baseName,
          };
        })
      );
      setImagesItems(items);
    } catch {
      setImagesItems([]);
    } finally {
      setImagesBusy(false);
    }
  };
  const closeImagesModal = () => {
    // Revoke any object URLs
    imagesItems.forEach((it) => {
      try { URL.revokeObjectURL(it.previewUrl); } catch {}
    });
    setImagesItems([]);
    setImagesEditingPcId(null);
    setImagesEditingScreenId(null);
    setImagesEditingKeyboardId(null);
    setImagesEditingMouseId(null);
    setImagesEditingConsoleId(null);
    setDragFromIndex(null);
    setImagesBusy(false);
  };
  const addFiles = (fileList: FileList | File[]) => {
    const next: ImageItem[] = [];
    Array.from(fileList).forEach((f, idx) => {
      if (!f.type || !f.type.startsWith("image/")) return;
      const url = URL.createObjectURL(f);
      next.push({
        id: `local-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}`,
        file: f,
        previewUrl: url,
        originalName: f.name,
      });
    });
    if (next.length > 0) {
      setImagesItems((prev) => [...prev, ...next]);
    }
  };
  const onChooseFiles = () => {
    fileInputRef.current?.click();
  };
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFiles(files);
      e.currentTarget.value = "";
    }
  };
  const onDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    if (dt?.files && dt.files.length > 0) {
      addFiles(dt.files);
    }
  };
  const onDragStartItem = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    setDragFromIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOverItem = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };
  const onDragEnterItem = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverIndex !== index) setDragOverIndex(index);
  };
  const onDragStartItemBtn = (index: number) => (e: React.DragEvent<HTMLButtonElement>) => {
    setDragFromIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragEndItem = () => {
    setDragFromIndex(null);
    setDragOverIndex(null);
  };
  const onDropOnItem = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const fromStr = e.dataTransfer.getData("text/plain");
    const from = Number(fromStr);
    if (!Number.isFinite(from)) return;
    if (from === index) {
      setDragFromIndex(null);
      setDragOverIndex(null);
      return;
    }
    setImagesItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      const insertAt = index > from ? index : index;
      copy.splice(insertAt, 0, moved);
      return copy;
    });
    setDragFromIndex(null);
    setDragOverIndex(null);
  };
  const removeImageAt = (index: number) => {
    setImagesItems((prev) => {
      const copy = [...prev];
      const removed = copy.splice(index, 1);
      removed.forEach((it) => {
        try { URL.revokeObjectURL(it.previewUrl); } catch {}
      });
      return copy;
    });
  };
  const handleSaveImages = async () => {
    if (!isAdmin) return;
    setImagesBusy(true);
    const isGaming = imagesEditingPcId !== null;
    const isScreen = !isGaming && imagesEditingScreenId !== null;
    const isKeyboard = !isGaming && !isScreen && imagesEditingKeyboardId !== null;
    const isMouse = !isGaming && !isScreen && !isKeyboard && imagesEditingMouseId !== null;
    const isConsole = !isGaming && !isScreen && !isKeyboard && !isMouse && imagesEditingConsoleId !== null;
    const pcId = imagesEditingPcId as number | null;
    const folder = imagesEditingScreenId as string | null;
    const bucket = isGaming ? "gamingpcimages" : isScreen ? "screens" : isKeyboard ? "keyboards" : isMouse ? "mouses" : isConsole ? "consoles" : "";
    const genericFolder = isScreen ? imagesEditingScreenId : isKeyboard ? imagesEditingKeyboardId : isMouse ? String(imagesEditingMouseId) : isConsole ? imagesEditingConsoleId : null;
    try {
      // Clean folder server-side (service role) to avoid policy issues
      if (isGaming) {
        await fetch("/api/images/clean-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pcId }),
        }).then(async (r) => {
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j?.error || "Tókst ekki að hreinsa möppu");
          }
        });
      } else if ((isScreen || isKeyboard || isMouse || isConsole) && genericFolder) {
        await fetch("/api/images/clean-folder-generic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, folder: genericFolder }),
        }).then(async (r) => {
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j?.error || "Tókst ekki að hreinsa möppu");
          }
        });
      } else {
        throw new Error("Óstudd myndategund");
      }
      // Prepare ordered names and get signed upload tokens in one request
      const orderedNames = imagesItems.map((item, i) => {
        const safeName = sanitizeFileName(item.originalName.replace(/^\d{3}-/, ""));
        return `${padIndex(i)}-${safeName}`;
      });
      const signRes = await fetch(isGaming ? "/api/images/signed-upload" : "/api/images/signed-upload-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: isGaming ? JSON.stringify({ pcId, fileNames: orderedNames }) : JSON.stringify({ bucket, folder: genericFolder, fileNames: orderedNames }),
      });
      if (!signRes.ok) {
        const j = await signRes.json().catch(() => ({}));
        throw new Error(j?.error || "Tókst ekki að útbúa undirritaðar slóðir");
      }
      const signJson = await signRes.json();
      const entries: { path: string; token: string }[] = signJson?.entries || [];
      if (!entries || entries.length !== imagesItems.length) {
        throw new Error("Ósamræmi í undirrituðum slóðum");
      }
      // Upload in order using signed URLs
      for (let i = 0; i < imagesItems.length; i++) {
        const item = imagesItems[i];
        const { path, token } = entries[i];
        const { error: upErr } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, item.file, {
          contentType: item.file.type || "application/octet-stream",
        });
        if (upErr) {
          throw new Error(upErr.message || "Upphleðsla tókst ekki");
        }
      }
      closeImagesModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Villa við að vista myndir";
      setError(message);
    } finally {
      setImagesBusy(false);
    }
  };

  // Consoles
  interface ConsoleRow {
    id: string;
    nafn: string;
    verd: string;
    geymsluplass: string;
    numberofextracontrollers: string;
    verdextracontrollers: string;
    tengi: string;
    inserted_at?: string | null;
  }
  type NewConsoleRow = Omit<ConsoleRow, "id" | "inserted_at">;
  const [consoles, setConsoles] = useState<ConsoleRow[]>([]);
  const [consolesLoading, setConsolesLoading] = useState<boolean>(false);
  const [consoleCreating, setConsoleCreating] = useState<boolean>(false);
  const [consoleDeletingId, setConsoleDeletingId] = useState<string | null>(null);
  const [consoleUpdatingId, setConsoleUpdatingId] = useState<string | null>(null);
  const [consoleEditingId, setConsoleEditingId] = useState<string | null>(null);
  const [consoleForm, setConsoleForm] = useState<NewConsoleRow>({
    nafn: "",
    verd: "",
    geymsluplass: "",
    numberofextracontrollers: "",
    verdextracontrollers: "",
    tengi: "",
  });
  const [consoleEditForm, setConsoleEditForm] = useState<NewConsoleRow | null>(null);

  useEffect(() => {
    const fetchConsoles = async () => {
      if (activeTab !== "consoles" && activeTab !== "screens") return;
      if (!session?.user || !isAdmin) return;
      setConsolesLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("gamingconsoles")
          .select("*")
          .order("inserted_at", { ascending: false });
        if (error) {
          setError(error.message);
          setConsoles([]);
        } else {
          setConsoles(((data as ConsoleRow[]) ?? []));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setConsoles([]);
      } finally {
        setConsolesLoading(false);
      }
    };
    fetchConsoles();
  }, [activeTab, session?.user, isAdmin]);

  const onChangeConsole = (field: keyof NewConsoleRow, value: string) => {
    setConsoleForm((prev) => ({ ...prev, [field]: value }));
  };
  const onChangeConsoleEdit = (field: keyof NewConsoleRow, value: string) => {
    setConsoleEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };
  const validateConsole = (r: NewConsoleRow): string[] => {
    const errs: string[] = [];
    if (!r.nafn.trim()) errs.push("Nafn vantar");
    if (!r.verd.trim()) errs.push("Verð vantar");
    if (!r.geymsluplass.trim()) errs.push("Geymslupláss vantar");
    if (!r.numberofextracontrollers.trim()) errs.push("Fjöldi auka stýringa vantar");
    if (!r.verdextracontrollers.trim()) errs.push("Verð auka stýringa vantar");
    if (!r.tengi.trim()) errs.push("Tengi vantar");
    return errs;
  };
  const handleCreateConsole = async () => {
    if (!isAdmin) return;
    const errs = validateConsole(consoleForm);
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setConsoleCreating(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("gamingconsoles").insert([consoleForm]).select("*").single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const created = data as ConsoleRow;
        setConsoles((prev) => [created, ...prev]);
        setConsoleForm({
          nafn: "",
          verd: "",
          geymsluplass: "",
          numberofextracontrollers: "",
          verdextracontrollers: "",
          tengi: "",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setConsoleCreating(false);
    }
  };
  const handleStartConsoleEdit = (row: ConsoleRow) => {
    if (!isAdmin) return;
    setConsoleEditingId(row.id);
    setConsoleEditForm({
      nafn: row.nafn,
      verd: row.verd,
      geymsluplass: row.geymsluplass,
      numberofextracontrollers: row.numberofextracontrollers,
      verdextracontrollers: row.verdextracontrollers,
      tengi: row.tengi,
    });
  };
  const handleCancelConsoleEdit = () => {
    setConsoleEditingId(null);
    setConsoleEditForm(null);
  };
  const handleUpdateConsole = async (id: string) => {
    if (!isAdmin || !consoleEditForm) return;
    const errs = validateConsole(consoleEditForm);
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setConsoleUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("gamingconsoles")
        .update(consoleEditForm)
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const updated = data as ConsoleRow;
        setConsoles((prev) => prev.map((c) => (c.id === id ? updated : c)));
        setConsoleEditingId(null);
        setConsoleEditForm(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setConsoleUpdatingId(null);
    }
  };
  const handleDeleteConsole = async (id: string) => {
    if (!isAdmin) return;
    const ok = typeof window !== "undefined" ? window.confirm("Eyða þessari leikjatölvu?") : false;
    if (!ok) return;
    setConsoleDeletingId(id);
    try {
      const { error } = await supabase.from("gamingconsoles").delete().eq("id", id);
      if (!error) {
        setConsoles((prev) => prev.filter((c) => c.id !== id));
      } else {
        setError(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setConsoleDeletingId(null);
    }
  };
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
  // Mouses dropdown controls
  const onChangeMouse = (field: keyof NewMouseRow, value: string) => {
    setMouseForm((prev) => ({ ...prev, [field]: value }));
  };
  const onChangeMouseEdit = (field: keyof NewMouseRow, value: string) => {
    setMouseEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };
  const toggleCreateMsPc = (pcId: number) => {
    setMouseFormPcIds((prev) => (prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId]));
  };
  const toggleEditMsPc = (pcId: number) => {
    setMouseEditPcIds((prev) => (prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId]));
  };
  const openCreateMsMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setCreateMsMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setCreateMsOpen(true);
  };
  const openEditMsMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setEditMsMenuPos({ top: r.bottom, left: r.left, width: r.width });
    setEditMsOpen(true);
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
        verd: screenForm.verd || "",
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
        if (screenFormConsoleIds.length > 0) {
          const rowsToInsert = screenFormConsoleIds.map((cid) => ({ screen_id: created.id, gamingconsole_id: cid }));
          await supabase.from("screen_gamingconsoles").insert(rowsToInsert);
        }
        setScreens((prev) => [created, ...prev]);
        setScreenIdToPcIds((prev) => ({ ...prev, [created.id]: [...screenFormPcIds] }));
        setScreenIdToConsoleIds((prev) => ({ ...prev, [created.id]: [...screenFormConsoleIds] }));
        setScreenForm({
          framleidandi: "",
          skjastaerd: "",
          upplausn: "",
          skjataekni: "",
          endurnyjunartidni: "",
          verd: "",
          gamingPC_id: 0,
        });
        setScreenFormPcIds([]);
        setScreenFormConsoleIds([]);
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
      verd: row.verd || "",
      gamingPC_id: row.gamingPC_id,
    });
    const selected = screenIdToPcIds[row.id] || [];
    setScreenEditPcIds(selected);
    const selectedConsoles = screenIdToConsoleIds[row.id] || [];
    setScreenEditConsoleIds(selectedConsoles);
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
        verd: screenEditForm.verd || "",
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
        // Reconcile console links
        const existingC = screenIdToConsoleIds[id] || [];
        const nextC = screenEditConsoleIds || [];
        const toAddC = nextC.filter((x) => !existingC.includes(x));
        const toRemoveC = existingC.filter((x) => !nextC.includes(x));
        if (toRemoveC.length > 0) {
          await supabase.from("screen_gamingconsoles").delete().eq("screen_id", id).in("gamingconsole_id", toRemoveC);
        }
        if (toAddC.length > 0) {
          const rowsToInsertC = toAddC.map((cid) => ({ screen_id: id, gamingconsole_id: cid }));
          await supabase.from("screen_gamingconsoles").insert(rowsToInsertC);
        }
        setScreenIdToConsoleIds((prev) => ({ ...prev, [id]: [...nextC] }));
        setScreenEditingId(null);
        setScreenEditForm(null);
        setScreenEditPcIds([]);
        setScreenEditConsoleIds([]);
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
  const validateMouse = (r: NewMouseRow): string[] => {
    const errs: string[] = [];
    if (!r.nafn.trim()) errs.push("Nafn vantar");
    if (!r.framleidandi.trim()) errs.push("Framleiðandi vantar");
    if (!r.fjolditakk.trim()) errs.push("Fjöldi takka vantar");
    if (!r.toltakka.trim()) errs.push("Tölutakka vantar");
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
        setKeyboardForm({ nafn: "", framleidandi: "", staerd: "", tengimoguleiki: "", verd: "" });
        setKeyboardFormPcIds([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setKeyboardCreating(false);
    }
  };

  // Mouses CRUD
  const handleCreateMouse = async () => {
    if (!isAdmin) return;
    const errs = validateMouse(mouseForm);
    if (mouseFormPcIds.length === 0) errs.push("Veldu að minnsta kosti eina tölvu");
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setMouseCreating(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("mouses").insert([mouseForm]).select("*").single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const created = data as MouseRow;
        if (mouseFormPcIds.length > 0) {
          const rowsToInsert = mouseFormPcIds.map((pcId) => ({ mouse_id: created.id, gamingpc_id: pcId }));
          await supabase.from("mouse_gamingpcs").insert(rowsToInsert);
        }
        setMouses((prev) => [created, ...prev]);
        setMouseIdToPcIds((prev) => ({ ...prev, [String(created.id)]: [...mouseFormPcIds] }));
        setMouseForm({ nafn: "", framleidandi: "", fjolditakk: "", toltakka: "", tengimoguleiki: "" });
        setMouseFormPcIds([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setMouseCreating(false);
    }
  };

  const handleStartMouseEdit = (row: MouseRow) => {
    if (!isAdmin) return;
    setMouseEditingId(row.id);
    setMouseEditForm({
      nafn: row.nafn,
      framleidandi: row.framleidandi,
      fjolditakk: row.fjolditakk,
      toltakka: row.toltakka,
      tengimoguleiki: row.tengimoguleiki,
      verd: row.verd || "",
    });
    const selected = mouseIdToPcIds[String(row.id)] || [];
    setMouseEditPcIds(selected);
  };

  const handleCancelMouseEdit = () => {
    setMouseEditingId(null);
    setMouseEditForm(null);
  };

  const handleUpdateMouse = async (id: string | number) => {
    if (!isAdmin || !mouseEditForm) return;
    const errs = validateMouse(mouseEditForm);
    if (errs.length > 0) {
      setError(errs.join(" · "));
      return;
    }
    setMouseUpdatingId(id);
    try {
      const { data, error } = await supabase
        .from("mouses")
        .update(mouseEditForm)
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        setError(error.message);
      } else if (data) {
        const updated = data as MouseRow;
        setMouses((prev) => prev.map((m) => (String(m.id) === String(id) ? updated : m)));
        const existing = mouseIdToPcIds[String(id)] || [];
        const next = mouseEditPcIds || [];
        const toAdd = next.filter((x) => !existing.includes(x));
        const toRemove = existing.filter((x) => !next.includes(x));
        if (toRemove.length > 0) {
          await supabase.from("mouse_gamingpcs").delete().eq("mouse_id", id).in("gamingpc_id", toRemove);
        }
        if (toAdd.length > 0) {
          const rowsToInsert = toAdd.map((pcId) => ({ mouse_id: id, gamingpc_id: pcId }));
          await supabase.from("mouse_gamingpcs").insert(rowsToInsert);
        }
        setMouseIdToPcIds((prev) => ({ ...prev, [String(id)]: [...next] }));
        setMouseEditingId(null);
        setMouseEditForm(null);
        setMouseEditPcIds([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setMouseUpdatingId(null);
    }
  };

  const handleDeleteMouse = async (id: string | number) => {
    if (!isAdmin) return;
    const ok = typeof window !== "undefined" ? window.confirm("Eyða þessari mús?") : false;
    if (!ok) return;
    setMouseDeletingId(id);
    try {
      const { error } = await supabase.from("mouses").delete().eq("id", id);
      if (!error) {
        setMouses((prev) => prev.filter((m) => String(m.id) !== String(id)));
        setMouseIdToPcIds((prev) => {
          const copy = { ...prev };
          delete copy[String(id)];
          return copy;
        });
      } else {
        setError(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setMouseDeletingId(null);
    }
  };

  const handleStartKeyboardEdit = (row: KeyboardRow) => {
    if (!isAdmin) return;
    setKeyboardEditingId(row.id);
    setKeyboardEditForm({ nafn: row.nafn, framleidandi: row.framleidandi, staerd: row.staerd, tengimoguleiki: row.tengimoguleiki, verd: row.verd || "" });
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
              <button
                type="button"
                onClick={() => setActiveTab("consoles")}
                className={`px-3 py-1.5 text-sm rounded-t ${activeTab === "consoles" ? "bg-white border border-b-transparent border-gray-200 font-medium" : "text-gray-600 hover:text-gray-800"}`}
                aria-current={activeTab === "consoles" ? "page" : undefined}
              >
                Consoles
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mouses")}
                className={`px-3 py-1.5 text-sm rounded-t ${activeTab === "mouses" ? "bg-white border border-b-transparent border-gray-200 font-medium" : "text-gray-600 hover:text-gray-800"}`}
                aria-current={activeTab === "mouses" ? "page" : undefined}
              >
                Mouses
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600">
                {activeTab === "gaming"
                  ? (loading ? "Sæki gögn…" : `${rows.length} vörur`)
                  : activeTab === "screens"
                    ? (screensLoading ? "Sæki gögn…" : `${screens.length} skjáir`)
                    : activeTab === "keyboards"
                      ? (keyboardsLoading ? "Sæki gögn…" : `${keyboards.length} lyklaborð`)
                      : activeTab === "consoles"
                        ? (consolesLoading ? "Sæki gögn…" : `${consoles.length} consoles`)
                        : (mousesLoading ? "Sæki gögn…" : `${mouses.length} mýs`)}
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
                      <div className="grid grid-cols-6 gap-2 w-85">
                        <button
                          type="button"
                          onClick={() => openPricesModal(r.id)}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-green-500 text-green-600 hover:bg-green-50 text-xs w-full"
                          title="Verð (tímabil)"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v3m0 12v3m5-12a5 5 0 00-5-5h-1a4 4 0 000 8h2a4 4 0 010 8h-1a5 5 0 01-5-5" />
                          </svg>
                        </button>
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
                        <button
                          type="button"
                          onClick={() => openImagesModal(r.id)}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-purple-500 text-purple-600 hover:bg-purple-50 text-xs disabled:opacity-50 w-full"
                        >
                          Myndir
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
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Verð</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">GamingPC</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Consoles</th>
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
                  <td className="px-2 py-3 align-top">
                    <input value={screenForm.verd || ""} onChange={(e) => onChangeScreen("verd", e.target.value)} placeholder="Verð" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
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
                  <td className="px-2 py-3 align-top w-16">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (createConsoleOpen) {
                            setCreateConsoleOpen(false);
                          } else {
                            openCreateConsoleMenu(e.currentTarget as HTMLElement);
                          }
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs"
                      >
                        {screenFormConsoleIds.length > 0
                          ? `${screenFormConsoleIds
                              .map((id) => consoles.find((c) => c.id === id)?.nafn || `#${id}`)
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(", ")}${screenFormConsoleIds.length > 2 ? ` +${screenFormConsoleIds.length - 2}` : ""}`
                          : "Veldu consoles"}
                        <svg className="ml-2 h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                      </button>
                      {createConsoleOpen && createConsoleMenuPos ? (
                        <div
                          className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                          style={{ top: createConsoleMenuPos.top, left: createConsoleMenuPos.left, minWidth: createConsoleMenuPos.width, width: Math.max(createConsoleMenuPos.width, 224) }}
                        >
                          <div className="max-h-60 overflow-auto p-1">
                            {consoles.map((c) => {
                              const checked = screenFormConsoleIds.includes(c.id);
                              return (
                                <label key={c.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-xs">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCreateConsole(c.id)}
                                    className="h-3 w-3"
                                  />
                                  <span className="truncate">{c.nafn}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                            <button type="button" onClick={() => setScreenFormConsoleIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                            <button type="button" onClick={() => setCreateConsoleOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
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
                      <div className="truncate leading-6" title={r.verd || ""}>{r.verd || ""}</div>
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
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6">
                        {(() => {
                          const ids = screenIdToConsoleIds[r.id] || [];
                          if (ids.length === 0) return "—";
                          const names = ids
                            .map((id) => {
                              const c = consoles.find((cc) => cc.id === id);
                              return c ? c.nafn : `#${id}`;
                            })
                            .filter(Boolean);
                          return names.join(", ");
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="grid grid-cols-3 gap-2 w-64">
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
                          onClick={() => openScreenImagesModal(r.id)}
                          disabled={screenUpdatingId === r.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-purple-500 text-purple-600 hover:bg-purple-50 text-xs disabled:opacity-50 w-full"
                        >
                          Myndir
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
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      Engir skjáir fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            ) : activeTab === "keyboards" ? (
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">Nafn</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">Framleiðandi</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Stærð</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-28">Tengimöguleiki</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Verð</th>
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
                    <input value={keyboardForm.verd || ""} onChange={(e) => onChangeKeyboard("verd", e.target.value)} placeholder="Verð" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
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
                      <div className="truncate leading-6" title={k.verd || ""}>{k.verd || ""}</div>
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
                          onClick={() => openKeyboardImagesModal(k.id)}
                          disabled={keyboardUpdatingId === k.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-purple-500 text-purple-600 hover:bg-purple-50 text-xs disabled:opacity-50 w-full"
                        >
                          Myndir
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
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      Engin lyklaborð fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            ) : activeTab === "consoles" ? (
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">Nafn</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Verð</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">Geymslupláss</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-28">Auka stýringar (fjöldi)</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-28">Verð auka stýringa</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Tengi</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-48">Aðgerðir</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-2 py-3 align-top">
                    <input value={consoleForm.nafn} onChange={(e) => onChangeConsole("nafn", e.target.value)} placeholder="Nafn" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={consoleForm.verd} onChange={(e) => onChangeConsole("verd", e.target.value)} placeholder="Verð" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={consoleForm.geymsluplass} onChange={(e) => onChangeConsole("geymsluplass", e.target.value)} placeholder="t.d. 1TB" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={consoleForm.numberofextracontrollers} onChange={(e) => onChangeConsole("numberofextracontrollers", e.target.value)} placeholder="t.d. 1" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={consoleForm.verdextracontrollers} onChange={(e) => onChangeConsole("verdextracontrollers", e.target.value)} placeholder="t.d. 2.990 kr" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={consoleForm.tengi} onChange={(e) => onChangeConsole("tengi", e.target.value)} placeholder="t.d. HDMI, USB" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <button
                      type="button"
                      disabled={consoleCreating}
                      onClick={handleCreateConsole}
                      className="inline-flex items-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50"
                    >
                      Bæta við
                    </button>
                  </td>
                </tr>
                {consoles.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={c.nafn}>{c.nafn}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={c.verd}>{c.verd}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={c.geymsluplass}>{c.geymsluplass}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={c.numberofextracontrollers}>{c.numberofextracontrollers}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={c.verdextracontrollers}>{c.verdextracontrollers}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={c.tengi}>{c.tengi}</div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="grid grid-cols-3 gap-2 w-64">
                        <button
                          type="button"
                          onClick={() => handleStartConsoleEdit(c)}
                          disabled={consoleUpdatingId === c.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50 w-full"
                        >
                          Uppfæra
                        </button>
                        <button
                          type="button"
                          onClick={() => openConsoleImagesModal(c.id)}
                          disabled={consoleUpdatingId === c.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-purple-500 text-purple-600 hover:bg-purple-50 text-xs disabled:opacity-50 w-full"
                        >
                          Myndir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteConsole(c.id)}
                          disabled={consoleDeletingId === c.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 text-xs disabled:opacity-50 w-full"
                        >
                          Eyða
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!consolesLoading && consoles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      Engar leikjatölvur fundust.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            ) : (
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-28">Nafn</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-28">Framleiðandi</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Fjöldi takka</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Tölutakka</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-28">Tengimöguleiki</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Verð</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-24">GamingPC</th>
                  <th className="text-left px-2 py-3 font-medium text-gray-600 w-66">Aðgerðir</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-2 py-3 align-top">
                    <input value={mouseForm.nafn} onChange={(e) => onChangeMouse("nafn", e.target.value)} placeholder="Heiti" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={mouseForm.framleidandi} onChange={(e) => onChangeMouse("framleidandi", e.target.value)} placeholder="Framleiðandi" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={mouseForm.fjolditakk} onChange={(e) => onChangeMouse("fjolditakk", e.target.value)} placeholder="t.d. 5" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={mouseForm.toltakka} onChange={(e) => onChangeMouse("toltakka", e.target.value)} placeholder="t.d. Já/Nei" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={mouseForm.tengimoguleiki} onChange={(e) => onChangeMouse("tengimoguleiki", e.target.value)} placeholder="USB / Bluetooth" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input value={mouseForm.verd || ""} onChange={(e) => onChangeMouse("verd", e.target.value)} placeholder="Verð" className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (createMsOpen) {
                            setCreateMsOpen(false);
                          } else {
                            openCreateMsMenu(e.currentTarget as HTMLElement);
                          }
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs"
                      >
                        {mouseFormPcIds.length > 0
                          ? `${mouseFormPcIds
                              .map((id) => rows.find((p) => p.id === id)?.name || `#${id}`)
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(", ")}${mouseFormPcIds.length > 2 ? ` +${mouseFormPcIds.length - 2}` : ""}`
                          : "Veldu tölvur"}
                        <svg className="ml-2 h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                      </button>
                      {createMsOpen && createMsMenuPos ? (
                        <div
                          className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                          style={{ top: createMsMenuPos.top, left: createMsMenuPos.left, minWidth: createMsMenuPos.width, width: Math.max(createMsMenuPos.width, 224) }}
                        >
                          <div className="max-h-60 overflow-auto p-1">
                            {rows.map((pc) => {
                              const checked = mouseFormPcIds.includes(pc.id);
                              return (
                                <label key={pc.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-xs">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCreateMsPc(pc.id)}
                                    className="h-3 w-3"
                                  />
                                  <span className="truncate">{pc.name}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                            <button type="button" onClick={() => setMouseFormPcIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                            <button type="button" onClick={() => setCreateMsOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <button
                      type="button"
                      disabled={mouseCreating}
                      onClick={handleCreateMouse}
                      className="inline-flex items-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50"
                    >
                      Bæta við
                    </button>
                  </td>
                </tr>
                {mouses.map((m) => (
                  <tr key={String(m.id)} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={m.nafn}>{m.nafn}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={m.framleidandi}>{m.framleidandi}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={m.fjolditakk}>{m.fjolditakk}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={m.toltakka}>{m.toltakka}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={m.tengimoguleiki}>{m.tengimoguleiki}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6" title={m.verd || ""}>{m.verd || ""}</div>
                    </td>
                    <td className="px-2 py-3 align-top text-gray-800">
                      <div className="truncate leading-6">
                        {(() => {
                          const ids = mouseIdToPcIds[String(m.id)] || [];
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
                          onClick={() => handleStartMouseEdit(m)}
                          disabled={mouseUpdatingId === m.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-xs disabled:opacity-50 w-full"
                        >
                          Uppfæra
                        </button>
                        <button
                          type="button"
                          onClick={() => openMouseImagesModal(m.id)}
                          disabled={mouseUpdatingId === m.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-purple-500 text-purple-600 hover:bg-purple-50 text-xs disabled:opacity-50 w-full"
                        >
                          Myndir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMouse(m.id)}
                          disabled={mouseDeletingId === m.id}
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-red-500 text-red-600 hover:bg-red-50 text-xs disabled:opacity-50 w-full"
                        >
                          Eyða
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!mousesLoading && mouses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      Engar mýs fundust.
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
              <div>
                <label className="block text-xs text-gray-600 mb-1">Verð</label>
                <input value={screenEditForm.verd || ""} onChange={(e) => onChangeScreenEdit("verd", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
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
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">Tengdar consoles</label>
                <button
                  type="button"
                  onClick={(e) => {
                    if (editConsoleOpen) {
                      setEditConsoleOpen(false);
                    } else {
                      openEditConsoleMenu(e.currentTarget as HTMLElement);
                    }
                  }}
                  className="inline-flex items-center w-full justify-between px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm"
                >
                  <span className="truncate">
                    {screenEditConsoleIds.length > 0
                      ? screenEditConsoleIds
                          .map((id) => consoles.find((c) => c.id === id)?.nafn || `#${id}`)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(", ") + (screenEditConsoleIds.length > 3 ? ` +${screenEditConsoleIds.length - 3}` : "")
                      : "Veldu consoles"}
                  </span>
                  <svg className="ml-2 h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                </button>
                {editConsoleOpen && editConsoleMenuPos ? (
                  <div
                    className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                    style={{ top: editConsoleMenuPos.top, left: editConsoleMenuPos.left, minWidth: editConsoleMenuPos.width, width: editConsoleMenuPos.width }}
                  >
                    <div className="max-h-60 overflow-auto p-1">
                      {consoles.map((c) => {
                        const checked = (screenEditConsoleIds || []).includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEditConsole(c.id)}
                              className="h-3 w-3"
                            />
                            <span className="truncate">{c.nafn}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                      <button type="button" onClick={() => setScreenEditConsoleIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                      <button type="button" onClick={() => setEditConsoleOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
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
              <div>
                <label className="block text-xs text-gray-600 mb-1">Verð</label>
                <input value={keyboardEditForm.verd || ""} onChange={(e) => onChangeKeyboardEdit("verd", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
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
      {mouseEditingId !== null && mouseEditForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelMouseEdit} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Uppfæra mús</h2>
              <button type="button" onClick={handleCancelMouseEdit} className="text-gray-500 hover:text-gray-700 text-sm">Loka</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Heiti</label>
                  <input value={mouseEditForm.nafn} onChange={(e) => onChangeMouseEdit("nafn", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Framleiðandi</label>
                  <input value={mouseEditForm.framleidandi} onChange={(e) => onChangeMouseEdit("framleidandi", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Fjöldi takka</label>
                  <input value={mouseEditForm.fjolditakk} onChange={(e) => onChangeMouseEdit("fjolditakk", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tölutakka</label>
                  <input value={mouseEditForm.toltakka} onChange={(e) => onChangeMouseEdit("toltakka", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tengimöguleiki</label>
                <input value={mouseEditForm.tengimoguleiki} onChange={(e) => onChangeMouseEdit("tengimoguleiki", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Verð</label>
                <input value={mouseEditForm.verd || ""} onChange={(e) => onChangeMouseEdit("verd", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">Tengdar tölvur</label>
                <button
                  type="button"
                  onClick={(e) => {
                    if (editMsOpen) {
                      setEditMsOpen(false);
                    } else {
                      openEditMsMenu(e.currentTarget as HTMLElement);
                    }
                  }}
                  className="inline-flex items-center w-full justify-between px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm"
                >
                  <span className="truncate">
                    {mouseEditPcIds.length > 0
                      ? mouseEditPcIds
                          .map((id) => rows.find((p) => p.id === id)?.name || `#${id}`)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(", ") + (mouseEditPcIds.length > 3 ? ` +${mouseEditPcIds.length - 3}` : "")
                      : "Veldu tölvur"}
                  </span>
                  <svg className="ml-2 h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
                </button>
                {editMsOpen && editMsMenuPos ? (
                  <div
                    className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                    style={{ top: editMsMenuPos.top, left: editMsMenuPos.left, minWidth: editMsMenuPos.width, width: editMsMenuPos.width }}
                  >
                    <div className="max-h-60 overflow-auto p-1">
                      {rows.map((pc) => {
                        const checked = mouseEditPcIds.includes(pc.id);
                        return (
                          <label key={pc.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer select-none text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEditMsPc(pc.id)}
                              className="h-3 w-3"
                            />
                            <span className="truncate">{pc.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2 py-1 border-t border-gray-200">
                      <button type="button" onClick={() => setMouseEditPcIds([])} className="text-xs text-gray-600 hover:underline">Hreinsa</button>
                      <button type="button" onClick={() => setEditMsOpen(false)} className="text-xs text-[var(--color-accent)] hover:underline">Loka</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button type="button" onClick={handleCancelMouseEdit} className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Hætta við</button>
              <button
                type="button"
                onClick={() => mouseEditingId !== null ? handleUpdateMouse(mouseEditingId) : undefined}
                disabled={mouseUpdatingId === mouseEditingId}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-sm disabled:opacity-50"
              >
                Uppfæra
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {consoleEditingId !== null && consoleEditForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelConsoleEdit} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Uppfæra console</h2>
              <button type="button" onClick={handleCancelConsoleEdit} className="text-gray-500 hover:text-gray-700 text-sm">Loka</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nafn</label>
                  <input value={consoleEditForm.nafn} onChange={(e) => onChangeConsoleEdit("nafn", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Verð</label>
                  <input value={consoleEditForm.verd} onChange={(e) => onChangeConsoleEdit("verd", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Geymslupláss</label>
                  <input value={consoleEditForm.geymsluplass} onChange={(e) => onChangeConsoleEdit("geymsluplass", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Auka stýringar (fjöldi)</label>
                  <input value={consoleEditForm.numberofextracontrollers} onChange={(e) => onChangeConsoleEdit("numberofextracontrollers", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Verð auka stýringa</label>
                  <input value={consoleEditForm.verdextracontrollers} onChange={(e) => onChangeConsoleEdit("verdextracontrollers", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tengi</label>
                  <input value={consoleEditForm.tengi} onChange={(e) => onChangeConsoleEdit("tengi", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button type="button" onClick={handleCancelConsoleEdit} className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Hætta við</button>
              <button
                type="button"
                onClick={() => consoleEditingId !== null ? handleUpdateConsole(consoleEditingId) : undefined}
                disabled={consoleUpdatingId === consoleEditingId}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-sm disabled:opacity-50"
              >
                Uppfæra
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pricesEditingPcId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={pricesBusy ? undefined : closePricesModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Verð á tímabilum</h2>
              <button type="button" onClick={pricesBusy ? undefined : closePricesModal} className="text-gray-500 hover:text-gray-700 text-sm">Loka</button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <label className="text-sm text-gray-700 self-center">1 Mánuður</label>
                <input
                  value={pricesForm["1month"]}
                  onChange={(e) => setPricesForm((prev) => ({ ...prev, ["1month"]: e.target.value }))}
                  placeholder="Verð"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                />
                <label className="text-sm text-gray-700 self-center">3 Mánuðir</label>
                <input
                  value={pricesForm["3month"]}
                  onChange={(e) => setPricesForm((prev) => ({ ...prev, ["3month"]: e.target.value }))}
                  placeholder="Verð"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                />
                <label className="text-sm text-gray-700 self-center">6 Mánuðir</label>
                <input
                  value={pricesForm["6month"]}
                  onChange={(e) => setPricesForm((prev) => ({ ...prev, ["6month"]: e.target.value }))}
                  placeholder="Verð"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                />
                <label className="text-sm text-gray-700 self-center">9 Mánuðir</label>
                <input
                  value={pricesForm["9month"]}
                  onChange={(e) => setPricesForm((prev) => ({ ...prev, ["9month"]: e.target.value }))}
                  placeholder="Verð"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                />
                <label className="text-sm text-gray-700 self-center">12 Mánuðir</label>
                <input
                  value={pricesForm["12month"]}
                  onChange={(e) => setPricesForm((prev) => ({ ...prev, ["12month"]: e.target.value }))}
                  placeholder="Verð"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={pricesBusy ? undefined : closePricesModal}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50"
                disabled={pricesBusy}
              >
                Hætta við
              </button>
              <button
                type="button"
                onClick={handleSavePrices}
                disabled={pricesBusy}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-sm disabled:opacity-50"
              >
                {pricesBusy ? "Vistast…" : "Vista"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {(imagesEditingPcId !== null || imagesEditingScreenId !== null || imagesEditingKeyboardId !== null || imagesEditingMouseId !== null || imagesEditingConsoleId !== null) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={imagesBusy ? undefined : closeImagesModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {imagesEditingPcId !== null
                  ? `Myndir fyrir tölvu #${imagesEditingPcId}`
                  : imagesEditingScreenId !== null
                    ? `Myndir fyrir skjá ${imagesEditingScreenId}`
                    : imagesEditingKeyboardId !== null
                      ? `Myndir fyrir lyklaborð ${imagesEditingKeyboardId}`
                      : imagesEditingMouseId !== null
                        ? `Myndir fyrir mús ${imagesEditingMouseId}`
                        : imagesEditingConsoleId !== null
                          ? `Myndir fyrir console ${imagesEditingConsoleId}`
                      : 'Myndir'}
              </h2>
              <button type="button" onClick={imagesBusy ? undefined : closeImagesModal} className="text-gray-500 hover:text-gray-700 text-sm">Loka</button>
            </div>
            <div className="p-4 space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                onDrop={(e) => {
                  // Support both adding external files and reordering to the end when dropping on empty area
                  const fromStr = e.dataTransfer.getData("text/plain");
                  if (fromStr) {
                    e.preventDefault();
                    const from = Number(fromStr);
                    if (Number.isFinite(from)) {
                      setImagesItems((prev) => {
                        const copy = [...prev];
                        const [moved] = copy.splice(from, 1);
                        copy.push(moved);
                        return copy;
                      });
                      return;
                    }
                  }
                  onDropFiles(e);
                }}
                className="border-2 border-dashed border-gray-300 rounded-md p-4 min-h-[8rem] bg-gray-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-600">Dragðu myndir hingað eða veldu skrár</div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={onFileInputChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={onChooseFiles}
                      className="inline-flex items-center px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs"
                    >
                      Velja mynd
                    </button>
                  </div>
                </div>
                {imagesItems.length === 0 ? (
                  <div className="text-xs text-gray-500">Engar myndir valdar enn.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {imagesItems.map((it, idx) => (
                      <div
                        key={it.id}
                        className={`relative group rounded border bg-white overflow-hidden ${dragOverIndex === idx ? "ring-2 ring-purple-500 border-purple-500" : "border-gray-200"}`}
                        onDragEnter={onDragEnterItem(idx)}
                        onDragOver={onDragOverItem(idx)}
                        onDrop={onDropOnItem(idx)}
                        title={it.originalName}
                      >
                        <div className="absolute top-1 left-1 z-10">
                          <button
                            type="button"
                            draggable
                            onDragStart={onDragStartItemBtn(idx)}
                            onDragEnd={onDragEndItem}
                            className="inline-flex items-center justify-center h-5 w-5 rounded bg-white/90 text-gray-700 hover:bg-white cursor-grab active:cursor-grabbing"
                            title="Draga til að raða"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <circle cx="5" cy="6" r="1.5"></circle>
                              <circle cx="10" cy="6" r="1.5"></circle>
                              <circle cx="15" cy="6" r="1.5"></circle>
                              <circle cx="5" cy="11" r="1.5"></circle>
                              <circle cx="10" cy="11" r="1.5"></circle>
                              <circle cx="15" cy="11" r="1.5"></circle>
                            </svg>
                          </button>
                        </div>
                        <img src={it.previewUrl} alt="" className="w-full h-28 object-cover select-none pointer-events-none" />
                        <div className="absolute top-1 left-1 text-[10px] bg-black/60 text-white rounded px-1 py-0.5">{idx + 1}</div>
                        <button
                          type="button"
                          onClick={() => removeImageAt(idx)}
                          className="absolute top-1 right-1 text-[10px] bg-white/90 text-gray-700 rounded px-1 py-0.5 opacity-0 group-hover:opacity-100"
                          title="Fjarlægja"
                        >
                          X
                        </button>
                        <div className="p-1">
                          <div className="truncate text-[11px] text-gray-700">{it.originalName}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={imagesBusy ? undefined : closeImagesModal}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50"
                disabled={imagesBusy}
              >
                Hætta við
              </button>
              <button
                type="button"
                onClick={handleSaveImages}
                disabled={imagesBusy || imagesItems.length === 0}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:brightness-95 text-sm disabled:opacity-50"
              >
                {imagesBusy ? "Vistast…" : "Vista"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}


