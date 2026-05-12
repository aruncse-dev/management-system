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
    const updates: Record<string, unknown> = {}

    if (typeof (body as { displayName?: unknown }).displayName === 'string') {
      updates.displayName = (body as { displayName: string }).displayName
    }
    if (typeof (body as { status?: unknown }).status === 'string') {
      updates.status = (body as { status: string }).status
    }
    if (typeof (body as { role?: unknown }).role === 'string') {
      const r = (body as { role: string }).role
      if (['member', 'org_admin', 'admin'].includes(r)) updates.role = r
    }
    if (typeof (body as { useDb?: unknown }).useDb === 'boolean') {
      updates.useDb = (body as { useDb: boolean }).useDb
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid fields to update' })
    }

    const patch: {
      displayName?: string
      status?: string
      role?: string
      useDb?: boolean
      updatedAt: Date
    } = { updatedAt: new Date() }
    if (updates.displayName !== undefined) patch.displayName = updates.displayName as string
    if (updates.status !== undefined) patch.status = updates.status as string
    if (updates.role !== undefined) patch.role = updates.role as string
    if (updates.useDb !== undefined) patch.useDb = updates.useDb as boolean

    await db.update(users).set(patch).where(eq(users.email, targetEmail))
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
