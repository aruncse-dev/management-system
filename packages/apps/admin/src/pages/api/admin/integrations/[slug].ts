import type { NextApiRequest, NextApiResponse } from 'next'
import { eq } from 'drizzle-orm'
import {
  decryptSensitiveField,
  encryptSensitiveField,
  endpointsFromRows,
  getIntegrationProviderBySlug,
} from '@fintracker-vault/db'
import { getDb, integrationProviders, orgIntegrations } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'
import { providerToPublic } from '../../../../lib/integrationApi'

function parseBodyEndpoints(body: Record<string, unknown>) {
  const raw = body.endpoints
  if (Array.isArray(raw)) {
    const rows: { key: string; url: string }[] = []
    for (const item of raw) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as { key?: unknown; url?: unknown }
        if (typeof o.key === 'string' && typeof o.url === 'string') {
          rows.push({ key: o.key, url: o.url })
        }
      }
    }
    return endpointsFromRows(rows)
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return endpointsFromRows(
      Object.entries(raw as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string')
        .map(([key, url]) => ({ key, url: url as string })),
    )
  }
  return undefined
}

function parseBodyAppMenus(body: Record<string, unknown>) {
  const raw = body.appMenus
  if (raw === undefined) return undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string[]> = {}
  for (const [app, menus] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(menus)) {
      out[app] = menus.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    }
  }
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await requirePlatformAdmin(req, res)
  if (!actor) return

  const slug = typeof req.query.slug === 'string' ? req.query.slug : ''
  if (!slug) return res.status(400).json({ ok: false, error: 'Missing integration slug' })

  const db = getDb()

  if (req.method === 'GET') {
    const row = await getIntegrationProviderBySlug(slug)
    if (!row) return res.status(404).json({ ok: false, error: 'Integration not found' })
    return res.status(200).json({ ok: true, data: providerToPublic(row) })
  }

  if (req.method === 'PATCH') {
    const existing = await getIntegrationProviderBySlug(slug)
    if (!existing) return res.status(404).json({ ok: false, error: 'Integration not found' })

    const body = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {}
    const patch: Partial<typeof integrationProviders.$inferInsert> = { updatedAt: new Date() }

    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.status === 'string') patch.status = body.status === 'disabled' ? 'disabled' : 'active'
    if (typeof body.clientId === 'string' && body.clientId.trim()) patch.clientId = body.clientId.trim()

    const endpoints = parseBodyEndpoints(body)
    if (endpoints !== undefined) patch.endpoints = endpoints

    const appMenus = parseBodyAppMenus(body)
    if (appMenus !== undefined) patch.appMenus = appMenus

    const newSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : ''
    if (newSecret) {
      try {
        patch.clientSecretEnc = encryptSensitiveField(newSecret)
      } catch (e) {
        return res.status(503).json({
          ok: false,
          error: e instanceof Error ? e.message : 'Encryption unavailable',
        })
      }
    }

    await db.update(integrationProviders).set(patch).where(eq(integrationProviders.slug, slug))

    const updated = await getIntegrationProviderBySlug(slug)
    return res.status(200).json({ ok: true, data: updated ? providerToPublic(updated) : null })
  }

  if (req.method === 'DELETE') {
    const connections = await db
      .select({ id: orgIntegrations.id })
      .from(orgIntegrations)
      .where(eq(orgIntegrations.providerSlug, slug))
      .limit(1)
    if (connections.length > 0) {
      return res.status(409).json({
        ok: false,
        error: 'Cannot delete: organizations have connected this integration',
      })
    }
    await db.delete(integrationProviders).where(eq(integrationProviders.slug, slug))
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
