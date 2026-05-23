import { and, eq } from 'drizzle-orm'
import { encryptSensitiveField } from './sensitiveFieldCrypto'
import { getDb } from './neon'
import { bankingRecords, vaultApps } from './schema/vault'

type BankingRow = typeof bankingRecords.$inferSelect
type VaultAppRow = typeof vaultApps.$inferSelect

export async function getBankingRecords(orgId: string) {
  const db = await getDb()
  return db.select().from(bankingRecords).where(eq(bankingRecords.orgId, orgId))
}

export async function getBankingRecord(orgId: string, id: string) {
  const db = await getDb()
  const [r] = await db
    .select()
    .from(bankingRecords)
    .where(and(eq(bankingRecords.orgId, orgId), eq(bankingRecords.id, id)))
    .limit(1)
  if (!r) return null
  return r
}

export async function addBankingRecord(
  orgId: string,
  data: {
    id: string
    holderName?: string
    bankName: string
    accountNoEnc?: string
    ifsc?: string
    cifEnc?: string
    usernameEnc?: string
    passwordEnc?: string
    transactionPasswordEnc?: string
    profilePasswordEnc?: string
    mpinEnc?: string
    appUuid?: string
  },
) {
  const db = await getDb()
  await db.insert(bankingRecords).values({
    orgId,
    id: data.id,
    holderName: data.holderName ?? null,
    bankName: data.bankName,
    accountNoEnc: data.accountNoEnc ? encryptSensitiveField(data.accountNoEnc) : null,
    ifsc: data.ifsc ?? null,
    cifEnc: data.cifEnc ? encryptSensitiveField(data.cifEnc) : null,
    usernameEnc: data.usernameEnc ? encryptSensitiveField(data.usernameEnc) : null,
    passwordEnc: data.passwordEnc ? encryptSensitiveField(data.passwordEnc) : null,
    transactionPasswordEnc: data.transactionPasswordEnc ? encryptSensitiveField(data.transactionPasswordEnc) : null,
    profilePasswordEnc: data.profilePasswordEnc ? encryptSensitiveField(data.profilePasswordEnc) : null,
    mpinEnc: data.mpinEnc ? encryptSensitiveField(data.mpinEnc) : null,
    appUuid: data.appUuid ?? null,
  })
}

export async function updateBankingRecord(
  orgId: string,
  id: string,
  data: Partial<{
    holderName?: string
    bankName: string
    accountNoEnc?: string
    ifsc?: string
    cifEnc?: string
    usernameEnc?: string
    passwordEnc?: string
    transactionPasswordEnc?: string
    profilePasswordEnc?: string
    mpinEnc?: string
    appUuid?: string
  }>,
) {
  const db = await getDb()
  const update: any = {}
  if (data.holderName !== undefined) update.holderName = data.holderName
  if (data.bankName !== undefined) update.bankName = data.bankName
  if (data.accountNoEnc !== undefined) update.accountNoEnc = data.accountNoEnc ? encryptSensitiveField(data.accountNoEnc) : null
  if (data.ifsc !== undefined) update.ifsc = data.ifsc
  if (data.cifEnc !== undefined) update.cifEnc = data.cifEnc ? encryptSensitiveField(data.cifEnc) : null
  if (data.usernameEnc !== undefined) update.usernameEnc = data.usernameEnc ? encryptSensitiveField(data.usernameEnc) : null
  if (data.passwordEnc !== undefined) update.passwordEnc = data.passwordEnc ? encryptSensitiveField(data.passwordEnc) : null
  if (data.transactionPasswordEnc !== undefined) update.transactionPasswordEnc = data.transactionPasswordEnc ? encryptSensitiveField(data.transactionPasswordEnc) : null
  if (data.profilePasswordEnc !== undefined) update.profilePasswordEnc = data.profilePasswordEnc ? encryptSensitiveField(data.profilePasswordEnc) : null
  if (data.mpinEnc !== undefined) update.mpinEnc = data.mpinEnc ? encryptSensitiveField(data.mpinEnc) : null
  if (data.appUuid !== undefined) update.appUuid = data.appUuid
  update.updatedAt = new Date()

  await db
    .update(bankingRecords)
    .set(update)
    .where(and(eq(bankingRecords.orgId, orgId), eq(bankingRecords.id, id)))
}

export async function deleteBankingRecord(orgId: string, id: string) {
  const db = await getDb()
  await db.delete(bankingRecords).where(and(eq(bankingRecords.orgId, orgId), eq(bankingRecords.id, id)))
}

export async function getVaultApps(orgId: string) {
  const db = await getDb()
  return db.select().from(vaultApps).where(eq(vaultApps.orgId, orgId))
}

export async function getVaultApp(orgId: string, id: string) {
  const db = await getDb()
  const [r] = await db
    .select()
    .from(vaultApps)
    .where(and(eq(vaultApps.orgId, orgId), eq(vaultApps.id, id)))
    .limit(1)
  if (!r) return null
  return r
}

export async function addVaultApp(
  orgId: string,
  data: {
    id: string
    appName: string
    category?: string
    logo?: string
    appLink?: string
    usernameEnc?: string
    passwordEnc?: string
    twoFactor?: boolean
    notes?: string
  },
) {
  const db = await getDb()
  await db.insert(vaultApps).values({
    orgId,
    id: data.id,
    appName: data.appName,
    category: data.category ?? null,
    logo: data.logo ?? null,
    appLink: data.appLink ?? null,
    usernameEnc: data.usernameEnc ? encryptSensitiveField(data.usernameEnc) : null,
    passwordEnc: data.passwordEnc ? encryptSensitiveField(data.passwordEnc) : null,
    twoFactor: data.twoFactor ?? false,
    notes: data.notes ?? null,
  })
}

export async function updateVaultApp(
  orgId: string,
  id: string,
  data: Partial<{
    appName: string
    category?: string
    logo?: string
    appLink?: string
    usernameEnc?: string
    passwordEnc?: string
    twoFactor?: boolean
    notes?: string
  }>,
) {
  const db = await getDb()
  const update: any = {}
  if (data.appName !== undefined) update.appName = data.appName
  if (data.category !== undefined) update.category = data.category
  if (data.logo !== undefined) update.logo = data.logo
  if (data.appLink !== undefined) update.appLink = data.appLink
  if (data.usernameEnc !== undefined) update.usernameEnc = data.usernameEnc ? encryptSensitiveField(data.usernameEnc) : null
  if (data.passwordEnc !== undefined) update.passwordEnc = data.passwordEnc ? encryptSensitiveField(data.passwordEnc) : null
  if (data.twoFactor !== undefined) update.twoFactor = data.twoFactor
  if (data.notes !== undefined) update.notes = data.notes
  update.updatedAt = new Date()

  await db
    .update(vaultApps)
    .set(update)
    .where(and(eq(vaultApps.orgId, orgId), eq(vaultApps.id, id)))
}

export async function deleteVaultApp(orgId: string, id: string) {
  const db = await getDb()
  await db.delete(vaultApps).where(and(eq(vaultApps.orgId, orgId), eq(vaultApps.id, id)))
}
