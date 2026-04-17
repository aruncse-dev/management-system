import { NextRequest, NextResponse } from 'next/server'

const routeMap: Record<string, string> = {
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

  const target = routeMap[pathname]

  if (!target) return NextResponse.next()

  // Redirect (not rewrite) so the URL matches filesystem routes; client-side
  // transitions use /_next/data/.../{pathname}.json and must match page files.
  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.redirect(url, 308)
}

export const config = {
  matcher: '/:path*',
}
