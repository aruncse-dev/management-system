# Neon Connection Strings: Pooler vs. Direct

## The Problem

Neon offers two connection string types, but they have different compatibility with local development:

- **Pooled connection** (`-pooler` in hostname): Optimized for serverless (Vercel)
- **Direct connection** (no `-pooler`): Required for local Node.js development

Copying the pooled connection from Neon's dashboard and using it locally causes **connection timeouts** or **endpoint option conflicts**.

## Connection String Formats

### Pooled (Vercel/Production)
```
postgresql://neondb_owner:PASSWORD@PROJECT-pooler.REGION.neon.tech/neondb?sslmode=require&channel_binding=require
```

Example:
```
postgresql://neondb_owner:npg_sUfcRy4ukn3l@ep-young-morning-apw5igb4-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Direct (Local Development) ✅
```
postgresql://neondb_owner:PASSWORD@PROJECT.REGION.neon.tech/neondb?sslmode=require&channel_binding=require
```

Example:
```
postgresql://neondb_owner:npg_sUfcRy4ukn3l@ep-young-morning-apw5igb4.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Key differences:**
- Remove `-pooler` from the hostname
- Remove any `options=endpoint%3D...` query parameters if present
- Keep `sslmode` and `channel_binding` parameters

## Setup per App

Each app needs its own `.env.local` file with the **direct connection string**:

```bash
# packages/apps/fintracker/.env.local
DATABASE_URL="postgresql://neondb_owner:PASSWORD@PROJECT.REGION.neon.tech/neondb?sslmode=require&channel_binding=require"

# packages/apps/admin/.env.local
DATABASE_URL="postgresql://neondb_owner:PASSWORD@PROJECT.REGION.neon.tech/neondb?sslmode=require&channel_binding=require"

# packages/apps/staff/.env.local
DATABASE_URL="postgresql://neondb_owner:PASSWORD@PROJECT.REGION.neon.tech/neondb?sslmode=require&channel_binding=require"

# packages/apps/vault/.env.local (does not use Neon)
# (no DATABASE_URL needed)
```

## Troubleshooting

**Error: `Connection terminated due to connection timeout`**
- You're using the pooled connection (`-pooler`). Switch to the direct connection.

**Error: `Inconsistent project name inferred from SNI`**
- The pooled hostname with endpoint options parameter is conflicting. Remove both `-pooler` and the `options=endpoint=...` parameter.

**Error: `password authentication failed`**
- The hostname format is wrong or the credentials are stale. Copy a fresh connection string from the Neon dashboard and ensure you're using the **direct** (non-pooled) format.

## How to Get the Correct String

1. Open [Neon Console](https://console.neon.tech)
2. Select your project
3. Click **Connection String** on the database card
4. Select **Direct connection** (not "Pooled connection")
5. Copy the full string
6. Use it as-is in `.env.local` (quote it due to the `&` characters)

## Why This Difference?

- **Pooled connections** use a connection proxy that manages long-lived TCP connections for serverless environments (Vercel Functions)
- **Direct connections** are raw TCP connections to the database, required by Node.js's `pg` driver for local development
- The pooler adds connection pooling overhead suitable for many short-lived requests; direct connections suit local CLI tools and long-running dev servers
