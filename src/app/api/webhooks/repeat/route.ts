import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Inbound webhook from Repeat.
//
// Confirm triggers (any of these flip "Bíður greiðslu" -> "Undirbúningur"):
//   - payment_attempt              + success === true
//   - order_created                + is_paid === true
//   - subscription_transaction_created + is_paid === true
//
// Cancel triggers:
//   - subscription_deactivated
//   - payment_attempt              + is_refunded === true
//
// Auth (any one is enough):
//   1. ?secret=... query param on the webhook URL  (recommended in Repeat)
//   2. x-webhook-secret header
//   3. product.custom_data.secret in the body
//
// Correlation:
//   1. external_ref == our orderNumber (if present)
//   2. customer.ssid (kennitala) -> user -> newest holding laptop order

const CONFIRMED_STATUS = 'Undirbúningur'
const HOLDING_STATUS = 'Bíður greiðslu'
const CANCELLED_STATUS = 'Hætt við'

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

const looksLikeJson = (s: string) => {
  const t = s.trim()
  return t.startsWith('{') || t.startsWith('[')
}

function findValue(input: Json, keys: string[]): string | undefined {
  const wanted = keys.map((k) => k.toLowerCase())
  const stack: Json[] = [input]
  while (stack.length) {
    const node = stack.pop()
    if (typeof node === 'string' && looksLikeJson(node)) {
      try {
        stack.push(JSON.parse(node) as Json)
      } catch {
        // ignore
      }
      continue
    }
    if (node && typeof node === 'object') {
      if (Array.isArray(node)) {
        for (const v of node) stack.push(v)
      } else {
        for (const [k, v] of Object.entries(node)) {
          if (wanted.includes(k.toLowerCase()) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
            const val = String(v)
            if (val.length > 0 && val !== 'null') return val
          }
          if (v !== null) stack.push(v as Json)
        }
      }
    }
  }
  return undefined
}

function findBool(input: Json, keys: string[]): boolean | undefined {
  const raw = findValue(input, keys)
  if (raw === undefined) return undefined
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return undefined
}

