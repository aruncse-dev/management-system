# Monorepo Migration & Setup Plan
**Optimized for Code Agent Reusability | Token-Efficient Documentation**

---

## Phase Overview

| Phase | Steps | Duration | Token Cost |
|-------|-------|----------|-----------|
| **Phase 1** | Directory structure creation | 1-2 hours | Low |
| **Phase 2** | Package.json configuration | 1-2 hours | Low |
| **Phase 3** | Shared packages setup | 2-3 hours | Medium |
| **Phase 4** | App migration | 3-4 hours | Medium |
| **Phase 5** | Vercel deployment setup | 1-2 hours | Low |
| **Phase 6** | CI/CD & testing | 2-3 hours | Medium |

**Total Estimated: 10-16 hours | Low-Medium Token Usage**

---

## PHASE 1: Directory Structure Creation

### Step 1.1 - Create Root Monorepo Structure
```bash
# Current state: Unorganized repo with submodules
# Target state: Clean monorepo structure

ROOT/
├── packages/
│   ├── shared/
│   ├── apps/
│   └── tools/
├── .github/workflows/
└── vercel.json
```

**Action Items:**
1. Create `packages/` directory at root
2. Create `packages/shared/` subdirectories:
   - `packages/shared/ui/`
   - `packages/shared/types/`
   - `packages/shared/config/`
   - `packages/shared/utils/`
3. Create `packages/apps/` subdirectories:
   - `packages/apps/fintracker/`
   - `packages/apps/vault/`
4. Create `packages/tools/` with:
   - `packages/tools/scripts/`
   - `packages/tools/configs/`

### Step 1.2 - Migrate Existing Apps
**For both Fintracker & Vault:**
1. Move app code to `packages/apps/{app-name}/`
2. Preserve current structure inside:
   - Keep `app/` directory (Next.js 13+)
   - Keep `src/` directory
   - Keep `public/` directory
3. Do NOT delete original location yet (safety check phase)

### Step 1.3 - Extract & Centralize UI Theme
**From current theme location:**
1. Identify all theme files (colors, typography, spacing, etc.)
2. Copy to `packages/shared/ui/src/theme/`
3. Create `packages/shared/ui/src/components/` with reusable components
4. Document all theme exports

**Reference Files:**
- See: `DIRECTORY_STRUCTURE.md`

---

## PHASE 2: Package.json Configuration

### Step 2.1 - Root Package.json
**Create at root with:**
- Workspace declarations (npm/pnpm/yarn)
- Root-level dev dependencies (prettier, eslint, typescript, turbo)
- Scripts for monorepo commands (dev, build, lint, test)

**Use Template:**
- See: `PACKAGE_CONFIG.md` → Root package.json section

