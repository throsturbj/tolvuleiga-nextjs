import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Inbound webhook from Repeat.
//
// IMPORTANT: Orders are created HERE after a successful payment — not when the
// user clicks "Panta".
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
//
// Product identity in product.custom_data (pick one product type):
//   { "secret": "...", "laptop_variant_uuid": "<uuid>" }
//   { "secret": "...", "gamingpc_uuid": 12, "skjar"?: true, "trygging"?: true, "screen_uuid"?: "<uuid>" }
//   { "secret": "...", "screen_uuid": "<uuid>" }
//   { "secret": "...", "gamingconsole_uuid": "<uuid>" }

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

type ProductRef =
  | { kind: 'laptop'; variantId: string; price: number | null }
  | { kind: 'gamingpc'; pcId: number; price: number | null; skjar: boolean; trygging: boolean; lyklabord: boolean; mus: boolean; screenId: string | null }
  | { kind: 'screen'; screenId: string; price: number | null; trygging: boolean }
  | { kind: 'console'; consoleId: string; price: number | null }

async function resolveProduct(
  supabase: ReturnType<typeof getServerSupabase>,
  body: Json
): Promise<ProductRef | null> {
  const variantId = findValue(body, ['laptop_variant_uuid', 'laptopVariantUuid'])
  if (variantId) {
    const { data: v } = await supabase
      .from('laptop_variants')
      .select('id, price')
      .eq('id', variantId)
      .maybeSingle()
    if (v) {
      return { kind: 'laptop', variantId: v.id, price: Number.isFinite(Number(v.price)) ? Number(v.price) : null }
    }
    console.warn('[repeat-webhook] laptop_variant_uuid not found', variantId)
  }

  const gamingpcRaw = findValue(body, ['gamingpc_uuid', 'gamingpcUuid', 'gaming_pc_uuid', 'pc_id', 'pcId'])
  if (gamingpcRaw) {
    const pcId = parseInt(String(gamingpcRaw).replace(/\D+/g, ''), 10)
    if (Number.isFinite(pcId)) {
      const { data: pc } = await supabase
        .from('GamingPC')
        .select('id, verd')
        .eq('id', pcId)
        .maybeSingle()
      if (pc) {
        const verdDigits = String(pc.verd ?? '').replace(/\D+/g, '')
        const price = parseInt(verdDigits, 10)
        const screenId = findValue(body, ['screen_uuid', 'screenUuid']) || null
        return {
          kind: 'gamingpc',
          pcId: pc.id,
          price: Number.isFinite(price) ? price : null,
          skjar: findBool(body, ['skjar', 'with_screen', 'withScreen']) === true || !!screenId,
          trygging: findBool(body, ['trygging', 'insured', 'with_insurance', 'withInsurance']) === true,
          lyklabord: findBool(body, ['lyklabord', 'keyboard']) === true,
          mus: findBool(body, ['mus', 'mouse']) === true,
          screenId,
        }
      }
      console.warn('[repeat-webhook] gamingpc_uuid not found', pcId)
    }
  }

  const consoleId = findValue(body, ['gamingconsole_uuid', 'gamingconsoleUuid', 'console_uuid', 'consoleUuid'])
  if (consoleId) {
    const { data: c } = await supabase
      .from('gamingconsoles')
      .select('id, verd')
      .eq('id', consoleId)
      .maybeSingle()
    if (c) {
      const verdDigits = String(c.verd ?? '').replace(/\D+/g, '')
      const price = parseInt(verdDigits, 10)
      return { kind: 'console', consoleId: c.id, price: Number.isFinite(price) ? price : null }
    }
    console.warn('[repeat-webhook] gamingconsole_uuid not found', consoleId)
  }

  const screenId = findValue(body, ['screen_uuid', 'screenUuid'])
  if (screenId) {
    const { data: s } = await supabase
      .from('screens')
      .select('id, verd')
      .eq('id', screenId)
      .maybeSingle()
    if (s) {
      const verdDigits = String(s.verd ?? '').replace(/\D+/g, '')
      const price = parseInt(verdDigits, 10)
      return {
        kind: 'screen',
        screenId: s.id,
        price: Number.isFinite(price) ? price : null,
        trygging: findBool(body, ['trygging', 'insured', 'with_insurance', 'withInsurance']) === true,
      }
    }
    console.warn('[repeat-webhook] screen_uuid not found', screenId)
  }

  return null
}

function productMatchFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  product: ProductRef
) {
  if (product.kind === 'laptop') return q.eq('laptop_variant_uuid', product.variantId)
  if (product.kind === 'gamingpc') return q.eq('gamingpc_uuid', product.pcId)
  if (product.kind === 'screen') return q.eq('screen_uuid', product.screenId)
  return q.eq('gamingconsole_uuid', product.consoleId)
}

function productKindFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  product: ProductRef
) {
  if (product.kind === 'laptop') return q.not('laptop_variant_uuid', 'is', null)
  if (product.kind === 'gamingpc') return q.not('gamingpc_uuid', 'is', null)
  if (product.kind === 'screen') return q.not('screen_uuid', 'is', null)
  return q.not('gamingconsole_uuid', 'is', null)
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
      outcome = 'confirm'
    } else if (type === 'subscription_deactivated') {
      outcome = 'cancel'
    }

    console.log('[repeat-webhook] received', { type, success, isPaid, isRefunded, isActive, outcome })

    if (outcome === 'ignore') {
      return NextResponse.json({ success: true, ignored: true, type })
    }

    const supabase = getServerSupabase()
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
        const normalizedEmail = customerEmail.trim().toLowerCase()
        let page = 1
        const perPage = 200
        while (page <= 20 && !authUid) {
          const { data: pageData, error: emailErr } = await supabase.auth.admin.listUsers({ page, perPage })
          if (emailErr || !pageData?.users?.length) break
          const match = pageData.users.find((u) => (u.email || '').toLowerCase() === normalizedEmail)
          if (match?.id) {
            authUid = match.id
            console.log('[repeat-webhook] matched user via email', customerEmail)
            break
          }
          if (pageData.users.length < perPage) break
          page += 1
        }
      } catch (e) {
        console.warn('[repeat-webhook] email lookup failed', e instanceof Error ? e.message : e)
      }
    }

    if (!authUid) {
      console.warn('[repeat-webhook] could not resolve user', { kennitala, customerEmail })
      return NextResponse.json({ success: false, error: 'No matching user (kennitala/email)' }, { status: 404 })
    }

    const product = await resolveProduct(supabase, body)
    if (!product) {
      console.warn('[repeat-webhook] cannot create order without product id in custom_data')
      return NextResponse.json(
        {
          success: false,
          error:
            'Product id missing/invalid in product.custom_data (need laptop_variant_uuid, gamingpc_uuid, screen_uuid, or gamingconsole_uuid)',
        },
        { status: 400 }
      )
    }

    // Price from product row, then payload fallbacks
    const payloadPriceRaw = findValue(body, ['price', 'amount', 'final_full_price', 'final_product_price'])
    const payloadPrice = payloadPriceRaw ? parseInt(String(payloadPriceRaw).replace(/\D+/g, ''), 10) : NaN
    const rootPrice = typeof root.price === 'number' ? root.price : NaN
    const verdSource = product.price != null && Number.isFinite(product.price)
      ? product.price
      : Number.isFinite(rootPrice)
        ? rootPrice
        : Number.isFinite(payloadPrice) && payloadPrice < 1_000_000
          ? payloadPrice
          : Number.isFinite(payloadPrice)
            ? Math.round(payloadPrice / 100)
            : null

    const orderSelect =
      'id, orderNumber, status, verd, timabilFra, auth_uid, laptop_variant_uuid, gamingpc_uuid, gamingconsole_uuid, screen_uuid, skjar, lyklabord, mus, trygging, created_at'

    if (outcome === 'cancel') {
      let q = supabase
        .from('orders')
        .select('id')
        .eq('auth_uid', authUid)
        .in('status', [HOLDING_STATUS, CONFIRMED_STATUS])
        .order('created_at', { ascending: false })
        .limit(1)
      q = productKindFilter(q, product)
      q = productMatchFilter(q, product)
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
        .select(orderSelect)
        .eq('auth_uid', authUid)
        .eq('status', CONFIRMED_STATUS)
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
      recentQ = productKindFilter(recentQ, product)
      recentQ = productMatchFilter(recentQ, product)
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
        .select(orderSelect)
        .eq('auth_uid', authUid)
        .eq('status', HOLDING_STATUS)
        .order('created_at', { ascending: false })
        .limit(1)
      holdQ = productKindFilter(holdQ, product)
      holdQ = productMatchFilter(holdQ, product)
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
          await sendOrderPaidEmail(supabase, updated, body)
        } catch (mailErr) {
          console.error('[repeat-webhook] admin email failed', mailErr instanceof Error ? mailErr.message : mailErr)
        }
        console.log('[repeat-webhook] upgraded holding order', holding[0].id)
        return NextResponse.json({ success: true, orderId: holding[0].id, status: CONFIRMED_STATUS, type, upgraded: true })
      }
    }

    const orderNumber = generateOrderNumber()
    const nowIso = new Date().toISOString()
    const insertPayload: Record<string, unknown> = {
      auth_uid: authUid,
      status: CONFIRMED_STATUS,
      orderNumber,
      verd: verdSource != null ? String(verdSource) : null,
      timabilFra: nowIso,
    }

    if (product.kind === 'laptop') {
      insertPayload.laptop_variant_uuid = product.variantId
    } else if (product.kind === 'gamingpc') {
      insertPayload.gamingpc_uuid = product.pcId
      insertPayload.skjar = product.skjar
      insertPayload.trygging = product.trygging
      insertPayload.lyklabord = product.lyklabord
      insertPayload.mus = product.mus
      if (product.screenId) insertPayload.screen_uuid = product.screenId
    } else if (product.kind === 'screen') {
      insertPayload.screen_uuid = product.screenId
      insertPayload.trygging = product.trygging
    } else {
      insertPayload.gamingconsole_uuid = product.consoleId
    }

    const { data: created, error: insertErr } = await supabase
      .from('orders')
      .insert([insertPayload])
      .select(orderSelect)
      .single()

    if (insertErr || !created) {
      console.error('[repeat-webhook] insert failed', insertErr?.message)
      return NextResponse.json({ success: false, error: insertErr?.message || 'Insert failed' }, { status: 500 })
    }

    console.log('[repeat-webhook] created order', { id: created.id, kind: product.kind })

    try {
      await sendOrderPaidEmail(supabase, created, body)
    } catch (mailErr) {
      console.error('[repeat-webhook] admin email failed', mailErr instanceof Error ? mailErr.message : mailErr)
    }

    return NextResponse.json({ success: true, orderId: created.id, status: CONFIRMED_STATUS, type, created: true, kind: product.kind })
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
  gamingpc_uuid?: number | null
  gamingconsole_uuid?: string | null
  screen_uuid?: string | null
  skjar?: boolean | null
  lyklabord?: boolean | null
  mus?: boolean | null
  trygging?: boolean | null
  created_at?: string | null
}

