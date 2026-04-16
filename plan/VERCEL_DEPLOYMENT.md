# Vercel Deployment Guide

## Overview

Deploy two independent Next.js apps (Fintracker & Vault) from single monorepo to Vercel.

---

## 1. Root Vercel Configuration

### File: `vercel.json` (at root)

```json
{
  "version": 2,
  "projectId": "WILL_BE_SET_BY_VERCEL",
  "orgId": "WILL_BE_SET_BY_VERCEL",
  "builds": [
    {
      "src": "packages/apps/fintracker/package.json",
      "use": "@vercel/next",
      "config": {
        "zeroConfig": true,
        "maxDuration": 60,
        "memory": 3008,
        "regions": ["iad1"]
      }
    },
    {
      "src": "packages/apps/vault/package.json",
      "use": "@vercel/next",
      "config": {
        "zeroConfig": true,
        "maxDuration": 60,
        "memory": 3008,
        "regions": ["iad1"]
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "status": 404
    }
  ]
}
```

---

## 2. Per-App Vercel Configuration

### Option A: Separate Vercel Projects (Recommended)

**For Fintracker:**

**File:** `packages/apps/fintracker/vercel.json`

```json
{
  "buildCommand": "turbo run build --scope=fintracker",
  "outputDirectory": "packages/apps/fintracker/.next",
  "installCommand": "pnpm install --frozen-lockfile",
  "env": {
    "NEXT_PUBLIC_API_BASE_URL": "@next_public_api_base_url_fintracker"
  }
}
```

**For Vault:**

**File:** `packages/apps/vault/vercel.json`

```json
{
  "buildCommand": "turbo run build --scope=vault",
  "outputDirectory": "packages/apps/vault/.next",
  "installCommand": "pnpm install --frozen-lockfile",
  "env": {
    "NEXT_PUBLIC_API_BASE_URL": "@next_public_api_base_url_vault"
  }
}
```

### Option B: Single Project with Routes

If using single Vercel project, route by domain/path:

```json
{
  "version": 2,
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/packages/apps/fintracker/$1",
      "headers": {
        "cache-control": "s-maxage=0"
      }
    }
  ]
}
```

---

## 3. Root Package.json Build Scripts

Update `package.json` at root:

```json
{
  "scripts": {
    "build": "turbo run build",
    "build:fintracker": "turbo run build --scope=fintracker",
    "build:vault": "turbo run build --scope=vault"
  }
}
```

---

## 4. Vercel Project Setup

### Step 4.1 - Create Fintracker Deployment

1. **Go to:** https://vercel.com/new
2. **Select:** Import Git Repository
3. **Select repo:** fintracker-vault
4. **Project Name:** fintracker
5. **Framework Preset:** Next.js
6. **Root Directory:** `packages/apps/fintracker`
7. **Build Command:** `pnpm run build:fintracker` (or use turbo)
8. **Install Command:** `pnpm install --frozen-lockfile`
9. **Output Directory:** `.next`

### Step 4.2 - Set Environment Variables for Fintracker

In Vercel Project Settings → Environment Variables:

```
NEXT_PUBLIC_API_BASE_URL = https://api.fintracker.com
NODE_ENV = production
```

### Step 4.3 - Create Vault Deployment

Repeat Step 4.1-4.2 for Vault app:

