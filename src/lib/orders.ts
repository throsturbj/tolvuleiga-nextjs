import PDFDocument from 'pdfkit/js/pdfkit.standalone'
import * as fontkit from 'fontkit'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getServerSupabase } from './supabase-server'
import { specText, type Product } from './products'

export type OrderRow = {
	id: string
	orderNumber?: string | null
	auth_uid: string | null
	timabilFra?: string | null
	timabilTil?: string | null
	verd?: number | null
	gamingpc_uuid?: number | null
	gamingconsole_uuid?: string | null
	screen_uuid?: string | null
	product_id?: string | null
	variant_id?: string | null
	screen_product_id?: string | null
	created_at?: string | null
	skjar?: boolean | null
	lyklabord?: boolean | null
	mus?: boolean | null
	trygging?: boolean | null
	numberofextracon?: number | null
	guest_name?: string | null
	guest_kennitala?: string | null
	guest_email?: string | null
	guest_phone?: string | null
	guest_address?: string | null
	guest_city?: string | null
	guest_postal_code?: string | null
}

export type UserRow = {
	auth_uid: string
	full_name?: string | null
	kennitala?: string | null
	phone?: string | null
	address?: string | null
	city?: string | null
	postal_code?: string | null
	ibudnumer?: string | null
}

export type PcRow = {
	id: number
	name?: string | null
	cpu?: string | null
	gpu?: string | null
	storage?: string | null
	motherboard?: string | null
	powersupply?: string | null
	cpucooler?: string | null
	ram?: string | null
}

export type ConsoleRow = {
	id: string
	nafn?: string | null
	geymsluplass?: string | null
	tengi?: string | null
}

export type ScreenRow = {
	id: string
	framleidandi?: string | null
	skjastaerd?: string | null
	upplausn?: string | null
	skjataekni?: string | null
	endurnyjunartidni?: string | null
}

export async function fetchOrderBundle(orderId: string): Promise<{ order: OrderRow; user: UserRow | null; pc: PcRow | null; console: ConsoleRow | null; screen: ScreenRow | null; product: Product | null }> {
	const supabase = getServerSupabase()
	const baseCols =
		'id, orderNumber, auth_uid, timabilFra, timabilTil, verd, gamingpc_uuid, gamingconsole_uuid, screen_uuid, product_id, variant_id, screen_product_id, created_at, skjar, lyklabord, mus, trygging, numberofextracon'
	const guestCols =
		', guest_name, guest_kennitala, guest_email, guest_phone, guest_address, guest_city, guest_postal_code'
	let { data: order, error: orderErr } = await supabase.from('orders').select(`${baseCols}${guestCols}`).eq('id', orderId).maybeSingle<OrderRow>()
	if (orderErr && /guest_|schema cache|does not exist/i.test(orderErr.message)) {
		const retry = await supabase.from('orders').select(baseCols).eq('id', orderId).maybeSingle<OrderRow>()
		order = retry.data
		orderErr = retry.error
	}
	if (orderErr || !order) throw new Error('Order not found')

	let user: UserRow | null = null
	if (order.auth_uid) {
		const { data: userRow } = await supabase
			.from('users')
			.select('auth_uid, full_name, kennitala, phone, address, city, postal_code, ibudnumer')
			.eq('auth_uid', order.auth_uid)
			.single<UserRow>()
		user = userRow ?? null
	}
	if (!user && (order.guest_name || order.guest_email)) {
		user = {
			auth_uid: '',
			full_name: order.guest_name,
			kennitala: order.guest_kennitala,
			phone: order.guest_phone,
			address: order.guest_address,
			city: order.guest_city,
			postal_code: order.guest_postal_code,
		}
	}

	let product: Product | null = null
	if (order.product_id) {
		const { data: productRow } = await supabase
			.from('products')
			.select('*')
			.eq('id', order.product_id)
			.maybeSingle()
		product = (productRow as Product | null) ?? null
	}

	let pc: PcRow | null = null
	let console: ConsoleRow | null = null
	let screen: ScreenRow | null = null

	if (product) {
		if (product.type === 'gaming_pc' || product.type === 'laptop') {
			pc = {
				id: 0,
				name: product.name,
				cpu: specText(product.specs, 'cpu') || null,
				gpu: specText(product.specs, 'gpu') || null,
				storage: specText(product.specs, 'storage') || null,
				motherboard: specText(product.specs, 'motherboard') || null,
				powersupply: specText(product.specs, 'powersupply') || null,
				cpucooler: specText(product.specs, 'cpucooler') || null,
				ram: specText(product.specs, 'ram') || null,
			}
		} else if (product.type === 'console') {
			console = {
				id: product.id,
				nafn: product.name,
				geymsluplass: specText(product.specs, 'geymsluplass') || null,
				tengi: specText(product.specs, 'tengi') || null,
			}
		} else if (product.type === 'screen') {
			screen = {
				id: product.id,
				framleidandi: specText(product.specs, 'framleidandi') || product.name,
				skjastaerd: specText(product.specs, 'skjastaerd') || null,
				upplausn: specText(product.specs, 'upplausn') || null,
				skjataekni: specText(product.specs, 'skjataekni') || null,
				endurnyjunartidni: specText(product.specs, 'endurnyjunartidni') || null,
			}
		}
	}

	if (!pc && order.gamingpc_uuid) {
		const { data: pcRow } = await supabase
			.from('GamingPC')
			.select('id, name, cpu, gpu, storage, motherboard, powersupply, cpucooler, ram')
			.eq('id', order.gamingpc_uuid)
			.single<PcRow>()
		pc = pcRow ?? null
	}

	if (!console && order.gamingconsole_uuid) {
		const { data: cRow } = await supabase
			.from('gamingconsoles')
			.select('id, nafn, geymsluplass, tengi')
			.eq('id', order.gamingconsole_uuid)
			.single<ConsoleRow>()
		console = cRow ?? null
	}

	if (!screen && (order.screen_product_id || order.screen_uuid)) {
		if (order.screen_product_id) {
			const { data: sProd } = await supabase.from('products').select('*').eq('id', order.screen_product_id).maybeSingle()
			const sp = sProd as Product | null
			if (sp) {
				screen = {
					id: sp.id,
					framleidandi: specText(sp.specs, 'framleidandi') || sp.name,
					skjastaerd: specText(sp.specs, 'skjastaerd') || null,
					upplausn: specText(sp.specs, 'upplausn') || null,
					skjataekni: specText(sp.specs, 'skjataekni') || null,
					endurnyjunartidni: specText(sp.specs, 'endurnyjunartidni') || null,
				}
			}
		}
		if (!screen && order.screen_uuid) {
			const { data: sRow } = await supabase
				.from('screens')
				.select('id, framleidandi, skjastaerd, upplausn, skjataekni, endurnyjunartidni')
				.eq('id', order.screen_uuid)
				.single<ScreenRow>()
			screen = sRow ?? null
		}
	}

	return { order, user, pc, console, screen, product }
}

