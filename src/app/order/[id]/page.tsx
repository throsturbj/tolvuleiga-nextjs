"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
//
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface Product {
  id: string;
  title: string;
  beds: string;
  baths: string;
  sqft: string;
  price: string;
}

interface UserProfile {
  id: string;
  auth_uid: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
}

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, session } = useAuth();
  const productId = params.id as string;

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  // Removed unused loading state
  const [profileError, setProfileError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    message: ''
  });
  const loadedForUidRef = useRef<string | null>(null);

  // Selection passed from product page
  const [selection, setSelection] = useState<{ months: number; addons?: { skjár?: boolean; lyklaborð?: boolean; mus?: boolean } } | null>(null);

  const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // handle month overflow (e.g., Jan 31 + 1 month)
    if (d.getDate() < day) {
      d.setDate(0);
    }
    return d;
  };

  // Load selection from sessionStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem('orderSelection');
        if (raw) {
          const parsed = JSON.parse(raw) as { months?: number; addons?: unknown };
          const months = parsed.months && [1,3,6,12].includes(parsed.months) ? parsed.months : 3;
          const src = (parsed.addons ?? {}) as Record<string, unknown>;
          const mapped = {
            skjár: src['skjár'] === true || src['skjar'] === true,
            lyklaborð: src['lyklaborð'] === true || src['lyklabord'] === true,
            mus: src['mús'] === true || src['mus'] === true,
          };
          setSelection({ months, addons: mapped });
        } else {
          setSelection({ months: 3, addons: {} });
        }
      }
    } catch {
      setSelection({ months: 3, addons: {} });
    }
  }, []);

  // Product data - same as in product page
  const products: Record<string, Product> = {
    "tolva-1": {
      id: "tolva-1",
      title: "Tölva 1",
      beds: "Nvidia RTX 5080",
      baths: "Ryzen 9",
      sqft: "1 TB SSD Samsung 990",
      price: "24990 kr"
    },
    "tolva-2": {
      id: "tolva-2", 
      title: "Tölva 2",
      beds: "Nvidia RTX 5070",
      baths: "Ryzen 7",
      sqft: "1 TB SSD Samsung 990",
      price: "19990 kr"
    },
    "playstation-5": {
      id: "playstation-5",
      title: "Playstation 5",
      beds: "4K@120 Hz",
      baths: "1 TB SSD",
      sqft: "8K leikjaspilun",
      price: "14990 kr"
    }
  };

  const product = products[productId];

  // Fetch user profile: prefer AuthContext user; otherwise load from Supabase; redirect if no session
  useEffect(() => {
    // If auth is still loading, wait
    if (authLoading) {
      return;
    }

    // If no session, redirect
    if (!session?.user) {
      router.push(`/auth?redirect=/order/${productId}`);
      return;
    }

    const uid = session.user.id;

    // If we already loaded profile for this UID and have one, skip
    if (loadedForUidRef.current === uid && userProfile) {
      return;
    }

    // If AuthContext provided a user profile, use it immediately
    if (user) {
      loadedForUidRef.current = uid;
      setUserProfile(user);
      setProfileError(null);
      return;
    }

    // Otherwise fetch from Supabase
    const loadProfile = async () => {
      try {
        setProfileError(null);
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('auth_uid', uid)
          .single();

        if (error) {
          if ((error as { code?: string }).code === 'PGRST116') {
            const basicProfile: UserProfile = {
              id: uid,
              auth_uid: uid,
              full_name: '',
              phone: '',
              address: '',
              city: '',
              postal_code: ''
            };
            loadedForUidRef.current = uid;
            setUserProfile(basicProfile);
            return;
          }
          throw error;
        }

        loadedForUidRef.current = uid;
        setUserProfile(profile as UserProfile);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Order: Error loading profile:', {
          message,
        });
        setProfileError('Tókst ekki að sækja notandaupplýsingar');
      }
    };

    loadProfile();
  }, [authLoading, session, user, productId, router, userProfile]);

  // Refresh profile on return from profile page
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    const maybeRefresh = async () => {
      try {
        if (typeof window === 'undefined') return;
        const flag = window.sessionStorage.getItem('profileUpdated');
        if (flag === '1') {
          window.sessionStorage.removeItem('profileUpdated');
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('auth_uid', uid)
            .single();
          if (!error && data) {
            setUserProfile(data as UserProfile);
          }
        }
      } catch {}
    };

    // Check immediately and also on focus/visibility
    maybeRefresh();
    const onFocus = () => { maybeRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [session?.user?.id]);

  // Build an effective profile to show while DB profile is loading or missing
  const effectiveProfile: UserProfile | null = (() => {
    if (!session?.user) return null;
    if (userProfile) return userProfile;
    if (user) return user as unknown as UserProfile;
    const meta = (session.user as { user_metadata?: Record<string, unknown> }).user_metadata || {};
    return {
      id: session.user.id,
      auth_uid: session.user.id,
      full_name: typeof meta.full_name === 'string' ? meta.full_name : '',
      phone: typeof meta.phone === 'string' ? meta.phone : '',
      address: typeof meta.address === 'string' ? meta.address : '',
      city: typeof meta.city === 'string' ? meta.city : '',
      postal_code: typeof meta.postal_code === 'string' ? meta.postal_code : '',
    };
  })();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const now = new Date();
      const months = selection?.months ?? 3;
      const to = addMonths(now, months);

      const a = (selection?.addons ?? {}) as Record<string, boolean>;
      const skjar = !!(a['skjár'] || a['skjar']);
      const lyklabord = !!(a['lyklaborð'] || a['lyklabord']);
      const mus = !!(a['mús'] || a['mus']);

      const generateOrderNumber = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let out = '';
        for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
        return out;
      };
      const orderNumber = generateOrderNumber();

      const { error } = await supabase
        .from('orders')
        .insert([
          {
            auth_uid: session?.user?.id ?? null,
            status: 'Undirbúningur',
            orderNumber,
            timabilFra: now.toISOString(),
            timabilTil: to.toISOString(),
            skjar,
            lyklabord,
            mus,
          },
        ]);

      if (!error) {
        setSubmitStatus('success');
        setFormData({ message: '' });
        // Navigate to dashboard after successful insert
        router.push('/dashboard');
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Vörur fannst ekki</h1>
            <p className="mt-4 text-gray-600">Þessi vara er ekki til.</p>
            <button onClick={() => router.back()} type="button" className="mt-6 inline-flex items-center px-3.5 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--color-accent)] hover:brightness-95">
              Fara til baka í vörulista
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              Hleður...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Villa kom upp</h1>
            <p className="mt-4 text-gray-600">{profileError}</p>
            <button onClick={() => router.back()} type="button" className="mt-6 inline-flex items-center px-3.5 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--color-accent)] hover:brightness-95">
              Fara til baka í vörulista
          </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Staðfestu pöntunina þína</h1>
            
            {/* Product Summary */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Vara</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                  <h3 className="text-lg font-medium text-gray-900">{product.title}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Vinnsluminni:</span> {product.beds}</p>
                    <p><span className="font-medium">Örgjörvi:</span> {product.baths}</p>
                    <p><span className="font-medium">Geymsla:</span> {product.sqft}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[var(--color-secondary)]">{product.price}</p>
                </div>
              </div>
            </div>

            {/* User Profile */}
            {effectiveProfile && (
              <div className="bg-gray-50 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Notendaupplýsingar</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Nafn:</span> {effectiveProfile.full_name || 'Ekki skráð'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Sími:</span> {effectiveProfile.phone || 'Ekki skráð'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Heimilisfang:</span> {effectiveProfile.address || 'Ekki skráð'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Borg/Póstnúmer:</span> {effectiveProfile.city || 'Ekki skráð'} {effectiveProfile.postal_code || ''}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/notendaupplysingar?from=order`} 
                    className="text-[var(--color-secondary)] hover:opacity-80 text-sm font-medium"
                  >
                    Uppfæra notendaupplýsingar →
                  </Link>
                </div>
              </div>
            )}

            {/* Rental Selection Summary */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Leigutímabil og aukahlutir</h2>
              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-medium">Byrjun tímabils:</span>{' '}
                  {(() => { const now = new Date(); return now.toLocaleDateString('is-IS'); })()}
                </p>
                <p>
                  <span className="font-medium">Tímabil lýkur:</span>{' '}
                  {(() => { const now = new Date(); const months = selection?.months ?? 3; const to = addMonths(now, months); return to.toLocaleDateString('is-IS'); })()}
                </p>
                {(() => {
                  const a = (selection?.addons ?? {}) as Record<string, boolean>;
                  const list: string[] = [];
                  if (a['skjár']) list.push('Skjár');
                  if (a['lyklaborð'] || a['lyklabord']) list.push('Lyklaborð');
                  if (a['mús'] || a['mus']) list.push('Mús');
                  return list.length > 0 ? (
                    <p><span className="font-medium">Aukahlutir -</span> {list.join(', ')}</p>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Order Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Skilaboð (valfrjálst)
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Eitthvað sem við þurfum að vita um pöntunina þína..."
                />
              </div>

              <div className="flex items-center justify-between">
                <button 
                  type="button"
                  onClick={() => router.back()} 
                  className="text-gray-600 hover:text-gray-800 font-medium"
                >
                  ← Til baka
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[var(--color-accent)] text-white font-medium rounded-md hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sendi pöntun...' : 'Senda pöntun'}
                </button>
              </div>
            </form>

            {/* Status Messages */}
            {submitStatus === 'success' && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Pöntun send!
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Pöntunin hefur verið send. Við verðum í sambandi við þig fljótlega.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Villa kom upp
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>Ekki tókst að senda pöntunina. Vinsamlegast reyndu aftur.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}