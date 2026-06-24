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

# BakeFlow ERP — Architecture

## Pattern: Modular MVC
Each module owns its **view** (DOM rendering), **logic** (business rules), and **data interaction** (via `storage.js`).

```
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
```

## Module Contract
Every module in `js/modules/` MUST export:
```js
export default {
  init(container) {},   // called by router when route activates; receives DOM container
  destroy() {}          // called by router when route deactivates; clean up listeners
};
```

## Routing (`router.js`)
- Hash-based routing (`#/dashboard`, `#/sales`, etc.)
- On hash change: call `currentModule.destroy()`, render new module into `#app`, call `newModule.init(container)`
- Default route: `#/dashboard`

## Data Layer (`storage.js`)
- Single source of truth for all localStorage operations
- Mimics async API call signatures for future IndexedDB migration
- Public API surface:

```js
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
```

## Business Rule Enforcement Points

### Production Save Flow
```
1. Validate: for each ingredient, check currentStock >= (batchIngredient × numberOfMixes)
2. Compute ingredientsUsed = batchIngredients × numberOfMixes (round each to 3 d.p.)
3. Deduct ingredientsUsed from ingredient inventory
4. Add output counts to FinishedInventory for today's date
5. Append history entry: { type: "production", ... }
6. Save Production record
7. Upsert DailyHistory for today
8. Auto-backup
```

### Sale Save Flow
```
1. Validate: for each line item, finishedInventory[breadType] >= quantity
2. Deduct each line item from FinishedInventory
3. Append history entry: { type: "sale", ... }
4. If customerId set: update customer outstanding += (totalAmount - amountPaid)
5. Apply previousDebtApplied to customer outstanding
6. Increment + assign receipt number
7. Save Sale record
8. Upsert DailyHistory for today
9. Auto-backup
```

### Customer Outstanding Calculation
> **Always recalculate from transaction history — never rely on a simple decrement.**
```js
customer.outstanding = customer.debtHistory.reduce((acc, tx) => acc + tx.delta, 0);
```

### Net Profit Calculation
```
Gross Profit  = Total Revenue − Total Production Cost
Net Profit    = Gross Profit − Total Expenses
Profit Margin = (Net Profit / Total Revenue) × 100
```
Recalculate whenever a sale, production record, or expense is saved.

## Data Models

### BatchMix
```js
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
```

### Production
```js
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
```

### FinishedInventory (singleton-per-day)
```js
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
```

### Sale
```js
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
```

### Customer
```js
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
```

### Expense
```js
{
  id: string,
  category: "gas" | "packaging" | "fuel" | "salary" | "repairs" |
            "electricity" | "maintenance" | "owner_withdrawal" | "miscellaneous",
  amount: number,
  description: string,
  date: string,
  createdAt: string
}
```

### DailyHistory
```js
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
```

## Component Architecture
All UI primitives live in `js/components/`:

| Component | Responsibility |
|---|---|
| `modal.js` | Replaces `alert()`/`confirm()` — must be used for ALL dialog interactions |
| `toast.js` | Non-blocking user feedback (success, error, warning, info) |
| `table.js` | Reusable sortable/filterable table renderer |
| `card.js` | Metric card for dashboard |
| `sidebar.js` | Navigation sidebar with active route highlighting |
| `navbar.js` | Top navigation bar |

## Seed Data Bootstrap (app.js)
On first load (`localStorage` empty), `app.js` calls `storage.seedInitialData()` which inserts:
- 4 BatchMix records (10kg, 12kg, 14kg, 16kg Standard)
- Empty ingredient inventory with all keys initialised to 0
- Empty FinishedInventory record for today
- Default Settings object
