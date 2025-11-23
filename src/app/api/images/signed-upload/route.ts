import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

function sanitizeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const pcId = Number(body?.pcId)
    const fileNames: string[] = Array.isArray(body?.fileNames) ? body.fileNames : []
    if (!Number.isFinite(pcId) || pcId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid pcId' }, { status: 400 })
    }
    if (fileNames.length === 0) {
      return NextResponse.json({ ok: false, error: 'No file names' }, { status: 400 })
    }
    if (fileNames.length > 100) {
      return NextResponse.json({ ok: false, error: 'Too many files' }, { status: 400 })
    }
    // Only allow this specific bucket for safety
    const bucket = 'gamingpcimages'
    const admin = getServerSupabase()
    const entries: { path: string; token: string }[] = []
    for (const rawName of fileNames) {
      const safeName = sanitizeFileName(String(rawName || 'file'))
      const path = `${pcId}/${safeName}`
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


