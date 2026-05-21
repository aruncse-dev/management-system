# Integrations & Encryption

Integration provider secrets and org OAuth tokens use the **platform-wide** sensitive field encryption described in [sensitive-field-encryption.md](./sensitive-field-encryption.md).

Set `FIELD_ENCRYPTION_KEY` (not a separate integrations-only key) on FinTracker and Admin.

## Upstox setup

See the main integrations plan: Admin → Integrations, org enable flag, FinTracker Settings → Connect.

Redirect URI: `{APP_PUBLIC_URL}/api/integrations/oauth/callback`

Optional bootstrap env (then manage in Admin UI):

```env
UPSTOX_CLIENT_ID=
UPSTOX_CLIENT_SECRET=
```

## Database schema

### `integration_providers`
- `id` (PK text)
- `org_id` (FK text)
- `slug` (text, unique per org) — e.g., "upstox", "kite", "other"
- `name` (text) — display name
- `client_id_enc` (text, nullable) — OAuth app ID (encrypted)
- `client_secret_enc` (text, nullable) — OAuth secret (encrypted)
- `redirect_uri` (text)
- `settings` (JSONB) — additional provider-specific config
- `status` (text) — `active` | `inactive`
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `org_integrations`
- `id` (PK text)
- `org_id` (FK text)
- `provider_id` (FK text → integration_providers)
- `access_token_enc` (text, nullable) — OAuth access token (encrypted)
- `refresh_token_enc` (text, nullable) — OAuth refresh token (encrypted)
- `expires_at` (timestamp, nullable)
- `status` (text) — `connected` | `disconnected` | `expired`
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

## Writing integration helpers

### Reading encrypted credentials

```ts
import { decryptSensitiveField } from '@fintracker-vault/db'

export async function getUpstoxCredentials(orgId: string) {
  const org = await db.query.orgIntegrations.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.orgId, orgId), eq(t.providerId, 'upstox')),
  })
  
  if (!org?.accessTokenEnc) return null
  
  return {
    accessToken: decryptSensitiveField(org.accessTokenEnc),
    refreshToken: org.refreshTokenEnc
      ? decryptSensitiveField(org.refreshTokenEnc)
      : null,
  }
}
```

### Storing encrypted credentials

```ts
import { encryptSensitiveField } from '@fintracker-vault/db'

export async function storeUpstoxToken(
  orgId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
) {
  await db
    .update(orgIntegrations)
    .set({
      accessTokenEnc: encryptSensitiveField(accessToken),
      refreshTokenEnc: encryptSensitiveField(refreshToken),
      expiresAt,
      status: 'connected',
      updatedAt: new Date(),
    })
    .where(and(eq(orgIntegrations.orgId, orgId)))
}
```

---

## OAuth callback flow

**File:** `packages/apps/fintracker/src/pages/api/integrations/oauth/callback.ts`

1. User initiates "Connect to Upstox" → redirects to Upstox OAuth
2. Upstox redirects back to `/api/integrations/oauth/callback?code=...&state=...`
3. Verify `state` matches session
4. Exchange `code` for `access_token` + `refresh_token`
5. Store encrypted tokens in `org_integrations` table
6. Redirect to `settings` page with success message

```ts
// Pseudo-code
const { code, state } = query

// Verify state
if (state !== session.oauthState) {
  return res.status(400).json({ error: 'Invalid state' })
}

// Exchange for token
const tokenResponse = await fetch('https://api.upstox.com/oauth/token', {
  method: 'POST',
  body: JSON.stringify({
    code,
    client_id: UPSTOX_CLIENT_ID,
    client_secret: UPSTOX_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  }),
})

const { access_token, refresh_token, expires_in } = await tokenResponse.json()

// Store encrypted
await storeUpstoxToken(
  session.activeOrgId,
  access_token,
  refresh_token,
  new Date(Date.now() + expires_in * 1000)
)

res.redirect('/settings?integration=upstox&status=connected')
```

---

## Token refresh

Before calling Upstox API, check if the token has expired. If so, use the `refresh_token` to get a new `access_token`:

```ts
export async function ensureUpstoxToken(orgId: string) {
  const creds = await getUpstoxCredentials(orgId)
  
  if (!creds) {
    throw new Error('Upstox not connected')
  }
  
  // Check expiry
  const org = await db.query.orgIntegrations.findFirst({
    where: (t, { eq }) => eq(t.orgId, orgId),
  })
  
  if (org && org.expiresAt && new Date() > org.expiresAt) {
    // Refresh
    const tokenResponse = await fetch('https://api.upstox.com/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
        client_id: UPSTOX_CLIENT_ID,
        client_secret: UPSTOX_CLIENT_SECRET,
      }),
    })
    
    const { access_token, refresh_token, expires_in } = await tokenResponse.json()
    await storeUpstoxToken(
      orgId,
      access_token,
      refresh_token,
      new Date(Date.now() + expires_in * 1000)
    )
    
    return access_token
  }
  
  return creds.accessToken
}
```

---

## Admin UI for integrations

**File:** `packages/apps/admin/src/pages/admin/integrations/index.tsx`

List view shows all integration providers per org. Edit modal allows updating `client_id_enc` and `client_secret_enc` (write-only — never display decrypted values).

---

## Environment variables

| Var | Usage | Apps |
|---|---|---|
| `FIELD_ENCRYPTION_KEY` | Encrypts all `_enc` columns (AES-256-GCM) | fintracker, admin, vault |
| `FIELD_ENCRYPTION_KEY_ID` | Key version (default `1`) | fintracker, admin, vault |
| `UPSTOX_CLIENT_ID` | Upstox OAuth app ID | admin, fintracker |
| `UPSTOX_CLIENT_SECRET` | Upstox OAuth secret (server-side only) | admin, fintracker |

**Do not expose secrets to the browser** — keep them server-only in API routes and Next.js middleware.

---

## Related

- `ai/docs/sensitive-field-encryption.md` — key rotation, multi-key support
- `ai/docs/schema-diagram.md` — integration provider & org integration tables
