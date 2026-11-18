import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'
import { sendOrderRequestEmails } from '@/lib/email'

export const runtime = 'nodejs'

const inFlight = new Set<string>()
const MAX_MESSAGE_LENGTH = 4000

type ProfileRow = {
	full_name?: string | null
	address?: string | null
	city?: string | null
	postal_code?: string | null
	ibudnumer?: string | null
}

function clean(value: unknown): string {
	if (typeof value === 'string') return value.trim()
	if (value == null) return ''
	return String(value).trim()
}

function rateKey(userId: string): string {
	// Stored in contact_rate_limit.ip so one account can send this request once,
	// without sharing the contact form's IP window.
	return `order-request:${userId}`
}

function formatAddress(row: ProfileRow | null): { street: string; formatted: string } {
	const street = clean(row?.address)
	const apartment = clean(row?.ibudnumer)
	const locality = [clean(row?.postal_code), clean(row?.city)].filter(Boolean).join(' ')
	const formatted = [street, apartment ? `íbúð ${apartment}` : '', locality].filter(Boolean).join(', ')
	return { street, formatted }
}

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

async function loadRequestProfile(userId: string, email: string) {
	const db = getServerSupabase()
	const { data, error } = await db
		.from('users')
		.select('full_name, address, city, postal_code, ibudnumer')
		.eq('auth_uid', userId)
		.maybeSingle()
	if (error) throw error
	const name = clean((data as ProfileRow | null)?.full_name)
	const { street, formatted } = formatAddress((data as ProfileRow | null) || null)
	return {
		name,
		email: email.trim(),
		address: formatted,
		complete: Boolean(name && email.trim() && street),
	}
}

async function hasAlreadySent(userId: string): Promise<boolean> {
	const db = getServerSupabase()
	const { data, error } = await db
		.from('contact_rate_limit')
		.select('id')
		.eq('ip', rateKey(userId))
		.limit(1)
	if (error) throw error
	return Array.isArray(data) && data.length > 0
}

export async function GET(req: NextRequest) {
	try {
		const user = await getUserFromRequest(req)
		if (!user) {
			return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
		}
		const [profile, alreadySent] = await Promise.all([
			loadRequestProfile(user.id, user.email || ''),
			hasAlreadySent(user.id),
		])
		return NextResponse.json({ success: true, alreadySent, ...profile })
	} catch (err) {
		console.error('pantanabeidni/get', err)
		return NextResponse.json({ success: false, error: 'Ekki tókst að sækja upplýsingar.' }, { status: 500 })
	}
}

export async function POST(req: NextRequest) {
	const user = await getUserFromRequest(req)
	if (!user?.email) {
		return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
	}
	if (inFlight.has(user.id)) {
		return NextResponse.json(
			{ success: false, error: 'Beiðni er þegar í vinnslu.' },
			{ status: 429 },
		)
	}

	inFlight.add(user.id)
	let claimId: string | null = null
	try {
		const body = (await req.json().catch(() => ({}))) as { message?: string }
		const message = clean(body.message)
		if (!message) {
			return NextResponse.json({ success: false, error: 'Vantar skilaboð' }, { status: 400 })
		}
		if (message.length > MAX_MESSAGE_LENGTH) {
			return NextResponse.json(
				{ success: false, error: 'Skilaboðin eru of löng' },
				{ status: 400 },
			)
		}

		const profile = await loadRequestProfile(user.id, user.email)
		if (!profile.complete) {
			return NextResponse.json(
				{ success: false, error: 'Vantar nafn eða heimilisfang í notendaupplýsingum.' },
				{ status: 400 },
			)
		}

		if (await hasAlreadySent(user.id)) {
			return NextResponse.json(
				{
					success: false,
					alreadySent: true,
					message: 'Þú hefur þegar sent pöntunarbeiðni.',
				},
				{ status: 429 },
			)
		}

		const db = getServerSupabase()
		const key = rateKey(user.id)
		const { data: inserted, error: insertError } = await db
			.from('contact_rate_limit')
			.insert([{ ip: key }])
			.select('id')
			.single()
		if (insertError || !inserted?.id) {
			return NextResponse.json({ success: false, error: 'Villa kom upp við staðfestingu' }, { status: 500 })
		}
		claimId = inserted.id as string

		const { data: claims, error: claimError } = await db
			.from('contact_rate_limit')
			.select('id')
			.eq('ip', key)
			.order('created_at', { ascending: true })
			.order('id', { ascending: true })
		if (claimError) {
			await db.from('contact_rate_limit').delete().eq('id', claimId)
			claimId = null
			return NextResponse.json({ success: false, error: 'Villa kom upp við staðfestingu' }, { status: 500 })
		}
		const firstId = claims?.[0]?.id
		if (firstId && firstId !== claimId) {
			await db.from('contact_rate_limit').delete().eq('id', claimId)
			claimId = null
			return NextResponse.json(
				{
					success: false,
					alreadySent: true,
					message: 'Þú hefur þegar sent pöntunarbeiðni.',
				},
				{ status: 429 },
			)
		}

		await sendOrderRequestEmails({
			userEmail: profile.email,
			userName: profile.name,
			address: profile.address,
			message,
		})

		return NextResponse.json({ success: true })
	} catch (err) {
		if (claimId) {
			try {
				await getServerSupabase().from('contact_rate_limit').delete().eq('id', claimId)
			} catch {
				// Leave the claim if cleanup fails so a duplicate mail is not sent.
			}
		}
		console.error('pantanabeidni/post', err)
		return NextResponse.json({ success: false, error: 'Ekki tókst að senda beiðnina.' }, { status: 500 })
	} finally {
		inFlight.delete(user.id)
	}
}
