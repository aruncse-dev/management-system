import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getSessionOptions } from '../../lib/session'
import { handleVaultApi } from '../../lib/vaultMainApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  const traceId = typeof req.query.traceId === 'string' ? req.query.traceId : ''
  return handleVaultApi(req, res, session, traceId)
}
