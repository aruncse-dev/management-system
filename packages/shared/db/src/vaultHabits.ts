import { and, eq } from 'drizzle-orm'
import { getDb } from './neon'
import { vaultHabits, vaultHabitLogs } from './schema/vault'

// Habits
export async function getHabits(orgId: string, personUuid?: string) {
  const db = await getDb()
  if (personUuid) {
    return db.select().from(vaultHabits).where(and(eq(vaultHabits.orgId, orgId), eq(vaultHabits.personUuid, personUuid)))
  }
  return db.select().from(vaultHabits).where(eq(vaultHabits.orgId, orgId))
}

export async function addHabit(
  orgId: string,
  data: {
    habitUuid: string
    personUuid: string
    name: string
    category?: string
    targetFrequency?: string
  },
) {
  const db = await getDb()
  await db.insert(vaultHabits).values({
    habitUuid: data.habitUuid,
    orgId,
    personUuid: data.personUuid,
    name: data.name,
    category: data.category ?? null,
    targetFrequency: data.targetFrequency ?? null,
  })
}

export async function updateHabit(orgId: string, habitUuid: string, data: Partial<{ name: string; category?: string; targetFrequency?: string }>) {
  const db = await getDb()
  const update: any = {}
  if (data.name !== undefined) update.name = data.name
  if (data.category !== undefined) update.category = data.category
  if (data.targetFrequency !== undefined) update.targetFrequency = data.targetFrequency

  await db.update(vaultHabits).set(update).where(and(eq(vaultHabits.orgId, orgId), eq(vaultHabits.habitUuid, habitUuid)))
}

export async function deleteHabit(orgId: string, habitUuid: string) {
  const db = await getDb()
  await db.delete(vaultHabits).where(and(eq(vaultHabits.orgId, orgId), eq(vaultHabits.habitUuid, habitUuid)))
}

// Habit Logs
export async function getHabitLogs(
  orgId: string,
  filters?: {
    habitUuid?: string
    personUuid?: string
    fromDate?: Date
    toDate?: Date
  },
) {
  const db = await getDb()
  let query = db.select().from(vaultHabitLogs).where(eq(vaultHabitLogs.orgId, orgId))

  const conditions = [eq(vaultHabitLogs.orgId, orgId)]
  if (filters?.habitUuid) conditions.push(eq(vaultHabitLogs.habitUuid, filters.habitUuid))
  if (filters?.personUuid) conditions.push(eq(vaultHabitLogs.personUuid, filters.personUuid))

  if (conditions.length === 1) {
    return db.select().from(vaultHabitLogs).where(conditions[0])
  }
  return db.select().from(vaultHabitLogs).where(and(...conditions))
}

export async function addHabitLog(
  orgId: string,
  data: {
    logUuid: string
    habitUuid: string
    personUuid: string
    logDate: string
    completed: boolean
  },
) {
  const db = await getDb()
  await db.insert(vaultHabitLogs).values({
    logUuid: data.logUuid,
    orgId,
    habitUuid: data.habitUuid,
    personUuid: data.personUuid,
    logDate: data.logDate,
    completed: data.completed,
  })
}

export async function updateHabitLog(orgId: string, logUuid: string, data: { completed?: boolean }) {
  const db = await getDb()
  const update: any = {}
  if (data.completed !== undefined) update.completed = data.completed

  await db.update(vaultHabitLogs).set(update).where(and(eq(vaultHabitLogs.orgId, orgId), eq(vaultHabitLogs.logUuid, logUuid)))
}

export async function deleteHabitLog(orgId: string, logUuid: string) {
  const db = await getDb()
  await db.delete(vaultHabitLogs).where(and(eq(vaultHabitLogs.orgId, orgId), eq(vaultHabitLogs.logUuid, logUuid)))
}
