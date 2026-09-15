import crypto from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { FtSessionData } from '@fintracker-vault/auth'
import {
  getDb,
  insurance,
  insurancePremiums,
  insuranceMembers,
  getInsurancePolicies,
  getInsurancePremiums,
  clearTransactionRefs,
  transactionIdFromMirrorId,
  unlinkTransactionMirror,
  getBankingRecords,
  getBankingRecord,
  addBankingRecord,
  updateBankingRecord,
  deleteBankingRecord,
  getVaultApps,
  getVaultApp,
  addVaultApp,
  updateVaultApp,
  deleteVaultApp,
  getPersons,
  getPerson,
  addPerson,
  updatePerson,
  deletePerson,
  getDocuments,
  addDocument,
  updateDocument,
  deleteDocument,
  getHealthVitals,
  addHealthVital,
  deleteHealthVital,
  getIllnesses,
  addIllness,
  updateIllness,
  deleteIllness,
  getMedications,
  addMedication,
  updateMedication,
  deleteMedication,
  getHabits,
  addHabit,
  updateHabit,
  deleteHabit,
  getHabitLogs,
  addHabitLog,
  decryptSensitiveField,
  isEncryptedSensitiveField,
} from '@fintracker-vault/db'
import { POLICY_TYPES, PREMIUM_MODES, parsePolicyType, parsePremiumMode } from '@fintracker-vault/utils'

/**
 * `transactions.ref_kind` value for a premium.
 *
 * Duplicated deliberately: fintracker writes this value, vault clears it, and a
 * shared constant would drag the register's vocabulary into the records app for
 * one string. If a third writer appears, promote it to `@fintracker-vault/db`.
 */
const INSURANCE_REF_KIND = 'insurance'

/** Policy lifecycle. Mirrors `subscriptions.status`; see the schema comment. */
const INSURANCE_STATUSES = ['active', 'lapsed', 'paid_up', 'matured'] as const

/**
 * Refusal text for editing a row the register owns.
 *
 * Amount and date on a mirrored premium come from its transaction, so an edit
 * made here is overwritten the next time that transaction is saved. Deleting is
 * allowed — that unlinks the pair — but editing in place is not.
 *
 * Worded identically to fintracker's copy, pointing at the app that owns the
 * money rather than the one showing the row.
 */
const MIRROR_READONLY_MESSAGE =
  'This premium was created from a transaction. Edit it in FinTracker → Monthly → Transactions, or delete it here to unlink the two.'


/**
 * Replace a policy's covered people with exactly this list.
 *
 * The form sends the whole set, so a diff would be more code for the same
 * result. Delete-then-insert inside one request keeps "who is covered" a single
 * fact rather than a sequence of add/remove calls that can half-apply.
 */
async function setInsuranceMembers(
  db: Awaited<ReturnType<typeof getDb>>,
  orgId: string,
  policyId: string,
  insured: unknown,
  nominees: unknown,
): Promise<void> {
  // Neither list sent means the caller is not editing people at all — leave
  // them alone rather than silently clearing the policy's members.
  if (!Array.isArray(insured) && !Array.isArray(nominees)) return

  const clean = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.map((u) => String(u ?? '').trim()).filter(Boolean))] : []

  const rows = [
    ...clean(insured).map((personUuid) => ({ personUuid, role: 'insured' })),
    ...clean(nominees).map((personUuid) => ({ personUuid, role: 'nominee' })),
  ]

  await db
    .delete(insuranceMembers)
    .where(and(whereOrgFilter(insuranceMembers, orgId), eq(insuranceMembers.policyId, policyId)))
  if (!rows.length) return
  await db.insert(insuranceMembers).values(
    rows.map((r) => ({ id: crypto.randomUUID(), orgId, policyId, ...r })),
  )
}

/** Strict parse: an unknown status is rejected rather than stored. */
function normalizeInsuranceStatus(raw: unknown): string | null {
  const v = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!v) return null
  return (INSURANCE_STATUSES as readonly string[]).includes(v) ? v : null
}

