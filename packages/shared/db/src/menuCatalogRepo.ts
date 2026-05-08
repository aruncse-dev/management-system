import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb } from './neon'
import { apps } from './schema/apps'
import { menuApps, menuCatalog, orgMenuAssignments } from './schema/menu'
import { menuSections } from './schema/sections'
import { organizations } from './schema/orgs'

export type MenuCatalogListRow = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionId: string
  sectionSlug: string
  sectionLabel: string
  sortOrder: number
  appSlugs: string[]
}

async function attachAppSlugs(menuIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (!menuIds.length) return map
  const db = getDb()
  const rows = await db
    .select({ menuId: menuApps.menuId, appSlug: apps.slug })
    .from(menuApps)
    .innerJoin(apps, eq(menuApps.appId, apps.id))
    .where(inArray(menuApps.menuId, menuIds))

  for (const r of rows) {
    const arr = map.get(r.menuId) ?? []
    arr.push(r.appSlug)
    map.set(r.menuId, arr)
  }
  return map
}

export async function listMenuCatalog(appSlug?: string): Promise<MenuCatalogListRow[]> {
  const db = getDb()
  const ids = appSlug
    ? (
        await db
          .selectDistinct({ id: menuCatalog.id })
          .from(menuCatalog)
          .innerJoin(menuApps, eq(menuApps.menuId, menuCatalog.id))
          .innerJoin(apps, eq(menuApps.appId, apps.id))
          .where(eq(apps.slug, appSlug))
      ).map(r => r.id)
    : (await db.select({ id: menuCatalog.id }).from(menuCatalog)).map(r => r.id)
  if (!ids.length) return []

  const rows = await db
    .select({
      id: menuCatalog.id,
      slug: menuCatalog.slug,
      label: menuCatalog.label,
      icon: menuCatalog.icon,
      path: menuCatalog.path,
      sectionId: menuCatalog.sectionId,
      sectionSlug: menuSections.slug,
      sectionLabel: menuSections.label,
      sortOrder: menuCatalog.sortOrder,
    })
    .from(menuCatalog)
    .innerJoin(menuSections, eq(menuCatalog.sectionId, menuSections.id))
    .where(inArray(menuCatalog.id, ids))
    .orderBy(asc(menuSections.sortOrder), asc(menuCatalog.sortOrder), asc(menuCatalog.label))

  const slugMap = await attachAppSlugs(rows.map(r => r.id))
  return rows.map(r => ({
    ...r,
    appSlugs: slugMap.get(r.id) ?? [],
  }))
}

export async function getMenuCatalogEntry(id: string): Promise<MenuCatalogListRow | undefined> {
  const db = getDb()
  const [row] = await db
    .select({
      id: menuCatalog.id,
      slug: menuCatalog.slug,
      label: menuCatalog.label,
      icon: menuCatalog.icon,
      path: menuCatalog.path,
      sectionId: menuCatalog.sectionId,
      sectionSlug: menuSections.slug,
      sectionLabel: menuSections.label,
      sortOrder: menuCatalog.sortOrder,
    })
    .from(menuCatalog)
    .innerJoin(menuSections, eq(menuCatalog.sectionId, menuSections.id))
    .where(eq(menuCatalog.id, id))
    .limit(1)
  if (!row) return undefined
  const slugMap = await attachAppSlugs([id])
  return { ...row, appSlugs: slugMap.get(id) ?? [] }
}

export async function setMenuApps(menuId: string, appIds: string[]): Promise<void> {
  const db = getDb()
  await db.delete(menuApps).where(eq(menuApps.menuId, menuId))
  const uniq = [...new Set(appIds)]
  if (!uniq.length) return
  await db.insert(menuApps).values(
    uniq.map(appId => ({
      id: `${menuId}:${appId}`,
      menuId,
      appId,
    })),
  )
}

/** Insert org_menu_assignments for every org for this menu (idempotent). */
export async function ensureOrgAssignmentsForMenu(menuId: string): Promise<void> {
  const db = getDb()
  const [m] = await db.select({ sortOrder: menuCatalog.sortOrder }).from(menuCatalog).where(eq(menuCatalog.id, menuId)).limit(1)
  if (!m) return
  const orgs = await db.select({ id: organizations.id }).from(organizations)
  for (const o of orgs) {
    await db
      .insert(orgMenuAssignments)
      .values({
        id: `${o.id}:${menuId}`,
        orgId: o.id,
        menuId,
        sortOrder: m.sortOrder,
        enabled: true,
      })
      .onConflictDoNothing()
  }
}

export async function createMenuCatalogEntry(input: {
  id: string
  slug: string
  label: string
  icon?: string | null
  path: string
  sectionId: string
  sortOrder?: number
  appSlugs: string[]
}): Promise<MenuCatalogListRow> {
  const db = getDb()
  const appRows = await db.select({ id: apps.id, slug: apps.slug }).from(apps).where(inArray(apps.slug, [...input.appSlugs]))
  const appIds = appRows.map(a => a.id)
  if (appIds.length !== new Set(input.appSlugs).size) {
    throw new Error('One or more app slugs are invalid')
  }

  await db.insert(menuCatalog).values({
    id: input.id,
    slug: input.slug,
    label: input.label,
    icon: input.icon ?? null,
    path: input.path,
    sectionId: input.sectionId,
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await setMenuApps(input.id, appIds)
  await ensureOrgAssignmentsForMenu(input.id)
  const row = await getMenuCatalogEntry(input.id)
  if (!row) throw new Error('Failed to create menu')
  return row
}

export async function updateMenuCatalogEntry(
  id: string,
  patch: Partial<{
    slug: string
    label: string
    icon: string | null
    path: string
    sectionId: string
    sortOrder: number
    appSlugs: string[]
  }>,
): Promise<MenuCatalogListRow | undefined> {
  const db = getDb()
  const { appSlugs, ...rest } = patch
  if (Object.keys(rest).length) {
    await db
      .update(menuCatalog)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(menuCatalog.id, id))
  }
  if (appSlugs) {
    const appRows = await db.select({ id: apps.id }).from(apps).where(inArray(apps.slug, appSlugs))
    const appIds = appRows.map(a => a.id)
    if (appIds.length !== new Set(appSlugs).size) throw new Error('One or more app slugs are invalid')
    await setMenuApps(id, appIds)
  }
  return getMenuCatalogEntry(id)
}

export async function deleteMenuCatalogEntry(id: string): Promise<void> {
  const db = getDb()
  await db.delete(menuCatalog).where(eq(menuCatalog.id, id))
}
