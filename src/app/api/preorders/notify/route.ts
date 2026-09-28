import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'
import { sendWaitlistEmails } from '@/lib/email'

export const runtime = 'nodejs'

const inFlightJoins = new Set<string>()

async function getUserFromRequest(req: NextRequest) {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!url || !anon) return null
	const header = req.headers.get('authorization') || ''
	const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
	if (!token) return null
	const { data, error } = await createClient(url, anon).auth.getUser(token)
	if (error || !data.user) return null
	return data.user
}

export async function POST(req: NextRequest) {
	try {
		const user = await getUserFromRequest(req)
		if (!user) {
			return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
		}

		const { productId } = (await req.json().catch(() => ({}))) as { productId?: string }
		if (!productId || typeof productId !== 'string') {
			return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 })
		}

		const db = getServerSupabase()
		const { data: product, error: productError } = await db
			.from('products')
			.select('id, name, uppselt, legacy_id, legacy_table')
			.eq('id', productId)
			.maybeSingle()

		if (productError || !product) {
			return NextResponse.json({ success: false, error: 'Vara fannst ekki' }, { status: 404 })
		}

		const { data: existing } = await db
			.from('preorders')
			.select('id')
			.eq('auth_uid', user.id)
			.eq('product_id', product.id)
			.maybeSingle()

		if (existing) {
			return NextResponse.json({ success: true, alreadyJoined: true })
		}

		const joinKey = `${user.id}:${product.id}`
		if (inFlightJoins.has(joinKey)) {
			return NextResponse.json({ success: true, alreadyJoined: true })
		}
		inFlightJoins.add(joinKey)

		try {
			const { data: again } = await db
				.from('preorders')
				.select('id')
				.eq('auth_uid', user.id)
				.eq('product_id', product.id)
				.maybeSingle()
			if (again) {
				return NextResponse.json({ success: true, alreadyJoined: true })
			}

			const insert: Record<string, unknown> = {
				auth_uid: user.id,
				product_id: product.id,
			}
			if (product.legacy_table === 'GamingPC' && product.legacy_id && /^\d+$/.test(String(product.legacy_id))) {
				insert.gamingpc_uuid = Number(product.legacy_id)
			}

			const { error: insertError } = await db.from('preorders').insert(insert)
			if (insertError) {
				return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
			}

			const { data: profile } = await db
				.from('users')
				.select('full_name')
				.eq('auth_uid', user.id)
				.maybeSingle()

			const userEmail = user.email || ''
			if (userEmail) {
				try {
					await sendWaitlistEmails({
						userEmail,
						userName: (profile?.full_name || '').trim(),
						productName: product.name,
					})
				} catch (mailErr) {
					console.error('Waitlist emails failed', mailErr)
				}
			}

			return NextResponse.json({ success: true })
		} finally {
			inFlightJoins.delete(joinKey)
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ success: false, error: msg }, { status: 500 })
	}
}
