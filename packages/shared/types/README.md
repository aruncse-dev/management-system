# @fintracker-vault/types

Shared TypeScript type definitions for Fintracker and Vault applications.

## Features

- Centralized type definitions
- API request/response types
- Domain types
- Type safety across monorepo

## Usage

```typescript
import type { Transaction, ApiResponse } from '@fintracker-vault/types';
import type { Account } from '@fintracker-vault/types/domain';
```

## Structure

- `src/index.ts` - Main type exports
- `src/api.ts` - API-related types
- `src/domain.ts` - Domain/business types
- `src/common.ts` - Common types
- `src/errors.ts` - Error types

## Building

```bash
pnpm build
```
