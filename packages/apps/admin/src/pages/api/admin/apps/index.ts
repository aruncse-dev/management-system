import type { NextApiRequest, NextApiResponse } from 'next'
import { createApp, listApps } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  if (req.method === 'GET') {
    const data = await listApps()
    return res.status(200).json({ ok: true, data })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const slug = typeof (body as { slug?: unknown }).slug === 'string' ? (body as { slug: string }).slug.trim() : ''
    const name = typeof (body as { name?: unknown }).name === 'string' ? (body as { name: string }).name.trim() : ''
    if (!slug || !name) return res.status(400).json({ ok: false, error: 'slug and name are required' })
    const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id.trim() : slug
    const description =
      typeof (body as { description?: unknown }).description === 'string'
        ? (body as { description: string }).description.trim() || null
        : null
    const icon =
      typeof (body as { icon?: unknown }).icon === 'string' ? (body as { icon: string }).icon.trim() || null : null
    const sortOrder =
      typeof (body as { sortOrder?: unknown }).sortOrder === 'number' ? (body as { sortOrder: number }).sortOrder : 0
    const status =
      typeof (body as { status?: unknown }).status === 'string' ? (body as { status: string }).status : 'active'
    try {
      const row = await createApp({ id, slug, name, description, icon, sortOrder, status })
      return res.status(201).json({ ok: true, data: row })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Create failed'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ ok: false, error: 'Slug or id already exists' })
      }
      throw e
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
