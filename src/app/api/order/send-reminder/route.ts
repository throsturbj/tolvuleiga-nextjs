import { NextRequest, NextResponse } from 'next/server'
import { fetchOrderBundle } from '@/lib/orders'
import { getServerSupabase } from '@/lib/supabase-server'
import { sendOrderReminderEmail } from '@/lib/email'

export const runtime = 'nodejs'

type Body = { orderId?: string; dashboardUrl?: string }

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json().catch(() => ({}))) as Body
		const orderId = body.orderId
		if (!orderId) {
			return NextResponse.json({ success: false, error: 'orderId vantar' }, { status: 400 })
		}

		const bundle = await fetchOrderBundle(orderId)
		if (!bundle.order?.auth_uid) {
			return NextResponse.json({ success: false, error: 'Auth not found for order' }, { status: 400 })
		}

		// Fetch email from auth users using service role
		const admin = getServerSupabase()
		const { data } = await admin.auth.admin.getUserById(bundle.order.auth_uid)
		const userEmail = data?.user?.email || null
		if (!userEmail) {
			return NextResponse.json({ success: false, error: 'Netfang fannst ekki' }, { status: 404 })
		}

		// Format timabilTil as is-IS date
		const til = bundle.order.timabilTil ? new Date(bundle.order.timabilTil) : null
		const timabilTilDateString = til ? til.toLocaleDateString('is-IS') : '—'

		const dashboardUrl = body.dashboardUrl || process.env.PANTANIRURL || 'http://localhost:3000/dashboard'

		await sendOrderReminderEmail({
			to: userEmail,
			timabilTilDateString,
			dashboardUrl,
		})

		return NextResponse.json({ success: true })
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ success: false, error: msg }, { status: 500 })
	}
}


