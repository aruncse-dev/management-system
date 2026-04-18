# Vercel Quick Reference - Copy & Paste Ready

## Quick Steps Summary

### ✅ Completed Locally
- Type-check: PASSED
- Config files: ALL SET
- Git status: CLEAN (committed)

### 🚀 Ready to Deploy

---

## FINTRACKER APP - Step by Step

### 1. Create Project
- **URL:** https://vercel.com/new
- **Select:** fintracker-vault repo
- **Project Name:** `fintracker`
- **Root Directory:** `packages/apps/fintracker`

### 2. Environment Variables
```
NEXT_PUBLIC_API_BASE_URL = https://api.fintracker.com
```

### 3. Deploy
- Click Deploy button
- Wait 5-10 minutes
- Get URL: `fintracker.vercel.app`

---

## VAULT APP - Step by Step

### 1. Create Project
- **URL:** https://vercel.com/new
- **Select:** fintracker-vault repo
- **Project Name:** `vault`
- **Root Directory:** `packages/apps/vault`

### 2. Environment Variables
```
NEXT_PUBLIC_API_BASE_URL = https://api.vault.com
```

### 3. Deploy
- Click Deploy button
- Wait 5-10 minutes
- Get URL: `vault.vercel.app`

---

## Critical Settings (Don't Miss!)

| Item | Fintracker | Vault |
|------|-----------|-------|
| Root Directory | `packages/apps/fintracker` | `packages/apps/vault` |
| Project Name | `fintracker` | `vault` |
| Build Command | Leave blank | Leave blank |
| Install Command | Leave blank | Leave blank |

---

## If Build Fails

1. Go to Settings → Caches
2. Click "Clear All Caches"
3. Click "Redeploy"

---

## Verify Deployment

After deploy:
1. Visit https://fintracker.vercel.app
2. Visit https://vault.vercel.app
3. Both should load without errors

---

## Next Steps After Deploy

- [ ] Test both apps work
- [ ] Add custom domains (optional)
- [ ] Setup branch protection on GitHub
- [ ] Proceed to Phase 6 (CI/CD)

---

**Estimated Time:** 15 minutes total for both apps
