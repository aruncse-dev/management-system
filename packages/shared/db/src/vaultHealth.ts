import { and, eq } from 'drizzle-orm'
import { getDb } from './neon'
import { vaultHealthVitals, vaultIllnesses, vaultMedications } from './schema/vault'

// Health Vitals
export async function getHealthVitals(orgId: string, personUuid?: string) {
  const db = await getDb()
  if (personUuid) {
    return db.select().from(vaultHealthVitals).where(and(eq(vaultHealthVitals.orgId, orgId), eq(vaultHealthVitals.personUuid, personUuid)))
  }
  return db.select().from(vaultHealthVitals).where(eq(vaultHealthVitals.orgId, orgId))
}

export async function addHealthVital(
  orgId: string,
  data: {
    vitalUuid: string
    personUuid: string
    recordedAt: string | Date
    heightCm?: number
    weightKg?: number
    systolic?: number
    diastolic?: number
    bloodSugar?: number
    notes?: string
  },
) {
  const db = await getDb()
  await db.insert(vaultHealthVitals).values({
    vitalUuid: data.vitalUuid,
    orgId,
    personUuid: data.personUuid,
    recordedAt: typeof data.recordedAt === 'string' ? new Date(data.recordedAt) : data.recordedAt,
    heightCm: data.heightCm !== undefined ? String(data.heightCm) : null,
    weightKg: data.weightKg !== undefined ? String(data.weightKg) : null,
    systolic: data.systolic !== undefined ? String(data.systolic) : null,
    diastolic: data.diastolic !== undefined ? String(data.diastolic) : null,
    bloodSugar: data.bloodSugar !== undefined ? String(data.bloodSugar) : null,
    notes: data.notes ?? null,
  })
}

export async function deleteHealthVital(orgId: string, vitalUuid: string) {
  const db = await getDb()
  await db.delete(vaultHealthVitals).where(and(eq(vaultHealthVitals.orgId, orgId), eq(vaultHealthVitals.vitalUuid, vitalUuid)))
}

// Illnesses
export async function getIllnesses(orgId: string, personUuid?: string) {
  const db = await getDb()
  if (personUuid) {
    return db.select().from(vaultIllnesses).where(and(eq(vaultIllnesses.orgId, orgId), eq(vaultIllnesses.personUuid, personUuid)))
  }
  return db.select().from(vaultIllnesses).where(eq(vaultIllnesses.orgId, orgId))
}

export async function addIllness(
  orgId: string,
  data: {
    illnessUuid: string
    personUuid: string
    name: string
    diagnosedOn?: string | null
    status?: string
    notes?: string
  },
) {
  const db = await getDb()
  await db.insert(vaultIllnesses).values({
    illnessUuid: data.illnessUuid,
    orgId,
    personUuid: data.personUuid,
    name: data.name,
    diagnosedOn: data.diagnosedOn ?? null,
    status: data.status ?? null,
    notes: data.notes ?? null,
  })
}

export async function updateIllness(orgId: string, illnessUuid: string, data: Partial<{ name: string; diagnosedOn?: string | null; status?: string; notes?: string }>) {
  const db = await getDb()
  const update: any = {}
  if (data.name !== undefined) update.name = data.name
  if (data.diagnosedOn !== undefined) update.diagnosedOn = data.diagnosedOn
  if (data.status !== undefined) update.status = data.status
  if (data.notes !== undefined) update.notes = data.notes

  await db.update(vaultIllnesses).set(update).where(and(eq(vaultIllnesses.orgId, orgId), eq(vaultIllnesses.illnessUuid, illnessUuid)))
}

export async function deleteIllness(orgId: string, illnessUuid: string) {
  const db = await getDb()
  await db.delete(vaultIllnesses).where(and(eq(vaultIllnesses.orgId, orgId), eq(vaultIllnesses.illnessUuid, illnessUuid)))
}

// Medications
export async function getMedications(orgId: string, personUuid?: string) {
  const db = await getDb()
  if (personUuid) {
    return db.select().from(vaultMedications).where(and(eq(vaultMedications.orgId, orgId), eq(vaultMedications.personUuid, personUuid)))
  }
  return db.select().from(vaultMedications).where(eq(vaultMedications.orgId, orgId))
}

export async function addMedication(
  orgId: string,
  data: {
    medUuid: string
    personUuid: string
    illnessUuid?: string | null
    name: string
    dosage?: string
    frequency?: string
    startDate?: string | null
    endDate?: string | null
    reminderTimes?: string
    notes?: string
  },
) {
  const db = await getDb()
  await db.insert(vaultMedications).values({
    medUuid: data.medUuid,
    orgId,
    personUuid: data.personUuid,
    illnessUuid: data.illnessUuid ?? null,
    name: data.name,
    dosage: data.dosage ?? null,
    frequency: data.frequency ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    reminderTimes: data.reminderTimes ?? null,
    notes: data.notes ?? null,
  })
}

export async function updateMedication(orgId: string, medUuid: string, data: Partial<{ illnessUuid?: string | null; name: string; dosage?: string; frequency?: string; startDate?: string | null; endDate?: string | null; reminderTimes?: string; notes?: string }>) {
  const db = await getDb()
  const update: any = {}
  if (data.illnessUuid !== undefined) update.illnessUuid = data.illnessUuid
  if (data.name !== undefined) update.name = data.name
  if (data.dosage !== undefined) update.dosage = data.dosage
  if (data.frequency !== undefined) update.frequency = data.frequency
  if (data.startDate !== undefined) update.startDate = data.startDate
  if (data.endDate !== undefined) update.endDate = data.endDate
  if (data.reminderTimes !== undefined) update.reminderTimes = data.reminderTimes
  if (data.notes !== undefined) update.notes = data.notes

  await db.update(vaultMedications).set(update).where(and(eq(vaultMedications.orgId, orgId), eq(vaultMedications.medUuid, medUuid)))
}

export async function deleteMedication(orgId: string, medUuid: string) {
  const db = await getDb()
  await db.delete(vaultMedications).where(and(eq(vaultMedications.orgId, orgId), eq(vaultMedications.medUuid, medUuid)))
}