/** Non-negative integer, or null when the value is absent or unusable. */
function parseOpeningCount(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

function ok(res: NextApiResponse, data?: unknown, traceId = '') {
  return res.status(200).json({ ok: true as const, data, ...(traceId ? { traceId } : {}) })
}

function fail(res: NextApiResponse, code: number, error: string, traceId = '') {
  return res.status(code).json({ ok: false as const, error, ...(traceId ? { traceId } : {}) })
}

function num(v: string | number): number {
  if (typeof v === 'number') return v
  const parsed = parseFloat(v)
  return isNaN(parsed) ? 0 : parsed
}

function whereOrgFilter(table: any, orgId: string) {
  return eq(table.orgId, orgId)
}

function safeDecrypt(stored: string | null | undefined): string {
  if (!stored) return ''
  try {
    return decryptSensitiveField(stored)
  } catch (e) {
    if (isEncryptedSensitiveField(stored)) {
      console.error('Decryption failed:', e instanceof Error ? e.message : String(e))
      return '••••••••'
    }
    // Legacy plaintext stored before field encryption was enabled
    return stored
  }
}

export async function handleVaultApi(
  req: NextApiRequest,
  res: NextApiResponse,
  session: FtSessionData,
  traceId: string,
) {
  const db = await getDb()
  const scopeOrgId = session.activeOrgId || ''
  const mod = String(req.query.module || req.body?.module || '')
  const action = String(req.query.action || req.body?.action || '')
  const body = req.body || {}

  // ============ GET handlers (read-only) ============

  if (req.method === 'GET') {
    // Vault/Banking reads
    if (mod === 'vault' && action === 'getEntries') {
      const rows = await getBankingRecords(scopeOrgId)
      return ok(
        res,
        rows.map((r) => ({
          id: r.id,
          account_holder_name: r.holderName ?? '',
          bank_name: r.bankName,
          app_uuid: r.appUuid ?? undefined,
          account_no: safeDecrypt(r.accountNoEnc),
          ifsc: r.ifsc ?? '',
          cif: safeDecrypt(r.cifEnc),
          username: safeDecrypt(r.usernameEnc),
          password: safeDecrypt(r.passwordEnc),
          transaction_password: safeDecrypt(r.transactionPasswordEnc),
          profile_password: safeDecrypt(r.profilePasswordEnc),
          mpin: safeDecrypt(r.mpinEnc),
          updated_at: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        })),
        traceId,
      )
    }

    if (mod === 'vault' && action === 'getEntry') {
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      if (!id) return fail(res, 400, 'Missing id', traceId)
      const r = await getBankingRecord(scopeOrgId, id)
      if (!r) return fail(res, 404, 'Not found', traceId)
      return ok(
        res,
        {
          id: r.id,
          account_holder_name: r.holderName ?? '',
          bank_name: r.bankName,
          app_uuid: r.appUuid ?? undefined,
          account_no: safeDecrypt(r.accountNoEnc),
          ifsc: r.ifsc ?? '',
          cif: safeDecrypt(r.cifEnc),
          username: safeDecrypt(r.usernameEnc),
          password: safeDecrypt(r.passwordEnc),
          transaction_password: safeDecrypt(r.transactionPasswordEnc),
          profile_password: safeDecrypt(r.profilePasswordEnc),
          mpin: safeDecrypt(r.mpinEnc),
          updated_at: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        },
        traceId,
      )
    }

    // Vault Apps reads
    if (mod === 'vault' && action === 'getApps') {
      const rows = await getVaultApps(scopeOrgId)
      return ok(
        res,
        rows.map((r) => ({
          app_uuid: r.id,
          app_name: r.appName,
          category: r.category ?? '',
          logo: r.logo ?? '',
          app_link: r.appLink ?? '',
          username: safeDecrypt(r.usernameEnc),
          password: safeDecrypt(r.passwordEnc),
          two_factor_enabled: Boolean(r.twoFactor),
          notes: r.notes ?? '',
          updated_at: r.updatedAt.toISOString(),
        })),
        traceId,
      )
    }

    if (mod === 'vault' && action === 'getApp') {
      const app_uuid = typeof req.query.app_uuid === 'string' ? req.query.app_uuid : ''
      if (!app_uuid) return fail(res, 400, 'Missing app_uuid', traceId)
      const r = await getVaultApp(scopeOrgId, app_uuid)
      if (!r) return fail(res, 404, 'Not found', traceId)
      return ok(
        res,
        {
          app_uuid: r.id,
          app_name: r.appName,
          category: r.category ?? '',
          logo: r.logo ?? '',
          app_link: r.appLink ?? '',
          username: safeDecrypt(r.usernameEnc),
          password: safeDecrypt(r.passwordEnc),
          two_factor_enabled: Boolean(r.twoFactor),
          notes: r.notes ?? '',
          updated_at: r.updatedAt.toISOString(),
        },
        traceId,
      )
    }

    // Insurance reads
    //
    // Reads go through `getInsurancePolicies` rather than a raw select so that
    // vault and fintracker derive the due date, the paid count and the monthly
    // cost from one implementation. Two copies of that math is how the
    // subscription cycle drifted into disagreeing screens.
    if (mod === 'insurance' && action === 'getEntries') {
      const rows = await getInsurancePolicies(db, scopeOrgId)
      return ok(
        res,
        rows.map((r) => ({
          id: r.id,
          policy_type: r.policyType,
          plan_name: r.planName,
          insurer: r.insurer,
          app_uuid: r.appId || undefined,
          policy_number: r.policyNo,
          policy_owner: r.owner,
          premium_amount: r.premium ? String(r.premium) : '',
          premium_mode: r.premiumModeRaw,
          premium_mode_label: r.premiumModeLabel,
          payment_method: r.paymentMethod,
          // Display-only, derived from issue/maturity. Never stored — the column
          // does not exist, and the form has never sent one.
          policy_term: '',
          status: r.status,
          issue_date: r.issueDate ?? '',
          maturity_date: r.maturityDate ?? '',
          sum_assured: r.sumAssured ? String(r.sumAssured) : '',
          cash_value: r.cashValue ? String(r.cashValue) : '',
          nominee_name: r.nominee,
          notes: r.notes,
          updated_at: r.updatedAt ?? undefined,
          person_uuid: r.personUuid || undefined,
          member_uuids: r.memberUuids,
          nominee_uuids: r.nomineeUuids,
          premium_payment_term_years: r.premiumPaymentTermYears,
          renews: r.renews,
          ecard_url: r.ecardUrl,
          premiums_total: r.premiumsTotal,
          premiums_remaining: r.premiumsRemaining,
          premiums_progress: r.premiumsProgress,
          last_payable_on: r.lastPayableOn ?? '',
          paid_premiums_opening: r.paidPremiumsOpening,
          paid_count: r.paidCount,
          paid_total: r.paidTotal,
          last_paid_on: r.lastPaidOn ?? '',
          next_due: r.nextDue ?? '',
          days_until_due: r.daysUntilDue,
          monthly_cost: r.monthlyCost,
        })),
        traceId,
      )
    }

    // Premium ledger. Amounts come back as numbers, not the raw numeric strings
    // the driver hands over, so the client never has to parse money.
    if (mod === 'insurance' && action === 'getPremiums') {
      const policyId = typeof req.query.policy_id === 'string' ? req.query.policy_id : undefined
      const rows = await getInsurancePremiums(db, scopeOrgId, policyId)
      return ok(
        res,
        rows.map((r) => ({
          id: r.id,
          policy_id: r.policyId,
          date: r.date,
          amount: r.amount,
          note: r.note,
          // Mirrored rows are owned by the register and read-only here.
          mirrored: transactionIdFromMirrorId(r.id) !== null,
        })),
        traceId,
      )
    }

    // Persons reads
    if (mod === 'persons' && action === 'getEntries') {
      const rows = await getPersons(scopeOrgId)
      return ok(
        res,
        rows.map((r) => ({
          person_uuid: r.uuid,
          name: r.name,
          relation: r.relation ?? '',
          dob: r.dob ? String(r.dob) : '',
          gender: r.gender ?? '',
          notes: r.notes ?? '',
          created_at: r.createdAt ? r.createdAt.toISOString() : undefined,
          updated_at: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        })),
        traceId,
      )
    }

    if (mod === 'persons' && action === 'getEntry') {
      const person_uuid = typeof req.query.person_uuid === 'string' ? req.query.person_uuid : ''
      if (!person_uuid) return fail(res, 400, 'Missing person_uuid', traceId)
      const r = await getPerson(scopeOrgId, person_uuid)
      if (!r) return fail(res, 404, 'Not found', traceId)
      return ok(
        res,
        {
          person_uuid: r.uuid,
          name: r.name,
          relation: r.relation ?? '',
          dob: r.dob ? String(r.dob) : '',
          gender: r.gender ?? '',
          notes: r.notes ?? '',
          created_at: r.createdAt ? r.createdAt.toISOString() : undefined,
          updated_at: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        },
        traceId,
      )
    }

    // Documents reads
    if (mod === 'documents' && action === 'getEntries') {
      const person_uuid = typeof req.query.person_uuid === 'string' ? req.query.person_uuid : undefined
      const rows = await getDocuments(scopeOrgId, person_uuid)
      return ok(
        res,
        rows.map((r) => ({
          doc_uuid: r.docUuid,
          person_uuid: r.personUuid,
          doc_type: r.docType,
          doc_number: r.docNumber ?? '',
          drive_url: r.driveUrl ?? '',
          expiry: r.expiry ? String(r.expiry) : '',
          notes: r.notes ?? '',
          created_at: r.createdAt ? r.createdAt.toISOString() : undefined,
        })),
        traceId,
      )
    }

    // Health Vitals reads
    if (mod === 'health' && action === 'getVitals') {
      const person_uuid = typeof req.query.person_uuid === 'string' ? req.query.person_uuid : undefined
      const rows = await getHealthVitals(scopeOrgId, person_uuid)
      return ok(
        res,
        rows.map((r) => ({
          vital_uuid: r.vitalUuid,
          person_uuid: r.personUuid,
          recorded_at: r.recordedAt ? r.recordedAt.toISOString() : '',
          height_cm: num(r.heightCm || 0),
          weight_kg: num(r.weightKg || 0),
          systolic: num(r.systolic || 0),
          diastolic: num(r.diastolic || 0),
          blood_sugar: num(r.bloodSugar || 0),
          notes: r.notes ?? '',
        })),
        traceId,
      )
    }

    // Illnesses reads
    if (mod === 'health' && action === 'getIllnesses') {
      const person_uuid = typeof req.query.person_uuid === 'string' ? req.query.person_uuid : undefined
      const rows = await getIllnesses(scopeOrgId, person_uuid)
      return ok(
        res,
        rows.map((r) => ({
          illness_uuid: r.illnessUuid,
          person_uuid: r.personUuid,
          name: r.name,
          diagnosed_on: r.diagnosedOn ? String(r.diagnosedOn) : '',
          status: r.status ?? '',
          notes: r.notes ?? '',
        })),
        traceId,
      )
    }

    // Medications reads
    if (mod === 'health' && action === 'getMedications') {
      const person_uuid = typeof req.query.person_uuid === 'string' ? req.query.person_uuid : undefined
      const rows = await getMedications(scopeOrgId, person_uuid)
      return ok(
        res,
        rows.map((r) => ({
          med_uuid: r.medUuid,
          person_uuid: r.personUuid,
          illness_uuid: r.illnessUuid ?? '',
          name: r.name,
          dosage: r.dosage ?? '',
          frequency: r.frequency ?? '',
          start_date: r.startDate ? String(r.startDate) : '',
          end_date: r.endDate ? String(r.endDate) : '',
          reminder_times: r.reminderTimes ?? '',
          notes: r.notes ?? '',
        })),
        traceId,
      )
    }

    // Habits reads
    if (mod === 'habits' && action === 'getHabits') {
      const person_uuid = typeof req.query.person_uuid === 'string' ? req.query.person_uuid : undefined
      const rows = await getHabits(scopeOrgId, person_uuid)
      return ok(
        res,
        rows.map((r) => ({
          habit_uuid: r.habitUuid,
          person_uuid: r.personUuid,
          name: r.name,
          category: r.category ?? '',
          target_frequency: r.targetFrequency ?? '',
          created_at: r.createdAt ? r.createdAt.toISOString() : undefined,
        })),
        traceId,
      )
    }

    // Habit Logs reads
    if (mod === 'habits' && action === 'getHabitLogs') {
      const habit_uuid = typeof req.query.habit_uuid === 'string' ? req.query.habit_uuid : undefined
      const person_uuid = typeof req.query.person_uuid === 'string' ? req.query.person_uuid : undefined
      const rows = await getHabitLogs(scopeOrgId, { habitUuid: habit_uuid, personUuid: person_uuid })
      return ok(
        res,
        rows.map((r) => ({
          log_uuid: r.logUuid,
          habit_uuid: r.habitUuid,
          person_uuid: r.personUuid,
          log_date: r.logDate ? String(r.logDate) : '',
          completed: r.completed,
        })),
        traceId,
      )
    }
  }

  // ============ POST handlers (mutations) ============

  if (req.method === 'POST') {
    // Banking mutations
    if (mod === 'vault') {
      if (action === 'addEntry') {
        const id = crypto.randomUUID()
        await addBankingRecord(scopeOrgId, {
          id,
          holderName: typeof body.account_holder_name === 'string' ? body.account_holder_name : undefined,
          bankName: String(body.bank_name ?? ''),
          accountNoEnc: typeof body.account_no === 'string' ? body.account_no : undefined,
          ifsc: typeof body.ifsc === 'string' ? body.ifsc : undefined,
          cifEnc: typeof body.cif === 'string' ? body.cif : undefined,
          usernameEnc: typeof body.username === 'string' ? body.username : undefined,
          passwordEnc: typeof body.password === 'string' ? body.password : undefined,
          transactionPasswordEnc: typeof body.transaction_password === 'string' ? body.transaction_password : undefined,
          profilePasswordEnc: typeof body.profile_password === 'string' ? body.profile_password : undefined,
          mpinEnc: typeof body.mpin === 'string' ? body.mpin : undefined,
          appUuid: typeof body.app_uuid === 'string' ? body.app_uuid : undefined,
        })
        await setInsuranceMembers(db, scopeOrgId, id, body.member_uuids, body.nominee_uuids)
        return ok(res, id, traceId)
      }
      if (action === 'updateEntry') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        const update: any = {}
        if (body.account_holder_name !== undefined) update.holderName = body.account_holder_name
        if (body.bank_name !== undefined) update.bankName = body.bank_name
        if (body.account_no !== undefined) update.accountNoEnc = body.account_no
        if (body.ifsc !== undefined) update.ifsc = body.ifsc
        if (body.cif !== undefined) update.cifEnc = body.cif
        if (body.username !== undefined) update.usernameEnc = body.username
        if (body.password !== undefined) update.passwordEnc = body.password
        if (body.transaction_password !== undefined) update.transactionPasswordEnc = body.transaction_password
        if (body.profile_password !== undefined) update.profilePasswordEnc = body.profile_password
        if (body.mpin !== undefined) update.mpinEnc = body.mpin
        if (body.app_uuid !== undefined) update.appUuid = body.app_uuid
        await updateBankingRecord(scopeOrgId, id, update)
        return ok(res, true, traceId)
      }
      if (action === 'deleteEntry') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        await deleteBankingRecord(scopeOrgId, id)
        return ok(res, true, traceId)
      }
      if (action === 'addApp') {
        const id = crypto.randomUUID()
        await addVaultApp(scopeOrgId, {
          id,
          appName: String(body.app_name ?? ''),
          category: typeof body.category === 'string' ? body.category : undefined,
          logo: typeof body.logo === 'string' ? body.logo : undefined,
          appLink: typeof body.app_link === 'string' ? body.app_link : undefined,
          usernameEnc: typeof body.username === 'string' ? body.username : undefined,
          passwordEnc: typeof body.password === 'string' ? body.password : undefined,
          twoFactor: Boolean(body.two_factor_enabled),
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        })
        return ok(res, id, traceId)
      }
      if (action === 'updateApp') {
        const app_uuid = typeof body.app_uuid === 'string' ? body.app_uuid : ''
        if (!app_uuid) return fail(res, 400, 'Missing app_uuid', traceId)
        const update: any = {}
        if (body.app_name !== undefined) update.appName = body.app_name
        if (body.category !== undefined) update.category = body.category
        if (body.logo !== undefined) update.logo = body.logo
        if (body.app_link !== undefined) update.appLink = body.app_link
        if (body.username !== undefined) update.usernameEnc = body.username
        if (body.password !== undefined) update.passwordEnc = body.password
        if (body.two_factor_enabled !== undefined) update.twoFactor = Boolean(body.two_factor_enabled)
        if (body.notes !== undefined) update.notes = body.notes
        await updateVaultApp(scopeOrgId, app_uuid, update)
        return ok(res, true, traceId)
      }
      if (action === 'deleteApp') {
        const app_uuid = typeof body.app_uuid === 'string' ? body.app_uuid : ''
        if (!app_uuid) return fail(res, 400, 'Missing app_uuid', traceId)
        await deleteVaultApp(scopeOrgId, app_uuid)
        return ok(res, true, traceId)
      }
    }

    // Insurance mutations
    if (mod === 'insurance') {
      if (action === 'addEntry') {
        const rawMode = typeof body.premium_mode === 'string' ? body.premium_mode.trim() : ''
        const premiumMode = rawMode ? parsePremiumMode(rawMode) : null
        if (rawMode && !premiumMode) {
          return fail(res, 400, `Premium mode must be one of: ${PREMIUM_MODES.join(', ')}`, traceId)
        }
        const status = normalizeInsuranceStatus(body.status)
        if (body.status !== undefined && body.status !== '' && !status) {
          return fail(res, 400, `Status must be one of: ${INSURANCE_STATUSES.join(', ')}`, traceId)
        }
        const rawType = typeof body.policy_type === 'string' ? body.policy_type.trim() : ''
        const policyType = rawType ? parsePolicyType(rawType) : null
        if (rawType && !policyType) {
          return fail(res, 400, `Policy type must be one of: ${POLICY_TYPES.join(', ')}`, traceId)
        }
        const id = crypto.randomUUID()
        await db.insert(insurance).values({
          orgId: scopeOrgId,
          id,
          policyType,
          planName: String(body.plan_name ?? ''),
          insurer: typeof body.insurer === 'string' ? body.insurer : null,
          appId: typeof body.app_uuid === 'string' ? body.app_uuid : null,
          policyNo: typeof body.policy_number === 'string' ? body.policy_number : null,
          owner: typeof body.policy_owner === 'string' ? body.policy_owner : null,
          premium: body.premium_amount !== undefined && body.premium_amount !== '' ? String(num(body.premium_amount as string | number)) : null,
          // Stored normalised so the column stops carrying five spellings of
          // one fact. `parsePremiumMode` still reads the old labels on the way in.
          premiumMode: premiumMode,
          status: status ?? 'active',
          paidPremiumsOpening: parseOpeningCount(body.paid_premiums_opening) ?? 0,
          premiumPaymentTermYears: parseOpeningCount(body.premium_payment_term_years),
          renews: body.renews === true || body.renews === 'true',
          ecardUrl: typeof body.ecard_url === 'string' && body.ecard_url.trim() ? body.ecard_url.trim() : null,
          paymentMethod: typeof body.payment_method === 'string' ? body.payment_method : null,
          issueDate: typeof body.issue_date === 'string' ? body.issue_date : null,
          maturityDate: typeof body.maturity_date === 'string' ? body.maturity_date : null,
          sumAssured: body.sum_assured !== undefined && body.sum_assured !== '' ? String(num(body.sum_assured as string | number)) : null,
          cashValue: body.cash_value !== undefined && body.cash_value !== '' ? String(num(body.cash_value as string | number)) : null,
          nominee: typeof body.nominee_name === 'string' ? body.nominee_name : null,
          notes: typeof body.notes === 'string' ? body.notes : null,
          personUuid: typeof body.person_uuid === 'string' ? body.person_uuid : null,
        })
        await setInsuranceMembers(db, scopeOrgId, id, body.member_uuids, body.nominee_uuids)
        return ok(res, id, traceId)
      }
      if (action === 'updateEntry') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        const update: any = {}
        if (body.policy_type !== undefined) {
          const rawType = String(body.policy_type ?? '').trim()
          const parsed = rawType ? parsePolicyType(rawType) : null
          if (rawType && !parsed) {
            return fail(res, 400, `Policy type must be one of: ${POLICY_TYPES.join(', ')}`, traceId)
          }
          update.policyType = parsed
        }
        if (body.plan_name !== undefined) update.planName = body.plan_name
        if (body.insurer !== undefined) update.insurer = body.insurer
        if (body.app_uuid !== undefined) update.appId = body.app_uuid
        if (body.policy_number !== undefined) update.policyNo = body.policy_number
        if (body.policy_owner !== undefined) update.owner = body.policy_owner
        if (body.premium_amount !== undefined) update.premium = String(num(body.premium_amount as string | number))
        if (body.premium_mode !== undefined) {
          const rawMode = String(body.premium_mode ?? '').trim()
          const parsed = rawMode ? parsePremiumMode(rawMode) : null
          if (rawMode && !parsed) {
            return fail(res, 400, `Premium mode must be one of: ${PREMIUM_MODES.join(', ')}`, traceId)
          }
          update.premiumMode = parsed
        }
        if (body.status !== undefined) {
          const parsedStatus = normalizeInsuranceStatus(body.status)
          if (!parsedStatus) {
            return fail(res, 400, `Status must be one of: ${INSURANCE_STATUSES.join(', ')}`, traceId)
          }
          update.status = parsedStatus
        }
        if (body.premium_payment_term_years !== undefined) {
          update.premiumPaymentTermYears = parseOpeningCount(body.premium_payment_term_years)
        }
        if (body.renews !== undefined) {
          update.renews = body.renews === true || body.renews === 'true'
        }
        if (body.ecard_url !== undefined) {
          const url = String(body.ecard_url ?? '').trim()
          update.ecardUrl = url || null
        }
        if (body.paid_premiums_opening !== undefined) {
          const opening = parseOpeningCount(body.paid_premiums_opening)
          if (opening === null) {
            return fail(res, 400, 'Premiums already paid must be a whole number of 0 or more', traceId)
          }
          update.paidPremiumsOpening = opening
        }
        if (body.payment_method !== undefined) update.paymentMethod = body.payment_method
        if (body.issue_date !== undefined) update.issueDate = body.issue_date
        if (body.maturity_date !== undefined) update.maturityDate = body.maturity_date
        if (body.sum_assured !== undefined) update.sumAssured = String(num(body.sum_assured as string | number))
        if (body.cash_value !== undefined) update.cashValue = String(num(body.cash_value as string | number))
        if (body.nominee_name !== undefined) update.nominee = body.nominee_name
        if (body.notes !== undefined) update.notes = body.notes
        if (body.person_uuid !== undefined) update.personUuid = body.person_uuid
        update.updatedAt = new Date()
        await db.update(insurance).set(update).where(and(whereOrgFilter(insurance, scopeOrgId), eq(insurance.id, id)))
        await setInsuranceMembers(db, scopeOrgId, id, body.member_uuids, body.nominee_uuids)
        return ok(res, true, traceId)
      }
      /**
       * Delete a policy and everything derived from it.
       *
       * Order matters and is copied from fintracker's subscription delete:
       *
       *  1. delete the policy first, and 404 if nothing came back — a bad or
       *     cross-org id then deletes nothing at all rather than going on to
       *     clear links and ledger rows it never owned;
       *  2. clear `ref_kind`/`ref_id` on every transaction pointing here. Skip
       *     this and the next save of a still-linked transaction re-creates a
       *     premium row for a policy that no longer exists — invisible in the
       *     UI, still counted in any ledger total;
       *  3. delete the premium rows. There is no foreign key, so nothing
       *     cascades on its own.
       *
       * The transactions themselves survive, unlinked. The money did leave the
       * account; only the link to this policy is being withdrawn.
       */
      if (action === 'deleteEntry') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        const removed = await db
          .delete(insurance)
          .where(and(whereOrgFilter(insurance, scopeOrgId), eq(insurance.id, id)))
          .returning({ id: insurance.id })
        if (!removed.length) return fail(res, 404, 'Policy not found', traceId)

        await clearTransactionRefs(db, scopeOrgId, INSURANCE_REF_KIND, id)
        await db
          .delete(insurancePremiums)
          .where(
            and(whereOrgFilter(insurancePremiums, scopeOrgId), eq(insurancePremiums.policyId, id)),
          )
        await db
          .delete(insuranceMembers)
          .where(and(whereOrgFilter(insuranceMembers, scopeOrgId), eq(insuranceMembers.policyId, id)))
        return ok(res, true, traceId)
      }

      /** Record a premium paid outside the register (cash, or before linking existed). */
      if (action === 'addPremium') {
        const policyId = typeof body.policy_id === 'string' ? body.policy_id.trim() : ''
        if (!policyId) return fail(res, 400, 'Missing policy_id', traceId)

        // Ownership check: without it any org could append to another's ledger.
        const [policy] = await db
          .select({ id: insurance.id })
          .from(insurance)
          .where(and(whereOrgFilter(insurance, scopeOrgId), eq(insurance.id, policyId)))
          .limit(1)
        if (!policy) return fail(res, 404, 'Policy not found', traceId)

        const amount = num(body.amount as string | number)
        if (!Number.isFinite(amount) || amount <= 0) {
          return fail(res, 400, 'Amount must be greater than zero', traceId)
        }
        const date =
          typeof body.date === 'string' && body.date.trim()
            ? body.date.trim()
            : new Date().toISOString().slice(0, 10)

        const id = crypto.randomUUID()
        await db.insert(insurancePremiums).values({
          id,
          orgId: scopeOrgId,
          policyId,
          date,
          amount: String(amount),
          note: typeof body.note === 'string' ? body.note : null,
        })
        return ok(res, id, traceId)
      }

      if (action === 'updatePremium') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        // A mirrored row's amount and date belong to its transaction; editing
        // here would be silently overwritten on that transaction's next save.
        if (transactionIdFromMirrorId(id)) return fail(res, 409, MIRROR_READONLY_MESSAGE, traceId)

        const update: Record<string, unknown> = {}
        if (body.date !== undefined) update.date = body.date
        if (body.amount !== undefined) {
          const amount = num(body.amount as string | number)
          if (!Number.isFinite(amount) || amount <= 0) {
            return fail(res, 400, 'Amount must be greater than zero', traceId)
          }
          update.amount = String(amount)
        }
        if (body.note !== undefined) update.note = body.note
        if (!Object.keys(update).length) return ok(res, true, traceId)

        await db
          .update(insurancePremiums)
          .set(update)
          .where(and(whereOrgFilter(insurancePremiums, scopeOrgId), eq(insurancePremiums.id, id)))
        return ok(res, true, traceId)
      }

      /**
       * Delete a premium row.
       *
       * Allowed even for a mirrored row — that is how a user unlinks the pair.
       * The unlink has to follow the delete, or the transaction still points
       * here and re-creates the row on its next save.
       */
      if (action === 'deletePremium') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        await db
          .delete(insurancePremiums)
          .where(and(whereOrgFilter(insurancePremiums, scopeOrgId), eq(insurancePremiums.id, id)))
        await unlinkTransactionMirror(db, scopeOrgId, id)
        return ok(res, true, traceId)
      }
    }

    // Persons mutations
    if (mod === 'persons') {
      if (action === 'addEntry') {
        const uuid = crypto.randomUUID()
        await addPerson(scopeOrgId, {
          uuid,
          name: String(body.name ?? ''),
          relation: typeof body.relation === 'string' ? body.relation : undefined,
          dob: typeof body.dob === 'string' ? body.dob : undefined,
          gender: typeof body.gender === 'string' ? body.gender : undefined,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        })
        return ok(res, uuid, traceId)
      }
      if (action === 'updateEntry') {
        const uuid = typeof body.person_uuid === 'string' ? body.person_uuid : ''
        if (!uuid) return fail(res, 400, 'Missing person_uuid', traceId)
        const update: any = {}
        if (body.name !== undefined) update.name = body.name
        if (body.relation !== undefined) update.relation = body.relation
        if (body.dob !== undefined) update.dob = typeof body.dob === 'string' ? body.dob : undefined
        if (body.gender !== undefined) update.gender = body.gender
        if (body.notes !== undefined) update.notes = body.notes
        await updatePerson(scopeOrgId, uuid, update)
        return ok(res, true, traceId)
      }
      if (action === 'deleteEntry') {
        const uuid = typeof body.person_uuid === 'string' ? body.person_uuid : ''
        if (!uuid) return fail(res, 400, 'Missing person_uuid', traceId)
        await deletePerson(scopeOrgId, uuid)
        return ok(res, true, traceId)
      }
    }

    // Documents mutations
    if (mod === 'documents') {
      if (action === 'addEntry') {
        const docUuid = crypto.randomUUID()
        await addDocument(scopeOrgId, {
          docUuid,
          personUuid: String(body.person_uuid ?? ''),
          docType: String(body.doc_type ?? ''),
          docNumber: typeof body.doc_number === 'string' ? body.doc_number : undefined,
          driveUrl: typeof body.drive_url === 'string' ? body.drive_url : undefined,
          expiry: typeof body.expiry === 'string' ? body.expiry : undefined,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        })
        return ok(res, docUuid, traceId)
      }
      if (action === 'updateEntry') {
        const docUuid = typeof body.doc_uuid === 'string' ? body.doc_uuid : ''
        if (!docUuid) return fail(res, 400, 'Missing doc_uuid', traceId)
        const update: any = {}
        if (body.doc_type !== undefined) update.docType = body.doc_type
        if (body.doc_number !== undefined) update.docNumber = body.doc_number
        if (body.drive_url !== undefined) update.driveUrl = body.drive_url
        if (body.expiry !== undefined) update.expiry = typeof body.expiry === 'string' ? body.expiry : undefined
        if (body.notes !== undefined) update.notes = body.notes
        await updateDocument(scopeOrgId, docUuid, update)
        return ok(res, true, traceId)
      }
      if (action === 'deleteEntry') {
        const docUuid = typeof body.doc_uuid === 'string' ? body.doc_uuid : ''
        if (!docUuid) return fail(res, 400, 'Missing doc_uuid', traceId)
        await deleteDocument(scopeOrgId, docUuid)
        return ok(res, true, traceId)
      }
    }

    // Health mutations
    if (mod === 'health') {
      if (action === 'addVital') {
        const vitalUuid = crypto.randomUUID()
        await addHealthVital(scopeOrgId, {
          vitalUuid,
          personUuid: String(body.person_uuid ?? ''),
          recordedAt: typeof body.recorded_at === 'string' ? body.recorded_at : new Date().toISOString(),
          heightCm: typeof body.height_cm === 'number' || typeof body.height_cm === 'string' ? num(body.height_cm) : undefined,
          weightKg: typeof body.weight_kg === 'number' || typeof body.weight_kg === 'string' ? num(body.weight_kg) : undefined,
          systolic: typeof body.systolic === 'number' || typeof body.systolic === 'string' ? num(body.systolic) : undefined,
          diastolic: typeof body.diastolic === 'number' || typeof body.diastolic === 'string' ? num(body.diastolic) : undefined,
          bloodSugar: typeof body.blood_sugar === 'number' || typeof body.blood_sugar === 'string' ? num(body.blood_sugar) : undefined,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        })
        return ok(res, vitalUuid, traceId)
      }
      if (action === 'deleteVital') {
        const vitalUuid = typeof body.vital_uuid === 'string' ? body.vital_uuid : ''
        if (!vitalUuid) return fail(res, 400, 'Missing vital_uuid', traceId)
        await deleteHealthVital(scopeOrgId, vitalUuid)
        return ok(res, true, traceId)
      }
      if (action === 'addIllness') {
        const illnessUuid = crypto.randomUUID()
        await addIllness(scopeOrgId, {
          illnessUuid,
          personUuid: String(body.person_uuid ?? ''),
          name: String(body.name ?? ''),
          diagnosedOn: typeof body.diagnosed_on === 'string' ? body.diagnosed_on : undefined,
          status: typeof body.status === 'string' ? body.status : undefined,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        })
        return ok(res, illnessUuid, traceId)
      }
      if (action === 'updateIllness') {
        const illnessUuid = typeof body.illness_uuid === 'string' ? body.illness_uuid : ''
        if (!illnessUuid) return fail(res, 400, 'Missing illness_uuid', traceId)
        const update: any = {}
        if (body.name !== undefined) update.name = body.name
        if (body.diagnosed_on !== undefined) update.diagnosedOn = typeof body.diagnosed_on === 'string' ? body.diagnosed_on : undefined
        if (body.status !== undefined) update.status = body.status
        if (body.notes !== undefined) update.notes = body.notes
        await updateIllness(scopeOrgId, illnessUuid, update)
        return ok(res, true, traceId)
      }
      if (action === 'deleteIllness') {
        const illnessUuid = typeof body.illness_uuid === 'string' ? body.illness_uuid : ''
        if (!illnessUuid) return fail(res, 400, 'Missing illness_uuid', traceId)
        await deleteIllness(scopeOrgId, illnessUuid)
        return ok(res, true, traceId)
      }
      if (action === 'addMedication') {
        const medUuid = crypto.randomUUID()
        await addMedication(scopeOrgId, {
          medUuid,
          personUuid: String(body.person_uuid ?? ''),
          illnessUuid: typeof body.illness_uuid === 'string' ? body.illness_uuid : undefined,
          name: String(body.name ?? ''),
          dosage: typeof body.dosage === 'string' ? body.dosage : undefined,
          frequency: typeof body.frequency === 'string' ? body.frequency : undefined,
          startDate: typeof body.start_date === 'string' ? body.start_date : undefined,
          endDate: typeof body.end_date === 'string' ? body.end_date : undefined,
          reminderTimes: typeof body.reminder_times === 'string' ? body.reminder_times : undefined,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        })
        return ok(res, medUuid, traceId)
      }
      if (action === 'updateMedication') {
        const medUuid = typeof body.med_uuid === 'string' ? body.med_uuid : ''
        if (!medUuid) return fail(res, 400, 'Missing med_uuid', traceId)
        const update: any = {}
        if (body.illness_uuid !== undefined) update.illnessUuid = body.illness_uuid
        if (body.name !== undefined) update.name = body.name
        if (body.dosage !== undefined) update.dosage = body.dosage
        if (body.frequency !== undefined) update.frequency = body.frequency
        if (body.start_date !== undefined) update.startDate = typeof body.start_date === 'string' ? body.start_date : undefined
        if (body.end_date !== undefined) update.endDate = typeof body.end_date === 'string' ? body.end_date : undefined
        if (body.reminder_times !== undefined) update.reminderTimes = body.reminder_times
        if (body.notes !== undefined) update.notes = body.notes
        await updateMedication(scopeOrgId, medUuid, update)
        return ok(res, true, traceId)
      }
      if (action === 'deleteMedication') {
        const medUuid = typeof body.med_uuid === 'string' ? body.med_uuid : ''
        if (!medUuid) return fail(res, 400, 'Missing med_uuid', traceId)
        await deleteMedication(scopeOrgId, medUuid)
        return ok(res, true, traceId)
      }
    }

    // Habits mutations
    if (mod === 'habits') {
      if (action === 'addHabit') {
        const habitUuid = crypto.randomUUID()
        await addHabit(scopeOrgId, {
          habitUuid,
          personUuid: String(body.person_uuid ?? ''),
          name: String(body.name ?? ''),
          category: typeof body.category === 'string' ? body.category : undefined,
          targetFrequency: typeof body.target_frequency === 'string' ? body.target_frequency : undefined,
        })
        return ok(res, habitUuid, traceId)
      }
      if (action === 'updateHabit') {
        const habitUuid = typeof body.habit_uuid === 'string' ? body.habit_uuid : ''
        if (!habitUuid) return fail(res, 400, 'Missing habit_uuid', traceId)
        const update: any = {}
        if (body.name !== undefined) update.name = body.name
        if (body.category !== undefined) update.category = body.category
        if (body.target_frequency !== undefined) update.targetFrequency = body.target_frequency
        await updateHabit(scopeOrgId, habitUuid, update)
        return ok(res, true, traceId)
      }
      if (action === 'deleteHabit') {
        const habitUuid = typeof body.habit_uuid === 'string' ? body.habit_uuid : ''
        if (!habitUuid) return fail(res, 400, 'Missing habit_uuid', traceId)
        await deleteHabit(scopeOrgId, habitUuid)
        return ok(res, true, traceId)
      }
      if (action === 'logHabit') {
        const logUuid = crypto.randomUUID()
        await addHabitLog(scopeOrgId, {
          logUuid,
          habitUuid: String(body.habit_uuid ?? ''),
          personUuid: String(body.person_uuid ?? ''),
          logDate: typeof body.log_date === 'string' ? body.log_date : new Date().toISOString().split('T')[0],
          completed: Boolean(body.completed),
        })
        return ok(res, true, traceId)
      }
    }
  }

  return fail(res, 400, 'Invalid module/action', traceId)
}
