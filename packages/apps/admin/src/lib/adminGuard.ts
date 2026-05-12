import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getUserFromDb, isAdminEmail } from './dbAuth'
import { getSessionOptions } from './session'

export type PlatformAdminActor = { kind: 'google'; email: string }

export async function requirePlatformAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<PlatformAdminActor | null> {
  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.authedAt || !session.email) {
    res.status(401).json({ ok: false, error: 'Unauthorized' })
    return null
  }

  const email = session.email.toLowerCase()
  if (isAdminEmail(email)) {
    return { kind: 'google', email: session.email }
  }

  const user = await getUserFromDb(email)
  if (!user || user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'Forbidden' })
    return null
  }

  return { kind: 'google', email: session.email }
}
