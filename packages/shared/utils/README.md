# @fintracker-vault/utils

Shared utility functions for Fintracker and Vault applications.

## Features

- Formatting utilities (date, currency, etc.)
- Validation utilities (email, password, etc.)
- Calculation utilities
- Pure, testable functions

## Usage

```typescript
import { formatCurrency, formatDate, validateEmail } from '@fintracker-vault/utils';
import { formatCurrency } from '@fintracker-vault/utils/formatters';
import { validateEmail } from '@fintracker-vault/utils/validators';
```

## Structure

- `src/index.ts` - Main utility exports
- `src/formatters/` - Formatting functions
- `src/validators/` - Validation functions
- `src/calculations/` - Calculation functions

## Building

```bash
pnpm build
```

## Testing

```bash
pnpm test
```
