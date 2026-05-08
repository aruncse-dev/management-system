import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteApp, getAppById, updateApp } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' })

  if (req.method === 'GET') {
    const row = await getAppById(id)
    if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
    return res.status(200).json({ ok: true, data: row })
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const patch: Parameters<typeof updateApp>[1] = {}
    if (typeof (body as { name?: unknown }).name === 'string') patch.name = (body as { name: string }).name
    if (typeof (body as { slug?: unknown }).slug === 'string') patch.slug = (body as { slug: string }).slug
    if (typeof (body as { description?: unknown }).description === 'string')
      patch.description = (body as { description: string }).description || null
    if (typeof (body as { icon?: unknown }).icon === 'string') patch.icon = (body as { icon: string }).icon || null
    if (typeof (body as { sortOrder?: unknown }).sortOrder === 'number')
      patch.sortOrder = (body as { sortOrder: number }).sortOrder
    if (typeof (body as { status?: unknown }).status === 'string') patch.status = (body as { status: string }).status
    const row = await updateApp(id, patch)
    if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
    return res.status(200).json({ ok: true, data: row })
  }

  if (req.method === 'DELETE') {
    try {
      await deleteApp(id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('foreign') || msg.includes('violates')) {
        return res.status(409).json({ ok: false, error: 'App is still referenced by menus' })
      }
      throw e
    }
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
