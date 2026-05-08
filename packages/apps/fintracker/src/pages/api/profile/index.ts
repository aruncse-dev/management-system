import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { eq } from 'drizzle-orm'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getDb, getEnabledOrgMenu, users } from '@fintracker-vault/db'
import { applyDefaultOrgToSession, listOrgsForUserEmail } from '../../../lib/dbAuth'
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
    const orgs = await listOrgsForUserEmail(email)
    const prevOrg = session.activeOrgId
    await applyDefaultOrgToSession(session, email)
    if (session.activeOrgId !== prevOrg) {
      await session.save()
    }
    let menu: Awaited<ReturnType<typeof getEnabledOrgMenu>> = []
    if (session.activeOrgId) {
      menu = await getEnabledOrgMenu(session.activeOrgId, 'fintracker')
    }

    return res.status(200).json({
      ok: true,
      data: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        settings: user.settings,
        useDb: user.useDb,
        orgs,
        activeOrgId: session.activeOrgId ?? null,
        menu,
      },
    })
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const displayName = typeof (body as { displayName?: unknown }).displayName === 'string'
      ? (body as { displayName: string }).displayName
      : undefined
    const settings = (body as { settings?: unknown }).settings

    await db
      .update(users)
      .set({
        displayName,
        settings: settings === undefined ? undefined : settings,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
