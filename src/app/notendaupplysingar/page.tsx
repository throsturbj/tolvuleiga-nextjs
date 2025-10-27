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
}

function UserInfoPageInner() {
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const uid = session?.user?.id || null;
  const fromOrder = searchParams.get("from") === "order";

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
  });

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
                phone: "",
                address: "",
                city: "",
                postal_code: "",
              })
              .select()
              .single();
            if (createError) throw createError;
            if (!cancelled) {
              setProfile(created as UserProfile);
              setFormData({
                full_name: created.full_name || "",
                phone: created.phone || "",
                address: created.address || "",
                city: created.city || "",
                postal_code: created.postal_code || "",
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
              phone: data.phone || "",
              address: data.address || "",
              city: data.city || "",
              postal_code: data.postal_code || "",
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
    setSuccess(false);

    try {
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hleður...</h1>
          <p className="text-gray-600 dark:text-gray-300">Sæki notandaupplýsingar...</p>
        </div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Innskráning nauðsynleg</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">Þú verður að skrá þig inn til að skoða notandaupplýsingar.</p>
          <button
            onClick={() => router.push("/auth?redirect=/notendaupplysingar")}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Skrá inn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Notendaupplýsingar</h1>
            <p className="text-gray-600 dark:text-gray-300">Breyta og uppfæra þínar notandaupplýsingar</p>
          </div>

          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Tölvupóstur</h2>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-1">Netfang</p>
                <p className="font-medium text-gray-900 dark:text-white">{session?.user?.email || "Ekki skráð"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ekki hægt að breyta hér.</p>
              </div>
            </div>

            <form onSubmit={onSubmit}>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Upplýsingar sem hægt er að breyta</h2>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fullt nafn *</label>
                  <input
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={onChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Sláðu inn fullt nafn"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Símanúmer</label>
                  <input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Sláðu inn símanúmer"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Heimilisfang</label>
                  <input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Sláðu inn heimilisfang"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Borg</label>
                  <input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Sláðu inn borg"
                  />
                </div>

                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Póstnúmer</label>
                  <input
                    id="postal_code"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Sláðu inn póstnúmer"
                  />
                </div>
              </div>

              {success && (
                <div className="mt-6 p-4 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-md">
                  <p className="text-sm text-green-700 dark:text-green-300">✓ Upplýsingar hafa verið uppfærðar!</p>
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300">✗ {error}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    if (fromOrder) router.back();
                    else router.push("/");
                  }}
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-6 py-3 text-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {fromOrder ? "Til baka" : "Til baka á forsíðu"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-md bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
