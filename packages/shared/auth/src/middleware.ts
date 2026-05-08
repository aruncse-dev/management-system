import type { SessionOptions } from 'iron-session'
import { getIronSession } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'
import type { FtAdminSessionData, FtSessionData } from './session'
import type { GetFtSessionOptions } from './session'

const SESSION_SETUP_MESSAGE =
  'Server auth misconfigured: set SESSION_SECRET (32+ random characters, e.g. openssl rand -base64 32) in .env.local. See CLAUDE.md and packages/apps/<app>/.env.local.example.'

export function stripTrailingSlash(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1)
  return p
}

export function defaultIsPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname.startsWith('/api/auth/')) return true
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|json|txt|webmanifest)$/i.test(pathname)) return true
  return false
}

export type CreateFtMiddlewareOptions = {
  getSessionOptions: GetFtSessionOptions
  /** If pathname matches these (case-insensitive) and URL casing differs, 308 redirect to lowercase */
  lowercaseRoutes?: Set<string>
  isPublicPath?: (pathname: string) => boolean
  /**
   * Optional separate session for a platform admin area (`/admin`, `/api/admin/*`).
   * Requires `isPublicPath` to include `/admin/login` and `isPublicAdminApi` for auth endpoints.
   */
  adminConsole?: {
    getAdminSessionOptions: GetFtSessionOptions
    isPublicAdminApi: (pathname: string, method: string) => boolean
  }
}

export function createFtMiddleware(options: CreateFtMiddlewareOptions) {
  const isPublicPath = options.isPublicPath ?? defaultIsPublicPath
  const { getSessionOptions, lowercaseRoutes, adminConsole } = options

  return async function middleware(request: NextRequest): Promise<NextResponse> {
    const pathnameRaw = request.nextUrl.pathname

    if (pathnameRaw.startsWith('/_next')) {
      return NextResponse.next()
    }

    if (lowercaseRoutes && lowercaseRoutes.size > 0) {
      const pathname = stripTrailingSlash(pathnameRaw)
      const lower = pathname.toLowerCase()
      if (lowercaseRoutes.has(lower) && pathnameRaw !== lower) {
        const url = request.nextUrl.clone()
        url.pathname = lower
        return NextResponse.redirect(url, 308)
      }
    }

    if (isPublicPath(pathnameRaw)) {
      return NextResponse.next()
    }

    if (adminConsole) {
      const { getAdminSessionOptions, isPublicAdminApi } = adminConsole
      const method = request.method

      if (pathnameRaw.startsWith('/api/admin/')) {
        if (isPublicAdminApi(pathnameRaw, method)) {
          return NextResponse.next()
        }
        let adminOpts: SessionOptions
        try {
          adminOpts = getAdminSessionOptions()
        } catch {
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.error('[@fintracker-vault/auth] Admin SESSION_SECRET missing or invalid.')
            return NextResponse.json({ ok: false, error: SESSION_SETUP_MESSAGE }, { status: 503 })
          }
          return NextResponse.next()
        }
        const adminRes = NextResponse.next()
        const adminSession = await getIronSession<FtAdminSessionData>(request, adminRes, adminOpts)
        const adminAuthed = Boolean(adminSession.authedAt && adminSession.email)
        if (!adminAuthed) {
          return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        return adminRes
      }

      if (pathnameRaw === '/admin' || pathnameRaw.startsWith('/admin/')) {
        let adminOpts: SessionOptions
        try {
          adminOpts = getAdminSessionOptions()
        } catch {
          return NextResponse.next()
        }
        const adminRes = NextResponse.next()
        const adminSession = await getIronSession<FtAdminSessionData>(request, adminRes, adminOpts)
        const adminAuthed = Boolean(adminSession.authedAt && adminSession.email)
        if (!adminAuthed) {
          const url = request.nextUrl.clone()
          url.pathname = '/admin/login'
          url.searchParams.set('next', pathnameRaw)
          return NextResponse.redirect(url)
        }
        return adminRes
      }
    }

    let sessionOpts: SessionOptions
    try {
      sessionOpts = getSessionOptions()
    } catch {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[@fintracker-vault/auth] SESSION_SECRET missing or shorter than 32 characters.')
        if (pathnameRaw.startsWith('/api/')) {
          return NextResponse.json({ ok: false, error: SESSION_SETUP_MESSAGE }, { status: 503 })
        }
      }
      return NextResponse.next()
    }

    const res = NextResponse.next()
    const session = await getIronSession<FtSessionData>(request, res, sessionOpts)

    if (pathnameRaw.startsWith('/api/')) {
      if (!session.email) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      }
      return res
    }

    if (!session.email) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }

    return res
  }
}

export const FT_MIDDLEWARE_MATCHER = ['/((?!_next/static|_next/image|favicon.ico).*)'] as const
