import type { NextApiRequest, NextApiResponse } from 'next'
import { desc, eq } from 'drizzle-orm'
import { getDb, users } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

/** `users.role = admin` — platform administrators (Admin app only). Not org membership. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .orderBy(desc(users.createdAt))
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

    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName.trim()
        : email.split('@')[0]

    const statusRaw = typeof (body as { status?: unknown }).status === 'string' ? (body as { status: string }).status : 'active'
    const status = ['active', 'inactive'].includes(statusRaw) ? statusRaw : 'active'

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      if (existing.role === 'admin') {
        return res.status(409).json({ ok: false, error: 'This email already has platform admin access' })
      }
      await db
        .update(users)
        .set({
          role: 'admin',
          displayName: displayName || existing.displayName || email.split('@')[0],
          status,
          updatedAt: new Date(),
        })
        .where(eq(users.email, email))
      return res.status(200).json({ ok: true })
    }

    await db.insert(users).values({
      email,
      displayName,
      role: 'admin',
      status,
      useDb: false,
    })

    return res.status(201).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
