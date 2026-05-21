import {
  deriveIntegrationActions,
  endpointsToRows,
  parseAppMenus,
  parseEndpoints,
} from '@fintracker-vault/db'
import { maskSensitiveDisplayValue } from '@fintracker-vault/db'
import type { integrationProviders } from '@fintracker-vault/db'

export function providerToPublic(row: typeof integrationProviders.$inferSelect) {
  const endpoints = parseEndpoints(row.endpoints)
  const appMenus = parseAppMenus(row.appMenus)
  return {
    slug: row.slug,
    name: row.name,
    status: row.status,
    clientIdMasked: maskSensitiveDisplayValue(row.clientId),
    hasClientSecret: Boolean(row.clientSecretEnc),
    endpoints,
    endpointRows: endpointsToRows(endpoints),
    appMenus,
    actions: deriveIntegrationActions(row),
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}
