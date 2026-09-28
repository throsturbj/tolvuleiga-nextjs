import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const db = getServerSupabase();
    const { data: profiles, error } = await db
      .from("users")
      .select("auth_uid, full_name, kennitala, phone")
      .order("full_name", { ascending: true });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const emails: Record<string, string> = {};
    let page = 1;
    while (page <= 20) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
      const users = data?.users || [];
      for (const u of users) {
        if (u.id && u.email) emails[u.id] = u.email;
      }
      if (users.length < 200) break;
      page += 1;
    }

    const customers = (profiles || []).map((p) => ({
      auth_uid: p.auth_uid as string,
      full_name: (p.full_name || "").trim(),
      kennitala: (p.kennitala || "").trim(),
      phone: (p.phone || "").trim(),
      email: emails[p.auth_uid as string] || "",
    }));

    return NextResponse.json({ success: true, customers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
