import type { NextApiRequest, NextApiResponse } from 'next'
import { desc } from 'drizzle-orm'
import { getDb, users } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt))
    return res.status(200).json({ ok: true, data: rows })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const email = typeof (body as { email?: unknown }).email === 'string'
      ? (body as { email: string }).email.toLowerCase().trim()
      : ''
    if (!email) return res.status(400).json({ ok: false, error: 'Email is required' })

    const orgId =
      typeof (body as { orgId?: unknown }).orgId === 'string'
        ? (body as { orgId: string }).orgId.trim()
        : ''
    if (!orgId) return res.status(400).json({ ok: false, error: 'Organization is required' })

    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName
        : email.split('@')[0]

    await db
      .insert(users)
      .values({
        email,
        displayName,
        orgId,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          displayName,
          orgId,
          updatedAt: new Date(),
        },
      })

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
