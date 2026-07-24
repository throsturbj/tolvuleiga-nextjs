import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Inbound webhook from Repeat.
//
// IMPORTANT: Orders are created HERE after a successful payment — not when the
// user clicks "Panta" on the laptop page.
//
// Confirm triggers (create order as "Undirbúningur" + email admin):
//   - payment_attempt                 + success === true
//   - order_created                   + is_paid === true
//   - subscription_transaction_created + is_paid === true
//   - subscription_created            + active === true (fallback)
//
// Cancel triggers (mark matching recent order as "Hætt við" if found):
//   - subscription_deactivated
//   - payment_attempt                 + is_refunded === true
//
// Auth (any one is enough):
//   1. ?secret=... on the webhook URL  ← recommended:
//      https://www.tolvuleiga.is/api/webhooks/repeat?secret=YOUR_SECRET
//   2. x-webhook-secret header
//   3. product.custom_data.secret in the body
//
// Correlation for the logged-in user:
//   customer.ssid (kennitala) → users.auth_uid
//   fallback: customer.email → auth.users
// Product: product.custom_data.laptop_variant_uuid (or price/title from payload)

const CONFIRMED_STATUS = 'Undirbúningur'
const HOLDING_STATUS = 'Bíður greiðslu'
const CANCELLED_STATUS = 'Hætt við'
const ADMIN_EMAIL = 'tolvuleiga@tolvuleiga.is'

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

