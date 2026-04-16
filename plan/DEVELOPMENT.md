# Developer Workflow Guide

## Local Development Setup

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/fintracker-vault.git
cd fintracker-vault

# Install pnpm (if not installed)
npm install -g pnpm

# Install dependencies
pnpm install

# Verify installation
pnpm list --depth=0
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Update values for local development
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_DEBUG=true
NODE_ENV=development
```

### 3. Verify Setup

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Build shared packages
pnpm build

# Should complete without errors
```

---

## Daily Development Workflow

### Starting Development

```bash
# Option 1: Start all apps in parallel
pnpm dev

# Option 2: Start specific app
pnpm dev:fintracker
# In another terminal
pnpm dev:vault

# Option 3: Start one app with --watch on shared packages
cd packages/apps/fintracker && pnpm dev
```

**Expected output:**
```
▲ Next.js X.X.X
- Local: http://localhost:3000
- Environments: .env.local
```

### Making Changes

#### Workflow 1: Update Shared Package (e.g., UI Component)

```bash
# 1. Make changes
vi packages/shared/ui/src/components/Button.tsx

# 2. Test building shared package
pnpm build --scope=@fintracker-vault/ui

# 3. Dev mode automatically picks up changes
# (Apps rebuild when shared packages change)

# 4. Verify in browser
# Both apps should reflect UI changes immediately

# 5. Commit changes
git add packages/shared/ui/
git commit -m "feat(ui): update Button component styling"
```

#### Workflow 2: Update App Code (e.g., Fintracker)

```bash
# 1. Make changes
vi packages/apps/fintracker/src/components/Dashboard.tsx

# 2. Changes reflect immediately in dev server
# (Hot reload active)

# 3. Test functionality
# Open http://localhost:3000 in browser

# 4. Run checks
pnpm type-check
pnpm lint --scope=fintracker

# 5. Commit changes
git add packages/apps/fintracker/
git commit -m "feat(fintracker): add transaction filters"
```

#### Workflow 3: Update Shared Types

```bash
# 1. Make changes
vi packages/shared/types/src/domain.ts

# 2. Rebuild types
pnpm build --scope=@fintracker-vault/types

# 3. Update app code to use new types
vi packages/apps/fintracker/src/services/api.ts

# 4. Verify no TypeScript errors
pnpm type-check

# 5. Commit both changes together
git add packages/shared/types/ packages/apps/fintracker/
git commit -m "feat: add transaction reconciliation types"
```

---

## Code Quality Commands

### Type Checking

```bash
# Check all packages
pnpm type-check

# Check specific scope
pnpm type-check --scope=fintracker

# Watch mode
cd packages/apps/fintracker && pnpm type-check --watch
```

### Linting

```bash
# Lint all code
pnpm lint

# Lint specific scope
pnpm lint --scope=@fintracker-vault/ui

# Lint with automatic fix
pnpm lint -- --fix
```

### Formatting

```bash
# Check formatting
pnpm format:check

# Auto-format all files
pnpm format

# Format specific files
pnpm format -- packages/apps/fintracker/src/**
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific scope
pnpm test -- --scope=fintracker

# Run tests in watch mode
cd packages/apps/fintracker && pnpm test --watch

# Run with coverage
pnpm test -- --coverage
```

### Building

```bash
# Build all packages and apps
pnpm build

# Build only shared packages
pnpm build --scope="@fintracker-vault/ui" --scope="@fintracker-vault/types"

# Build only one app
pnpm build:fintracker

# Build with verbose output
pnpm build --verbose
```

---

## Git Workflow

### 1. Create Feature Branch

```bash
# From main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feat/fintracker-dashboard-filters

# Branch naming convention:
# feat/description       - New feature
# fix/description        - Bug fix
# docs/description       - Documentation
# refactor/description   - Code refactoring
# test/description       - Tests
# chore/description      - Maintenance
```

### 2. Make Changes

