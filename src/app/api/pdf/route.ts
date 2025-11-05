import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get('url')
    const pathParam = req.nextUrl.searchParams.get('path')
    const bucketParam = req.nextUrl.searchParams.get('bucket')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    let bucket: string | null = null
    let objectPath: string | null = null

    if (bucketParam && pathParam) {
      bucket = bucketParam
      objectPath = pathParam
    } else if (urlParam) {
      try {
        const u = new URL(urlParam)
        const marker = '/storage/v1/object/sign/'
        const idx = u.pathname.indexOf(marker)
        if (idx !== -1) {
          const after = u.pathname.slice(idx + marker.length) // e.g., bucket/path/to.pdf
          const parts = after.split('/')
          bucket = parts.shift() || null
          objectPath = parts.length > 0 ? decodeURIComponent(parts.join('/')) : null
        }
      } catch {}
    }

    if (!bucket || !objectPath) {
      return NextResponse.json({ error: 'Missing or invalid path' }, { status: 400 })
    }

    const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, 60)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || 'Object not found' }, { status: 404 })
    }
    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


