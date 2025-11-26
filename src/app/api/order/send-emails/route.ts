import { NextRequest, NextResponse } from 'next/server'
import { generateOrderPdfBuffer, buildAdminOrderText } from '@/lib/orders'
import { sendOrderEmails } from '@/lib/email'

export const runtime = 'nodejs'

type Body = { orderId?: string; userEmail?: string; message?: string }

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json().catch(() => ({}))) as Body
		if (!body.orderId || !body.userEmail) {
			return NextResponse.json({ success: false, error: 'orderId og userEmail eru nauðsynleg' }, { status: 400 })
		}

		const { buffer, filename, meta } = await generateOrderPdfBuffer(body.orderId)
		const adminText = buildAdminOrderText(meta, body.userEmail, body.message)

		await sendOrderEmails({
			userEmail: body.userEmail,
			orderTextForAdmin: adminText,
			pdfAttachment: { filename, content: buffer },
		})

		return NextResponse.json({ success: true })
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ success: false, error: msg }, { status: 500 })
	}
}


