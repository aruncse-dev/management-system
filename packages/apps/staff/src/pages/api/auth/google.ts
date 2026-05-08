import type { NextApiRequest, NextApiResponse } from 'next'
import { handleGoogleAuthPost } from '@fintracker-vault/auth'
import { applyDefaultOrgToSession, verifyProvisionedGoogleUser } from '@fintracker-vault/db'
import { getSessionOptions } from '../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleGoogleAuthPost(req, res, getSessionOptions, {
    onVerified: ({ email, displayName }) => verifyProvisionedGoogleUser(email, displayName),
    prepareSession: async ({ email, session }) => applyDefaultOrgToSession(session, email),
  })
}
