import type { NextApiRequest, NextApiResponse } from 'next'
import { createMenuCatalogEntry, listMenuCatalog } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  if (req.method === 'GET') {
    const app = typeof req.query.app === 'string' && req.query.app.trim() ? req.query.app.trim() : undefined
    const data = await listMenuCatalog(app)
    return res.status(200).json({ ok: true, data })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id.trim() : ''
    const slug = typeof (body as { slug?: unknown }).slug === 'string' ? (body as { slug: string }).slug.trim() : ''
    const label = typeof (body as { label?: unknown }).label === 'string' ? (body as { label: string }).label.trim() : ''
    const path = typeof (body as { path?: unknown }).path === 'string' ? (body as { path: string }).path.trim() : ''
    const sectionId =
      typeof (body as { sectionId?: unknown }).sectionId === 'string'
        ? (body as { sectionId: string }).sectionId.trim()
        : ''
    const rawApps = (body as { appSlugs?: unknown }).appSlugs
    if (!id || !slug || !label || !path || !sectionId) {
      return res.status(400).json({ ok: false, error: 'id, slug, label, path, and sectionId are required' })
    }
    if (!Array.isArray(rawApps) || !rawApps.every(x => typeof x === 'string')) {
      return res.status(400).json({ ok: false, error: 'appSlugs must be a string array' })
    }
    const appSlugs = rawApps as string[]
    if (!appSlugs.length) return res.status(400).json({ ok: false, error: 'appSlugs must not be empty' })
    const icon =
      typeof (body as { icon?: unknown }).icon === 'string' ? (body as { icon: string }).icon.trim() || null : null
    const sortOrder =
      typeof (body as { sortOrder?: unknown }).sortOrder === 'number' ? (body as { sortOrder: number }).sortOrder : 0
    try {
      const row = await createMenuCatalogEntry({
        id,
        slug,
        label,
        icon,
        path,
        sectionId,
        sortOrder,
        appSlugs,
      })
      return res.status(201).json({ ok: true, data: row })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Create failed'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ ok: false, error: 'Menu id or slug already exists' })
      }
      if (msg.includes('invalid')) return res.status(400).json({ ok: false, error: msg })
      throw e
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
