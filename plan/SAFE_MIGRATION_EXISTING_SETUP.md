# Safe Migration Guide: Existing Apps + GAS Backend + Cloudflare Proxy

**Goal:** Transform unorganized repo → professional monorepo WITHOUT breaking live features  
**Current Setup:** Fintracker & Vault on Vercel + GAS backend + Cloudflare proxy  
**New Goal:** Add staff attendance, scale safely, protect existing deployments

---

## 🎯 Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     EXISTING SETUP                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────────┐     │
│  │  Fintracker      │         │  Vault               │     │
│  │  (Vercel)        │         │  (Vercel)            │     │
│  │  Live in prod    │         │  Live in prod        │     │
│  └────────┬─────────┘         └──────────┬───────────┘     │
│           │                              │                 │
│           └──────────────┬───────────────┘                 │
│                          │                                 │
│                   Cloudflare Proxy                         │
│                   (Backend routing)                        │
│                          │                                 │
│                          ↓                                 │
│                   GAS Backend                              │
│                   (Google Apps Script)                     │
│                   - Database                               │
│                   - Business logic                         │
│                   - Authentication                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Key Concerns During Migration

```
1. ❌ DON'T break Fintracker in production
2. ❌ DON'T break Vault in production
3. ❌ DON'T disrupt GAS backend
4. ❌ DON'T break Cloudflare routing
5. ❌ DON'T lose API endpoints

Instead:
6. ✅ DO migrate code structure gradually
7. ✅ DO keep existing deployments working
8. ✅ DO test locally first
9. ✅ DO use feature flags
10. ✅ DO version API contracts
```

---

## 📋 Safe Migration Strategy

### Timeline

```
Week 1: Preparation (0% downtime risk)
├─ Create feature branches
├─ Set up local environment
├─ Create shared packages locally
└─ Test with existing apps

Week 2: Gradual Migration (0% downtime)
├─ Migrate code structure
├─ Update imports
├─ Test locally
└─ Deploy preview to Vercel

Week 3: Cutover (Minutes of risk)
├─ Final testing
├─ Deploy to production
├─ Monitor metrics
└─ Rollback plan ready

Week 4: New Module + Cleanup
├─ Add staff attendance module
├─ Verify all 3 apps working
└─ Clean up old code
```

---

## 🔐 Safety Checklist

### Before Starting Migration

```
INFRASTRUCTURE:
☐ Current Vercel deployments documented
☐ GAS backend version noted
☐ Cloudflare proxy rules exported
☐ API endpoints documented
☐ Environment variables backed up

TESTING:
☐ Production apps tested (working)
☐ Local environment set up
☐ Git repo backed up
☐ Development branch created
☐ Rollback procedure documented

TEAM:
☐ Team informed of changes
☐ Maintenance window scheduled (if needed)
☐ Rollback person assigned
☐ Slack notifications ready
```

---

## Phase 0: Preparation (BEFORE Making Changes)

### Step 0.1 - Document Current Setup

**Create:** `docs/CURRENT_ARCHITECTURE.md`

```markdown
# Current Architecture (Before Migration)

## Deployments

### Fintracker
- URL: https://fintracker.yourcompany.com
- Vercel Project ID: [get from Vercel]
- Environment: Production
- Last deploy: [date]
- Status: ✅ Live

### Vault
- URL: https://vault.yourcompany.com
- Vercel Project ID: [get from Vercel]
- Environment: Production
- Last deploy: [date]
- Status: ✅ Live

## Backend

### GAS Deployment
- GAS Script ID: [your-script-id]
- Deployment ID: [deployment-id]
- Version: [version]
- Database: [sheets/firestore]
- Status: ✅ Working

### Cloudflare Proxy
- Domain: api.yourcompany.com
- Routes: [list routes]
- Workers: [if any]
- Status: ✅ Routing

## API Endpoints

### Authenticated
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/profile

### Fintracker
- GET /api/transactions
- POST /api/transactions
- GET /api/accounts

### Vault
- GET /api/vault/items
- POST /api/vault/items

## Environment Variables

### Fintracker
- NEXT_PUBLIC_API_BASE_URL=...
- [others]

### Vault
- NEXT_PUBLIC_API_BASE_URL=...
- [others]
```

### Step 0.2 - Create Development Branch

```bash
# From your existing repo
git checkout -b feat/monorepo-migration

# Keep main branch untouched for emergency rollback
git branch -b backup/pre-monorepo
```

