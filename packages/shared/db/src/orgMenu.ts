import { and, asc, eq } from 'drizzle-orm'
import { getDb } from './neon'
import { APPS_SEED, MENU_CATALOG_SEED, MENU_SECTIONS_SEED } from './menuCatalogSeed'
import { apps } from './schema/apps'
import { menuSections } from './schema/sections'
import { menuApps, menuCatalog, orgMenuAssignments } from './schema/menu'
import { organizations } from './schema/orgs'

/** Ensure apps + sections + catalog + menu_apps exist (no-op when catalog already populated). */
export async function seedMenuCatalogIfEmpty(): Promise<void> {
  const db = getDb()
  const [existing] = await db.select({ id: menuCatalog.id }).from(menuCatalog).limit(1)
  if (existing) return

  await db.insert(apps).values(
    APPS_SEED.map(a => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description ?? null,
      icon: a.icon ?? null,
      sortOrder: a.sortOrder,
      status: 'active' as const,
    })),
  )

  await db.insert(menuSections).values(
    MENU_SECTIONS_SEED.map(s => ({
      id: s.id,
      slug: s.slug,
      label: s.label,
      sortOrder: s.sortOrder,
    })),
  )

  await db.insert(menuCatalog).values(
    MENU_CATALOG_SEED.map(m => ({
      id: m.id,
      slug: m.slug,
      label: m.label,
      icon: m.icon,
      path: m.path,
      sectionId: m.sectionId,
      sortOrder: m.sortOrder,
    })),
  )

  const linkRows: { id: string; menuId: string; appId: string }[] = []
  for (const m of MENU_CATALOG_SEED) {
    for (const appSlug of m.appSlugs) {
      linkRows.push({ id: `${m.id}:${appSlug}`, menuId: m.id, appId: appSlug })
    }
  }
  if (linkRows.length) {
    await db.insert(menuApps).values(linkRows)
  }
}

async function resolveAppIdBySlug(appSlug: string): Promise<string | null> {
  const db = getDb()
  const [row] = await db.select({ id: apps.id }).from(apps).where(eq(apps.slug, appSlug)).limit(1)
  return row?.id ?? null
}

/** Ensure every catalog item has a row for this org (enabled by default for new assignments). */
export async function assignDefaultOrgMenus(orgId: string): Promise<void> {
  const db = getDb()
  await seedMenuCatalogIfEmpty()
  const catalog = await db
    .select({ id: menuCatalog.id, sortOrder: menuCatalog.sortOrder })
    .from(menuCatalog)

  if (!catalog.length) return

  await db
    .insert(orgMenuAssignments)
    .values(
      catalog.map(m => ({
        id: `${orgId}:${m.id}`,
        orgId,
        menuId: m.id,
        sortOrder: m.sortOrder,
        enabled: true,
      })),
    )
    .onConflictDoNothing()
}

export type ResolvedMenuItem = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionSlug: string
  sectionLabel: string
  sortOrder: number
}

export async function getEnabledOrgMenu(orgId: string, appSlug: string): Promise<ResolvedMenuItem[]> {
  const db = getDb()
  await seedMenuCatalogIfEmpty()
  const appId = await resolveAppIdBySlug(appSlug)
  if (!appId) return []

  const rows = await db
    .select({
      id: menuCatalog.id,
      slug: menuCatalog.slug,
      label: menuCatalog.label,
      icon: menuCatalog.icon,
      path: menuCatalog.path,
      sectionSlug: menuSections.slug,
      sectionLabel: menuSections.label,
      sortOrder: orgMenuAssignments.sortOrder,
    })
    .from(orgMenuAssignments)
    .innerJoin(menuCatalog, eq(orgMenuAssignments.menuId, menuCatalog.id))
    .innerJoin(menuSections, eq(menuCatalog.sectionId, menuSections.id))
    .innerJoin(menuApps, eq(menuApps.menuId, menuCatalog.id))
    .where(
      and(
        eq(orgMenuAssignments.orgId, orgId),
        eq(orgMenuAssignments.enabled, true),
        eq(menuApps.appId, appId),
      ),
    )
    .orderBy(asc(menuSections.sortOrder), asc(orgMenuAssignments.sortOrder), asc(menuCatalog.sortOrder))

  return rows.map(r => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    icon: r.icon,
    path: r.path,
    sectionSlug: r.sectionSlug,
    sectionLabel: r.sectionLabel,
    sortOrder: r.sortOrder,
  }))
}

