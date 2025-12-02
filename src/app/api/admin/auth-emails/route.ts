import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

type Body = { uids?: string[] }

export async function POST(req: NextRequest) {
  try {
    const { uids } = (await req.json().catch(() => ({}))) as Body
    if (!Array.isArray(uids) || uids.length === 0) {
      return NextResponse.json({ success: false, error: 'uids must be a non-empty array' }, { status: 400 })
    }
    const admin = getServerSupabase()
    const emails: Record<string, string> = {}
    for (const uid of uids) {
      try {
        const { data } = await admin.auth.admin.getUserById(uid)
        const email = data?.user?.email
        if (email) emails[uid] = email
      } catch {}
    }
    return NextResponse.json({ success: true, emails })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}



