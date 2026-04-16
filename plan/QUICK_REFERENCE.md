# Quick Reference Card for Code Agents

**Print this or keep in terminal when implementing monorepo**

---

## 📍 You Are Here

```
┌─────────────────────────────────────────────────────┐
│         FINTRACKER & VAULT MONOREPO                 │
│         Architecture Implementation                  │
│                                                      │
│  Status: ⭐ READY TO IMPLEMENT                     │
│  Total Files: 9 markdown docs                       │
│  Est. Time: 10-16 hours                            │
│  Token Budget: ~20,000 per run                      │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 The Goal

Transform **unorganized monorepo** → **properly architected monorepo**

```
BEFORE:                          AFTER:
├── theme files (scattered)      ├── packages/
├── components (mixed)           │   ├── shared/
├── types (duplicated)           │   │   ├── ui/
├── fintracker (root)            │   │   ├── types/
├── vault (submodule)            │   │   ├── config/
└── utilities (scattered)         │   │   └── utils/
                                 │   ├── apps/
                                 │   │   ├── fintracker/
                                 │   │   └── vault/
                                 │   └── tools/
                                 └── [CI/CD config]
```

---

## ⚡ Quick Start (TL;DR)

```bash
# 1. Read the plan
# File: SUMMARY.md or IMPLEMENTATION_PLAN.md

# 2. Phase 1: Create directories
mkdir -p packages/shared/{ui,types,config,utils}/src
mkdir -p packages/apps/{fintracker,vault}

# 3. Phase 2: Configure packages
# Copy templates from PACKAGE_CONFIG.md
# Create all package.json files
pnpm install

# 4. Phase 3: Create shared packages
# Use code templates from SHARED_PACKAGES_SETUP.md
pnpm run build

# 5. Phase 4: Migrate apps
# Follow APP_MIGRATION.md import patterns
pnpm type-check

# 6. Phase 5: Deploy
# Use VERCEL_DEPLOYMENT.md setup

# 7. Phase 6: CI/CD
# Copy workflow YAMLs from CI_CD_SETUP.md

