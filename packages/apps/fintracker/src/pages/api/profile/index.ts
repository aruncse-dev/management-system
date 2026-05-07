import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { eq } from 'drizzle-orm'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getDb, users } from '@fintracker-vault/db'
import { getSessionOptions } from '../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const db = getDb()
  const email = session.email.toLowerCase()

  if (req.method === 'GET') {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' })
    }
    return res.status(200).json({
      ok: true,
      data: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        modules: user.modules,
        menuConfig: user.menuConfig,
        useDb: user.useDb,
      },
    })
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const displayName = typeof (body as { displayName?: unknown }).displayName === 'string'
      ? (body as { displayName: string }).displayName
      : undefined
    const menuConfig = (body as { menuConfig?: unknown }).menuConfig

    await db
      .update(users)
      .set({
        displayName,
        menuConfig: menuConfig === undefined ? undefined : menuConfig,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
