# UI Patterns — Global Guide

Applies to all pages across `fintracker`, `vault`, `staff`, and `admin`. Every new page and component must follow these patterns. Do not introduce one-off styles or parallel design systems.

---

## Sections

Use `<SectionBlock title="...">` from `@fintracker-vault/ui` as the standard page section wrapper.

```tsx
import { SectionBlock } from '@fintracker-vault/ui'

<SectionBlock title="Recent transactions">
  {/* list content */}
</SectionBlock>
```

- Title in sentence case (`Recent transactions`, not `Recent Transactions`)
- No decorative icons in title unless the icon is semantically meaningful
- No custom heading markup — always use `SectionBlock`

---

## Lists / Data Rows

```
[icon/avatar]  [title]          [amount / badge]
               [subtitle]       [action icon]
```

- Container: `divide-y` Tailwind class; no manual border hacks
- Row layout: flex, `items-center`, `gap-3`, `py-3 px-4`
- Left slot: icon or avatar (fixed width `w-9 h-9`)
- Right slot: formatted value + optional Lucide action icon (`ChevronRight`, `Trash2`, etc.)
- **Empty state**: centered Lucide icon + short one-line message. Never leave a blank area.

```tsx
{items.length === 0 && (
  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
    <Inbox className="w-8 h-8" />
    <p className="text-sm">No items yet</p>
  </div>
)}
```

---

## FAB (Floating Action Button)

- One FAB per page maximum
- Position: `fixed bottom-20 right-4` — sits above `BottomNav`
- Style: `rounded-full bg-primary text-primary-foreground shadow-lg p-4`
- Always opens the add/create modal; never navigates

```tsx
<button
  onClick={() => setOpen(true)}
  className="fixed bottom-20 right-4 rounded-full bg-primary text-primary-foreground shadow-lg p-4"
  aria-label="Add"
>
  <Plus className="w-5 h-5" />
</button>
```

---

## Forms & Inputs

- All inputs use the `input` class from `ui-kit.css` (already globally available)
- Label always above input — never placeholder-only fields
- Required fields: add `*` inside `<label>` (`Amount *`)
- Submit: full-width on mobile (`w-full`), right-aligned on desktop inside `ModalActions`
- Never put form submission logic outside a `<form onSubmit={…}>` handler

```tsx
<label className="label" htmlFor="amount">Amount *</label>
<input id="amount" className="input" type="number" required />
```

---

## Delete / Destructive Actions

- **Always** wrap destructive operations in `<ConfirmDialog>` from `@fintracker-vault/ui`
- Confirmation text must name the item: `"Delete 'HDFC Savings'?"` — not `"Are you sure?"`
- Delete trigger button: outline + destructive color — never filled primary style
- Never trigger a delete on single click without confirmation

```tsx
import { ConfirmDialog } from '@fintracker-vault/ui'

<ConfirmDialog
  title={`Delete "${item.name}"?`}
  description="This action cannot be undone."
  onConfirm={() => handleDelete(item.id)}
>
  <button className="btn-outline-danger">Delete</button>
</ConfirmDialog>
```

---

## Modals

Use `ModalShell` + `ModalActions` from `@fintracker-vault/ui/FinanceUI`:

```tsx
import { ModalShell, ModalActions } from '@fintracker-vault/ui/FinanceUI'

<ModalShell open={open} onClose={() => setOpen(false)} title="Add loan">
  {/* form content */}
  <ModalActions>
    <button onClick={() => setOpen(false)}>Cancel</button>
    <button type="submit" className="btn-primary">Save</button>
  </ModalActions>
</ModalShell>
```

- Single-step for simple forms
- Multi-step: use `step` state (`1 | 2 | 3`) and render step content conditionally
- Backdrop click closes modal (handled by `ModalShell` — do not override)
- Do not use browser `<dialog>` or custom overlay divs

---

## KPI Dashboard Cards

```tsx
import { KpiGrid, KpiCard } from '@fintracker-vault/ui'

<KpiGrid>
  <KpiCard label="Total invested" value={formatMoney(total)} />
  <KpiCard label="Current value" value={formatMoney(current)} delta={pct} />
</KpiGrid>
```

- All dashboard summary sections use `KpiGrid` + `KpiCard`
- `value` always formatted with `useFormatMoney()` — never raw numbers
- Optional `delta` prop shows trend arrow + percentage

---

## Admin-specific patterns (packages/apps/admin)

- **Header**: `ui-kit-section` class with icon + title + `SectionChip` on the right
- **Lists**: `admin-card-list` / `admin-card-item` CSS classes — not `divide-y`
- **Modals**: `.admin-modal-wrap > .modal-shell > .modal-hd + .modal-body`
- **Buttons**: `admin-btn` / `admin-btn-danger` — not the finance app button styles
- Do not use `TransactionCard` or `KpiCard` inside admin pages
- Keep accent palette navy-forward; do not introduce new color tokens

---

## Tabs (sub-page navigation)

```tsx
type Tab = 'overview' | 'history' | 'details'
const [tab, setTab] = useState<Tab>('overview')
```

- Tabs live in page-level `useState`, not URL params (unless deep-linking is required)
- Tab bar uses `admin-internal-tabs` (admin) or standard pill tabs (finance apps)
- Each tab renders its component inline — no separate route per tab

---

## Page layout checklist

Before shipping a new page:
- [ ] Sections use `SectionBlock`
- [ ] Lists have empty states
- [ ] Add action is a FAB or a clearly labelled button (not both)
- [ ] All inputs have labels
- [ ] Deletes go through `ConfirmDialog`
- [ ] Modals use `ModalShell` + `ModalActions`
- [ ] `pnpm type-check` passes
