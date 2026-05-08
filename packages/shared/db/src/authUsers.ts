import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { getDb } from './neon'
import { organizations } from './schema/orgs'
import { users } from './schema/users'

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
  const userId = 'usr_' + normalizedEmail.replace(/[^a-z0-9]/g, '_')
  await db
    .insert(users)
    .values({
      id: userId,
      email: normalizedEmail,
      displayName: displayName ?? normalizedEmail.split('@')[0] ?? normalizedEmail,
      role: isAdminEmail(normalizedEmail) ? 'admin' : 'member',
      status: 'active',
      useDb: false,
    })
    .onConflictDoNothing()
}

/** Ensure a `users` row exists (e.g. before adding to an org). Does not downgrade existing admins. */
export async function ensureUserRow(email: string, displayName?: string) {
  const normalized = email.toLowerCase().trim()
  if (!normalized) return
  await upsertUser(normalized, displayName)
}

export async function listOrgsForUserEmail(email: string): Promise<{ id: string; name: string }[]> {
  const db = getDb()
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(users)
    .innerJoin(organizations, eq(users.orgId, organizations.id))
    .where(
      and(
        eq(users.email, email.toLowerCase()),
        eq(users.status, 'active'),
        eq(organizations.status, 'active'),
        isNotNull(users.orgId),
      ),
    )
    .orderBy(asc(organizations.name))
}

export async function applyDefaultOrgToSession(
  session: { activeOrgId?: string },
  email: string,
): Promise<void> {
  const orgs = await listOrgsForUserEmail(email)
  if (session.activeOrgId && orgs.some(o => o.id === session.activeOrgId)) return
  session.activeOrgId = orgs[0]?.id
}

export async function verifyProvisionedGoogleUser(
  email: string,
  displayName?: string,
): Promise<
  { allowed: true } | { allowed: false; error: string; statusCode: number }
> {
  const normalized = email.toLowerCase()
  let user = await getUserFromDb(normalized)
  if (!user && isAdminEmail(normalized)) {
    await upsertUser(normalized, displayName)
    user = await getUserFromDb(normalized)
  }
  if (!user) {
    return {
      allowed: false,
      error: 'Account not provisioned. Ask a platform administrator to add your account.',
      statusCode: 403,
    }
  }
  if (user.status === 'suspended') {
    return { allowed: false, error: 'Account suspended. Contact an administrator.', statusCode: 403 }
  }
  return { allowed: true }
}
