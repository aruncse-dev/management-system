import { NextRequest, NextResponse } from 'next/server'

function stripTrailingSlash(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1)
  return p
}

const LOWERCASE_ROUTES = new Set(['/vault', '/vaultinsurance', '/vaultapps', '/vaultsettings'])

export function middleware(request: NextRequest) {
  const pathnameRaw = request.nextUrl.pathname
  if (pathnameRaw === '/gas-proxy' || pathnameRaw.startsWith('/gas-proxy/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathnameRaw.replace(/^\/gas-proxy/, '/api/gas-proxy') || '/api/gas-proxy'
    return NextResponse.rewrite(url)
  }

  const pathname = stripTrailingSlash(pathnameRaw)
  const lower = pathname.toLowerCase()
  if (!LOWERCASE_ROUTES.has(lower)) {
    return NextResponse.next()
  }

  if (pathnameRaw !== lower) {
    const url = request.nextUrl.clone()
    url.pathname = lower
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
