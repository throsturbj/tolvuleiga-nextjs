import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { sendContactEmail } from '@/lib/email'

export const runtime = 'nodejs'

type ContactBody = {
	name?: string
	email?: string
	message?: string
}

function getClientIp(req: NextRequest): string {
	const fwd = req.headers.get('x-forwarded-for') || ''
	if (fwd) return fwd.split(',')[0].trim()
	const real = req.headers.get('x-real-ip')
	if (real) return real
	return 'unknown'
}

export async function POST(req: NextRequest) {
	try {
		const { name, email, message } = (await req.json().catch(() => ({}))) as ContactBody
		if (!name || !email || !message) {
			return NextResponse.json({ success: false, error: 'Vantar nafn, netfang og skilaboð' }, { status: 400 })
		}

		const ip = getClientIp(req)
		const supabase = getServerSupabase()

		// Rate limit: 10 minutes default (configurable)
		const minutes = parseInt(process.env.CONTACT_RATE_LIMIT_MINUTES || '10', 10)
		const since = new Date(Date.now() - minutes * 60 * 1000).toISOString()

		const { data: recent, error: rlErr } = await supabase
			.from('contact_rate_limit')
			.select('id, created_at')
			.eq('ip', ip)
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(1)

		if (rlErr) {
			return NextResponse.json({ success: false, error: 'Villa kom upp við staðfestingu' }, { status: 500 })
		}

		if (recent && recent.length > 0) {
			return NextResponse.json(
				{
					success: false,
					rateLimited: true,
					message: `Þú hefur nýlega sent skilaboð. Vinsamlegast reyndu aftur eftir ${minutes} mínútur.`,
				},
				{ status: 429 },
			)
		}

		await supabase.from('contact_rate_limit').insert([{ ip }])

		await sendContactEmail({ name, email, message })

		return NextResponse.json({ success: true })
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ success: false, error: msg }, { status: 500 })
	}
}