```bash
# Stage changes
git add packages/apps/fintracker/src/components/Dashboard.tsx

# Commit with message
git commit -m "feat(fintracker): add dashboard filters

- Add date range filter
- Add category filter
- Add status filter

Closes #123"

# Commit message convention:
# type(scope): subject
# 
# body (optional)
# 
# footer (optional, reference issues)
```

### 3. Push & Create PR

```bash
# Push branch
git push origin feat/fintracker-dashboard-filters

# Go to GitHub and create Pull Request
# Title: "feat: add dashboard filters to fintracker"
# Description: Fill in template with:
# - What changed
# - Why it changed
# - How to test
# - Related issues
```

### 4. CI/CD Runs Automatically

```
✓ CI - Lint, Test, Type Check passes
✓ Code Quality & Security passes
✓ Dependency Validation passes

Waiting for review...
```

### 5. Code Review

```bash
# Reviewer may request changes
# Make updates in same branch
git add .
git commit -m "review: address feedback on dashboard filters"
git push origin feat/fintracker-dashboard-filters

# CI runs again automatically
```

### 6. Merge to Main

```bash
# Approve PR and merge
# GitHub automatically:
# - Runs full CI suite
# - Deploys to Vercel
# - Posts deployment link

# After merge, delete branch
git branch -d feat/fintracker-dashboard-filters
git push origin --delete feat/fintracker-dashboard-filters
```

### 7. Pull Latest

```bash
# Switch back to main
git checkout main

# Pull latest changes
git pull origin main

# Clean up local branches
git branch -vv  # Show tracking branches
git branch -D old-branch  # Delete local branch
```

---

## Common Development Tasks

### Task 1: Add New Component to Shared UI

```bash
# 1. Create component file
vi packages/shared/ui/src/components/Modal.tsx

# 2. Add TypeScript types
vi packages/shared/ui/src/components/Modal.tsx

# 3. Export from barrel file
vi packages/shared/ui/src/components/index.ts
# Add: export { Modal, type ModalProps } from './Modal';

# 4. Test component
cd packages/apps/fintracker
# Import and use: import { Modal } from '@fintracker-vault/ui';

# 5. Rebuild
pnpm build --scope=@fintracker-vault/ui

# 6. Commit
git commit -m "feat(ui): add Modal component"
```

### Task 2: Update Theme Colors

```bash
# 1. Update colors definition
vi packages/shared/ui/src/theme/colors.ts

# 2. Update tailwind config to export
vi packages/shared/ui/src/theme/index.ts

# 3. Apps automatically pick up changes
# (via tailwind config presets)

# 4. Rebuild and test
pnpm build
pnpm dev

# 5. Commit
git commit -m "style: update primary color palette"
```

### Task 3: Add New API Endpoint Type

```bash
# 1. Add type definition
vi packages/shared/types/src/api.ts

# 2. Export from index
vi packages/shared/types/src/index.ts

# 3. Rebuild types package
pnpm build --scope=@fintracker-vault/types

# 4. Use in app
vi packages/apps/fintracker/src/services/userService.ts
# Import: import type { UserResponse } from '@fintracker-vault/types';

# 5. Commit
git commit -m "types: add UserResponse type definition"
```

### Task 4: Create New App Feature

```bash
# 1. Create feature branch
git checkout -b feat/fintracker-budget-tracking

# 2. Create component structure
mkdir packages/apps/fintracker/src/features/budget
vi packages/apps/fintracker/src/features/budget/BudgetCard.tsx
vi packages/apps/fintracker/src/features/budget/useBudget.ts

# 3. Add to app routes
vi packages/apps/fintracker/app/budget/page.tsx

# 4. Test locally
pnpm dev:fintracker
# Visit http://localhost:3000/budget

# 5. Test types and linting
pnpm type-check
pnpm lint

# 6. Commit
git commit -m "feat(fintracker): add budget tracking feature

- Add budget overview page
- Add budget creation dialog
- Add budget editing functionality"

# 7. Push and create PR
git push origin feat/fintracker-budget-tracking
```

---

## Debugging

