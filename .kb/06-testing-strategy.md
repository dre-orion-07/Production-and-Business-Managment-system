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

# BakeFlow ERP — Testing Strategy

## Tools
- **Jest** — test runner
- **jsdom** — simulates browser `window`, `document`, and `localStorage` in Node.js
- **ESLint** — static analysis

## Test File Location
```
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
```

## What to Test

### Unit Tests (pure functions in utils.js)
- `roundTo3dp(value)` — all edge cases including 9.5 × 3
- `formatCurrency(amount)` — ₦ symbol, commas, two decimal places
- `toYYYYMMDD(date)` — timezone safety
- `recalculateOutstanding(customer)` — sums debtHistory deltas
- `computeStock(history, breadType)` — production adds, sales subtract
- `calculateNetProfit(sales, productions, expenses)`
- `validateIngredientStock(batch, numberOfMixes, currentStock)` — returns errors array

### Integration Tests (storage.js with mock localStorage)
- `saveProduction()` → deducts ingredients, adds to finished inventory, creates production record
- `saveSale()` → deducts finished inventory, updates customer outstanding, increments receipt counter
- `recordPayment()` → updates customer debtHistory and recalculates outstanding
- `upsertDailyHistory()` → aggregates production + sales + expenses correctly
- `incrementReceiptCounter()` → never returns same number twice; persists across calls
- `importBackup()` + `exportBackup()` — round-trip JSON is equal

### Edge Case Tests
- Production with `numberOfMixes = 0` → should reject
- Sale with quantity exceeding stock → should reject with validation error
- Customer with no purchase history → outstanding = 0, no errors
- `calculateNetProfit` with no sales → returns 0, no divide-by-zero
- localStorage full simulation → `safeSave` throws correct error
- DailyHistory for date with no activity → returns zeroed object, no errors

## Definition of Done (GREENFIELD)
A feature is **done** when ALL of the following are true:

- [ ] All business logic has passing unit tests
- [ ] Integration test covers the full save flow (validation → storage → side effects)
- [ ] Edge cases listed above that apply to the feature are tested
- [ ] ESLint reports zero errors
- [ ] JSDoc on all public functions
- [ ] No `console.log` statements in production code
- [ ] No direct `localStorage` calls outside `storage.js`
- [ ] No `alert()`/`confirm()` usage
- [ ] Feature works on mobile viewport (375px wide)
- [ ] Feature works in dark and light theme
- [ ] Manual smoke test: happy path completed without errors

## Jest Configuration (`package.json`)
```json
{
  "jest": {
    "testEnvironment": "jsdom",
    "transform": {},
    "extensionsToTreatAsEsm": [".js"],
    "moduleNameMapper": {
      "^(\.{1,2}/.*)\.js$": "$1"
    }
  }
}
```

## Mock localStorage for Tests
```js
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
```

## Test Naming Convention
```
describe('calculateNetProfit', () => {
  it('returns 0 when there are no sales', () => { ... });
  it('subtracts expenses from gross profit', () => { ... });
  it('handles negative net profit (loss scenario)', () => { ... });
});
```

## Coverage Targets
- Business logic (utils.js, storage.js): 90%+
- Module render functions (DOM): smoke test only
- Components: interaction tests for modal confirm/cancel

## Running Tests
```bash
npm test          # run all tests once
npm run test:watch # watch mode during development
```
