# Vercel Deployment Guide - Step by Step

**Status:** Ready to Deploy ✅  
**Date:** 2026-04-18  
**Repository:** fintracker-vault (monorepo with 2 apps)

---

## Prerequisites Checklist

Before starting, verify:
- [ ] GitHub repo pushed to main: `git push origin main`
- [ ] Vercel account created at https://vercel.com
- [ ] GitHub connected to Vercel account
- [ ] Owner/admin access to the fintracker-vault repo

---

## Part 1: Deploy Fintracker App

### Step 1.1: Create Fintracker Project in Vercel

1. Go to **https://vercel.com/new**
2. Look for "fintracker-vault" repository
3. Click **Select** to import it

### Step 1.2: Configure Build Settings

After clicking Select, you'll see the Import Project screen:

| Setting | Value |
|---------|-------|
| **Project Name** | `fintracker` |
| **Framework** | Next.js (auto-detected) |
| **Root Directory** | `packages/apps/fintracker` |
| **Build Command** | *(Leave blank - uses vercel.json)* |
| **Install Command** | *(Leave blank - uses vercel.json)* |
| **Output Directory** | *(Leave blank - auto-configured)* |

**Important:** The Root Directory MUST be `packages/apps/fintracker` (not the repo root)

### Step 1.3: Set Environment Variables (Fintracker)

Before clicking "Deploy", scroll down to **Environment Variables** section:

**Add these variables:**

```
Variable: NEXT_PUBLIC_API_BASE_URL
Value: https://api.fintracker.com
Environment: All (Production, Preview, Development)
```

**Note:** You can adjust the API URL later if needed. For now, use placeholder.

### Step 1.4: Deploy

1. Click the **Deploy** button
2. Wait for build to complete (5-10 minutes first time)
3. Note the deployment URL (something like: `fintracker.vercel.app`)

**If build fails:** See Troubleshooting section below

---

## Part 2: Deploy Vault App

### Step 2.1: Create Vault Project in Vercel

1. Go to **https://vercel.com/new** again
2. Look for "fintracker-vault" repository again
3. Click **Select**

### Step 2.2: Configure Build Settings (Vault)

| Setting | Value |
|---------|-------|
| **Project Name** | `vault` |
| **Framework** | Next.js (auto-detected) |
| **Root Directory** | `packages/apps/vault` |
| **Build Command** | *(Leave blank - uses vercel.json)* |
| **Install Command** | *(Leave blank - uses vercel.json)* |

### Step 2.3: Set Environment Variables (Vault)

**Add these variables:**

```
Variable: NEXT_PUBLIC_API_BASE_URL
Value: https://api.vault.com
Environment: All (Production, Preview, Development)
```

### Step 2.4: Deploy

1. Click **Deploy**
2. Wait for completion
3. Note the vault deployment URL

---

## Part 3: Configure Domains (Optional)

After both apps deploy successfully:

### For Fintracker:

1. Go to Fintracker project dashboard
2. Click **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `fintracker.com` (or your domain)
5. Follow DNS setup instructions

### For Vault:

1. Go to Vault project dashboard
2. Click **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `vault.com` (or your domain)
5. Follow DNS setup instructions

---

## Part 4: Verification & Testing

### 4.1: Check Deployment Status

For each app:
1. Go to project dashboard
2. Click **Deployments** tab
3. Verify latest deployment shows ✅ (green checkmark)

### 4.2: Test URLs

**Fintracker:**
- Production: https://fintracker.vercel.app (or your custom domain)
- Preview: https://fintracker-staging.vercel.app

**Vault:**
- Production: https://vault.vercel.app (or your custom domain)
- Preview: https://vault-staging.vercel.app

### 4.3: Verify Build Process

1. Make a small change to a file
2. Push to main branch: `git push origin main`
3. Check Vercel dashboard - should auto-deploy
4. Verify change appears in deployed app

---

## Part 5: Environment Variables - Complete Reference

### Variables by App

**Fintracker Project:**
```env
NEXT_PUBLIC_API_BASE_URL=https://api.fintracker.com
NODE_ENV=production
```

**Vault Project:**
```env
NEXT_PUBLIC_API_BASE_URL=https://api.vault.com
NODE_ENV=production
```

**Note:** NODE_ENV is usually auto-set by Vercel (production/preview/development)

### How to Update Variables

1. Go to project → **Settings** → **Environment Variables**
2. Click the variable to edit it
3. Click **Save**
4. **Important:** You must redeploy after changing variables
   - Option A: Click **Redeploy** button
   - Option B: Push a commit to trigger auto-deploy

---

## Part 6: Troubleshooting

### Build Fails: "Cannot find module '@fintracker-vault/ui'"

**Solution:**
1. Go to project Settings
2. Clear Build Cache: **Settings** → **General** → **Caches** → Clear
3. Trigger redeploy
4. Check that `next.config.js` has `transpilePackages: ["@fintracker-vault/*"]`

### Build Fails: "Root Directory not found"

**Solution:**
1. Go to project Settings
2. Verify Root Directory is EXACTLY: `packages/apps/fintracker` or `packages/apps/vault`
3. No trailing slashes or spaces
4. Redeploy

### Wrong App Deployed / Blank Page

**Solution:**
1. Verify Root Directory setting
2. Check `packages/apps/<app>/vercel.json` exists
3. Verify buildCommand is correct: `turbo run build --scope=fintracker` (or vault)
4. Clear cache and redeploy

### Environment Variables Not Working

**Solution:**
1. Verify variable names start with `NEXT_PUBLIC_` for client-side access
2. Check spelling and capitalization (case-sensitive)
3. Verify variable is set to correct environment (Production, Preview, or All)
4. Redeploy after adding/changing variables
5. Check browser console (F12) for undefined values

### Deployment Takes Too Long / Times Out

**Solution:**
1. Go to Settings → Function Timeout
2. Increase to 60 seconds (already configured in vercel.json)
3. Increase memory in vercel.json if needed
4. Check for large dependencies or slow build steps

---

## Part 7: After Deployment - Next Steps

### Immediate Tasks:
- [ ] Both apps deployed and accessible
- [ ] Test app functionality in browser
- [ ] Configure custom domains (if desired)
- [ ] Update environment variables to real API URLs
- [ ] Set up branch protection rules on GitHub

### For Phase 6 - CI/CD Setup:
- [ ] Configure GitHub Actions workflows
- [ ] Add branch protection rules
- [ ] Add CODEOWNERS file
- [ ] Set up PR preview deployments

---

## Project Dashboard Quick Links

After deploying, save these URLs:

**Fintracker:**
- Project: https://vercel.com/projects/fintracker
- Deployments: https://vercel.com/projects/fintracker/deployments
- Settings: https://vercel.com/projects/fintracker/settings

**Vault:**
- Project: https://vercel.com/projects/vault
- Deployments: https://vercel.com/projects/vault/deployments
- Settings: https://vercel.com/projects/vault/settings

---

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `turbo.json` | Build orchestration | ✅ Configured |
| `vercel.json` | Root-level Vercel config | ✅ Configured |
| `packages/apps/fintracker/vercel.json` | Fintracker build config | ✅ Configured |
| `packages/apps/vault/vercel.json` | Vault build config | ✅ Configured |
| `packages/apps/fintracker/next.config.js` | Next.js config | ✅ Has transpilePackages |
| `packages/apps/vault/next.config.js` | Next.js config | ✅ Has transpilePackages |

---

**Last Updated:** 2026-04-18  
**Ready to Deploy:** Yes ✅  
**Estimated Time:** 10-15 minutes per app
