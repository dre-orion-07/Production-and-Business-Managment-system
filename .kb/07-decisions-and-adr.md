<!--
SELF-UPDATE PROTOCOL
────────────────────
When you modify any system behaviour, API contract, data model, business rule,
or architectural decision that contradicts information in this file, you MUST:
1. Update the relevant section in this file immediately.
2. Add an entry to .kb/08-change-log.md with date, author, and a one-line summary.
3. If the change introduces a new architectural decision, add an ADR to .kb/07-decisions-and-adr.md.
Failure to follow this protocol makes the knowledge base stale and causes AI hallucinations.
-->

# BakeFlow ERP — Decisions & Architecture Decision Records

## How to Add an ADR
When a significant architectural, library, or pattern decision is made:
1. Copy the template below.
2. Assign the next sequential number.
3. Fill in all fields.
4. Commit the file.

---

## ADR Template
```
## ADR-NNN: [Short Title]
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNN
- **Context:** Why does this decision need to be made?
- **Decision:** What was decided?
- **Consequences:** What are the trade-offs and implications?
```

---

## ADR-001: Vanilla JS Over Any Framework
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** BakeFlow ERP needs to run entirely offline in a browser without a build step. The bakery owner may deploy it on a USB drive or local network. Framework toolchains (React, Vue) add complexity, build requirements, and bundle size.
- **Decision:** Use plain ES6+ modules — no framework, no bundler in v1.
- **Consequences:** More boilerplate for DOM manipulation; no virtual DOM diffing; but zero build tooling, easy deployment, and complete control over bundle size.

---

## ADR-002: localStorage as Primary Storage (IndexedDB in v2)
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** The app must work fully offline. IndexedDB is more capable but async-first and more complex. localStorage is synchronous, simple, and sufficient for v1 data volumes (a single bakery's daily records).
- **Decision:** Use localStorage behind a `storage.js` abstraction. The abstraction mimics async API signatures so that a future IndexedDB migration is a drop-in replacement.
- **Consequences:** ~5 MB storage limit; must implement export-before-limit warning; data is per-browser-per-origin.

---

## ADR-003: All Storage Access Through storage.js
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** Direct `localStorage` calls scattered across modules make it impossible to audit storage operations, enforce quota checks, or migrate to IndexedDB.
- **Decision:** All reads and writes go through `storage.js`. Direct `localStorage` calls anywhere else are forbidden and caught by ESLint rule.
- **Consequences:** Slight indirection; but enables centralised quota checking, consistent serialisation, and easy migration path.

---

## ADR-004: Customer Outstanding Calculated from debtHistory Log
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** A simple `outstanding` counter that gets incremented/decremented will drift over time due to bugs, rounding, or missed updates. This creates irreconcilable discrepancies with the bakery's actual debt records.
- **Decision:** `customer.outstanding` is always recomputed by summing `customer.debtHistory[].delta`. The stored `outstanding` field is a cache; the history is the source of truth.
- **Consequences:** Slightly more computation on read; but the data is always reconcilable and auditable.

---

## ADR-005: Fixed Bread Types in v1
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** The bakery makes a fixed set of bread types. Adding dynamic bread type management (CRUD for types) adds significant complexity to inventory, sales, and reporting logic with no v1 benefit.
- **Decision:** Bread types are a hardcoded constant: `['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut']`. No UI for managing types in v1.
- **Consequences:** Fast, simple implementation; v2 can introduce a settings-managed bread type list with a migration script.

---

## ADR-006: DailyHistory Upserted After Every Mutation
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** If DailyHistory is only aggregated at end of day, the dashboard metrics will be stale throughout the day. The bakery owner needs live metrics.
- **Decision:** `storage.upsertDailyHistory(date)` is called after every `saveProduction`, `saveSale`, and `saveExpense` call.
- **Consequences:** More writes per operation; acceptable because localStorage writes are fast (<1 ms) and the aggregation is a simple reduce over day's records.

---

## ADR-007: Receipt Numbers Sequential, Never Reset
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** Sequential receipt numbers are a basic requirement for accounting and customer disputes. Resetting on app reload or date change would cause duplicate receipt numbers.
- **Decision:** A persistent counter (`BF_RECEIPT_COUNTER`) is stored in localStorage. It is only ever incremented, never reset. Receipt format: `RCP-00001`, `RCP-00002`, etc.
- **Consequences:** Counter must survive `importBackup()` — import must not overwrite the receipt counter unless the backup's counter is higher.

---

## ADR-008: No Deletion of Financial Records
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** Deleting sales, expenses, or production records would corrupt daily summaries, profit calculations, and customer debt history. It also removes the audit trail.
- **Decision:** Financial records (Sales, Expenses, Production) are immutable once saved. Corrections are handled via soft-edit (add `voided: true` flag + void reason). The UI shows "Edit" not "Delete" for these record types.
- **Consequences:** Storage grows over time; mitigated by export/import backup flow.
