import { createFtMiddleware, FT_MIDDLEWARE_MATCHER } from '@fintracker-vault/auth/middleware'
import { getSessionOptions } from './lib/session'

export const middleware = createFtMiddleware({
  getSessionOptions,
})

export const config = {
  matcher: [...FT_MIDDLEWARE_MATCHER],
}
