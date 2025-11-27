"use client";

import Link from "next/link";
import Image from "next/image";
import logo from "../../img/logo.png";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { debug } from "@/lib/debug";

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const { user, loading, session, signOut } = useAuth();

	// Quiet effect to keep hooks order stable
	useEffect(() => {}, []);

	// Debug render state to diagnose flicker or wrong visibility
	useEffect(() => {
		debug('Header/render', { loading, hasUser: !!user, hasSession: !!session });
	}, [loading, user, session]);

	// Get first name from full_name
	const getFirstName = (fullName: string) => {
		return fullName.split(' ')[0];
	};

	// Build a display label: prefer profile name, then auth metadata name, else full email
  const getDisplayLabel = () => {
    const metaFullName = (
      session?.user as { user_metadata?: { full_name?: string } } | undefined
    )?.user_metadata?.full_name as string | undefined;
		const name = user?.full_name || metaFullName;
		if (name && name.trim().length > 0) {
			return getFirstName(name.trim());
		}
		return session?.user?.email || 'Notandi';
	};

	// Close dropdown when clicking outside (supports touch/pointer on mobile)
	useEffect(() => {
		const handlePointerDown = (event: Event) => {
			if (!isUserMenuOpen) return;
			const target = event.target as HTMLElement | null;
			if (target && !target.closest('.user-menu-container')) {
				setIsUserMenuOpen(false);
			}
		};

		document.addEventListener('pointerdown', handlePointerDown, { passive: true } as AddEventListenerOptions);
		document.addEventListener('click', handlePointerDown, { passive: true } as AddEventListenerOptions);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown as EventListener);
			document.removeEventListener('click', handlePointerDown as EventListener);
		};
	}, [isUserMenuOpen]);

	return (
		<header className="relative z-40 border-b border-black/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded focus:bg-foreground focus:text-background">
				Skip to content
			</a>
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="flex h-14 items-center justify-between">
					<div className="flex items-center gap-3">
					<Link href="/" className="flex items-center gap-2">
						<Image src={logo} alt="TL" width={48} height={48} priority />
							<div className="leading-tight">
							<span className="block font-semibold tracking-tight text-xl sm:text-1xl">Tölvuleiga</span>
							<span className="block text-[var(--color-accent)] text-[10px] sm:text-xs opacity-80 mt-0 ml-0.5 sm:ml-1">Leigja · Spila · Skila</span>
							</div>
						</Link>
					</div>
					<nav aria-label="Primary" className="hidden md:flex items-center gap-5">
						<Link href="/about" className="hover:underline underline-offset-4">Um Okkur</Link>
						<Link href="/contact" className="hover:underline underline-offset-4">Hafa Samband</Link>
						{/* Auth controls: hide until auth check resolves; show signed-in menu if we have either profile or session user */}
						{!loading && (user || session?.user) ? (
							<div className="relative user-menu-container">
								<button
									onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
							className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
								>
								<svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
								<span className="text-gray-900 font-medium">
										{getDisplayLabel()}
									</span>
									<svg 
										className={`h-4 w-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} 
										fill="none" 
										viewBox="0 0 24 24" 
										stroke="currentColor"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								{isUserMenuOpen && (
									<div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
										{user?.isAdmin ? (
											<Link
												href="/stjornbord"
												className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
												onClick={() => setIsUserMenuOpen(false)}
											>
												<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
												</svg>
												Stjórnborð
											</Link>
										) : null}
										{user?.isAdmin ? (
											<Link
												href="/vorur"
												className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
												onClick={() => setIsUserMenuOpen(false)}
											>
												<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-3M4 7v10a2 2 0 002 2h12M4 7h16M4 7l4-4M8 3h7" />
												</svg>
												Vörur
											</Link>
										) : null}
										<Link
											href="/dashboard"
										className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
											onClick={() => setIsUserMenuOpen(false)}
										>
											<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
											</svg>
											Pantanir
										</Link>
										<Link
											href="/notendaupplysingar"
										className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
											onClick={() => setIsUserMenuOpen(false)}
										>
											<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
											</svg>
											Notendaupplýsingar
										</Link>
										<button
											onClick={() => {
												setIsUserMenuOpen(false);
												signOut();
											}}
									className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
										>
											<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 013-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
											</svg>
											Útskrá
										</button>
									</div>
								)}
							</div>
						) : !loading ? (
							<Link href="/auth?redirect=/dashboard" className="inline-flex items-center px-3.5 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-95">Mínar síður</Link>
						) : null}
					</nav>
					<button
						className="md:hidden inline-flex items-center justify-center rounded-md p-2 border border-black/10"
						aria-controls="mobile-menu"
						aria-expanded={isOpen}
						onClick={() => setIsOpen((v) => !v)}
						aria-label="Toggle menu"
					>
						<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							{isOpen ? (
								<path d="M18 6L6 18M6 6l12 12" />
							) : (
								<>
									<line x1="3" y1="6" x2="21" y2="6" />
									<line x1="3" y1="12" x2="21" y2="12" />
									<line x1="3" y1="18" x2="21" y2="18" />
								</>
							)}
						</svg>
					</button>
				</div>
			</div>
			{isOpen && (
				<div id="mobile-menu" className="md:hidden border-t border-black/10">
						<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-2">
						<Link href="/about" className="py-2" onClick={() => setIsOpen(false)}>Um Okkur</Link>
						<Link href="/contact" className="py-2" onClick={() => setIsOpen(false)}>Hafa Samband</Link>
						{!loading && (user || session?.user) ? (
							<div className="user-menu-container">
								<button
									onClick={() => setIsUserMenuOpen((v) => !v)}
									className="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
								>
									<span className="inline-flex items-center gap-2">
										<svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
										</svg>
										<span className="text-gray-900 font-medium">{getDisplayLabel()}</span>
									</span>
									<svg 
										className={`h-4 w-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								{isUserMenuOpen && (
									<div className="mt-1 w-full bg-white rounded-md border border-gray-200 py-1">
										{user?.isAdmin ? (
											<Link
													href="/stjornbord"
													className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
													onClick={() => { setIsUserMenuOpen(false); setIsOpen(false); }}
											>
												<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
												</svg>
												Stjórnborð
											</Link>
										) : null}
										{user?.isAdmin ? (
											<Link
													href="/vorur"
													className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
													onClick={() => { setIsUserMenuOpen(false); setIsOpen(false); }}
											>
												<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-3M4 7v10a2 2 0 002 2h12M4 7h16M4 7l4-4M8 3h7" />
												</svg>
												Vörur
											</Link>
										) : null}
										<Link
											href="/dashboard"
											className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
											onClick={() => { setIsUserMenuOpen(false); setIsOpen(false); }}
										>
											<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
											</svg>
											Pantanir
										</Link>
										<Link
											href="/notendaupplysingar"
											className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
											onClick={() => { setIsUserMenuOpen(false); setIsOpen(false); }}
										>
											<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
											</svg>
											Notendaupplýsingar
 										</Link>
										<button
											onClick={() => { setIsUserMenuOpen(false); setIsOpen(false); signOut(); }}
											className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
										>
											<svg className="h-4 w-4 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 013-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
											</svg>
											Útskrá
										</button>
									</div>
								)}
							</div>
						) : !loading ? (
							<Link href="/auth?redirect=/dashboard" className="py-2 inline-flex items-center px-3.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-95" onClick={() => setIsOpen(false)}>Mínar síður</Link>
						) : null}
					</div>
				</div>
			)}
		</header>
	);
}


