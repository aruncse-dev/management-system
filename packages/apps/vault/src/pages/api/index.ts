import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getSessionOptions } from '../../lib/session'
import { BadDateError, handleVaultApi } from '../../lib/vaultMainApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  const traceId = typeof req.query.traceId === 'string' ? req.query.traceId : ''
  try {
    return await handleVaultApi(req, res, session, traceId)
  } catch (e) {
    // Without this a thrown error became Next's HTML 500 page, which the client
    // could only report as "Unexpected HTML from API".
    if (e instanceof BadDateError) {
      return res.status(400).json({ ok: false, error: e.message, traceId })
    }
    console.error('[vault /api]', traceId, e)
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: 'Server error — please try again.', traceId })
    }
  }
}
