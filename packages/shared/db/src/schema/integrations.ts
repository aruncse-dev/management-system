import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const integrationProviders = pgTable('integration_providers', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  status: text('status').default('active').notNull(),
  clientId: text('client_id').notNull(),
  clientSecretEnc: text('client_secret_enc').notNull(),
  endpoints: jsonb('endpoints').default('{}').notNull(),
  appMenus: jsonb('app_menus').default('{}').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const orgIntegrations = pgTable('org_integrations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  providerSlug: text('provider_slug').notNull(),
  status: text('status').default('disconnected').notNull(),
  accessTokenEnc: text('access_token_enc'),
  refreshTokenEnc: text('refresh_token_enc'),
  tokenExpiresAt: timestamp('token_expires_at'),
  connectedByEmail: text('connected_by_email'),
  lastSyncAt: timestamp('last_sync_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type IntegrationProvider = typeof integrationProviders.$inferSelect
export type OrgIntegration = typeof orgIntegrations.$inferSelect
