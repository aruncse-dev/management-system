import type { NextApiRequest, NextApiResponse } from 'next'
import { handleGoogleAuthPost } from '@fintracker-vault/auth'
import { getSessionOptions } from '../../../lib/session'
import { getUserFromDb, upsertUser } from '../../../lib/dbAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleGoogleAuthPost(req, res, getSessionOptions, {
    skipAllowlistCheck: true,
    async onVerified({ email, displayName }) {
      await upsertUser(email, displayName)
      const user = await getUserFromDb(email)
      if (!user || user.status === 'suspended') {
        return { allowed: false, error: 'Account suspended. Contact admin.', statusCode: 403 }
      }
      return { allowed: true }
    },
  })
}
