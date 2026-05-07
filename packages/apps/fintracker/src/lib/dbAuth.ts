import { getDb, users } from '@fintracker-vault/db'
import { eq } from 'drizzle-orm'

export async function getUserFromDb(email: string) {
  const db = getDb()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  return user ?? null
}

export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}

export async function upsertUser(email: string, displayName?: string) {
  const db = getDb()
  const normalizedEmail = email.toLowerCase()
  await db
    .insert(users)
    .values({
      email: normalizedEmail,
      displayName: displayName ?? normalizedEmail.split('@')[0] ?? normalizedEmail,
      role: isAdminEmail(normalizedEmail) ? 'admin' : 'user',
      status: 'active',
      modules: [],
      useDb: false,
    })
    .onConflictDoNothing()
}
