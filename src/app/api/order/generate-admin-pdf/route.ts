import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOrderPdfBuffer, buildAdminOrderText } from '@/lib/orders'
import { sendMail, buildUserOrderConfirmationText } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { orderId?: string } | null
    if (!body?.orderId || typeof body.orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: 'Server Supabase environment not configured' }, { status: 500 })
    }
    const serverClient = createClient(supabaseUrl, serviceKey)

    // Generate PDF buffer and meta (same as customer flow)
    const { buffer: pdfBuffer, filename, meta } = await generateOrderPdfBuffer(body.orderId)

    // Resolve customer's auth email (for admin text and optional resend to user)
    let userEmail: string | null = null
    try {
      if (meta?.order?.auth_uid) {
        const { data: userLookup } = await serverClient.auth.admin.getUserById(meta.order.auth_uid)
        userEmail = userLookup?.user?.email ?? null
      }
    } catch {}

    // Upload new PDF to storage (private bucket) and update order record
    const bucket = 'order-pdfs'
    const filePath = `order-${body.orderId}-${Date.now()}.pdf`

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
      .eq('id', body.orderId)

    if (updateErr) {
      return NextResponse.json({ success: false, error: `Update failed: ${updateErr.message}` }, { status: 500 })
    }

    // Email ONLY to admin with the PDF attached
    const adminEmail = 'tolvuleiga@tolvuleiga.is'
    const adminText = buildAdminOrderText(meta, userEmail, null)
    await sendMail({
      to: adminEmail,
      subject: 'Pöntunar PDF (endursent)',
      text: adminText,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    })

    // Optional: resend to the customer with modified subject and same body
    if (userEmail) {
      await sendMail({
        to: userEmail,
        subject: 'Pöntunarstaðfesting - Breytingar hafa verið gerðar',
        text: buildUserOrderConfirmationText(),
        attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
      })
    }

    return NextResponse.json({ success: true, pdfUrl: signed.signedUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}



