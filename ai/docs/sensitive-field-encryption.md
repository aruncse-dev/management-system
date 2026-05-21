# Sensitive Field Encryption

Platform-wide AES-256-GCM encryption for **any** database column that stores secrets or PII at rest. One key (with rotation support) for the whole app — not per feature.

---

## Convention

| Practice | Example |
|----------|---------|
| Column name | Suffix `_enc` on `text` columns: `client_secret_enc`, `access_token_enc` |
| Application code | `encryptSensitiveField()` before insert/update; `decryptSensitiveField()` after select |
| Never send decrypted values to the browser | Admin forms: write-only secret fields; list views use masking only |

---

## Current protected columns

| Table | Column | Contents |
|-------|--------|----------|
| `integration_providers` | `client_secret_enc` | OAuth client secret |
| `org_integrations` | `access_token_enc` | OAuth access token |
| `org_integrations` | `refresh_token_enc` | OAuth refresh token |
| `vault_apps` | `password_enc` | App password |
| `banking_records` | `account_number_enc` | Bank account number |

---

## Generating a key

```bash
openssl rand -base64 32
```

Output example: `rZ8n7QxPvL2mK9bDf3xJwEsRh5cV6aYnU1pWqJ0tMz4=`

---

## Environment setup

Set on **every** app that reads/writes encrypted columns (fintracker, admin, vault):

```env
FIELD_ENCRYPTION_KEY=rZ8n7QxPvL2mK9bDf3xJwEsRh5cV6aYnU1pWqJ0tMz4=
FIELD_ENCRYPTION_KEY_ID=1
```

Legacy names still work (`INTEGRATIONS_ENCRYPTION_KEY`, etc.) but prefer `FIELD_*` for clarity.

---

## Using in code

### Encrypting (write)

```ts
import { encryptSensitiveField } from '@fintracker-vault/db'

await db.insert(vaultApps).values({
  apiPasswordEnc: encryptSensitiveField(plaintext),
})
```

### Decrypting (read)

```ts
import { decryptSensitiveField } from '@fintracker-vault/db'

const rows = await db.select().from(vaultApps).where(...)
const plaintext = decryptSensitiveField(row.apiPasswordEnc)
```

Always decrypt **after** selecting from DB; never decrypt in SQL queries.

---

## Schema: adding an encrypted column

```sql
-- Migration: 20260521_add_api_key_to_vault_apps.sql
ALTER TABLE vault_apps ADD COLUMN IF NOT EXISTS api_key_enc text;
```

Drizzle schema:

```ts
apiKeyEnc: text('api_key_enc'), // nullable text; do not set a default
```

---

## Ciphertext format

```
ftenc:<keyId>:<base64url(iv + authTag + ciphertext)>
```

Example:
```
ftenc:1:aBc1De2Fg3hI4jK5lM6nO7pQ8rS9tU0vWxYz1A2b3C4dE5fG6hI7jK8lM9nO0pQ==
```

- `keyId` = version from `FIELD_ENCRYPTION_KEY_ID` (allows multi-key rotation)
- `iv` = random 12-byte initialization vector
- `authTag` = GCM authentication tag (16 bytes)
- `ciphertext` = encrypted plaintext

---

## Key rotation

### Single-key rotation (no multi-key support yet)

1. Generate new key:
   ```bash
   openssl rand -base64 32
   ```

2. Deploy with both old and new keys:
   ```env
   FIELD_ENCRYPTION_KEY=<new>
   FIELD_ENCRYPTION_KEY_ID=2
   FIELD_ENCRYPTION_KEY_PREVIOUS=<old>
   FIELD_ENCRYPTION_KEY_PREVIOUS_ID=1
   ```

3. Re-encrypt all values (script or manual update):
   ```ts
   // Pseudo-code
   const oldKey = process.env.FIELD_ENCRYPTION_KEY_PREVIOUS
   const newKey = process.env.FIELD_ENCRYPTION_KEY
   
   for (const row of allRows) {
     const plaintext = decryptWithKey(row.field_enc, oldKey)
     const newCiphertext = encryptWithKey(plaintext, newKey)
     await db.update(table).set({ field_enc: newCiphertext })...
   }
   ```

4. Once all values start with `ftenc:2:`, remove `*_PREVIOUS` env vars.

### Multiple historical keys

For more complex rotation (if supported in future):

```env
FIELD_ENCRYPTION_KEYS={"0":"<oldest>","1":"<old>","2":"<current>"}
FIELD_ENCRYPTION_KEY=<current>
FIELD_ENCRYPTION_KEY_ID=2
```

The library checks `keyId` in the ciphertext and uses the matching key from `FIELD_ENCRYPTION_KEYS`.

---

## Security considerations

- **Key storage:** Use Vercel Secrets, .env files (dev only), or secure vaults — never commit keys to git
- **HTTPS only:** All transmitted values must be over TLS
- **No logging:** Never log plaintext values; redact in debug logs
- **Algorithm:** AES-256-GCM — NIST standard, authenticated encryption
- **Randomness:** IV is cryptographically random per-encryption — never reuse
- **Database**: Encryption is app-layer, portable across any Postgres provider (Neon, local, etc.)

---

## Decryption errors

If `decryptSensitiveField()` fails:

1. **"Cannot decrypt"** → key mismatch (used wrong key id)
2. **"Invalid ciphertext"** → data corruption or wrong key
3. **"Missing key"** → `FIELD_ENCRYPTION_KEY` not set in env

Always handle gracefully; never expose error details to the client.

---

## Testing

```ts
import { encryptSensitiveField, decryptSensitiveField } from '@fintracker-vault/db'

it('should encrypt and decrypt', () => {
  const plaintext = 'secret123'
  const encrypted = encryptSensitiveField(plaintext)
  expect(encrypted).toMatch(/^ftenc:\d+:/)
  
  const decrypted = decryptSensitiveField(encrypted)
  expect(decrypted).toBe(plaintext)
})
```

---

## Related

- `ai/docs/integrations-encryption.md` — OAuth token encryption example
- `packages/shared/db/src/integrationCrypto.ts` — implementation
- `ai/docs/schema-diagram.md` — all `_enc` columns
