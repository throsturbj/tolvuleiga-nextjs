import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { sendPasswordResetEmail } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => null) as { email?: string } | null
		const email = (body?.email || '').trim().toLowerCase()
		if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
			return NextResponse.json({ error: 'Ógilt netfang' }, { status: 400 })
		}

		const origin = (() => {
			try {
				return new URL(req.url).origin
			} catch {
				return process.env.NEXT_PUBLIC_SITE_ORIGIN || 'http://localhost:3000'
			}
		})()
		const resetPage = `${origin}/reset-password`

		const supabaseAdmin = getServerSupabase()

		const { data, error } = await supabaseAdmin.auth.admin.generateLink({
			type: 'recovery',
			email,
			options: { redirectTo: resetPage },
		})

		if (error || !data) {
			return NextResponse.json({ error: 'Tókst ekki að búa til endursetningartengil' }, { status: 500 })
		}

		// Prefer action_link which goes through Supabase and returns to redirectTo
		const link = data.properties?.action_link || resetPage

		await sendPasswordResetEmail({ to: email, resetLink: link })

		return NextResponse.json({ ok: true })
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error'
		return NextResponse.json({ error: msg }, { status: 500 })
	}
}


