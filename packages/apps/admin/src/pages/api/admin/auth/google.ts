import type { NextApiRequest, NextApiResponse } from 'next'
import { handleGoogleAuthPost } from '@fintracker-vault/auth'
import { getUserFromDb } from '../../../../lib/dbAuth'
import { getSessionOptions } from '../../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleGoogleAuthPost(req, res, getSessionOptions, {
    async onVerified({ email }) {
      const normalized = email.toLowerCase()
      const user = await getUserFromDb(normalized)
      if (user?.role === 'admin' && user.status === 'active') return { allowed: true }
      return {
        allowed: false,
        error: 'Google account is not a platform administrator.',
        statusCode: 403,
      }
    },
  })
}
