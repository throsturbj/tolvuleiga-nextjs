import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const pcIdsRaw = Array.isArray(body?.pcIds) ? body.pcIds : []
    const pcIds = pcIdsRaw.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n) && n > 0)
    if (pcIds.length === 0) {
      return NextResponse.json({ ok: true, results: {} })
    }
    if (pcIds.length > 100) {
      return NextResponse.json({ ok: false, error: 'Too many ids' }, { status: 400 })
    }
    const bucket = 'gamingpcimages'
    const admin = getServerSupabase()
    const results: Record<number, { path: string; signedUrl: string } | null> = {}
    for (const id of pcIds) {
      const { data: list, error } = await admin.storage.from(bucket).list(String(id), {
        limit: 200,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })
      if (error) {
        results[id] = null
        continue
      }
      const files = (list || []).filter((f: any) => f && !String(f.name || '').endsWith('/'))
      if (!files || files.length === 0) {
        results[id] = null
        continue
      }
      const first = files[0]
      const path = `${id}/${first.name}`
      const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(path, 300)
      if (sErr || !signed?.signedUrl) {
        results[id] = null
        continue
      }
      results[id] = { path, signedUrl: signed.signedUrl }
    }
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}


