# App Migration Guide

## Overview

Migrate existing Fintracker and Vault apps to use shared packages and monorepo structure.

---

## Phase 1: Dependency Updates

### Step 1.1 - Update App package.json

For `packages/apps/fintracker/package.json`:

```json
{
  "name": "fintracker",
  "version": "1.0.0",
  "description": "Financial tracking application",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@fintracker-vault/ui": "workspace:*",
    "@fintracker-vault/types": "workspace:*",
    "@fintracker-vault/config": "workspace:*",
    "@fintracker-vault/utils": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "eslint": "workspace:*",
    "eslint-config-next": "workspace:*",
    "@types/node": "workspace:*",
    "@types/react": "workspace:*",
    "@types/react-dom": "workspace:*",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**Do the same for:** `packages/apps/vault/package.json`

### Step 1.2 - Remove Duplicate Dependencies

**From each app, DELETE:**
- Theme/style packages you moved to shared UI
- Type definition files (now in @fintracker-vault/types)
- Configuration files (now in @fintracker-vault/config)
- Utility packages (now in @fintracker-vault/utils)

---

## Phase 2: Update Tailwind Configuration

### Step 2.1 - App Tailwind Config

**For both apps:** `packages/apps/{app}/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';
import { theme } from '@fintracker-vault/ui';

const config: Config = {
  presets: [theme],
  
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    // Include shared UI components
    '../../packages/shared/ui/**/*.{js,ts,jsx,tsx}',
  ],
  
  theme: {
    extend: {
      // App-specific theme overrides only
      colors: {
        // Can override or extend shared theme
      },
      spacing: {
        // App-specific spacing
      },
    },
  },
  
  plugins: [],
};

export default config;
```

### Step 2.2 - PostCSS Config

**For both apps:** `packages/apps/{app}/postcss.config.js`

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### Step 2.3 - Global Styles

**For both apps:** `packages/apps/{app}/app/globals.css`

```css
@import '@fintracker-vault/ui/styles';

@tailwind base;
@tailwind components;
@tailwind utilities;

/* App-specific styles only */
:root {
  color-scheme: light dark;
}