1. **Project Name:** vault
2. **Root Directory:** `packages/apps/vault`
3. **Build Command:** `pnpm run build:vault`
4. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_BASE_URL = https://api.vault.com
   NODE_ENV = production
   ```

---

## 5. GitHub Integration

### Step 5.1 - Configure Auto-Deployments

For each Vercel project:

1. **Go to:** Project Settings → Git
2. **Set Production Branch:** `main`
3. **Set Preview Branch:** All other branches
4. **Redeploy on Push:** ✓ Enabled

### Step 5.2 - Deployment Triggers

**Fintracker deploys when:**
- Changes to `packages/apps/fintracker/**`
- Changes to `packages/shared/**`
- Changes to `package.json` / lock file
- Manual redeploy

**Vault deploys when:**
- Changes to `packages/apps/vault/**`
- Changes to `packages/shared/**`
- Changes to `package.json` / lock file
- Manual redeploy

---

## 6. Custom Domains

### For Fintracker

1. **Go to:** Project Settings → Domains
2. **Add Domain:** fintracker.example.com
3. **Configure DNS** with your registrar:
   ```
   Name: fintracker
   Type: CNAME
   Value: cname.vercel-dns.com
   ```

### For Vault

1. **Go to:** Project Settings → Domains
2. **Add Domain:** vault.example.com
3. **Configure DNS**

---

## 7. Environment Variables Setup

### Root `.env.example`

```bash
# Shared config
NEXT_PUBLIC_APP_NAME=Fintracker & Vault

# Fintracker API
NEXT_PUBLIC_FINTRACKER_API_URL=https://api.fintracker.com

# Vault API
NEXT_PUBLIC_VAULT_API_URL=https://api.vault.com

# Analytics
NEXT_PUBLIC_GA_ID=ua-xxxxx

# Feature flags
NEXT_PUBLIC_ENABLE_BETA=false
```

### Vercel Environment Configuration

Create separate environment groups:

**Group: Production**
```
NEXT_PUBLIC_API_BASE_URL = https://api.example.com
NEXT_PUBLIC_DEBUG = false
```

**Group: Staging**
```
NEXT_PUBLIC_API_BASE_URL = https://staging-api.example.com
NEXT_PUBLIC_DEBUG = false
```

**Group: Development**
```
NEXT_PUBLIC_API_BASE_URL = http://localhost:3001
NEXT_PUBLIC_DEBUG = true
```

---

## 8. Build Optimization

### turbo.json Configuration

**File:** `turbo.json` (at root)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "version": "1",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": [".eslintcache"]
    },
    "type-check": {
      "outputs": [".tsbuildinfo"]
    }
  }
}
```

### Build Strategy

**For Fintracker:**
1. Install dependencies from `pnpm-lock.yaml`
2. Build shared packages (`ui`, `types`, `config`, `utils`)
3. Build fintracker app
4. Upload `.next` to Vercel

**For Vault:**
Same process, only for vault app

### Cache Configuration

- **Enable Caching:** Vercel automatically caches `node_modules` and `.next`
- **Cache Key:** Based on `pnpm-lock.yaml` hash
- **Invalidation:** Automatic when lock file changes

---

## 9. Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally
- [ ] All environment variables configured
- [ ] Build succeeds locally: `pnpm run build`
- [ ] No build warnings or errors
- [ ] Git branch is up to date

### Vercel Setup

- [ ] Fintracker project created and connected
- [ ] Vault project created and connected
- [ ] Git integration configured
- [ ] Production branches set correctly
- [ ] Environment variables configured
- [ ] Custom domains configured (if using)

### Post-Deployment

- [ ] Both apps deploy successfully
- [ ] Preview deployments work for PRs
- [ ] Production deployments work from main
- [ ] Apps load in browser correctly
- [ ] Shared theme applies correctly
- [ ] API endpoints connect properly
- [ ] No console errors in browser dev tools

---

## 10. Deployment Scenarios

### Scenario 1: Deploy Only Fintracker

When only fintracker code changes:

```bash
# GitHub detects changes to packages/apps/fintracker/**
# Vercel automatically triggers fintracker build
# Vault deployment not triggered (optimization)
```

### Scenario 2: Deploy Only Vault

When only vault code changes:

```bash
# GitHub detects changes to packages/apps/vault/**
# Vercel automatically triggers vault build
# Fintracker deployment not triggered
```

### Scenario 3: Deploy Both

When shared package changes:

```bash
# GitHub detects changes to packages/shared/**
# Both fintracker AND vault deployments triggered
# Both share the same shared package version
```

### Scenario 4: Manual Deployment

From Vercel Dashboard:

```
1. Go to Project
2. Click "Deployments"
3. Click "..." on latest deployment
4. Select "Redeploy"
```

---

## 11. Monitoring & Logs

### View Deployment Logs

1. **Go to:** Project → Deployments
2. **Click:** Deployment timestamp
3. **View:** Build logs, output logs

### Monitor Performance

1. **Go to:** Project → Analytics
2. **View:** Performance metrics, error rates
3. **Compare:** Web vitals between apps

### Set Up Alerts

In Vercel project settings:

- Build failure notifications → Slack
- Performance degradation alerts
- Error rate monitoring

---

## 12. Troubleshooting

### Issue 1: Wrong App Deploying

**Problem:** Fintracker builds deploy vault code

**Solution:**
1. Check "Root Directory" setting in Vercel project
2. Ensure correct `build` script in app's `package.json`
3. Verify `vercel.json` has correct paths
4. Redeploy manually

### Issue 2: Build Fails with Module Not Found

**Problem:** `Cannot find module '@fintracker-vault/ui'`

**Solution:**
1. Verify `transpilePackages` in `next.config.js`
2. Ensure shared packages in monorepo
3. Check `pnpm-lock.yaml` is committed
4. Run `pnpm install` locally and verify build works
5. Clear Vercel cache and redeploy:
   - Go to Settings → Advanced → Deployment Protection
   - Clear build cache

### Issue 3: Environment Variables Not Available

**Problem:** `process.env.NEXT_PUBLIC_API_BASE_URL` is undefined

**Solution:**
1. Verify variable starts with `NEXT_PUBLIC_` (for browser access)
2. Check variable is set in Vercel project settings
3. Ensure variable name matches exactly (case-sensitive)
4. Redeploy after adding variables
5. Check in browser: `console.log(process.env.NEXT_PUBLIC_API_BASE_URL)`

### Issue 4: Shared Package Updates Not Deployed

**Problem:** Changes to `@fintracker-vault/ui` not showing in apps

**Solution:**
1. Ensure shared package is rebuilt before app build
2. Check `turbo.json` dependency chain
3. Clear Vercel cache and redeploy
4. Verify `transpilePackages` includes shared packages
5. Check `pnpm-lock.yaml` includes updated version

---

## 13. Rollback Procedures

### Rollback to Previous Deployment

1. **Go to:** Project → Deployments
2. **Find:** Previous working deployment
3. **Click:** "..." → Rollback
4. **Confirm:** Rollback to this deployment

### Rollback via Git

```bash
# Revert problematic commit
git revert <commit-hash>
git push origin main

# Vercel automatically redeploys with reverted code
```

---

## 14. Production Checklist

Before deploying to production:

### Code Quality
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Code reviewed

### Configuration
- [ ] Environment variables set correctly
- [ ] API endpoints pointing to production
- [ ] Analytics configured
- [ ] Error tracking enabled

### Performance
- [ ] Build completes in < 60s
- [ ] Bundle size acceptable
- [ ] No unused dependencies
- [ ] Images optimized

### Security
- [ ] No secrets in code
- [ ] All environment variables use secrets
- [ ] HTTPS enabled for custom domains
- [ ] CORS configured correctly

### Testing
- [ ] Tested in preview environment first
- [ ] Tested in staging environment
- [ ] User acceptance testing complete
- [ ] Rollback plan documented

---

## Next Steps

1. ✅ Complete **Phase 1-4** from IMPLEMENTATION_PLAN.md
2. ✅ Verify local builds work
3. ✅ Set up Vercel projects
4. ✅ Configure environments
5. → Proceed to **CI_CD_SETUP.md** for automation

---

## Reference Commands

```bash
# Vercel CLI deployment
pnpm install -g vercel

# Deploy fintracker
cd packages/apps/fintracker && vercel --prod

# Deploy vault
cd packages/apps/vault && vercel --prod

# View logs
vercel logs fintracker --prod
vercel logs vault --prod

# Check deployment status
vercel status
```

---

## Useful Links

- [Vercel Monorepo Docs](https://vercel.com/docs/concepts/monorepos)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
