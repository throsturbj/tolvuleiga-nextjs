import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email'
import { getServerSupabase } from '@/lib/supabase-server'

const CANCEL_STATUS = 'Uppsögn í gangi'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      orderId,
      orderNumber,
      userName,
      userEmail,
      kennitala,
      phone,
      productLabel,
      price,
      timabilFra,
    } = body as {
      orderId?: string
      orderNumber?: string | null
      userName?: string
      userEmail?: string | null
      kennitala?: string | null
      phone?: string | null
      productLabel?: string | null
      price?: string | number | null
      timabilFra?: string | null
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Vantar orderId' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    // Load the order so we can verify it exists and enrich the email.
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, orderNumber, status, verd, timabilFra, auth_uid, laptop_variant_uuid')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pöntun fannst ekki' }, { status: 404 })
    }

    if (order.status === CANCEL_STATUS) {
      return NextResponse.json({ ok: true, alreadyRequested: true })
    }

    // Optionally enrich user info from the users table.
    let resolvedName = userName || 'Viðskiptavinur'
    const resolvedEmail = userEmail || null
    let resolvedKennitala = kennitala || null
    let resolvedPhone = phone || null
    if (order.auth_uid) {
      const { data: u } = await supabase
        .from('users')
        .select('full_name, kennitala, phone')
        .eq('auth_uid', order.auth_uid)
        .maybeSingle()
      if (u) {
        if (u.full_name) resolvedName = u.full_name
        if (u.kennitala) resolvedKennitala = u.kennitala
        if (u.phone) resolvedPhone = u.phone
      }
    }

    const formatDate = (d?: string | null) => {
      if (!d) return '—'
      const dt = new Date(d)
      return Number.isFinite(dt.getTime()) ? dt.toLocaleDateString('is-IS') : '—'
    }
    const formatIsk = (n?: string | number | null) => {
      const digits = String(n ?? '').replace(/\D+/g, '')
      const v = parseInt(digits, 10)
      if (!Number.isFinite(v)) return '—'
      return `${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kr/mánuði`
    }

    const subject = `Ósk um uppsögn – pöntun ${orderNumber || order.orderNumber || orderId.slice(-8)}`
    const text =
      `${resolvedName} óskar eftir uppsögn á fartölvuáskrift.\n\n` +
      `Pöntun: ${orderNumber || order.orderNumber || orderId}\n` +
      `Vara: ${productLabel || 'Fartölva'}\n` +
      `Verð: ${formatIsk(price ?? order.verd)}\n` +
      `Byrjun tímabils: ${formatDate(timabilFra || order.timabilFra)}\n\n` +
      `Notandi: ${resolvedName}\n` +
      `Netfang: ${resolvedEmail || '—'}\n` +
      `Sími: ${resolvedPhone || '—'}\n` +
      `Kennitala: ${resolvedKennitala || '—'}\n\n` +
      `Bestu kveðjur`

    await sendMail({
      to: 'tolvuleiga@tolvuleiga.is',
      subject,
      text,
    })

    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status: CANCEL_STATUS, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (updateErr) {
      return NextResponse.json({ error: `Tölvupóstur sendur en staða uppfærðist ekki: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: CANCEL_STATUS })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Villa neðst'
    return NextResponse.json({ error: message || 'Villa kom upp' }, { status: 500 })
  }
}
