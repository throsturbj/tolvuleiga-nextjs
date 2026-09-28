export const PRODUCT_TYPES = ["gaming_pc", "console", "laptop", "screen"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const GROUP_THEMES = ["dark", "light", "teal"] as const;
export type GroupTheme = (typeof GROUP_THEMES)[number];

export const AUKAHLUTIR_TYPES = ["keyboard", "mouse", "apple_accessory"] as const;
export type AukahluturType = (typeof AUKAHLUTIR_TYPES)[number];

export interface ProductGroup {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  visible: boolean;
  theme: GroupTheme;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  group_id: string | null;
  type: ProductType;
  name: string;
  description: string | null;
  innifalid: string | null;
  price: number | string | null;
  trygging: number | string | null;
  specs: Record<string, string | number | null | undefined>;
  uppselt: boolean;
  hidden: boolean;
  tilbod: boolean;
  image_bucket: string | null;
  image_folder: string | null;
  legacy_table: string | null;
  legacy_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  options: Record<string, string | number | null | undefined>;
  price: number | string | null;
  trygging: number | string | null;
  stock_quantity: number | null;
  legacy_id: string | null;
  created_at?: string;
}

export interface Aukahlutur {
  id: string;
  type: AukahluturType;
  name: string;
  price: number | string | null;
  specs: Record<string, string | number | null | undefined>;
  image_bucket: string | null;
  image_folder: string | null;
  legacy_table: string | null;
  legacy_id: string | null;
}

export type SpecField = {
  key: string;
  label: string;
  placeholder?: string;
};

export const SPEC_FIELDS: Record<ProductType, SpecField[]> = {
  gaming_pc: [
    { key: "cpu", label: "Örgjörvi", placeholder: "CPU" },
    { key: "gpu", label: "Skjákort", placeholder: "GPU" },
    { key: "ram", label: "Vinnsluminni", placeholder: "RAM" },
    { key: "storage", label: "Geymsla", placeholder: "SSD" },
    { key: "motherboard", label: "Móðurborð" },
    { key: "powersupply", label: "Aflgjafi" },
    { key: "cpucooler", label: "Kæling" },
  ],
  console: [
    { key: "geymsluplass", label: "Geymslupláss", placeholder: "t.d. 1TB" },
    { key: "tengi", label: "Tengi" },
    { key: "numberofextracontrollers", label: "Hámark auka fjarstýringa" },
    { key: "verdextracontrollers", label: "Verð per auka fjarstýringu" },
  ],
  laptop: [],
  screen: [
    { key: "framleidandi", label: "Framleiðandi" },
    { key: "skjastaerd", label: "Skjástærð", placeholder: 't.d. 27"' },
    { key: "upplausn", label: "Upplausn" },
    { key: "skjataekni", label: "Skjáteknni" },
    { key: "endurnyjunartidni", label: "Endurnýjunartíðni" },
  ],
};

export const AUKA_SPEC_FIELDS: Record<AukahluturType, SpecField[]> = {
  keyboard: [
    { key: "framleidandi", label: "Framleiðandi" },
    { key: "staerd", label: "Stærð" },
    { key: "tengimoguleiki", label: "Tengimöguleiki" },
  ],
  mouse: [
    { key: "framleidandi", label: "Framleiðandi" },
    { key: "fjolditakk", label: "Fjöldi takka" },
    { key: "toltakka", label: "Töl takka" },
    { key: "tengimoguleiki", label: "Tengimöguleiki" },
  ],
  apple_accessory: [],
};

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  gaming_pc: "Leikjatölva",
  console: "Leikjatölva / console",
  laptop: "Fartölva / spjaldtölva",
  screen: "Skjár",
};

export const AUKA_TYPE_LABEL: Record<AukahluturType, string> = {
  keyboard: "Lyklaborð",
  mouse: "Mús",
  apple_accessory: "Apple aukahlutur",
};

export const IMAGE_BUCKET_BY_TYPE: Record<ProductType, string> = {
  gaming_pc: "gamingpcimages",
  console: "consoles",
  laptop: "laptopimages",
  screen: "screens",
};

export const AUKA_BUCKET_BY_TYPE: Record<AukahluturType, string> = {
  keyboard: "keyboards",
  mouse: "mouses",
  apple_accessory: "keyboards",
};

export function parsePrice(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;
  const digits = String(v ?? "").replace(/\D+/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

export function formatKr(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatMonthly(n: number): string {
  return `${formatKr(n)} kr/mánuði`;
}

export function specText(specs: Product["specs"] | undefined, key: string): string {
  const v = specs?.[key];
  if (v == null) return "";
  return String(v).trim();
}

export function productSubtitle(product: Pick<Product, "type" | "specs" | "description">): string {
  const s = product.specs || {};
  if (product.type === "gaming_pc") {
    return [s.gpu, s.cpu, s.storage].filter(Boolean).join(" · ");
  }
  if (product.type === "console") {
    return [s.geymsluplass, s.tengi].filter(Boolean).join(" · ");
  }
  if (product.type === "screen") {
    return [s.upplausn, s.skjataekni, s.endurnyjunartidni].filter(Boolean).join(" · ");
  }
  return (product.description || "").trim();
}

export function specLines(product: Pick<Product, "type" | "specs">): { label: string; value: string }[] {
  return SPEC_FIELDS[product.type]
    .map((field) => ({ label: field.label, value: specText(product.specs, field.key) }))
    .filter((row) => row.value.length > 0);
}

export function variantStorageGb(variant: Pick<ProductVariant, "options">): number | null {
  const raw = variant.options?.storage_gb;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function formatStorage(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`;
}

export function displayPrice(product: Pick<Product, "type" | "price">, fromVariant?: number | null): number {
  if (fromVariant != null && Number.isFinite(fromVariant)) return fromVariant;
  const base = parsePrice(product.price);
  if (product.type === "console") {
    const raw = Math.round(base * 0.88);
    return Math.ceil(raw / 10) * 10;
  }
  return base;
}

export type OrderSelection = {
  months: number;
  addons?: { skjár?: boolean; lyklabord?: boolean; mus?: boolean };
  insured?: boolean;
  finalPrice?: number;
  variantId?: string | null;
  extraControllers?: number;
  accessoryIds?: string[];
  screenProductId?: string | null;
  keyboardId?: string | null;
  mouseId?: string | null;
};

export function saveOrderSelection(selection: OrderSelection) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem("orderSelection", JSON.stringify(selection));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolve by uuid first, then by legacy_id (old /product/12 and /laptop/<uuid> URLs). */
export async function fetchProductByParam(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (table: string) => any },
  id: string
): Promise<Product | null> {
  if (!id) return null;
  if (UUID_RE.test(id)) {
    const byId = await client.from("products").select("*").eq("id", id).maybeSingle();
    if (byId?.data) return byId.data as Product;
  }
  const byLegacy = await client.from("products").select("*").eq("legacy_id", id).maybeSingle();
  return (byLegacy?.data as Product | null) ?? null;
}
