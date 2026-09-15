import {
  createFtMiddleware,
  defaultIsPublicPath,
  FT_MIDDLEWARE_MATCHER,
} from '@fintracker-vault/auth/middleware'
import { getSessionOptions } from './lib/session'

const LOWERCASE_ROUTES = new Set(['/admin'])

function isPublicPath(pathname: string) {
  if (defaultIsPublicPath(pathname)) return true
  if (pathname === '/admin/login') return true
  if (pathname.startsWith('/api/admin/auth/')) return true
  return false
}

export const middleware = createFtMiddleware({
  getSessionOptions,
  lowercaseRoutes: LOWERCASE_ROUTES,
  isPublicPath,
  // Admin's `/` is a redirect stub, not a login screen — see `loginPath`.
  loginPath: '/admin/login',
})

export const config = {
  matcher: [...FT_MIDDLEWARE_MATCHER],
}
