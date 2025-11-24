import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const ALLOWED_BUCKETS = new Set(['screens', 'keyboards', 'mouses', 'consoles'])

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => ({}))

    // Ensure we safely extract known fields from unknown JSON
    const bucket = typeof (body as any)?.bucket === 'string' ? (body as any).bucket : ''
    const foldersRaw: unknown[] = Array.isArray((body as any)?.folders)
      ? (body as any).folders
      : []

    // Convert elements into strings safely and sanitize
    const folders = foldersRaw
      .map((x: unknown) => String(x ?? ''))
      .filter((s: string) => s && !s.includes('..') && s !== '/')

    // Validate bucket
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

      const files = (list || []).filter((f: unknown) => {
        const name = typeof (f as any)?.name === 'string' ? (f as any).name : ''
        return name && !name.endsWith('/')
      })

      if (!files.length) {
        results[folder] = null
        continue
      }

      const first = files[0] as { name: string }
      const path = `${folder}/${first.name}`

      const { data: signed, error: sErr } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, 300)

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
