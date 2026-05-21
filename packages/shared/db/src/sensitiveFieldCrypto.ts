import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32
/** Ciphertext prefix for any DB column storing encrypted sensitive text. */
export const SENSITIVE_FIELD_PREFIX = 'ftenc'
const DEFAULT_KEY_ID = '1'
const SCRYPT_SALT = 'ft-sensitive-field'

function deriveKey(secret: string): Buffer {
  const trimmed = secret.trim()
  if (trimmed.length >= KEY_LEN) {
    return Buffer.from(trimmed.slice(0, KEY_LEN), 'utf8')
  }
  return scryptSync(trimmed, SCRYPT_SALT, KEY_LEN)
}

function envFirst(...names: string[]): string | undefined {
  for (const name of names) {
    const v = process.env[name]?.trim()
    if (v) return v
  }
  return undefined
}

function parseKeysJson(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k.trim()] = v.trim()
    }
    return out
  } catch {
    return {}
  }
}

/**
 * All configured key ids → derived AES key material.
 * Env (preferred → legacy aliases for integrations rollout):
 * - `FIELD_ENCRYPTION_KEYS` / `INTEGRATIONS_ENCRYPTION_KEYS` — JSON map
 * - `FIELD_ENCRYPTION_KEY` / `INTEGRATIONS_ENCRYPTION_KEY` — active key
 * - `FIELD_ENCRYPTION_KEY_ID` / `INTEGRATIONS_ENCRYPTION_KEY_ID`
 * - `FIELD_ENCRYPTION_KEY_PREVIOUS` / `INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS`
 * - `FIELD_ENCRYPTION_KEY_PREVIOUS_ID` / `INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS_ID`
 */
export function getSensitiveFieldEncryptionKeyMap(): Map<string, Buffer> {
  const map = new Map<string, Buffer>()

  const jsonRaw = envFirst('FIELD_ENCRYPTION_KEYS', 'INTEGRATIONS_ENCRYPTION_KEYS')
  if (jsonRaw) {
    for (const [id, secret] of Object.entries(parseKeysJson(jsonRaw))) {
      map.set(id, deriveKey(secret))
    }
  }

  const currentId =
    envFirst('FIELD_ENCRYPTION_KEY_ID', 'INTEGRATIONS_ENCRYPTION_KEY_ID') || DEFAULT_KEY_ID
  const current = envFirst('FIELD_ENCRYPTION_KEY', 'INTEGRATIONS_ENCRYPTION_KEY')
  if (current) {
    map.set(currentId, deriveKey(current))
  }

  const prevId =
    envFirst('FIELD_ENCRYPTION_KEY_PREVIOUS_ID', 'INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS_ID') || '0'
  const prev = envFirst('FIELD_ENCRYPTION_KEY_PREVIOUS', 'INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS')
  if (prev) {
    map.set(prevId, deriveKey(prev))
  }

  return map
}

/** Key id used for new encryptions. */
export function getActiveSensitiveFieldEncryptionKeyId(): string {
  return envFirst('FIELD_ENCRYPTION_KEY_ID', 'INTEGRATIONS_ENCRYPTION_KEY_ID') || DEFAULT_KEY_ID
}

function requireActiveKey(): { keyId: string; key: Buffer } {
  const keyId = getActiveSensitiveFieldEncryptionKeyId()
  const map = getSensitiveFieldEncryptionKeyMap()
  const key = map.get(keyId)
  if (!key) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be set (32+ characters). See docs/sensitive-field-encryption.md',
    )
  }
  return { keyId, key }
}

function encryptWithKey(plaintext: string, keyId: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, enc]).toString('base64url')
  return `${SENSITIVE_FIELD_PREFIX}:${keyId}:${payload}`
}

function decryptPayload(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64url')
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Invalid encrypted sensitive field')
  }
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const data = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * Encrypt a sensitive column value before writing to Postgres.
 * Store in `text` columns (convention: suffix `_enc`, e.g. `client_secret_enc`).
 */
export function encryptSensitiveField(plaintext: string): string {
  if (!plaintext) return ''
  const { keyId, key } = requireActiveKey()
  return encryptWithKey(plaintext, keyId, key)
}

/**
 * Decrypt a sensitive column value after reading from Postgres.
 * Supports versioned `ftenc:<keyId>:…` payloads and legacy raw base64 blobs.
 */
export function decryptSensitiveField(encoded: string | null | undefined): string {
  const trimmed = (encoded ?? '').trim()
  if (!trimmed) return ''

  if (trimmed.startsWith(`${SENSITIVE_FIELD_PREFIX}:`)) {
    const parts = trimmed.split(':')
    if (parts.length < 3) throw new Error('Invalid encrypted sensitive field format')
    const keyId = parts[1]
    const payload = parts.slice(2).join(':')
    const map = getSensitiveFieldEncryptionKeyMap()
    const key = map.get(keyId)
    if (!key) {
      throw new Error(`No FIELD_ENCRYPTION key configured for id "${keyId}"`)
    }
    return decryptPayload(payload, key)
  }

  const map = getSensitiveFieldEncryptionKeyMap()
  const errors: Error[] = []
  for (const [, key] of map) {
    try {
      return decryptPayload(trimmed, key)
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)))
    }
  }
  throw errors[0] ?? new Error('Unable to decrypt sensitive field')
}

/** Re-encrypt with the active key (key rotation). */
export function reencryptSensitiveField(encoded: string): string {
  return encryptSensitiveField(decryptSensitiveField(encoded))
}

/** True if value looks like an encrypted sensitive field (versioned format). */
export function isEncryptedSensitiveField(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith(`${SENSITIVE_FIELD_PREFIX}:`))
}

/** Mask a secret for admin UI (client ids, tokens previews). */
export function maskSensitiveDisplayValue(value: string): string {
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}
