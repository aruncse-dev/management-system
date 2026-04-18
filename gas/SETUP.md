# FinTracker — GAS Backend Setup

The `gas/` folder contains the Google Apps Script backend. It exposes a JSON REST API that the React frontend calls.

---

## One-time setup (~10 minutes)

### Step 1 — Create your Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) → create a new blank spreadsheet
2. Name it **FinTracker 2026** (or anything you like)

### Step 2 — Open Apps Script
In your Google Sheet → **Extensions → Apps Script**

### Step 3 — Add the files
| File | What to do |
|------|-----------|
| `Code.gs` | Replace the default content with this file |
| `Index` (HTML) | **File → New → HTML file** → name it `Index` → paste `Index.html` |

### Step 4 — Deploy as Web App
1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone** *(must be "Anyone", not "Anyone with Google account" — the React app calls this unauthenticated)*
5. Click **Deploy** → Authorize → copy the `/exec` URL

### Step 5 — Connect to the React frontend
Paste the URL as `VITE_GAS_URL` in **repo** `.env` or `.env.local`, or in `web/.env` (Next apps merge those paths on startup and in `/api/gas-proxy`).

---

## Redeploying after code changes

From the repo root (requires `clasp` installed and authenticated):

```bash
./deploy.sh
```

This pushes the updated `Code.gs` and redeploys to the same URL.

Or manually in the Apps Script editor: **Deploy → Manage deployments** → edit → save new version.

---

## API reference

All endpoints return `{ ok: true, data: ... }` or `{ ok: false, error: "..." }`.

### GET actions (`?action=...`)

| Action | Params | Returns |
|--------|--------|---------|
| `init` | — | `{ months, budget, openingBal }` |
| `getData` | `month`, `year` | `Transaction[]` |

### POST actions (JSON body with `action` field)

| Action | Body fields | Returns |
|--------|------------|---------|
| `addRow` | `month, year, date, desc, a, c, t, m, notes` | `id` (UUID) |
| `updateRow` | `month, year, id, date, desc, a, c, t, m, notes` | `true` |
| `deleteRow` | `month, year, id` | `true` |
| `saveBudget` | `budgets` (object) | `true` |
| `saveOpeningBal` | `data` (object) | `true` |
| `ensureMonth` | `month, year` | `true` |

### Transaction fields
| Field | Description |
|-------|-------------|
| `a` | Amount (number) |
| `c` | Category |
| `t` | Type: `Expense` / `Income` / `Transfer` / `Savings` |
| `m` | Mode: `Cash` / `HDFC Bank` / `Indian Bank` / `Wallet` / `ICICI` / `HDFC` / `Bommi` / `Ramya` |

---

## Sheet structure (auto-created)

| Tab | Purpose |
|-----|---------|
| `Apr-2026`, `Mar-2026` … | One per month — transactions |
| `Budget` | Category → monthly budget amount |
| `Accounts` | Account → opening balance |

---

## Staff attendance app (`module=staff`)

Uses a **separate spreadsheet** (ID saved in the Staff Next app → Script property `STAFF_ATTENDANCE_SHEET_ID`). Deploy the same `gas/` project; no second web app required.

| Sheet | Purpose |
|-------|---------|
| `Staff` | Columns: `ID`, `Name`, `Active`, `SalaryType` (`daily` / `monthly`), `SalaryAmount` — roster |
| `Apr-2026`, … | Columns: `EntryID`, `Date`, `StaffID`, `Worked`, `Overtime` |

**GET** (query: `module=staff&action=...`): `getSettings`, `listStaff`, `getMonths`, `getAttendance` (params `month`, `year`).

**POST** (JSON body includes `module: "staff"`): `saveSettings` (`staffAttendanceSpreadsheetId`), `addStaff` (`name`, optional `salaryType`, `salaryAmount`), `updateStaff` (`id`, `name`, `salaryType`, `salaryAmount`, optional `active`), `ensureMonth` (`month`, `year`), `setAttendance` (`month`, `year`, `date`, `staffId`, `worked`, `overtime`).

Local / Vercel: same `NEXT_PUBLIC_GAS_URL` (or `VITE_GAS_URL`) as FinTracker; run **`pnpm dev:staff`** (port **3002**).
