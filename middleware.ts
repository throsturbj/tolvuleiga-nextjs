import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
      get(name: string) {
        return req.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Parameters<ReturnType<typeof NextResponse>['cookies']['set']>[2]) {
        res.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: Parameters<ReturnType<typeof NextResponse>['cookies']['set']>[2]) {
        res.cookies.set({ name, value: '', ...options })
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


