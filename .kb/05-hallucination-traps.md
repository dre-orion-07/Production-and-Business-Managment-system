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

# BakeFlow ERP — Hallucination Traps

> These are the most common mistakes AI agents make on this codebase.
> Every trap includes the WRONG pattern and the CORRECT replacement.

---

## Trap 1: Floating-Point Ingredient Multiplication
**Context:** Multiplying batch ingredients by number of mixes.

```js
// ❌ WRONG — 9.5 × 3 produces 28.499999999999996
const flourUsed = batch.ingredients.flour.amount * numberOfMixes;

// ✅ CORRECT — always round to 3 decimal places
const flourUsed = parseFloat((batch.ingredients.flour.amount * numberOfMixes).toFixed(3));
```

---

## Trap 2: Decrementing Customer Outstanding Directly
**Context:** Recording a payment or adding debt to a customer.

```js
// ❌ WRONG — balance drifts over time due to missed updates
customer.outstanding -= paymentAmount;

// ✅ CORRECT — recalculate from the immutable debtHistory log
function recalculateOutstanding(customer) {
  return customer.debtHistory.reduce((acc, tx) => acc + tx.delta, 0);
}
const updated = { ...customer, outstanding: recalculateOutstanding(customer) };
```

---

## Trap 3: Using Date Objects as localStorage Keys
**Context:** Keying DailyHistory or FinishedInventory by date.

```js
// ❌ WRONG — Date.toString() output varies by locale/timezone
const key = new Date().toString(); // "Mon Jul 07 2025 14:32:00 GMT+0100"

// ✅ CORRECT — always use YYYY-MM-DD string
const key = new Date().toISOString().split('T')[0]; // "2025-07-07"
```

---

## Trap 4: Retailer Flag on Customer Instead of Line Item
**Context:** Applying retailer pricing in the Sales (POS) module.

```js
// ❌ WRONG — assumes retailer status is a customer property
const price = customer.isRetailer ? RETAILER_PRICE : NORMAL_PRICE;

// ✅ CORRECT — retailer flag lives on each line item
const price = lineItem.isRetailer ? 450 : 500; // for small bread
```

---

## Trap 5: Calling localStorage Directly
**Context:** Any read or write of persistent data.

```js
// ❌ WRONG — bypasses storage.js abstraction
const sales = JSON.parse(localStorage.getItem('sales') || '[]');

// ✅ CORRECT — always use the storage module
import storage from '../storage.js';
const sales = storage.getSales();
```

---

## Trap 6: Using alert() or confirm() for User Interaction
**Context:** Any confirmation dialog or error message.

```js
// ❌ WRONG
if (confirm('Are you sure you want to delete this expense?')) {
  deleteExpense(id);
}

// ✅ CORRECT
import modal from '../components/modal.js';
modal.confirm('Are you sure you want to delete this expense?', () => deleteExpense(id));
```

---

## Trap 7: Deleting Financial Records
**Context:** Adding delete buttons to sales, expenses, or production records.

```js
// ❌ WRONG — financial records must never be hard-deleted
storage.deleteSale(id);

// ✅ CORRECT — use soft edit (mark as voided, keep the record)
storage.updateSale(id, { voided: true, voidedAt: new Date().toISOString(), voidReason: reason });
```

---

## Trap 8: Resetting the Receipt Counter
**Context:** Generating receipt numbers.

```js
// ❌ WRONG — receipt numbers must never reset
let receiptCounter = 1;

// ✅ CORRECT — read from persistent storage and always increment
const nextNumber = storage.incrementReceiptCounter(); // reads BF_RECEIPT_COUNTER, adds 1, saves back
const receiptNumber = `RCP-${String(nextNumber).padStart(5, '0')}`;
```

---

## Trap 9: Computing Finished Inventory from a Simple Counter
**Context:** Updating bread stock levels.

```js
// ❌ WRONG — counter drifts; cannot reconcile
finishedInventory.small -= saleQuantity;

// ✅ CORRECT — recompute from history log
function computeStock(history, breadType) {
  return history
    .filter(tx => tx.breadType === breadType)
    .reduce((acc, tx) => acc + (tx.type === 'production' ? tx.quantity : -tx.quantity), 0);
}
```

---

## Trap 10: Previous Debt is Informational Only
**Context:** Displaying customer's existing debt in the Sales POS.

```js
// ❌ WRONG — previous debt is shown but not added to the total
sale.totalAmount = itemsTotal;
// debt displayed separately

// ✅ CORRECT — previous debt increases the total amount owed
sale.totalAmount = itemsTotal + customer.outstanding;
sale.previousDebtApplied = customer.outstanding;
sale.previousDebtDisplayed = true;
```

---

## Trap 11: Production Cost is Zero When Unit Costs Not Set
**Context:** Calculating cost of a production run.

```js
// ❌ WRONG — throws or produces NaN when unitCost is undefined
const cost = batch.ingredients.flour.amount * settings.unitCosts.flour;

// ✅ CORRECT — default to 0 and warn user
const flourCost = settings.unitCosts?.flour ?? 0;
if (flourCost === 0) {
  toast.show('warning', 'Ingredient unit costs not set. Production cost recorded as ₦0. Set costs in Settings.');
}
const cost = batch.ingredients.flour.amount * flourCost;
```

---

## Trap 12: DailyHistory Aggregation Only Runs at End of Day
**Context:** When to call `upsertDailyHistory()`.

```js
// ❌ WRONG — only aggregates once at midnight
schedule.daily(() => storage.upsertDailyHistory(today));

// ✅ CORRECT — upsert after EVERY save (production, sale, expense)
async function saveExpense(expense) {
  // ... save expense ...
  await storage.upsertDailyHistory(expense.date.split('T')[0]);
}
```

---

## Trap 13: Dynamic Bread Types
**Context:** Adding new bread types at runtime.

```js
// ❌ WRONG — bread types are assumed to be dynamic in v1
const breadTypes = storage.getBreadTypes();

// ✅ CORRECT — bread types are a hardcoded constant in v1
const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];
```

---

## Trap 14: Using console.log in Production Code
**Context:** Debugging or informational output.

```js
// ❌ WRONG
console.log('Sale saved:', sale);

// ✅ CORRECT — use the structured logger utility
import { logger } from '../utils.js';
logger.info('Sale saved', { id: sale.id, total: sale.totalAmount });
```

---

## Trap 15: localStorage Quota Ignored
**Context:** Saving large datasets without checking storage space.

```js
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
```
