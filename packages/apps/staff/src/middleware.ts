import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const pathnameRaw = request.nextUrl.pathname
  if (pathnameRaw === '/gas-proxy' || pathnameRaw.startsWith('/gas-proxy/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathnameRaw.replace(/^\/gas-proxy/, '/api/gas-proxy') || '/api/gas-proxy'
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
