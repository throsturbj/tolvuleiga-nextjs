import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { orderId?: string } | null
    const orderId = body?.orderId
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }

    const admin = getServerSupabase()

    // Fetch order to discover associated pdf_path (if any)
    const { data: orderRow, error: fetchErr } = await admin
      .from('orders')
      .select('id, pdf_path')
      .eq('id', orderId)
      .single<{ id: string; pdf_path?: string | null }>()

    if (fetchErr || !orderRow) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // Best-effort delete of storage object first (if exists)
    const bucket = 'order-pdfs'
    const path = orderRow.pdf_path || null
    if (path) {
      await admin.storage.from(bucket).remove([path]).catch(() => undefined)
    }

    // Delete the order row
    const { error: deleteErr } = await admin
      .from('orders')
      .delete()
      .eq('id', orderId)

    if (deleteErr) {
      return NextResponse.json({ success: false, error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}



