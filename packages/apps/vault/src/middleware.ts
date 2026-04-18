import { NextRequest, NextResponse } from 'next/server'

/** Lowercase public URL -> internal page path. Keep in sync with `next.config.js` vault rewrites (removed; handled here). */
const LOWER_TO_PAGE: Record<string, string> = {
  '/vault': '/Vault',
  '/vaultinsurance': '/VaultInsurance',
  '/vaultapps': '/VaultApps',
  '/vaultsettings': '/VaultSettings',
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

  if (pathname !== lower) {
    const url = request.nextUrl.clone()
    url.pathname = lower
    return NextResponse.redirect(url, 308)
  }

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
