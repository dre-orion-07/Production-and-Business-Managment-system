# BakeFlow ERP — AI Agent Guide

## Project Summary
**BakeFlow ERP** is a production-ready, browser-only bakery management system
for a real Nigerian bakery. It is built with vanilla JavaScript (ES6+ modules),
custom CSS, and localStorage — no frameworks, no build step, no server.

**Status:** GREENFIELD
**Currency:** Nigerian Naira (₦)
**Bread Types (fixed):** mini, small, medium, big, sardine, chocolate, coconut

---

## Agent Roster

### Claude (Kiro) — Primary Implementation Agent
- **Speciality:** Full feature implementation, architecture decisions, complex business logic
- **Prompt:** `.prompts/claude-implementation.md`
- **Context to load first:** `.kb/01-project-overview.md`, `.kb/03-architecture.md`, `.kb/05-hallucination-traps.md`

### Cursor — Inline Development Agent
- **Speciality:** File-by-file coding, autocompletion, quick edits
- **Prompt:** `.prompts/cursor-bootstrap.md`
- **Context to load first:** `.kb/03-architecture.md`, `.kb/05-hallucination-traps.md`

### Gemini — Review & Audit Agent
- **Speciality:** Code review, security audit, rule violation detection
- **Prompt:** `.prompts/gemini-review.md`
- **Context to load first:** `.rules/` (all files), `.kb/05-hallucination-traps.md`

### Codex — Test Writer Agent
- **Speciality:** Unit tests, integration tests, edge case coverage
- **Prompt:** `.prompts/codex-test-writer.md`
- **Context to load first:** `.kb/06-testing-strategy.md`, `.kb/03-architecture.md`

---

## Knowledge Base Map

| File | Purpose |
|---|---|
| `.kb/01-project-overview.md` | What the app is, business rules summary, seed data |
| `.kb/02-tech-stack.md` | Languages, storage, testing, forbidden technologies |
| `.kb/03-architecture.md` | Module structure, data models, save flows, storage API |
| `.kb/04-coding-standards.md` | Style rules, naming conventions, code patterns |
| `.kb/05-hallucination-traps.md` | 15 common AI mistakes with ❌ wrong / ✅ correct examples |
| `.kb/06-testing-strategy.md` | Jest setup, what to test, Definition of Done |
| `.kb/07-decisions-and-adr.md` | Architecture Decision Records |
| `.kb/08-change-log.md` | Dated log of all KB and code changes |

## Rules Map

| File | Purpose |
|---|---|
| `.rules/01-core-protocol.mdc` | Mandatory protocol before/after any code change |
| `.rules/02-architecture-guards.mdc` | Storage, module contract, component boundary guards |
| `.rules/03-forbidden-patterns.mdc` | Patterns that must never appear in code |
| `.rules/04-self-update-protocol.mdc` | When and how to update .kb/ files |
| `.rules/05-security-and-secrets.mdc` | XSS, input validation, no external requests |

---

## Bootstrap Order (GREENFIELD)
> Complete phases in order. Do not start Phase 2 until Phase 1 is fully done and tested.

### Phase 1 — Foundation
| # | File | Description |
|---|---|---|
| 1 | `index.html` | Semantic HTML5 shell, `<div id="app">`, module script tag |
| 2 | `css/main.css` | CSS custom properties, reset, grid layout, dark/light theme |
| 3 | `js/utils.js` | `roundTo3dp`, `formatCurrency`, `toYYYYMMDD`, `generateId`, `logger`, `BREAD_TYPES`, `EXPENSE_CATEGORIES`, all validators |
| 4 | `js/storage.js` | Full localStorage service: all CRUD methods, quota guard, auto-backup, receipt counter |
| 5 | `js/router.js` | Hash-based router: `register`, `navigate`, `destroy` lifecycle |
| 6 | `js/components/modal.js` | `modal.alert`, `modal.confirm`, `modal.form` |
| 7 | `js/components/toast.js` | `toast.show(type, msg)` — success/error/warning/info |
| 8 | `js/components/table.js` | `table.render(container, config)` |
| 9 | `js/components/card.js` | Metric card for dashboard |
| 10 | `js/components/sidebar.js` | Navigation sidebar with active state |
| 11 | `js/components/navbar.js` | Top bar with theme toggle |
| 12 | `js/app.js` | Boot: init storage, seed data, init router, register all modules |
| 13 | `js/__tests__/utils.test.js` | Unit tests for all utils.js functions |
| 14 | `js/__tests__/storage.test.js` | Integration tests for all storage.js methods |

### Phase 2 — Core Modules
| # | Module | Key Behaviour |
|---|---|---|
| 1 | `batchMixes.js` | CRUD for batch recipes; 4 seed records |
| 2 | `production.js` | Select batch, enter mixes, validate ingredients, save → deduct → add to inventory |
| 3 | `inventory.js` | Display current ingredient stock; manual stock adjustments |
| 4 | `finishedInventory.js` | Current stock per bread type + history log |
| 5 | `dashboard.js` | Metrics, low-stock alerts, recent activity |

