# Comprehensive Migration Plan: Fintracker & Vault

**Created:** 2026-04-17  
**Status:** Planning & Analysis Complete  
**Ready for:** Execution in next session

---

## App Structure Analysis

### Current Setup: Monolithic `web/` directory
```
web/src/
├── pages/                # 20+ pages (mixed fintracker & vault)
├── components/           # Reusable components
├── ui-kit/              # Custom UI components
├── styles/              # CSS files
├── utils.ts             # Common utilities (137 lines)
├── types.ts             # Type definitions
├── constants.ts         # Constants
└── other files
```

### Target: Separate Next.js Apps

```
packages/apps/
├── fintracker/          # Finance app only
│   ├── app/             # Next.js app router
│   └── src/
│       ├── components/  # Fintracker-specific
│       ├── pages/       # Only fintracker pages
│       └── ...
└── vault/               # Data vault app only
    ├── app/
    └── src/
        ├── components/
        ├── pages/       # Only vault pages
        └── ...
```

---

## Page Mapping

### FINTRACKER Pages (Finance App)
```
Monthly.tsx           → Finance tracking (primary)
Transactions.tsx      → Transaction list
Budget.tsx            → Budget management
Accounts.tsx          → Account management
Dashboard.tsx         → Overview
Monthly.tsx           → Monthly analytics
Lending.tsx           → Lending tracking
Savings.tsx           → Savings goals
SavingsPage.tsx       → Savings details
Loans.tsx             → Loan management
Investments.tsx       → Investment tracking
Stocks.tsx            → Stock portfolio
MutualFunds.tsx       → Mutual fund tracking
Gold.tsx              → Gold investment
Settings.tsx          → App settings
Components.tsx        → UI component showcase
```

### VAULT Pages (Data Vault App)
```
Vault.tsx             → Main vault (secure storage)
VaultApps.tsx         → App integrations
VaultInsurance.tsx    → Insurance management
VaultSettings.tsx     → Vault settings
Bommi.tsx             → Lending tracker (personal)
```

---

## Shared Code to Move

### 1. Styles → @fintracker-vault/ui
**Files to move:**
- `web/src/ui-kit/ui-kit.css` ✅ (already done)
- `web/src/styles/globals.css` ✅ (already done)

**Status:** Complete in Phase 3

### 2. Utilities → @fintracker-vault/utils
**From:** `web/src/utils.ts` (137 lines)

**Functions to migrate:**
```typescript
INR(n: number)                    // Format as Indian Rupee
fd(s: string)                     // Date formatter
isoDate(s: string)                // Convert to ISO date
dateKey(s: string)                // Generate date key
monthInfo(m: string, y: string)   // Month information
groupByKey()                       // Grouping utilities
// ... others from file
```

**Target:** `packages/shared/utils/src/formatters/` + `validators/` + `calculations/`

### 3. Types → @fintracker-vault/types
**From:** `web/src/types.ts`

**Current types (already migrated):**
```typescript
Transaction
MonthRef
Budget
OpeningBal
AppState
TransactionForm
```

### 4. Constants → @fintracker-vault/config
**From:** `web/src/constants.ts`

**Constants to move:**
```typescript
ACCOUNTS, CC_MODES, OTHER_CR, ALL_CR, MNS
CATEGORIES, INCOME_CATS, ALL_MODES
THEME_COLORS, DECOR_COLORS
CR_COLORS, decorColor(), withAlpha()
```

✅ **Status:** Already in Phase 3

---

## Components Strategy

### Shared Components (→ @fintracker-vault/ui)
- All components in `web/src/ui-kit/` ✅ (already done)
- Reusable UI patterns (forms, cards, tables)

### App-Specific Components
- **Fintracker:** Finance-specific (TransactionTable, BudgetCard, etc.)
  - Move to `packages/apps/fintracker/src/components/`
- **Vault:** Vault-specific (SecureStorage, VaultItems, etc.)
  - Move to `packages/apps/vault/src/components/`

---

## Step-by-Step Execution Plan

### Step 1: Extract Utilities (2-3 hours)
```bash
# 1. Read web/src/utils.ts completely
# 2. Categorize functions by type:
   - Formatters (INR, fd, isoDate, dateKey)
   - Calculations (monthInfo, groupByKey, etc.)
   - Validators (if any)
   - Helpers (other utilities)

# 3. Create in packages/shared/utils/src/:
   packages/shared/utils/src/
   ├── formatters/
   │   ├── date.ts
   │   ├── currency.ts
   │   └── index.ts
   ├── validators/
   │   └── index.ts
   ├── calculations/
   │   └── index.ts
   └── index.ts

# 4. Move functions with proper exports
# 5. Update package.json exports
# 6. Test: pnpm type-check
```

