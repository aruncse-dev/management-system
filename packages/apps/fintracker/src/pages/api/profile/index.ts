import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { eq } from 'drizzle-orm'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getDb, getEnabledOrgMenu, organizations, users } from '@fintracker-vault/db'
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

    let settingsPayload: unknown = user.settings
    const activeOid = session.activeOrgId?.trim() ?? ''
    if (activeOid && orgs.some((o) => o.id === activeOid)) {
      const [org] = await db
        .select({ settings: organizations.settings })
        .from(organizations)
        .where(eq(organizations.id, activeOid))
        .limit(1)
      const s = org?.settings
      settingsPayload = s && typeof s === 'object' ? s : {}
    }

    return res.status(200).json({
      ok: true,
      data: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        settings: settingsPayload,
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

    const orgsForPatch = await listOrgsForUserEmail(email)
    const activeOid = session.activeOrgId?.trim() ?? ''
    const orgSettingsTarget =
      activeOid && orgsForPatch.some((o) => o.id === activeOid) ? activeOid : null

    if (settings !== undefined && orgSettingsTarget) {
      await db
        .update(organizations)
        .set({ settings, updatedAt: new Date() })
        .where(eq(organizations.id, orgSettingsTarget))
    }

    if (displayName !== undefined || (settings !== undefined && !orgSettingsTarget)) {
      await db
        .update(users)
        .set({
          ...(displayName !== undefined ? { displayName } : {}),
          ...(settings !== undefined && !orgSettingsTarget ? { settings } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.email, email))
    }

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
