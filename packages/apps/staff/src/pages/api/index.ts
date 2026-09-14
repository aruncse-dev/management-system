import type { NextApiRequest, NextApiResponse } from 'next'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { getDb, attendance, staffMembers } from '@fintracker-vault/db'
import { getSessionOptions } from '../../lib/session'
import { computeMonthPay } from '../../lib/payroll'
import type { SalaryBasis, WeeklyOff } from '../../types'

function ok(res: NextApiResponse, data: unknown, traceId?: string) {
  return res.status(200).json({ ok: true, data, ...(traceId && { traceId }) })
}

function fail(res: NextApiResponse, statusCode: number, error: string, traceId?: string) {
  return res.status(statusCode).json({ ok: false, error, ...(traceId && { traceId }) })
}

function generateTraceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 4)}`
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function padMonth(m: string) {
  const idx = MONTH_NAMES.indexOf(m)
  if (idx >= 0) return String(idx + 1).padStart(2, '0')
  const num = parseInt(m, 10)
  if (Number.isNaN(num) || num < 1 || num > 12) return null
  return String(num).padStart(2, '0')
}

/** Accepts 'YYYY-MM' only; returns null for anything else so it can never widen a WHERE clause. */
function normalizeMonthYear(v: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null
}

function toSalaryBasis(v: string | null | undefined): SalaryBasis {
  return v === 'monthly' ? 'monthly' : 'daily'
}

function toWeeklyOff(v: string | null | undefined): WeeklyOff {
  return v === 'sunday' || v === 'sat_sun' ? v : 'none'
}

function toLeaveCount(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(31, Math.floor(n))
}


function toAmount(v: string | null): number {
  if (!v) return 0
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
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
            weeklyOff: staffMembers.weeklyOff,
            paidLeavesPerMonth: staffMembers.paidLeavesPerMonth,
          })
          .from(staffMembers)
          .where(eq(staffMembers.orgId, orgId))
          .orderBy(asc(staffMembers.name))

        const mapped = rows.map(r => ({
          id: r.id,
          name: r.name,
          active: r.active === 'active',
          gender: r.gender,
          salaryType: toSalaryBasis(r.salaryType),
          salaryAmount: toAmount(r.salaryAmount),
          weeklyOff: toWeeklyOff(r.weeklyOff),
          paidLeavesPerMonth: r.paidLeavesPerMonth ?? 0,
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
          .selectDistinct({ monthYear: attendance.monthYear })
          .from(attendance)
          .where(eq(attendance.orgId, orgId))
          .orderBy(desc(attendance.monthYear))

        const months = rows.map(r => {
          const [y, m] = r.monthYear.split('-')
          return { month: MONTH_NAMES[parseInt(m, 10) - 1] || m, year: y }
        })

        return ok(res, months, traceId)
      }

      /**
       * Month-wise totals per staff member. Returns every month that has
       * attendance unless narrowed by `from`/`to` ('YYYY-MM', inclusive).
       *
       * Day counts are DISTINCT so a stray duplicate row cannot inflate them,
       * and the pay estimate uses the month's rate snapshot where one exists,
       * falling back to the staff member's current rate otherwise.
       */
      if (action === 'getHistory') {
        const fromRaw = String(req.query.from ?? '').trim()
        const toRaw = String(req.query.to ?? '').trim()
        const from = fromRaw ? normalizeMonthYear(fromRaw) : null
        const to = toRaw ? normalizeMonthYear(toRaw) : null
        if ((fromRaw && !from) || (toRaw && !to)) {
          return fail(res, 400, 'Invalid from/to — expected YYYY-MM', traceId)
        }

        const rangeFilter = [
          eq(attendance.orgId, orgId),
          ...(from ? [gte(attendance.monthYear, from)] : []),
          ...(to ? [lte(attendance.monthYear, to)] : []),
        ]

        const [totals, staffRows] = await Promise.all([
          db
            .select({
              monthYear: attendance.monthYear,
              staffId: attendance.staffId,
              workedDays: sql<number>`count(distinct ${attendance.day})::int`,
              otDays: sql<number>`count(distinct ${attendance.day}) filter (where ${attendance.status} = 'overtime')::int`,
            })
            .from(attendance)
            .where(and(...rangeFilter))
            .groupBy(attendance.monthYear, attendance.staffId),
          db
            .select({
              id: staffMembers.id,
              name: staffMembers.name,
              status: staffMembers.status,
              salaryType: staffMembers.salaryType,
              salaryAmount: staffMembers.salaryAmount,
              weeklyOff: staffMembers.weeklyOff,
              paidLeavesPerMonth: staffMembers.paidLeavesPerMonth,
            })
            .from(staffMembers)
            .where(eq(staffMembers.orgId, orgId)),
        ])

        const staffById = new Map(staffRows.map(s => [s.id, s]))

        const mapped = totals.map(t => {
          const staff = staffById.get(t.staffId)

          // Costed live off the staff record: change someone's rate or policy and
          // every month recomputes. These are estimates, not settled payslips.
          const salaryType = toSalaryBasis(staff?.salaryType)
          const salaryAmount = toAmount(staff?.salaryAmount ?? null)
          const weeklyOff = toWeeklyOff(staff?.weeklyOff)
          const paidLeaves = staff?.paidLeavesPerMonth ?? 0

          const workedDays = Number(t.workedDays) || 0
          const otDays = Number(t.otDays) || 0
          const pay = computeMonthPay({
            monthYear: t.monthYear,
            salaryType,
            salaryAmount,
            weeklyOff,
            paidLeaves,
            workedDays,
          })

          return {
            monthYear: t.monthYear,
            staffId: t.staffId,
            // A staff row deleted straight from the DB would orphan its attendance;
            // show the id rather than dropping the month's totals on the floor.
            staffName: staff?.name ?? t.staffId,
            staffActive: staff ? staff.status === 'active' : false,
            otDays,
            salaryType,
            salaryAmount,
            weeklyOff,
            paidLeaves,
            ...pay,
          }
        })

        mapped.sort((a, b) => b.monthYear.localeCompare(a.monthYear) || a.staffName.localeCompare(b.staffName))

        return ok(res, mapped, traceId)
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
          weeklyOff: toWeeklyOff(body.weeklyOff),
          paidLeavesPerMonth: toLeaveCount(body.paidLeavesPerMonth),
          status: 'active',
        })

        return ok(
          res,
          {
            id,
            name,
            active: true,
            gender: body.gender,
            salaryType: toSalaryBasis(body.salaryType),
            salaryAmount: toAmount(body.salaryAmount ? String(body.salaryAmount) : null),
            weeklyOff: toWeeklyOff(body.weeklyOff),
            paidLeavesPerMonth: toLeaveCount(body.paidLeavesPerMonth),
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

        // Only touch `status` when the caller actually sent `active`. Previously an
        // edit that omitted it forced 'active', silently reactivating the person.
        const activeChanged = typeof body.active === 'boolean'
        const salaryType = toSalaryBasis(body.salaryType)
        const salaryAmount = toAmount(body.salaryAmount ? String(body.salaryAmount) : null)
        const weeklyOff = toWeeklyOff(body.weeklyOff)
        const paidLeaves = toLeaveCount(body.paidLeavesPerMonth)

        const updated = await db
          .update(staffMembers)
          .set({
            name,
            gender: body.gender ? String(body.gender) : null,
            salaryType,
            salaryAmount: String(salaryAmount),
            weeklyOff,
            paidLeavesPerMonth: paidLeaves,
            ...(activeChanged && { status: body.active ? 'active' : 'inactive' }),
          })
          .where(and(eq(staffMembers.id, id), eq(staffMembers.orgId, orgId)))
          .returning({ id: staffMembers.id, status: staffMembers.status })

        if (!updated.length) {
          return fail(res, 404, 'Unknown staff member', traceId)
        }

        return ok(
          res,
          {
            id,
            name,
            active: updated[0].status === 'active',
            gender: body.gender,
            salaryType,
            salaryAmount,
            weeklyOff,
            paidLeavesPerMonth: paidLeaves,
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

        // Confirm the staff member is ours before writing anything against them,
        // and reuse the row to snapshot the rate this month is being worked at.
        const staffRow = await db
          .select({
            status: staffMembers.status,
            salaryType: staffMembers.salaryType,
            salaryAmount: staffMembers.salaryAmount,
            weeklyOff: staffMembers.weeklyOff,
            paidLeavesPerMonth: staffMembers.paidLeavesPerMonth,
          })
          .from(staffMembers)
          .where(and(eq(staffMembers.id, staffId), eq(staffMembers.orgId, orgId)))
          .limit(1)

        if (!staffRow.length) {
          return fail(res, 404, 'Unknown staff member', traceId)
        }
        if (staffRow[0].status !== 'active') {
          return fail(res, 400, 'Staff member is inactive', traceId)
        }

        const status = overtime ? 'overtime' : 'worked'
        const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        await db
          .insert(attendance)
          .values({ id, orgId, staffId, monthYear, day, status, notes })
          .onConflictDoUpdate({
            target: [attendance.orgId, attendance.staffId, attendance.monthYear, attendance.day],
            set: { status, notes },
          })

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
    console.error('[staff /api]', traceId, e)
    return fail(res, 500, e instanceof Error ? e.message : 'Server error', traceId)
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
}
