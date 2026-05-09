import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getSessionOptions } from '../../lib/session'
import { handleFintrackerMainApi } from '../../lib/fintrackerMainApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  return handleFintrackerMainApi(req, res, session)
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
}