function generateOrderNumber() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function getCustomer(root: { [key: string]: Json }): { [key: string]: Json } | null {
  if (root.customer && typeof root.customer === 'object' && !Array.isArray(root.customer)) {
    return root.customer as { [key: string]: Json }
  }
  if (root.subscription && typeof root.subscription === 'object' && !Array.isArray(root.subscription)) {
    const sub = root.subscription as { [key: string]: Json }
    if (sub.customer && typeof sub.customer === 'object' && !Array.isArray(sub.customer)) {
      return sub.customer as { [key: string]: Json }
    }
  }
  return null
}

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

    const providedSecret =
      req.nextUrl.searchParams.get('secret') ||
      req.headers.get('x-webhook-secret') ||
      findValue(body, ['secret', 'webhook_secret', 'webhookSecret', 'apiKey', 'api_key'])
    if (!providedSecret || providedSecret !== expectedSecret) {
      console.warn('[repeat-webhook] Unauthorized – missing/wrong secret', {
        hasQuery: !!req.nextUrl.searchParams.get('secret'),
        hasHeader: !!req.headers.get('x-webhook-secret'),
        hasBodySecret: !!findValue(body, ['secret', 'webhook_secret', 'webhookSecret', 'apiKey', 'api_key']),
      })
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const type = typeof root.webhook_type === 'string' ? root.webhook_type : ''
    const success = root.success === true || findBool(body, ['success']) === true
    const isPaid = root.is_paid === true || findBool(body, ['is_paid', 'isPaid']) === true
    const isRefunded = root.is_refunded === true || findBool(body, ['is_refunded', 'isRefunded']) === true
    const isActive = root.active === true || findBool(body, ['active']) === true

    let outcome: 'confirm' | 'cancel' | 'ignore' = 'ignore'
    if (type === 'payment_attempt') {
      if (isRefunded) outcome = 'cancel'
      else if (success) outcome = 'confirm'
    } else if (type === 'order_created' && isPaid) {
      outcome = 'confirm'
    } else if (type === 'subscription_transaction_created' && isPaid) {
      outcome = 'confirm'
    } else if (type === 'subscription_created' && isActive) {
      // Only when Repeat marks the subscription active (paid).
      outcome = 'confirm'
    } else if (type === 'subscription_deactivated') {
      outcome = 'cancel'
    }

    console.log('[repeat-webhook] received', { type, success, isPaid, isRefunded, isActive, outcome })

    if (outcome === 'ignore') {
      return NextResponse.json({ success: true, ignored: true, type })
    }

    const supabase = getServerSupabase()
    const variantId = findValue(body, ['laptop_variant_uuid', 'laptopVariantUuid', 'variant_id', 'variantId'])
    const customer = getCustomer(root)
    const kennitala = normalizeKt(
      (typeof customer?.ssid === 'string' && customer.ssid) ||
        findValue(body, ['ssid', 'kennitala', 'ssn', 'nationalId', 'national_id'])
    )
    const customerEmail =
      (typeof customer?.email === 'string' && customer.email) ||
      findValue(body, ['email']) ||
      ''

    // Resolve auth user
    let authUid: string | undefined
    if (kennitala) {
      const formattedKt = kennitala.length === 10 ? `${kennitala.slice(0, 6)}-${kennitala.slice(6)}` : kennitala
      const { data: users } = await supabase
        .from('users')
        .select('auth_uid, kennitala')
        .in('kennitala', [kennitala, formattedKt])
        .limit(5)
      authUid = users?.[0]?.auth_uid
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
    }
    if (!authUid && customerEmail) {
      try {
        const { data: byEmail, error: emailErr } = await supabase.auth.admin.getUserByEmail(customerEmail)
        if (!emailErr && byEmail?.user?.id) {
          authUid = byEmail.user.id
          console.log('[repeat-webhook] matched user via email', customerEmail)
        }
      } catch (e) {
        console.warn('[repeat-webhook] email lookup failed', e instanceof Error ? e.message : e)
      }
    }

    if (!authUid) {
      console.warn('[repeat-webhook] could not resolve user', { kennitala, customerEmail })
      return NextResponse.json({ success: false, error: 'No matching user (kennitala/email)' }, { status: 404 })
    }

    // Resolve variant — required for creating a laptop order
    let resolvedVariantId = variantId
    let variantPrice: number | null = null
    if (resolvedVariantId) {
      const { data: v } = await supabase
        .from('laptop_variants')
        .select('id, price')
        .eq('id', resolvedVariantId)
        .maybeSingle()
      if (v) {
        variantPrice = Number(v.price)
      } else {
        console.warn('[repeat-webhook] custom_data variant not found', resolvedVariantId)
        resolvedVariantId = undefined
      }
    }

    // Price from payload as fallback / override display
    const payloadPriceRaw = findValue(body, ['price', 'amount', 'final_full_price', 'final_product_price'])
    const payloadPrice = payloadPriceRaw ? parseInt(String(payloadPriceRaw).replace(/\D+/g, ''), 10) : NaN
    // Repeat payment_attempt.amount is sometimes in minor units (x100) — prefer subscription.price / product price
    const rootPrice = typeof root.price === 'number' ? root.price : NaN
    const verdSource = Number.isFinite(variantPrice)
      ? variantPrice!
      : Number.isFinite(rootPrice)
        ? rootPrice
        : Number.isFinite(payloadPrice) && payloadPrice < 1_000_000
          ? payloadPrice
          : Number.isFinite(payloadPrice)
            ? Math.round(payloadPrice / 100)
            : null

    if (outcome === 'cancel') {
      // Best-effort: cancel newest open laptop order for this user
      let q = supabase
        .from('orders')
        .select('id')
        .eq('auth_uid', authUid)
        .in('status', [HOLDING_STATUS, CONFIRMED_STATUS])
        .not('laptop_variant_uuid', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
      if (resolvedVariantId) q = q.eq('laptop_variant_uuid', resolvedVariantId)
      const { data: toCancel } = await q
      const cancelId = toCancel?.[0]?.id
      if (!cancelId) {
        return NextResponse.json({ success: true, cancelled: false, reason: 'no open order' })
      }
      await supabase
        .from('orders')
        .update({ status: CANCELLED_STATUS, updated_at: new Date().toISOString() })
        .eq('id', cancelId)
      return NextResponse.json({ success: true, orderId: cancelId, status: CANCELLED_STATUS, type })
    }

    // === CONFIRM: create order (or upgrade a leftover holding order) ===

    // Idempotency: if we already confirmed a matching order recently, skip.
    {
      let recentQ = supabase
        .from('orders')
        .select('id, orderNumber, status, verd, timabilFra, auth_uid, laptop_variant_uuid, created_at')
        .eq('auth_uid', authUid)
        .eq('status', CONFIRMED_STATUS)
        .not('laptop_variant_uuid', 'is', null)
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
      if (resolvedVariantId) recentQ = recentQ.eq('laptop_variant_uuid', resolvedVariantId)
      const { data: recent } = await recentQ
      if (recent?.[0]) {
        console.log('[repeat-webhook] already confirmed recently, skipping', recent[0].id)
        return NextResponse.json({ success: true, orderId: recent[0].id, status: CONFIRMED_STATUS, type, skipped: true })
      }
    }

    // Upgrade leftover "Bíður greiðslu" orders from the old click-to-create flow
    {
      let holdQ = supabase
        .from('orders')
        .select('id, orderNumber, status, verd, timabilFra, auth_uid, laptop_variant_uuid, created_at')
        .eq('auth_uid', authUid)
        .eq('status', HOLDING_STATUS)
        .not('laptop_variant_uuid', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
      if (resolvedVariantId) holdQ = holdQ.eq('laptop_variant_uuid', resolvedVariantId)
      const { data: holding } = await holdQ
      if (holding?.[0]) {
        const { error: updErr } = await supabase
          .from('orders')
          .update({ status: CONFIRMED_STATUS, updated_at: new Date().toISOString() })
          .eq('id', holding[0].id)
        if (updErr) {
          return NextResponse.json({ success: false, error: updErr.message }, { status: 500 })
        }
        const updated = { ...holding[0], status: CONFIRMED_STATUS }
        try {
          await sendLaptopOrderPaidEmail(supabase, updated, body)
        } catch (mailErr) {
          console.error('[repeat-webhook] admin email failed', mailErr instanceof Error ? mailErr.message : mailErr)
        }
        console.log('[repeat-webhook] upgraded holding order', holding[0].id)
        return NextResponse.json({ success: true, orderId: holding[0].id, status: CONFIRMED_STATUS, type, upgraded: true })
      }
    }

    if (!resolvedVariantId) {
      console.warn('[repeat-webhook] cannot create order without laptop_variant_uuid in custom_data')
      return NextResponse.json(
        { success: false, error: 'laptop_variant_uuid missing/invalid in product.custom_data' },
        { status: 400 }
      )
    }

    const orderNumber = generateOrderNumber()
    const nowIso = new Date().toISOString()
    const insertPayload = {
      auth_uid: authUid,
      status: CONFIRMED_STATUS,
      orderNumber,
      verd: verdSource != null ? String(verdSource) : null,
      timabilFra: nowIso,
      laptop_variant_uuid: resolvedVariantId,
    }

    const { data: created, error: insertErr } = await supabase
      .from('orders')
      .insert([insertPayload])
      .select('id, orderNumber, status, verd, timabilFra, auth_uid, laptop_variant_uuid, created_at')
      .single()

    if (insertErr || !created) {
      console.error('[repeat-webhook] insert failed', insertErr?.message)
      return NextResponse.json({ success: false, error: insertErr?.message || 'Insert failed' }, { status: 500 })
    }

    console.log('[repeat-webhook] created order', created.id)

    try {
      await sendLaptopOrderPaidEmail(supabase, created, body)
    } catch (mailErr) {
      console.error('[repeat-webhook] admin email failed', mailErr instanceof Error ? mailErr.message : mailErr)
    }

    return NextResponse.json({ success: true, orderId: created.id, status: CONFIRMED_STATUS, type, created: true })
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

  const root = (webhookBody && typeof webhookBody === 'object' && !Array.isArray(webhookBody))
    ? (webhookBody as { [key: string]: Json })
    : {}
  const customer = getCustomer(root)
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
    to: ADMIN_EMAIL,
    subject,
    text,
  })
}
