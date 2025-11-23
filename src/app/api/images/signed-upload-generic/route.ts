import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const ALLOWED_BUCKETS = new Set(['screens', 'keyboards', 'mouses', 'consoles'])

function sanitizeFileName(name: string) {
  return String(name || 'file')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const bucket = String(body?.bucket || '')
    const folder = String(body?.folder || '')
    const fileNames: string[] = Array.isArray(body?.fileNames) ? body.fileNames : []
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ ok: false, error: 'Invalid bucket' }, { status: 400 })
    }
    if (!folder || folder === '/' || folder.includes('..')) {
      return NextResponse.json({ ok: false, error: 'Invalid folder' }, { status: 400 })
    }
    if (fileNames.length === 0) {
      return NextResponse.json({ ok: false, error: 'No file names' }, { status: 400 })
    }
    if (fileNames.length > 100) {
      return NextResponse.json({ ok: false, error: 'Too many files' }, { status: 400 })
    }
    const admin = getServerSupabase()
    const entries: { path: string; token: string }[] = []
    for (const rawName of fileNames) {
      const safeName = sanitizeFileName(rawName)
      const path = `${folder}/${safeName}`
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: true })
      if (error || !data?.token) {
        return NextResponse.json({ ok: false, error: error?.message || 'Failed to create signed URL' }, { status: 500 })
      }
      entries.push({ path, token: data.token })
    }
    return NextResponse.json({ ok: true, entries })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}


