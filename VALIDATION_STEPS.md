# Validation Steps for Fintracker Migration (Session 2)

## What Changed
- ✅ Step 1: Utilities extracted to `@fintracker-vault/utils` (committed: 742e37c)
- ✅ Step 2: 15 fintracker pages migrated to `packages/apps/fintracker/src/pages/` (committed: 09e7baa)
- ✅ Step 3: 9 fintracker components copied to `packages/apps/fintracker/src/components/` (ready to commit)

## Validation Checklist

### ✅ Code Changes
- [x] All page imports updated: `../utils` → `@fintracker-vault/utils`
- [x] All page imports updated: `../constants` → `@fintracker-vault/config`
- [x] All page imports updated: `../ui-kit` → `@fintracker-vault/ui`
- [x] All page imports updated: `../types` → `@fintracker-vault/types`
- [x] All component imports updated with same patterns
- [x] Relative imports preserved: `../components/`, `../store`, `../api`, `../hooks`

### 📋 Steps to Validate (Run in terminal)

**1. Install dependencies** (may take 5-10 min)
```bash
cd /Users/arunkumar/Documents/Development/Personal\ Projects/fintracker
pnpm install
```

**2. Type check (detects import errors)**
```bash
pnpm type-check
# Or specific to fintracker:
cd packages/apps/fintracker && pnpm type-check
```

**3. Build fintracker app**
```bash
pnpm build:fintracker
# Or:
cd packages/apps/fintracker && pnpm build
```

**4. Test in dev mode** (requires browser)
```bash
pnpm dev:fintracker
# Visit http://localhost:3000/dashboard (or configured port)
```

**5. Verify pages load**
- Dashboard: Should show KPI cards, trends
- Monthly: Should show transaction list
- Transactions: Should show filtered transactions
- Accounts: Should show account balances

### 🔍 What Could Go Wrong

| Issue | Cause | Fix |
|-------|-------|-----|
| `Cannot find module '@fintracker-vault/utils'` | Missing pnpm install or path alias issue | Run `pnpm install && pnpm type-check` |
| `../api not found` | api.ts not copied from web | Copy web/src/api.ts to fintracker app |
| `../store not found` | store/ not in fintracker app | Copy web/src/store/ to fintracker app |
| Page loads blank | Missing layout or routing config | Check if fintracker app has proper Next.js setup |

### 📝 Import Patterns Applied

All 15 pages + 9 components updated from:
```typescript
// OLD
import { INR } from '../utils'
import { CATEGORIES } from '../constants'
import { KpiCard } from '../ui-kit'

// NEW
import { INR } from '@fintracker-vault/utils'
import { CATEGORIES } from '@fintracker-vault/config'
import { KpiCard } from '@fintracker-vault/ui'
```

### ✨ Expected Result After Validation
- [ ] pnpm install completes
- [ ] pnpm type-check passes (0 errors)
- [ ] pnpm build:fintracker succeeds
- [ ] pnpm dev:fintracker starts without errors
- [ ] Pages load in browser at http://localhost:3000/*

---

**Next Phase:** Phase 5 (Vercel deployment) after validation passes
