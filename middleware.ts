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

  const softAuthenticated = req.cookies.get('is-authenticated')?.value === 'true'

  if (isProtected && !(session || softAuthenticated)) {
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


