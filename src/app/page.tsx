"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  interface GamingPCItem {
    id: number;
    name: string;
    verd: string;
    cpu: string;
    gpu: string;
    storage: string;
  }

  const [items, setItems] = useState<GamingPCItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchItems = async () => {
      try {
        const { data, error } = await supabase
          .from("GamingPC")
          .select("id, name, verd, cpu, gpu, storage")
          .order("created_at", { ascending: false });
        if (!isMounted) return;
        if (error) {
          setItems([]);
        } else {
          setItems((data as GamingPCItem[]) || []);
        }
      } catch {
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchItems();
    return () => { isMounted = false; };
  }, []);
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-[var(--color-primary)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
              <span className="text-[var(--color-secondary)]">Tölvuleiga</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Við bjóðum upp á hágæða leikjatölvur á sanngjörnu verði – fyrir þá sem vilja afköst, gæði og áreiðanleika í einni vél.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
                Sjá Vörur
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
                <svg className="h-6 w-6 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Nýjar tölvur</h3>
              <p className="mt-2 text-gray-600">Nýjar tölvur með nýjustu tækni, öflugustu örgjörvunum og glæsilegustu íhlutunum – tilbúnar fyrir allt sem þú krefst.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
                <svg className="h-6 w-6 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Auðveltar uppfærslur</h3>
              <p className="mt-2 text-gray-600">Auðvelt er að uppfæra íhluti samkvæmt samningi, svo tölvan þín heldur alltaf í við nýjustu tækni.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
                <svg className="h-6 w-6 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Besta verðið</h3>
              <p className="mt-2 text-gray-600">Það er engin þörf á að eyða fúlgum fjár í nýja tölvu. Leigðu hjá okkur á sanngjörnu verði og fáðu hámarksafköst án þess að tæma veskið.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties Preview */}
      <section id="products" className="bg-gray-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Tölvur
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Finndu tölvu sem passar þér best.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((pc) => (
              <div key={pc.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="aspect-video bg-gray-200" />
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900">{pc.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {pc.gpu} · {pc.cpu} · {pc.storage}
                  </p>
                  <p className="text-xl font-bold text-[var(--color-secondary)] mt-2">{pc.verd}/mánuði</p>
                  <Link
                    href={`/product/${pc.id}`}
                    className="mt-4 inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
                  >
                    Sjá nánar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
