import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { FtSessionData } from '@fintracker-vault/auth'
import { paymentSources, getDb } from '@fintracker-vault/db'
import { dbApiErrorMessage } from '../../lib/dbApiErrorMessage'
import { getSessionOptions } from '../../lib/session'

type ApiOk<T> = { ok: true; data: T }
type ApiErr = { ok: false; error: string }

function ok<T>(res: NextApiResponse, data: T, status = 200) {
  return res.status(status).json({ ok: true, data } satisfies ApiOk<T>)
}

function fail(res: NextApiResponse, status: number, error: string) {
  return res.status(status).json({ ok: false, error } satisfies ApiErr)
}

const CATEGORY = new Set(['credit_card', 'informal'])

async function ensureDefaultCreditSources(db: ReturnType<typeof getDb>, orgId: string | null) {
  const existing = await db
    .select({ id: paymentSources.id })
    .from(paymentSources)
    .where(and(
      orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
      inArray(paymentSources.sourceType, ['credit_card', 'informal'])
    ))
    .limit(1)
  if (existing.length > 0) return

  const defaults = [
    { name: 'ICICI', sourceType: 'credit_card' as const, sortOrder: 0 },
    { name: 'HDFC', sourceType: 'credit_card' as const, sortOrder: 1 },
    { name: 'Bommi', sourceType: 'informal' as const, sortOrder: 2 },
    { name: 'Ramya', sourceType: 'informal' as const, sortOrder: 3 },
    { name: 'Others', sourceType: 'informal' as const, sortOrder: 4 },
  ]
  for (const row of defaults) {
    await db.insert(paymentSources).values({
      id: crypto.randomUUID(),
      orgId,
      name: row.name,
      description: null,
      sourceType: row.sourceType,
      usedFor: 'both',
      isActive: true,
      sortOrder: row.sortOrder,
    })
  }
}

function serialize(row: typeof paymentSources.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    category: row.sourceType,
    orgId: row.orgId ?? null,
    isActive: row.isActive ?? true,
    sortOrder: row.sortOrder ?? 0,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) return fail(res, 401, 'Unauthorized')
  const email = session.email.toLowerCase()
  const orgId = typeof session.activeOrgId === 'string' && session.activeOrgId.trim() ? session.activeOrgId : null
  const db = getDb()

  if (req.method === 'GET') {
    await ensureDefaultCreditSources(db, orgId)
    const rows = await db
      .select()
      .from(paymentSources)
      .where(and(
        orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
        inArray(paymentSources.sourceType, ['credit_card', 'informal'])
      ))
      .orderBy(asc(paymentSources.sortOrder), asc(paymentSources.name))
    return ok(res, rows.map(serialize))
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : {}
    const name = String(body.name ?? '').trim()
    if (!name) return fail(res, 400, 'Name required')
    const sourceType = String(body.category ?? '')
    if (!CATEGORY.has(sourceType)) return fail(res, 400, 'Invalid category')
    const description = body.description != null ? String(body.description) : null
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number(body.sortOrder) || 0
    const id = crypto.randomUUID()
    await db.insert(paymentSources).values({
      id,
      orgId,
      name,
      description: description || null,
      sourceType,
      usedFor: 'both',
      isActive: body.isActive === false ? false : true,
      sortOrder,
    })
    return ok(res, { id })
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : {}
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return fail(res, 400, 'Missing id')
    const name = String(body.name ?? '').trim()
    if (!name) return fail(res, 400, 'Name required')
    const sourceType = String(body.category ?? '')
    if (!CATEGORY.has(sourceType)) return fail(res, 400, 'Invalid category')
    const description = body.description != null ? String(body.description) : null
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number(body.sortOrder) || 0
    await db
      .update(paymentSources)
      .set({
        name,
        description: description || null,
        sourceType,
        isActive: body.isActive === false ? false : true,
        sortOrder,
      })
      .where(
        and(
          eq(paymentSources.id, id),
          orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
          inArray(paymentSources.sourceType, ['credit_card', 'informal'])
        ),
      )
    return ok(res, { id })
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id) return fail(res, 400, 'Missing id')
    await db
      .delete(paymentSources)
      .where(
        and(
          eq(paymentSources.id, id),
          orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
          inArray(paymentSources.sourceType, ['credit_card', 'informal'])
        ),
      )
    return ok(res, true)
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE')
  return fail(res, 405, 'Method not allowed')
  } catch (e) {
    console.error('[credit-sources]', e)
    return fail(res, 500, dbApiErrorMessage(e))
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '256kb' } },
}
