import type { NextApiRequest, NextApiResponse } from 'next'
import { handleVerifyPinPost } from '@fintracker-vault/auth'
import { applyDefaultOrgToSession, getFirstPlatformAdminEmail } from '../../../lib/dbAuth'
import { getSessionOptions } from '../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleVerifyPinPost(req, res, getSessionOptions, {
    resolvePinBootstrapEmail: getFirstPlatformAdminEmail,
    async finalizeSession(session) {
      if (session.email) await applyDefaultOrgToSession(session, session.email)
    },
  })
}
