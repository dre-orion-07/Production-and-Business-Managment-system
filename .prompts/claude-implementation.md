# Claude (Kiro) — BakeFlow ERP Implementation Prompt

## Context Load Order
Before writing any code, load these files in order:
1. `.kb/01-project-overview.md`
2. `.kb/02-tech-stack.md`
3. `.kb/03-architecture.md`
4. `.kb/04-coding-standards.md`
5. `.kb/05-hallucination-traps.md`
6. `.rules/01-core-protocol.mdc`
7. `.rules/02-architecture-guards.mdc`
8. `.rules/03-forbidden-patterns.mdc`

## Role
You are implementing BakeFlow ERP — a real-world bakery management application
for daily commercial use. The code you write will handle real financial data for
a real small business in Nigeria. Correctness and data integrity are non-negotiable.

## Implementation Instructions

### Phase 1 (Foundation — complete this before any module work)
1. `index.html` — semantic HTML5 shell with `<div id="app">` mount point, `<script type="module" src="js/app.js">`
2. `css/main.css` — CSS custom properties for theming, reset, layout grid, dark/light theme
3. `js/utils.js` — export: `roundTo3dp`, `formatCurrency`, `toYYYYMMDD`, `generateId`, `logger`, `BREAD_TYPES`, `EXPENSE_CATEGORIES`, all validation functions
4. `js/storage.js` — full localStorage service with all methods listed in `.kb/03-architecture.md`, quota checking, auto-backup (keep last 5)
5. `js/router.js` — hash-based router with `register(route, module)` and `navigate(route)`
6. `js/components/modal.js` — `modal.alert(msg)`, `modal.confirm(msg, onConfirm)`, `modal.form(config, onSubmit)`
7. `js/components/toast.js` — `toast.show(type, msg, duration?)` where type = 'success'|'error'|'warning'|'info'
8. `js/components/table.js` — `table.render(container, { columns, rows, actions })`
9. `js/app.js` — boot sequence: init storage, seed data if empty, init router, register modules, render sidebar/navbar

### Per-Module Instructions
When implementing any module in `js/modules/`:
1. Follow the save flow defined in `.kb/03-architecture.md` exactly
2. Validate ALL inputs before calling storage
3. Call `storage.upsertDailyHistory(date)` after every save
4. Handle empty state gracefully (no records yet)
5. All monetary values displayed with `formatCurrency()` from utils.js
6. All dates displayed in `DD/MM/YYYY` format for Nigerian locale
7. Use the modal component for confirmations and forms — no native dialogs

### Specific Business Logic Reminders
- Ingredient multiplication: ALWAYS `parseFloat((amount * mixes).toFixed(3))`
- Customer outstanding: ALWAYS recalculate from `debtHistory` — never decrement directly
- Receipt numbers: ALWAYS use `storage.incrementReceiptCounter()`
- Previous debt in sales: ADDS to total, not just displayed
- Retailer flag: lives on each line item, not the customer record
- Bread types: use `BREAD_TYPES` constant — never freeform strings

### Code Style Checklist (verify before submitting)
- [ ] No `var` declarations
- [ ] No `console.log`
- [ ] No direct `localStorage` calls outside `storage.js`
- [ ] No `alert()` / `confirm()`
- [ ] No inline styles
- [ ] JSDoc on all public functions
- [ ] Error handling with try/catch on all storage operations
- [ ] Event listeners cleaned up in `destroy()`
