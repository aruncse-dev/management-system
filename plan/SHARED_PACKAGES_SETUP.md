# Shared Packages Setup Guide

## Overview

Create 4 shared packages:
1. **@fintracker-vault/ui** - Components & theme
2. **@fintracker-vault/types** - TypeScript types
3. **@fintracker-vault/config** - Configuration
4. **@fintracker-vault/utils** - Utilities

---

## 1. UI Package (@fintracker-vault/ui)

### 1.1 Theme Colors

**File:** `packages/shared/ui/src/theme/colors.ts`

```typescript
export const colors = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c2d6b',
  },
  
  // Secondary brand colors
  secondary: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#9333ea',
    600: '#7e22ce',
    700: '#6b21a8',
    800: '#581c87',
    900: '#3f0f5c',
  },
  
  // Neutral/Gray
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
  
  // Semantic colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Transparent
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
};

export type Colors = typeof colors;
```

### 1.2 Typography

**File:** `packages/shared/ui/src/theme/typography.ts`

```typescript
export const typography = {
  fontFamily: {
    sans: [
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ].join(','),
    mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'].join(','),
  },
  
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
  },
  
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

export type Typography = typeof typography;
```

### 1.3 Spacing Scale

**File:** `packages/shared/ui/src/theme/spacing.ts`

```typescript
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  7: '1.75rem',  // 28px
  8: '2rem',     // 32px
  9: '2.25rem',  // 36px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  14: '3.5rem',  // 56px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
  28: '7rem',    // 112px
  32: '8rem',    // 128px
  36: '9rem',    // 144px
  40: '10rem',   // 160px
  44: '11rem',   // 176px
  48: '12rem',   // 192px
  52: '13rem',   // 208px
  56: '14rem',   // 224px
  60: '15rem',   // 240px
  64: '16rem',   // 256px
};

export type Spacing = typeof spacing;
```

### 1.4 Theme Export

**File:** `packages/shared/ui/src/theme/index.ts`

```typescript
export { colors } from './colors';
export { typography } from './typography';
export { spacing } from './spacing';

import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
};

export type Theme = typeof theme;
```

### 1.5 Component Example - Button

**File:** `packages/shared/ui/src/components/Button.tsx`

```typescript
import React from 'react';
import clsx from 'clsx';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'font-medium rounded-lg transition-colors duration-200 font-sans';

    const variantStyles = {
      primary: 'bg-sky-500 text-white hover:bg-sky-600 disabled:bg-neutral-400',
      secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 disabled:bg-neutral-300',
      ghost: 'text-sky-600 hover:bg-sky-50 disabled:text-neutral-400',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {isLoading ? 'Loading...' : children}
      </button>
    );
  },
);

Button.displayName = 'Button';
```

### 1.6 Components Barrel Export

**File:** `packages/shared/ui/src/components/index.ts`

```typescript
export { Button, type ButtonProps } from './Button';
// Export other components as they're created
```

### 1.7 Main UI Index

**File:** `packages/shared/ui/src/index.ts`

```typescript
// Export components
export * from './components';

// Export theme
export * from './theme';

// Export hooks
export * from './hooks';

// Export CSS
import './styles/globals.css';
```

### 1.8 UI Package tsconfig.json

**File:** `packages/shared/ui/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
  },
  "include": ["src"],
  "exclude": ["dist"]
}
```

---

## 2. Types Package (@fintracker-vault/types)

### 2.1 API Types

**File:** `packages/shared/types/src/api.ts`

```typescript
// Generic response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Auth
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 Domain Types

**File:** `packages/shared/types/src/domain.ts`

```typescript
// For Fintracker
export interface Transaction {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  balance: number;
  currency: string;
}