function formatKr(value: number | string | null | undefined) {
	if (value === null || value === undefined) return '—'
	const n = typeof value === 'string' ? Number(value.replace(/\s/g, '').replace(',', '.')) : value
	if (!Number.isFinite(n)) return '—'
	return `${String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr`
}

async function streamPdfToBuffer(doc: PDFDocument): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = []
		doc.on('data', (chunk) => chunks.push(chunk as unknown as Buffer))
		doc.on('end', () => resolve(Buffer.concat(chunks)))
		doc.on('error', (err) => reject(err))
		doc.end()
	})
}

let cachedBodyFont: Buffer | null = null
async function loadBodyFont(): Promise<Buffer> {
	if (cachedBodyFont) return cachedBodyFont
	try {
		const localPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf')
		const buf = await fs.readFile(localPath)
		cachedBodyFont = buf
		return buf
	} catch {}
	const fontUrl = 'https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Regular.ttf'
	const res = await fetch(fontUrl)
	if (!res.ok) throw new Error(`Failed to fetch font: ${res.status}`)
	const ab = await res.arrayBuffer()
	cachedBodyFont = Buffer.from(ab)
	return cachedBodyFont
}

export async function generateOrderPdfBuffer(orderId: string): Promise<{ buffer: Buffer; filename: string; meta: Awaited<ReturnType<typeof fetchOrderBundle>> }> {
	const bundle = await fetchOrderBundle(orderId)
	// Fetch email from auth users using service role
	let authEmail: string | null = null
	if (bundle.order.auth_uid) {
		try {
			const admin = getServerSupabase()
			const { data } = await admin.auth.admin.getUserById(bundle.order.auth_uid)
			authEmail = data?.user?.email ?? null
		} catch {}
	}
	if (!authEmail) authEmail = bundle.order.guest_email ?? null
	const doc = new PDFDocument({ size: 'A4', margin: 50 })
	;(doc as unknown as { fontkit: typeof fontkit }).fontkit = fontkit
	const buf = await loadBodyFont()
	doc.registerFont('Body', buf)
	doc.font('Body')
	doc.fontSize(18).text('Pöntunarstaðfesting').moveDown(0.5)
	doc.fontSize(12).fillColor('#444')
	doc.text(`Pöntunarnúmer: ${bundle.order.orderNumber ?? bundle.order.id}`)
	doc.text(`Stofnað: ${bundle.order.created_at ? new Date(bundle.order.created_at).toLocaleString('is-IS') : '—'}`)
	doc.moveDown()

	doc.fontSize(14).fillColor('#000').text('Viðskiptavinur', { underline: true }).moveDown(0.5)
	doc.fontSize(12).fillColor('#444')
	doc.text(`Nafn: ${bundle.user?.full_name || '—'}`)
	doc.text(`Kennitala: ${bundle.user?.kennitala || '—'}`)
	doc.text(`Netfang: ${authEmail || '—'}`)
	doc.text(`Sími: ${bundle.user?.phone || '—'}`)
	doc.text(`Heimilisfang: ${bundle.user?.address || '—'}`)
	doc.text(`Borg/Póstnúmer: ${bundle.user?.city || '—'} ${bundle.user?.postal_code || ''}`)
	if (bundle.user?.ibudnumer) {
		doc.text(`Íbúðarnúmer: ${bundle.user.ibudnumer}`)
	}
	doc.moveDown()

	doc.fontSize(14).fillColor('#000').text('Vara', { underline: true }).moveDown(0.5)
	doc.fontSize(12).fillColor('#444')
	if (bundle.pc) {
		doc.text(`Heiti: ${bundle.pc?.name || '—'}`)
		doc.text(`Skjákort: ${bundle.pc?.gpu || '—'}`)
		doc.text(`Örgjörvi: ${bundle.pc?.cpu || '—'}`)
		doc.text(`Geymsla: ${bundle.pc?.storage || '—'}`)
		doc.text(`Móðurborð: ${bundle.pc?.motherboard || '—'}`)
		doc.text(`Vinnsluminni: ${bundle.pc?.ram || '—'}`)
		doc.text(`Aflgjafi: ${bundle.pc?.powersupply || '—'}`)
		doc.text(`Kæling: ${bundle.pc?.cpucooler || '—'}`)
	} else if (bundle.console) {
		doc.text(`Heiti: ${bundle.console.nafn || '—'}`)
		doc.text(`Geymslupláss: ${bundle.console.geymsluplass || '—'}`)
		doc.text(`Tengi: ${bundle.console.tengi || '—'}`)
	} else if (bundle.screen) {
		doc.text(`Framleiðandi: ${bundle.screen.framleidandi || '—'}`)
		doc.text(`Skjástærð: ${bundle.screen.skjastaerd || '—'}`)
		doc.text(`Upplausn: ${bundle.screen.upplausn || '—'}`)
		doc.text(`Skjátegund: ${bundle.screen.skjataekni || '—'}`)
		doc.text(`Endurnýjunartíðni: ${bundle.screen.endurnyjunartidni || '—'}`)
	}
	doc.moveDown()

	doc.fontSize(14).fillColor('#000').text('Leigutímabil', { underline: true }).moveDown(0.5)
	doc.fontSize(12).fillColor('#444')
	doc.text(`Frá: ${bundle.order.timabilFra ? new Date(bundle.order.timabilFra).toLocaleDateString('is-IS') : '—'}`)
	doc.text(`Til: ${bundle.order.timabilTil ? new Date(bundle.order.timabilTil).toLocaleDateString('is-IS') : '—'}`)
	doc.moveDown()

	// Trygging
	doc.fontSize(14).fillColor('#000').text('Trygging', { underline: true }).moveDown(0.5)
	doc.fontSize(12).fillColor('#444')
	doc.text(`${bundle.order.trygging ? 'Já' : 'Nei'}`)
	doc.moveDown()

	// Aukahlutir
	{
		const addons: string[] = []
		if (bundle.order.skjar) addons.push('Skjár')
		if (bundle.order.lyklabord) addons.push('Lyklaborð')
		if (bundle.order.mus) addons.push('Mús')
		const extra = (typeof bundle.order.numberofextracon === 'number' && bundle.order.numberofextracon > 0)
			? `Auka fjarstýringar: ${bundle.order.numberofextracon}`
			: null
		if (addons.length > 0 || extra) {
			doc.fontSize(14).fillColor('#000').text('Aukahlutir', { underline: true }).moveDown(0.5)
			doc.fontSize(12).fillColor('#444')
			if (addons.length > 0) {
				doc.text(addons.join(', '))
			}
			if (extra) {
				doc.text(extra)
			}
			doc.moveDown()
		}
	}

	doc.fontSize(14).fillColor('#000').text('Verð', { underline: true }).moveDown(0.5)
	doc.fontSize(16).fillColor('#1f2937').text(`${formatKr(bundle.order.verd ?? null)}/mánuði`)
	doc.moveDown(2)

	doc.fontSize(10).fillColor('#9CA3AF').text('Tölvuleiga · Leigja · Spila · Skila', { align: 'center' })

	const buffer = await streamPdfToBuffer(doc)
	const filename = `pontun-${bundle.order.orderNumber ?? bundle.order.id}.pdf`
	return { buffer, filename, meta: bundle }
}

