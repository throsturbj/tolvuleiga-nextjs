"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const { user, loading, session, signOut } = useAuth();

	// Quiet effect to keep hooks order stable
	useEffect(() => {}, []);

	// Get first name from full_name
	const getFirstName = (fullName: string) => {
		return fullName.split(' ')[0];
	};

	// Build a display label: prefer profile name, then auth metadata name, else full email
	const getDisplayLabel = () => {
		const metaFullName = (session?.user as any)?.user_metadata?.full_name as string | undefined;
		const name = user?.full_name || metaFullName;
		if (name && name.trim().length > 0) {
			return getFirstName(name.trim());
		}
		return session?.user?.email || 'Notandi';
	};

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (isUserMenuOpen) {
				const target = event.target as HTMLElement;
				if (!target.closest('.user-menu-container')) {
					setIsUserMenuOpen(false);
				}
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isUserMenuOpen]);

	return (
		<header className="border-b border-black/10 dark:border-white/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded focus:bg-foreground focus:text-background">
				Skip to content
			</a>
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					<Link href="/" className="font-semibold tracking-tight text-lg">
						Tölvuleiga
					</Link>
					<nav aria-label="Primary" className="hidden md:flex items-center gap-6">
						<Link href="/about" className="hover:underline underline-offset-4">Um Okkur</Link>
						<Link href="/contact" className="hover:underline underline-offset-4">Hafa Samband</Link>
						{/* Auth controls: hide until auth check resolves; show either signed-in menu or signed-out link */}
						{!loading && session?.user ? (
							<div className="relative user-menu-container">
								<button
									onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
									className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								>
									<svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
									<span className="text-gray-900 dark:text-white font-medium">
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
									<div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
										<Link
											href="/dashboard"
											className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
											className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
											className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
							<Link href="/auth?redirect=/dashboard" className="hover:underline underline-offset-4">Mínar síður</Link>
						) : null}
					</nav>
					<button
						className="md:hidden inline-flex items-center justify-center rounded-md p-2 border border-black/10 dark:border-white/10"
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
				<div id="mobile-menu" className="md:hidden border-t border-black/10 dark:border-white/10">
					<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-2">
						<Link href="/about" className="py-2">Um Okkur</Link>
						<Link href="/contact" className="py-2">Hafa Samband</Link>
						{!loading && session?.user ? (
							<>
									<Link href="/dashboard" className="py-2">
										{getDisplayLabel()}
									</Link>
								<button
									onClick={() => {
										signOut();
									}}
									className="py-2 text-left text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
								>
									Útskrá
								</button>
							</>
						) : !loading ? (
							<Link href="/auth?redirect=/dashboard" className="py-2">Mínar síður</Link>
						) : null}
					</div>
				</div>
			)}
		</header>
	);
}


