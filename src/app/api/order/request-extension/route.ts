import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/email";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const {
			orderId,
			months,
			newMonthlyPrice,
			currentMonthlyPrice,
			timabilFra,
			timabilTil,
			userName,
		} = body as {
			orderId?: string;
			months?: number;
			newMonthlyPrice?: number;
			currentMonthlyPrice?: number;
			timabilFra?: string | null;
			timabilTil?: string | null;
			userName?: string;
		};

		if (!orderId || !months || !newMonthlyPrice) {
			return NextResponse.json({ error: "Vantar gögn" }, { status: 400 });
		}

			// Compute new period (start at current timabilTil, end = timabilTil + months)
			const addMonthsPreservingEnd = (date: Date, m: number) => {
				const d = new Date(date);
				const day = d.getDate();
				d.setMonth(d.getMonth() + m);
				if (d.getDate() < day) d.setDate(0);
				return d;
			};
			const startDate = timabilTil ? new Date(timabilTil) : null;
			const newStart = startDate && Number.isFinite(startDate.getTime()) ? startDate : null;
			const newEnd = newStart ? addMonthsPreservingEnd(newStart, months!) : null;

		const admin = "tolvuleiga@tolvuleiga.is";
		const subject = "Ósk um framlengingu";

		const formatDate = (d?: string | null) => {
			if (!d) return "—";
			const dt = new Date(d);
			return Number.isFinite(dt.getTime()) ? dt.toLocaleDateString("is-IS") : "—";
		};
		const formatIsk = (n?: number) => {
			const v = Number(n || 0);
			return `${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kr`;
		};

		const text =
			`${userName || "Viðskiptavinur"} óskar eftir framlengingu\n\n` +
			`Núverandi tímabil - ${formatDate(timabilFra)} til ${formatDate(timabilTil)}\n\n` +
			`Ósk um ${months} auka mánuði\n\n` +
			`Núverandi gjald - ${formatIsk(currentMonthlyPrice)}\n` +
			`Nýtt gjald - ${formatIsk(newMonthlyPrice)}\n\n` +
			`Bestu kveðjur`;

			// Insert framlenging row
			const supabase = getServerSupabase();
			const cleanPrice = String(Number(newMonthlyPrice || 0)); // store numeric string
			let created: { id: string } | null = null;
			try {
				const { data, error } = await supabase
					.from("framlengingar")
					.insert([{
						approved: false,
						nafn: userName || null,
						order_id: orderId,
						newtimabilfra: newStart ? newStart.toISOString() : null,
						newtimabiltil: newEnd ? newEnd.toISOString() : null,
						newverd: cleanPrice,
					}])
					.select("id")
					.single();
				if (!error && data) {
					created = data as { id: string };
				}
			} catch {
				// swallow insert errors; still send email
			}

		await sendMail({
			to: admin,
			subject,
			text,
		});

		return NextResponse.json({ ok: true, framlengingId: created?.id || null });
	} catch (e) {
		return NextResponse.json({ error: "Villa kom upp" }, { status: 500 });
	}
}


