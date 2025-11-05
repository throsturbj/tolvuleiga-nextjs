import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { sendWelcomeEmail } from '@/lib/email'

export const runtime = 'nodejs'

type Body = { authUid?: string; email?: string }

export async function POST(req: NextRequest) {
	try {
		const { authUid, email } = (await req.json().catch(() => ({}))) as Body
		if (!authUid || !email) {
			return NextResponse.json({ success: false, error: 'authUid og email eru nauðsynleg' }, { status: 400 })
		}

		const supabase = getServerSupabase()
		// Check if already sent
		const { data: userRow } = await supabase
			.from('users')
			.select('emailsent')
			.eq('auth_uid', authUid)
			.single<{ emailsent?: boolean }>()

		if (userRow?.emailsent) {
			return NextResponse.json({ success: true, alreadySent: true })
		}

		await sendWelcomeEmail(email)

		// Best-effort update; if row missing, don't fail the request
		await supabase
			.from('users')
			.update({ emailsent: true })
			.eq('auth_uid', authUid)

		return NextResponse.json({ success: true })
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ success: false, error: msg }, { status: 500 })
	}
}


