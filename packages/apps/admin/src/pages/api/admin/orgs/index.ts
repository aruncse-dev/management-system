import type { NextApiRequest, NextApiResponse } from 'next'
import { desc } from 'drizzle-orm'
import { assignDefaultOrgMenus, getDb, organizations } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'
import { randomUUID } from 'crypto'

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

  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.select().from(organizations).orderBy(desc(organizations.createdAt))
    return res.status(200).json({ ok: true, data: rows })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const name = typeof (body as { name?: unknown }).name === 'string' ? (body as { name: string }).name.trim() : ''
    if (!name) return res.status(400).json({ ok: false, error: 'Name is required' })

    const slugRaw = typeof (body as { slug?: unknown }).slug === 'string' ? (body as { slug: string }).slug.trim() : ''
    const slug = slugRaw ? slugify(slugRaw) : slugify(name)
    const notes = typeof (body as { notes?: unknown }).notes === 'string' ? (body as { notes: string }).notes.trim() : null

    const id = randomUUID()
    try {
      await db.insert(organizations).values({
        id,
        name,
        slug: slug || null,
        status: 'active',
        notes: notes || null,
      })
      await assignDefaultOrgMenus(id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create organization'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ ok: false, error: 'Slug already in use' })
      }
      throw e
    }

    return res.status(201).json({ ok: true, data: { id } })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
