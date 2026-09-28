import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase-server";

export async function requireAdmin(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await createClient(url, anon).auth.getUser(token);
  if (error || !data.user) return null;
  const db = getServerSupabase();
  const { data: profile } = await db
    .from("users")
    .select("isAdmin, full_name")
    .eq("auth_uid", data.user.id)
    .maybeSingle();
  const metaAdmin = Boolean((data.user.user_metadata as Record<string, unknown> | undefined)?.isAdmin);
  if (!profile?.isAdmin && !metaAdmin) return null;
  return { id: data.user.id, email: data.user.email || "", fullName: (profile?.full_name || "").trim() };
}