async function sendOrderPaidEmail(
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

  let productLabel = (typeof product?.title === 'string' && product.title) || 'Vara'
  let productKindLabel = 'pöntun'
  let userName = (typeof customer?.name === 'string' && customer.name) || 'Viðskiptavinur'
  const userEmail = (typeof customer?.email === 'string' && customer.email) || '—'
  let userPhone = (typeof customer?.phone === 'string' && customer.phone) || '—'
  let kennitala = (typeof customer?.ssid === 'string' && customer.ssid) || '—'

  if (order.laptop_variant_uuid) {
    productKindLabel = 'fartölvupöntun'
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
  } else if (order.gamingpc_uuid) {
    productKindLabel = 'borðtölvupöntun'
    const { data: pc } = await supabase
      .from('GamingPC')
      .select('name')
      .eq('id', order.gamingpc_uuid)
      .maybeSingle()
    productLabel = pc?.name || 'Borðtölva'
    const extras = [
      order.skjar ? 'skjár' : null,
      order.trygging ? 'trygging' : null,
      order.lyklabord ? 'lyklaborð' : null,
      order.mus ? 'mús' : null,
    ].filter(Boolean)
    if (extras.length) productLabel += ` · ${extras.join(', ')}`
  } else if (order.screen_uuid) {
    productKindLabel = 'skjáppöntun'
    const { data: s } = await supabase
      .from('screens')
      .select('framleidandi, skjastaerd')
      .eq('id', order.screen_uuid)
      .maybeSingle()
    productLabel = s ? `${s.framleidandi || ''} ${s.skjastaerd || ''}`.trim() || 'Skjár' : 'Skjár'
  } else if (order.gamingconsole_uuid) {
    productKindLabel = 'leikjatölvupöntun'
    const { data: c } = await supabase
      .from('gamingconsoles')
      .select('nafn')
      .eq('id', order.gamingconsole_uuid)
      .maybeSingle()
    productLabel = c?.nafn || 'Leikjatölva'
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
  const subject = `Ný ${productKindLabel} greidd – ${orderNumber}`
  const text =
    `Greiðsla móttekin.\n\n` +
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
