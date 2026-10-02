"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  AUKA_SPEC_FIELDS,
  AUKA_TYPE_LABEL,
  AUKAHLUTIR_TYPES,
  GROUP_THEMES,
  IMAGE_BUCKET_BY_TYPE,
  AUKA_BUCKET_BY_TYPE,
  PRODUCT_TYPE_LABEL,
  PRODUCT_TYPES,
  SPEC_FIELDS,
  parsePrice,
  type Aukahlutur,
  type AukahluturType,
  type GroupTheme,
  type Product,
  type ProductGroup,
  type ProductType,
  type ProductVariant,
} from "@/lib/products";

type Tab = "groups" | "products" | "aukahlutir";

function sanitizeFileName(name: string) {
  return String(name || "file")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export default function VorurAdminPage() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = !!user?.isAdmin;

  const [tab, setTab] = useState<Tab>("products");
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({});
  const [aukahlutir, setAukahlutir] = useState<Aukahlutur[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<ProductType | "all">("all");

  const [groupForm, setGroupForm] = useState({ slug: "", title: "", sort_order: "10", visible: true, theme: "dark" as GroupTheme });
  const [productForm, setProductForm] = useState({
    type: "gaming_pc" as ProductType,
    group_id: "",
    name: "",
    description: "",
    innifalid: "",
    price: "",
    trygging: "",
    hidden: false,
    uppselt: false,
    tilbod: false,
    specs: {} as Record<string, string>,
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [variantForm, setVariantForm] = useState({ storage_gb: "", price: "", trygging: "", stock_quantity: "" });
  const [aukaForm, setAukaForm] = useState({ type: "keyboard" as AukahluturType, name: "", price: "", specs: {} as Record<string, string> });
  const [linkProductId, setLinkProductId] = useState<string | null>(null);
  const [compatIds, setCompatIds] = useState<string[]>([]);
  const [aukaLinkIds, setAukaLinkIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.user) {
      router.replace("/auth?redirect=/vorur");
      return;
    }
    if (!isAdmin) router.replace("/");
  }, [authLoading, session?.user, isAdmin, router]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const [{ data: g }, { data: p }, { data: a }] = await Promise.all([
      supabase.from("product_groups").select("*").order("sort_order"),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("aukahlutir").select("*").order("created_at", { ascending: false }),
    ]);
    setGroups((g as ProductGroup[]) || []);
    setProducts((p as Product[]) || []);
    setAukahlutir((a as Aukahlutur[]) || []);
    const { data: v } = await supabase.from("product_variants").select("*");
    const map: Record<string, ProductVariant[]> = {};
    for (const row of (v as ProductVariant[]) || []) {
      map[row.product_id] = map[row.product_id] || [];
      map[row.product_id].push(row);
    }
    setVariantsByProduct(map);
    setLoading(false);
  };

  useEffect(() => {
    if (!session?.user || !isAdmin) return;
    refresh();
  }, [session?.user, isAdmin]);

  const filteredProducts = useMemo(
    () => (typeFilter === "all" ? products : products.filter((p) => p.type === typeFilter)),
    [products, typeFilter]
  );

  const createGroup = async () => {
    setSaving(true);
    const { error: err } = await supabase.from("product_groups").insert({
      slug: groupForm.slug.trim(),
      title: groupForm.title.trim(),
      sort_order: parseInt(groupForm.sort_order, 10) || (groups.length + 1) * 10,
      visible: groupForm.visible,
      theme: groupForm.theme,
    });
    setSaving(false);
    if (err) setError(err.message);
    else {
      setGroupForm({ slug: "", title: "", sort_order: "10", visible: true, theme: "dark" });
      refresh();
    }
  };

  const updateGroup = async (g: ProductGroup, patch: Partial<ProductGroup>) => {
    const { error: err } = await supabase.from("product_groups").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", g.id);
    if (err) setError(err.message);
    else refresh();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Eyða hópi? Vörur í hópnum verða án hóps.")) return;
    const { error: err } = await supabase.from("product_groups").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  };

  const persistGroupOrder = async (ordered: ProductGroup[]) => {
    const next = ordered.map((g, i) => ({ ...g, sort_order: (i + 1) * 10 }));
    setGroups(next);
    setReordering(true);
    setError(null);
    const results = await Promise.all(
      next.map((g) =>
        supabase
          .from("product_groups")
          .update({ sort_order: g.sort_order, updated_at: new Date().toISOString() })
          .eq("id", g.id)
      )
    );
    setReordering(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setError(failed.error.message);
      refresh();
    }
  };

  const moveGroup = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) return;
    const next = [...groups];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistGroupOrder(next);
  };

  const specsFromForm = (type: ProductType, specs: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const field of SPEC_FIELDS[type]) {
      const v = (specs[field.key] || "").trim();
      if (v) out[field.key] = v;
    }
    return out;
  };

  const createProduct = async () => {
    if (!productForm.name.trim()) {
      setError("Nafn vantar");
      return;
    }
    setSaving(true);
    const payload = {
      type: productForm.type,
      group_id: productForm.group_id || null,
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      innifalid: productForm.innifalid.trim() || null,
      price: productForm.price ? parsePrice(productForm.price) : null,
      trygging: productForm.trygging ? parsePrice(productForm.trygging) : null,
      specs: specsFromForm(productForm.type, productForm.specs),
      hidden: productForm.hidden,
      uppselt: productForm.uppselt,
      tilbod: productForm.tilbod,
      image_bucket: IMAGE_BUCKET_BY_TYPE[productForm.type],
    };
    const { data, error: err } = await supabase.from("products").insert(payload).select("*").single();
    if (err) {
      setSaving(false);
      setError(err.message);
      return;
    }
    const created = data as Product;
    await supabase.from("products").update({ image_folder: created.id }).eq("id", created.id);
    setSaving(false);
    setProductForm({
      type: productForm.type,
      group_id: productForm.group_id,
      name: "",
      description: "",
      innifalid: "",
      price: "",
      trygging: "",
      hidden: false,
      uppselt: false,
      tilbod: false,
      specs: {},
    });
    refresh();
  };

  const saveProduct = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const { error: err } = await supabase
      .from("products")
      .update({
        group_id: editingProduct.group_id,
        name: editingProduct.name,
        description: editingProduct.description,
        innifalid: editingProduct.innifalid,
        price: editingProduct.price,
        trygging: editingProduct.trygging,
        specs: editingProduct.specs,
        hidden: editingProduct.hidden,
        uppselt: editingProduct.uppselt,
        tilbod: editingProduct.tilbod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingProduct.id);
    setSaving(false);
    if (err) setError(err.message);
    else {
      setEditingProduct(null);
      refresh();
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Eyða vöru?")) return;
    const { error: err } = await supabase.from("products").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  };

  const addVariant = async (productId: string) => {
    const storage = parseInt(variantForm.storage_gb, 10);
    if (!Number.isFinite(storage)) {
      setError("Geymsla verður að vera tala");
      return;
    }
    const { error: err } = await supabase.from("product_variants").insert({
      product_id: productId,
      options: { storage_gb: storage },
      price: parsePrice(variantForm.price),
      trygging: variantForm.trygging ? parsePrice(variantForm.trygging) : null,
      stock_quantity: variantForm.stock_quantity ? parseInt(variantForm.stock_quantity, 10) : null,
    });
    if (err) setError(err.message);
    else {
      setVariantForm({ storage_gb: "", price: "", trygging: "", stock_quantity: "" });
      refresh();
    }
  };

  const deleteVariant = async (id: string) => {
    const { error: err } = await supabase.from("product_variants").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  };

  const openLinks = async (product: Product) => {
    setLinkProductId(product.id);
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("product_compat").select("compatible_product_id").eq("product_id", product.id),
      supabase.from("product_aukahlutir").select("aukahlutur_id").eq("product_id", product.id),
    ]);
    setCompatIds(((c || []) as { compatible_product_id: string }[]).map((r) => r.compatible_product_id));
    setAukaLinkIds(((a || []) as { aukahlutur_id: string }[]).map((r) => r.aukahlutur_id));
  };

  const saveLinks = async () => {
    if (!linkProductId) return;
    setSaving(true);
    await supabase.from("product_compat").delete().eq("product_id", linkProductId);
    await supabase.from("product_aukahlutir").delete().eq("product_id", linkProductId);
    if (compatIds.length) {
      await supabase.from("product_compat").insert(compatIds.map((id) => ({ product_id: linkProductId, compatible_product_id: id })));
    }
    if (aukaLinkIds.length) {
      await supabase.from("product_aukahlutir").insert(aukaLinkIds.map((id) => ({ product_id: linkProductId, aukahlutur_id: id })));
    }
    setSaving(false);
    setLinkProductId(null);
  };

  const createAuka = async () => {
    if (!aukaForm.name.trim()) {
      setError("Nafn vantar");
      return;
    }
    setSaving(true);
    const specs: Record<string, string> = {};
    for (const field of AUKA_SPEC_FIELDS[aukaForm.type]) {
      const v = (aukaForm.specs[field.key] || "").trim();
      if (v) specs[field.key] = v;
    }
    const { data, error: err } = await supabase
      .from("aukahlutir")
      .insert({
        type: aukaForm.type,
        name: aukaForm.name.trim(),
        price: aukaForm.price ? parsePrice(aukaForm.price) : null,
        specs,
        image_bucket: AUKA_BUCKET_BY_TYPE[aukaForm.type],
      })
      .select("*")
      .single();
    if (!err && data) {
      await supabase.from("aukahlutir").update({ image_folder: (data as Aukahlutur).id }).eq("id", (data as Aukahlutur).id);
    }
    setSaving(false);
    if (err) setError(err.message);
    else {
      setAukaForm({ type: aukaForm.type, name: "", price: "", specs: {} });
      refresh();
    }
  };

  const deleteAuka = async (id: string) => {
    if (!confirm("Eyða aukahlut?")) return;
    const { error: err } = await supabase.from("aukahlutir").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  };

  const saveImages = async () => {
    if (!imageProduct || imageFiles.length === 0) return;
    const bucket = imageProduct.image_bucket || IMAGE_BUCKET_BY_TYPE[imageProduct.type];
    const folder = imageProduct.image_folder || imageProduct.id;
    setSaving(true);
    try {
      await fetch("/api/images/clean-folder-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, folder }),
      });
      const fileNames = imageFiles.map((f, i) => `${String(i).padStart(3, "0")}-${sanitizeFileName(f.name)}`);
      const signRes = await fetch("/api/images/signed-upload-generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, folder, fileNames }),
      });
      const signJson = await signRes.json();
      const entries: { path: string; token: string }[] = signJson?.entries || [];
      for (let i = 0; i < imageFiles.length; i++) {
        const { path, token } = entries[i];
        const { error: upErr } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, imageFiles[i], {
          contentType: imageFiles[i].type || "application/octet-stream",
        });
        if (upErr) throw upErr;
      }
      setImageProduct(null);
      setImageFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Myndir tókust ekki");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !session?.user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">Hleður…</div>
    );
  }

  const inputCls = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const btnCls = "rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50";
  const tabCls = (t: Tab) =>
    `px-3 py-2 text-sm font-medium rounded-md ${tab === t ? "bg-[var(--color-accent)] text-white" : "bg-white text-gray-700 border"}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Vörur</h1>
        <div className="flex gap-2 mb-6">
          <button type="button" className={tabCls("groups")} onClick={() => setTab("groups")}>Hópar</button>
          <button type="button" className={tabCls("products")} onClick={() => setTab("products")}>Vörur</button>
          <button type="button" className={tabCls("aukahlutir")} onClick={() => setTab("aukahlutir")}>Aukahlutir</button>
        </div>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-gray-500">Hleður…</p> : null}

        {tab === "groups" ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4 grid gap-3 sm:grid-cols-5">
              <input className={inputCls} placeholder="slug (t.d. desktops)" value={groupForm.slug} onChange={(e) => setGroupForm({ ...groupForm, slug: e.target.value })} />
              <input className={inputCls} placeholder="Titill" value={groupForm.title} onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })} />
              <input className={inputCls} placeholder="Röð" value={groupForm.sort_order} onChange={(e) => setGroupForm({ ...groupForm, sort_order: e.target.value })} />
              <select className={inputCls} value={groupForm.theme} onChange={(e) => setGroupForm({ ...groupForm, theme: e.target.value as GroupTheme })}>
                {GROUP_THEMES.map((th) => (
                  <option key={th} value={th}>{th}</option>
                ))}
              </select>
              <button type="button" className={btnCls} disabled={saving} onClick={createGroup}>Bæta við hópi</button>
            </div>
            <p className="text-sm text-gray-500">
              Dragðu hópana upp eða niður til að ákveða röðina á forsíðunni.
              {reordering ? " Vista röð…" : ""}
            </p>
            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 w-10" />
                    <th className="px-3 py-2">Röð</th>
                    <th className="px-3 py-2">Titill</th>
                    <th className="px-3 py-2">Slug</th>
                    <th className="px-3 py-2">Þema</th>
                    <th className="px-3 py-2">Sýnilegt</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, index) => (
                    <tr
                      key={g.id}
                      draggable
                      onDragStart={(e) => {
                        if ((e.target as HTMLElement).closest("input,select,button,a,textarea")) {
                          e.preventDefault();
                          return;
                        }
                        setDragIndex(index);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", g.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverIndex !== index) setDragOverIndex(index);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = dragIndex;
                        setDragIndex(null);
                        setDragOverIndex(null);
                        if (from != null) moveGroup(from, index);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`border-t ${dragIndex === index ? "opacity-40" : ""} ${
                        dragOverIndex === index && dragIndex !== index ? "border-t-2 border-t-[var(--color-accent)]" : ""
                      }`}
                    >
                      <td className="px-2 py-2 text-gray-400 cursor-grab active:cursor-grabbing select-none" title="Dragðu til að raða">
                        <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100">
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 5a1 1 0 110-2 1 1 0 010 2zm6-1a1 1 0 100 2 1 1 0 000-2zM7 11a1 1 0 110-2 1 1 0 010 2zm6-1a1 1 0 100 2 1 1 0 000-2zM7 17a1 1 0 110-2 1 1 0 010 2zm6-1a1 1 0 100 2 1 1 0 000-2z" />
                          </svg>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 tabular-nums">{g.sort_order}</td>
                      <td className="px-3 py-2">
                        <input className="w-full border rounded px-1" defaultValue={g.title} onBlur={(e) => updateGroup(g, { title: e.target.value })} />
                      </td>
                      <td className="px-3 py-2 text-gray-500">{g.slug}</td>
                      <td className="px-3 py-2">
                        <select className="border rounded px-1" defaultValue={g.theme} onChange={(e) => updateGroup(g, { theme: e.target.value as GroupTheme })}>
                          {GROUP_THEMES.map((th) => <option key={th} value={th}>{th}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" defaultChecked={g.visible} onChange={(e) => updateGroup(g, { visible: e.target.checked })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="text-red-600 text-xs" onClick={() => deleteGroup(g.id)}>Eyða</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "products" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`px-3 py-1 rounded text-sm ${typeFilter === "all" ? "bg-gray-900 text-white" : "bg-white border"}`} onClick={() => setTypeFilter("all")}>Allt</button>
              {PRODUCT_TYPES.map((t) => (
                <button key={t} type="button" className={`px-3 py-1 rounded text-sm ${typeFilter === t ? "bg-gray-900 text-white" : "bg-white border"}`} onClick={() => setTypeFilter(t)}>
                  {PRODUCT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold">Ný vara</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <select className={inputCls} value={productForm.type} onChange={(e) => setProductForm({ ...productForm, type: e.target.value as ProductType, specs: {} })}>
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{PRODUCT_TYPE_LABEL[t]}</option>)}
                </select>
                <select className={inputCls} value={productForm.group_id} onChange={(e) => setProductForm({ ...productForm, group_id: e.target.value })}>
                  <option value="">— Hópur —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
                <input className={inputCls} placeholder="Nafn" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                <input className={inputCls} placeholder="Verð / mán" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
                <input className={inputCls} placeholder="Trygging" value={productForm.trygging} onChange={(e) => setProductForm({ ...productForm, trygging: e.target.value })} />
                <input className={inputCls} placeholder="Innifalið" value={productForm.innifalid} onChange={(e) => setProductForm({ ...productForm, innifalid: e.target.value })} />
              </div>
              {SPEC_FIELDS[productForm.type].length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {SPEC_FIELDS[productForm.type].map((field) => (
                    <input
                      key={field.key}
                      className={inputCls}
                      placeholder={field.label}
                      value={productForm.specs[field.key] || ""}
                      onChange={(e) => setProductForm({ ...productForm, specs: { ...productForm.specs, [field.key]: e.target.value } })}
                    />
                  ))}
                </div>
              ) : (
                <textarea className={inputCls} rows={2} placeholder="Lýsing (fartölvur)" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
              )}
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={productForm.hidden} onChange={(e) => setProductForm({ ...productForm, hidden: e.target.checked })} /> Falin</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={productForm.uppselt} onChange={(e) => setProductForm({ ...productForm, uppselt: e.target.checked })} /> Uppselt</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={productForm.tilbod} onChange={(e) => setProductForm({ ...productForm, tilbod: e.target.checked })} /> Tilboð</label>
                <button type="button" className={btnCls} disabled={saving} onClick={createProduct}>Búa til</button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredProducts.map((p) => (
                <div key={p.id} className="bg-white rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500">{PRODUCT_TYPE_LABEL[p.type]} · {groups.find((g) => g.id === p.group_id)?.title || "án hóps"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button type="button" className="underline" onClick={() => setEditingProduct({ ...p })}>Breyta</button>
                      <button type="button" className="underline" onClick={() => setImageProduct(p)}>Myndir</button>
                      {(p.type === "gaming_pc" || p.type === "console" || p.type === "laptop") ? (
                        <button type="button" className="underline" onClick={() => openLinks(p)}>Tengingar</button>
                      ) : null}
                      <button type="button" className="text-red-600 underline" onClick={() => deleteProduct(p.id)}>Eyða</button>
                    </div>
                  </div>
                  {p.type === "laptop" ? (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs uppercase text-gray-400 mb-2">Afbrigði (geyma)</p>
                      <ul className="text-sm space-y-1">
                        {(variantsByProduct[p.id] || []).map((v) => (
                          <li key={v.id} className="flex justify-between">
                            <span>{String(v.options?.storage_gb ?? "—")} GB · {parsePrice(v.price)} kr</span>
                            <button type="button" className="text-red-600 text-xs" onClick={() => deleteVariant(v.id)}>Eyða</button>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        <input className={inputCls} placeholder="GB" value={variantForm.storage_gb} onChange={(e) => setVariantForm({ ...variantForm, storage_gb: e.target.value })} />
                        <input className={inputCls} placeholder="Verð" value={variantForm.price} onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })} />
                        <input className={inputCls} placeholder="Trygging" value={variantForm.trygging} onChange={(e) => setVariantForm({ ...variantForm, trygging: e.target.value })} />
                        <button type="button" className={btnCls} onClick={() => addVariant(p.id)}>Bæta við</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "aukahlutir" ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h2 className="font-semibold">Nýr aukahlutur</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <select className={inputCls} value={aukaForm.type} onChange={(e) => setAukaForm({ ...aukaForm, type: e.target.value as AukahluturType, specs: {} })}>
                  {AUKAHLUTIR_TYPES.map((t) => <option key={t} value={t}>{AUKA_TYPE_LABEL[t]}</option>)}
                </select>
                <input className={inputCls} placeholder="Nafn" value={aukaForm.name} onChange={(e) => setAukaForm({ ...aukaForm, name: e.target.value })} />
                <input className={inputCls} placeholder="Verð" value={aukaForm.price} onChange={(e) => setAukaForm({ ...aukaForm, price: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {AUKA_SPEC_FIELDS[aukaForm.type].map((field) => (
                  <input
                    key={field.key}
                    className={inputCls}
                    placeholder={field.label}
                    value={aukaForm.specs[field.key] || ""}
                    onChange={(e) => setAukaForm({ ...aukaForm, specs: { ...aukaForm.specs, [field.key]: e.target.value } })}
                  />
                ))}
              </div>
              <button type="button" className={btnCls} disabled={saving} onClick={createAuka}>Búa til</button>
            </div>
            <div className="bg-white rounded-lg border divide-y">
              {aukahlutir.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-gray-500">{AUKA_TYPE_LABEL[a.type]} · {a.price ?? "—"} kr</div>
                  </div>
                  <button type="button" className="text-red-600 text-xs" onClick={() => deleteAuka(a.id)}>Eyða</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {editingProduct ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">
              <h3 className="font-semibold">Breyta vöru</h3>
              <input className={inputCls} value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              <select className={inputCls} value={editingProduct.group_id || ""} onChange={(e) => setEditingProduct({ ...editingProduct, group_id: e.target.value || null })}>
                <option value="">— Hópur —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <input className={inputCls} placeholder="Verð" value={editingProduct.price ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} />
              <input className={inputCls} placeholder="Trygging" value={editingProduct.trygging ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, trygging: e.target.value })} />
              <input className={inputCls} placeholder="Innifalið" value={editingProduct.innifalid || ""} onChange={(e) => setEditingProduct({ ...editingProduct, innifalid: e.target.value })} />
              <textarea className={inputCls} rows={2} placeholder="Lýsing" value={editingProduct.description || ""} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} />
              {SPEC_FIELDS[editingProduct.type].map((field) => (
                <input
                  key={field.key}
                  className={inputCls}
                  placeholder={field.label}
                  value={String(editingProduct.specs?.[field.key] ?? "")}
                  onChange={(e) => setEditingProduct({ ...editingProduct, specs: { ...editingProduct.specs, [field.key]: e.target.value } })}
                />
              ))}
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingProduct.hidden} onChange={(e) => setEditingProduct({ ...editingProduct, hidden: e.target.checked })} /> Falin</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingProduct.uppselt} onChange={(e) => setEditingProduct({ ...editingProduct, uppselt: e.target.checked })} /> Uppselt</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingProduct.tilbod} onChange={(e) => setEditingProduct({ ...editingProduct, tilbod: e.target.checked })} /> Tilboð</label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="text-sm" onClick={() => setEditingProduct(null)}>Hætta við</button>
                <button type="button" className={btnCls} disabled={saving} onClick={saveProduct}>Vista</button>
              </div>
            </div>
          </div>
        ) : null}

        {linkProductId ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="font-semibold">Tengingar</h3>
              <div>
                <p className="text-xs uppercase text-gray-400 mb-1">Skjáir sem má bæta við</p>
                {products.filter((p) => p.type === "screen").map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm py-0.5">
                    <input type="checkbox" checked={compatIds.includes(s.id)} onChange={(e) => setCompatIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id))} />
                    {s.name}
                  </label>
                ))}
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400 mb-1">Aukahlutir</p>
                {aukahlutir.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm py-0.5">
                    <input type="checkbox" checked={aukaLinkIds.includes(a.id)} onChange={(e) => setAukaLinkIds((prev) => e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id))} />
                    {a.name} <span className="text-gray-400">({AUKA_TYPE_LABEL[a.type]})</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="text-sm" onClick={() => setLinkProductId(null)}>Hætta við</button>
                <button type="button" className={btnCls} disabled={saving} onClick={saveLinks}>Vista</button>
              </div>
            </div>
          </div>
        ) : null}

        {imageProduct ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-3">
              <h3 className="font-semibold">Myndir · {imageProduct.name}</h3>
              <p className="text-xs text-gray-500">Nýjar myndir koma í stað eldri mynda í möppunni.</p>
              <input type="file" multiple accept="image/*" onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
              <div className="flex justify-end gap-2">
                <button type="button" className="text-sm" onClick={() => { setImageProduct(null); setImageFiles([]); }}>Hætta við</button>
                <button type="button" className={btnCls} disabled={saving || imageFiles.length === 0} onClick={saveImages}>Hlaða upp</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