### Step 0.3 - Set Up Git Ignore for Safety

**File:** `.gitignore` (add if not present)

```gitignore
# Environment
.env.local
.env.*.local
.env.production.local

# Vercel
.vercel/

# Build outputs (don't commit)
.next/
dist/
build/

# Dependencies
node_modules/

# Logs
npm-debug.log*
yarn-debug.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Temporary
*.tmp
*.bak
```

### Step 0.4 - Document Current Environment Variables

**File:** `.env.example` (CREATE, DON'T commit real values)

```bash
# Vercel will inject these, but document them
NEXT_PUBLIC_API_BASE_URL=https://api.yourcompany.com

# Backend Configuration
NEXT_PUBLIC_GAS_DEPLOYMENT_ID=your-deployment-id
NEXT_PUBLIC_GAS_SCRIPT_ID=your-script-id

# Cloudflare Proxy
NEXT_PUBLIC_PROXY_URL=https://api.yourcompany.com

# Feature Flags (for gradual rollout)
NEXT_PUBLIC_USE_MONOREPO=false
NEXT_PUBLIC_USE_SHARED_THEME=false
```

---

## Phase 1: Local Preparation (Zero Risk)

### Step 1.1 - Clone and Set Up Locally

```bash
# Clone your existing repo
git clone https://github.com/yourorg/fintracker-vault.git
cd fintracker-vault

# Switch to migration branch
git checkout feat/monorepo-migration

# Install dependencies (existing setup)
pnpm install

# Verify existing apps work
pnpm dev:fintracker  # Should start on port 3000
# In another terminal
pnpm dev:vault       # Should start on port 3001

# Test APIs
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health
```

### Step 1.2 - Create Directory Structure WITHOUT Touching Existing Code

```bash
# Create new structure ALONGSIDE existing code
mkdir -p packages/shared/{ui,types,config,utils}/src
mkdir -p packages/apps/{fintracker,vault,staff-attendance}/src
mkdir -p packages/tools/{scripts,configs}

# Keep original code in old location for now
# We'll migrate gradually

# Your structure will look like:
# ├── fintracker/            (EXISTING - keep working)
# ├── vault/                 (EXISTING - keep working)
# ├── packages/              (NEW - being built)
# │   ├── shared/
# │   ├── apps/
# │   │   ├── fintracker/    (MIRROR of existing)
# │   │   ├── vault/         (MIRROR of existing)
# │   │   └── staff-attendance/ (NEW)
# │   └── tools/
# └── [other existing files]
```

### Step 1.3 - Create Shared Packages with Current API Integration

**File:** `packages/shared/config/src/api.ts`

```typescript
// CRITICAL: Match your existing API endpoints exactly!

export const apiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.yourcompany.com',
  
  // Your existing GAS endpoints
  gasDeploymentId: process.env.NEXT_PUBLIC_GAS_DEPLOYMENT_ID,
  gasScriptId: process.env.NEXT_PUBLIC_GAS_SCRIPT_ID,
  
  endpoints: {
    // Match your CURRENT endpoints exactly
    auth: {
      login: '/api/auth/login',          // YOUR existing endpoint
      logout: '/api/auth/logout',         // YOUR existing endpoint
      refresh: '/api/auth/refresh',       // YOUR existing endpoint
      profile: '/api/auth/profile',       // YOUR existing endpoint
    },
    
    // Fintracker - YOUR existing endpoints
    transactions: {
      list: '/api/transactions',
      create: '/api/transactions',
      getById: (id: string) => `/api/transactions/${id}`,
      update: (id: string) => `/api/transactions/${id}`,
      delete: (id: string) => `/api/transactions/${id}`,
    },
    
    // Vault - YOUR existing endpoints
    vault: {
      list: '/api/vault/items',
      create: '/api/vault/items',
      getById: (id: string) => `/api/vault/items/${id}`,
    },
    
    // NEW - Staff Attendance (will add)
    staff: {
      attendance: '/api/staff/attendance',
      leave: '/api/staff/leave',
      payroll: '/api/staff/payroll',
    },
  },
  
  // GAS-specific configuration
  gas: {
    proxyUrl: process.env.NEXT_PUBLIC_PROXY_URL || 'https://api.yourcompany.com',
    deploymentUrl: `https://script.google.com/macros/d/${process.env.NEXT_PUBLIC_GAS_SCRIPT_ID}/usercopy`,
  },
};
```

### Step 1.4 - Create API Client That Works with Existing Setup

**File:** `packages/shared/utils/src/api-client.ts`

```typescript
// IMPORTANT: This must work with your existing Cloudflare proxy setup

