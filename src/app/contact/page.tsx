"use client";

import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function ContactPage() {
	const [form, setForm] = useState({ name: "", email: "", message: "" });
	const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "ratelimited">("idle");
	const [error, setError] = useState<string | null>(null);
	const { user } = useAuth();

	useEffect(() => {
		if (user?.email && !form.email) {
			setForm((f) => ({ ...f, email: user.email || "" }));
		}
	}, [user?.email, form.email]);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus("loading");
		setError(null);
		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			const data = await res.json();
			if (res.status === 429 && data?.rateLimited) {
				setStatus("ratelimited");
				setError(data.message || "Þú mátt aðeins senda skilaboð annað slagið.");
				return;
			}
			if (!res.ok) {
				setStatus("error");
				setError(data?.error || "Ekki tókst að senda skilaboðin.");
				return;
			}
			setStatus("success");
			setForm({ name: "", email: "", message: "" });
		} catch {
			setStatus("error");
			setError("Ekki tókst að senda skilaboðin.");
		}
	};

	return (
		<section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
			<div className="max-w-2xl">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Hafa samband</p>
				<h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Við erum hér til að aðstoða</h1>
				<p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
					Hvort sem þú ert með spurningu um leigu, pöntun, afhendingu eða þarft ráðleggingar um búnað, þá tökum við vel á móti fyrirspurnum. Sendu okkur línu eða hringdu. Við svörum yfirleitt innan eins virks dags.
				</p>
			</div>

			<div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
				<aside className="space-y-4">
					<a
						href="tel:+3547730397"
						className="block rounded-2xl bg-[var(--color-secondary)] p-6 text-white shadow-sm hover:brightness-110"
					>
						<p className="text-xs font-semibold uppercase tracking-wide text-white/70">Sími</p>
						<p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">773 0397</p>
						<p className="mt-2 text-sm text-white/75">Hringdu beint. Við svörum sem fyrst.</p>
					</a>

					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Netfang</p>
						<a href="mailto:tolvuleiga@tolvuleiga.is" className="mt-2 block text-lg font-semibold text-gray-900 hover:text-[var(--color-accent)]">
							tolvuleiga@tolvuleiga.is
						</a>
						<p className="mt-2 text-sm text-gray-500">Best fyrir nákvæmar fyrirspurnir, tilboð og fylgiskjöl.</p>
					</div>

					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fyrirtækið</p>
						<p className="mt-2 font-semibold text-gray-900">BGÞ ehf. · Tölvuleiga</p>
						<p className="mt-1 text-sm text-gray-600">Kennitala 490925 0820</p>
						<p className="mt-3 text-sm text-gray-500 leading-relaxed">
							Við leigjum fartölvur, borðtölvur, leikjatölvur, spjaldtölvur og skjáir. Allur búnaður er yfirfarinn og tilbúinn við afhendingu.
						</p>
					</div>

					<div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
						<p className="font-semibold text-gray-900">Hvað getum við aðstoðað með?</p>
						<ul className="mt-3 space-y-2 text-sm text-gray-600">
							<li>Leigutímabil, verð og trygging</li>
							<li>Staða pöntunar eða afhending</li>
							<li>Ráðleggingar um búnað fyrir vinnu, nám eða leiki</li>
							<li>Fyrirtækjaleiga og tímabundnar lausnir</li>
						</ul>
					</div>
				</aside>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
					<h2 className="text-xl font-semibold text-gray-900">Sendu okkur skilaboð</h2>
					<p className="mt-2 text-sm text-gray-500">
						Fylltu út formið og við höfum samband eins fljótt og auðið er. Ef málið er brýnt er best að hringja í{" "}
						<a href="tel:+3547730397" className="font-semibold text-gray-900 underline decoration-[var(--color-accent)] underline-offset-2">
							773 0397
						</a>
						.
					</p>
					<form className="mt-6 space-y-4" onSubmit={onSubmit}>
						<Input
							id="name"
							name="name"
							label="Nafn"
							required
							value={form.name}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))}
						/>
						<Input
							id="email"
							type="email"
							name="email"
							label="Netfang"
							required
							value={form.email}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, email: e.target.value }))}
						/>
						<Textarea
							id="message"
							name="message"
							label="Skilaboð"
							rows={6}
							required
							placeholder="Lýstu því sem þú þarft, t.d. vara, tímabil eða spurning um pöntun."
							value={form.message}
							onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, message: e.target.value }))}
						/>
						<Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto">
							{status === "loading" ? "Sendi…" : "Senda skilaboð"}
						</Button>
					</form>

					{status === "success" && (
						<p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
							Skilaboðin hafa verið send. Við höfum samband eins fljótt og kostur er. Takk fyrir.
						</p>
					)}
					{(status === "error" || status === "ratelimited") && (
						<p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
					)}
					<p className="mt-6 text-xs text-gray-400">
						Með því að senda formið samþykkir þú að við notum upplýsingarnar eingöngu til að svara fyrirspurninni.
					</p>
				</div>
			</div>
		</section>
	);
}