const normalizeKt = (s: string | undefined) => (s || '').replace(/\D+/g, '')

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.REPEAT_WEBHOOK_SECRET
    if (!expectedSecret) {
      console.error('[repeat-webhook] REPEAT_WEBHOOK_SECRET not configured')
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 })
    }

    const body = (await req.json().catch(() => null)) as Json
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }
    const root = body as { [key: string]: Json }

    // Auth: URL query param (easiest in Repeat) OR header OR body custom_data.secret
    const providedSecret =
      req.nextUrl.searchParams.get('secret') ||
      req.headers.get('x-webhook-secret') ||
      findValue(body, ['secret', 'webhook_secret', 'webhookSecret', 'apiKey', 'api_key'])
    if (!providedSecret || providedSecret !== expectedSecret) {
      console.warn('[repeat-webhook] Unauthorized – missing/wrong secret')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const type = typeof root.webhook_type === 'string' ? root.webhook_type : ''
    const success = root.success === true || findBool(body, ['success']) === true
    const isPaid = root.is_paid === true || findBool(body, ['is_paid', 'isPaid']) === true
    const isRefunded = root.is_refunded === true || findBool(body, ['is_refunded', 'isRefunded']) === true

    let outcome: 'confirm' | 'cancel' | 'ignore' = 'ignore'
    if (type === 'payment_attempt') {
      if (isRefunded) outcome = 'cancel'
      else if (success) outcome = 'confirm'
    } else if (type === 'order_created' && isPaid) {
      outcome = 'confirm'
    } else if (type === 'subscription_transaction_created' && isPaid) {
      outcome = 'confirm'
    } else if (type === 'subscription_deactivated') {
      outcome = 'cancel'
    }

    console.log('[repeat-webhook] received', { type, success, isPaid, isRefunded, outcome })

    if (outcome === 'ignore') {
      return NextResponse.json({ success: true, ignored: true, type })
    }

    const supabase = getServerSupabase()
    const variantId = findValue(body, ['laptop_variant_uuid', 'laptopVariantUuid', 'variant_id', 'variantId'])

    let orderId: string | undefined

    // 1) external_ref == orderNumber (only treat non-empty strings)
    const externalRef = findValue(body, ['external_ref', 'externalRef'])
    if (externalRef) {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('orderNumber', externalRef)
        .limit(1)
      orderId = data?.[0]?.id
      if (orderId) console.log('[repeat-webhook] matched via external_ref', externalRef)
    }

    // 2) kennitala (customer.ssid) -> user -> newest holding laptop order
    if (!orderId) {
      const kennitala = normalizeKt(findValue(body, ['ssid', 'kennitala', 'ssn', 'nationalId', 'national_id']))
      if (!kennitala) {
        console.warn('[repeat-webhook] no kennitala/ssid in payload')
        return NextResponse.json({ success: false, error: 'kennitala (ssid) not found' }, { status: 400 })
      }

      // Match kennitala with or without hyphen / spaces by scanning recent candidates.
      const formattedKt = kennitala.length === 10 ? `${kennitala.slice(0, 6)}-${kennitala.slice(6)}` : kennitala
      let authUid: string | undefined
      {
        const { data: users, error: userErr } = await supabase
          .from('users')
          .select('auth_uid, kennitala')
          .in('kennitala', [kennitala, formattedKt])
          .limit(5)
        if (userErr) {
          return NextResponse.json({ success: false, error: userErr.message }, { status: 500 })
        }
        authUid = users?.[0]?.auth_uid
      }
      // Fallback: pull users that look similar and compare normalized digits
      if (!authUid) {
        const { data: candidates } = await supabase
          .from('users')
          .select('auth_uid, kennitala')
          .not('kennitala', 'is', null)
          .limit(500)
        const match = (candidates || []).find(
          (u: { auth_uid: string; kennitala?: string | null }) => normalizeKt(u.kennitala || undefined) === kennitala
        )
        authUid = match?.auth_uid
      }

      if (!authUid) {
        console.warn('[repeat-webhook] no user for kennitala', kennitala)
        return NextResponse.json({ success: false, error: 'No user for kennitala' }, { status: 404 })
      }

      const statuses = outcome === 'confirm' ? [HOLDING_STATUS] : [HOLDING_STATUS, CONFIRMED_STATUS]

      const findOrder = async (withVariant: boolean) => {
        let query = supabase
          .from('orders')
          .select('id')
          .eq('auth_uid', authUid!)
          .in('status', statuses)
          .not('laptop_variant_uuid', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
        if (withVariant && variantId) query = query.eq('laptop_variant_uuid', variantId)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return data?.[0]?.id as string | undefined
      }

      try {
        // Prefer variant filter when present, but fall back without it if nothing matches
        // (avoids stuck orders when custom_data has a wrong/outdated variant id).
        orderId = (variantId ? await findOrder(true) : undefined) || (await findOrder(false))
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Order lookup failed'
        return NextResponse.json({ success: false, error: message }, { status: 500 })
      }

      if (orderId) console.log('[repeat-webhook] matched via kennitala', { kennitala, orderId })
    }

    if (!orderId) {
      console.warn('[repeat-webhook] no matching laptop order')
      return NextResponse.json({ success: false, error: 'No matching laptop order found' }, { status: 404 })
    }

    const nextStatus = outcome === 'confirm' ? CONFIRMED_STATUS : CANCELLED_STATUS

    // Load current order so we can skip duplicate webhook events (and avoid re-emailing).
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('id, orderNumber, status, verd, timabilFra, auth_uid, laptop_variant_uuid, created_at')
      .eq('id', orderId)
      .single()

    if (currentOrder?.status === nextStatus) {
      console.log('[repeat-webhook] already at target status, skipping', { orderId, nextStatus, type })
      return NextResponse.json({ success: true, orderId, status: nextStatus, type, skipped: true })
    }

    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (updateErr) {
      console.error('[repeat-webhook] update failed', updateErr.message)
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    console.log('[repeat-webhook] updated', { orderId, status: nextStatus, type })

    // Notify admin when payment is confirmed.
    if (outcome === 'confirm') {
      try {
        await sendLaptopOrderPaidEmail(supabase, currentOrder || { id: orderId }, body)
      } catch (mailErr) {
        // Don't fail the webhook if mail fails — status is already updated.
        console.error('[repeat-webhook] admin email failed', mailErr instanceof Error ? mailErr.message : mailErr)
      }
    }

    return NextResponse.json({ success: true, orderId, status: nextStatus, type })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[repeat-webhook] error', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

type OrderRow = {
  id: string
  orderNumber?: string | null
  status?: string | null
  verd?: string | number | null
  timabilFra?: string | null
  auth_uid?: string | null
  laptop_variant_uuid?: string | null
  created_at?: string | null
}

async function sendLaptopOrderPaidEmail(
  supabase: ReturnType<typeof getServerSupabase>,
  order: OrderRow,
  webhookBody: Json
) {
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
  const formatStorage = (gb: number) =>
    gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`

  // Prefer known Repeat nested paths so we don't pick up shop.name etc.
  const root = (webhookBody && typeof webhookBody === 'object' && !Array.isArray(webhookBody))
    ? (webhookBody as { [key: string]: Json })
    : {}
  const customer =
    (root.customer && typeof root.customer === 'object' && !Array.isArray(root.customer)
      ? (root.customer as { [key: string]: Json })
      : null) ||
    (root.subscription && typeof root.subscription === 'object' && !Array.isArray(root.subscription)
      ? (((root.subscription as { [key: string]: Json }).customer as { [key: string]: Json } | undefined) || null)
      : null)
  const product =
    (root.product && typeof root.product === 'object' && !Array.isArray(root.product)
      ? (root.product as { [key: string]: Json })
      : null) ||
    (Array.isArray(root.products) && root.products[0] && typeof root.products[0] === 'object'
      ? (root.products[0] as { [key: string]: Json })
      : null)

  let productLabel = (typeof product?.title === 'string' && product.title) || 'Fartölva'
  let userName = (typeof customer?.name === 'string' && customer.name) || 'Viðskiptavinur'
  const userEmail = (typeof customer?.email === 'string' && customer.email) || '—'
  let userPhone = (typeof customer?.phone === 'string' && customer.phone) || '—'
  let kennitala = (typeof customer?.ssid === 'string' && customer.ssid) || '—'

  // Prefer DB product label when we have the variant.
  if (order.laptop_variant_uuid) {
    const { data: variant } = await supabase
      .from('laptop_variants')
      .select('id, storage_gb, laptop_id')
      .eq('id', order.laptop_variant_uuid)
      .maybeSingle()
    if (variant) {
      const { data: laptop } = await supabase
        .from('laptops')
        .select('name')
        .eq('id', variant.laptop_id)
        .maybeSingle()
      const name = laptop?.name || 'Fartölva'
      productLabel = `${name} · ${formatStorage(Number(variant.storage_gb))}`
    }
  }

  if (order.auth_uid) {
    const { data: u } = await supabase
      .from('users')
      .select('full_name, kennitala, phone')
      .eq('auth_uid', order.auth_uid)
      .maybeSingle()
    if (u) {
      if (u.full_name) userName = u.full_name
      if (u.kennitala) kennitala = u.kennitala
      if (u.phone) userPhone = u.phone
    }
  }

  const orderNumber = order.orderNumber || order.id.slice(-8)
  const subject = `Ný fartölvupöntun greidd – ${orderNumber}`
  const text =
    `Greiðsla móttekin fyrir fartölvuáskrift.\n\n` +
    `Pöntun: ${orderNumber}\n` +
    `Staða: ${CONFIRMED_STATUS}\n` +
    `Vara: ${productLabel}\n` +
    `Verð: ${formatIsk(order.verd)}\n` +
    `Byrjun tímabils: ${formatDate(order.timabilFra)}\n` +
    `Stofnað: ${formatDate(order.created_at)}\n\n` +
    `Notandi: ${userName}\n` +
    `Netfang: ${userEmail}\n` +
    `Sími: ${userPhone}\n` +
    `Kennitala: ${kennitala}\n\n` +
    `Bestu kveðjur`

  await sendMail({
    to: 'tolvuleiga@tolvuleiga.is',
    subject,
    text,
  })
}
