"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { supabasePublic } from "@/lib/supabase-public";

export default function LegacyProductRedirect({ toOrder = false }: { toOrder?: boolean }) {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!id) {
        setMissing(true);
        return;
      }
      for (const client of [supabasePublic, supabase]) {
        const { data } = await client.from("products").select("id").eq("legacy_id", id).maybeSingle();
        if (!alive) return;
        if (data?.id) {
          router.replace(toOrder ? `/order/${data.id}` : `/product/${data.id}`);
          return;
        }
      }
      if (alive) setMissing(true);
    };
    run();
    return () => {
      alive = false;
    };
  }, [id, router, toOrder]);

  if (missing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Vara fannst ekki.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-600">Hleður vörunni…</p>
    </div>
  );
}
