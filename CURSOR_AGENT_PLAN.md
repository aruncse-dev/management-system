# Cursor Agent Plan: Vault Nav + Routing Fix

> **Reference source:** `web/src/App.tsx` lines 185–236 — original `VaultNav` implementation with correct menu items, icons, and page routing.

---

## Goal
Fix the vault app so its drawer nav shows Banking / Insurance / Apps / Settings / Logout — matching the original web app. Currently the vault `_app.tsx` wires the **FinTracker** nav (Monthly, Savings, Gold, etc.) instead of a vault-specific one.

---

## Root Cause

`packages/apps/vault/src/pages/_app.tsx` has three bugs:

1. **Wrong component**: imports `Nav` from `'../ui'` which is the shared FinTracker finance nav — wrong items for vault
2. **Wrong module mapping**: all vault paths (`/vault`, `/vaultapps`, `/vaultinsurance`) map to `'monthly'` — a FinTracker concept
3. **Wrong route mapping**: `goToModule` maps to `/monthly`, `/savings`, etc. — none of which exist in vault

---

## Fix 1: Create `packages/apps/vault/src/components/VaultNav.tsx`

Model this exactly after `web/src/App.tsx` `VaultNav` function (lines 185–236). The vault nav must have:

**Drawer sections:**
```
"Vault" group:
  - Banking     icon: Landmark    → route: /Vault
  - Insurance   icon: Shield      → route: /VaultInsurance
  - Apps        icon: Grid2X2     → route: /VaultApps

Bottom group:
  - Settings    icon: Settings    → route: /VaultSettings
  - Logout      icon: LogOut      → triggers logout confirm modal
```

The nav title bar must show the **current page name** dynamically:
- `/Vault` → "Banking"
- `/VaultInsurance` → "Insurance"
- `/VaultApps` → "Apps"
- `/VaultSettings` → "Settings"

