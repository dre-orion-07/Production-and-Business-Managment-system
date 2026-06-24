import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// Helper: create directories recursively then write file
// ---------------------------------------------------------------------------
function write(filePath, content) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  created.push(filePath);
}

const created = [];

// ===========================================================================
// KB FILE CONTENTS
// ===========================================================================

const SELF_UPDATE_HEADER = `<!--
SELF-UPDATE PROTOCOL
────────────────────
When you modify any system behaviour, API contract, data model, business rule,
or architectural decision that contradicts information in this file, you MUST:
1. Update the relevant section in this file immediately.
2. Add an entry to .kb/08-change-log.md with date, author, and a one-line summary.
3. If the change introduces a new architectural decision, add an ADR to .kb/07-decisions-and-adr.md.
Failure to follow this protocol makes the knowledge base stale and causes AI hallucinations.
-->

`;

// ===========================================================================
// .kb/01-project-overview.md
// ===========================================================================
write('.kb/01-project-overview.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Project Overview

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
\`\`\`
Dashboard → Batch Mixes → Production → Finished Bread Inventory
         → Sales → Customers → Expenses → Profit
\`\`\`

## Bread Types (Fixed in v1)
\`mini\`, \`small\`, \`medium\`, \`big\`, \`sardine\`, \`chocolate\`, \`coconut\`

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
2. \`storage.js\` — localStorage service (all reads/writes go through here)
3. \`utils.js\` — validation, formatting, decimal arithmetic helpers
4. Modal, Toast, Table, Card, Sidebar, Navbar components
5. Jest + jsdom test harness wired up
`);

