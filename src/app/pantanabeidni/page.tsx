"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authHeader } from "@/lib/auth-utils";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";

type Details = {
	name: string;
	email: string;
	address: string;
	complete: boolean;
	alreadySent: boolean;
};

export default function OrderRequestPage() {
	const router = useRouter();
	const { session, loading: authLoading } = useAuth();
	const [details, setDetails] = useState<Details | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [submitError, setSubmitError] = useState<string | null>(null);

	useEffect(() => {
		if (authLoading || session?.user) return;
		const id = window.setTimeout(() => {
			router.replace("/auth?redirect=/pantanabeidni");
		}, 600);
		return () => window.clearTimeout(id);
	}, [authLoading, session?.user?.id, router]);

	useEffect(() => {
		if (authLoading || !session?.user) return;

		let cancelled = false;
		const load = async () => {
			setLoadError(null);
			try {
				const headers = await authHeader();
				const res = await fetch("/api/pantanabeidni", { headers });
				const data = await res.json().catch(() => ({}));
				if (cancelled) return;
				if (res.status === 401) {
					router.replace("/auth?redirect=/pantanabeidni");
					return;
				}
				if (!res.ok) {
					setLoadError(data?.error || "Ekki tókst að sækja upplýsingar.");
					return;
				}
				setDetails({
					name: data.name || "",
					email: data.email || "",
					address: data.address || "",
					complete: Boolean(data.complete),
					alreadySent: Boolean(data.alreadySent),
				});
			} catch {
				if (!cancelled) setLoadError("Ekki tókst að sækja upplýsingar.");
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [authLoading, session?.user?.id, router]);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!details?.complete || details.alreadySent || status === "loading") return;
		setStatus("loading");
		setSubmitError(null);
		try {
			const headers = await authHeader();
			const res = await fetch("/api/pantanabeidni", {
				method: "POST",
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify({ message }),
			});
			const data = await res.json().catch(() => ({}));
			if (res.status === 401) {
				router.replace("/auth?redirect=/pantanabeidni");
				return;
			}
			if (data?.alreadySent) {
				setDetails((prev) => (prev ? { ...prev, alreadySent: true } : prev));
				setStatus("idle");
				return;
			}
			if (!res.ok) {
				setStatus("error");
				setSubmitError(data?.error || data?.message || "Ekki tókst að senda beiðnina.");
				return;
			}
			setStatus("success");
			setDetails((prev) => (prev ? { ...prev, alreadySent: true } : prev));
		} catch {
			setStatus("error");
			setSubmitError("Ekki tókst að senda beiðnina.");
		}
	};

	const fields = details
		? [
				{ label: "Nafn", value: details.name },
				{ label: "Netfang", value: details.email },
				{ label: "Heimilisfang", value: details.address },
			]
		: [];

	return (
		<section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Hafa samband</p>
			<h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Pöntunarbeiðni</h1>
			<p className="mt-4 text-base text-gray-600 leading-relaxed">
				Sendu inn beiðni um pöntun. Nafn, netfang og heimilisfang eru sótt af reikningnum þínum. Við sendum staðfestingu á netfangið þitt.
			</p>

			{authLoading || (session?.user && !details && !loadError) ? (
				<p className="mt-10 text-sm text-gray-500">Sæki upplýsingar…</p>
			) : null}

			{loadError ? (
				<p className="mt-8 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
			) : null}

			{details?.alreadySent ? (
				<p
					className={`mt-8 rounded-lg px-3 py-2 text-sm ${
						status === "success" ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-800"
					}`}
				>
					{status === "success"
						? "Beiðnin hefur verið send. Staðfesting er á leiðinni á netfangið þitt."
						: "Þú hefur þegar sent pöntunarbeiðni. Ekki er hægt að senda aðra."}
				</p>
			) : null}

			{details && !details.alreadySent ? (
				<form className="mt-8 space-y-6" onSubmit={onSubmit}>
					<dl className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
						{fields.map((field) => (
							<div key={field.label} className="px-4 py-3 sm:px-5">
								<dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{field.label}</dt>
								<dd className="mt-1 text-sm text-gray-900">{field.value || "—"}</dd>
							</div>
						))}
					</dl>

					{!details.complete ? (
						<p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
							Vantar nafn eða heimilisfang á reikningnum.{" "}
							<Link href="/notendaupplysingar" className="font-semibold underline underline-offset-2">
								Uppfæra notendaupplýsingar
							</Link>
						</p>
					) : null}

					<Textarea
						id="message"
						name="message"
						label="Skilaboð"
						rows={6}
						required
						maxLength={4000}
						placeholder="Lýstu pöntuninni sem þú vilt senda inn."
						value={message}
						onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
					/>

					<Button
						type="submit"
						className="disabled:cursor-not-allowed disabled:opacity-60"
						disabled={status === "loading" || !details.complete || message.trim().length === 0}
					>
						{status === "loading" ? "Sendi…" : "Senda beiðni"}
					</Button>

					{status === "error" && submitError ? (
						<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
					) : null}
				</form>
			) : null}
		</section>
	);
}
