# @fintracker-vault/config

Shared configuration and constants for Fintracker and Vault applications.

## Features

- Centralized environment configuration
- API endpoint configuration
- Application constants
- Environment-aware configuration

## Usage

```typescript
import { config } from '@fintracker-vault/config';
import { env } from '@fintracker-vault/config/env';
import { api } from '@fintracker-vault/config/api';
```

## Structure

- `src/index.ts` - Main config exports
- `src/env.ts` - Environment variables
- `src/api.ts` - API endpoints
- `src/constants.ts` - Application constants

## Building

```bash
pnpm build
```