### Step 2.2 - Shared Packages Configuration
**For each shared package (ui, types, config, utils):**
1. Create `package.json` with proper naming: `@fintracker-vault/{package-name}`
2. Set `"private": false` (publishable)
3. Define build scripts
4. Add peer dependencies (don't duplicate main deps)

**Use Template:**
- See: `PACKAGE_CONFIG.md` → Shared Packages section

### Step 2.3 - App Package Configuration
**For each app (fintracker, vault):**
1. Update `package.json` with workspace references
2. Replace direct imports with `@fintracker-vault/*` imports
3. Add dependency on `@fintracker-vault/ui` (shared theme)
4. Set `"private": true`

**Use Template:**
- See: `PACKAGE_CONFIG.md` → Apps section

### Step 2.4 - Package Manager Configuration
**Create `.npmrc` (or pnpm-workspace.yaml if using pnpm):**
- Enable workspaces
- Set registry
- Configure peer dependency behavior

**Use Template:**
- See: `PACKAGE_CONFIG.md` → Package Manager section

---

## PHASE 3: Shared Packages Setup

### Step 3.1 - Setup `@fintracker-vault/ui`
**Files to create:**
1. `packages/shared/ui/src/theme/index.ts` - Theme object export
2. `packages/shared/ui/src/components/index.ts` - Component barrel exports
3. `packages/shared/ui/src/hooks/index.ts` - Theme hooks
4. `packages/shared/ui/tsconfig.json` - TypeScript config
5. `packages/shared/ui/package.json` - Package definition

**Key Actions:**
- Copy existing theme → `packages/shared/ui/src/theme/`
- Create reusable component library
- Export everything via index files (barrel pattern)
- Add build script (tsc + tsup)

**Use Template:**
- See: `SHARED_PACKAGES_SETUP.md` → UI Package section

### Step 3.2 - Setup `@fintracker-vault/types`
**Files to create:**
1. `packages/shared/types/src/api.ts` - API response types
2. `packages/shared/types/src/domain.ts` - Business domain types
3. `packages/shared/types/src/common.ts` - Common types
4. `packages/shared/types/src/index.ts` - Barrel export
5. Configuration files (tsconfig.json, package.json)

**Key Actions:**
- Extract all shared TypeScript types from both apps
- Create domain-specific type files
- Use strict typing from day 1

**Use Template:**
- See: `SHARED_PACKAGES_SETUP.md` → Types Package section

### Step 3.3 - Setup `@fintracker-vault/config`
**Files to create:**
1. `packages/shared/config/src/env.ts` - Environment variables
2. `packages/shared/config/src/api.ts` - API endpoints config
3. `packages/shared/config/src/index.ts` - Barrel export
4. Configuration files

**Key Actions:**
- Centralize all configuration
- Use environment-aware config
- Export config object for consumption

**Use Template:**
- See: `SHARED_PACKAGES_SETUP.md` → Config Package section

### Step 3.4 - Setup `@fintracker-vault/utils`
**Files to create:**
1. `packages/shared/utils/src/formatters/` - Formatting utilities
2. `packages/shared/utils/src/validators/` - Validation utilities
3. `packages/shared/utils/src/calculations/` - Business logic
4. `packages/shared/utils/src/index.ts` - Barrel export

**Key Actions:**
- Move common utility functions
- Test utilities independently
- Keep utilities pure & testable

**Use Template:**
- See: `SHARED_PACKAGES_SETUP.md` → Utils Package section

### Step 3.5 - Create tsconfig Base
**File:** `packages/tools/configs/tsconfig/base.json`

**Purpose:**
- Single source of truth for TypeScript config
- Apps and shared packages extend this
- Ensures consistency across monorepo

**Use Template:**
- See: `TYPESCRIPT_CONFIG.md`

---

## PHASE 4: App Migration

### Step 4.1 - Update App Dependencies
**For both apps:**
1. Remove duplicate dependencies (now in shared packages)
2. Add workspace references:
   ```json
   "@fintracker-vault/ui": "workspace:*",
   "@fintracker-vault/types": "workspace:*",
   "@fintracker-vault/config": "workspace:*",
   "@fintracker-vault/utils": "workspace:*"
   ```
3. Run `npm install` / `pnpm install` at root

### Step 4.2 - Update App Imports
**For both apps:**
1. Replace theme imports → `@fintracker-vault/ui`
2. Replace type imports → `@fintracker-vault/types`
3. Replace config imports → `@fintracker-vault/config`
4. Replace util imports → `@fintracker-vault/utils`
5. Remove any `../../` relative imports to shared code

**Search & Replace Pattern:**
```
OLD: import { Theme } from '../../shared/theme'
NEW: import { Theme } from '@fintracker-vault/ui'
```

### Step 4.3 - Update Tailwind Configuration
**For both apps:**
1. Extend shared theme in `tailwind.config.ts`:
   ```ts
   import { theme } from '@fintracker-vault/ui/theme'
   
   export default {
     presets: [theme],
     theme: {
       extend: {
         // App-specific overrides
       }
     }
   }
   ```

### Step 4.4 - Test App Builds
**For each app separately:**
```bash
npm run build:fintracker
npm run build:vault
```

**Success Criteria:**
- ✅ No build errors
- ✅ No import resolution errors
- ✅ All types resolved correctly

**Use Template:**
- See: `APP_MIGRATION.md`

---

## PHASE 5: Vercel Deployment Setup

### Step 5.1 - Create Vercel Configuration
**File:** `vercel.json` (at root)

**Purpose:**
- Configure monorepo detection
- Set build/output directories per app
- Define environment variables per app

**Use Template:**
- See: `VERCEL_DEPLOYMENT.md` → vercel.json section

### Step 5.2 - Create Deployment Scripts
**File:** `package.json` scripts

**Add:**
```json
"build:fintracker": "turbo run build --scope=fintracker",
"build:vault": "turbo run build --scope=vault"
```

### Step 5.3 - Set Vercel Project Settings
**For each app deployment:**
1. Connect repo to Vercel
2. Set root directory: `packages/apps/fintracker`
3. Set build command: `npm run build:fintracker`
4. Set output directory: `.next`
5. Configure environment variables

**Use Template:**
- See: `VERCEL_DEPLOYMENT.md` → Setup Instructions section

### Step 5.4 - Test Deployments
**For each app:**
```bash
npm run build:fintracker
npm run build:vault
```

**Success Criteria:**
- ✅ Builds complete without errors
- ✅ Output files in correct location

**Use Template:**
- See: `VERCEL_DEPLOYMENT.md`

---

## PHASE 6: CI/CD & Testing

### Step 6.1 - Setup GitHub Actions
**Create workflow files:**
1. `.github/workflows/ci.yml` - Linting & testing
2. `.github/workflows/deploy-fintracker.yml` - Deploy fintracker
3. `.github/workflows/deploy-vault.yml` - Deploy vault

**Workflows should:**
- Run on PR & push to main
- Use `turbo` for caching
- Only deploy affected apps

**Use Template:**
- See: `CI_CD_SETUP.md`

### Step 6.2 - Setup Turbo Caching
**File:** `turbo.json`

**Purpose:**
- Cache build artifacts
- Skip rebuild of unchanged packages
- Speed up CI/CD

**Use Template:**
- See: `TURBO_CONFIG.md`

### Step 6.3 - Test Full Pipeline
**Local test:**
```bash
npm run clean
npm install
npm run lint
npm run type-check
npm run build
```

**Success Criteria:**
- ✅ All commands pass
- ✅ Zero errors or warnings
- ✅ Build output is correct

### Step 6.4 - Setup Branch Protection
**GitHub repo settings:**
1. Require CI checks to pass
2. Require code review
3. Enforce up-to-date branches

**Use Template:**
- See: `CI_CD_SETUP.md` → Branch Protection section

---

## Validation Checklist

### Post-Migration Validation

**Directory Structure:**
- [ ] `packages/shared/ui/` exists with theme
- [ ] `packages/shared/types/` exists with types
- [ ] `packages/shared/config/` exists
- [ ] `packages/shared/utils/` exists
- [ ] `packages/apps/fintracker/` exists
- [ ] `packages/apps/vault/` exists

**Dependencies:**
- [ ] Root `package.json` has workspaces config
- [ ] All shared packages have proper naming (`@fintracker-vault/*`)
- [ ] Apps import from shared packages only
- [ ] No sibling app imports
- [ ] No duplicate dependencies across apps

**Builds:**
- [ ] `npm run build` completes successfully
- [ ] `npm run build:fintracker` builds fintracker
- [ ] `npm run build:vault` builds vault
- [ ] No TypeScript errors in any workspace

**Deployments:**
- [ ] Fintracker deploys to Vercel
- [ ] Vault deploys to Vercel
- [ ] Both apps use shared theme
- [ ] Both apps load correctly in production

**Code Quality:**
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] All PRs require CI to pass

