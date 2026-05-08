import { asc, eq } from 'drizzle-orm'
import { getDb } from './neon'
import { menuSections, type MenuSectionRow, type NewMenuSectionRow } from './schema/sections'

export async function listMenuSections(): Promise<MenuSectionRow[]> {
  const db = getDb()
  return db.select().from(menuSections).orderBy(asc(menuSections.sortOrder), asc(menuSections.label))
}

export async function getMenuSectionById(id: string): Promise<MenuSectionRow | undefined> {
  const db = getDb()
  const [row] = await db.select().from(menuSections).where(eq(menuSections.id, id)).limit(1)
  return row
}

export async function createMenuSection(
  input: Omit<NewMenuSectionRow, 'createdAt'>,
): Promise<MenuSectionRow> {
  const db = getDb()
  const id = input.id ?? input.slug
  await db.insert(menuSections).values({
    ...input,
    id,
    slug: input.slug,
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date(),
  })
  const created = await getMenuSectionById(id)
  if (!created) throw new Error('Failed to create section')
  return created
}

export async function updateMenuSection(
  id: string,
  patch: Partial<Pick<MenuSectionRow, 'label' | 'sortOrder' | 'slug'>>,
): Promise<MenuSectionRow | undefined> {
  const db = getDb()
  await db.update(menuSections).set(patch).where(eq(menuSections.id, id))
  return getMenuSectionById(id)
}

export async function deleteMenuSection(id: string): Promise<void> {
  const db = getDb()
  await db.delete(menuSections).where(eq(menuSections.id, id))
}
