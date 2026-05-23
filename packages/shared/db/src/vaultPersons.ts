import { and, eq } from 'drizzle-orm'
import { getDb } from './neon'
import { persons, vaultDocuments } from './schema/vault'

export async function getPersons(orgId: string) {
  const db = await getDb()
  return db.select().from(persons).where(eq(persons.orgId, orgId))
}

export async function getPerson(orgId: string, uuid: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.orgId, orgId), eq(persons.uuid, uuid)))
    .limit(1)
  return row || null
}

export async function addPerson(orgId: string, data: { uuid: string; name: string; relation?: string; dob?: string | null; gender?: string; notes?: string }) {
  const db = await getDb()
  await db.insert(persons).values({
    orgId,
    uuid: data.uuid,
    name: data.name,
    relation: data.relation ?? null,
    dob: data.dob ?? null,
    gender: data.gender ?? null,
    notes: data.notes ?? null,
  })
}

export async function updatePerson(orgId: string, uuid: string, data: Partial<{ name: string; relation?: string; dob?: string | null; gender?: string; notes?: string }>) {
  const db = await getDb()
  const update: any = {}
  if (data.name !== undefined) update.name = data.name
  if (data.relation !== undefined) update.relation = data.relation
  if (data.dob !== undefined) update.dob = data.dob
  if (data.gender !== undefined) update.gender = data.gender
  if (data.notes !== undefined) update.notes = data.notes
  update.updatedAt = new Date()

  await db.update(persons).set(update).where(and(eq(persons.orgId, orgId), eq(persons.uuid, uuid)))
}

export async function deletePerson(orgId: string, uuid: string) {
  const db = await getDb()
  await db.delete(persons).where(and(eq(persons.orgId, orgId), eq(persons.uuid, uuid)))
}

export async function getDocuments(orgId: string, personUuid?: string) {
  const db = await getDb()
  if (personUuid) {
    return db.select().from(vaultDocuments).where(and(eq(vaultDocuments.orgId, orgId), eq(vaultDocuments.personUuid, personUuid)))
  }
  return db.select().from(vaultDocuments).where(eq(vaultDocuments.orgId, orgId))
}

export async function getDocument(orgId: string, docUuid: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(vaultDocuments)
    .where(and(eq(vaultDocuments.orgId, orgId), eq(vaultDocuments.docUuid, docUuid)))
    .limit(1)
  return row || null
}

export async function addDocument(
  orgId: string,
  data: {
    docUuid: string
    personUuid: string
    docType: string
    docNumber?: string
    driveUrl?: string
    expiry?: string | null
    notes?: string
  },
) {
  const db = await getDb()
  await db.insert(vaultDocuments).values({
    docUuid: data.docUuid,
    orgId,
    personUuid: data.personUuid,
    docType: data.docType,
    docNumber: data.docNumber ?? null,
    driveUrl: data.driveUrl ?? null,
    expiry: data.expiry ?? null,
    notes: data.notes ?? null,
  })
}

export async function updateDocument(orgId: string, docUuid: string, data: Partial<{ docType: string; docNumber?: string; driveUrl?: string; expiry?: string | null; notes?: string }>) {
  const db = await getDb()
  const update: any = {}
  if (data.docType !== undefined) update.docType = data.docType
  if (data.docNumber !== undefined) update.docNumber = data.docNumber
  if (data.driveUrl !== undefined) update.driveUrl = data.driveUrl
  if (data.expiry !== undefined) update.expiry = data.expiry
  if (data.notes !== undefined) update.notes = data.notes

  await db
    .update(vaultDocuments)
    .set(update)
    .where(and(eq(vaultDocuments.orgId, orgId), eq(vaultDocuments.docUuid, docUuid)))
}

export async function deleteDocument(orgId: string, docUuid: string) {
  const db = await getDb()
  await db.delete(vaultDocuments).where(and(eq(vaultDocuments.orgId, orgId), eq(vaultDocuments.docUuid, docUuid)))
}
