import { asc, eq } from 'drizzle-orm'
import { getDb } from './neon'
import { apps, type AppRow, type NewAppRow } from './schema/apps'

export async function listApps(): Promise<AppRow[]> {
  const db = getDb()
  return db.select().from(apps).orderBy(asc(apps.sortOrder), asc(apps.name))
}

export async function getAppById(id: string): Promise<AppRow | undefined> {
  const db = getDb()
  const [row] = await db.select().from(apps).where(eq(apps.id, id)).limit(1)
  return row
}

export async function getAppBySlug(slug: string): Promise<AppRow | undefined> {
  const db = getDb()
  const [row] = await db.select().from(apps).where(eq(apps.slug, slug)).limit(1)
  return row
}

export async function createApp(input: Omit<NewAppRow, 'createdAt' | 'updatedAt'>): Promise<AppRow> {
  const db = getDb()
  const id = input.id ?? input.slug
  const row: NewAppRow = {
    ...input,
    id,
    slug: input.slug,
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.insert(apps).values(row)
  const created = await getAppById(id)
  if (!created) throw new Error('Failed to create app')
  return created
}

export async function updateApp(
  id: string,
  patch: Partial<Pick<AppRow, 'name' | 'description' | 'icon' | 'sortOrder' | 'status' | 'slug'>>,
): Promise<AppRow | undefined> {
  const db = getDb()
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<Pick<AppRow, 'name' | 'description' | 'icon' | 'sortOrder' | 'status' | 'slug'>>
  if (Object.keys(clean).length === 0) return getAppById(id)
  await db
    .update(apps)
    .set({ ...clean, updatedAt: new Date() })
    .where(eq(apps.id, id))
  return getAppById(id)
}

export async function deleteApp(id: string): Promise<void> {
  const db = getDb()
  await db.delete(apps).where(eq(apps.id, id))
}
