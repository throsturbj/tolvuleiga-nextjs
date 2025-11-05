import PDFDocument from 'pdfkit/js/pdfkit.standalone'
import * as fontkit from 'fontkit'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getServerSupabase } from './supabase-server'

export type OrderRow = {
	id: string
	orderNumber?: string | null
	auth_uid: string | null
	timabilFra?: string | null
	timabilTil?: string | null
	verd?: number | null
	gamingpc_uuid?: number | null
	created_at?: string | null
}

export type UserRow = {
	auth_uid: string
	full_name?: string | null
	kennitala?: string | null
	phone?: string | null
	address?: string | null
	city?: string | null
	postal_code?: string | null
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

export async function fetchOrderBundle(orderId: string): Promise<{ order: OrderRow; user: UserRow | null; pc: PcRow | null }> {
	const supabase = getServerSupabase()
	const { data: order, error: orderErr } = await supabase
		.from('orders')
		.select('id, orderNumber, auth_uid, timabilFra, timabilTil, verd, gamingpc_uuid, created_at')
		.eq('id', orderId)
		.single<OrderRow>()
	if (orderErr || !order) throw new Error('Order not found')

	let user: UserRow | null = null
	if (order.auth_uid) {
		const { data: userRow } = await supabase
			.from('users')
			.select('auth_uid, full_name, kennitala, phone, address, city, postal_code')
			.eq('auth_uid', order.auth_uid)
			.single<UserRow>()
		user = userRow ?? null
	}

	let pc: PcRow | null = null
	if (order.gamingpc_uuid) {
		const { data: pcRow } = await supabase
			.from('GamingPC')
			.select('id, name, cpu, gpu, storage, motherboard, powersupply, cpucooler, ram')
			.eq('id', order.gamingpc_uuid)
			.single<PcRow>()
		pc = pcRow ?? null
	}

	return { order, user, pc }
}

function formatKr(n: number | null | undefined) {
	if (!n || !Number.isFinite(n)) return '—'
	return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr`
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
	doc.text(`Sími: ${bundle.user?.phone || '—'}`)
	doc.text(`Heimilisfang: ${bundle.user?.address || '—'}`)
	doc.text(`Borg/Póstnúmer: ${bundle.user?.city || '—'} ${bundle.user?.postal_code || ''}`)
	doc.moveDown()

	doc.fontSize(14).fillColor('#000').text('Vara', { underline: true }).moveDown(0.5)
	doc.fontSize(12).fillColor('#444')
	doc.text(`Heiti: ${bundle.pc?.name || '—'}`)
	doc.text(`Skjákort: ${bundle.pc?.gpu || '—'}`)
	doc.text(`Örgjörvi: ${bundle.pc?.cpu || '—'}`)
	doc.text(`Geymsla: ${bundle.pc?.storage || '—'}`)
	doc.text(`Móðurborð: ${bundle.pc?.motherboard || '—'}`)
	doc.text(`Vinnsluminni: ${bundle.pc?.ram || '—'}`)
	doc.text(`Aflgjafi: ${bundle.pc?.powersupply || '—'}`)
	doc.text(`Kæling: ${bundle.pc?.cpucooler || '—'}`)
	doc.moveDown()

	doc.fontSize(14).fillColor('#000').text('Leigutímabil', { underline: true }).moveDown(0.5)
	doc.fontSize(12).fillColor('#444')
	doc.text(`Frá: ${bundle.order.timabilFra ? new Date(bundle.order.timabilFra).toLocaleDateString('is-IS') : '—'}`)
	doc.text(`Til: ${bundle.order.timabilTil ? new Date(bundle.order.timabilTil).toLocaleDateString('is-IS') : '—'}`)
	doc.moveDown()

	doc.fontSize(14).fillColor('#000').text('Verð', { underline: true }).moveDown(0.5)
	doc.fontSize(16).fillColor('#1f2937').text(`${formatKr(bundle.order.verd ?? null)}/mánuði`)
	doc.moveDown(2)

	doc.fontSize(10).fillColor('#9CA3AF').text('Tölvuleiga · Leigja · Spila · Skila', { align: 'center' })

	const buffer = await streamPdfToBuffer(doc)
	const filename = `pontun-${bundle.order.orderNumber ?? bundle.order.id}.pdf`
	return { buffer, filename, meta: bundle }
}

export function buildAdminOrderText(meta: Awaited<ReturnType<typeof fetchOrderBundle>>): string {
	const { order, user, pc } = meta
	return [
		'Ný pöntun fyrir Tölvuleigu',
		'',
		`Pöntunarnúmer: ${order.orderNumber ?? order.id}`,
		`Stofnað: ${order.created_at ? new Date(order.created_at).toLocaleString('is-IS') : '—'}`,
		'',
		'Viðskiptavinur:',
		`Nafn: ${user?.full_name || '—'}`,
		`Kennitala: ${user?.kennitala || '—'}`,
		`Sími: ${user?.phone || '—'}`,
		`Heimilisfang: ${user?.address || '—'}`,
		`Borg/Póstnúmer: ${user?.city || '—'} ${user?.postal_code || ''}`,
		'',
		'Vara:',
		`Heiti: ${pc?.name || '—'}`,
		`Skjákort: ${pc?.gpu || '—'}`,
		`Örgjörvi: ${pc?.cpu || '—'}`,
		`Geymsla: ${pc?.storage || '—'}`,
		`Móðurborð: ${pc?.motherboard || '—'}`,
		`Vinnsluminni: ${pc?.ram || '—'}`,
		`Aflgjafi: ${pc?.powersupply || '—'}`,
		`Kæling: ${pc?.cpucooler || '—'}`,
		'',
		'Leigutímabil:',
		`Frá: ${order.timabilFra ? new Date(order.timabilFra).toLocaleDateString('is-IS') : '—'}`,
		`Til: ${order.timabilTil ? new Date(order.timabilTil).toLocaleDateString('is-IS') : '—'}`,
		'',
		`Verð: ${formatKr(order.verd ?? null)}/mánuði`,
	].join('\n')
}


