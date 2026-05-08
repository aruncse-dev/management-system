import type { NextApiRequest, NextApiResponse } from 'next'
import { handleLogoutPost } from '@fintracker-vault/auth'
import { getSessionOptions } from '../../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleLogoutPost(req, res, getSessionOptions)
}