export function buildAdminOrderText(meta: Awaited<ReturnType<typeof fetchOrderBundle>>, userEmail?: string | null, message?: string | null): string {
	const { order, user, pc, console, screen } = meta
	const parts = [
		'Ný pöntun fyrir Tölvuleigu',
		'',
		`Pöntunarnúmer: ${order.orderNumber ?? order.id}`,
		`Stofnað: ${order.created_at ? new Date(order.created_at).toLocaleString('is-IS') : '—'}`,
		'',
		'Viðskiptavinur:',
		`Nafn: ${user?.full_name || '—'}`,
		`Kennitala: ${user?.kennitala || '—'}`,
		`Netfang: ${userEmail || '—'}`,
		`Sími: ${user?.phone || '—'}`,
		`Heimilisfang: ${user?.address || '—'}`,
		`Borg/Póstnúmer: ${user?.city || '—'} ${user?.postal_code || ''}`,
		...(user?.ibudnumer ? [`Íbúðarnúmer: ${user.ibudnumer}`] : []),
		'',
		'Vara:',
		pc
			? [
				`Heiti: ${pc?.name || '—'}`,
				`Skjákort: ${pc?.gpu || '—'}`,
				`Örgjörvi: ${pc?.cpu || '—'}`,
				`Geymsla: ${pc?.storage || '—'}`,
				`Móðurborð: ${pc?.motherboard || '—'}`,
				`Vinnsluminni: ${pc?.ram || '—'}`,
				`Aflgjafi: ${pc?.powersupply || '—'}`,
				`Kæling: ${pc?.cpucooler || '—'}`,
			].join('\n')
			: console
			? [
				`Heiti: ${console?.nafn || '—'}`,
				`Geymslupláss: ${console?.geymsluplass || '—'}`,
				`Tengi: ${console?.tengi || '—'}`,
			].join('\n')
			: [
				`Framleiðandi: ${screen?.framleidandi || '—'}`,
				`Skjástærð: ${screen?.skjastaerd || '—'}`,
				`Upplausn: ${screen?.upplausn || '—'}`,
				`Skjátegund: ${screen?.skjataekni || '—'}`,
				`Endurnýjunartíðni: ${screen?.endurnyjunartidni || '—'}`,
			].join('\n'),
		'',
		'Leigutímabil:',
		`Frá: ${order.timabilFra ? new Date(order.timabilFra).toLocaleDateString('is-IS') : '—'}`,
		`Til: ${order.timabilTil ? new Date(order.timabilTil).toLocaleDateString('is-IS') : '—'}`,
		'',
		`Trygging: ${order.trygging ? 'Já' : 'Nei'}`,
		'',
		(() => {
			const addons: string[] = []
			if (order.skjar) addons.push('Skjár')
			if (order.lyklabord) addons.push('Lyklaborð')
			if (order.mus) addons.push('Mús')
			const extra = (typeof order.numberofextracon === 'number' && order.numberofextracon > 0) ? `Auka fjarstýringar: ${order.numberofextracon}` : null
			if (addons.length === 0 && !extra) return 'Aukahlutir: —'
			return `Aukahlutir: ${[addons.length ? addons.join(', ') : null, extra].filter(Boolean).join(' · ')}`
		})(),
	] as string[]

	// Include optional customer message
	const trimmed = (message ?? '').trim()
	if (trimmed.length > 0) {
		parts.push('')
		parts.push('Skilaboð frá viðskiptavini:')
		parts.push(trimmed)
	}

	parts.push('')
	parts.push(`Verð: ${formatKr(order.verd ?? null)}/mánuði`)

	return parts.join('\n')
}


