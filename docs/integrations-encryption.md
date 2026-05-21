# Integrations & encryption

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
