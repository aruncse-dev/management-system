# Monorepo Directory Structure

## Complete File Tree

```
fintracker-vault/                          # Root monorepo
│
├── packages/
│   │
│   ├── shared/                            # All shared code
│   │   │
│   │   ├── ui/                            # Shared UI components & theme
│   │   │   ├── src/
│   │   │   │   ├── components/
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Card.tsx
│   │   │   │   │   ├── Form/
│   │   │   │   │   ├── Layout/
│   │   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   │   ├── Header.tsx
│   │   │   │   │   │   └── Footer.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── theme/
│   │   │   │   │   ├── colors.ts
│   │   │   │   │   ├── typography.ts
│   │   │   │   │   ├── spacing.ts
│   │   │   │   │   ├── shadows.ts
│   │   │   │   │   ├── radius.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useTheme.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── styles/
│   │   │   │   │   ├── globals.css
│   │   │   │   │   └── tailwind.css
│   │   │   │   └── index.ts
│   │   │   ├── dist/                     # Built output (gitignored)
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   ├── README.md
│   │   │   └── .eslintrc.json
│   │   │
│   │   ├── types/                        # Shared TypeScript types
│   │   │   ├── src/
│   │   │   │   ├── api.ts                # API request/response types
│   │   │   │   ├── domain.ts             # Business domain types
│   │   │   │   ├── common.ts             # Common types
│   │   │   │   ├── errors.ts             # Error types
│   │   │   │   └── index.ts
│   │   │   ├── dist/                     # Built output (gitignored)
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   ├── README.md
│   │   │   └── .eslintrc.json
│   │   │
│   │   ├── config/                       # Shared configuration
│   │   │   ├── src/
│   │   │   │   ├── env.ts                # Environment variables
│   │   │   │   ├── api.ts                # API endpoints
│   │   │   │   ├── constants.ts          # App constants
│   │   │   │   └── index.ts
│   │   │   ├── dist/                     # Built output (gitignored)
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   ├── README.md
│   │   │   └── .eslintrc.json
│   │   │
│   │   ├── utils/                        # Shared utilities
│   │   │   ├── src/
│   │   │   │   ├── formatters/
│   │   │   │   │   ├── date.ts
│   │   │   │   │   ├── currency.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── validators/
│   │   │   │   │   ├── email.ts
│   │   │   │   │   ├── password.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── calculations/
│   │   │   │   │   ├── math.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── index.ts
│   │   │   ├── dist/                     # Built output (gitignored)
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   ├── README.md
│   │   │   └── .eslintrc.json
│   │   │
│   │   └── README.md                     # Shared packages overview
│   │
│   ├── apps/
│   │   │
│   │   ├── fintracker/                   # Fintracker Next.js app
│   │   │   ├── app/                      # Next.js 13+ App Router
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   ├── not-found.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── transactions/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── new/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── reports/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── api/
│   │   │   │       ├── transactions/
│   │   │   │       │   └── route.ts
│   │   │   │       └── auth/
│   │   │   │           └── [...nextauth]/
│   │   │   │               └── route.ts
│   │   │   ├── src/
│   │   │   │   ├── components/           # App-specific components
│   │   │   │   │   ├── TransactionTable.tsx
│   │   │   │   │   ├── BalanceCard.tsx
│   │   │   │   │   ├── Charts/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── hooks/                # App-specific hooks
│   │   │   │   │   ├── useTransactions.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── services/             # API service layer
│   │   │   │   │   ├── transactionService.ts
│   │   │   │   │   ├── authService.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── store/                # State management
│   │   │   │   │   ├── transactionStore.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── utils/                # App-specific utilities
│   │   │   │   │   ├── calculations.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── types/                # App-specific types
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── overrides.ts
│   │   │   │   ├── lib/                  # Third-party integrations
│   │   │   │   │   └── index.ts
│   │   │   │   └── constants.ts
│   │   │   ├── public/
│   │   │   │   ├── images/
│   │   │   │   ├── icons/
│   │   │   │   └── favicon.ico
│   │   │   ├── .env.local                # Local env (gitignored)
│   │   │   ├── .env.example              # Template env
│   │   │   ├── next.config.js
│   │   │   ├── tsconfig.json
│   │   │   ├── tailwind.config.ts
│   │   │   ├── postcss.config.js
│   │   │   ├── package.json
│   │   │   ├── README.md
│   │   │   ├── DEPLOYMENT.md
│   │   │   └── .eslintrc.json
│   │   │
│   │   ├── vault/                        # Vault Next.js app (same structure)
│   │   │   ├── app/
│   │   │   ├── src/
│   │   │   ├── public/
│   │   │   ├── .env.local
│   │   │   ├── .env.example
│   │   │   ├── next.config.js
│   │   │   ├── tsconfig.json
│   │   │   ├── tailwind.config.ts
│   │   │   ├── postcss.config.js
│   │   │   ├── package.json
│   │   │   ├── README.md
│   │   │   ├── DEPLOYMENT.md
│   │   │   └── .eslintrc.json
│   │   │
│   │   └── README.md                     # Apps overview
│   │
│   ├── tools/                            # Development tools & configs
│   │   ├── scripts/
│   │   │   ├── version-bump.js
│   │   │   ├── changelog-gen.js
│   │   │   ├── validate-deps.js
│   │   │   └── README.md
│   │   ├── configs/
│   │   │   ├── eslint-config/
│   │   │   │   ├── index.js
│   │   │   │   └── package.json
│   │   │   ├── prettier-config/
│   │   │   │   ├── index.js
│   │   │   │   └── package.json
│   │   │   ├── tsconfig/
│   │   │   │   ├── base.json
│   │   │   │   ├── react.json
│   │   │   │   └── node.json
│   │   │   └── README.md
│   │   └── README.md
│   │
│   └── README.md                         # Packages overview
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                        # Linting, testing
│   │   ├── deploy-fintracker.yml         # Deploy fintracker
│   │   ├── deploy-vault.yml              # Deploy vault
│   │   └── publish-shared.yml            # Publish shared packages
│   └── CODEOWNERS
│
├── docs/                                 # Project documentation
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   ├── API.md
│   └── TROUBLESHOOTING.md
│
├── .github/
├── .gitignore
├── .npmrc                                # Package manager config
├── .prettierignore
├── .prettierrc.json
├── .eslintrc.json
├── .editorconfig
├── .env.example
├── turbo.json                            # Turborepo cache config
├── pnpm-workspace.yaml                   # If using pnpm
├── package.json                          # Root workspace config
├── package-lock.json / pnpm-lock.yaml
├── tsconfig.json                         # Root TypeScript config
├── vercel.json                           # Vercel monorepo config
├── README.md                             # Project overview
├── CONTRIBUTING.md                       # Contribution guidelines
├── ARCHITECTURE.md                       # Architecture decisions
├── CODE_OF_CONDUCT.md
└── LICENSE
```

