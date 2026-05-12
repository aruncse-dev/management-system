import type { NextApiRequest, NextApiResponse } from 'next'
import { and, asc, eq } from 'drizzle-orm'
import { getDb, orgMembers, organizations, users } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../lib/adminGuard'
import { ensureUserRow } from '../../../lib/dbAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const db = getDb()
  const orgIdFilter = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : ''

  if (req.method === 'GET') {
    const base = db
      .select({
        id: orgMembers.id,
        orgId: orgMembers.orgId,
        orgName: organizations.name,
        userEmail: orgMembers.userEmail,
        displayName: users.displayName,
        role: orgMembers.role,
        createdAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .leftJoin(users, eq(orgMembers.userEmail, users.email))

    const rows = await (orgIdFilter
      ? base.where(eq(orgMembers.orgId, orgIdFilter))
      : base
    ).orderBy(asc(organizations.name), asc(orgMembers.userEmail))

    return res.status(200).json({ ok: true, data: rows })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const orgIdVal =
      typeof (body as { orgId?: unknown }).orgId === 'string'
        ? (body as { orgId: string }).orgId.trim()
        : ''
    if (!orgIdVal) return res.status(400).json({ ok: false, error: 'Organization is required' })

    const userEmail =
      typeof (body as { userEmail?: unknown }).userEmail === 'string'
        ? (body as { userEmail: string }).userEmail.toLowerCase().trim()
        : ''
    if (!userEmail || !userEmail.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Valid email is required' })
    }

    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName.trim()
        : ''

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgIdVal)).limit(1)
    if (!org) return res.status(404).json({ ok: false, error: 'Organization not found' })

    await ensureUserRow(userEmail, displayName || undefined)
    if (displayName) {
      await db.update(users).set({ displayName, updatedAt: new Date() }).where(eq(users.email, userEmail))
    }

    const [dup] = await db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgIdVal), eq(orgMembers.userEmail, userEmail)))
      .limit(1)
    if (dup) {
      return res.status(409).json({ ok: false, error: 'This user is already a member of this organization' })
    }

    const id = crypto.randomUUID()
    await db.insert(orgMembers).values({ id, orgId: orgIdVal, userEmail, role: 'member' })

    return res.status(201).json({ ok: true, data: { id } })
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const memberId =
      typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id.trim() : ''
    if (!memberId) return res.status(400).json({ ok: false, error: 'Member id is required' })

    const hasDisplayName = Object.prototype.hasOwnProperty.call(body, 'displayName')
    const hasRole = Object.prototype.hasOwnProperty.call(body, 'role')

    if (!hasDisplayName && !hasRole) {
      return res.status(400).json({ ok: false, error: 'Nothing to update' })
    }

    const [member] = await db.select().from(orgMembers).where(eq(orgMembers.id, memberId)).limit(1)
    if (!member) return res.status(404).json({ ok: false, error: 'Member not found' })

    if (hasDisplayName) {
      const displayName =
        typeof (body as { displayName?: unknown }).displayName === 'string'
          ? (body as { displayName: string }).displayName.trim()
          : ''
      await ensureUserRow(member.userEmail, displayName || undefined)
      await db
        .update(users)
        .set({ displayName: displayName || null, updatedAt: new Date() })
        .where(eq(users.email, member.userEmail))
    }

    if (hasRole) {
      const roleRaw =
        typeof (body as { role?: unknown }).role === 'string' ? (body as { role: string }).role.trim() : ''
      const roleInOrg = roleRaw === 'org_admin' ? 'admin' : roleRaw === 'member' ? 'member' : null
      if (!roleInOrg) {
        return res.status(400).json({ ok: false, error: 'role must be org_admin or member' })
      }
      await db.update(orgMembers).set({ role: roleInOrg }).where(eq(orgMembers.id, memberId))
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
    if (!id) return res.status(400).json({ ok: false, error: 'Member id is required' })

    await db.delete(orgMembers).where(eq(orgMembers.id, id))
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
