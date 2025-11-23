"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  auth_uid: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  kennitala?: string;
  ibudnumber?: string;
}

function UserInfoPageInner() {
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const uid = session?.user?.id || null;
  const fromOrder = searchParams.get("from") === "order";

  const [formData, setFormData] = useState({
    full_name: "",
    kennitala: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    ibudnumber: "",
  });

  // Initialize email field from auth session
  useEffect(() => {
    const currentEmail = session?.user?.email || "";
    setEmail((prev) => (prev ? prev : currentEmail));
  }, [session?.user?.email]);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setError(null);
        setLoading(true);
        const timeout = setTimeout(() => {
          if (!cancelled) {
            setError((prev) => prev || "Upphleðsla tók of langan tíma. Reyndu aftur.");
            setLoading(false);
          }
        }, 8000);

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("auth_uid", uid)
          .single();

        if (error) {
          if ((error as { code?: string }).code === "PGRST116") {
            const { data: created, error: createError } = await supabase
              .from("users")
              .insert({
                auth_uid: uid,
                full_name: "",
                kennitala: "",
                phone: "",
                address: "",
                city: "",
                postal_code: "",
                ibudnumber: "",
              })
              .select()
              .single();
            if (createError) throw createError;
            if (!cancelled) {
              setProfile(created as UserProfile);
              setFormData({
                full_name: created.full_name || "",
                kennitala: created.kennitala || "",
                phone: created.phone || "",
                address: created.address || "",
                city: created.city || "",
                postal_code: created.postal_code || "",
                ibudnumber: created.ibudnumber || "",
              });
            }
          } else {
            throw error;
          }
        } else if (data) {
          if (!cancelled) {
            setProfile(data as UserProfile);
            setFormData({
              full_name: data.full_name || "",
              kennitala: data.kennitala || "",
              phone: data.phone || "",
              address: data.address || "",
              city: data.city || "",
              postal_code: data.postal_code || "",
              ibudnumber: data.ibudnumber || "",
            });
          }
        }
        clearTimeout(timeout);
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Tókst ekki að sækja notandaupplýsingar";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    setError(null);
    setEmailNotice(null);
    setSuccess(false);

    try {
      // 1) Update auth email if changed
      const currentEmail = session?.user?.email || "";
      const trimmedEmail = (email || "").trim();
      if (trimmedEmail && trimmedEmail !== currentEmail) {
        const { data, error: emailErr } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailErr) {
          throw new Error(emailErr.message || "Tókst ekki að uppfæra netfang");
        }
        // Supabase may require email confirmation depending on project settings
        if (data?.user?.email !== trimmedEmail) {
          setEmailNotice("Við sendum staðfestingartölvupóst. Vinsamlegast staðfestu netfangsbreytinguna.");
        } else {
          setEmailNotice("Netfang hefur verið uppfært.");
        }
      }

      // 2) Update profile fields in 'users' table
      const { error } = await supabase
        .from("users")
        .update(formData)
        .eq("auth_uid", uid);

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      // Mark that profile was updated so the previous page can refresh
      try {
        const fromOrder = searchParams.get("from") === "order";
        if (fromOrder && typeof window !== 'undefined') {
          window.sessionStorage.setItem('profileUpdated', '1');
        }
      } catch {}
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Tókst ekki að uppfæra notandaupplýsingar";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Hleður...</h1>
          <p className="text-gray-600">Sæki notandaupplýsingar...</p>
        </div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Innskráning nauðsynleg</h1>
          <p className="text-gray-600 mb-8">Þú verður að skrá þig inn til að skoða notandaupplýsingar.</p>
          <button
            onClick={() => router.push("/auth?redirect=/notendaupplysingar")}
            className="rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            Skrá inn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Notendaupplýsingar</h1>
          </div>

          <div className="p-8">
            <form onSubmit={onSubmit}>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">Fullt nafn *</label>
                  <input
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={onChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sláðu inn fullt nafn"
                  />
                </div>

                <div>
                  <label htmlFor="kennitala" className="block text-sm font-medium text-gray-700 mb-2">Kennitala *</label>
                  <input
                    id="kennitala"
                    name="kennitala"
                    value={formData.kennitala}
                    onChange={onChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sláðu inn kennitölu"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Símanúmer</label>
                  <input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sláðu inn símanúmer"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Netfang</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sláðu inn netfang"
                  />
                  {emailNotice && (
                    <p className="mt-2 text-sm text-blue-700">{emailNotice}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">Heimilisfang</label>
                  <input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sláðu inn heimilisfang"
                  />
                </div>

                <div>
                  <label htmlFor="ibudnumber" className="block text-sm font-medium text-gray-700 mb-2">Íbúðarnúmer (ef á við)</label>
                  <input
                    id="ibudnumber"
                    name="ibudnumber"
                    value={formData.ibudnumber}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                    placeholder="Sláðu inn íbúðarnúmer (ef á við)"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">Borg</label>
                  <input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sláðu inn borg"
                  />
                </div>

                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-2">Póstnúmer</label>
                  <input
                    id="postal_code"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sláðu inn póstnúmer"
                  />
                </div>
              </div>

              {success && (
                <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-md">
                  <p className="text-sm text-green-700">✓ Upplýsingar hafa verið uppfærðar!</p>
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-md">
                  <p className="text-sm text-red-700">✗ {error}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    if (fromOrder) router.back();
                    else router.push("/");
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {fromOrder ? "Til baka" : "Til baka á forsíðu"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Vista..." : "Vista breytingar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserInfoPage() {
  return (
    <Suspense fallback={null}>
      <UserInfoPageInner />
    </Suspense>
  );
}