/** Full catalog with enabled flag for admin UI (optionally scoped to one app). */
export async function getOrgMenuEditorState(
  orgId: string,
  appSlug?: string,
): Promise<
  {
    id: string
    slug: string
    sectionSlug: string
    sectionLabel: string
    label: string
    icon: string | null
    path: string
    sortOrder: number
    enabled: boolean
  }[]
> {
  const db = getDb()
  await seedMenuCatalogIfEmpty()
  await assignDefaultOrgMenus(orgId)

  const appId = appSlug ? await resolveAppIdBySlug(appSlug) : null
  if (appSlug && !appId) return []

  const cols = {
    id: menuCatalog.id,
    slug: menuCatalog.slug,
    sectionSlug: menuSections.slug,
    sectionLabel: menuSections.label,
    label: menuCatalog.label,
    icon: menuCatalog.icon,
    path: menuCatalog.path,
    sortOrder: menuCatalog.sortOrder,
    enabled: orgMenuAssignments.enabled,
  }

  const rows =
    appId !== null
      ? await db
          .select(cols)
          .from(orgMenuAssignments)
          .innerJoin(menuCatalog, eq(orgMenuAssignments.menuId, menuCatalog.id))
          .innerJoin(menuSections, eq(menuCatalog.sectionId, menuSections.id))
          .innerJoin(menuApps, and(eq(menuApps.menuId, menuCatalog.id), eq(menuApps.appId, appId)))
          .where(eq(orgMenuAssignments.orgId, orgId))
          .orderBy(asc(menuSections.sortOrder), asc(menuCatalog.sortOrder))
      : await db
          .select(cols)
          .from(orgMenuAssignments)
          .innerJoin(menuCatalog, eq(orgMenuAssignments.menuId, menuCatalog.id))
          .innerJoin(menuSections, eq(menuCatalog.sectionId, menuSections.id))
          .where(eq(orgMenuAssignments.orgId, orgId))
          .orderBy(asc(menuSections.sortOrder), asc(menuCatalog.sortOrder))

  return rows.map(r => ({
    id: r.id,
    slug: r.slug,
    sectionSlug: r.sectionSlug,
    sectionLabel: r.sectionLabel,
    label: r.label,
    icon: r.icon,
    path: r.path,
    sortOrder: r.sortOrder,
    enabled: r.enabled,
  }))
}

export async function setOrgEnabledMenuIds(orgId: string, enabledIds: Set<string>, appSlug: string): Promise<void> {
  const db = getDb()
  await seedMenuCatalogIfEmpty()
  await assignDefaultOrgMenus(orgId)

  const appId = await resolveAppIdBySlug(appSlug)
  if (!appId) throw new Error(`Unknown app slug: ${appSlug}`)

  const scoped = await db
    .select({ menuId: menuApps.menuId })
    .from(menuApps)
    .where(eq(menuApps.appId, appId))

  for (const { menuId } of scoped) {
    await db
      .update(orgMenuAssignments)
      .set({ enabled: enabledIds.has(menuId) })
      .where(and(eq(orgMenuAssignments.orgId, orgId), eq(orgMenuAssignments.menuId, menuId)))
  }
}

/** Backfill menu rows for all orgs (e.g. after migration). */
export async function backfillOrgMenusForAllOrgs(): Promise<void> {
  const db = getDb()
  await seedMenuCatalogIfEmpty()
  const orgs = await db.select({ id: organizations.id }).from(organizations)
  for (const o of orgs) {
    await assignDefaultOrgMenus(o.id)
  }
}
