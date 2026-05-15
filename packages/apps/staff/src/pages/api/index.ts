import type { NextApiRequest, NextApiResponse } from 'next'
import { and, asc, desc, eq } from 'drizzle-orm'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getDb, attendance, organizations, staffMembers } from '@fintracker-vault/db'
import { getSessionOptions } from '../../lib/session'

function ok(res: NextApiResponse, data: unknown, traceId?: string) {
  return res.status(200).json({ ok: true, data, ...(traceId && { traceId }) })
}

function fail(res: NextApiResponse, statusCode: number, error: string, traceId?: string) {
  return res.status(statusCode).json({ ok: false, error, ...(traceId && { traceId }) })
}

function generateTraceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function padMonth(m: string) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const idx = monthNames.indexOf(m)
  if (idx >= 0) return String(idx + 1).padStart(2, '0')
  const num = parseInt(m, 10)
  if (Number.isNaN(num) || num < 1 || num > 12) return null
  return String(num).padStart(2, '0')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const traceId = generateTraceId()

  try {
    const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
    if (!session.email) {
      return fail(res, 401, 'Unauthorized', traceId)
    }

    const orgId = session.activeOrgId?.trim()
    if (!orgId) {
      return fail(res, 400, 'No active org', traceId)
    }

    const db = getDb()
    const action = req.method === 'GET' ? String(req.query.action ?? '') : String(req.body?.action ?? '')
    const method = req.method

    // GET handlers
    if (method === 'GET') {
      if (action === 'listStaff') {
        const rows = await db
          .select({
            id: staffMembers.id,
            name: staffMembers.name,
            active: staffMembers.status,
            gender: staffMembers.gender,
            salaryType: staffMembers.salaryType,
            salaryAmount: staffMembers.salaryAmount,
          })
          .from(staffMembers)
          .where(eq(staffMembers.orgId, orgId))
          .orderBy(asc(staffMembers.name))

        const mapped = rows.map(r => ({
          id: r.id,
          name: r.name,
          active: r.active === 'active',
          gender: r.gender,
          salaryType: (r.salaryType as 'daily' | 'monthly') ?? 'daily',
          salaryAmount: r.salaryAmount ? parseFloat(r.salaryAmount) : 0,
        }))

        return ok(res, mapped, traceId)
      }

      if (action === 'getAttendance') {
        const month = String(req.query.month ?? '').trim()
        const year = String(req.query.year ?? '').trim()
        if (!month || !year) {
          return fail(res, 400, 'Missing month or year', traceId)
        }

        const monthPad = padMonth(month)
        if (!monthPad) {
          return fail(res, 400, 'Invalid month', traceId)
        }

        const monthYear = `${year}-${monthPad}`
        const rows = await db
          .select()
          .from(attendance)
          .where(and(eq(attendance.orgId, orgId), eq(attendance.monthYear, monthYear)))
          .orderBy(asc(attendance.day), asc(attendance.staffId))

        const mapped = rows.map(r => {
          const worked = r.status === 'worked' || r.status === 'overtime'
          const overtime = r.status === 'overtime'
          const dateStr = `${monthYear}-${String(r.day).padStart(2, '0')}`
          return {
            entryId: r.id,
            date: dateStr,
            staffId: r.staffId,
            worked,
            overtime,
            notes: r.notes,
          }
        })

        return ok(res, mapped, traceId)
      }

      if (action === 'getMonths') {
        const rows = await db
          .select({ monthYear: attendance.monthYear })
          .from(attendance)
          .where(eq(attendance.orgId, orgId))
          .orderBy(desc(attendance.monthYear))

        const seen = new Set<string>()
        const months = []
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

        for (const r of rows) {
          if (seen.has(r.monthYear)) continue
          seen.add(r.monthYear)
          const [y, m] = r.monthYear.split('-')
          const monthNum = parseInt(m, 10)
          months.push({ month: monthNames[monthNum - 1] || m, year: y })
        }

        return ok(res, months, traceId)
      }
    }

    // POST handlers
    if (method === 'POST') {
      const body = typeof req.body === 'object' && req.body !== null ? req.body : {}

      if (action === 'addStaff') {
        const name = String(body.name ?? '').trim()
        if (!name) {
          return fail(res, 400, 'Missing name', traceId)
        }

        const id = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        await db.insert(staffMembers).values({
          id,
          orgId,
          name,
          gender: body.gender ? String(body.gender) : null,
          salaryType: body.salaryType ? String(body.salaryType) : null,
          salaryAmount: body.salaryAmount ? String(body.salaryAmount) : null,
          status: 'active',
        })

        return ok(
          res,
          {
            id,
            name,
            active: true,
            gender: body.gender,
            salaryType: body.salaryType ?? 'daily',
            salaryAmount: body.salaryAmount ?? 0,
          },
          traceId,
        )
      }

      if (action === 'updateStaff') {
        const id = String(body.id ?? '').trim()
        const name = String(body.name ?? '').trim()
        if (!id || !name) {
          return fail(res, 400, 'Missing id or name', traceId)
        }

        await db
          .update(staffMembers)
          .set({
            name,
            gender: body.gender ? String(body.gender) : null,
            salaryType: body.salaryType ? String(body.salaryType) : null,
            salaryAmount: body.salaryAmount ? String(body.salaryAmount) : null,
            status: body.active === false ? 'inactive' : 'active',
          })
          .where(and(eq(staffMembers.id, id), eq(staffMembers.orgId, orgId)))

        return ok(
          res,
          {
            id,
            name,
            active: body.active !== false,
            gender: body.gender,
            salaryType: body.salaryType ?? 'daily',
            salaryAmount: body.salaryAmount ?? 0,
          },
          traceId,
        )
      }

      if (action === 'setAttendance') {
        const month = String(body.month ?? '').trim()
        const year = String(body.year ?? '').trim()
        const date = String(body.date ?? '').trim()
        const staffId = String(body.staffId ?? '').trim()
        const worked = Boolean(body.worked)
        const overtime = Boolean(body.overtime)
        const notes = body.notes ? String(body.notes).trim() : null

        if (!month || !year || !date || !staffId) {
          return fail(res, 400, 'Missing required fields', traceId)
        }

        const monthPad = padMonth(month)
        if (!monthPad) {
          return fail(res, 400, 'Invalid month', traceId)
        }

        const monthYear = `${year}-${monthPad}`
        const dayMatch = date.match(/\d{4}-\d{2}-(\d{2})/)
        const day = dayMatch ? parseInt(dayMatch[1], 10) : null
        if (!day || Number.isNaN(day)) {
          return fail(res, 400, 'Invalid date format', traceId)
        }

        if (!worked) {
          await db
            .delete(attendance)
            .where(
              and(
                eq(attendance.orgId, orgId),
                eq(attendance.staffId, staffId),
                eq(attendance.monthYear, monthYear),
                eq(attendance.day, day),
              ),
            )
          return ok(
            res,
            {
              entryId: '',
              date,
              staffId,
              worked: false,
              overtime: false,
            },
            traceId,
          )
        }

        const status = overtime ? 'overtime' : 'worked'
        const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        await db
          .insert(attendance)
          .values({
            id,
            orgId,
            staffId,
            monthYear,
            day,
            status,
            notes,
          })
          .onConflictDoNothing()

        return ok(
          res,
          {
            entryId: id,
            date,
            staffId,
            worked: true,
            overtime,
            notes,
          },
          traceId,
        )
      }

      if (action === 'ensureMonth') {
        return ok(res, true, traceId)
      }
    }

    res.setHeader('Allow', 'GET, POST')
    return fail(res, 400, `Unknown action: ${action}`, traceId)
  } catch (e) {
    console.error('[staff /api]', e)
    return fail(res, 500, e instanceof Error ? e.message : 'Server error')
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
}
