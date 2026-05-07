import type { NextApiRequest, NextApiResponse } from 'next'
import { desc } from 'drizzle-orm'
import { getDb, users } from '@fintracker-vault/db'
import { requireAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res)
  if (!adminEmail) return

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

    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName
        : email.split('@')[0]

    await db
      .insert(users)
      .values({
        email,
        displayName,
        role: typeof (body as { role?: unknown }).role === 'string' ? (body as { role: string }).role : 'user',
        status: 'active',
        modules: Array.isArray((body as { modules?: unknown[] }).modules)
          ? (body as { modules: string[] }).modules
          : [],
        menuConfig: (body as { menuConfig?: unknown }).menuConfig ?? null,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          displayName,
          role: typeof (body as { role?: unknown }).role === 'string' ? (body as { role: string }).role : 'user',
          modules: Array.isArray((body as { modules?: unknown[] }).modules)
            ? (body as { modules: string[] }).modules
            : [],
          menuConfig: (body as { menuConfig?: unknown }).menuConfig ?? null,
          updatedAt: new Date(),
        },
      })

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
