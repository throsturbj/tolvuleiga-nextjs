import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email'

export const runtime = 'nodejs'

type Body = { productId?: number; productName?: string }

export async function POST(req: NextRequest) {
	try {
		const { productId, productName } = (await req.json().catch(() => ({}))) as Body
		if (!productId) {
			return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 })
		}

		const name = typeof productName === 'string' && productName.trim().length > 0 ? productName.trim() : `Vara #${productId}`
		const to = 'tolvuleiga@tolvuleiga.is'
		const subject = 'Nýskráning á biðlista'
		const text = `Nýskráning á biðlista: ${name}`

		await sendMail({ to, subject, text })

		return NextResponse.json({ success: true })
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ success: false, error: msg }, { status: 500 })
	}
}