interface ApiOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export async function apiCall<T>(
  endpoint: string,
  options: ApiOptions & { method?: string } = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.yourcompany.com';
  const url = `${baseUrl}${endpoint}`;
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Include any auth tokens from existing app
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Helper for your GAS endpoints
export async function gasCall<T>(
  endpoint: string,
  options: ApiOptions & { method?: string } = {}
): Promise<T> {
  // Routes through Cloudflare proxy
  return apiCall<T>(endpoint, options);
}
```

### Step 1.5 - Test Local Setup with Existing APIs

```bash
# In packages/apps/fintracker (new location):
# Test that API calls work with existing backend

cd packages/apps/fintracker
pnpm install

# Start local dev
pnpm dev

# From browser:
curl http://localhost:3000/api/test-backend

# Should work because it routes through your Cloudflare proxy
```

---

## Phase 2: Gradual Code Migration

### Step 2.1 - Mirror Existing Code to New Location

```bash
# Copy existing code to new structure
cp -r fintracker/src/* packages/apps/fintracker/src/
cp -r vault/src/* packages/apps/vault/src/

# Copy app router
cp -r fintracker/app/* packages/apps/fintracker/app/
cp -r vault/app/* packages/apps/vault/app/

# Keep originals as backup (don't delete yet)
```

### Step 2.2 - Update Package.json Gradually

**Strategy:** Add new dependencies without removing existing ones

**For:** `packages/apps/fintracker/package.json`

```json
{
  "name": "fintracker",
  "dependencies": {
    // Keep all existing dependencies
    "next": "^14.0.0",
    "react": "^18.2.0",
    
    // NEW: Add shared packages (but they're optional)
    "@fintracker-vault/config": "workspace:*",
    "@fintracker-vault/utils": "workspace:*",
    "@fintracker-vault/types": "workspace:*",
    
    // OLD: Keep existing ones temporarily
    // These can be removed later after testing
  }
}
```

### Step 2.3 - Create Feature Flag System

**File:** `packages/shared/config/src/features.ts`

```typescript
// Use feature flags to gradually enable new code

interface FeatureFlags {
  useSharedTheme: boolean;
  useSharedTypes: boolean;
  useSharedUtils: boolean;
  useMonorepoStructure: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    // Disabled by default - enable in environment variables
    useSharedTheme: process.env.NEXT_PUBLIC_USE_SHARED_THEME === 'true',
    useSharedTypes: process.env.NEXT_PUBLIC_USE_SHARED_TYPES === 'true',
    useSharedUtils: process.env.NEXT_PUBLIC_USE_SHARED_UTILS === 'true',
    useMonorepoStructure: process.env.NEXT_PUBLIC_USE_MONOREPO === 'true',
  };
}

// Usage in component:
import { getFeatureFlags } from '@fintracker-vault/config';

function MyComponent() {
  const features = getFeatureFlags();
  
  if (features.useSharedTheme) {
    // Use new shared theme
    return <NewThemedComponent />;
  } else {
    // Use existing theme (fallback)
    return <ExistingComponent />;
  }
}
```

### Step 2.4 - Create Wrapper Components for Safe Migration

**File:** `packages/apps/fintracker/src/components/SafeComponentWrapper.tsx`

```typescript
// Wrapper that safely switches between old and new implementations

import { getFeatureFlags } from '@fintracker-vault/config';
import { Button as SharedButton } from '@fintracker-vault/ui';
import { Button as LegacyButton } from './LegacyButton';

export function Button(props: any) {
  const features = getFeatureFlags();
  
  if (features.useSharedTheme) {
    // Use new shared component
    return <SharedButton {...props} />;
  } else {
    // Fall back to existing implementation
    return <LegacyButton {...props} />;
  }
}
```

### Step 2.5 - Test Current Apps Still Work

```bash
# With features disabled (existing code path)
export NEXT_PUBLIC_USE_MONOREPO=false
export NEXT_PUBLIC_USE_SHARED_THEME=false
export NEXT_PUBLIC_USE_SHARED_UTILS=false

pnpm dev:fintracker
# Should work identically to before

pnpm dev:vault
# Should work identically to before

# Test all APIs
# They should still route through Cloudflare to GAS
```

---

## Phase 3: Parallel Testing Before Cutover

### Step 3.1 - Deploy Preview to Vercel (Don't Touch Main)

```bash
# Push feature branch
git add .
git commit -m "feat: add monorepo structure (feature flags disabled)"
git push origin feat/monorepo-migration

# Go to Vercel dashboard
# Create preview deployment from this branch
# URL: https://feat-monorepo-migration.yourvercel.app
```

### Step 3.2 - Test Preview Without Breaking Production

```
Production:  https://fintracker.yourcompany.com  (main branch - untouched)
Preview:     https://feat-monorepo-migration.yourvercel.app (your changes)

Test both simultaneously
```

### Step 3.3 - Enable Features Gradually in Preview

```bash
# In preview deployment environment variables (Vercel):
NEXT_PUBLIC_USE_SHARED_UTILS=true
NEXT_PUBLIC_USE_SHARED_TYPES=true
# Keep others disabled

# Gradually enable one at a time
# Monitor for errors
# Keep main branch unchanged
```

### Step 3.4 - Verify APIs Still Work

**Test Checklist:**
```
☐ Fintracker preview: GET /api/transactions (works)
☐ Vault preview: GET /api/vault/items (works)
☐ Both route through Cloudflare (verify headers)
☐ GAS backend responds (verify auth)
☐ Both production versions still working
```

---

## Phase 4: Add Staff Attendance Without Breaking Existing

### Step 4.1 - Create Staff Attendance Module (New App)

**File:** `packages/apps/staff-attendance/package.json`

```json
{
  "name": "staff-attendance",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "@fintracker-vault/config": "workspace:*",
    "@fintracker-vault/utils": "workspace:*",
    "@fintracker-vault/types": "workspace:*",
    "@fintracker-vault/ui": "workspace:*"
  }
}
```

### Step 4.2 - Extend Shared Types for Staff Module

**File:** `packages/shared/types/src/domain.ts` (ADD to existing)

```typescript
// Existing types...

// NEW: Staff Attendance Module
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string;
  joinDate: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: 'sick' | 'vacation' | 'personal';
  status: 'pending' | 'approved' | 'rejected';
}
```

### Step 4.3 - Extend API Config for Staff Endpoints

**File:** `packages/shared/config/src/api.ts` (EXTEND existing)

```typescript
export const apiConfig = {
  // ... existing ...
  
  endpoints: {
    // ... existing endpoints ...
    
    // NEW: Staff Attendance (goes to GAS backend)
    staff: {
      members: {
        list: '/api/staff/members',
        create: '/api/staff/members',
        getById: (id: string) => `/api/staff/members/${id}`,
      },
      attendance: {
        list: '/api/staff/attendance',
        checkIn: '/api/staff/attendance/check-in',
        checkOut: '/api/staff/attendance/check-out',
        getByDate: (date: string) => `/api/staff/attendance?date=${date}`,
      },
      leave: {
        list: '/api/staff/leave',
        request: '/api/staff/leave/request',
        approve: (id: string) => `/api/staff/leave/${id}/approve`,
      },
    },
  },
};
```

### Step 4.4 - Create Staff Module UI

**File:** `packages/apps/staff-attendance/app/page.tsx`

```typescript
import { apiCall } from '@fintracker-vault/utils';
import type { AttendanceRecord } from '@fintracker-vault/types';

export default async function StaffDashboard() {
  // Uses shared config to call existing GAS backend
  const attendance = await apiCall<AttendanceRecord[]>(
    '/api/staff/attendance'
  );
  
  return (
    <div>
      <h1>Staff Attendance</h1>
      <AttendanceList records={attendance} />
    </div>
  );
}
```

### Step 4.5 - Deploy Staff Module Without Affecting Others

```bash
# Push staff module
git add packages/apps/staff-attendance/
git commit -m "feat: add staff attendance module"
git push origin feat/monorepo-migration

# Vercel creates separate deployment for staff-attendance
# URL: https://staff-attendance.yourvercel.com

# Production deployments unaffected:
# - Fintracker still at https://fintracker.com
# - Vault still at https://vault.com
```

---

## Phase 5: Safe Cutover to Monorepo

### Step 5.1 - Final Pre-Cutover Checklist

```
BEFORE MERGING TO MAIN:

Code Quality:
☐ All tests passing
☐ No TypeScript errors
☐ ESLint check passing
☐ Preview deployments working

Functionality:
☐ Fintracker preview works identically to prod
☐ Vault preview works identically to prod
☐ Staff attendance module working
☐ All APIs routing through Cloudflare correctly
☐ GAS backend responding

Safety:
☐ Main branch backup created
☐ Rollback procedure tested
☐ Slack notifications set up
☐ Team on standby
☐ Monitoring dashboard open
```

### Step 5.2 - Gradual Feature Flag Rollout

```
Day 1: Enable in development only
  NEXT_PUBLIC_USE_SHARED_UTILS=true (dev only)

Day 2: Enable for 10% of users
  NEXT_PUBLIC_USE_SHARED_UTILS=true
  NEXT_PUBLIC_ROLLOUT_PERCENTAGE=10

Day 3: Enable for 50% of users
  NEXT_PUBLIC_ROLLOUT_PERCENTAGE=50

Day 4: Enable for 100%
  NEXT_PUBLIC_ROLLOUT_PERCENTAGE=100

If error detected at any stage:
  NEXT_PUBLIC_USE_SHARED_UTILS=false  (instant rollback)
```

### Step 5.3 - Merge to Main with Confidence

```bash
# When ready (after staged rollout)
git checkout main
git pull origin main

# Merge feature branch
git merge --no-ff feat/monorepo-migration

# Push to production
git push origin main

# Vercel automatically deploys
```

### Step 5.4 - Monitor Production

```bash
# Watch deployment status
# Go to Vercel dashboard

# Monitor metrics:
☐ Response times (should be same)
☐ Error rates (should be same)
☐ API success rate (should be same)
☐ User transactions (should continue)

# Check logs
☐ Next.js logs
☐ Vercel metrics
☐ Cloudflare analytics

# If issues, instant rollback:
git revert <merge-commit>
git push origin main
```

---

## Phase 6: Cleanup & Optimization

### Step 6.1 - Remove Old Code After Verification

Only after 1-2 weeks of stable production:

```bash
# Remove old location (keep backup in git)
rm -rf fintracker/
rm -rf vault/

# Update documentation
git add .
git commit -m "chore: remove legacy code locations after migration"
```

### Step 6.2 - Disable Feature Flags

After everything is stable:

```bash
# In packages/shared/config/src/features.ts
// Set defaults to true now

export function getFeatureFlags(): FeatureFlags {
  return {
    useSharedTheme: process.env.NEXT_PUBLIC_USE_SHARED_THEME !== 'false',
    useSharedTypes: process.env.NEXT_PUBLIC_USE_SHARED_TYPES !== 'false',
    useSharedUtils: process.env.NEXT_PUBLIC_USE_SHARED_UTILS !== 'false',
    useMonorepoStructure: process.env.NEXT_PUBLIC_USE_MONOREPO !== 'false',
  };
}

# Later, remove flags entirely
```

### Step 6.3 - Optimize Dependencies

```bash
# Remove duplicate dependencies
pnpm install
pnpm list duplicates

# Clean up unused packages
pnpm prune
```

---

## 🔄 Rollback Procedure (Use If Needed)

### Instant Rollback

```bash
# If something breaks in production
git revert <problematic-commit>
git push origin main

# Vercel automatically deploys reverted code
# Should be back to working state within 2-3 minutes

# Or manually rollback in Vercel dashboard:
# Projects → [Project] → Deployments → Click previous working deployment
```

### Full Rollback to Pre-Migration

```bash
# If you need to go completely back
git checkout backup/pre-monorepo
git push origin main --force-with-lease

# This restores original code structure
# But should NOT be needed if migration goes well
```

---

## 📊 Monitoring During Migration

### Key Metrics to Track

```
1. API Response Times
   Target: < 200ms
   Monitor: Cloudflare Analytics

2. Error Rates
   Target: < 0.1%
   Monitor: Vercel Functions errors

3. GAS Backend Response
   Target: < 500ms
   Monitor: GAS execution logs

4. User Transactions
   Target: No disruption
   Monitor: Your app analytics

5. Deployment Success
   Target: 100%
   Monitor: Vercel build logs
```

### Monitoring Commands

```bash
# Check Vercel deployment status
vercel list

# Check logs in real-time
vercel logs --follow

# Check GAS backend
# Go to Google Apps Script editor → Executions

# Check Cloudflare metrics
# Go to Cloudflare dashboard → Analytics
```

---

## 🎯 GAS Backend Integration Points

### Ensure These Don't Break

```
1. Authentication Flow
   Old: POST /api/auth/login → GAS → returns token
   New: POST /api/auth/login → Cloudflare → GAS → returns token
   ✅ No change (token format must be same)

2. Data Endpoints
   Old: GET /api/transactions → GAS → returns data
   New: GET /api/transactions → Cloudflare → GAS → returns data
   ✅ No change (response format must be same)

3. GAS Triggers
   Old: External functions call GAS directly
   New: External functions call through proxy
   ✅ No change (Cloudflare transparent)

4. Session Management
   Old: Token stored in localStorage
   New: Token format unchanged
   ✅ Fully compatible
```

### Verify Cloudflare Proxy Still Works

```bash
# Test proxy routing
curl -v https://api.yourcompany.com/api/transactions

# Should show:
# - Cloudflare headers (CF-Ray, etc.)
# - Response from GAS (original data format)
# - No errors

# Check proxy rules in Cloudflare
# Workers → [your-worker] → Review code
# Should still route to GAS correctly
```

---

## 📝 Post-Migration Checklist

### After Everything is Stable (1-2 weeks)

```
Code Quality:
☐ All legacy code references removed
☐ Shared packages exported correctly
☐ No circular dependencies
☐ Type checking passes everywhere

Documentation:
☐ README updated with new structure
☐ DEVELOPMENT.md covers all 3 apps
☐ API documentation updated
☐ GAS integration documented

Testing:
☐ All unit tests passing
☐ Integration tests with GAS passing
☐ E2E tests for critical flows
☐ Cloudflare proxy validated

Performance:
☐ Build time optimized
☐ Bundle size checked
☐ API response times baseline
☐ No regressions detected

Team:
☐ Team trained on new structure
☐ Access to documentation
☐ Deployment procedures documented
☐ Troubleshooting guide ready
```

---

## 🚨 Emergency Contacts & Procedures

### If Something Goes Wrong

```
0-5 minutes: Identify issue
├─ Check Vercel dashboard
├─ Check Cloudflare analytics
└─ Check GAS execution logs

5-15 minutes: Decide on rollback
├─ Is it reversible fix? (try fix)
├─ Or full rollback? (revert commit)
└─ Notify team immediately

15+ minutes: Execute rollback
├─ git revert <commit>
├─ git push origin main
└─ Monitor return to normal

Post-incident: Review
├─ What went wrong?
├─ How to prevent next time?
├─ Update runbooks
└─ Team debrief
```

---

## ✅ Success Criteria

### Migration is Successful When

```
✅ All 3 apps running in monorepo
✅ Fintracker works identically to before
✅ Vault works identically to before  
✅ Staff Attendance module available
✅ GAS backend integration unchanged
✅ Cloudflare proxy working
✅ All APIs functional
✅ Zero production downtime
✅ Team confident with new structure
✅ Documentation complete
```

---

## 📚 Related Documents

See also:
- `IMPLEMENTATION_PLAN.md` - Full architecture plan
- `VERCEL_DEPLOYMENT.md` - Deployment configuration
- `DEVELOPMENT.md` - Developer workflow
- `CLI_vs_CHAT_COMPARISON.md` - Tool selection
- `CLAUDE_CLI_IMPLEMENTATION.md` - CLI usage for implementation

---

## 🎯 Your Specific Setup

### Before Migration
```
fintracker/
├── app/
├── src/
├── package.json
├── next.config.js
└── vercel.json (if present)

vault/
├── app/
├── src/
├── package.json
├── next.config.js
└── vercel.json (if present)

[GAS backend somewhere - untouched]
[Cloudflare proxy - untouched]
```

### After Migration
```
packages/
├── shared/
│   ├── ui/
│   ├── types/
│   ├── config/      ← Your API config goes here
│   └── utils/
├── apps/
│   ├── fintracker/  ← Migrated code
│   ├── vault/       ← Migrated code
│   └── staff-attendance/ ← NEW module
└── tools/

[GAS backend - UNCHANGED]
[Cloudflare proxy - UNCHANGED]
```

---

**This migration protects your live apps while enabling scalability for future modules like staff attendance!**
