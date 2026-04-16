# Package Configuration Guide

## 1. Root package.json

**Location:** `package.json` (at repo root)

**Purpose:** Declare workspaces, root dev dependencies, monorepo scripts

```json
{
  "name": "fintracker-vault",
  "version": "1.0.0",
  "description": "Monorepo for Fintracker & Vault applications",
  "private": true,
  "license": "MIT",
  "type": "module",
  "workspaces": [
    "packages/*",
    "packages/shared/*",
    "packages/apps/*",
    "packages/tools/configs/*"
  ],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:fintracker": "turbo run dev --scope=fintracker",
    "dev:vault": "turbo run dev --scope=vault",
    "build": "turbo run build",
    "build:fintracker": "turbo run build --scope=fintracker",
    "build:vault": "turbo run build --scope=vault",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "clean": "turbo clean && rm -rf node_modules && pnpm store prune",
    "deps:check": "node packages/tools/scripts/validate-deps.js",
    "version:bump": "node packages/tools/scripts/version-bump.js"
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "eslint": "^8.50.0",
    "eslint-config-next": "^14.0.0",
    "turbo": "^1.10.0",
    "typescript": "^5.2.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "tsup": "^8.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.0.0"
}
```

---

## 2. Shared Package: UI

**Location:** `packages/shared/ui/package.json`

**Purpose:** Reusable UI components and theme system

```json
{
  "name": "@fintracker-vault/ui",
  "version": "1.0.0",
  "description": "Shared UI components and theme system",
  "license": "MIT",
  "type": "module",
  "private": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "README.md"
  ],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./components": {
      "import": "./dist/components/index.js",
      "require": "./dist/components/index.cjs",
      "types": "./dist/components/index.d.ts"
    },
    "./theme": {
      "import": "./dist/theme/index.js",
      "require": "./dist/theme/index.cjs",
      "types": "./dist/theme/index.d.ts"
    },
    "./hooks": {
      "import": "./dist/hooks/index.js",
      "require": "./dist/hooks/index.cjs",
      "types": "./dist/hooks/index.d.ts"
    },
    "./styles": "./src/styles/globals.css"
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc && tsup src/index.ts --format esm,cjs --dts",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "clsx": "^2.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "tailwindcss": "^3.0.0"
  },
  "devDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.3.0",
    "typescript": "workspace:*",
    "tsup": "workspace:*",
    "eslint": "workspace:*"
  }
}
```

---

## 3. Shared Package: Types

**Location:** `packages/shared/types/package.json`

**Purpose:** Centralized TypeScript type definitions

```json
{
  "name": "@fintracker-vault/types",
  "version": "1.0.0",
  "description": "Shared TypeScript type definitions",
  "license": "MIT",
  "type": "module",
  "private": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "README.md"
  ],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./api": {
      "import": "./dist/api.js",
      "types": "./dist/api.d.ts"
    },
    "./domain": {
      "import": "./dist/domain.js",
      "types": "./dist/domain.d.ts"
    },
    "./common": {
      "import": "./dist/common.js",
      "types": "./dist/common.d.ts"
    }
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "eslint": "workspace:*"
  }
}
```

---

## 4. Shared Package: Config

**Location:** `packages/shared/config/package.json`

**Purpose:** Centralized application configuration

```json
{
  "name": "@fintracker-vault/config",
  "version": "1.0.0",
  "description": "Shared application configuration",
  "license": "MIT",
  "type": "module",
  "private": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "README.md"
  ],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./env": {
      "import": "./dist/env.js",
      "types": "./dist/env.d.ts"
    },
    "./api": {
      "import": "./dist/api.js",
      "types": "./dist/api.d.ts"
    }
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "eslint": "workspace:*"
  }
}
```

---

## 5. Shared Package: Utils

**Location:** `packages/shared/utils/package.json`

**Purpose:** Shared utility functions

```json
{
  "name": "@fintracker-vault/utils",
  "version": "1.0.0",
  "description": "Shared utility functions",
  "license": "MIT",
  "type": "module",
  "private": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "README.md"
  ],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./formatters": {
      "import": "./dist/formatters/index.js",
      "types": "./dist/formatters/index.d.ts"
    },
    "./validators": {
      "import": "./dist/validators/index.js",
      "types": "./dist/validators/index.d.ts"
    },
    "./calculations": {
      "import": "./dist/calculations/index.js",
      "types": "./dist/calculations/index.d.ts"
    }
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@fintracker-vault/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "eslint": "workspace:*",
    "jest": "^29.0.0"
  }
}
```

