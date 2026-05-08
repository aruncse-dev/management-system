import type { NextApiRequest, NextApiResponse } from 'next'
import { createMenuSection, listMenuSections } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  if (req.method === 'GET') {
    const data = await listMenuSections()
    return res.status(200).json({ ok: true, data })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const slug = typeof (body as { slug?: unknown }).slug === 'string' ? (body as { slug: string }).slug.trim() : ''
    const label = typeof (body as { label?: unknown }).label === 'string' ? (body as { label: string }).label.trim() : ''
    if (!slug || !label) return res.status(400).json({ ok: false, error: 'slug and label are required' })
    const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id.trim() : slug
    const sortOrder =
      typeof (body as { sortOrder?: unknown }).sortOrder === 'number' ? (body as { sortOrder: number }).sortOrder : 0
    try {
      const row = await createMenuSection({ id, slug, label, sortOrder })
      return res.status(201).json({ ok: true, data: row })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ ok: false, error: 'Section id or slug already exists' })
      }
      throw e
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