body {
  font-family: var(--font-sans);
}
```

---

## Phase 3: Import Migration

### Search & Replace Patterns

Use your IDE's find-and-replace to update imports across each app.

#### Pattern 1: Theme Imports

```
FIND:     import.*from.*['\"].*theme['\"]
REPLACE:  import ... from '@fintracker-vault/ui'
```

**Example:**
```typescript
// OLD
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// NEW
import { colors, spacing } from '@fintracker-vault/ui';
```

#### Pattern 2: Type Imports

```
FIND:     import type.*from.*['\"].*types['\"]
REPLACE:  import type ... from '@fintracker-vault/types'
```

**Example:**
```typescript
// OLD
import type { User, Transaction } from '../../types/domain';

// NEW
import type { User, Transaction } from '@fintracker-vault/types';
```

#### Pattern 3: Utility Imports

```
FIND:     import.*from.*['\"].*utils['\"]
REPLACE:  import ... from '@fintracker-vault/utils'
```

**Example:**
```typescript
// OLD
import { formatCurrency } from '../../utils/formatters';
import { isValidEmail } from '../../utils/validators';

// NEW
import { formatCurrency, isValidEmail } from '@fintracker-vault/utils';
```

#### Pattern 4: Config Imports

```
FIND:     import.*from.*['\"].*config['\"]
REPLACE:  import ... from '@fintracker-vault/config'
```

**Example:**
```typescript
// OLD
import { apiConfig } from '../../config/api';

// NEW
import { apiConfig } from '@fintracker-vault/config';
```

### Manual Import Audit

After automated search & replace:

1. Search for `../../` in each app (should be minimal)
2. Check for any remaining relative imports to shared code
3. Verify all imports resolve to `@fintracker-vault/*` namespace

**Command:**
```bash
# Find any remaining relative imports
grep -r "\.\.\/\.\.\/" packages/apps/fintracker/src
grep -r "\.\.\/\.\.\/" packages/apps/vault/src
```

---

## Phase 4: Component Organization

### Step 4.1 - Move App-Specific Components

Keep in app, only import shared components:

**Structure:**
```
packages/apps/fintracker/src/components/
├── TransactionTable.tsx      (app-specific)
├── BalanceCard.tsx           (app-specific)
└── index.ts

packages/apps/vault/src/components/
├── VaultGrid.tsx             (app-specific)
└── index.ts
```

**Component Usage:**
```typescript
// ✅ OK: Import shared UI components
import { Button, Card } from '@fintracker-vault/ui';

// ✅ OK: Import app-specific components
import { TransactionTable } from '@/components';

// ❌ AVOID: Import from sibling app
// import { TransactionTable } from '../../../apps/fintracker/src/components';

// ❌ AVOID: Import theme directly
// import { colors } from '../../../shared/ui/src/theme';
```

### Step 4.2 - Service Layer Organization

Keep API services in app:

```
packages/apps/fintracker/src/services/
├── transactionService.ts
├── accountService.ts
└── index.ts

packages/apps/fintracker/src/api/
├── client.ts           # Shared API client setup
└── index.ts
```

---

## Phase 5: Type Definitions

### Step 5.1 - Remove Duplicate Type Files

Delete from each app:
```
packages/apps/fintracker/src/types/  # DELETE
packages/apps/vault/src/types/        # DELETE
```

### Step 5.2 - Add App-Specific Types

Only keep app-specific type overrides/extensions:

```typescript
// packages/apps/fintracker/src/types/index.ts
import type { Transaction } from '@fintracker-vault/types';

// App-specific extension
export interface FinTrackerTransaction extends Transaction {
  reconciled?: boolean;
  tags?: string[];
}
```

---

## Phase 6: Configuration Updates

### Step 6.1 - Remove Config Files from Apps

Delete:
```
packages/apps/fintracker/config/  # DELETE
packages/apps/vault/config/        # DELETE
```

### Step 6.2 - Use Shared Config

```typescript
// OLD: packages/apps/fintracker/src/services/api.ts
import { apiConfig } from '../../config/api';

// NEW
import { apiConfig } from '@fintracker-vault/config';

const API_BASE = apiConfig.baseURL;
const ENDPOINTS = apiConfig.endpoints;
```

### Step 6.3 - Environment Setup

**Create for each app:** `.env.example`

```bash
# .env.example (in each app root)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Fintracker
NODE_ENV=development
```

---

## Phase 7: TypeScript Configuration

### Step 7.1 - Update App tsconfig.json

For both apps:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".next"]
}
```

### Step 7.2 - Verify Type Resolution

```bash
# Check types resolve correctly
pnpm type-check
```

**Expected output:** No errors

---

## Phase 8: Build Configuration

### Step 8.1 - Update Next.js Config

For both apps: `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Allow importing from shared packages
  transpilePackages: [
    '@fintracker-vault/ui',
    '@fintracker-vault/types',
    '@fintracker-vault/config',
    '@fintracker-vault/utils',
  ],
};

module.exports = nextConfig;
```

---

## Phase 9: Testing & Validation

### Step 9.1 - Install Dependencies

```bash
# From root
pnpm install

# Verify workspaces recognized
pnpm list --depth=0
```

### Step 9.2 - Type Checking

```bash
# Check for TypeScript errors
pnpm type-check

# Should complete with no errors
```

### Step 9.3 - Linting

```bash
# Check code quality
pnpm lint

# Should have no errors, only warnings if any
```

### Step 9.4 - Build Each App

```bash
# Build fintracker
pnpm build:fintracker

# Build vault
pnpm build:vault

# Both should complete successfully
```

### Step 9.5 - Development Testing

```bash
# Test fintracker in dev mode
pnpm dev:fintracker

# In another terminal, test vault
pnpm dev:vault

# Both apps should start without errors
```

---

## Migration Checklist

### Pre-Migration
- [ ] All current tests passing
- [ ] Code committed to git
- [ ] Backup of theme files
- [ ] List of all custom types created

### Directory Structure
- [ ] Created `packages/shared/` with 4 sub-packages
- [ ] Created `packages/apps/fintracker` and `packages/apps/vault`
- [ ] Created `packages/tools/`

### Shared Packages
- [ ] `@fintracker-vault/ui` created and exports theme
- [ ] `@fintracker-vault/types` created with all types
- [ ] `@fintracker-vault/config` created with config
- [ ] `@fintracker-vault/utils` created with utilities

### App Updates
- [ ] Updated `package.json` with workspace dependencies
- [ ] Updated all imports (theme, types, utils, config)
- [ ] Updated `tsconfig.json` to extend root config
- [ ] Updated `next.config.js` to transpile packages
- [ ] Updated `tailwind.config.ts` to use shared theme
- [ ] Removed duplicate files from apps

### Verification
- [ ] `pnpm install` completes successfully
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` completes successfully
- [ ] `pnpm dev:fintracker` starts without errors
- [ ] `pnpm dev:vault` starts without errors
- [ ] Both apps load in browser correctly
- [ ] Shared theme applies to both apps
- [ ] No circular dependencies

---

## Common Issues & Solutions

### Issue 1: Module Not Found Errors

**Problem:** `Cannot find module '@fintracker-vault/ui'`

**Solution:**
1. Verify workspace declarations in root `package.json`
2. Run `pnpm install` from root
3. Check `tsconfig.json` paths configuration
4. Rebuild shared packages: `pnpm run build`

### Issue 2: Type Errors in Apps

**Problem:** Types not resolving from shared packages

**Solution:**
1. Ensure `@fintracker-vault/types` has built output in `dist/`
2. Check `tsconfig.json` extends root config
3. Run `pnpm type-check` to see specific errors
4. Verify imports use correct package names

### Issue 3: Tailwind Not Applying

**Problem:** Styles from shared theme not working in apps

**Solution:**
1. Verify `tailwind.config.ts` uses `presets: [theme]`
2. Check content paths include shared UI: `'../../packages/shared/ui/**/*.{js,ts,jsx,tsx}'`
3. Rebuild: `pnpm run build`
4. Clear Next.js cache: `.next/` and rebuild

### Issue 4: Circular Dependencies

**Problem:** Build fails with circular dependency warning

**Solution:**
1. Run `pnpm deps:check` to identify circular deps
2. Ensure apps don't import from each other
3. Move shared logic to `shared/` packages
4. Use types from `@fintracker-vault/types` only

---

## Post-Migration

### Clean Up Old Code

```bash
# Remove old locations (after verification)
rm -rf old-theme-location/
rm -rf old-types-location/
rm -rf old-utils-location/

# Commit cleanup
git add .
git commit -m "chore: remove old shared code locations"
```

### Update Documentation

- [ ] Update app READMEs with new import patterns
- [ ] Document shared package usage
- [ ] Add troubleshooting guide

### Next Steps

Proceed to **VERCEL_DEPLOYMENT.md** for deployment configuration.
