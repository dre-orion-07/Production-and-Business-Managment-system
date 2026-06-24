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

# BakeFlow ERP — Project Overview

## Identity
- **Project Name:** BakeFlow ERP
- **Status:** GREENFIELD
- **Purpose:** Production-ready bakery management system for a real Nigerian bakery business.
- **Target Users:** Bakery staff and owner; single-user, full-access (no roles in v1).
- **Currency:** Nigerian Naira (₦)
- **Locale:** Nigeria; mobile-first responsive design.

## What It Does
BakeFlow ERP digitises every operational step of a Nigerian bakery:

| Module | Responsibility |
|---|---|
| Dashboard | Key metrics, quick actions, low-stock alerts, recent activity |
| Batch Mixes | CRUD for recipes; ingredient ratios per batch size |
| Production | Select batch × mixes → deduct ingredients → add to finished inventory |
| Finished Bread Inventory | Stock levels per bread type + full transaction history |
| Sales (POS) | Multi-item sale, retailer pricing, debt carry-forward, receipt |
| Customers | CRUD, outstanding balance, lifetime purchases, payment recording |
| Expenses | Categorised spend; reduces net profit immediately |
| Daily History | Auto-generated daily summaries (production, sales, expenses, profit) |
| Reports | Time-filtered reports with CSV export |
| Settings | App config, data backup / restore (JSON export/import) |

## Core Workflow
```
Dashboard → Batch Mixes → Production → Finished Bread Inventory
         → Sales → Customers → Expenses → Profit
```

## Bread Types (Fixed in v1)
`mini`, `small`, `medium`, `big`, `sardine`, `chocolate`, `coconut`

> ⚠️ Bread types are **not dynamic** in v1. Do not add UI to create/delete bread types.

## Pricing Rules
- Retailer price for **small** bread: ₦450
- Non-retailer price for **small** bread: ₦500
- Retailer flag is **per line item**, not per customer.

## Key Business Rules
1. Inventory is never negative — validate before every save.
2. Ingredients used = batch ingredients × number of mixes (exact, rounded to 3 d.p.).
3. Net Profit = Revenue − Production Cost − Expenses.
4. Customer debt carries forward automatically when customer is selected at POS.
5. No deletion of financial records (sales, expenses, production) — soft edit only.
6. Receipt numbers are sequential and never reset.
7. All transactions logged with timestamp in localStorage.
8. Auto-backup on significant actions; keep last 5 backups.
9. Warn user when localStorage approaches ~5 MB limit.

## Seed Data (Bootstrap)
The following sample batch mixes are seeded on first run if no data exists:

| Name | Size | Flour | Sugar | Yeast | Margarine | Oil | Water |
|---|---|---|---|---|---|---|---|
| 10kg Standard | 10kg | 9.5 kg | 1 kg | 100 g | 0.5 kg | 0.5 L | 5 L |
| 12kg Standard | 12kg | 11.4 kg | 1.2 kg | 120 g | 0.6 kg | 0.6 L | 6 L |
| 14kg Standard | 14kg | 13.3 kg | 1.4 kg | 140 g | 0.7 kg | 0.7 L | 7 L |
| 16kg Standard | 16kg | 15.2 kg | 1.6 kg | 160 g | 0.8 kg | 0.8 L | 8 L |

## Performance Targets
- First load: < 2 s
- Subsequent navigation: < 500 ms
- CRUD operations: < 100 ms

## Phase 1 Deliverables (Foundation — must be completed first)
1. HTML/CSS scaffold + routing skeleton
2. `storage.js` — localStorage service (all reads/writes go through here)
3. `utils.js` — validation, formatting, decimal arithmetic helpers
4. Modal, Toast, Table, Card, Sidebar, Navbar components
5. Jest + jsdom test harness wired up
