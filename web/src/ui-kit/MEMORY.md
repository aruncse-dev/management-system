# UI Kit Memory

Last verified on 2026-03-31.

## Current State

- Shared kit lives in `web/src/ui-kit/index.tsx`.
- Existing production pages still use legacy markup.
- `web/src/pages/Components.tsx` is the verification screen for the new kit.

## Intent

- Build once, reuse everywhere.
- Move screens gradually after the kit matches the current visual language.
- Keep old UI intact until each page is reviewed.

## Notes

- Section spacing, KPI size, tab bars, forms, modals, and sheets should come from the kit.
- If a page needs a new variant, add it to the kit instead of copying markup.

