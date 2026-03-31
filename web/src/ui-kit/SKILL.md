# UI Kit Skill

Use this kit when building or reviewing shared financial UI in `web/src`.

## Goal

Keep dashboard, settings, tab bars, modals, forms, KPI cards, and section titles visually consistent by reusing the components in `web/src/ui-kit`.

## Rules

- Prefer kit components over page-local duplicated markup for new screens.
- Do not replace existing screens until the new kit is verified in `Components.tsx`.
- Keep tokens and layout styles aligned with `web/src/styles/globals.css`.
- If a pattern is missing, add it here first, then wire it into one page or the reference screen.

## Exports

- `SectionTitle`
- `KpiCard`
- `UiCard`
- `UiPill`
- `TabBar`
- `FormField`
- `ModalShell`
- `SheetShell`

## Workflow

1. Add or adjust the kit component.
2. Preview it in `web/src/pages/Components.tsx`.
3. Verify spacing, typography, and states.
4. Migrate screens one by one.

