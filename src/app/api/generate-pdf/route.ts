import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit/js/pdfkit.standalone'
import * as fontkit from 'fontkit'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { supabase as anonClient } from '@/lib/supabase'

export const runtime = 'nodejs'

type OrderRow = {
  id: string
  orderNumber?: string | null
  auth_uid: string | null
  timabilFra?: string | null
  timabilTil?: string | null
  verd?: number | null
  gamingpc_uuid?: number | null
  created_at?: string | null
}

type UserRow = {
  auth_uid: string
  full_name?: string | null
  kennitala?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
}

type PcRow = {
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

function formatKr(n: number | null | undefined) {
  if (!n || !Number.isFinite(n)) return '—'
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr`
}

async function streamPdfToBuffer(doc: PDFDocument): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', (err) => reject(err))
    doc.end()
  })
}

// Cache a TTF font in-memory to avoid PDFKit AFM lookups in Next bundling
let cachedBodyFont: Buffer | null = null
async function loadBodyFont(): Promise<Buffer> {
  if (cachedBodyFont) return cachedBodyFont
  // Try local TTF first (recommended): public/fonts/Roboto-Regular.ttf
  try {
    const localPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf')
    const buf = await fs.readFile(localPath)
    cachedBodyFont = buf
    return buf
  } catch {}
  // Fallback to remote fetch if local missing
  const fontUrl = 'https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Regular.ttf'
  const res = await fetch(fontUrl)
  if (!res.ok) throw new Error(`Failed to fetch font: ${res.status}`)
  const ab = await res.arrayBuffer()
  cachedBodyFont = Buffer.from(ab)
  return cachedBodyFont
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { orderId?: string } | null
    if (!body?.orderId || typeof body.orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const serverClient = (supabaseUrl && serviceKey)
      ? createClient(supabaseUrl, serviceKey)
      : anonClient

    // Fetch order
    const { data: order, error: orderErr } = await serverClient
      .from('orders')
      .select('id, orderNumber, auth_uid, timabilFra, timabilTil, verd, gamingpc_uuid, created_at')
      .eq('id', body.orderId)
      .single<OrderRow>()

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // Fetch user
    let user: UserRow | null = null
    if (order.auth_uid) {
      const { data: userRow } = await serverClient
        .from('users')
        .select('auth_uid, full_name, kennitala, phone, address, city, postal_code')
        .eq('auth_uid', order.auth_uid)
        .single<UserRow>()
      user = userRow ?? null
    }

    // Fetch gaming PC
    let pc: PcRow | null = null
    if (order.gamingpc_uuid) {
      const { data: pcRow } = await serverClient
        .from('GamingPC')
        .select('id, name, cpu, gpu, storage, motherboard, powersupply, cpucooler, ram')
        .eq('id', order.gamingpc_uuid)
        .single<PcRow>()
      pc = pcRow ?? null
    }

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    ;(doc as unknown as { fontkit: typeof fontkit }).fontkit = fontkit
    const buf = await loadBodyFont()
    doc.registerFont('Body', buf)
    doc.font('Body')
    doc.fontSize(18).text('Pöntunarstaðfesting').moveDown(0.5)
    doc.fontSize(12).fillColor('#444')
    doc.text(`Pöntunarnúmer: ${order.orderNumber ?? order.id}`)
    doc.text(`Stofnað: ${order.created_at ? new Date(order.created_at).toLocaleString('is-IS') : '—'}`)
    doc.moveDown()

    doc.fontSize(14).fillColor('#000').text('Viðskiptavinur', { underline: true }).moveDown(0.5)
    doc.fontSize(12).fillColor('#444')
    doc.text(`Nafn: ${user?.full_name || '—'}`)
    doc.text(`Kennitala: ${user?.kennitala || '—'}`)
    doc.text(`Sími: ${user?.phone || '—'}`)
    doc.text(`Heimilisfang: ${user?.address || '—'}`)
    doc.text(`Borg/Póstnúmer: ${user?.city || '—'} ${user?.postal_code || ''}`)
    doc.moveDown()

    doc.fontSize(14).fillColor('#000').text('Vara', { underline: true }).moveDown(0.5)
    doc.fontSize(12).fillColor('#444')
    doc.text(`Heiti: ${pc?.name || '—'}`)
    doc.text(`Skjákort: ${pc?.gpu || '—'}`)
    doc.text(`Örgjörvi: ${pc?.cpu || '—'}`)
    doc.text(`Geymsla: ${pc?.storage || '—'}`)
    doc.text(`Móðurborð: ${pc?.motherboard || '—'}`)
    doc.text(`Vinnsluminni: ${pc?.ram || '—'}`)
    doc.text(`Aflgjafi: ${pc?.powersupply || '—'}`)
    doc.text(`Kæling: ${pc?.cpucooler || '—'}`)
    doc.moveDown()

    doc.fontSize(14).fillColor('#000').text('Leigutímabil', { underline: true }).moveDown(0.5)
    doc.fontSize(12).fillColor('#444')
    doc.text(`Frá: ${order.timabilFra ? new Date(order.timabilFra).toLocaleDateString('is-IS') : '—'}`)
    doc.text(`Til: ${order.timabilTil ? new Date(order.timabilTil).toLocaleDateString('is-IS') : '—'}`)
    doc.moveDown()

    doc.fontSize(14).fillColor('#000').text('Verð', { underline: true }).moveDown(0.5)
    doc.fontSize(16).fillColor('#1f2937').text(`${formatKr(order.verd ?? null)}/mánuði`)
    doc.moveDown(2)

    doc.fontSize(10).fillColor('#9CA3AF').text('Tölvuleiga · Leigja · Spila · Skila', { align: 'center' })

    const pdfBuffer = await streamPdfToBuffer(doc)

    // Upload to storage (private bucket)
    const bucket = 'order-pdfs'
    const filePath = `order-${order.id}-${Date.now()}.pdf`

    const { error: uploadErr } = await serverClient.storage
      .from(bucket)
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) {
      return NextResponse.json({ success: false, error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: signed, error: signedErr } = await serverClient.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60)

    if (signedErr || !signed?.signedUrl) {
      return NextResponse.json({ success: false, error: 'Failed to create signed URL' }, { status: 500 })
    }

    const { error: updateErr } = await serverClient
      .from('orders')
      .update({
        pdf_path: filePath,
        pdf_url: signed.signedUrl,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateErr) {
      return NextResponse.json({ success: false, error: `Update failed: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, pdfUrl: signed.signedUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}


