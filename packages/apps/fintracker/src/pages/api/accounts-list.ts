import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { FtSessionData } from '@fintracker-vault/auth'
import { paymentSources, getDb } from '@fintracker-vault/db'
import { dbApiErrorMessage } from '../../lib/dbApiErrorMessage'
import { getSessionOptions } from '../../lib/session'
import { cascadePaymentSourceRename, countPaymentSourceReferences, paymentSourceNameTaken } from '../../lib/paymentSourceReferences'

type ApiOk<T> = { ok: true; data: T }
type ApiErr = { ok: false; error: string }

function ok<T>(res: NextApiResponse, data: T, status = 200) {
  return res.status(status).json({ ok: true, data } satisfies ApiOk<T>)
}

function fail(res: NextApiResponse, status: number, error: string) {
  return res.status(status).json({ ok: false, error } satisfies ApiErr)
}

const USED_FOR = new Set(['savings', 'monthly', 'both'])
/** Mirrors ACCOUNT_KINDS in the app's config; the server is the authority. */
const ACCOUNT_KIND = new Set(['savings_bank', 'rd', 'fd', 'cash', 'other'])

function serializeAccount(row: typeof paymentSources.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    usedFor: row.usedFor,
    accountKind: row.accountKind ?? 'savings_bank',
    orgId: row.orgId ?? null,
    isActive: row.isActive ?? true,
    closedOn: row.closedOn ? String(row.closedOn) : null,
    sortOrder: row.sortOrder ?? 0,
    // An account is a recurring deposit exactly when it has an instalment.
    rdInstalment: row.rdInstalment != null ? Number(row.rdInstalment) : null,
    rdDay: row.rdDay ?? null,
    rdMonths: row.rdMonths ?? null,
    rdStartDate: row.rdStartDate ? String(row.rdStartDate) : null,
    rdMaturityAmount: row.rdMaturityAmount != null ? Number(row.rdMaturityAmount) : null,
  }
}

/**
 * Kind and closure date, validated together.
 *
 * A blank `closedOn` reopens the account rather than being ignored — closing is
 * reversible, and the only way to say "open again" from the form is to clear
 * the box.
 */
function readKindFields(body: Record<string, unknown>): { accountKind: string; closedOn: string | null } | null {
  const kind = body.accountKind === undefined ? 'savings_bank' : String(body.accountKind)
  if (!ACCOUNT_KIND.has(kind)) return null
  const raw = typeof body.closedOn === 'string' ? body.closedOn.trim() : ''
  return { accountKind: kind, closedOn: raw || null }
}

/** RD terms are optional and only meaningful together; a blank clears the field. */
function readRdFields(body: Record<string, unknown>) {
  const numOrNull = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const instalment = numOrNull(body.rdInstalment)
  return {
    rdInstalment: instalment != null ? String(instalment) : null,
    rdDay: instalment != null ? numOrNull(body.rdDay) : null,
    rdMonths: instalment != null ? numOrNull(body.rdMonths) : null,
    rdStartDate:
      instalment != null && typeof body.rdStartDate === 'string' && body.rdStartDate.trim()
        ? body.rdStartDate.trim()
        : null,
    rdMaturityAmount:
      instalment != null && numOrNull(body.rdMaturityAmount) != null
        ? String(numOrNull(body.rdMaturityAmount))
        : null,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
    if (!session.email) return fail(res, 401, 'Unauthorized')
    const orgId = typeof session.activeOrgId === 'string' && session.activeOrgId.trim() ? session.activeOrgId : null
    const db = getDb()

    if (req.method === 'GET') {
      const rows = await db
        .select()
        .from(paymentSources)
        .where(and(
          orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
          eq(paymentSources.sourceType, 'account')
        ))
        .orderBy(asc(paymentSources.sortOrder), asc(paymentSources.name))
      return ok(res, rows.map(serializeAccount))
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : {}
      const name = String(body.name ?? '').trim()
      if (!name) return fail(res, 400, 'Name required')
      const usedFor = String(body.usedFor ?? 'both')
      if (!USED_FOR.has(usedFor)) return fail(res, 400, 'Invalid usedFor')
      const kind = readKindFields(body)
      if (!kind) return fail(res, 400, 'Invalid accountKind')
      const description = body.description != null ? String(body.description) : null
      const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number(body.sortOrder) || 0
      if (await paymentSourceNameTaken(db, orgId, name, '')) {
        return fail(res, 409, `Another payment source is already called “${name}”. Transactions match their source by name, so two with the same name cannot be told apart.`)
      }
      const id = crypto.randomUUID()
      await db.insert(paymentSources).values({
        id,
        orgId,
        name,
        description: description || null,
        sourceType: 'account',
        usedFor,
        ...kind,
        isActive: body.isActive === false ? false : true,
        sortOrder,
        ...readRdFields(body),
      })
      return ok(res, { id })
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : {}
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return fail(res, 400, 'Missing id')
      const [prev] = await db
        .select()
        .from(paymentSources)
        .where(
          and(
            eq(paymentSources.id, id),
            orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
            eq(paymentSources.sourceType, 'account')
          ),
        )
        .limit(1)
      if (!prev) return fail(res, 404, 'Not found')
      const name = String(body.name ?? '').trim()
      if (!name) return fail(res, 400, 'Name required')
      const usedFor = String(body.usedFor ?? 'both')
      if (!USED_FOR.has(usedFor)) return fail(res, 400, 'Invalid usedFor')
      const kind = readKindFields(body)
      if (!kind) return fail(res, 400, 'Invalid accountKind')
      const description = body.description != null ? String(body.description) : null
      const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : Number(body.sortOrder) || 0
      if (await paymentSourceNameTaken(db, orgId, name, id)) {
        return fail(res, 409, `Another payment source is already called “${name}”. Transactions match their source by name, so two with the same name cannot be told apart.`)
      }
      await db
        .update(paymentSources)
        .set({
          name,
          description: description || null,
          usedFor,
          ...kind,
          isActive: body.isActive === false ? false : true,
          sortOrder,
          ...readRdFields(body),
        })
        .where(
          and(
            eq(paymentSources.id, id),
            orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
            eq(paymentSources.sourceType, 'account')
          ),
        )
      // Transactions name their source rather than pointing at its id, so the
      // rename has to be carried through or every existing row unlinks.
      const moved = await cascadePaymentSourceRename(db, orgId, prev.name, name)
      return ok(res, { id, renamedRows: moved })
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      if (!id) return fail(res, 400, 'Missing id')
      const [existing] = await db
        .select()
        .from(paymentSources)
        .where(
          and(
            eq(paymentSources.id, id),
            orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
            eq(paymentSources.sourceType, 'account')
          ),
        )
        .limit(1)
      if (!existing) return fail(res, 404, 'Not found')
      // Nothing points back at a payment source, so deleting one used to strand
      // its history silently. Refuse instead, and say what is in the way —
      // deactivating keeps the rows readable.
      const refs = await countPaymentSourceReferences(db, orgId, existing.name)
      if (refs > 0) {
        return fail(
          res,
          409,
          `“${existing.name}” is used by ${refs} ${refs === 1 ? 'entry' : 'entries'}. Mark it inactive instead, or move those entries first.`,
        )
      }
      await db
        .delete(paymentSources)
        .where(
          and(
            eq(paymentSources.id, id),
            orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
            eq(paymentSources.sourceType, 'account')
          ),
        )
      return ok(res, true)
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE')
    return fail(res, 405, 'Method not allowed')
  } catch (e) {
    console.error('[accounts-list]', e)
    return fail(res, 500, dbApiErrorMessage(e))
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '256kb' } },
}
