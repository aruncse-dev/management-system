# Legacy Google Apps Script (archived)

The **`gas/`** folder has been **removed** from this repository. The live backend is **Next.js API routes + Neon Postgres**.

## If you need the old GAS code

1. Find a **git tag** or **backup zip** from before the Neon cutover (e.g. `gas-final-v1.0.0` if you created one).
2. Check out only the `gas/` tree from that revision, or extract it from the zip.
3. Do **not** reintroduce `gas-proxy` or GAS env vars on `main` unless you are explicitly rolling back.

## Historical env names (do not use for new work)

- `VITE_GAS_URL`, `VITE_API_TOKEN`, `NEXT_PUBLIC_GAS_URL`, `GAS_EXEC_URL`

Current baseline: **`DATABASE_URL`**, **`SESSION_SECRET`**, Google OAuth keys per [`.cursor/rules/google-oauth-env.mdc`](../.cursor/rules/google-oauth-env.mdc).
