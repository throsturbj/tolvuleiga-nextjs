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
    const { data: list, error } = await admin.storage.from(bucket).list(folder, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    const files = (list || []).filter((f) => f && !String((f as { name?: string }).name || '').endsWith('/'))
    const results: { name: string; path: string; signedUrl: string }[] = []
    for (const f of files) {
      const path = `${folder}/${f.name}`
      const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(path, 120)
      if (sErr || !signed?.signedUrl) continue
      results.push({ name: f.name, path, signedUrl: signed.signedUrl })
    }
    return NextResponse.json({ ok: true, files: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}


