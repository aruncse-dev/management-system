/**
 * @deprecated Import from `./sensitiveFieldCrypto` or `@fintracker-vault/db` generic exports.
 * Kept for backward compatibility during integrations rollout.
 */
export {
  SENSITIVE_FIELD_PREFIX,
  decryptSensitiveField as decryptIntegrationSecret,
  encryptSensitiveField as encryptIntegrationSecret,
  getActiveSensitiveFieldEncryptionKeyId as getActiveIntegrationEncryptionKeyId,
  getSensitiveFieldEncryptionKeyMap as getIntegrationEncryptionKeyMap,
  maskSensitiveDisplayValue as maskClientId,
  reencryptSensitiveField as reencryptIntegrationSecret,
} from './sensitiveFieldCrypto'
