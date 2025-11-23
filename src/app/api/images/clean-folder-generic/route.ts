import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const ALLOWED_BUCKETS = new Set(['screens', 'keyboards', 'mouses', 'consoles'])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const bucket = String(body?.bucket || '')
    const folder = String(body?.folder || '')
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ ok: false, error: 'Invalid bucket' }, { status: 400 })
    }
    if (!folder || folder === '/' || folder.includes('..')) {
      return NextResponse.json({ ok: false, error: 'Invalid folder' }, { status: 400 })
    }
    const admin = getServerSupabase()
    const { data: list } = await admin.storage.from(bucket).list(folder, { limit: 100, offset: 0 })
    const toRemove = (list || [])
      .filter((f: any) => f && !String(f.name || '').endsWith('/'))
      .map((f: any) => `${folder}/${f.name}`)
    if (toRemove.length > 0) {
      await admin.storage.from(bucket).remove(toRemove).catch(() => undefined)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}


