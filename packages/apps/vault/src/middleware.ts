import { NextRequest, NextResponse } from 'next/server'

/** Lowercase URLs in the browser; rewrite to PascalCase page files. */
const vaultRouteMap: Record<string, string> = {
  '/vault': '/Vault',
  '/vaultinsurance': '/VaultInsurance',
  '/vaultapps': '/VaultApps',
  '/vaultsettings': '/VaultSettings',
}

const legacyUppercasePath: Record<string, string> = {
  '/Vault': '/vault',
  '/VaultInsurance': '/vaultinsurance',
  '/VaultApps': '/vaultapps',
  '/VaultSettings': '/vaultsettings',
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname === '/gas-proxy' || pathname.startsWith('/gas-proxy/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace(/^\/gas-proxy/, '/api/gas-proxy') || '/api/gas-proxy'
    return NextResponse.rewrite(url)
  }

  const canonicalLower = legacyUppercasePath[pathname]
  if (canonicalLower) {
    const url = request.nextUrl.clone()
    url.pathname = canonicalLower
    return NextResponse.redirect(url, 308)
  }

  const key = pathname.toLowerCase()
  const target = vaultRouteMap[key]
  if (target && pathname !== target) {
    const url = request.nextUrl.clone()
    url.pathname = target
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
