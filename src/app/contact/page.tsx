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
		<section className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-10">
			<h1 className="text-2xl font-semibold tracking-tight mb-6">Sendu á okkur línu!</h1>
			<form className="space-y-4" onSubmit={onSubmit}>
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
					rows={5}
					required
					value={form.message}
					onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, message: e.target.value }))}
				/>
				<Button type="submit" disabled={status === "loading"}>{status === "loading" ? "Sendi…" : "Senda"}</Button>
			</form>

			{status === "success" && (
				<p className="mt-4 text-green-700">Skilaboðin hafa verið send. Þakka þér fyrir!</p>
			)}
			{(status === "error" || status === "ratelimited") && (
				<p className="mt-4 text-red-700">{error}</p>
			)}
		</section>
	);
}