// For Vault
export interface VaultItem {
  id: string;
  userId: string;
  title: string;
  type: 'note' | 'password' | 'document';
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 2.3 Common Types

**File:** `packages/shared/types/src/common.ts`

```typescript
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState {
  field: string;
  order: 'asc' | 'desc';
}

export interface FilterState {
  [key: string]: unknown;
}

export interface DataTableState extends PaginationState, SortState {
  filters: FilterState;
}
```

### 2.4 Types Package Index

**File:** `packages/shared/types/src/index.ts`

```typescript
export * from './api';
export * from './domain';
export * from './common';
```

### 2.5 Types Package tsconfig.json

**File:** `packages/shared/types/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
  },
  "include": ["src"],
  "exclude": ["dist"]
}
```

---

## 3. Config Package (@fintracker-vault/config)

### 3.1 Environment Configuration

**File:** `packages/shared/config/src/env.ts`

```typescript
const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

export const env = {
  // API
  API_BASE_URL: getEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001'),
  API_TIMEOUT: parseInt(getEnv('API_TIMEOUT', '10000')),
  
  // App
  APP_NAME: getEnv('NEXT_PUBLIC_APP_NAME', 'Fintracker & Vault'),
  ENVIRONMENT: getEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  
  // Features
  ENABLE_ANALYTICS: getEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', 'false') === 'true',
  ENABLE_DEBUG: getEnv('NEXT_PUBLIC_DEBUG', 'false') === 'true',
  
  // Auth
  AUTH_PROVIDER: getEnv('NEXT_PUBLIC_AUTH_PROVIDER', 'jwt'),
  SESSION_TIMEOUT: parseInt(getEnv('SESSION_TIMEOUT', '3600000')), // 1 hour
};

export type Env = typeof env;
```

### 3.2 API Configuration

**File:** `packages/shared/config/src/api.ts`

```typescript
export const apiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
  
  endpoints: {
    // Auth
    auth: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      refresh: '/api/auth/refresh',
      profile: '/api/auth/profile',
    },
    
    // Fintracker
    transactions: {
      list: '/api/transactions',
      create: '/api/transactions',
      getById: (id: string) => `/api/transactions/${id}`,
      update: (id: string) => `/api/transactions/${id}`,
      delete: (id: string) => `/api/transactions/${id}`,
    },
    
    accounts: {
      list: '/api/accounts',
      create: '/api/accounts',
      getById: (id: string) => `/api/accounts/${id}`,
    },
    
    // Vault
    items: {
      list: '/api/vault/items',
      create: '/api/vault/items',
      getById: (id: string) => `/api/vault/items/${id}`,
    },
  },
  
  // Request defaults
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  
  // Headers
  headers: {
    'Content-Type': 'application/json',
  },
};

export type ApiConfig = typeof apiConfig;
```

### 3.3 Config Package Index

**File:** `packages/shared/config/src/index.ts`

```typescript
export { env, type Env } from './env';
export { apiConfig, type ApiConfig } from './api';
```

### 3.4 Config Package tsconfig.json

**File:** `packages/shared/config/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
  },
  "include": ["src"],
  "exclude": ["dist"]
}
```

---

## 4. Utils Package (@fintracker-vault/utils)

### 4.1 Formatters

**File:** `packages/shared/utils/src/formatters/date.ts`

```typescript
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const past = new Date(date);
  const diff = now.getTime() - past.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return formatDate(date);
};
```

**File:** `packages/shared/utils/src/formatters/currency.ts`

```typescript
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toFixed(decimals);
};
```

**File:** `packages/shared/utils/src/formatters/index.ts`

```typescript
export * from './date';
export * from './currency';
```

### 4.2 Validators

**File:** `packages/shared/utils/src/validators/email.ts`

```typescript
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateEmail = (
  email: string,
): { valid: boolean; error?: string } => {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }
  if (!isValidEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
};
```

**File:** `packages/shared/utils/src/validators/index.ts`

```typescript
export * from './email';
```

### 4.3 Calculations

**File:** `packages/shared/utils/src/calculations/math.ts`

```typescript
export const calculateTotal = (amounts: number[]): number => {
  return amounts.reduce((sum, amount) => sum + amount, 0);
};

export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return (value / total) * 100;
};

export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  return calculateTotal(values) / values.length;
};
```

### 4.4 Utils Package Index

**File:** `packages/shared/utils/src/index.ts`

```typescript
export * from './formatters';
export * from './validators';
export * from './calculations';
```

### 4.5 Utils Package tsconfig.json

**File:** `packages/shared/utils/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

---

## 5. Shared Package README Files

### UI Package README

**File:** `packages/shared/ui/README.md`

```markdown
# @fintracker-vault/ui

Shared UI components and theme system for Fintracker & Vault.

## Installation

This package is part of the monorepo and is automatically available within the workspace.

## Usage

### Components
\`\`\`tsx
import { Button, Card } from '@fintracker-vault/ui';

export function MyComponent() {
  return (
    <Button variant="primary">Click me</Button>
  );
}
\`\`\`

### Theme
\`\`\`tsx
import { theme, colors } from '@fintracker-vault/ui';

const primaryColor = colors.primary[500]; // '#0ea5e9'
\`\`\`

## Available Exports

- **Components**: Button, Card, Layout, Form components
- **Theme**: colors, typography, spacing
- **Hooks**: useTheme

## Development

\`\`\`bash
pnpm dev  # Watch mode
pnpm build  # Build distribution
\`\`\`
```

### Types Package README

**File:** `packages/shared/types/README.md`

```markdown
# @fintracker-vault/types

Shared TypeScript type definitions for Fintracker & Vault.

## Usage

\`\`\`tsx
import type { Transaction, User, ApiResponse } from '@fintracker-vault/types';

const user: User = {
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
};
\`\`\`

## Available Types

- **API**: `ApiResponse`, `PaginatedResponse`, `AuthTokens`
- **Domain**: `Transaction`, `Account`, `VaultItem`
- **Common**: `Nullable`, `Optional`, `SortState`
```

### Config Package README

**File:** `packages/shared/config/README.md`

```markdown
# @fintracker-vault/config

Shared configuration for Fintracker & Vault.

## Usage

\`\`\`tsx
import { env, apiConfig } from '@fintracker-vault/config';

console.log(env.API_BASE_URL);  // API endpoint
console.log(apiConfig.endpoints.transactions.list);
\`\`\`

## Environment Variables

See `.env.example` in root directory.
```

### Utils Package README

**File:** `packages/shared/utils/README.md`

```markdown
# @fintracker-vault/utils

Shared utility functions for Fintracker & Vault.

## Usage

\`\`\`tsx
import {
  formatCurrency,
  formatDate,
  isValidEmail,
  calculateTotal,
} from '@fintracker-vault/utils';

const formatted = formatCurrency(1000, 'USD');  // '$1,000.00'
const isValid = isValidEmail('test@example.com');  // true
\`\`\`

## Categories

- **Formatters**: Date, currency, number formatting
- **Validators**: Email, password validation
- **Calculations**: Math utilities
```

---

## Verification Checklist

After setting up shared packages:

- [ ] All 4 packages have `package.json`
- [ ] All have `tsconfig.json`
- [ ] All have `src/index.ts` barrel exports
- [ ] UI package exports components and theme
- [ ] Types package exports all type definitions
- [ ] Config package exports configuration
- [ ] Utils package exports utility functions
- [ ] No circular dependencies between packages
- [ ] All packages build successfully: `pnpm run build`

## Next Steps

Proceed to **APP_MIGRATION.md** to update apps with shared packages.
