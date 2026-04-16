# Applications

Production applications in the monorepo.

## Apps

### Fintracker
Financial tracking application. Built with Next.js.

**Location:** `packages/apps/fintracker/`

**Dependencies:**
- `@fintracker-vault/ui` - Shared UI components
- `@fintracker-vault/types` - Shared types
- `@fintracker-vault/config` - Shared configuration
- `@fintracker-vault/utils` - Shared utilities

### Vault
Data vault application. Built with Next.js.

**Location:** `packages/apps/vault/`

**Dependencies:**
- `@fintracker-vault/ui` - Shared UI components
- `@fintracker-vault/types` - Shared types
- `@fintracker-vault/config` - Shared configuration
- `@fintracker-vault/utils` - Shared utilities

## Development

### Running Apps

```bash
# Run all apps
pnpm dev

# Run specific app
pnpm dev:fintracker
pnpm dev:vault
```

### Building Apps

```bash
# Build all apps
pnpm build

# Build specific app
pnpm build:fintracker
pnpm build:vault
```

## Important Rules

1. **No cross-app imports** - Apps should not import from each other
2. **Use shared packages** - Import UI, types, config, utils from shared packages
3. **App-specific code** - Keep app-specific components, services, and logic in the app directory
4. **Type safety** - Use proper TypeScript types from `@fintracker-vault/types`
