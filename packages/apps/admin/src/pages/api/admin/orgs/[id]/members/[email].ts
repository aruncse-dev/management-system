import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq } from 'drizzle-orm'
import { getDb, organizations, orgMembers } from '@fintracker-vault/db'
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
    const roleInOrg = roleRaw === 'org_admin' ? 'admin' : roleRaw === 'member' ? 'member' : null
    if (!roleInOrg) {
      return res.status(400).json({ ok: false, error: 'role must be org_admin or member' })
    }

    const [updated] = await db
      .update(orgMembers)
      .set({ role: roleInOrg })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userEmail, userEmail)))
      .returning({ id: orgMembers.id })

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Member not found in this organization' })
    }

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'DELETE, PUT')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
