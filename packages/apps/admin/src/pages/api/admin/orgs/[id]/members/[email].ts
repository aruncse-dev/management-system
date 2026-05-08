import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq } from 'drizzle-orm'
import { getDb, orgMembers, organizations } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const orgId = typeof req.query.id === 'string' ? req.query.id : ''
  const emailParam = typeof req.query.email === 'string' ? req.query.email : ''
  if (!orgId || !emailParam) {
    return res.status(400).json({ ok: false, error: 'Missing organization or user email' })
  }

  const userEmail = decodeURIComponent(emailParam).toLowerCase().trim()

  const db = getDb()

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
  if (!org) return res.status(404).json({ ok: false, error: 'Organization not found' })

  if (req.method === 'DELETE') {
    await db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userEmail, userEmail)))
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const roleRaw = typeof (body as { role?: unknown }).role === 'string' ? (body as { role: string }).role : ''
    const role = roleRaw === 'org_admin' ? 'org_admin' : roleRaw === 'member' ? 'member' : null
    if (!role) return res.status(400).json({ ok: false, error: 'role must be org_admin or member' })

    await db
      .update(orgMembers)
      .set({ role })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userEmail, userEmail)))

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'DELETE, PUT')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
