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
    const supabase = getServerSupabase()
    const { data, error } = await supabase
      .from('users')
      .select('auth_uid, full_name')
      .in('auth_uid', uids)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, users: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}



