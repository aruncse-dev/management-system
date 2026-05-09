import type { NextApiRequest, NextApiResponse } from 'next'
import { eq } from 'drizzle-orm'
import { getDb, organizations, users } from '@fintracker-vault/db'
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
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.orgId, orgId))

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
    const role = roleRaw === 'org_admin' ? 'org_admin' : 'member'
    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName.trim()
        : undefined

    await ensureUserRow(email, displayName)

    try {
      await db
        .update(users)
        .set({ orgId, role })
        .where(eq(users.email, email))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ ok: false, error: 'User is already in this organization' })
      }
      throw e
    }

    return res.status(201).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
