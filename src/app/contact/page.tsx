"use client";

import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";

export default function ContactPage() {
	return (
		<section className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8 py-10">
			<h1 className="text-2xl font-semibold tracking-tight mb-6">Contact</h1>
			<form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
				<Input
					id="name"
					name="name"
					label="Name"
					required
				/>
				<Input
					id="email"
					type="email"
					name="email"
					label="Email"
					required
				/>
				<Textarea
					id="message"
					name="message"
					label="Message"
					rows={5}
				/>
				<Button type="submit">Send</Button>
			</form>
		</section>
	);
}

