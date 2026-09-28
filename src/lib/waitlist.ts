import { supabase } from "@/lib/supabase";

export async function joinProductWaitlist(
  productId: string
): Promise<{ ok: boolean; alreadyJoined?: boolean; error?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  const res = await fetch("/api/preorders/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ productId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; alreadyJoined?: boolean };

  if (res.status === 401) return { ok: false, error: "UNAUTHENTICATED" };
  if (!res.ok) return { ok: false, error: json.error || "Mistókst að skrá á biðlista" };
  return { ok: true, alreadyJoined: !!json.alreadyJoined };
}
