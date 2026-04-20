import type { NextApiRequest, NextApiResponse } from 'next'
import { handleSessionGet } from '@fintracker-vault/auth'
import { getSessionOptions } from '../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleSessionGet(req, res, getSessionOptions)
}
