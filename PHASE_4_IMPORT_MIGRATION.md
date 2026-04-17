# Phase 4: Import Migration Guide

## Status
✅ Config files created (tailwind, postcss)
⏳ Import updates needed (manual or automated)

## What to do

### 1. Migrate UI Imports
In `packages/apps/fintracker/app` and `packages/apps/vault/app`:

```typescript
// OLD
import { LoadingState, Card } from '../src/ui-kit'

// NEW  
import { LoadingState, Card } from '@fintracker-vault/ui'
```

### 2. Migrate Type Imports
```typescript
// OLD
import type { Transaction } from '../src/types'

// NEW
import type { Transaction } from '@fintracker-vault/types'
```

### 3. Migrate Config Imports
```typescript
// OLD
import { CATEGORIES, ACCOUNTS } from '../src/constants'

// NEW
import { CATEGORIES, ACCOUNTS } from '@fintracker-vault/config'
```

## Using IDE Find & Replace

**VS Code:**
1. Open both app folders
2. Use Find & Replace (Ctrl+H)
3. Check "Use Regular Expression"
4. Apply patterns from `plan/APP_MIGRATION.md`

**Patterns:**
```
Find:    import.*from ['\"]([^'\"]*)(ui-kit|types|constants|utils)['\"]
Replace: import from '@fintracker-vault/$2'
```

## Next Steps

1. Run imports migration (IDE or manual)
2. `pnpm install`
3. `pnpm type-check`
4. `pnpm build`
5. `pnpm dev:fintracker` & `pnpm dev:vault`
6. Commit with: `git commit -m "Phase 4: Migrate app imports to shared packages"`

## Files Updated This Session
- ✅ packages/apps/fintracker/tailwind.config.ts
- ✅ packages/apps/fintracker/postcss.config.js
- ✅ packages/apps/vault/tailwind.config.ts
- ✅ packages/apps/vault/postcss.config.js
