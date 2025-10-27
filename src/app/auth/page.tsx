"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signIn, signUp, session } = useAuth();
  const redirectTo = searchParams.get('redirect') || '/';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    address: '',
    city: '',
    postal_code: ''
  });

  const hasNavigated = useRef(false);

  // Redirect if already authenticated - rely on session only
  useEffect(() => {
    console.log('Auth: Session state changed:', session);
    console.log('Auth: User state changed:', user);
    if (session?.user && !hasNavigated.current) {
      hasNavigated.current = true;
      console.log('Auth: User and session found, redirecting to:', redirectTo);
      router.replace(redirectTo);
    }
  }, [session, user, router, redirectTo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Sign in
      const { error: authError } = await signIn(formData.email, formData.password);
      
      if (authError) {
        setError(authError.message);
        return;
      }

      // Redirect after successful auth
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace(redirectTo);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('Óvænt villa kom upp');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        setError('Lykilorðin passa ekki saman');
        return;
      }

      // Sign up
      const { data, error: authError } = await signUp(formData.email, formData.password, {
        full_name: formData.name,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postal_code,
      });
      
      if (authError) {
        setError(authError.message);
        return;
      }

      // Create user profile
      if (data.user) {
        console.log('Auth: User created, creating profile for:', data.user.id);
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            auth_uid: data.user.id,
            full_name: formData.name,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            postal_code: formData.postal_code
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          setError('Villa kom upp við að búa til notandaspjald');
          return;
        }

        console.log('Auth: Profile created successfully');
        
        // Force AuthContext to refresh by getting the current session
        console.log('Auth: Forcing session refresh...');
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Auth: Error getting session:', sessionError);
        } else {
          console.log('Auth: Current session:', currentSession?.user?.id);
        }
        
        // Wait for both session and user to be available
        console.log('Auth: Waiting for session and user to be available...');
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds max wait
        
        while (attempts < maxAttempts) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user && user) {
            console.log('Auth: Session and user available, redirecting...');
            break;
          }
          console.log(`Auth: Attempt ${attempts + 1}: Session=${!!currentSession?.user}, User=${!!user}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          console.log('Auth: Timeout waiting for session/user, redirecting anyway...');
        }
      }

      // Redirect after successful auth
      console.log('Auth: About to redirect to:', redirectTo);
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace(redirectTo);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('Óvænt villa kom upp');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left Side - Sign In */}
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Skrá inn
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Skráðu þig inn á reikninginn þinn
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-6">
                <div>
                  <label htmlFor="signin-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Netfang
                  </label>
                  <input
                    type="email"
                    id="signin-email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="signin-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lykilorð
                  </label>
                  <input
                    type="password"
                    id="signin-password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Skrái inn...' : 'Skrá inn'}
                </button>
              </form>

              <div className="mt-6">
                <Link
                  href="/"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm"
                >
                  ← Til baka á forsíðu
                </Link>
              </div>
            </div>

            {/* Right Side - Sign Up */}
            <div className="p-8 bg-gray-50 dark:bg-gray-700">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Búa til reikning
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Búðu til nýjan reikning til að panta tölvur
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nafn *
                  </label>
                  <input
                    type="text"
                    id="signup-name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Netfang *
                  </label>
                  <input
                    type="email"
                    id="signup-email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="signup-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sími *
                  </label>
                  <input
                    type="tel"
                    id="signup-phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="signup-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Heimilisfang *
                  </label>
                  <input
                    type="text"
                    id="signup-address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="signup-city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Borg *
                    </label>
                    <input
                      type="text"
                      id="signup-city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-postal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Póstnúmer *
                    </label>
                    <input
                      type="text"
                      id="signup-postal"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lykilorð *
                  </label>
                  <input
                    type="password"
                    id="signup-password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Staðfesta lykilorð *
                  </label>
                  <input
                    type="password"
                    id="signup-confirm-password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Býr til reikning...' : 'Búa til reikning'}
                </button>
              </form>

              <div className="mt-6">
                <Link
                  href="/"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm"
                >
                  ← Til baka á forsíðu
                </Link>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-8 py-4 bg-red-50 dark:bg-red-900 border-t border-red-200 dark:border-red-700">
              <p className="text-sm text-red-700 dark:text-red-300">
                ✗ {error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
