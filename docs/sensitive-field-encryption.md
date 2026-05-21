# Sensitive field encryption (`FIELD_ENCRYPTION_KEY`)

Platform-wide AES-256-GCM encryption for **any** database column that stores secrets or PII at rest. One key (with rotation support) for the whole app—not per feature.

## Convention

| Practice | Example |
|----------|---------|
| Column name | Suffix `_enc` on `text` columns: `client_secret_enc`, `access_token_enc` |
| Application code | `encryptSensitiveField()` before insert/update; `decryptSensitiveField()` after select |
| Never send decrypted values to the browser | Admin forms: write-only secret fields; list views use masking only |

### Current protected columns

| Table | Column | Contents |
|-------|--------|----------|
| `integration_providers` | `client_secret_enc` | OAuth client secret |
| `org_integrations` | `access_token_enc` | OAuth access token |

Add new protected columns by calling the same helpers—no new env vars.

## Generate a key

```bash
openssl rand -base64 32
```

Set on **every** app that reads/writes encrypted columns (FinTracker, Admin, future workers):

```env
FIELD_ENCRYPTION_KEY=<paste output here>
FIELD_ENCRYPTION_KEY_ID=1
```

Legacy names still work (`INTEGRATIONS_ENCRYPTION_KEY`, etc.) but prefer `FIELD_*` for new deployments.

## Rotating the key

1. `openssl rand -base64 32`
2. Deploy with both keys:

```env
FIELD_ENCRYPTION_KEY=<new>
FIELD_ENCRYPTION_KEY_ID=2
FIELD_ENCRYPTION_KEY_PREVIOUS=<old>
FIELD_ENCRYPTION_KEY_PREVIOUS_ID=1
```

3. Re-encrypt rows (re-save secrets in Admin, or batch script using `reencryptSensitiveField` from `@fintracker-vault/db`).
4. Remove `*_PREVIOUS*` when all values start with `ftenc:2:` (or your new id).

### Multiple historical keys

```env
FIELD_ENCRYPTION_KEYS={"0":"<oldest>","1":"<old>","2":"<current>"}
FIELD_ENCRYPTION_KEY=<current>
FIELD_ENCRYPTION_KEY_ID=2
```

## Ciphertext format

```
ftenc:<keyId>:<base64url(iv + authTag + ciphertext)>
```

Decrypt uses `<keyId>` to pick the right material from env.

## Using in new tables

```ts
import { encryptSensitiveField, decryptSensitiveField } from '@fintracker-vault/db'

// write
await db.insert(myTable).values({
  apiKeyEnc: encryptSensitiveField(apiKey),
})

// read
const apiKey = decryptSensitiveField(row.apiKeyEnc)
```

Schema: use nullable `text` for `_enc` columns; do not rely on DB-level encryption for app secrets—this app-layer encryption is intentional and portable across Neon/local.

## Related

- [Integrations setup](./integrations-encryption.md) — Upstox OAuth flow using these columns
