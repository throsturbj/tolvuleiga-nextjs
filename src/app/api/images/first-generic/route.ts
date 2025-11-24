import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const ALLOWED_BUCKETS: Set<string> = new Set(['screens', 'keyboards', 'mouses', 'consoles'])

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => ({}))

    // Extract bucket (must be a string)
    let bucket = ''
    if (typeof body === 'object' && body !== null) {
      const b = (body as Record<string, unknown>).bucket
      if (typeof b === 'string') {
        bucket = b
      }
    }

    // Extract folders as unknown[]
    const foldersRaw: unknown[] =
      typeof body === 'object' &&
      body !== null &&
      Array.isArray((body as Record<string, unknown>).folders)
        ? ((body as Record<string, unknown>).folders as unknown[])
        : []

    // Convert to sanitized string[]
    const folders = foldersRaw
      .map((x: unknown) => String(x ?? ''))
      .filter((s) => s && !s.includes('..') && s !== '/')

    // Validate bucket
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ ok: false, error: 'Invalid bucket' }, { status: 400 })
    }

    // Validate folder count
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

      // Filter valid file objects
      const files = (list ?? []).filter((f: unknown) => {
        if (
          typeof f === 'object' &&
          f !== null &&
          typeof (f as Record<string, unknown>).name === 'string'
        ) {
          const name = (f as Record<string, unknown>).name as string
          return !name.endsWith('/')
        }
        return false
      })

      if (files.length === 0) {
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
