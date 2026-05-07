import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getSessionOptions } from './session'
import { getUserFromDb } from './dbAuth'

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) {
    res.status(401).json({ ok: false, error: 'Unauthorized' })
    return null
  }

  const user = await getUserFromDb(session.email)
  if (!user || user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'Forbidden' })
    return null
  }

  return session.email
}
