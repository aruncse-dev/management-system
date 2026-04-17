# @fintracker-vault/ui

Shared UI components and theme system for Fintracker and Vault applications.

## Features

- Reusable React components (layout, cards, modals, charts, app chrome)
- Centralized theme tokens
- TypeScript support

## Usage

```typescript
import { Nav, UiCard, TransactionCard, BottomNav } from '@fintracker-vault/ui'
import { theme } from '@fintracker-vault/ui/theme'
```

App entrypoints typically re-export everything:

```typescript
// apps/*/src/ui.tsx
export * from '@fintracker-vault/ui'
```

## Structure

- `src/components/` — components (`index.tsx` is the main barrel)
- `src/theme/` — theme configuration
- `src/styles/` — optional CSS entry for consumers

## Building

```bash
pnpm build
```
