import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { generateOrderPdfBuffer } from '@/lib/orders'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ orderNumber: string }> }

export async function GET(_req: NextRequest, ctx: RouteParams) {
  try {
    const { orderNumber: rawOrderNumber } = await ctx.params
    const orderNumber = decodeURIComponent(rawOrderNumber || '').trim()
    if (!orderNumber) {
      return NextResponse.json({ error: 'orderNumber is required' }, { status: 400 })
    }

    const admin = getServerSupabase()

    // Look up order by human-friendly order number
    const { data: orderRow, error: orderErr } = await admin
      .from('orders')
      .select('id, orderNumber, pdf_path')
      .eq('orderNumber', orderNumber)
      .single<{ id: string; orderNumber: string | null; pdf_path?: string | null }>()

    if (orderErr || !orderRow) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const filename = `pontun-${orderRow.orderNumber ?? orderRow.id}.pdf`

    // If a stored PDF exists, stream it directly from Supabase Storage (private bucket)
    const bucket = 'order-pdfs'
    const existingPath = orderRow.pdf_path || null
    if (existingPath) {
      const { data: fileData, error: dlErr } = await admin.storage.from(bucket).download(existingPath)
      if (!dlErr && fileData) {
        const ab = await fileData.arrayBuffer()
        return new NextResponse(new Uint8Array(ab), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Cache-Control': 'private, max-age=300',
            'X-Robots-Tag': 'noindex',
          },
        })
      }
    }

    // Fallback: generate on the fly and (best-effort) cache it to storage
    const { buffer } = await generateOrderPdfBuffer(orderRow.id)
    const arrayBuffer = new ArrayBuffer(buffer.byteLength)
    new Uint8Array(arrayBuffer).set(buffer)

    // Upload asynchronously; response should not wait for this
    ;(async () => {
      try {
        const path = `order-${orderRow.id}-${Date.now()}.pdf`
        await admin.storage.from(bucket).upload(path, buffer, { contentType: 'application/pdf', upsert: true })
        await admin.from('orders').update({ pdf_path: path, pdf_generated_at: new Date().toISOString() }).eq('id', orderRow.id)
      } catch {}
    })()

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=120',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


