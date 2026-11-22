# Enhancement plan — November 2026

Review of FinTracker, Vault and Staff, the Neon database, and the PWA cold-start
problem. **Done** items ship in this branch; everything else is the backlog, in
priority order. File references are relative to `packages/`.

- **P0**: wrong numbers, data loss, security
- **P1**: daily friction
- **P2**: new capability

---

## 1. PWA stuck on the splash screen

### Why it happened

A cold launch of the installed app had several steps that could **hang rather
than fail**. A phone whose radio is still waking up stalls requests instead of
erroring them. The splash stays up until first paint, and the "Loading…" gate
waited on a request with no upper bound. Killing and relaunching "fixed" it only
because the network was awake by then.

1. **Render-blocking third-party CSS.** `_document.tsx` loaded Google Fonts with
   a blocking `<link rel="stylesheet">`. No first paint (so no end to the splash)
   until `fonts.googleapis.com` answered.
2. **Session check with no timeout.** `AppAuthGate` awaited `/api/auth/session`
   before rendering anything. A stalled fetch meant "Loading…" forever.
3. **No service worker.** Every launch re-downloaded all JS and waited on the
   network for the HTML.
4. **Google Identity script on every launch.** `GoogleOAuthProvider` wrapped the
   whole app, so even signed-in launches fetched `accounts.google.com/gsi/client`.
5. **Large first-load JS.** `DynamicLucide` did `import * as Icons`, which put
   the whole icon library in the shared chunk.

### Done

| Change | Where |
|---|---|
| Geist is self-hosted via `next/font` (preloaded, same origin); Google Fonts link removed | `apps/*/src/pages/_app.tsx`, `_document.tsx` |
| Session check: 6s timeout per attempt, one retry, then "Can't reach the server · Retry" — never an endless spinner | `shared/ui/src/components/AppAuthGate.tsx` |
| Optimistic boot: paint the app immediately when the middleware already verified the cookie (any path ≠ `/`) or the device was signed in last time; confirm in the background | same |
| Google Identity script loads only on the login screen | same |
| Service worker: cache-first for hashed `/_next/static` and icons; network-first navigations with a 4s fallback to the last good shell; `/api` never cached | `shared/config/pwa/sw.js` → `apps/*/public/sw.js` (`pnpm pwa:sync`) |
| `sw.js` is public in middleware and served `no-cache` | `shared/auth/src/middleware.ts`, `apps/*/next.config.js` |
| API GETs time out after 20s with a readable error (POSTs are not capped, to avoid duplicate writes) | `apps/*/src/api.ts` |
| Menu icons use a static map | `shared/ui/src/components/DynamicLucide.tsx` |
| Manifest `id` set, so the installed app keeps its identity | `apps/*/public/manifest.json` |

**Measured:**
- FinTracker shared first-load JS went from 264 kB to 129 kB.
- In a headless test with the network hung, the page came from the worker cache
  in about 60 ms and showed the Retry screen after about 13s, instead of hanging.

**After deploying:** open each app once while online so the worker installs. If
a phone still misbehaves, remove the home-screen icon and add it again; this
clears an old install.

### Backlog
- **P1.** Point `start_url` straight at a page (`/attendance`, `/vault`, the
  first fintracker menu) to skip the `/` → redirect hop.
- **P2.** Offline queue for attendance marks (Background Sync).

---

## 2. Neon performance

### What the database says (2026-11-22)
- **Size.** About 1,355 transactions; every other table is under 400 rows.
  Query execution time is not the bottleneck.
- **Region.** Compute is in `aws-us-east-1`, the same region as Vercel's
  default `iad1`.
- **Missing indexes.** `transactions` showed about 16k sequential scans reading
  about 14M tuples, against 556 index scans. The hot query
  `org_id = ? AND month_year = ? ORDER BY date DESC` had no matching index.
- **Scale-to-zero.** Default suspend applies, so the first request after about
  5 idle minutes pays a compute wake-up.
- **No query stats.** `pg_stat_statements` is not installed, so real query
  timings are not available yet.

### Done (in the repo, not yet applied to production)
- `shared/db/migrations/20261122100000_perf_indexes.sql` adds 15 composite or
  org indexes that match real call sites.
- It was tested on a temporary Neon branch: the register query now uses
  `transactions_org_month_date_idx`, with 0.6 ms execution.

### Backlog (most impact first)
1. **P0. Round trips per request, not indexes.**
   - One FinTracker `summary` call runs about 37 queries.
   - `getLoanOutstanding` runs 3 times and `getIncomeExpenseTrend` twice.
   - `getAccountBalances` reads every transaction ever recorded.
   - Fix: compute each once, aggregate in SQL, and use `Promise.all` for
     independent reads (`/api/profile`, settings and months).
2. **P0. Confirm `DATABASE_URL` uses the `-pooler` host on Vercel.** The `pg`
   Pool opens a fresh TLS connection per cold lambda.
