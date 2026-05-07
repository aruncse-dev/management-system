import { createFtMiddleware, FT_MIDDLEWARE_MATCHER } from '@fintracker-vault/auth/middleware'
import { getSessionOptions } from './lib/session'

const LOWERCASE_ROUTES = new Set([
  '/monthly',
  '/transactions',
  '/budget',
  '/credits',
  '/accounts',
  '/lending',
  '/savings',
  '/bommi',
  '/gold',
  '/investments',
  '/loans',
  '/settings',
  '/components',
  '/mutualfunds',
  '/stocks',
  '/savingspage',
  '/dashboard',
  '/admin',
])

export const middleware = createFtMiddleware({
  getSessionOptions,
  lowercaseRoutes: LOWERCASE_ROUTES,
})

export const config = {
  matcher: [...FT_MIDDLEWARE_MATCHER],
}
