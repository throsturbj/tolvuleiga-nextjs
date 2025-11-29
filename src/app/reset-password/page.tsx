"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [status, setStatus] = useState<"idle" | "checking" | "ready" | "submitting" | "success" | "error">("checking");
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				// Try to establish session from URL hash tokens if present
				if (typeof window !== "undefined") {
					const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
					if (hash) {
						const params = new URLSearchParams(hash)
						const access_token = params.get("access_token") || undefined
						const refresh_token = params.get("refresh_token") || undefined
						if (access_token && refresh_token) {
							await supabase.auth.setSession({ access_token, refresh_token })
							// Clean the hash from the URL to avoid confusion
							try {
								const url = new URL(window.location.href)
								url.hash = ""
								window.history.replaceState({}, "", url.toString())
							} catch {}
						}
					}
				}

				// Check for an active session
				const { data } = await supabase.auth.getSession();
				if (!cancelled) {
					if (data.session?.user) {
						setStatus("ready");
					} else {
						setStatus("error");
						setMessage("Tókst ekki að staðfesta endursetningu. Opnaðu hlekkinn aftur úr póstinum.");
					}
				}
			} catch {
				if (!cancelled) {
					setStatus("error");
					setMessage("Tókst ekki að staðfesta endursetningu. Reyndu aftur.");
				}
			}
		})();
		return () => { cancelled = true; };
	}, []);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (password.length < 6) {
			setMessage("Lykilorð þarf að vera að minnsta kosti 6 stafir.");
			return;
		}
		if (password !== confirm) {
			setMessage("Lykilorðin passa ekki saman.");
			return;
		}
		setStatus("submitting");
		setMessage(null);
		const { error } = await supabase.auth.updateUser({ password });
		if (error) {
			setStatus("error");
			setMessage(error.message || "Tókst ekki að uppfæra lykilorð.");
			return;
		}
		setStatus("success");
		setMessage("Lykilorð hefur verið uppfært. Þú getur nú skráð þig inn.");
		setTimeout(() => router.replace("/auth"), 1500);
	};

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm">
				<h1 className="text-2xl font-bold text-gray-900 mb-2">Endursetja lykilorð</h1>
				<p className="text-gray-600 mb-6">Veldu nýtt lykilorð fyrir reikninginn þinn.</p>

				<form onSubmit={onSubmit} className="space-y-4">
					<div>
						<label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
							Lykilorð
						</label>
						<input
							id="new-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)]"
							disabled={status !== "ready" && status !== "error"}
							required
						/>
					</div>

					<div>
						<label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
							Staðfesta lykilorð
						</label>
						<input
							id="confirm-password"
							type="password"
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)]"
							disabled={status !== "ready" && status !== "error"}
							required
						/>
					</div>

					<button
						type="submit"
						disabled={status !== "ready" && status !== "error"}
						className="w-full rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{status === "submitting" ? "Uppfæri..." : "Uppfæra lykilorð"}
					</button>
				</form>

				{message && (
					<p className={`mt-4 text-sm ${status === "error" ? "text-red-600" : "text-gray-700"}`}>
						{message}
					</p>
				)}
			</div>
		</div>
	);
}