---

## Directory Creation Steps

### Create Core Structure
```bash
# From repo root
mkdir -p packages/shared/{ui,types,config,utils}/src
mkdir -p packages/apps/{fintracker,vault}/src
mkdir -p packages/tools/{scripts,configs}
mkdir -p .github/workflows
mkdir -p docs
```

### Create Shared Package Subdirectories
```bash
# UI
mkdir -p packages/shared/ui/src/{components,theme,hooks,styles}
mkdir -p packages/shared/ui/dist

# Types
mkdir -p packages/shared/types/src
mkdir -p packages/shared/types/dist

# Config
mkdir -p packages/shared/config/src
mkdir -p packages/shared/config/dist

# Utils
mkdir -p packages/shared/utils/src/{formatters,validators,calculations}
mkdir -p packages/shared/utils/dist
```

### Create App Subdirectories
```bash
# Fintracker
mkdir -p packages/apps/fintracker/{app,src/{components,hooks,services,store,utils,types,lib},public/{images,icons}}

# Vault (same structure)
mkdir -p packages/apps/vault/{app,src/{components,hooks,services,store,utils,types,lib},public/{images,icons}}
```

### Create Tools Subdirectories
```bash
mkdir -p packages/tools/scripts
mkdir -p packages/tools/configs/{eslint-config,prettier-config,tsconfig}
```

---

## File Naming Conventions

### Components
```
✅ Button.tsx (PascalCase)
✅ useTheme.ts (camelCase for hooks)
✅ index.ts (barrel exports)
❌ button.tsx (avoid lowercase)
```

### Utilities
```
✅ formatters/date.ts
✅ validators/email.ts
❌ formatDate.ts (use directory structure)
```

### Services
```
✅ transactionService.ts
✅ authService.ts
❌ services.ts (be specific)
```

### Configuration
```
✅ tsconfig.json
✅ next.config.js
✅ tailwind.config.ts
```

---

## .gitignore Template

```
# Dependencies
node_modules/
pnpm-lock.yaml
package-lock.json
yarn.lock

# Build outputs
dist/
.next/
out/
build/

# Development
.env.local
.env.*.local
.DS_Store

# IDE
.vscode/
.idea/
*.swp
*.swo

# Turbo
.turbo/

# OS
Thumbs.db
```

---

## Key Principles

1. **Single Responsibility** - Each package has one clear purpose
2. **Explicit Exports** - Use barrel (index.ts) files for clean imports
3. **No Circular Dependencies** - Apps depend on shared, not vice versa
4. **Consistent Structure** - Mirror structure across similar packages
5. **Clear Separation** - App-specific code stays in apps, not shared
6. **Documentation** - README.md in each major directory

---

## Next Step

After creating directories, proceed to **PACKAGE_CONFIG.md** for package.json setup.