3. **P1. Cache org membership in the session for about 60s.**
   `listOrgsForUserEmail` runs on every API call; the loans page alone triggers
   7 of them.
4. **P1. More indexes from the FinTracker review.**
   - `org_members(user_email)` is hit on every request; the existing unique
     index leads with `org_id`.
   - `(org_id, transfer_to)` on transactions.
   - `(org_id, account)` and `(org_id, to_account)` on savings.
   - `(org_id)` or `(org_id, date DESC)` on the loan, repayment, subscription,
     stock and mutual-fund tables.
   - `(org_id, policy_id, date DESC)` on `insurance_premiums`.
5. **P1. Install `pg_stat_statements`.** It is one statement and writes to the
   DB, so it needs your OK. It enables real slow-query tracking.
6. **P2. Raise the compute suspend timeout** (paid plan) if the morning
   first-launch wake-up is still noticeable.
7. **P2. Upsert portfolio syncs in one statement** with unique keys
   `(org_id, provider_slug, isin)`.

---

## 3. FinTracker gaps

### P0: wrong numbers or data loss
- **Monthly opens on next month, from the 19th on.** In regular-cycle orgs the
  store seeds the month from `currentMonthYear()` without prefs (anchor 19) and
  never recomputes after `init`. `apps/fintracker/src/store/store.tsx:35`.
- **Dashboard balance ignores earlier months.** "Available / In hand" adds only
  the current cycle to the opening balance. Use lifetime
  `summary.accounts`. `pages/dashboard.tsx:137-140,213`.
- **A failed mirror sync causes duplicates.** The transaction insert and
  `syncTransactionMirror` are not in one DB transaction, so a mirror failure
  returns 500 after the row was saved and a retry duplicates it.
  `lib/fintrackerMainApi.ts:2980-3005`.
- **Inactive accounts vanish from Savings** along with their history, while net
  worth still counts them. `pages/savingspage.tsx:122,207`.
- **Deleting a loan leaves orphans.** Repayment rows and linked transactions
  stay behind, and the next save re-creates them. `fintrackerMainApi.ts:2446-2534`.
- **Unvalidated input saves as 0 or 500s.** Applies to transaction, savings and
  loan amounts and dates; Feb 31 passes `strictIsoDate`.
- **Dates and "current cycle" use UTC on the server**, so entries made between
  00:00 and 05:30 IST land on the wrong day or cycle.
- **Users with no org share one bucket.** Users without an org (or removed from
  one) read and write a shared `org_id IS NULL` bucket. Suspended users keep
  access while their session slides. `fintrackerMainApi.ts:82-99`,
  `shared/auth/src/middleware.ts`.
- **Profile PATCH replaces all org settings.** It overwrites the whole org
  `settings` JSON with no validation or role check.
  `pages/api/profile/index.ts:299-311`.

### P1: correctness and friction
- **Subscription date maths.**
  - Month-end overflow (31 Jan → 3 Mar).
  - `due = end ?? …` reports the next renewal on the end date.
  - Manual plans drop out of "upcoming".
  - All in `shared/utils/src/subscriptionCycle.ts`.
- **Jewel-loan interest is flat**, not accrued by elapsed months. Net worth
  subtracts future EMI interest and leaves out other investments.
- **Currency.** USD/AED display only swaps the symbol; non-USD subscriptions are
  summed as INR.
- **Opening balances have no UI.** Every account balance depends on them, and
  renaming an account drops its opening balance.
- **Deletes use an inline two-tap button.** Every delete should use
  `ConfirmDialog` with the item's name.
- **Loans page errors are silent.** 7 handlers have no `catch`, so errors
  disappear.
- **Two FABs on Monthly**, and FABs without the safe-area inset.
- **Components routed as pages.** `/budget`, `/transactions` and `/dashboard`
  are components living in `pages/`, so they are routable and crash when opened
  directly. Move them to `components/`.
- **Menu catalog out of sync.** The catalog and `FINTRACKER_MENUS` disagree:
  `otherinvestments` has no menu entry or nav, and `LOWERCASE_ROUTES` is stale.
- **Month navigation** is ±1 only. Add a month picker and a Today button.

### P2: features
- CSV export and backup, and bank-statement CSV import.
- Recurring transaction templates (salary, EMI, RD).
- Credit cards: statement day, due date, limit and outstanding balance (charged − paid).
- Cross-month search, a reports page (category trend, yearly or tax summary)
  and a "copy last month" budget action.
- Lending books as a table instead of two hard-coded slugs; due dates and interest.
- Gold purity per item, with a rate timestamp.
- SWR-style client cache with stale-while-revalidate, in place of `no-store`
  everywhere.

---

## 4. Vault

### Done
- **Health & Habits removed:** pages, API actions, DB helpers, Drizzle tables,
  menu catalog and nav.
  - The tables held 0 rows.
  - The drop migration `20261122101000_drop_vault_health_habits.sql` is written
    but **not applied**.
