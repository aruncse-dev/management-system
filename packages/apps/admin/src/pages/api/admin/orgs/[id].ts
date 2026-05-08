import type { NextApiRequest, NextApiResponse } from 'next'
import { eq } from 'drizzle-orm'
import { getDb, organizations } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) return res.status(400).json({ ok: false, error: 'Missing organization id' })

  const db = getDb()

  if (req.method === 'GET') {
    const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1)
    if (!row) return res.status(404).json({ ok: false, error: 'Organization not found' })
    return res.status(200).json({ ok: true, data: row })
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const name = typeof (body as { name?: unknown }).name === 'string' ? (body as { name: string }).name.trim() : undefined
    const slugRaw = typeof (body as { slug?: unknown }).slug === 'string' ? (body as { slug: string }).slug.trim() : undefined
    const status =
      typeof (body as { status?: unknown }).status === 'string' ? (body as { status: string }).status : undefined
    const notes =
      typeof (body as { notes?: unknown }).notes === 'string' ? (body as { notes: string }).notes : undefined

    const slug = slugRaw !== undefined ? (slugRaw ? slugify(slugRaw) : null) : undefined

    try {
      await db
        .update(organizations)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(notes !== undefined ? { notes: notes || null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Update failed'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ ok: false, error: 'Slug already in use' })
      }
      throw e
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    await db.delete(organizations).where(eq(organizations.id, id))
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
