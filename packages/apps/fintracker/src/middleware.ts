import { NextRequest, NextResponse } from 'next/server'

/**
 * Lowercase public URL -> internal page path (PascalCase files).
 * Must stay in sync with `routeAliases` in `next.config.js.cjs`.
 * Rewrites happen here because `next.config` rewrites alone do not resolve these paths reliably in dev.
 */
const LOWER_TO_PAGE: Record<string, string> = {
  '/monthly': '/Monthly',
  '/transactions': '/Transactions',
  '/budget': '/Budget',
  '/credits': '/Credits',
  '/accounts': '/Accounts',
  '/lending': '/Lending',
  '/savings': '/Savings',
  '/bommi': '/Bommi',
  '/gold': '/Gold',
  '/investments': '/Investments',
  '/loans': '/Loans',
  '/settings': '/Settings',
  '/components': '/Components',
  '/mutualfunds': '/MutualFunds',
  '/stocks': '/Stocks',
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname === '/gas-proxy' || pathname.startsWith('/gas-proxy/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace(/^\/gas-proxy/, '/api/gas-proxy') || '/api/gas-proxy'
    return NextResponse.rewrite(url)
  }

  const lower = pathname.toLowerCase()
  const internal = LOWER_TO_PAGE[lower]
  if (!internal) {
    return NextResponse.next()
  }

  // Enforce lowercase URL in the address bar
  if (pathname !== lower) {
    const url = request.nextUrl.clone()
    url.pathname = lower
    return NextResponse.redirect(url, 308)
  }

  // Serve PascalCase page while keeping /monthly etc. in the browser
  if (pathname !== internal) {
    const url = request.nextUrl.clone()
    url.pathname = internal
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