### Step 2: Migrate Fintracker App (4-5 hours)
```bash
# 1. Create fintracker app structure
   mkdir -p packages/apps/fintracker/src/{pages,components}

# 2. Move fintracker-only pages:
   Monthly.tsx, Transactions.tsx, Budget.tsx, Accounts.tsx,
   Dashboard.tsx, Lending.tsx, Savings.tsx, SavingsPage.tsx,
   Loans.tsx, Investments.tsx, Stocks.tsx, MutualFunds.tsx,
   Gold.tsx, Settings.tsx, Components.tsx

# 3. Extract fintracker-specific components from web/src/components/
# 4. Update all imports to use @fintracker-vault/*
# 5. Move any fintracker styles to app directory
# 6. Create fintracker-specific utils if needed
# 7. Test: pnpm build:fintracker && pnpm dev:fintracker
```

### Step 3: Migrate Vault App (3-4 hours)
```bash
# 1. Create vault app structure
   mkdir -p packages/apps/vault/src/{pages,components}

# 2. Move vault-only pages:
   Vault.tsx, VaultApps.tsx, VaultInsurance.tsx,
   VaultSettings.tsx, Bommi.tsx

# 3. Extract vault-specific components
# 4. Update all imports to @fintracker-vault/*
# 5. Move vault styles
# 6. Test: pnpm build:vault && pnpm dev:vault
```

### Step 4: Clean Up (2-3 hours)
```bash
# 1. Remove web/src/pages/ (moved to apps)
# 2. Remove web/src/utils.ts (moved to shared)
# 3. Remove web/src/types.ts (moved to shared)
# 4. Remove web/src/constants.ts (moved to shared)
# 5. Remove web/src/ui-kit/ (moved to shared)
# 6. Remove web/src/styles/ (moved to shared)
# 7. Remove unused/duplicate files
# 8. Final cleanup: pnpm clean && pnpm install
```

### Step 5: Verification (2-3 hours)
```bash
# 1. Type check all packages: pnpm type-check
# 2. Build all: pnpm build
# 3. Test both apps: pnpm dev:fintracker & pnpm dev:vault
# 4. Browser testing: verify all pages work
# 5. Commit: Per-step commits
```

---

## Import Patterns After Migration

### ✅ Correct Imports

**Shared UI:**
```typescript
import { Button, Card, LoadingState } from '@fintracker-vault/ui'
```

**Shared Types:**
```typescript
import type { Transaction, Budget } from '@fintracker-vault/types'
```

**Shared Config:**
```typescript
import { CATEGORIES, ACCOUNTS, INR } from '@fintracker-vault/config'
```

**Shared Utils:**
```typescript
import { formatDate, formatCurrency, decorColor } from '@fintracker-vault/utils'
```

**App-Specific:**
```typescript
import { TransactionTable } from '@/components'  // Inside fintracker app
import { VaultItemCard } from '@/components'    // Inside vault app
```

### ❌ Avoid

```typescript
// Cross-app imports
import { TransactionTable } from '../../../packages/apps/fintracker/src'

// Relative imports from shared
import { INR } from '../../../../shared/utils/src'

// Wrong path aliases
import { X } from 'src/components'  // Only in app context
```

---

## Cleanup Checklist

### Code Quality
- [ ] Remove all `any` types
- [ ] Update imports in ALL files
- [ ] Fix all TypeScript errors
- [ ] Remove console.logs (except debug)
- [ ] Remove commented code

### Files to Delete (after migration)
- [ ] `web/src/pages/` (moved to apps)
- [ ] `web/src/utils.ts` (moved to shared)
- [ ] `web/src/types.ts` (moved to shared)
- [ ] `web/src/constants.ts` (moved to shared)
- [ ] `web/src/ui-kit/` (moved to shared)
- [ ] `web/src/styles/` (moved to shared)
- [ ] Duplicate component files
- [ ] Unused dependencies in package.json

### Testing
- [ ] `pnpm type-check` - no errors
- [ ] `pnpm build` - succeeds
- [ ] `pnpm dev:fintracker` - starts & works
- [ ] `pnpm dev:vault` - starts & works
- [ ] All pages load correctly
- [ ] UI styling intact
- [ ] No console errors

---

## Risk Mitigation

### Potential Issues & Solutions

**Issue:** Import cycles
- **Solution:** Run `pnpm type-check` frequently

**Issue:** Missing exports
- **Solution:** Check barrel exports (index.ts) in shared packages

**Issue:** Style conflicts
- **Solution:** Test both apps in dev mode

**Issue:** Forgotten files
- **Solution:** Use grep to find references before deletion

---

## Time Estimate

| Phase | Task | Duration | Total |
|-------|------|----------|-------|
| 1 | Extract utilities to shared | 2-3h | 2-3h |
| 2 | Migrate fintracker app | 4-5h | 6-8h |
| 3 | Migrate vault app | 3-4h | 9-12h |
| 4 | Clean up & remove duplicates | 2-3h | 11-15h |
| 5 | Verify & test | 2-3h | 13-18h |

**Total: 13-18 hours (can be done in 2-3 focused sessions)**

---

## Next Session Action Items

1. **Start Step 1:** Extract utils.ts
2. **Create:** Formatter/validator/calculation modules in shared/utils
3. **Test:** Ensure utilities work in isolation
4. **Commit:** Clean, focused commits per function group
5. **Continue:** Step 2 (Fintracker migration)

---

**Status:** Ready for Execution 🚀  
**Session:** 1 complete (planning) | 2-3 remaining (implementation)
