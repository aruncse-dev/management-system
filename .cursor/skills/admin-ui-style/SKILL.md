---
name: admin-ui-style
description: Admin UI style and component rules for FinTracker. Use when building or reviewing admin pages, modals, lists, forms, section headers, chips, and CRUD flows in `packages/apps/admin`.
disable-model-invocation: true
---

# Admin UI Style

Use this as the single source of truth for admin interface work after the Neon migration.

## Scope

- Applies to `packages/apps/admin/src/pages/admin/**`.
- Keep `login` and `menus` UI patterns unchanged unless explicitly requested.
- Prefer incremental page-level changes over introducing new design systems.

## Required Patterns

- **Header:** Use section-style headers (`ui-kit-section`) with icon + title + right chip (`SectionChip`).
- **Lists:** Use admin list containers and rows (`admin-card-list`, `admin-card-item`) for admin entities.
- **Search:** Use existing shared search component patterns (`SearchField` / `AdminDataListSearch` where available).
- **Modals:** Use existing structure only:
  - `.admin-modal-wrap`
  - `.modal-shell`
  - `.modal-hd`
  - `.modal-body`
- **Actions:** Use existing admin button styles (`admin-btn`, `admin-btn-danger`) and `ConfirmDialog` for destructive confirmation.
- **Tabs and selection:** Use `admin-internal-tabs` for app switching and existing checkbox/select controls for menu assignment.

## Organization Flow Requirements

- Organization create flow supports:
  1. name/slug
  2. app selection
  3. menu selection by selected app(s)
- Organization list rows should follow admin entity card/list patterns.
- Edit and delete must be handled via modal + confirmation.
- Org detail should support per-app menu assignment management.

## Apps / Sections Expectations

- **Apps page:** Read-only seeded app inventory (fintracker, vault, staff).
- **Sections page:** Full CRUD with validation, modal-based editing, confirmation on delete.

## Do Not Use

- Finance-specific UI components for admin entities:
  - `TransactionCard`
  - `KpiCard`
- New one-off CSS systems or visual tokens when existing admin/ui-kit classes already solve the layout.

## Visual Consistency

- Keep accent and theme aligned with existing admin palette (navy-forward).
- Reuse existing spacing, borders, chip styles, and card rhythm from shared admin/UI kit styles.
- Avoid introducing new component variants unless there is no suitable existing pattern.

## Delivery Checklist

- Page uses existing admin/ui-kit classes and shared components.
- CRUD actions have clear success/error states.
- Destructive actions use confirmation dialogs.
- Type-check passes for the admin app.
