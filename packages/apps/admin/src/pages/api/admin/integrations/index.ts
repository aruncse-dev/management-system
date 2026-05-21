import type { NextApiRequest, NextApiResponse } from 'next'
import {
  encryptSensitiveField,
  endpointsFromRows,
  listIntegrationProviders,
  slugFromIntegrationName,
} from '@fintracker-vault/db'
import { getDb, integrationProviders } from '@fintracker-vault/db'
import { requirePlatformAdmin } from '../../../../lib/adminGuard'
import { providerToPublic } from '../../../../lib/integrationApi'

function parseBodyEndpoints(body: Record<string, unknown>): ReturnType<typeof endpointsFromRows> {
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
  return {}
}

function parseBodyAppMenus(body: Record<string, unknown>) {
  const raw = body.appMenus
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

  if (req.method === 'GET') {
    const rows = await listIntegrationProviders()
    return res.status(200).json({ ok: true, data: rows.map(providerToPublic) })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
    const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : ''
    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? body.slug.trim().toLowerCase()
        : slugFromIntegrationName(name)

    if (!name || !slug || !clientId || !clientSecret) {
      return res.status(400).json({
        ok: false,
        error: 'name, clientId, and clientSecret are required',
      })
    }
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      return res.status(400).json({ ok: false, error: 'Invalid slug derived from name' })
    }

    const status = typeof body.status === 'string' && body.status === 'disabled' ? 'disabled' : 'active'
    const endpoints = parseBodyEndpoints(body)
    const appMenus = parseBodyAppMenus(body)

    let clientSecretEnc: string
    try {
      clientSecretEnc = encryptSensitiveField(clientSecret)
    } catch (e) {
      return res.status(503).json({
        ok: false,
        error: e instanceof Error ? e.message : 'Encryption unavailable',
      })
    }

    const db = getDb()
    const now = new Date()
    try {
      await db.insert(integrationProviders).values({
        slug,
        name,
        status,
        clientId,
        clientSecretEnc,
        endpoints,
        appMenus,
        createdAt: now,
        updatedAt: now,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Insert failed'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ ok: false, error: 'Integration slug already exists' })
      }
      throw e
    }

    const rows = await listIntegrationProviders()
    const created = rows.find((r) => r.slug === slug)
    return res.status(201).json({ ok: true, data: created ? providerToPublic(created) : { slug } })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
