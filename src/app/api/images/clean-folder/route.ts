import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const pcId = Number(body?.pcId)
    if (!Number.isFinite(pcId) || pcId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid pcId' }, { status: 400 })
    }
    const bucket = 'gamingpcimages'
    const admin = getServerSupabase()
    const { data: list } = await admin.storage.from(bucket).list(String(pcId), { limit: 100, offset: 0 })
    const toRemove = (list || [])
      .filter((f: any) => f && !String(f.name || '').endsWith('/'))
      .map((f: any) => `${pcId}/${f.name}`)
    if (toRemove.length > 0) {
      await admin.storage.from(bucket).remove(toRemove).catch(() => undefined)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}


