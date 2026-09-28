import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const ALLOWED_BUCKETS: Set<string> = new Set(['screens', 'keyboards', 'mouses', 'consoles', 'laptopimages', 'gamingpcimages'])

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => ({}))

    let bucket = ''
    if (typeof body === 'object' && body !== null) {
      const b = (body as Record<string, unknown>).bucket
      if (typeof b === 'string') {
        bucket = b
      }
    }

    const foldersRaw: unknown[] =
      typeof body === 'object' &&
      body !== null &&
      Array.isArray((body as Record<string, unknown>).folders)
        ? ((body as Record<string, unknown>).folders as unknown[])
        : []

    const folders = Array.from(
      new Set(
        foldersRaw
          .map((x: unknown) => String(x ?? ''))
          .filter((s) => s && !s.includes('..') && s !== '/')
      )
    )

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

    const listed = await Promise.all(
      folders.map(async (folder) => {
        const { data: list, error } = await admin.storage.from(bucket).list(folder, {
          limit: 8,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        })
        if (error) return { folder, path: null as string | null }
        const files = (list ?? []).filter((f: unknown) => {
          if (typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>).name === 'string') {
            const name = (f as Record<string, unknown>).name as string
            return !name.endsWith('/')
          }
          return false
        })
        if (files.length === 0) return { folder, path: null as string | null }
        const first = files[0] as { name: string }
        return { folder, path: `${folder}/${first.name}` }
      })
    )

    const toSign = listed.filter((row): row is { folder: string; path: string } => !!row.path)
    if (toSign.length === 0) {
      for (const folder of folders) results[folder] = null
      return NextResponse.json({ ok: true, results })
    }

    const { data: signed, error: sErr } = await admin.storage
      .from(bucket)
      .createSignedUrls(toSign.map((row) => row.path), 3600)

    const urlByPath = new Map<string, string>()
    if (!sErr && Array.isArray(signed)) {
      for (const row of signed) {
        if (row?.path && row.signedUrl) urlByPath.set(row.path, row.signedUrl)
      }
    }

    for (const folder of folders) results[folder] = null
    for (const row of toSign) {
      const url = urlByPath.get(row.path)
      results[row.folder] = url ? { path: row.path, signedUrl: url } : null
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
