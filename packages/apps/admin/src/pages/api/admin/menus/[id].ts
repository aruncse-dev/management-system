import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteMenuCatalogEntry, getMenuCatalogEntry, updateMenuCatalogEntry } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' })

  if (req.method === 'GET') {
    const row = await getMenuCatalogEntry(id)
    if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
    return res.status(200).json({ ok: true, data: row })
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const patch: Parameters<typeof updateMenuCatalogEntry>[1] = {}
    if (typeof (body as { slug?: unknown }).slug === 'string') patch.slug = (body as { slug: string }).slug
    if (typeof (body as { label?: unknown }).label === 'string') patch.label = (body as { label: string }).label
    if (typeof (body as { path?: unknown }).path === 'string') patch.path = (body as { path: string }).path
    if (typeof (body as { sectionId?: unknown }).sectionId === 'string')
      patch.sectionId = (body as { sectionId: string }).sectionId
    if (typeof (body as { icon?: unknown }).icon === 'string') patch.icon = (body as { icon: string }).icon || null
    if (typeof (body as { sortOrder?: unknown }).sortOrder === 'number')
      patch.sortOrder = (body as { sortOrder: number }).sortOrder
    const rawApps = (body as { appSlugs?: unknown }).appSlugs
    if (rawApps !== undefined) {
      if (!Array.isArray(rawApps) || !rawApps.every(x => typeof x === 'string')) {
        return res.status(400).json({ ok: false, error: 'appSlugs must be a string array' })
      }
      patch.appSlugs = rawApps as string[]
    }
    try {
      const row = await updateMenuCatalogEntry(id, patch)
      if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
      return res.status(200).json({ ok: true, data: row })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Update failed'
      if (msg.includes('invalid')) return res.status(400).json({ ok: false, error: msg })
      throw e
    }
  }

  if (req.method === 'DELETE') {
    await deleteMenuCatalogEntry(id)
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
