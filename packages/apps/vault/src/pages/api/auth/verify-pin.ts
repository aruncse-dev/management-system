import type { NextApiRequest, NextApiResponse } from 'next'
import { handleVerifyPinPost } from '@fintracker-vault/auth'
import { applyDefaultOrgToSession } from '@fintracker-vault/db'
import { getSessionOptions } from '../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleVerifyPinPost(req, res, getSessionOptions, {
    async finalizeSession(session) {
      if (session.email) await applyDefaultOrgToSession(session, session.email)
    },
  })
}