**Implementation approach:** Build this as a standalone component specific to vault (don't try to reuse the shared `Nav` from `@fintracker-vault/ui` — that one is FinTracker-specific). Copy the structure from `web/src/App.tsx` VaultNav and adapt it:
- Replace Vite's `import.meta.env` → `process.env.NEXT_PUBLIC_*`
- Replace SPA `setVaultPage()` calls → `router.push('/VaultInsurance')` etc. using `next/router`
- Keep the same icons: `Landmark`, `Shield`, `Grid2X2`, `Settings`, `LogOut` from `lucide-react`
- Keep the same CSS classes from `globals.css`: `app-shell`, `nav-drawer`, `nav-section`, `nav-item`, etc.

---

## Fix 2: Rewrite `packages/apps/vault/src/pages/_app.tsx`

Replace the broken module-mapping logic with vault-specific routing:

```tsx
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { StoreProvider } from '../store'
import VaultNav from '../components/VaultNav'
import '../styles/globals.css'

type VaultPage = 'banking' | 'insurance' | 'apps' | 'settings'

function pageFromPath(p: string): VaultPage {
  if (p.startsWith('/VaultInsurance') || p.startsWith('/vaultinsurance')) return 'insurance'
  if (p.startsWith('/VaultApps') || p.startsWith('/vaultapps')) return 'apps'
  if (p.startsWith('/VaultSettings') || p.startsWith('/vaultsettings')) return 'settings'
  return 'banking'
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const currentPage = pageFromPath(router.pathname)

  function goToPage(page: VaultPage) {
    const routes: Record<VaultPage, string> = {
      banking: '/Vault',
      insurance: '/VaultInsurance',
      apps: '/VaultApps',
      settings: '/VaultSettings',
    }
    router.push(routes[page])
  }

  return (
    <StoreProvider>
      <div className="app-shell">
        <VaultNav currentPage={currentPage} onNavigate={goToPage} />
        <main className="main-content">
          <Component {...pageProps} />
        </main>
      </div>
    </StoreProvider>
  )
}
```

---

## Fix 3: Fix `packages/apps/vault/src/pages/index.tsx`

Change redirect to lowercase for robustness:
```ts
destination: '/vault',   // was '/Vault'
```

---

## Fix 4: Rename export in `packages/apps/vault/src/pages/VaultSettings.tsx`

Change `export default function RecordsSettings()` → `export default function VaultSettings()` for clarity.

---

## CSS Classes to Use (already in globals.css)

From `packages/apps/vault/src/styles/globals.css` — use these existing classes (same as fintracker uses):
```
.app-shell          — outer flex container
.nav-drawer         — left side drawer panel
.nav-section        — group within drawer
.nav-section-label  — section heading text
.nav-item           — individual nav button
.nav-item.active    — highlighted current item
.nav-icon           — icon wrapper within nav-item
.main-content       — right side page content area
.nav-title-bar      — top bar showing current page name
```

Reference: look at `packages/apps/fintracker/src/components/Nav.tsx` for how these classes are applied — vault should follow the same pattern.

---

## Verification

```bash
# Start vault dev server
cd packages/apps/vault && pnpm dev
# open http://localhost:3001

# Check:
# ✓ Left drawer visible with: Banking, Insurance, Apps (grouped), Settings, Logout (bottom)
# ✓ Clicking Banking → /Vault page loads, "Banking" shown in title bar
# ✓ Clicking Insurance → /VaultInsurance page loads
# ✓ Clicking Apps → /VaultApps page loads
# ✓ Clicking Settings → /VaultSettings page loads
# ✓ Logout shows confirm dialog, then clears auth
```

---

## Key File Paths

| File | Action |
|---|---|
| `web/src/App.tsx` lines 185–236 | READ — original VaultNav reference implementation |
| `packages/apps/vault/src/pages/_app.tsx` | REWRITE — vault routing |
| `packages/apps/vault/src/components/VaultNav.tsx` | CREATE — new vault drawer nav |
| `packages/apps/vault/src/pages/index.tsx` | EDIT — fix redirect casing |
| `packages/apps/vault/src/pages/VaultSettings.tsx` | EDIT — rename export |
| `packages/apps/fintracker/src/components/Nav.tsx` | READ — pattern reference for CSS classes |
| `packages/apps/vault/src/styles/globals.css` | READ — existing CSS classes to reuse |

---

# Cursor Agent Plan: Shared UI Migration + Vault Parity

## Goal
Move all duplicated components from both Next.js apps into `packages/shared/ui`, fix vault to consume the shared package, then apply fintracker's UI fixes to vault so both apps look identical.

---

## Background

This monorepo has two Next.js apps (`packages/apps/fintracker`, `packages/apps/vault`) and a shared UI library (`packages/shared/ui`). The apps were created by copying a Vite web app wholesale — both currently have identical local copies of 8 components instead of sharing them.

Key fact: `fintracker/src/ui.tsx` correctly delegates to the shared package (`export * from '@fintracker-vault/ui'`), but `vault/src/ui.tsx` is a 200-line standalone stub that duplicates everything. **Fintracker UI is working. Vault UI is broken/unstyled.**

---

## Phase 1: Move Shared Components into `packages/shared/ui`

### 1a. Copy these 5 identical components into shared/ui:

Source (copy from either app — they're byte-for-byte identical):
- `packages/apps/fintracker/src/components/CatIcon.tsx`
- `packages/apps/fintracker/src/components/FinanceUI.tsx`
- `packages/apps/fintracker/src/components/RightLegendDonut.tsx`
- `packages/apps/fintracker/src/components/SettingsSectionCard.tsx`
- `packages/apps/fintracker/src/components/TransactionModal.tsx`

Destination: `packages/shared/ui/src/components/[ComponentName].tsx`

Each file may need its import paths adjusted:
- `from '../types'` → import from `@fintracker-vault/types`
- `from '../config'` or `from '../constants'` → import from `@fintracker-vault/config`
- `from '../utils'` → import from `@fintracker-vault/utils`
- `from '../ui'` → import from `./index` (within shared/ui itself)

### 1b. Create parameterised versions of near-identical components:

**BottomNav** — fintracker uses CSS class `bottom-nav`/`bottom-nav-item`/`bottom-nav-icon`, vault uses `tab-bar`/`tab-item`/`tab-icon`. Add a `variant?: 'fintracker' | 'vault'` prop that switches the class prefix.

**ErrorScreen** — fintracker icon: `/icon-192.png`, vault icon: `./apple-touch-icon.png`. Add `iconSrc?: string` prop with `/icon-192.png` as default.

**Nav** — vault's version is better (uses `getAppAssetUrl` for dynamic per-area icons). Use vault's version as canonical. Props: `area: 'fintracker' | 'vault'`, `appName: string`, `menuItems: MenuItem[]`.

### 1c. Export all 8 from `packages/shared/ui/src/components/index.tsx`

Add named exports at the bottom of the existing index.tsx for all 8 newly added components.

### 1d. Rebuild shared/ui

```bash
cd packages/shared/ui && pnpm build
```

---

## Phase 2: Fix vault/src/ui.tsx

Replace the entire contents of `packages/apps/vault/src/ui.tsx` with:

```ts
export * from '@fintracker-vault/ui'
```

This is what fintracker already does. After this, vault pages will consume the same shared components.

---

## Phase 3: Delete Local Duplicates from Both Apps

After confirming shared/ui builds and both apps still compile:

```bash
# Delete from fintracker
rm packages/apps/fintracker/src/components/CatIcon.tsx
rm packages/apps/fintracker/src/components/FinanceUI.tsx
rm packages/apps/fintracker/src/components/RightLegendDonut.tsx
rm packages/apps/fintracker/src/components/SettingsSectionCard.tsx
rm packages/apps/fintracker/src/components/TransactionModal.tsx
rm packages/apps/fintracker/src/components/BottomNav.tsx
rm packages/apps/fintracker/src/components/ErrorScreen.tsx
rm packages/apps/fintracker/src/components/Nav.tsx

# Delete from vault
rm packages/apps/vault/src/components/CatIcon.tsx
rm packages/apps/vault/src/components/FinanceUI.tsx
rm packages/apps/vault/src/components/RightLegendDonut.tsx
rm packages/apps/vault/src/components/SettingsSectionCard.tsx
rm packages/apps/vault/src/components/TransactionModal.tsx
rm packages/apps/vault/src/components/BottomNav.tsx
rm packages/apps/vault/src/components/ErrorScreen.tsx
rm packages/apps/vault/src/components/Nav.tsx
```

Any page that imports `from '../components/Foo'` should be updated to `from '../ui'` (since `ui.tsx` → `@fintracker-vault/ui` → includes `Foo`).

---

## Phase 4: Apply Fintracker UI Fixes to Vault

Fintracker UI was fixed by cursor agent. Apply the same fixes to vault:

1. **Check what changed** in fintracker since it was working:
   ```bash
   git diff HEAD~5 -- packages/apps/fintracker/src/
   ```

2. **Copy over** any layout/CSS wiring from fintracker → vault:
   - `packages/apps/fintracker/src/pages/_app.tsx` → `packages/apps/vault/src/pages/_app.tsx`
   - `packages/apps/fintracker/src/pages/_document.tsx` → `packages/apps/vault/src/pages/_document.tsx`
   - `packages/apps/fintracker/src/styles/globals.css` → `packages/apps/vault/src/styles/globals.css`

3. **Verify vault renders correctly** at http://localhost:3001 — drawer visible, buttons styled, cards with correct spacing.

---

## Phase 5: Cleanup

Delete stale planning/session docs that are no longer needed:
- `FINAL_STATUS.md`
- `SESSION_3_HANDOFF.md`
- `ARCHITECTURE.md` (if outdated)
- `CODE_AGENT_GUIDE.md` (if outdated)

Delete unused code from shared/ui:
- `packages/shared/ui/src/components/Button.tsx` — generic Tailwind button, not used by either app
- `packages/shared/ui/src/hooks/` — empty directory declared in package.json exports

---

## Verification Checklist

```bash
# 1. Shared UI builds cleanly
cd packages/shared/ui && pnpm build
# Expected: no TypeScript errors, dist/ generated

# 2. Both apps build
cd /path/to/monorepo && pnpm build
# Expected: Tasks 7 successful

# 3. Fintracker still looks correct
pnpm dev:fintracker
# open http://localhost:3000 — drawer, nav, cards, spacing all correct

# 4. Vault now looks correct
pnpm dev:vault
# open http://localhost:3001 — same quality as fintracker
```

---

## Key Files Reference

| Purpose | Path |
|---|---|
| Shared component library | `packages/shared/ui/src/components/index.tsx` |
| Fintracker ui alias | `packages/apps/fintracker/src/ui.tsx` |
| Vault ui alias | `packages/apps/vault/src/ui.tsx` |
| Shared types | `packages/shared/types/src/index.ts` |
| Shared config | `packages/shared/config/src/index.ts` |
| Shared utils | `packages/shared/utils/src/index.ts` |
| Fintracker pages | `packages/apps/fintracker/src/pages/` |
| Vault pages | `packages/apps/vault/src/pages/` |