### Debug Next.js App

```bash
# Start with Node debugging
NODE_OPTIONS='--inspect' pnpm dev:fintracker

# Open chrome://inspect in Chrome
# Connect to Node process

# Or use VS Code:
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js Debug",
      "type": "node",
      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/next",
      "runtimeArgs": ["dev"],
      "port": 9229
    }
  ]
}
```

### Debug TypeScript Compilation

```bash
# Get detailed error info
pnpm type-check -- --pretty false

# Check specific file
cd packages/apps/fintracker
pnpm type-check -- src/components/Dashboard.tsx
```

### Debug Imports

```bash
# Check what's being resolved
node -e "
const Module = require('module');
const originalResolveFilename = Module.prototype._resolveFilename;
Module.prototype._resolveFilename = function(request, ...args) {
  if (request.startsWith('@fintracker-vault')) {
    console.log('Resolving:', request);
  }
  return originalResolveFilename.apply(this, [request, ...args]);
};
require('next/dist/server/lib/start-server');
"
```

### Check Package Resolution

```bash
# List what's installed
pnpm list '@fintracker-vault/ui'

# Check symlinks
ls -la node_modules/@fintracker-vault/

# Verify workspace registration
cat package.json | grep -A 10 '"workspaces"'
```

---

## IDE Setup

### VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "usernamehw.errorlens",
    "GitHub.copilot",
    "ms-playwright.test-explorer"
  ]
}
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "search.exclude": {
    "**/.next": true,
    "**/dist": true,
    "**/node_modules": true
  }
}
```

---

## Performance Optimization

### Analyze Bundle Size

```bash
# For Next.js app
pnpm dev:fintracker

# Use Next.js analyzer
ANALYZE=true pnpm build:fintracker
```

### Profile Build Time

```bash
# Check turbo build time
pnpm build --profile=build.json

# View results
cat build.json | jq '.tasks[] | {name: .name, duration: .duration}'
```

### Clean Build

```bash
# Clean all builds and node_modules
pnpm run clean

# Reinstall and rebuild
pnpm install
pnpm build

# Time the build
time pnpm build
```

---

## Helpful Commands Reference

```bash
# Development
pnpm dev              # Start all apps
pnpm dev:fintracker  # Start fintracker only
pnpm dev:vault       # Start vault only

# Building
pnpm build            # Build all
pnpm build:fintracker # Build fintracker only
pnpm build:vault      # Build vault only

# Code Quality
pnpm lint             # Lint all code
pnpm type-check       # Type check all
pnpm format           # Format all files
pnpm test             # Run all tests

# Cleanup
pnpm clean            # Remove build artifacts

# Packages
pnpm list             # List all packages
pnpm add <package>    # Add to root (shared deps)
pnpm --filter=<app> add <package>  # Add to specific app

# Git
git status            # Check status
git log --oneline     # View commits
git diff              # See changes
git stash             # Temporarily save changes
```

---

## Troubleshooting

### Issue: "Cannot find module '@fintracker-vault/ui'"

**Solution:**
```bash
pnpm install
pnpm build
pnpm dev
```

### Issue: "TypeScript errors in shared package"

**Solution:**
```bash
cd packages/shared/ui
pnpm build
cd ../../../
pnpm type-check
```

### Issue: "Hot reload not working"

**Solution:**
```bash
# Stop dev server
# Clear Next.js cache
rm -rf packages/apps/fintracker/.next
# Restart dev
pnpm dev:fintracker
```

### Issue: "Port 3000 already in use"

**Solution:**
```bash
# Use different port
PORT=3001 pnpm dev:fintracker

# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

---

## Getting Help

- **Documentation:** See `docs/` directory
- **Architecture:** Read `ARCHITECTURE.md`
- **Issues:** Check GitHub issues board
- **Team Chat:** Ask in #engineering channel
- **Code Review:** Request review from team lead

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Turbo Documentation](https://turbo.build/docs)
- [pnpm Documentation](https://pnpm.io/motivation)
