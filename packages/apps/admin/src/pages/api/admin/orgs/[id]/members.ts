import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq } from 'drizzle-orm'
import { getDb, organizations, orgMembers, users } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../../lib/adminGuard'
import { ensureUserRow } from '../../../../../lib/dbAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const orgId = typeof req.query.id === 'string' ? req.query.id : ''
  if (!orgId) return res.status(400).json({ ok: false, error: 'Missing organization id' })

  const db = getDb()

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
  if (!org) return res.status(404).json({ ok: false, error: 'Organization not found' })

  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: orgMembers.id,
        email: orgMembers.userEmail,
        displayName: users.displayName,
        role: orgMembers.role,
      })
      .from(orgMembers)
      .leftJoin(users, eq(orgMembers.userEmail, users.email))
      .where(eq(orgMembers.orgId, orgId))

    return res.status(200).json({ ok: true, data: rows })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const email =
      typeof (body as { email?: unknown }).email === 'string'
        ? (body as { email: string }).email.toLowerCase().trim()
        : ''
    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Valid email is required' })
    }

    const roleRaw = typeof (body as { role?: unknown }).role === 'string' ? (body as { role: string }).role : 'member'
    const roleInOrg = roleRaw === 'org_admin' ? 'admin' : 'member'
    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName.trim()
        : undefined

    await ensureUserRow(email, displayName)

    const [dup] = await db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userEmail, email)))
      .limit(1)
    if (dup) {
      return res.status(409).json({ ok: false, error: 'User is already in this organization' })
    }

    const id = crypto.randomUUID()
    await db.insert(orgMembers).values({ id, orgId, userEmail: email, role: roleInOrg })

    return res.status(201).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
