"use client";

import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";

export default function ContactPage() {
	return (
		<section className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-10">
			<h1 className="text-2xl font-semibold tracking-tight mb-6">Sendu á okkur línu!</h1>
			<form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
				<Input
					id="name"
					name="name"
					label="Nafn"
					required
				/>
				<Input
					id="email"
					type="email"
					name="email"
					label="Netfang"
					required
				/>
				<Textarea
					id="message"
					name="message"
					label="Skilaboð"
					rows={5}
				/>
				<Button type="submit">Senda</Button>
			</form>
		</section>
	);
}

