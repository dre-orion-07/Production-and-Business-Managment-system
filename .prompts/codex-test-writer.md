# Codex — BakeFlow ERP Test Writer Prompt

## Role
You are writing Jest unit and integration tests for BakeFlow ERP. The project
uses Jest with jsdom. Tests live in `js/__tests__/`.

## Setup
```js
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
```

## What to Test

### utils.js — Pure Functions (100% coverage target)
```js
describe('roundTo3dp', () => {
  it('fixes 9.5 * 3 floating point error', () => {
    expect(roundTo3dp(9.5 * 3)).toBe(28.5);
  });
  it('handles zero', () => { expect(roundTo3dp(0)).toBe(0); });
  it('handles negative', () => { expect(roundTo3dp(-1.23456)).toBe(-1.235); });
});

describe('toYYYYMMDD', () => {
  it('returns YYYY-MM-DD string for a given Date', () => {
    expect(toYYYYMMDD(new Date('2025-07-07T10:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
```

### storage.js — Integration Tests
```js
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
```

### Edge Cases — Must Cover
- Production with `numberOfMixes = 0` → throws validation error
- Sale with quantity > current stock → throws validation error
- `calculateNetProfit` with zero revenue → profitMargin = 0, no divide-by-zero
- FinishedInventory for date with no records → returns zeroed struct
- Customer with no debtHistory → outstanding = 0

## Naming Convention
```
describe('[functionName / module]', () => {
  it('[does what] when [condition]', () => { ... });
});
```

## Running
```bash
npm test                        # all tests
npx jest utils.test.js --watch  # single file, watch mode
```
