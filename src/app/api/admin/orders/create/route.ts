import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { generateOrderPdfBuffer, buildAdminOrderText } from "@/lib/orders";
import { sendOrderEmails } from "@/lib/email";

export const runtime = "nodejs";

type GuestBody = {
  fullName?: string;
  kennitala?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
};

type Body = {
  authUid?: string;
  guest?: GuestBody;
  productId?: string;
  variantId?: string | null;
  screenProductId?: string | null;
  months?: number;
  skjar?: boolean;
  lyklabord?: boolean;
  mus?: boolean;
  trygging?: boolean;
  extraControllers?: number;
  verd?: number;
  status?: string;
  message?: string;
  timabilFra?: string;
  timabilTil?: string;
};

function generateOrderNumber() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const guest = body.guest
      ? {
          fullName: (body.guest.fullName || "").trim(),
          kennitala: (body.guest.kennitala || "").trim(),
          email: (body.guest.email || "").trim(),
          phone: (body.guest.phone || "").trim(),
          address: (body.guest.address || "").trim(),
          city: (body.guest.city || "").trim(),
          postalCode: (body.guest.postalCode || "").trim(),
        }
      : null;
    const isGuest = !body.authUid && !!guest;
    if ((!body.authUid && !isGuest) || !body.productId) {
      return NextResponse.json({ success: false, error: "Viðskiptavinur og vara eru nauðsynleg" }, { status: 400 });
    }
    if (isGuest) {
      if (!guest?.fullName || !guest.kennitala || !guest.email || !guest.phone || !guest.address || !guest.city || !guest.postalCode) {
        return NextResponse.json({ success: false, error: "Fylltu inn nafn, kennitölu, netfang, síma, heimilisfang og borg/póstnúmer" }, { status: 400 });
      }
      if (!guest.email.includes("@")) {
        return NextResponse.json({ success: false, error: "Netfang er ógilt" }, { status: 400 });
      }
    }
    const verd = typeof body.verd === "number" ? Math.round(body.verd) : parseInt(String(body.verd || ""), 10);
    if (!Number.isFinite(verd) || verd <= 0) {
      return NextResponse.json({ success: false, error: "Verð verður að vera hærra en 0" }, { status: 400 });
    }

    const db = getServerSupabase();
    const { data: product } = await db.from("products").select("id, name").eq("id", body.productId).maybeSingle();
    if (!product) {
      return NextResponse.json({ success: false, error: "Vara fannst ekki" }, { status: 404 });
    }

    let userEmail = guest?.email || "";
    if (body.authUid) {
      const { data: userLookup } = await db.auth.admin.getUserById(body.authUid);
      userEmail = userLookup?.user?.email || "";
    }
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "Netfang viðskiptavinar fannst ekki" }, { status: 400 });
    }

    const months = [1, 3, 6, 12].includes(Number(body.months)) ? Number(body.months) : 3;
    const from = body.timabilFra ? new Date(body.timabilFra) : new Date();
    const to = body.timabilTil ? new Date(body.timabilTil) : addMonths(from, months);
    const allowedStatuses = ["Bíður greiðslu", "Undirbúningur", "Í gangi", "Í vinnslu", "Lokið"];
    const status = allowedStatuses.includes(body.status || "") ? body.status : "Undirbúningur";

    const insertPayload: Record<string, unknown> = {
        auth_uid: body.authUid || null,
        status,
        orderNumber: generateOrderNumber(),
        timabilFra: from.toISOString(),
        timabilTil: to.toISOString(),
        skjar: !!body.skjar,
        lyklabord: !!body.lyklabord,
        mus: !!body.mus,
        trygging: !!body.trygging,
        verd,
        product_id: body.productId,
        variant_id: body.variantId || null,
        screen_product_id: body.screenProductId || null,
        numberofextracon: body.extraControllers || null,
        gamingpc_uuid: null,
        gamingconsole_uuid: null,
        screen_uuid: null,
        laptop_variant_uuid: null,
      };
    if (isGuest && guest) {
      insertPayload.guest_name = guest.fullName;
      insertPayload.guest_kennitala = guest.kennitala;
      insertPayload.guest_email = guest.email;
      insertPayload.guest_phone = guest.phone;
      insertPayload.guest_address = guest.address;
      insertPayload.guest_city = guest.city;
      insertPayload.guest_postal_code = guest.postalCode;
    }

    const { data: inserted, error: insertError } = await db
      .from("orders")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      const msg = insertError?.message || "Gat ekki stofnað pöntun";
      if (/guest_|auth_uid|null value/i.test(msg)) {
        return NextResponse.json(
          { success: false, error: "Keyrðu sql/2026-10-02-guest-orders.sql í Supabase til að stofna pöntun án notanda." },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }

    let pdfUrl: string | null = null;
    try {
      const { buffer: pdfBuffer, filename, meta } = await generateOrderPdfBuffer(inserted.id);
      const filePath = `order-${inserted.id}-${Date.now()}.pdf`;
      await db.storage.from("order-pdfs").upload(filePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
      const { data: signed } = await db.storage.from("order-pdfs").createSignedUrl(filePath, 60 * 60);
      pdfUrl = signed?.signedUrl || null;
      await db
        .from("orders")
        .update({
          pdf_path: filePath,
          pdf_url: pdfUrl,
          pdf_generated_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);

      const adminText = buildAdminOrderText(meta, userEmail, body.message?.trim() || `Stofnað af stjórnanda (${admin.fullName || admin.email}).`);
      await sendOrderEmails({
        userEmail,
        orderTextForAdmin: adminText,
        pdfAttachment: { filename, content: pdfBuffer },
      });
    } catch (mailErr) {
      console.error("Admin create-order pdf/email failed", mailErr);
    }

    return NextResponse.json({ success: true, orderId: inserted.id, pdfUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
