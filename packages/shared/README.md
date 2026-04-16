# Shared Packages

Shared packages used by all applications in the monorepo.

## Packages

### @fintracker-vault/ui
Shared UI components and theme configuration.

**Exports:**
- Components (Button, Card, Form, Layout, etc.)
- Theme configuration
- Theme hooks

**Usage:**
```typescript
import { Button, Card } from '@fintracker-vault/ui'
import { theme } from '@fintracker-vault/ui/theme'
import { useTheme } from '@fintracker-vault/ui/hooks'
```

### @fintracker-vault/types
Shared TypeScript type definitions.

**Exports:**
- API request/response types
- Domain types (Transaction, Account, etc.)
- Common types
- Error types

**Usage:**
```typescript
import type { Transaction, ApiResponse } from '@fintracker-vault/types'
```

### @fintracker-vault/config
Shared configuration and constants.

**Exports:**
- Environment variables
- API endpoints
- Application constants

**Usage:**
```typescript
import { config } from '@fintracker-vault/config'
```

### @fintracker-vault/utils
Shared utility functions.

**Exports:**
- Formatters (date, currency, etc.)
- Validators (email, password, etc.)
- Calculations

**Usage:**
```typescript
import { formatCurrency, validateEmail } from '@fintracker-vault/utils'
```

## Development

### Building
```bash
pnpm build  # Build all packages
```

### Building Specific Package
```bash
pnpm --filter=@fintracker-vault/ui build
```

## Important Rules

1. **No app-to-app imports** - Apps should only import from shared packages
2. **No circular dependencies** - Shared packages depend on nothing in the monorepo
3. **Barrel exports** - Use `index.ts` for clean imports
4. **Strict typing** - Use full type definitions, avoid `any`