### Phase 3 — Sales & Customers
| # | Module | Key Behaviour |
|---|---|---|
| 1 | `customers.js` | CRUD, outstanding balance, record payment |
| 2 | `sales.js` | POS: customer select, multi-item, retailer pricing, previous debt, receipt |

### Phase 4 — Finance & Reporting
| # | Module | Key Behaviour |
|---|---|---|
| 1 | `expenses.js` | Categorised expenses; reduces net profit |
| 2 | `reports.js` | Time-filtered reports, CSV export |
| 3 | `dailyHistory.js` | View auto-generated daily summaries |
| 4 | `settings.js` | App config, ingredient unit costs, backup/restore |

---

## Critical Business Rules (Quick Reference)

| Rule | Detail |
|---|---|
| Ingredient math | `parseFloat((amount × mixes).toFixed(3))` — always |
| Customer outstanding | Recalculate from `debtHistory[].delta` sum — never decrement directly |
| Previous debt in POS | Adds to sale total — not informational only |
| Retailer flag | Per line item — not per customer |
| Receipt numbers | Sequential, persistent, never reset |
| Financial records | No hard delete — soft edit (voided flag) only |
| Bread types | Fixed constant — no dynamic types in v1 |
| DailyHistory | Upsert after every save — not end of day |
| All storage | Through `storage.js` only — never raw localStorage |
| Dialogs | `modal.js` only — never `alert()`/`confirm()` |

---

## Definition of Done

A feature is **complete** when ALL of the following are true:
- [ ] Business logic has passing unit tests (>90% coverage)
- [ ] Integration test covers full save flow
- [ ] All applicable edge cases tested (see `.kb/06-testing-strategy.md`)
- [ ] ESLint: zero errors
- [ ] JSDoc on all public functions
- [ ] No `console.log` in production code
- [ ] No direct `localStorage` calls outside `storage.js`
- [ ] No `alert()`/`confirm()` usage
- [ ] Works on 375px mobile viewport
- [ ] Works in dark and light theme
- [ ] Manual smoke test of happy path passes

---

## Seed Data (First Run)
On first load, `storage.seedInitialData()` inserts these batch mixes if no data exists:

```js
const SEED_BATCH_MIXES = [
  {
    name: '10kg Standard', size: '10kg',
    ingredients: {
      flour:        { amount: 9.5,  unit: 'kg' },
      wheatFlour:   { amount: 0,    unit: 'kg' },
      sugar:        { amount: 1,    unit: 'kg' },
      salt:         { amount: 0.2,  unit: 'kg' },
      yeast:        { amount: 100,  unit: 'g' },
      margarine:    { amount: 0.5,  unit: 'kg' },
      oil:          { amount: 0.5,  unit: 'liters' },
      improver:     { amount: 20,   unit: 'g' },
      preservative: { amount: 10,   unit: 'g' },
      flavour:      { amount: 10,   unit: 'ml' },
      water:        { amount: 5,    unit: 'liters' }
    }
  },
  {
    name: '12kg Standard', size: '12kg',
    ingredients: {
      flour:        { amount: 11.4, unit: 'kg' },
      wheatFlour:   { amount: 0,    unit: 'kg' },
      sugar:        { amount: 1.2,  unit: 'kg' },
      salt:         { amount: 0,    unit: 'kg' },
      yeast:        { amount: 120,  unit: 'g' },
      margarine:    { amount: 0.6,  unit: 'kg' },
      oil:          { amount: 0.6,  unit: 'liters' },
      improver:     { amount: 24,   unit: 'g' },
      preservative: { amount: 12,   unit: 'g' },
      flavour:      { amount: 0,    unit: 'ml' },
      water:        { amount: 6,    unit: 'liters' }
    }
  },
  {
    name: '14kg Standard', size: '14kg',
    ingredients: {
      flour:        { amount: 13.3, unit: 'kg' },
      wheatFlour:   { amount: 0,    unit: 'kg' },
      sugar:        { amount: 1.4,  unit: 'kg' },
      salt:         { amount: 0,    unit: 'kg' },
      yeast:        { amount: 140,  unit: 'g' },
      margarine:    { amount: 0.7,  unit: 'kg' },
      oil:          { amount: 0.7,  unit: 'liters' },
      improver:     { amount: 28,   unit: 'g' },
      preservative: { amount: 14,   unit: 'g' },
      flavour:      { amount: 0,    unit: 'ml' },
      water:        { amount: 7,    unit: 'liters' }
    }
  },
  {
    name: '16kg Standard', size: '16kg',
    ingredients: {
      flour:        { amount: 15.2, unit: 'kg' },
      wheatFlour:   { amount: 0,    unit: 'kg' },
      sugar:        { amount: 1.6,  unit: 'kg' },
      salt:         { amount: 0,    unit: 'kg' },
      yeast:        { amount: 160,  unit: 'g' },
      margarine:    { amount: 0.8,  unit: 'kg' },
      oil:          { amount: 0.8,  unit: 'liters' },
      improver:     { amount: 32,   unit: 'g' },
      preservative: { amount: 16,   unit: 'g' },
      flavour:      { amount: 0,    unit: 'ml' },
      water:        { amount: 8,    unit: 'liters' }
    }
  }
];
```
