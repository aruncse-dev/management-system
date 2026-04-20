import type { SessionOptions } from 'iron-session'
import { getIronSession } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'
import type { FtSessionData } from './session'
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

/**
 * GAS proxy: always requires a valid iron-session + email. Never leaves the proxy open when SESSION_SECRET is missing.
 */
export async function handleGasProxy(
  request: NextRequest,
  pathnameRaw: string,
  getSessionOptions: GetFtSessionOptions,
): Promise<NextResponse | null> {
  const isBrowserProxy = pathnameRaw === '/gas-proxy' || pathnameRaw.startsWith('/gas-proxy/')
  const isApiProxy = pathnameRaw === '/api/gas-proxy' || pathnameRaw.startsWith('/api/gas-proxy/')
  if (!isBrowserProxy && !isApiProxy) return null

  let sessionOpts: SessionOptions
  try {
    sessionOpts = getSessionOptions()
  } catch {
    return NextResponse.json({ ok: false, error: SESSION_SETUP_MESSAGE }, { status: 503 })
  }

  if (isBrowserProxy) {
    const url = request.nextUrl.clone()
    url.pathname = pathnameRaw.replace(/^\/gas-proxy/, '/api/gas-proxy') || '/api/gas-proxy'
    const response = NextResponse.rewrite(url)
    const session = await getIronSession<FtSessionData>(request, response, sessionOpts)
    if (!session.email) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return response
  }

  const response = NextResponse.next()
  const session = await getIronSession<FtSessionData>(request, response, sessionOpts)
  if (!session.email) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return response
}

export type CreateFtMiddlewareOptions = {
  getSessionOptions: GetFtSessionOptions
  /** If pathname matches these (case-insensitive) and URL casing differs, 308 redirect to lowercase */
  lowercaseRoutes?: Set<string>
  isPublicPath?: (pathname: string) => boolean
}

export function createFtMiddleware(options: CreateFtMiddlewareOptions) {
  const isPublicPath = options.isPublicPath ?? defaultIsPublicPath
  const { getSessionOptions, lowercaseRoutes } = options

  return async function middleware(request: NextRequest): Promise<NextResponse> {
    const pathnameRaw = request.nextUrl.pathname

    if (pathnameRaw.startsWith('/_next')) {
      return NextResponse.next()
    }

    const gas = await handleGasProxy(request, pathnameRaw, getSessionOptions)
    if (gas) return gas

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
