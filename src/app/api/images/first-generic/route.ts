import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const ALLOWED_BUCKETS = new Set(['screens', 'keyboards', 'mouses', 'consoles'])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const bucket = String(body?.bucket || '')
    const foldersRaw = Array.isArray(body?.folders) ? body.folders : []
    const folders = foldersRaw.map((x: any) => String(x || '')).filter((s: string) => s && !s.includes('..') && s !== '/')
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ ok: false, error: 'Invalid bucket' }, { status: 400 })
    }
    if (folders.length === 0) {
      return NextResponse.json({ ok: true, results: {} })
    }
    if (folders.length > 100) {
      return NextResponse.json({ ok: false, error: 'Too many folders' }, { status: 400 })
    }
    const admin = getServerSupabase()
    const results: Record<string, { path: string; signedUrl: string } | null> = {}
    for (const folder of folders) {
      const { data: list, error } = await admin.storage.from(bucket).list(folder, {
        limit: 200,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })
      if (error) {
        results[folder] = null
        continue
      }
      const files = (list || []).filter((f: any) => f && !String(f.name || '').endsWith('/'))
      if (!files || files.length === 0) {
        results[folder] = null
        continue
      }
      const first = files[0]
      const path = `${folder}/${first.name}`
      const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(path, 300)
      if (sErr || !signed?.signedUrl) {
        results[folder] = null
        continue
      }
      results[folder] = { path, signedUrl: signed.signedUrl }
    }
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}