---

## 6. App Package: Fintracker

**Location:** `packages/apps/fintracker/package.json`

**Purpose:** Fintracker Next.js application

```json
{
  "name": "fintracker",
  "version": "1.0.0",
  "description": "Financial tracking application",
  "license": "MIT",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@fintracker-vault/ui": "workspace:*",
    "@fintracker-vault/types": "workspace:*",
    "@fintracker-vault/config": "workspace:*",
    "@fintracker-vault/utils": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "eslint": "workspace:*",
    "eslint-config-next": "workspace:*",
    "@types/node": "workspace:*",
    "@types/react": "workspace:*",
    "@types/react-dom": "workspace:*",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## 7. App Package: Vault

**Location:** `packages/apps/vault/package.json`

**Purpose:** Vault data management application (same structure as fintracker)

```json
{
  "name": "vault",
  "version": "1.0.0",
  "description": "Data vault and secure storage application",
  "license": "MIT",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@fintracker-vault/ui": "workspace:*",
    "@fintracker-vault/types": "workspace:*",
    "@fintracker-vault/config": "workspace:*",
    "@fintracker-vault/utils": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "eslint": "workspace:*",
    "eslint-config-next": "workspace:*",
    "@types/node": "workspace:*",
    "@types/react": "workspace:*",
    "@types/react-dom": "workspace:*",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## 8. Config Package: ESLint

**Location:** `packages/tools/configs/eslint-config/package.json`

```json
{
  "name": "@fintracker-vault/eslint-config",
  "version": "1.0.0",
  "description": "Shared ESLint configuration",
  "license": "MIT",
  "type": "module",
  "main": "index.js",
  "private": true,
  "dependencies": {
    "eslint": "workspace:*",
    "eslint-config-next": "workspace:*"
  }
}
```

**Location:** `packages/tools/configs/eslint-config/index.js`

```javascript
module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
  },
};
```

---

## 9. Package Manager Config

**Location:** `.npmrc` (at root)

```ini
# Use pnpm as package manager
# Shared dependencies
hoist-pattern[]=*eslint*
hoist-pattern[]=*prettier*
hoist-pattern[]=*typescript*

# Peer dependencies
auto-install-peers=true

# Workspace
recursive-install=true
```

**Or if using pnpm:** `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'packages/shared/*'
  - 'packages/apps/*'
  - 'packages/tools/configs/*'
```

---

## 10. TypeScript Config

**Location:** `tsconfig.json` (at root)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@fintracker-vault/ui": ["packages/shared/ui/src"],
      "@fintracker-vault/ui/*": ["packages/shared/ui/src/*"],
      "@fintracker-vault/types": ["packages/shared/types/src"],
      "@fintracker-vault/types/*": ["packages/shared/types/src/*"],
      "@fintracker-vault/config": ["packages/shared/config/src"],
      "@fintracker-vault/config/*": ["packages/shared/config/src/*"],
      "@fintracker-vault/utils": ["packages/shared/utils/src"],
      "@fintracker-vault/utils/*": ["packages/shared/utils/src/*"]
    }
  },
  "include": ["packages/**/*.ts", "packages/**/*.tsx"],
  "exclude": ["node_modules", "dist", ".next", "out"]
}
```

---

## 11. Next.js App Config

**Location:** `packages/apps/fintracker/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**Location:** `packages/apps/fintracker/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: [
    '@fintracker-vault/ui',
    '@fintracker-vault/types',
    '@fintracker-vault/config',
    '@fintracker-vault/utils',
  ],
};

module.exports = nextConfig;
```

---

## Installation & Verification

### Install Dependencies
```bash
pnpm install
```

### Verify Workspaces
```bash
pnpm list --depth=0
```

### Expected Output
```
packages/shared/ui
packages/shared/types
packages/shared/config
packages/shared/utils
packages/apps/fintracker
packages/apps/vault
packages/tools/configs/eslint-config
```

---

## Key Configuration Points

| Setting | Value | Reason |
|---------|-------|--------|
| `"private": true` | Root only | Prevent accidental root publish |
| `"private": false` | Shared packages | Allow publishing if needed |
| `"workspace:*"` | Local deps | Pin to local version, any semver |
| `"peerDependencies"` | UI package | Don't duplicate React/Tailwind |
| `transpilePackages` | Next.js config | Handle monorepo imports |
| `paths` alias | tsconfig | Clean imports via `@fintracker-vault/*` |

---

## Next Step

Proceed to **SHARED_PACKAGES_SETUP.md** for creating shared package contents.