# Done! ✅
```

---

## 📚 Document Quick Links

| Phase | Document | When | Key Action |
|-------|----------|------|-----------|
| **Start** | `SUMMARY.md` | Before anything | Read overview |
| **Start** | `IMPLEMENTATION_PLAN.md` | First! | Understand full plan |
| **1** | `DIRECTORY_STRUCTURE.md` | Create folders | `mkdir` commands |
| **2** | `PACKAGE_CONFIG.md` | Configure packages | Copy package.json |
| **3** | `SHARED_PACKAGES_SETUP.md` | Create shared code | Code examples |
| **4** | `APP_MIGRATION.md` | Move existing apps | Import updates |
| **5** | `VERCEL_DEPLOYMENT.md` | Deploy to Vercel | Vercel setup |
| **6** | `CI_CD_SETUP.md` | GitHub Actions | Copy YAML files |
| **Dev** | `DEVELOPMENT.md` | Daily work | Reference guide |

---

## 🔍 During Each Phase

### Do This Checklist

- [ ] Read the phase document completely
- [ ] Understand what you're doing and why
- [ ] Follow steps in order
- [ ] Test/verify after each step
- [ ] Commit changes: `git commit -m "phase-X: description"`
- [ ] Check success criteria
- [ ] Move to next phase only when current passes

### Token-Saving Tips

✅ **Read template, don't rewrite**
✅ **Use find & replace, not manual edits**
✅ **Reference docs, don't regenerate**
✅ **Make small commits between phases**
✅ **Break long tasks into chunks**

---

## ⚠️ Common Pitfalls

| Problem | Solution | Document |
|---------|----------|----------|
| Missing imports | Update all imports to `@fintracker-vault/*` | APP_MIGRATION.md |
| Circular deps | Don't import app-to-app | SHARED_PACKAGES_SETUP.md |
| Module not found | Run `pnpm install` and `pnpm build` | DIRECTORY_STRUCTURE.md |
| TypeScript errors | Check tsconfig.json extends root | PACKAGE_CONFIG.md |
| Build fails | Verify transpilePackages in next.config.js | APP_MIGRATION.md |
| Deployment fails | Check Vercel project root directory | VERCEL_DEPLOYMENT.md |

---

## 🧪 Testing Commands

Keep these commands handy:

```bash
# Verify everything works
pnpm install           # Install deps
pnpm type-check        # Check TypeScript
pnpm lint              # Check code style
pnpm build             # Build everything
pnpm dev:fintracker    # Start app 1
pnpm dev:vault         # Start app 2

# Check workspaces
pnpm list --depth=0    # List all packages

# Verify structure
ls -la packages/        # Check folders exist
ls packages/shared/*/package.json  # Check configs
```

---

## 🚨 If Something Breaks

### When you see errors:

```
1. STOP - Don't panic
2. NOTE - What document are you in?
3. READ - Find "Troubleshooting" in that document
4. CHECK - Run verification command
5. FIX - Follow solution
6. VERIFY - Run test command
7. COMMIT - If it works
```

### Most Common Issues

**"Cannot find module '@fintracker-vault/ui'"**
```bash
pnpm install
pnpm build
# Restart dev server
```

**"TypeScript errors in types"**
```bash
cd packages/shared/types
pnpm build
cd ../../..
pnpm type-check
```

**"App doesn't start"**
```bash
rm -rf packages/apps/fintracker/.next
pnpm dev:fintracker
```

---

## 📊 Progress Tracking

Print this and check off:

```
Phase 1: Directories          [ ] 1-2h
Phase 2: Packages Config      [ ] 1-2h
Phase 3: Shared Packages      [ ] 2-3h
Phase 4: App Migration        [ ] 3-4h
Phase 5: Vercel Deployment    [ ] 1-2h
Phase 6: CI/CD Setup          [ ] 2-3h
─────────────────────────────────────
TOTAL                         [ ] 10-16h
```

---

## 🎓 What You'll Learn

By implementing this:
- ✅ How to structure monorepos
- ✅ How to use workspaces (pnpm)
- ✅ How to share code across apps
- ✅ How to deploy from monorepo
- ✅ How to set up CI/CD
- ✅ Professional project organization

---

## 💾 All Files Location

All 9 markdown files are in: `/mnt/user-data/outputs/`

```
outputs/
├── SUMMARY.md                    ← Start here (overview)
├── IMPLEMENTATION_PLAN.md        ← Then read this
├── DIRECTORY_STRUCTURE.md        ← Phase 1
├── PACKAGE_CONFIG.md             ← Phase 2
├── SHARED_PACKAGES_SETUP.md      ← Phase 3
├── APP_MIGRATION.md              ← Phase 4
├── VERCEL_DEPLOYMENT.md          ← Phase 5
├── CI_CD_SETUP.md                ← Phase 6
└── DEVELOPMENT.md                ← Reference
```

---

## 🎯 Success Definition

When done, you'll have:

```
✅ Clean folder structure
✅ 4 shared packages (@fintracker-vault/*)
✅ 2 apps using shared packages
✅ Zero duplicate dependencies
✅ Automated deployments
✅ Both apps at same URL patterns
✅ Shared theme in both apps
✅ CI/CD pipeline working
✅ Team can easily understand structure
```

---

## 🔗 Key Files to Create

**Most important files:**
- `packages/shared/ui/src/theme/index.ts` - Theme exports
- `packages/shared/types/src/index.ts` - Type exports
- `packages/shared/config/src/index.ts` - Config exports
- `packages/shared/utils/src/index.ts` - Util exports
- Root `package.json` - Workspace declaration
- `turbo.json` - Build config
- `.github/workflows/` - GitHub Actions
- `vercel.json` - Vercel config

---

## 🚀 Commands You'll Use Most

```
# Starting work
pnpm dev                         # All apps
pnpm dev:fintracker             # One app
pnpm type-check                  # Verify types

# Building
pnpm build                       # All
pnpm build:fintracker            # One app

# Quality
pnpm lint                        # Check code
pnpm format                      # Fix formatting

# Cleanup
pnpm clean                       # Remove builds
pnpm install                     # Fresh install
```

---

## ⏰ Time Breakdown

```
Reading & Planning      30 min
Phase 1 (Directories)   1-2 hours
Phase 2 (Config)        1-2 hours
Phase 3 (Shared)        2-3 hours
Phase 4 (Migration)     3-4 hours
Phase 5 (Deployment)    1-2 hours
Phase 6 (CI/CD)         2-3 hours
Testing & Fixes         1-2 hours
─────────────────────────────
TOTAL                   10-16 hours
```

---

## 📝 Remember

**This is NOT production code**

These are TEMPLATES to be customized for YOUR project:
- Names: Change fintracker-vault to your namespace
- Versions: Update to latest (if needed)
- APIs: Update endpoints to yours
- Environment: Configure for your setup
- Team: Adjust CODEOWNERS for your team

---

## ✨ You've Got This!

**Next Step:**
1. Open `IMPLEMENTATION_PLAN.md`
2. Read completely
3. Start Phase 1

**Got questions?**
- Check Troubleshooting in relevant phase doc
- Re-read the relevant section
- Look at code examples

**First time getting stuck?**
It's normal! Every phase document has:
- Clear steps
- Code templates
- Success criteria
- Troubleshooting

---

**Current Token Count: ~25,000 used for full setup**
**Remaining: Plan for implementation runs**

**Status: 🟢 READY TO BEGIN**

Start with `SUMMARY.md` or `IMPLEMENTATION_PLAN.md` → Choose Phase 1 → Execute!
