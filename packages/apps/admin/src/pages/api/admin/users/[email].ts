import type { NextApiRequest, NextApiResponse } from 'next'
import { eq } from 'drizzle-orm'
import { getDb, users } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const targetEmail = decodeURIComponent(String(req.query.email || ''))
    .toLowerCase()
    .trim()
  if (!targetEmail) return res.status(400).json({ ok: false, error: 'Missing target email' })

  const db = getDb()

  if (req.method === 'GET') {
    const [user] = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1)
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' })
    return res.status(200).json({ ok: true, data: user })
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    await db
      .update(users)
      .set({
        displayName:
          typeof (body as { displayName?: unknown }).displayName === 'string'
            ? (body as { displayName: string }).displayName
            : undefined,
        orgId:
          typeof (body as { orgId?: unknown }).orgId === 'string'
            ? (body as { orgId: string }).orgId
            : undefined,
        status:
          typeof (body as { status?: unknown }).status === 'string'
            ? (body as { status: string }).status
            : undefined,
        useDb:
          typeof (body as { useDb?: unknown }).useDb === 'boolean'
            ? (body as { useDb: boolean }).useDb
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.email, targetEmail))
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    if (actor.kind === 'google' && targetEmail === actor.email.toLowerCase()) {
      return res.status(400).json({ ok: false, error: 'Admin cannot delete own account' })
    }
    await db.delete(users).where(eq(users.email, targetEmail))
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