---

## Document Cross-References

**For detailed implementation, consult:**
1. `DIRECTORY_STRUCTURE.md` - Complete folder layout
2. `PACKAGE_CONFIG.md` - All package.json configurations
3. `SHARED_PACKAGES_SETUP.md` - Creating shared packages
4. `APP_MIGRATION.md` - Moving apps to monorepo
5. `VERCEL_DEPLOYMENT.md` - Deploying to Vercel
6. `CI_CD_SETUP.md` - GitHub Actions workflows
7. `TYPESCRIPT_CONFIG.md` - TypeScript configuration
8. `TURBO_CONFIG.md` - Build caching setup
9. `DEVELOPMENT.md` - Developer workflow
10. `CONTRIBUTING.md` - Contribution guidelines

---

## Code Agent Instructions

**When implementing this plan:**

1. **Read this file first** (you're here) - Understand the full plan
2. **Follow phases sequentially** - Don't skip steps
3. **Use token-efficient templates** - Reference markdown files, don't rewrite
4. **Validate after each phase** - Check success criteria
5. **Ask for clarification** - If any step is unclear
6. **Document decisions** - Add to `ARCHITECTURE.md`

**To reduce token usage:**
- Read templates only when needed
- Use search & replace for large migrations
- Break work into small commits
- Reference this plan, don't regenerate it

---

## Quick Reference Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm run dev              # All apps
pnpm run dev:fintracker  # Specific app
pnpm run dev:vault       # Specific app

# Building
pnpm run build            # All apps
pnpm run build:fintracker
pnpm run build:vault

# Code quality
pnpm run lint
pnpm run type-check
pnpm run format

# Cleanup
pnpm run clean
```

---

## Timeline & Effort Estimate

| Task | Estimated | Effort |
|------|-----------|--------|
| Phase 1: Structure | 1-2h | Low |
| Phase 2: Package configs | 1-2h | Low |
| Phase 3: Shared packages | 2-3h | Medium |
| Phase 4: App migration | 3-4h | Medium |
| Phase 5: Vercel setup | 1-2h | Low |
| Phase 6: CI/CD | 2-3h | Medium |
| **TOTAL** | **10-16h** | **Low-Medium** |

**Token Budget:** Each phase <= 5,000 tokens with proper templates

---

## Next Steps

1. ✅ Review this IMPLEMENTATION_PLAN.md
2. 📖 Read relevant phase documentation
3. 🔧 Execute steps in order
4. ✔️ Validate against checklists
5. 📋 Document any deviations in `ARCHITECTURE.md`

**Ready to start Phase 1? Confirm and proceed!**
