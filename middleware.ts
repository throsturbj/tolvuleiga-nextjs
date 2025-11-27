import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Narrow cookie options type to what's needed for NextResponse cookies API.
type CookieOptions = Partial<{
  path: string
  expires: Date
  maxAge: number
  domain: string
  secure: boolean
  httpOnly: boolean
  sameSite: 'strict' | 'lax' | 'none'
}>

const PROTECTED_PATHS = [
  '/dashboard',
  '/stjornbord',
  '/vorur',
  '/notendaupplysingar',
]

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 2 // 2 hours

  if (!supabaseUrl || !supabaseAnonKey) return res

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Map to the minimal shape expected by Supabase cookie methods
        return req.cookies.getAll().map(({ name, value }) => ({ name, value }))
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, ...options }) => {
          // NextResponse supports either ({ name, value, ...options }) or (name, value, options)
          res.cookies.set(name, value, options as CookieOptions)
        })
      },
    },
  })

  // Always call getSession to refresh/keep cookies in sync
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isProtected = PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

  // Enforce strict 2-hour cap since initial sign-in
  const sessionStartCookie = req.cookies.get('session-start')?.value || null
  const sessionStartMs = sessionStartCookie ? Number.parseInt(sessionStartCookie, 10) : NaN
  const now = Date.now()
  const hasValidStart = Number.isFinite(sessionStartMs)
  const isExpiredByPolicy = !!(session?.user && hasValidStart && (now - sessionStartMs > SESSION_MAX_AGE_MS))

  if (isExpiredByPolicy) {
    try {
      await supabase.auth.signOut()
    } catch {}
    // Clear helper cookies
    res.cookies.set('is-authenticated', '', { path: '/', maxAge: 0 })
    res.cookies.set('session-start', '', { path: '/', maxAge: 0 })

    // API routes should receive 401 instead of redirect to avoid broken fetches
    if (path.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const url = req.nextUrl.clone()
    url.pathname = '/auth'
    if (path !== '/auth') {
      url.searchParams.set('redirect', `${path}${req.nextUrl.search}`)
    }
    return NextResponse.redirect(url)
  }

  // Strict: protected routes require a valid server session
  if (isProtected && !session) {
    const redirect = `${path}${req.nextUrl.search}`
    const url = req.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('redirect', redirect)
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/stjornbord/:path*',
    '/vorur/:path*',
    '/notendaupplysingar/:path*',
    // Always run on auth to keep cookies refreshed when landing there
    '/auth',
  ],
}


