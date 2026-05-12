import type { NextApiRequest, NextApiResponse } from 'next'
import { handleGoogleAuthPost } from '@fintracker-vault/auth'
import { getSessionOptions } from '../../../lib/session'
import { applyDefaultOrgToSession, verifyProvisionedGoogleUser } from '../../../lib/dbAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleGoogleAuthPost(req, res, getSessionOptions, {
    onVerified: ({ email, displayName }) => verifyProvisionedGoogleUser(email, displayName),
    prepareSession: async ({ email, session }) => applyDefaultOrgToSession(session, email),
  })
}
