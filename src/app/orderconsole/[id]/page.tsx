"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface ConsoleRow {
  id: string;
  nafn: string;
  verd: string;
  geymsluplass: string;
  numberofextracontrollers?: string | null;
  verdextracontrollers?: string | null;
  tengi: string;
}

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

export default function OrderConsolePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, session } = useAuth();
  const consoleIdParam = params.id as string;
  const [consoleItem, setConsoleItem] = useState<ConsoleRow | null>(null);
  const [itemLoading, setItemLoading] = useState<boolean>(true);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formData, setFormData] = useState({ message: '' });
  const loadedForUidRef = useRef<string | null>(null);

  // Selection passed from console page
  const [selection, setSelection] = useState<{ months: number; addons?: { skjár?: boolean; lyklaborð?: boolean; mus?: boolean }; insured?: boolean; finalPrice?: number } | null>(null);
  const [confirmNoInsurance, setConfirmNoInsurance] = useState(false);

  const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
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
          const parsed = JSON.parse(raw) as { months?: number; addons?: unknown; insured?: boolean; finalPrice?: number };
          const months = parsed.months && [1,3,6,12].includes(parsed.months) ? parsed.months : 3;
          const src = (parsed.addons ?? {}) as Record<string, unknown>;
          const mapped = {
            skjár: src['skjár'] === true || src['skjar'] === true,
            lyklaborð: src['lyklaborð'] === true || src['lyklabord'] === true,
            mus: src['mús'] === true || src['mus'] === true,
          };
          const insured = parsed.insured === true;
          const finalPrice = typeof parsed.finalPrice === 'number' && Number.isFinite(parsed.finalPrice) ? parsed.finalPrice : undefined;
          setSelection({ months, addons: mapped, insured, finalPrice });
        } else {
          setSelection({ months: 3, addons: {} });
        }
      }
    } catch {
      setSelection({ months: 3, addons: {} });
    }
  }, []);

  // Fetch selected console from DB
  useEffect(() => {
    let isMounted = true;
    const fetchConsole = async () => {
      if (!consoleIdParam) {
        setConsoleItem(null);
        setItemLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('gamingconsoles')
          .select('id, nafn, verd, geymsluplass, numberofextracontrollers, verdextracontrollers, tengi')
          .eq('id', consoleIdParam)
          .single();
        if (!isMounted) return;
        if (error) {
          setConsoleItem(null);
        } else {
          setConsoleItem(data as ConsoleRow);
        }
      } catch {
        setConsoleItem(null);
      } finally {
        if (isMounted) setItemLoading(false);
      }
    };
    fetchConsole();
    return () => { isMounted = false; };
  }, [consoleIdParam]);

  // Fetch user profile similar to product order page
  useEffect(() => {
    if (authLoading) return;
    if (!session?.user) {
      router.push(`/auth?redirect=/orderconsole/${encodeURIComponent(consoleIdParam)}`);
      return;
    }
    const uid = session.user.id;
    if (loadedForUidRef.current === uid && userProfile) return;
    if (user) {
      loadedForUidRef.current = uid;
      setUserProfile(user as unknown as UserProfile);
      setProfileError(null);
      return;
    }
    const loadProfile = async () => {
      try {
        setProfileError(null);
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('auth_uid', uid)
          .single();
        if (error) {
          throw error;
        }
        loadedForUidRef.current = uid;
        setUserProfile(profile as UserProfile);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('OrderConsole: Error loading profile:', { message });
        setProfileError('Tókst ekki að sækja notandaupplýsingar');
      }
    };
    loadProfile();
  }, [authLoading, session, user, consoleIdParam, router, userProfile]);

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
    maybeRefresh();
    const onFocus = () => { maybeRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [session?.user?.id]);

  const doSubmit = async () => {
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
      const trygging = selection?.insured === true;

      const generateOrderNumber = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let out = '';
        for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
        return out;
      };
      const orderNumber = generateOrderNumber();

      // Use finalPrice from console page if available; fallback to discounted console price
      let finalMonthlyPrice = selection?.finalPrice;
      if (!(typeof finalMonthlyPrice === 'number' && Number.isFinite(finalMonthlyPrice) && finalMonthlyPrice > 0)) {
        const baseDigits = (consoleItem?.verd || '').toString().replace(/\D+/g, '');
        const basePrice = parseInt(baseDigits, 10) || 0;
        const rate = months === 1 ? 0 : months === 3 ? 0.04 : months === 6 ? 0.08 : 0.12;
        const discountedRaw = Math.round(basePrice * (1 - rate));
        finalMonthlyPrice = Math.ceil(discountedRaw / 10) * 10;
      }

      const { data: inserted, error } = await supabase
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
            trygging,
            verd: finalMonthlyPrice,
            gamingpc_uuid: null,
            gamingconsole_uuid: consoleIdParam,
          },
        ])
        .select('id')
        .single();

      if (!error) {
        try {
          if (inserted?.id) {
            await fetch('/api/generate-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: inserted.id }),
            });
            const userEmail = session?.user?.email || '';
            if (userEmail) {
              fetch('/api/order/send-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: inserted.id, userEmail }),
              }).catch(() => {});
            }
          }
        } catch {}
        setSubmitStatus('success');
        setFormData({ message: '' });
        router.push('/dashboard');
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting console order:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selection?.insured) {
      setConfirmNoInsurance(true);
      return;
    }
    await doSubmit();
  };

  if (itemLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">Hleður vörunni…</div>
        </div>
      </div>
    );
  }

  if (!consoleItem) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Vara fannst ekki</h1>
            <p className="mt-4 text-gray-600">Þessi leikjatölva er ekki til.</p>
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
    <>
    <div className="min-h-screen bg-gray-50 py-12 pb-16 md:pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 whitespace-nowrap leading-tight">Staðfestu pöntunina þína</h1>
            
            {/* Product Summary */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Vara</h2>
              <div className="flex items-center justify-between mb-3 gap-3 md:gap-0">
                <h3 className="text-lg font-medium text-gray-900 truncate max-w-[65%] md:max-w-none">{consoleItem.nafn}</h3>
                <p className="text-2xl font-bold text-[var(--color-secondary)] whitespace-nowrap">
                  {(() => {
                    const selFinal = selection?.finalPrice;
                    if (typeof selFinal === 'number' && Number.isFinite(selFinal) && selFinal > 0) {
                      return `${selFinal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr/mánuði`;
                    }
                    const digits = (consoleItem.verd || '').replace(/\D+/g, '');
                    const base = parseInt(digits, 10) || 0;
                    const m = selection?.months ?? 1;
                    const rate = m === 1 ? 0 : m === 3 ? 0.04 : m === 6 ? 0.08 : 0.12;
                    const raw = Math.round(base * (1 - rate));
                    const rounded = Math.ceil(raw / 10) * 10;
                    return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') } kr/mánuði`;
                  })()}
                </p>
              </div>
              <div className="space-y-1 text-sm text-gray-700">
                <p><span className="font-medium">Geymslupláss:</span> {consoleItem.geymsluplass || '—'}</p>
                <p><span className="font-medium">Tengi:</span> {consoleItem.tengi || '—'}</p>
              </div>
            </div>

            {/* User Profile */}
            {userProfile && (
              <div className="bg-gray-50 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Notendaupplýsingar</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Nafn:</span> {userProfile.full_name || 'Ekki skráð'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Kennitala:</span> {userProfile.kennitala || 'Ekki skráð'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Sími:</span> {userProfile.phone || 'Ekki skráð'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Heimilisfang:</span> {userProfile.address || 'Ekki skráð'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Borg/Póstnúmer:</span> {userProfile.city || 'Ekki skráð'} {userProfile.postal_code || ''}
                    </p>
                    {userProfile.ibudnumber ? (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Íbúðarnúmer:</span> {userProfile.ibudnumber}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/notendaupplysingar?from=orderconsole`} 
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
                <p>
                  <span className="font-medium">Trygging:</span>{' '}
                  {selection?.insured ? 'Já' : 'Nei'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  placeholder="Eitthvað sem við þurfum að vita um pöntunina þína..."
                />
              </div>

              <div className="flex items-center justify-between">
                <button 
                  type="button"
                  onClick={() => router.back()} 
                  className="inline-flex items-center whitespace-nowrap px-3 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  ← Til baka
                </button>

                <div className="flex items-center gap-3">
                  <label htmlFor="acceptTerms" className="flex items-center gap-2 text-sm select-none">
                    <input
                      id="acceptTerms"
                      name="acceptTerms"
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    />
                    <span className="text-gray-700">
                      Ég hef lesið og samþykki <Link href="/legal" className="text-blue-600 hover:underline">skilmála</Link>
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting || !acceptedTerms}
                    className="px-4 py-2 bg-[var(--color-accent)] text-white font-medium rounded-md hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Sendi pöntun...' : 'Senda pöntun'}
                  </button>
                </div>
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
    {/* No-insurance confirmation modal */}
    {confirmNoInsurance ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmNoInsurance(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Án tryggingar?</h2>
          <p className="text-sm text-gray-700 mb-6">
            Ertu viss um að þú viljir leigja án tryggingar?
          </p>
          <div className="mb-4">
            <Link href="/legal" className="text-xs text-blue-600 hover:underline">Sjá skilmála</Link>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmNoInsurance(false)}
              className="px-4 py-2 text sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Loka
            </button>
            <button
              type="button"
              onClick={async () => { setConfirmNoInsurance(false); await doSubmit(); }}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-md hover:brightness-95"
            >
              Já
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}