- **Blank dates fixed.** A blank DOB, expiry, issue date or maturity date used to
  make the save fail. It is now stored as NULL; malformed dates return 400.
- **Lists refresh after saving.** Persons and documents lists showed stale data
  for up to 60s after add, edit or delete; the cache is now invalidated.
- **`javascript:` links are blocked.** `openExternal` only hands off
  `tel:`, `mailto:`, `sms:`, `upi:` and `whatsapp:`. The Drive link renders only
  for http(s).
- **The vault API returns JSON errors** instead of Next's HTML 500 page.

### P0
- **List endpoints return every decrypted secret** (bank passwords, MPIN, app
  passwords), and pickers call `getApps()` just to fill a dropdown.
  - Return masked values in lists.
  - Add a `revealSecret` action.
  - Add a slim `getAppOptions`.
- **Org membership and `enabled_apps` are not checked** (the same gap as
  fintracker); a missing org falls into a shared bucket.
- **Stray insurance call in banking.** Banking `addEntry` calls
  `setInsuranceMembers` with the bank id. `apps/vault/src/lib/vaultMainApi.ts`.
- **Premium "Remove" has no confirmation**, and for mirrored premiums it unlinks
  the FinTracker transaction.

### P1
- **Re-auth before reveal or copy.** Require a PIN or Google re-auth, add a
  5-minute idle lock, and copy with clipboard auto-clear.
- **Encrypt `vault_documents.doc_number`** (Aadhaar, PAN, passport) and back-fill
  any legacy plaintext secrets.
- **Documents.**
  - Show "Expires in 12d" or "Expired", with an "Expiring soon" section.
  - Use a date input for expiry.
  - Moving a document to another person is ignored today; fix it.
- **Edit premiums.**
- **Block or cascade person deletes** that would orphan documents or policies.
- **Errors inside modals.** Show errors in the open modal, use `ConfirmDialog`,
  and add a shared safe-area FAB.
- **Nav driven by org menus.**
- **Memoise the encryption key map.** It is rebuilt on every decrypt.

### P2
- Expiry and premium-due reminders (scheduled job, push or email).
- File attachments for documents and policies (object storage).
- TOTP storage, password generator, reuse detection.
- A per-person hub page.

---

## 5. Staff

### Done
- **Attendance redesign.**
  - A **Today** checklist sits at the top of the current month.
  - Any day opens the same tap-to-toggle checklist.
  - **Mark all present** saves everyone in one request, skipping people on their
    weekly off.
  - OT and notes can be edited in place.
  - Saves are optimistic: if one fails, only that change rolls back.
- **New `setAttendanceBulk` API**, transactional, verified against Postgres on a
  temporary branch.
- **Faster loads.** The no-op `ensureMonth` round trip is gone, halving month
  load latency.
- **Strict date validation.** Day 45, Feb 31 and dates from another month are
  rejected.
- **Calendar.** Count badges, an OT colour, a legend and a today ring. Future
  days are disabled. Each cell has a spoken label ("Friday, Nov 20: 2 present,
  overtime").
- **Summary cards** show worked/expected days, respecting each person's weekly
  off.
- **Phone fixes.**
  - 44px tap targets.
  - No more `100vh` overflow under the top bar.
  - 16px inputs, so iOS stops zooming in.
  - A Today jump button.
- **Errors keep the data.** A failed load keeps the data on screen with a
  persistent Retry. A failed background refresh no longer wipes the staff list.

### P0
- **History drops staff with zero marked days.** Monthly staff with no
  attendance are missing, so the payout total is understated.
  `apps/staff/src/pages/api/index.ts:183-244`.
- **No org membership check** (same as vault).

### P1
- A per-staff month view when a summary card is tapped; a payroll breakdown
  sheet (deduction, paid leave, per-day value).
- Pay should start counting from the join date; payroll "today" should use IST,
  not UTC.
- Weekly-off shading, and an "unmarked past day" warning for monthly staff.
- A bottom tab bar instead of the drawer (3 items); a range-limited history
  query.
- Staffs form: `<form>`/Enter-to-save, required markers, and role and join date
  fields.

### P2
- A month-rate snapshot table, so a raise doesn't rewrite past months, plus a
  "mark month paid" step.
- An OT rate.
- Payslip and CSV export.
- Move the duplicated 1,900-line `globals.css` into the UI package.

---

## 6. Housekeeping found along the way
- `pnpm test`: no package defines a `test` script; `CLAUDE.md` says fintracker
  and vault have tests.
- `pnpm lint`: no package has an ESLint config, so lint (and `prepush`) fails everywhere — independent of this change. Add a root `.eslintrc` extending `next/core-web-vitals`.
- `migrations/schema.sql` needs regenerating with `export-schema` once both new
  migrations are applied.
