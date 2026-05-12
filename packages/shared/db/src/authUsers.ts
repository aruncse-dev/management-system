import { and, asc, eq } from 'drizzle-orm'
import { getDb } from './neon'
import { organizations, orgMembers } from './schema/orgs'
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

/** First active platform admin (`users.role = admin`), for PIN-only session bootstrap when `PIN_SESSION_EMAIL` is unset. */
export async function getFirstPlatformAdminEmail(): Promise<string | undefined> {
  const db = getDb()
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'active')))
    .orderBy(asc(users.email))
    .limit(1)
  return row?.email
}

export async function upsertUser(email: string, displayName?: string) {
  const db = getDb()
  const normalizedEmail = email.toLowerCase()
  await db
    .insert(users)
    .values({
      email: normalizedEmail,
      displayName: displayName ?? normalizedEmail.split('@')[0] ?? normalizedEmail,
      role: 'member',
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
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(
      and(
        eq(orgMembers.userEmail, email.toLowerCase()),
        eq(organizations.status, 'active'),
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
  const user = await getUserFromDb(normalized)
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
