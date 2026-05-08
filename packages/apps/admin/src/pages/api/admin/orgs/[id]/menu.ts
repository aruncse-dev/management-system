import type { NextApiRequest, NextApiResponse } from 'next'
import { eq } from 'drizzle-orm'
import {
  getDb,
  getOrgMenuEditorState,
  organizations,
  setOrgEnabledMenuIds,
} from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../../lib/adminGuard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) return res.status(400).json({ ok: false, error: 'Missing organization id' })

  const db = getDb()
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, id)).limit(1)
  if (!org) return res.status(404).json({ ok: false, error: 'Organization not found' })

  if (req.method === 'GET') {
    const appSlug =
      typeof req.query.app === 'string' && req.query.app.trim() ? req.query.app.trim() : 'fintracker'
    const data = await getOrgMenuEditorState(id, appSlug)
    return res.status(200).json({ ok: true, data })
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
    const appSlug =
      typeof (body as { appSlug?: unknown }).appSlug === 'string' ? (body as { appSlug: string }).appSlug.trim() : ''
    if (!appSlug) {
      return res.status(400).json({ ok: false, error: 'appSlug is required (e.g. fintracker, vault, staff)' })
    }
    const raw = (body as { enabledMenuIds?: unknown }).enabledMenuIds
    if (!Array.isArray(raw) || !raw.every(x => typeof x === 'string')) {
      return res.status(400).json({ ok: false, error: 'enabledMenuIds must be a string array' })
    }
    await setOrgEnabledMenuIds(id, new Set(raw as string[]), appSlug)
    const data = await getOrgMenuEditorState(id, appSlug)
    return res.status(200).json({ ok: true, data })
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