// ===========================================================================
// .kb/02-tech-stack.md
// ===========================================================================
write('.kb/02-tech-stack.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Tech Stack

## Runtime Environment
- **Platform:** Browser (no Node.js runtime in production)
- **Language:** Vanilla JavaScript — ES6+ (ES modules via \`type="module"\`)
- **No framework** — no React, Vue, Angular, Svelte, or any component library

## Storage
| Layer | Technology | Notes |
|---|---|---|
| Primary | \`localStorage\` | Key-value JSON; ~5 MB limit |
| Fallback (v2) | IndexedDB | Planned; not in v1 |
| Access pattern | \`storage.js\` wrapper | **All** reads/writes MUST go through this module |

## Styling
- **Custom CSS only** — no Bootstrap, Tailwind, or any external CSS framework
- CSS custom properties (variables) for theming (dark/light)
- Mobile-first responsive layout
- CSS files scoped by concern: \`main.css\`, \`dashboard.css\`, \`inventory.css\`, \`production.css\`, \`sales.css\`, \`reports.css\`

## Testing
- **Jest** — test runner
- **jsdom** — browser environment simulation for Jest
- JSDoc comments on all public functions
- ESLint for code quality

## Build / Tooling
- No build step in v1 — plain \`.js\` ES module files loaded directly in browser
- No bundler (Webpack, Vite, Rollup) in v1
- No transpilation (Babel) — write ES6+ that browsers support natively
- No package manager lock-in beyond \`package.json\` for dev dependencies (Jest, ESLint)

## CI/CD
- None in v1

## Deployment
- Static file hosting — local web server or any static host
- No server-side code, no API endpoints, no database server

## Dev Dependencies (package.json)
\`\`\`json
{
  "devDependencies": {
    "jest": "^29.x",
    "jest-environment-jsdom": "^29.x",
    "eslint": "^8.x",
    "@eslint/js": "^8.x"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint js/**/*.js"
  },
  "jest": {
    "testEnvironment": "jsdom"
  }
}
\`\`\`

## Module System
- ES modules (\`import\`/\`export\`) in browser via \`<script type="module">\`
- Jest uses CommonJS transform for test files (jest config handles this)
- Each module exports a single default object or named functions — no global pollution

## Logging
- No \`console.log\` in production code
- Use a structured logger utility (e.g. \`logger.info()\`, \`logger.error()\`) that can be silenced in production

## No-Go List (Forbidden Technologies)
| What | Why |
|---|---|
| React / Vue / Angular | Vanilla JS only per spec |
| jQuery | ES6 DOM APIs are sufficient |
| Bootstrap / Tailwind | Custom CSS only |
| Any backend / Node API | Browser-only app |
| \`alert()\` / \`confirm()\` | Use custom modal component |
| Direct \`localStorage\` calls | Must go through \`storage.js\` |
| Inline styles in HTML | Use CSS classes |
| \`console.log\` in prod | Use structured logger |
`);

// ===========================================================================
// .kb/03-architecture.md
// ===========================================================================
write('.kb/03-architecture.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Architecture

## Pattern: Modular MVC
Each module owns its **view** (DOM rendering), **logic** (business rules), and **data interaction** (via \`storage.js\`).

\`\`\`
index.html
  └── app.js          (boot: init router, register modules, seed data)
       ├── router.js   (hash-based SPA routing)
       ├── storage.js  (ALL localStorage access — singleton)
       ├── utils.js    (pure helpers: decimal math, formatting, validation)
       └── modules/
           ├── dashboard.js
           ├── batchMixes.js
           ├── production.js
           ├── inventory.js
           ├── finishedInventory.js
           ├── sales.js
           ├── customers.js
           ├── expenses.js
           ├── reports.js
           ├── dailyHistory.js
           └── settings.js
       └── components/
           ├── modal.js
           ├── table.js
           ├── card.js
           ├── toast.js
           ├── sidebar.js
           └── navbar.js
\`\`\`

## Module Contract
Every module in \`js/modules/\` MUST export:
\`\`\`js
export default {
  init(container) {},   // called by router when route activates; receives DOM container
  destroy() {}          // called by router when route deactivates; clean up listeners
};
\`\`\`

## Routing (\`router.js\`)
- Hash-based routing (\`#/dashboard\`, \`#/sales\`, etc.)
- On hash change: call \`currentModule.destroy()\`, render new module into \`#app\`, call \`newModule.init(container)\`
- Default route: \`#/dashboard\`

## Data Layer (\`storage.js\`)
- Single source of truth for all localStorage operations
- Mimics async API call signatures for future IndexedDB migration
- Public API surface:

\`\`\`js
// Batch Mixes
storage.getBatchMixes()                    // → BatchMix[]
storage.saveBatchMix(mix)                  // → BatchMix
storage.updateBatchMix(id, updates)        // → BatchMix
storage.deleteBatchMix(id)                 // → void (only non-financial records can be deleted)

// Production
storage.getProductions(dateFilter?)        // → Production[]
storage.saveProduction(record)             // → Production (also updates ingredients + finished inv)

// Finished Inventory
storage.getFinishedInventory(date?)        // → FinishedInventory
storage.updateFinishedInventory(updates)   // → FinishedInventory

// Sales
storage.getSales(dateFilter?)              // → Sale[]
storage.saveSale(sale)                     // → Sale (also updates finished inv + customer)

// Customers
storage.getCustomers()                     // → Customer[]
storage.saveCustomer(customer)             // → Customer
storage.updateCustomer(id, updates)        // → Customer
storage.recordPayment(customerId, amount)  // → Customer

// Expenses
storage.getExpenses(dateFilter?)           // → Expense[]
storage.saveExpense(expense)               // → Expense

// Daily History
storage.getDailyHistory(date)              // → DailyHistory
storage.upsertDailyHistory(date)           // → DailyHistory (recalculates from source data)

// Settings / Config
storage.getSettings()                      // → Settings
storage.saveSettings(settings)             // → Settings

// Backup
storage.exportBackup()                     // → JSON string
storage.importBackup(jsonString)           // → void
storage.getReceiptCounter()                // → number
storage.incrementReceiptCounter()          // → number
\`\`\`

## Business Rule Enforcement Points

### Production Save Flow
\`\`\`
1. Validate: for each ingredient, check currentStock >= (batchIngredient × numberOfMixes)
2. Compute ingredientsUsed = batchIngredients × numberOfMixes (round each to 3 d.p.)
3. Deduct ingredientsUsed from ingredient inventory
4. Add output counts to FinishedInventory for today's date
5. Append history entry: { type: "production", ... }
6. Save Production record
7. Upsert DailyHistory for today
8. Auto-backup
\`\`\`

### Sale Save Flow
\`\`\`
1. Validate: for each line item, finishedInventory[breadType] >= quantity
2. Deduct each line item from FinishedInventory
3. Append history entry: { type: "sale", ... }
4. If customerId set: update customer outstanding += (totalAmount - amountPaid)
5. Apply previousDebtApplied to customer outstanding
6. Increment + assign receipt number
7. Save Sale record
8. Upsert DailyHistory for today
9. Auto-backup
\`\`\`

### Customer Outstanding Calculation
> **Always recalculate from transaction history — never rely on a simple decrement.**
\`\`\`js
customer.outstanding = customer.debtHistory.reduce((acc, tx) => acc + tx.delta, 0);
\`\`\`

### Net Profit Calculation
\`\`\`
Gross Profit  = Total Revenue − Total Production Cost
Net Profit    = Gross Profit − Total Expenses
Profit Margin = (Net Profit / Total Revenue) × 100
\`\`\`
Recalculate whenever a sale, production record, or expense is saved.

## Data Models

### BatchMix
\`\`\`js
{
  id: string,           // uuid or timestamp-based
  name: string,         // "10kg Standard"
  size: string,         // "10kg" | "12kg" | "14kg" | "16kg"
  ingredients: {
    flour:        { amount: number, unit: "kg" },
    wheatFlour:   { amount: number, unit: "kg" },
    sugar:        { amount: number, unit: "kg" },
    salt:         { amount: number, unit: "kg" },
    yeast:        { amount: number, unit: "g" },
    margarine:    { amount: number, unit: "kg" },
    oil:          { amount: number, unit: "liters" },
    improver:     { amount: number, unit: "g" },
    preservative: { amount: number, unit: "g" },
    flavour:      { amount: number, unit: "ml" },
    water:        { amount: number, unit: "liters" }
  },
  totalCost: number,
  createdAt: string,  // ISO date string
  updatedAt: string
}
\`\`\`

### Production
\`\`\`js
{
  id: string,
  batchId: string,
  batchName: string,
  numberOfMixes: number,
  date: string,           // ISO date string
  ingredientsUsed: { /* same keys as batch ingredients, multiplied */ },
  output: { mini, small, medium, big, sardine, chocolate, coconut },
  totalOutput: number,
  productionCost: number,
  createdAt: string
}
\`\`\`

### FinishedInventory (singleton-per-day)
\`\`\`js
{
  id: string,
  date: string,         // "YYYY-MM-DD" — NOT a Date object
  mini: number,
  small: number,
  medium: number,
  big: number,
  sardine: number,
  chocolate: number,
  coconut: number,
  lastUpdated: string,
  history: [
    { type: "production" | "sale", quantity: number, breadType: string, timestamp: string, reference: string }
  ]
}
\`\`\`

### Sale
\`\`\`js
{
  id: string,
  customerId: string | null,
  customerName: string,
  items: [{ breadType, quantity, unitPrice, isRetailer, subtotal }],
  totalAmount: number,
  amountPaid: number,
  outstanding: number,
  paymentMethod: "cash" | "transfer" | "debt",
  previousDebtApplied: number,
  previousDebtDisplayed: boolean,
  date: string,
  receiptNumber: string,    // sequential, never resets
  createdAt: string
}
\`\`\`

### Customer
\`\`\`js
{
  id: string,
  name: string,
  phone: string,
  address: string,
  notes: string,
  outstanding: number,       // always recalculate from debtHistory
  lifetimePurchases: number,
  totalPaid: number,
  createdAt: string,
  updatedAt: string,
  purchaseHistory: [],
  paymentHistory: [],
  debtHistory: []            // { delta: number, timestamp: string, reference: string }
}
\`\`\`

### Expense
\`\`\`js
{
  id: string,
  category: "gas" | "packaging" | "fuel" | "salary" | "repairs" |
            "electricity" | "maintenance" | "owner_withdrawal" | "miscellaneous",
  amount: number,
  description: string,
  date: string,
  createdAt: string
}
\`\`\`

### DailyHistory
\`\`\`js
{
  id: string,
  date: string,  // "YYYY-MM-DD"
  production: {
    batches: [],
    totalItemsProduced: { mini, small, medium, big, sardine, chocolate, coconut },
    totalProductionCost: number
  },
  sales: {
    totalRevenue: number,
    totalItemsSold: number,
    totalDebtCreated: number,
    totalDebtCleared: number
  },
  expenses: {
    totalExpenses: number,
    breakdown: { gas, packaging, fuel, salary, repairs, electricity, maintenance, owner_withdrawal, miscellaneous }
  },
  profit: {
    grossProfit: number,
    netProfit: number,
    profitMargin: number
  },
  openingCash: number,
  closingCash: number
}
\`\`\`

## Component Architecture
All UI primitives live in \`js/components/\`:

| Component | Responsibility |
|---|---|
| \`modal.js\` | Replaces \`alert()\`/\`confirm()\` — must be used for ALL dialog interactions |
| \`toast.js\` | Non-blocking user feedback (success, error, warning, info) |
| \`table.js\` | Reusable sortable/filterable table renderer |
| \`card.js\` | Metric card for dashboard |
| \`sidebar.js\` | Navigation sidebar with active route highlighting |
| \`navbar.js\` | Top navigation bar |

## Seed Data Bootstrap (app.js)
On first load (\`localStorage\` empty), \`app.js\` calls \`storage.seedInitialData()\` which inserts:
- 4 BatchMix records (10kg, 12kg, 14kg, 16kg Standard)
- Empty ingredient inventory with all keys initialised to 0
- Empty FinishedInventory record for today
- Default Settings object
`);

// ===========================================================================
// .kb/04-coding-standards.md
// ===========================================================================
write('.kb/04-coding-standards.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Coding Standards

## Language Rules
- ES6+ only — use \`const\`/\`let\`, arrow functions, template literals, destructuring, spread, optional chaining (\`?.\`), nullish coalescing (\`??\`)
- No \`var\`
- No TypeScript (vanilla JS) — use JSDoc for type hints
- Strict equality: always \`===\` and \`!==\`

## File & Module Conventions
- One module per file; file name matches module name (camelCase)
- All modules use ES \`import\`/\`export\`
- No global variables — export functions/objects explicitly
- Max file length: 400 lines; split into sub-modules if exceeded

## Naming Conventions
| Thing | Convention | Example |
|---|---|---|
| Variables | camelCase | \`totalAmount\` |
| Functions | camelCase | \`calculateNetProfit()\` |
| Classes | PascalCase | \`StorageService\` |
| Constants | SCREAMING_SNAKE | \`MAX_BACKUP_COUNT\` |
| CSS classes | kebab-case | \`sales-card\` |
| Data model keys | camelCase | \`createdAt\`, \`breadType\` |
| localStorage keys | SCREAMING_SNAKE with \`BF_\` prefix | \`BF_BATCH_MIXES\`, \`BF_SALES\` |

## JSDoc Requirements
All public functions and data models must have JSDoc:
\`\`\`js
/**
 * Calculates net profit for a date range.
 * @param {string} startDate - ISO date string
 * @param {string} endDate   - ISO date string
 * @returns {{ grossProfit: number, netProfit: number, profitMargin: number }}
 */
function calculateNetProfit(startDate, endDate) { ... }
\`\`\`

## Error Handling
- Wrap all storage operations in try/catch
- Surface user-facing errors through \`toast.show('error', message)\` — never use \`alert()\`
- Log errors through the structured logger, not \`console.log\`
- Never swallow errors silently

## Decimal Arithmetic Rule (Critical)
\`\`\`js
// ❌ WRONG — floating point drift
const used = batch.flour.amount * numberOfMixes; // 9.5 * 3 = 28.499999...

// ✅ CORRECT — round to 3 decimal places after multiplication
const used = parseFloat((batch.flour.amount * numberOfMixes).toFixed(3));
\`\`\`
Apply \`toFixed(3)\` after every multiplication involving ingredient amounts.

## DOM Manipulation
- Use \`document.createElement\` and \`element.appendChild\` — avoid \`innerHTML\` for user-supplied data (XSS risk)
- \`innerHTML\` is acceptable only for static, developer-controlled strings
- Always sanitise before inserting user input into DOM

## CSS Rules
- No inline styles — use CSS classes
- Use CSS custom properties for all colours, spacing, and font sizes
- Mobile-first: base styles for mobile, \`@media (min-width: 768px)\` for desktop
- Dark/light theme via \`data-theme="dark"\` on \`<html>\`

## Event Listeners
- Remove event listeners in \`module.destroy()\` to prevent memory leaks
- Use event delegation on container elements where possible

## Storage Access
\`\`\`js
// ❌ WRONG — direct localStorage access
localStorage.setItem('sales', JSON.stringify(sales));

// ✅ CORRECT — always through storage module
import storage from '../storage.js';
storage.saveSale(sale);
\`\`\`

## No alert() / confirm()
\`\`\`js
// ❌ WRONG
if (confirm('Delete this record?')) { ... }

// ✅ CORRECT
import modal from '../components/modal.js';
modal.confirm('Delete this record?', () => { ... });
\`\`\`

## Logger Usage
\`\`\`js
// ❌ WRONG
console.log('Sale saved', sale);

// ✅ CORRECT
import logger from '../utils.js';
logger.info('Sale saved', { id: sale.id, amount: sale.totalAmount });
\`\`\`

## Immutability in Data Updates
Always create a new object rather than mutating in place:
\`\`\`js
// ❌ WRONG
customer.outstanding -= payment;

// ✅ CORRECT
const updated = { ...customer, outstanding: recalculateOutstanding(customer) };
storage.updateCustomer(customer.id, updated);
\`\`\`
`);

// ===========================================================================
// .kb/05-hallucination-traps.md
// ===========================================================================
write('.kb/05-hallucination-traps.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Hallucination Traps

> These are the most common mistakes AI agents make on this codebase.
> Every trap includes the WRONG pattern and the CORRECT replacement.

---

## Trap 1: Floating-Point Ingredient Multiplication
**Context:** Multiplying batch ingredients by number of mixes.

\`\`\`js
// ❌ WRONG — 9.5 × 3 produces 28.499999999999996
const flourUsed = batch.ingredients.flour.amount * numberOfMixes;

// ✅ CORRECT — always round to 3 decimal places
const flourUsed = parseFloat((batch.ingredients.flour.amount * numberOfMixes).toFixed(3));
\`\`\`

---

## Trap 2: Decrementing Customer Outstanding Directly
**Context:** Recording a payment or adding debt to a customer.

\`\`\`js
// ❌ WRONG — balance drifts over time due to missed updates
customer.outstanding -= paymentAmount;

// ✅ CORRECT — recalculate from the immutable debtHistory log
function recalculateOutstanding(customer) {
  return customer.debtHistory.reduce((acc, tx) => acc + tx.delta, 0);
}
const updated = { ...customer, outstanding: recalculateOutstanding(customer) };
\`\`\`

---

## Trap 3: Using Date Objects as localStorage Keys
**Context:** Keying DailyHistory or FinishedInventory by date.

\`\`\`js
// ❌ WRONG — Date.toString() output varies by locale/timezone
const key = new Date().toString(); // "Mon Jul 07 2025 14:32:00 GMT+0100"

// ✅ CORRECT — always use YYYY-MM-DD string
const key = new Date().toISOString().split('T')[0]; // "2025-07-07"
\`\`\`

---

## Trap 4: Retailer Flag on Customer Instead of Line Item
**Context:** Applying retailer pricing in the Sales (POS) module.

\`\`\`js
// ❌ WRONG — assumes retailer status is a customer property
const price = customer.isRetailer ? RETAILER_PRICE : NORMAL_PRICE;

// ✅ CORRECT — retailer flag lives on each line item
const price = lineItem.isRetailer ? 450 : 500; // for small bread
\`\`\`

---

## Trap 5: Calling localStorage Directly
**Context:** Any read or write of persistent data.

\`\`\`js
// ❌ WRONG — bypasses storage.js abstraction
const sales = JSON.parse(localStorage.getItem('sales') || '[]');

// ✅ CORRECT — always use the storage module
import storage from '../storage.js';
const sales = storage.getSales();
\`\`\`

---

## Trap 6: Using alert() or confirm() for User Interaction
**Context:** Any confirmation dialog or error message.

\`\`\`js
// ❌ WRONG
if (confirm('Are you sure you want to delete this expense?')) {
  deleteExpense(id);
}

// ✅ CORRECT
import modal from '../components/modal.js';
modal.confirm('Are you sure you want to delete this expense?', () => deleteExpense(id));
\`\`\`

---

## Trap 7: Deleting Financial Records
**Context:** Adding delete buttons to sales, expenses, or production records.

\`\`\`js
// ❌ WRONG — financial records must never be hard-deleted
storage.deleteSale(id);

// ✅ CORRECT — use soft edit (mark as voided, keep the record)
storage.updateSale(id, { voided: true, voidedAt: new Date().toISOString(), voidReason: reason });
\`\`\`

---

## Trap 8: Resetting the Receipt Counter
**Context:** Generating receipt numbers.

\`\`\`js
// ❌ WRONG — receipt numbers must never reset
let receiptCounter = 1;

// ✅ CORRECT — read from persistent storage and always increment
const nextNumber = storage.incrementReceiptCounter(); // reads BF_RECEIPT_COUNTER, adds 1, saves back
const receiptNumber = \`RCP-\${String(nextNumber).padStart(5, '0')}\`;
\`\`\`

---

## Trap 9: Computing Finished Inventory from a Simple Counter
**Context:** Updating bread stock levels.

\`\`\`js
// ❌ WRONG — counter drifts; cannot reconcile
finishedInventory.small -= saleQuantity;

// ✅ CORRECT — recompute from history log
function computeStock(history, breadType) {
  return history
    .filter(tx => tx.breadType === breadType)
    .reduce((acc, tx) => acc + (tx.type === 'production' ? tx.quantity : -tx.quantity), 0);
}
\`\`\`

---

## Trap 10: Previous Debt is Informational Only
**Context:** Displaying customer's existing debt in the Sales POS.

\`\`\`js
// ❌ WRONG — previous debt is shown but not added to the total
sale.totalAmount = itemsTotal;
// debt displayed separately

// ✅ CORRECT — previous debt increases the total amount owed
sale.totalAmount = itemsTotal + customer.outstanding;
sale.previousDebtApplied = customer.outstanding;
sale.previousDebtDisplayed = true;
\`\`\`

---

## Trap 11: Production Cost is Zero When Unit Costs Not Set
**Context:** Calculating cost of a production run.

\`\`\`js
// ❌ WRONG — throws or produces NaN when unitCost is undefined
const cost = batch.ingredients.flour.amount * settings.unitCosts.flour;

// ✅ CORRECT — default to 0 and warn user
const flourCost = settings.unitCosts?.flour ?? 0;
if (flourCost === 0) {
  toast.show('warning', 'Ingredient unit costs not set. Production cost recorded as ₦0. Set costs in Settings.');
}
const cost = batch.ingredients.flour.amount * flourCost;
\`\`\`

---

## Trap 12: DailyHistory Aggregation Only Runs at End of Day
**Context:** When to call \`upsertDailyHistory()\`.

\`\`\`js
// ❌ WRONG — only aggregates once at midnight
schedule.daily(() => storage.upsertDailyHistory(today));

// ✅ CORRECT — upsert after EVERY save (production, sale, expense)
async function saveExpense(expense) {
  // ... save expense ...
  await storage.upsertDailyHistory(expense.date.split('T')[0]);
}
\`\`\`

---

## Trap 13: Dynamic Bread Types
**Context:** Adding new bread types at runtime.

\`\`\`js
// ❌ WRONG — bread types are assumed to be dynamic in v1
const breadTypes = storage.getBreadTypes();

// ✅ CORRECT — bread types are a hardcoded constant in v1
const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];
\`\`\`

---

## Trap 14: Using console.log in Production Code
**Context:** Debugging or informational output.

\`\`\`js
// ❌ WRONG
console.log('Sale saved:', sale);

// ✅ CORRECT — use the structured logger utility
import { logger } from '../utils.js';
logger.info('Sale saved', { id: sale.id, total: sale.totalAmount });
\`\`\`

---

## Trap 15: localStorage Quota Ignored
**Context:** Saving large datasets without checking storage space.

\`\`\`js
// ❌ WRONG — no quota check
localStorage.setItem(key, JSON.stringify(data));

// ✅ CORRECT — check quota before writes; warn at 80%, block at 95%
function safeSave(key, data) {
  const json = JSON.stringify(data);
  const used = JSON.stringify(localStorage).length;
  const limit = 5 * 1024 * 1024; // 5 MB estimate
  if (used / limit > 0.95) throw new Error('Storage full. Please export a backup.');
  if (used / limit > 0.80) toast.show('warning', 'Storage 80% full. Export a backup soon.');
  localStorage.setItem(key, json);
}
\`\`\`
`);

// ===========================================================================
// .kb/06-testing-strategy.md
// ===========================================================================
write('.kb/06-testing-strategy.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Testing Strategy

## Tools
- **Jest** — test runner
- **jsdom** — simulates browser \`window\`, \`document\`, and \`localStorage\` in Node.js
- **ESLint** — static analysis

## Test File Location
\`\`\`
js/
  __tests__/
    storage.test.js
    utils.test.js
    batchMixes.test.js
    production.test.js
    sales.test.js
    customers.test.js
    expenses.test.js
    reports.test.js
    dailyHistory.test.js
\`\`\`

## What to Test

### Unit Tests (pure functions in utils.js)
- \`roundTo3dp(value)\` — all edge cases including 9.5 × 3
- \`formatCurrency(amount)\` — ₦ symbol, commas, two decimal places
- \`toYYYYMMDD(date)\` — timezone safety
- \`recalculateOutstanding(customer)\` — sums debtHistory deltas
- \`computeStock(history, breadType)\` — production adds, sales subtract
- \`calculateNetProfit(sales, productions, expenses)\`
- \`validateIngredientStock(batch, numberOfMixes, currentStock)\` — returns errors array

### Integration Tests (storage.js with mock localStorage)
- \`saveProduction()\` → deducts ingredients, adds to finished inventory, creates production record
- \`saveSale()\` → deducts finished inventory, updates customer outstanding, increments receipt counter
- \`recordPayment()\` → updates customer debtHistory and recalculates outstanding
- \`upsertDailyHistory()\` → aggregates production + sales + expenses correctly
- \`incrementReceiptCounter()\` → never returns same number twice; persists across calls
- \`importBackup()\` + \`exportBackup()\` — round-trip JSON is equal

### Edge Case Tests
- Production with \`numberOfMixes = 0\` → should reject
- Sale with quantity exceeding stock → should reject with validation error
- Customer with no purchase history → outstanding = 0, no errors
- \`calculateNetProfit\` with no sales → returns 0, no divide-by-zero
- localStorage full simulation → \`safeSave\` throws correct error
- DailyHistory for date with no activity → returns zeroed object, no errors

## Definition of Done (GREENFIELD)
A feature is **done** when ALL of the following are true:

- [ ] All business logic has passing unit tests
- [ ] Integration test covers the full save flow (validation → storage → side effects)
- [ ] Edge cases listed above that apply to the feature are tested
- [ ] ESLint reports zero errors
- [ ] JSDoc on all public functions
- [ ] No \`console.log\` statements in production code
- [ ] No direct \`localStorage\` calls outside \`storage.js\`
- [ ] No \`alert()\`/\`confirm()\` usage
- [ ] Feature works on mobile viewport (375px wide)
- [ ] Feature works in dark and light theme
- [ ] Manual smoke test: happy path completed without errors

## Jest Configuration (\`package.json\`)
\`\`\`json
{
  "jest": {
    "testEnvironment": "jsdom",
    "transform": {},
    "extensionsToTreatAsEsm": [".js"],
    "moduleNameMapper": {
      "^(\\.{1,2}/.*)\\.js$": "$1"
    }
  }
}
\`\`\`

## Mock localStorage for Tests
\`\`\`js
// test-helpers/mockStorage.js
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i]
};
\`\`\`

## Test Naming Convention
\`\`\`
describe('calculateNetProfit', () => {
  it('returns 0 when there are no sales', () => { ... });
  it('subtracts expenses from gross profit', () => { ... });
  it('handles negative net profit (loss scenario)', () => { ... });
});
\`\`\`

## Coverage Targets
- Business logic (utils.js, storage.js): 90%+
- Module render functions (DOM): smoke test only
- Components: interaction tests for modal confirm/cancel

## Running Tests
\`\`\`bash
npm test          # run all tests once
npm run test:watch # watch mode during development
\`\`\`
`);

// ===========================================================================
// .kb/07-decisions-and-adr.md
// ===========================================================================
write('.kb/07-decisions-and-adr.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Decisions & Architecture Decision Records

## How to Add an ADR
When a significant architectural, library, or pattern decision is made:
1. Copy the template below.
2. Assign the next sequential number.
3. Fill in all fields.
4. Commit the file.

---

## ADR Template
\`\`\`
## ADR-NNN: [Short Title]
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNN
- **Context:** Why does this decision need to be made?
- **Decision:** What was decided?
- **Consequences:** What are the trade-offs and implications?
\`\`\`

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
- **Decision:** Use localStorage behind a \`storage.js\` abstraction. The abstraction mimics async API signatures so that a future IndexedDB migration is a drop-in replacement.
- **Consequences:** ~5 MB storage limit; must implement export-before-limit warning; data is per-browser-per-origin.

---

## ADR-003: All Storage Access Through storage.js
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** Direct \`localStorage\` calls scattered across modules make it impossible to audit storage operations, enforce quota checks, or migrate to IndexedDB.
- **Decision:** All reads and writes go through \`storage.js\`. Direct \`localStorage\` calls anywhere else are forbidden and caught by ESLint rule.
- **Consequences:** Slight indirection; but enables centralised quota checking, consistent serialisation, and easy migration path.

---

## ADR-004: Customer Outstanding Calculated from debtHistory Log
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** A simple \`outstanding\` counter that gets incremented/decremented will drift over time due to bugs, rounding, or missed updates. This creates irreconcilable discrepancies with the bakery's actual debt records.
- **Decision:** \`customer.outstanding\` is always recomputed by summing \`customer.debtHistory[].delta\`. The stored \`outstanding\` field is a cache; the history is the source of truth.
- **Consequences:** Slightly more computation on read; but the data is always reconcilable and auditable.

---

## ADR-005: Fixed Bread Types in v1
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** The bakery makes a fixed set of bread types. Adding dynamic bread type management (CRUD for types) adds significant complexity to inventory, sales, and reporting logic with no v1 benefit.
- **Decision:** Bread types are a hardcoded constant: \`['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut']\`. No UI for managing types in v1.
- **Consequences:** Fast, simple implementation; v2 can introduce a settings-managed bread type list with a migration script.

---

## ADR-006: DailyHistory Upserted After Every Mutation
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** If DailyHistory is only aggregated at end of day, the dashboard metrics will be stale throughout the day. The bakery owner needs live metrics.
- **Decision:** \`storage.upsertDailyHistory(date)\` is called after every \`saveProduction\`, \`saveSale\`, and \`saveExpense\` call.
- **Consequences:** More writes per operation; acceptable because localStorage writes are fast (<1 ms) and the aggregation is a simple reduce over day's records.

---

## ADR-007: Receipt Numbers Sequential, Never Reset
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** Sequential receipt numbers are a basic requirement for accounting and customer disputes. Resetting on app reload or date change would cause duplicate receipt numbers.
- **Decision:** A persistent counter (\`BF_RECEIPT_COUNTER\`) is stored in localStorage. It is only ever incremented, never reset. Receipt format: \`RCP-00001\`, \`RCP-00002\`, etc.
- **Consequences:** Counter must survive \`importBackup()\` — import must not overwrite the receipt counter unless the backup's counter is higher.

---

## ADR-008: No Deletion of Financial Records
- **Date:** 2025-07-07
- **Status:** Accepted
- **Context:** Deleting sales, expenses, or production records would corrupt daily summaries, profit calculations, and customer debt history. It also removes the audit trail.
- **Decision:** Financial records (Sales, Expenses, Production) are immutable once saved. Corrections are handled via soft-edit (add \`voided: true\` flag + void reason). The UI shows "Edit" not "Delete" for these record types.
- **Consequences:** Storage grows over time; mitigated by export/import backup flow.
`);

// ===========================================================================
// .kb/08-change-log.md
// ===========================================================================
write('.kb/08-change-log.md', SELF_UPDATE_HEADER + `# BakeFlow ERP — Change Log

> This file tracks significant changes to the knowledge base and codebase.
> Add an entry every time you update .kb/ files, change a data model, or add/revoke a rule.

## Format
\`\`\`
### YYYY-MM-DD — [Author / Agent]
- [module/file affected]: brief description of what changed and why
\`\`\`

---

### 2025-07-07 — Initial Generation (generate-specs.mjs)
- All .kb/ files: initial creation of full knowledge base for GREENFIELD project
- All .rules/ files: initial rule set created
- All .prompts/ files: bootstrap prompts created
- AGENTS.md: created with bootstrap order and agent roles
`);

// ===========================================================================
// .rules/01-core-protocol.mdc
// ===========================================================================
write('.rules/01-core-protocol.mdc', `---
description: Core operating protocol for all AI agents working on BakeFlow ERP
globs: ["**/*.js", "**/*.html", "**/*.css", "**/*.mjs"]
alwaysApply: true
---

# BakeFlow ERP — Core Protocol

## Identity
You are working on **BakeFlow ERP**, a production-ready bakery management system
for a real Nigerian bakery. Every code change has real-world financial consequences
for a small business. Accuracy, data integrity, and offline reliability are paramount.

## Before Writing Any Code
1. Read \`.kb/01-project-overview.md\` to confirm scope.
2. Read \`.kb/03-architecture.md\` for data models and save flows.
3. Read \`.kb/05-hallucination-traps.md\` — check your planned code against every trap.
4. Read \`.kb/04-coding-standards.md\` — confirm your code follows all standards.

## After Writing Any Code
1. Check for violations of all \`.rules/\` files.
2. Verify no direct \`localStorage\` calls exist outside \`storage.js\`.
3. Verify no \`alert()\`, \`confirm()\`, or \`console.log\` in production files.
4. If you changed a data model, business rule, or architectural decision, update the relevant \`.kb/\` file and add a \`.kb/08-change-log.md\` entry.

## Knowledge Base is Source of Truth
The \`.kb/\` files define the authoritative system behaviour. If you see a
contradiction between existing code and a \`.kb/\` file, the \`.kb/\` file wins
unless you have explicit user instruction to change the rule (in which case
update the \`.kb/\` file first, then write the code).

## Communication Style
- Be precise about data models — name fields exactly as defined in \`.kb/03-architecture.md\`.
- When uncertain about a business rule, ask before implementing.
- Clearly distinguish between "how the current code works" and "how it should work per spec".
`);

// ===========================================================================
// .rules/02-architecture-guards.mdc
// ===========================================================================
write('.rules/02-architecture-guards.mdc', `---
description: Architecture boundary enforcement for BakeFlow ERP
globs: ["js/**/*.js"]
alwaysApply: true
---

# Architecture Guards

## Guard 1 — No Direct localStorage Access Outside storage.js
Any file other than \`js/storage.js\` must NOT call:
- \`localStorage.getItem()\`
- \`localStorage.setItem()\`
- \`localStorage.removeItem()\`
- \`localStorage.clear()\`

Violation example:
\`\`\`js
// ❌ in js/modules/sales.js
localStorage.setItem('BF_SALES', JSON.stringify(sales));
\`\`\`

Correct:
\`\`\`js
// ✅ in js/modules/sales.js
import storage from '../storage.js';
await storage.saveSale(sale);
\`\`\`

## Guard 2 — Modules Must Export the Standard Contract
Every file in \`js/modules/\` must export a default object with \`init\` and \`destroy\`:
\`\`\`js
export default {
  init(container) { /* mount */ },
  destroy()       { /* unmount, remove listeners */ }
};
\`\`\`

## Guard 3 — No Framework Imports
The following imports are FORBIDDEN in any file:
\`\`\`js
import React from 'react';         // ❌
import { useState } from 'react';  // ❌
import Vue from 'vue';             // ❌
import $ from 'jquery';            // ❌
import _ from 'lodash';            // ❌ (use utils.js instead)
\`\`\`

## Guard 4 — Components Must Not Import Each Other Cyclically
The dependency graph must be acyclic:
\`\`\`
app.js → router.js → modules/*.js → components/*.js → storage.js / utils.js
\`\`\`
Components (\`modal.js\`, \`toast.js\`, etc.) must NOT import from modules.

## Guard 5 — All User-Facing Dialogs Through modal.js or toast.js
\`\`\`js
// ❌ Forbidden
window.alert('Error saving sale');
window.confirm('Delete?');

// ✅ Required
import modal from '../components/modal.js';
import toast from '../components/toast.js';
toast.show('error', 'Error saving sale');
modal.confirm('Delete?', onConfirm);
\`\`\`

## Guard 6 — No Inline Styles
\`\`\`html
<!-- ❌ Forbidden -->
<div style="color: red; margin: 10px;">

<!-- ✅ Required -->
<div class="error-text margin-sm">
\`\`\`

## Guard 7 — Financial Records Are Immutable
Functions named \`delete*\` MUST NOT exist for: Sales, Expenses, Production.
Use \`void*\` or \`update*\` with a voided flag instead.

## Guard 8 — DailyHistory Upsert After Every Mutation
Every function that calls \`saveProduction\`, \`saveSale\`, or \`saveExpense\` MUST
also call \`storage.upsertDailyHistory(date)\` before returning.
`);

// ===========================================================================
// .rules/03-forbidden-patterns.mdc
// ===========================================================================
write('.rules/03-forbidden-patterns.mdc', `---
description: Patterns that are explicitly forbidden in BakeFlow ERP
globs: ["**/*.js", "**/*.html"]
alwaysApply: true
---

# Forbidden Patterns

## FP-1: console.log in Production Code
\`\`\`js
// ❌ FORBIDDEN
console.log(data);
console.warn(msg);
console.error(err); // except in the logger utility itself

// ✅ USE INSTEAD
import { logger } from '../utils.js';
logger.info('message', data);
logger.error('message', err);
\`\`\`

## FP-2: var Declaration
\`\`\`js
// ❌ FORBIDDEN
var total = 0;

// ✅ USE INSTEAD
let total = 0;
const MAX = 100;
\`\`\`

## FP-3: Mutation of Function Arguments
\`\`\`js
// ❌ FORBIDDEN — mutates the passed object
function updateCustomer(customer, payment) {
  customer.outstanding -= payment; // mutates caller's object
}

// ✅ USE INSTEAD — return new object
function updateCustomer(customer, payment) {
  return { ...customer, outstanding: recalculate(customer) };
}
\`\`\`

## FP-4: Date Object as Storage Key
\`\`\`js
// ❌ FORBIDDEN
const key = new Date(); // object, not string
const key = new Date().toString(); // locale-dependent string

// ✅ USE INSTEAD
const key = new Date().toISOString().split('T')[0]; // "2025-07-07"
\`\`\`

## FP-5: Unguarded Ingredient Arithmetic
\`\`\`js
// ❌ FORBIDDEN — floating-point drift
const amount = batch.flour * mixes;

// ✅ USE INSTEAD
const amount = parseFloat((batch.flour * mixes).toFixed(3));
\`\`\`

## FP-6: innerHTML with User-Supplied Data
\`\`\`html
<!-- ❌ FORBIDDEN — XSS risk -->
<div id="name"></div>
<script>document.getElementById('name').innerHTML = userInput;</script>

<!-- ✅ USE INSTEAD -->
<script>document.getElementById('name').textContent = userInput;</script>
\`\`\`

## FP-7: Hardcoded Naira Symbol as ASCII
\`\`\`js
// ❌ FORBIDDEN — wrong symbol
const label = 'N' + amount; // Latin N

// ✅ USE INSTEAD — Unicode Naira sign
const label = '₦' + amount.toFixed(2);
// or use the formatCurrency() utility from utils.js
\`\`\`

## FP-8: Bread Type as Freeform String
\`\`\`js
// ❌ FORBIDDEN — typos create ghost inventory
const type = userInputField.value;
inventory[type] -= qty;

// ✅ USE INSTEAD — validate against constant
import { BREAD_TYPES } from '../utils.js';
if (!BREAD_TYPES.includes(type)) throw new Error('Invalid bread type');
inventory[type] -= qty;
\`\`\`

## FP-9: Synchronous Blocking Loops Over All Records
\`\`\`js
// ❌ FORBIDDEN — blocks UI for large datasets
const allSales = storage.getSales();
const total = allSales.reduce(...);
// render synchronously

// ✅ USE INSTEAD — use date-filtered queries
const todaySales = storage.getSales({ date: today });
\`\`\`

## FP-10: Storing Dates as Date Objects in localStorage
\`\`\`js
// ❌ FORBIDDEN — Date objects serialise oddly
record.date = new Date(); // becomes string on JSON.stringify but loses type on parse

// ✅ USE INSTEAD — always ISO string
record.date = new Date().toISOString(); // "2025-07-07T14:32:00.000Z"
\`\`\`
`);

// ===========================================================================
// .rules/04-self-update-protocol.mdc
// ===========================================================================
write('.rules/04-self-update-protocol.mdc', `---
description: Rules for keeping the knowledge base up to date
globs: [".kb/**/*.md", ".rules/**/*.mdc"]
alwaysApply: true
---

# Self-Update Protocol

## When You MUST Update the Knowledge Base

### Trigger Conditions
Update the relevant \`.kb/\` file immediately when you:
1. Change a data model field name, add a field, or remove a field
2. Add, remove, or change a business rule
3. Add a new module, component, or utility file
4. Change how storage.js works (new function, changed signature)
5. Add a new localStorage key (update \`.kb/02-tech-stack.md\` key table)
6. Discover that a documented rule is wrong or incomplete
7. Add a new ADR-level architectural decision

### Required Steps
\`\`\`
1. Identify which .kb/ file(s) are affected
2. Edit those files with accurate information
3. Add entry to .kb/08-change-log.md:
   ### YYYY-MM-DD — [agent name]
   - [affected file]: what changed and why
4. If it's an architectural decision → add ADR to .kb/07-decisions-and-adr.md
\`\`\`

## What Counts as a Knowledge Base Update

| Change Type | Action |
|---|---|
| New data model field | Update \`.kb/03-architecture.md\` |
| New business rule | Update \`.kb/01-project-overview.md\` or \`.kb/03-architecture.md\` |
| New forbidden pattern discovered | Add to \`.kb/05-hallucination-traps.md\` AND \`.rules/03-forbidden-patterns.mdc\` |
| New tech decision | Add ADR to \`.kb/07-decisions-and-adr.md\` |
| New localStorage key | Update tech stack table in \`.kb/02-tech-stack.md\` |
| New testing requirement | Update \`.kb/06-testing-strategy.md\` |
| Any of the above | Always add to \`.kb/08-change-log.md\` |

## What NOT to Do
- ❌ Do NOT leave .kb/ files stale after a breaking change
- ❌ Do NOT silently change behaviour that contradicts documented rules without updating the rule
- ❌ Do NOT add a hallucination trap to code comments without also adding it to \`.kb/05-hallucination-traps.md\`

## Verification
Before closing a task, confirm:
- [ ] Does the implemented code match what is documented in .kb/03-architecture.md?
- [ ] Are all changed data models reflected in .kb/03-architecture.md?
- [ ] Is .kb/08-change-log.md updated?
- [ ] If architecture changed, is a new ADR added?
`);

// ===========================================================================
// .rules/05-security-and-secrets.mdc
// ===========================================================================
write('.rules/05-security-and-secrets.mdc', `---
description: Security rules for BakeFlow ERP (browser-only, offline app)
globs: ["**/*.js", "**/*.html"]
alwaysApply: true
---

# Security & Data Safety Rules

## S-1: No Secrets in Code
BakeFlow ERP has no server and no authentication tokens in v1. However:
- Do NOT hardcode any future API keys, passwords, or credentials in JS files
- Do NOT commit \`.env\` files if introduced in v2

## S-2: XSS Prevention
All user-supplied data rendered into the DOM must use \`textContent\`, never \`innerHTML\`:
\`\`\`js
// ❌ XSS vulnerability
element.innerHTML = customer.name;

// ✅ Safe
element.textContent = customer.name;
\`\`\`

Exception: static developer-controlled HTML strings (table headers, modal templates) may use \`innerHTML\`.

## S-3: localStorage Data Integrity
- Always wrap localStorage reads in try/catch — malformed JSON must not crash the app
\`\`\`js
function safeParse(json, fallback = []) {
  try { return JSON.parse(json) ?? fallback; }
  catch { return fallback; }
}
\`\`\`
- Validate data shape after \`importBackup()\` — reject malformed backups
- Never trust imported backup data without schema validation

## S-4: Input Validation Before Any Storage Write
All user inputs must be validated by \`utils.js\` validation functions before reaching \`storage.js\`:
\`\`\`js
// ❌ No validation
storage.saveExpense({ amount: formAmount, category: formCategory });

// ✅ Validate first
const errors = validateExpense({ amount: formAmount, category: formCategory });
if (errors.length) { toast.show('error', errors.join(', ')); return; }
storage.saveExpense({ amount: formAmount, category: formCategory });
\`\`\`

## S-5: No eval() or new Function()
\`\`\`js
// ❌ FORBIDDEN
eval(userInput);
new Function(userCode)();
\`\`\`

## S-6: Data Export Security
When exporting backup JSON:
- Clearly label the file: \`bakeflow-backup-YYYY-MM-DD.json\`
- Warn user that backup contains all business data — do not share publicly
- Do NOT automatically upload to any external service

## S-7: No External Network Requests
BakeFlow ERP is fully offline in v1. The following are FORBIDDEN:
\`\`\`js
// ❌ FORBIDDEN
fetch('https://api.example.com/sync');
navigator.sendBeacon('https://analytics.example.com');
new WebSocket('wss://example.com');
\`\`\`

## S-8: Prototype Pollution Prevention
When merging user-supplied objects:
\`\`\`js
// ❌ Vulnerable to prototype pollution
Object.assign(target, userSuppliedObject);

// ✅ Safe — spread only known keys
const safe = {
  name: userObj.name,
  amount: Number(userObj.amount),
  category: VALID_CATEGORIES.includes(userObj.category) ? userObj.category : null
};
\`\`\`
`);

// ===========================================================================
// .prompts/claude-implementation.md
// ===========================================================================
write('.prompts/claude-implementation.md', `# Claude (Kiro) — BakeFlow ERP Implementation Prompt

## Context Load Order
Before writing any code, load these files in order:
1. \`.kb/01-project-overview.md\`
2. \`.kb/02-tech-stack.md\`
3. \`.kb/03-architecture.md\`
4. \`.kb/04-coding-standards.md\`
5. \`.kb/05-hallucination-traps.md\`
6. \`.rules/01-core-protocol.mdc\`
7. \`.rules/02-architecture-guards.mdc\`
8. \`.rules/03-forbidden-patterns.mdc\`

## Role
You are implementing BakeFlow ERP — a real-world bakery management application
for daily commercial use. The code you write will handle real financial data for
a real small business in Nigeria. Correctness and data integrity are non-negotiable.

## Implementation Instructions

### Phase 1 (Foundation — complete this before any module work)
1. \`index.html\` — semantic HTML5 shell with \`<div id="app">\` mount point, \`<script type="module" src="js/app.js">\`
2. \`css/main.css\` — CSS custom properties for theming, reset, layout grid, dark/light theme
3. \`js/utils.js\` — export: \`roundTo3dp\`, \`formatCurrency\`, \`toYYYYMMDD\`, \`generateId\`, \`logger\`, \`BREAD_TYPES\`, \`EXPENSE_CATEGORIES\`, all validation functions
4. \`js/storage.js\` — full localStorage service with all methods listed in \`.kb/03-architecture.md\`, quota checking, auto-backup (keep last 5)
5. \`js/router.js\` — hash-based router with \`register(route, module)\` and \`navigate(route)\`
6. \`js/components/modal.js\` — \`modal.alert(msg)\`, \`modal.confirm(msg, onConfirm)\`, \`modal.form(config, onSubmit)\`
7. \`js/components/toast.js\` — \`toast.show(type, msg, duration?)\` where type = 'success'|'error'|'warning'|'info'
8. \`js/components/table.js\` — \`table.render(container, { columns, rows, actions })\`
9. \`js/app.js\` — boot sequence: init storage, seed data if empty, init router, register modules, render sidebar/navbar

### Per-Module Instructions
When implementing any module in \`js/modules/\`:
1. Follow the save flow defined in \`.kb/03-architecture.md\` exactly
2. Validate ALL inputs before calling storage
3. Call \`storage.upsertDailyHistory(date)\` after every save
4. Handle empty state gracefully (no records yet)
5. All monetary values displayed with \`formatCurrency()\` from utils.js
6. All dates displayed in \`DD/MM/YYYY\` format for Nigerian locale
7. Use the modal component for confirmations and forms — no native dialogs

### Specific Business Logic Reminders
- Ingredient multiplication: ALWAYS \`parseFloat((amount * mixes).toFixed(3))\`
- Customer outstanding: ALWAYS recalculate from \`debtHistory\` — never decrement directly
- Receipt numbers: ALWAYS use \`storage.incrementReceiptCounter()\`
- Previous debt in sales: ADDS to total, not just displayed
- Retailer flag: lives on each line item, not the customer record
- Bread types: use \`BREAD_TYPES\` constant — never freeform strings

### Code Style Checklist (verify before submitting)
- [ ] No \`var\` declarations
- [ ] No \`console.log\`
- [ ] No direct \`localStorage\` calls outside \`storage.js\`
- [ ] No \`alert()\` / \`confirm()\`
- [ ] No inline styles
- [ ] JSDoc on all public functions
- [ ] Error handling with try/catch on all storage operations
- [ ] Event listeners cleaned up in \`destroy()\`
`);

// ===========================================================================
// .prompts/cursor-bootstrap.md
// ===========================================================================
write('.prompts/cursor-bootstrap.md', `# Cursor — BakeFlow ERP Bootstrap Prompt

## What Is This Project?
BakeFlow ERP is a browser-only, offline-capable bakery management system built
with vanilla JavaScript (ES6+ modules), custom CSS, and localStorage. No frameworks,
no build step, no server.

## How Cursor Should Work in This Repo

### Always Available Context
Cursor should index and reference these files for every completion:
- \`.kb/03-architecture.md\` — data models and save flows
- \`.kb/05-hallucination-traps.md\` — common mistakes to avoid
- \`.rules/03-forbidden-patterns.mdc\` — patterns that must never appear

### File Ownership Rules
| File | Who Can Write to It |
|---|---|
| \`js/storage.js\` | Only this file touches localStorage |
| \`js/utils.js\` | Pure helpers only — no DOM, no storage |
| \`js/modules/*.js\` | Module logic + DOM rendering |
| \`js/components/*.js\` | Reusable UI — no business logic |

### Autocomplete Hints
When completing code in \`js/modules/\`:
- Suggest \`storage.*\` calls, not raw \`localStorage\`
- Suggest \`toast.show()\` for user feedback
- Suggest \`modal.confirm()\` for destructive actions
- Suggest \`parseFloat((x * y).toFixed(3))\` for ingredient arithmetic

### Quick Reference — Key localStorage Keys
| Key | Content |
|---|---|
| \`BF_BATCH_MIXES\` | \`BatchMix[]\` |
| \`BF_PRODUCTIONS\` | \`Production[]\` |
| \`BF_FINISHED_INVENTORY\` | \`FinishedInventory[]\` (one per day) |
| \`BF_SALES\` | \`Sale[]\` |
| \`BF_CUSTOMERS\` | \`Customer[]\` |
| \`BF_EXPENSES\` | \`Expense[]\` |
| \`BF_DAILY_HISTORY\` | \`DailyHistory[]\` |
| \`BF_SETTINGS\` | \`Settings\` |
| \`BF_INGREDIENT_STOCK\` | \`Record<string, { amount, unit }>\` |
| \`BF_RECEIPT_COUNTER\` | \`number\` (never reset) |
| \`BF_BACKUPS\` | last 5 serialised backups |

### Module Init Pattern
Every new module must follow this skeleton:
\`\`\`js
import storage from '../storage.js';
import { formatCurrency, toYYYYMMDD } from '../utils.js';
import toast from '../components/toast.js';
import modal from '../components/modal.js';

/** @type {AbortController} */
let controller;

export default {
  init(container) {
    controller = new AbortController();
    render(container);
    attachListeners(container, controller.signal);
  },
  destroy() {
    controller?.abort();
  }
};
\`\`\`

### Running Tests
\`\`\`bash
npm test
npm run test:watch
npm run lint
\`\`\`
`);

// ===========================================================================
// .prompts/gemini-review.md
// ===========================================================================
write('.prompts/gemini-review.md', `# Gemini — BakeFlow ERP Code Review Prompt

## Role
You are performing a code review for BakeFlow ERP. Your job is to find bugs,
rule violations, and quality issues — not to rewrite features unless asked.

## Review Checklist

### Business Logic Correctness
- [ ] Ingredient multiplication uses \`parseFloat((x * y).toFixed(3))\` — check every occurrence
- [ ] Customer outstanding is recalculated from \`debtHistory\`, not decremented directly
- [ ] Previous debt in Sales adds to total (not just displayed)
- [ ] Receipt counter uses \`storage.incrementReceiptCounter()\` — never a local variable
- [ ] Retailer price flag is on each \`lineItem.isRetailer\`, not on \`customer.isRetailer\`
- [ ] \`upsertDailyHistory()\` is called after every \`saveProduction\`, \`saveSale\`, \`saveExpense\`
- [ ] Financial records (Sale, Expense, Production) have no hard-delete path

### Architecture Rule Violations
- [ ] Any \`localStorage\` call outside \`js/storage.js\` — flag as critical
- [ ] Any \`alert()\`, \`confirm()\`, \`prompt()\` call — flag as critical
- [ ] Any \`console.log\`, \`console.warn\`, \`console.error\` outside logger utility
- [ ] Any import of React, Vue, jQuery, or external CSS framework
- [ ] Inline styles in HTML elements
- [ ] Missing \`destroy()\` in any module (memory leak risk)
- [ ] Component imports a module (circular dependency risk)

### Data Model Accuracy
Verify all field names match \`.kb/03-architecture.md\` exactly:
- \`Sale\`: \`receiptNumber\`, \`previousDebtApplied\`, \`previousDebtDisplayed\`, \`paymentMethod\`
- \`Customer\`: \`outstanding\`, \`debtHistory\`, \`lifetimePurchases\`
- \`FinishedInventory\`: \`date\` as \`"YYYY-MM-DD"\` string, \`history[]\` array
- \`DailyHistory\`: nested \`production\`, \`sales\`, \`expenses\`, \`profit\` objects

### Security
- [ ] User-supplied data rendered with \`textContent\`, not \`innerHTML\`
- [ ] All localStorage reads wrapped in try/catch with safe fallback
- [ ] Input validation before every storage write
- [ ] No \`eval()\` or \`new Function()\`

### Code Quality
- [ ] No \`var\` declarations
- [ ] JSDoc on all public functions
- [ ] Event listeners attached with \`AbortController\` or removed in \`destroy()\`
- [ ] Dates stored as ISO strings, never \`Date\` objects in localStorage

## Review Output Format
For each issue found, output:
\`\`\`
FILE: js/modules/sales.js
LINE: 42
SEVERITY: critical | major | minor | style
RULE: [rule name from .rules/ or .kb/]
ISSUE: [description of the problem]
FIX: [what the correct code should do]
\`\`\`
`);

// ===========================================================================
// .prompts/codex-test-writer.md
// ===========================================================================
write('.prompts/codex-test-writer.md', `# Codex — BakeFlow ERP Test Writer Prompt

## Role
You are writing Jest unit and integration tests for BakeFlow ERP. The project
uses Jest with jsdom. Tests live in \`js/__tests__/\`.

## Setup
\`\`\`js
// At the top of every test file
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i]
};
beforeEach(() => localStorage.clear());
\`\`\`

## What to Test

### utils.js — Pure Functions (100% coverage target)
\`\`\`js
describe('roundTo3dp', () => {
  it('fixes 9.5 * 3 floating point error', () => {
    expect(roundTo3dp(9.5 * 3)).toBe(28.5);
  });
  it('handles zero', () => { expect(roundTo3dp(0)).toBe(0); });
  it('handles negative', () => { expect(roundTo3dp(-1.23456)).toBe(-1.235); });
});

describe('toYYYYMMDD', () => {
  it('returns YYYY-MM-DD string for a given Date', () => {
    expect(toYYYYMMDD(new Date('2025-07-07T10:00:00Z'))).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/);
  });
});

describe('recalculateOutstanding', () => {
  it('sums positive and negative deltas', () => {
    const customer = { debtHistory: [{ delta: 500 }, { delta: -200 }, { delta: 300 }] };
    expect(recalculateOutstanding(customer)).toBe(600);
  });
  it('returns 0 for empty history', () => {
    expect(recalculateOutstanding({ debtHistory: [] })).toBe(0);
  });
});

describe('calculateNetProfit', () => {
  it('returns 0 when no data provided', () => {
    expect(calculateNetProfit([], [], [])).toEqual({ grossProfit: 0, netProfit: 0, profitMargin: 0 });
  });
  it('subtracts expenses from gross profit', () => {
    const sales = [{ totalAmount: 10000 }];
    const productions = [{ productionCost: 4000 }];
    const expenses = [{ amount: 2000 }];
    const result = calculateNetProfit(sales, productions, expenses);
    expect(result.grossProfit).toBe(6000);
    expect(result.netProfit).toBe(4000);
  });
  it('handles loss scenario (negative net profit)', () => {
    const result = calculateNetProfit([{ totalAmount: 1000 }], [{ productionCost: 3000 }], []);
    expect(result.netProfit).toBeLessThan(0);
  });
});
\`\`\`

### storage.js — Integration Tests
\`\`\`js
describe('saveProduction', () => {
  it('deducts ingredients from inventory', () => { ... });
  it('adds output to finished inventory', () => { ... });
  it('rejects if insufficient ingredients', () => { ... });
  it('calls upsertDailyHistory after saving', () => { ... });
});

describe('saveSale', () => {
  it('deducts from finished inventory', () => { ... });
  it('increments receipt counter', () => { ... });
  it('rejects if quantity exceeds stock', () => { ... });
  it('updates customer outstanding via debtHistory', () => { ... });
});

describe('incrementReceiptCounter', () => {
  it('starts at 1', () => { expect(storage.incrementReceiptCounter()).toBe(1); });
  it('increments on each call', () => {
    expect(storage.incrementReceiptCounter()).toBe(1);
    expect(storage.incrementReceiptCounter()).toBe(2);
    expect(storage.incrementReceiptCounter()).toBe(3);
  });
  it('persists across module re-import simulation', () => {
    storage.incrementReceiptCounter(); // 1
    storage.incrementReceiptCounter(); // 2
    // simulate reload by re-reading from storage
    expect(storage.getReceiptCounter()).toBe(2);
  });
});

describe('exportBackup / importBackup', () => {
  it('round-trips all data', () => {
    // save some data, export, clear, import, verify data restored
  });
  it('does not reset receipt counter to lower value on import', () => { ... });
});
\`\`\`

### Edge Cases — Must Cover
- Production with \`numberOfMixes = 0\` → throws validation error
- Sale with quantity > current stock → throws validation error
- \`calculateNetProfit\` with zero revenue → profitMargin = 0, no divide-by-zero
- FinishedInventory for date with no records → returns zeroed struct
- Customer with no debtHistory → outstanding = 0

## Naming Convention
\`\`\`
describe('[functionName / module]', () => {
  it('[does what] when [condition]', () => { ... });
});
\`\`\`

## Running
\`\`\`bash
npm test                        # all tests
npx jest utils.test.js --watch  # single file, watch mode
\`\`\`
`);

// ===========================================================================
// AGENTS.md
// ===========================================================================
write('AGENTS.md', `# BakeFlow ERP — AI Agent Guide

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
- **Prompt:** \`.prompts/claude-implementation.md\`
- **Context to load first:** \`.kb/01-project-overview.md\`, \`.kb/03-architecture.md\`, \`.kb/05-hallucination-traps.md\`

### Cursor — Inline Development Agent
- **Speciality:** File-by-file coding, autocompletion, quick edits
- **Prompt:** \`.prompts/cursor-bootstrap.md\`
- **Context to load first:** \`.kb/03-architecture.md\`, \`.kb/05-hallucination-traps.md\`

### Gemini — Review & Audit Agent
- **Speciality:** Code review, security audit, rule violation detection
- **Prompt:** \`.prompts/gemini-review.md\`
- **Context to load first:** \`.rules/\` (all files), \`.kb/05-hallucination-traps.md\`

### Codex — Test Writer Agent
- **Speciality:** Unit tests, integration tests, edge case coverage
- **Prompt:** \`.prompts/codex-test-writer.md\`
- **Context to load first:** \`.kb/06-testing-strategy.md\`, \`.kb/03-architecture.md\`

---

## Knowledge Base Map

| File | Purpose |
|---|---|
| \`.kb/01-project-overview.md\` | What the app is, business rules summary, seed data |
| \`.kb/02-tech-stack.md\` | Languages, storage, testing, forbidden technologies |
| \`.kb/03-architecture.md\` | Module structure, data models, save flows, storage API |
| \`.kb/04-coding-standards.md\` | Style rules, naming conventions, code patterns |
| \`.kb/05-hallucination-traps.md\` | 15 common AI mistakes with ❌ wrong / ✅ correct examples |
| \`.kb/06-testing-strategy.md\` | Jest setup, what to test, Definition of Done |
| \`.kb/07-decisions-and-adr.md\` | Architecture Decision Records |
| \`.kb/08-change-log.md\` | Dated log of all KB and code changes |

## Rules Map

| File | Purpose |
|---|---|
| \`.rules/01-core-protocol.mdc\` | Mandatory protocol before/after any code change |
| \`.rules/02-architecture-guards.mdc\` | Storage, module contract, component boundary guards |
| \`.rules/03-forbidden-patterns.mdc\` | Patterns that must never appear in code |
| \`.rules/04-self-update-protocol.mdc\` | When and how to update .kb/ files |
| \`.rules/05-security-and-secrets.mdc\` | XSS, input validation, no external requests |

---

## Bootstrap Order (GREENFIELD)
> Complete phases in order. Do not start Phase 2 until Phase 1 is fully done and tested.

### Phase 1 — Foundation
| # | File | Description |
|---|---|---|
| 1 | \`index.html\` | Semantic HTML5 shell, \`<div id="app">\`, module script tag |
| 2 | \`css/main.css\` | CSS custom properties, reset, grid layout, dark/light theme |
| 3 | \`js/utils.js\` | \`roundTo3dp\`, \`formatCurrency\`, \`toYYYYMMDD\`, \`generateId\`, \`logger\`, \`BREAD_TYPES\`, \`EXPENSE_CATEGORIES\`, all validators |
| 4 | \`js/storage.js\` | Full localStorage service: all CRUD methods, quota guard, auto-backup, receipt counter |
| 5 | \`js/router.js\` | Hash-based router: \`register\`, \`navigate\`, \`destroy\` lifecycle |
| 6 | \`js/components/modal.js\` | \`modal.alert\`, \`modal.confirm\`, \`modal.form\` |
| 7 | \`js/components/toast.js\` | \`toast.show(type, msg)\` — success/error/warning/info |
| 8 | \`js/components/table.js\` | \`table.render(container, config)\` |
| 9 | \`js/components/card.js\` | Metric card for dashboard |
| 10 | \`js/components/sidebar.js\` | Navigation sidebar with active state |
| 11 | \`js/components/navbar.js\` | Top bar with theme toggle |
| 12 | \`js/app.js\` | Boot: init storage, seed data, init router, register all modules |
| 13 | \`js/__tests__/utils.test.js\` | Unit tests for all utils.js functions |
| 14 | \`js/__tests__/storage.test.js\` | Integration tests for all storage.js methods |

### Phase 2 — Core Modules
| # | Module | Key Behaviour |
|---|---|---|
| 1 | \`batchMixes.js\` | CRUD for batch recipes; 4 seed records |
| 2 | \`production.js\` | Select batch, enter mixes, validate ingredients, save → deduct → add to inventory |
| 3 | \`inventory.js\` | Display current ingredient stock; manual stock adjustments |
| 4 | \`finishedInventory.js\` | Current stock per bread type + history log |
| 5 | \`dashboard.js\` | Metrics, low-stock alerts, recent activity |

### Phase 3 — Sales & Customers
| # | Module | Key Behaviour |
|---|---|---|
| 1 | \`customers.js\` | CRUD, outstanding balance, record payment |
| 2 | \`sales.js\` | POS: customer select, multi-item, retailer pricing, previous debt, receipt |

### Phase 4 — Finance & Reporting
| # | Module | Key Behaviour |
|---|---|---|
| 1 | \`expenses.js\` | Categorised expenses; reduces net profit |
| 2 | \`reports.js\` | Time-filtered reports, CSV export |
| 3 | \`dailyHistory.js\` | View auto-generated daily summaries |
| 4 | \`settings.js\` | App config, ingredient unit costs, backup/restore |

---

## Critical Business Rules (Quick Reference)

| Rule | Detail |
|---|---|
| Ingredient math | \`parseFloat((amount × mixes).toFixed(3))\` — always |
| Customer outstanding | Recalculate from \`debtHistory[].delta\` sum — never decrement directly |
| Previous debt in POS | Adds to sale total — not informational only |
| Retailer flag | Per line item — not per customer |
| Receipt numbers | Sequential, persistent, never reset |
| Financial records | No hard delete — soft edit (voided flag) only |
| Bread types | Fixed constant — no dynamic types in v1 |
| DailyHistory | Upsert after every save — not end of day |
| All storage | Through \`storage.js\` only — never raw localStorage |
| Dialogs | \`modal.js\` only — never \`alert()\`/\`confirm()\` |

---

## Definition of Done

A feature is **complete** when ALL of the following are true:
- [ ] Business logic has passing unit tests (>90% coverage)
- [ ] Integration test covers full save flow
- [ ] All applicable edge cases tested (see \`.kb/06-testing-strategy.md\`)
- [ ] ESLint: zero errors
- [ ] JSDoc on all public functions
- [ ] No \`console.log\` in production code
- [ ] No direct \`localStorage\` calls outside \`storage.js\`
- [ ] No \`alert()\`/\`confirm()\` usage
- [ ] Works on 375px mobile viewport
- [ ] Works in dark and light theme
- [ ] Manual smoke test of happy path passes

---

## Seed Data (First Run)
On first load, \`storage.seedInitialData()\` inserts these batch mixes if no data exists:

\`\`\`js
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
\`\`\`
`);


// ===========================================================================
// Console Banner
// ===========================================================================
const CYAN    = '\x1b[36m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const RESET   = '\x1b[0m';
const WHITE   = '\x1b[37m';

const line = `${CYAN}${'─'.repeat(62)}${RESET}`;

console.log('');
console.log(line);
console.log(`${CYAN}${BOLD}  🍞  BakeFlow ERP — AI Knowledge System${RESET}`);
console.log(`${DIM}${CYAN}  generate-specs.mjs completed successfully${RESET}`);
console.log(line);
console.log('');
console.log(`${GREEN}${BOLD}  ✓ Files created (${created.length} total):${RESET}`);

const kbFiles     = created.filter(f => f.startsWith('.kb/'));
const rulesFiles  = created.filter(f => f.startsWith('.rules/'));
const promptFiles = created.filter(f => f.startsWith('.prompts/'));
const rootFiles   = created.filter(f => !f.startsWith('.kb/') && !f.startsWith('.rules/') && !f.startsWith('.prompts/'));

if (kbFiles.length) {
  console.log(`\n${YELLOW}${BOLD}  .kb/ — Knowledge Base${RESET}`);
  kbFiles.forEach(f => console.log(`${GREEN}    ✓${RESET} ${f}`));
}
if (rulesFiles.length) {
  console.log(`\n${YELLOW}${BOLD}  .rules/ — Agent Rules${RESET}`);
  rulesFiles.forEach(f => console.log(`${GREEN}    ✓${RESET} ${f}`));
}
if (promptFiles.length) {
  console.log(`\n${YELLOW}${BOLD}  .prompts/ — Bootstrap Prompts${RESET}`);
  promptFiles.forEach(f => console.log(`${GREEN}    ✓${RESET} ${f}`));
}
if (rootFiles.length) {
  console.log(`\n${YELLOW}${BOLD}  Root${RESET}`);
  rootFiles.forEach(f => console.log(`${GREEN}    ✓${RESET} ${f}`));
}

console.log('');
console.log(line);
console.log(`\n${BOLD}${WHITE}  ▶ Next Steps${RESET}\n`);
console.log(`  ${CYAN}1.${RESET} Load ${BOLD}.kb/${RESET} files into your AI agent context`);
console.log(`  ${CYAN}2.${RESET} Use ${BOLD}.prompts/claude-implementation.md${RESET} to start Phase 1`);
console.log(`  ${CYAN}3.${RESET} Follow Bootstrap Order in ${BOLD}AGENTS.md${RESET} (Phase 1 → 2 → 3 → 4)`);
console.log(`  ${CYAN}4.${RESET} After each feature, run ${BOLD}npm test${RESET} and check Definition of Done`);
console.log(`  ${CYAN}5.${RESET} Use ${BOLD}.prompts/gemini-review.md${RESET} for code review passes`);
console.log(`  ${CYAN}6.${RESET} When AI makes a mistake, add it to ${BOLD}.kb/05-hallucination-traps.md${RESET}`);
console.log('');
console.log(line);
console.log(`\n${DIM}  Phase 1 start file: js/utils.js → js/storage.js → js/router.js → components/${RESET}`);
console.log(`${DIM}  Seed data: 4 batch mix records auto-inserted on first browser load${RESET}`);
console.log(`${DIM}  All currency: Nigerian Naira (₦) | localStorage keys prefixed BF_${RESET}\n`);
