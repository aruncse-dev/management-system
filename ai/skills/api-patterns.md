# API Patterns

## Single-dispatcher pattern

Each app has **one** Next.js API route at `src/pages/api/index.ts`. All reads and writes go through this single endpoint.

- **GET** requests: `?module=<name>` query param selects the handler block
- **POST** requests: `{ action: "<name>", ...payload }` body selects the handler block

No REST-style sub-routes for data — only `src/pages/api/auth/*` and `src/pages/api/integrations/*` are separate.

### fintracker dispatcher

`packages/apps/fintracker/src/lib/fintrackerMainApi.ts` handles modules:  
`settings` | `vault` | `stocks` | `lending` | `savings` | `gold` | `loans` | `insurance` | `subscriptions` | `mutualfunds`

---

## Adding a new module

1. Add a handler block inside the main API file, guarded by `module === 'mymodule'` (GET) or `action.startsWith('mymodule/')` (POST)
2. DB queries go in `packages/shared/db/src/` — export from `src/index.ts`
3. Client-side: add a typed fetch function in `src/api.ts` (or `src/lib/fintrackerMainApi.ts` client side)

---

## Cache pattern (GET reads)

All GET handlers that are slow should use the in-memory cache pattern:

```ts
// Module-level cache (lives for the Node.js process lifetime)
const CACHE: { data: MyData[] | null; at: number } = { data: null, at: 0 }
const TTL = 5 * 60 * 1000 // 5 min

async function getMyData(orgId: string): Promise<MyData[]> {
  if (CACHE.data && Date.now() - CACHE.at < TTL) return CACHE.data
  const fresh = await db.select()...
  CACHE.data = fresh
  CACHE.at = Date.now()
  return fresh
}

function invalidateMyData() {
  CACHE.data = null
}
```

Call `invalidateMyData()` inside every POST handler that mutates the same data.

---

## Date deserialization gotcha

When cached data contains `Date` objects, JSON round-trips convert them to ISO strings. Always coerce back before formatting:

```ts
const date = new Date(row.createdAt) // row.createdAt may be string after JSON
```

---

## Auth in API routes

Every API route (except `/api/auth/*`) must verify the session:

```ts
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@fintracker-vault/auth'

const session = await getIronSession(req, res, sessionOptions('fintracker'))
if (!session.user) return res.status(401).json({ error: 'Unauthorized' })
const orgId = session.activeOrgId
```

Always scope DB queries to `orgId` — never query across all orgs.

---

## Error response shape

```ts
// Success
res.status(200).json({ data: result })

// Error
res.status(400).json({ error: 'Human-readable message' })
res.status(500).json({ error: 'Internal server error' })
```

Client code checks `response.ok` before reading `.data`.
