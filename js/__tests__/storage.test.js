/**
 * @fileoverview Integration tests for js/storage.js
 * Tests all public methods against a mock localStorage.
 * localStorage is cleared before each test via setup.js.
 */

import storage from '../storage.js';
import { BREAD_TYPES, today, toYYYYMMDD } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function seedBatch() {
  return storage.saveBatchMix({
    name: 'Test 10kg', size: '10kg',
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
  });
}

function seedFullStock() {
  // Give plenty of each ingredient
  const stock = {
    flour:        { amount: 200,  unit: 'kg' },
    wheatFlour:   { amount: 50,   unit: 'kg' },
    sugar:        { amount: 50,   unit: 'kg' },
    salt:         { amount: 20,   unit: 'kg' },
    yeast:        { amount: 5000, unit: 'g' },
    margarine:    { amount: 30,   unit: 'kg' },
    oil:          { amount: 30,   unit: 'liters' },
    improver:     { amount: 1000, unit: 'g' },
    preservative: { amount: 1000, unit: 'g' },
    flavour:      { amount: 1000, unit: 'ml' },
    water:        { amount: 500,  unit: 'liters' }
  };
  storage.saveIngredientStock(stock);
  return stock;
}

function seedFinishedInventory(overrides = {}) {
  const inv = {
    id: 'test-inv', date: today(),
    mini: 0, small: 100, medium: 50, big: 30,
    sardine: 20, chocolate: 10, coconut: 5,
    lastUpdated: new Date().toISOString(), history: [],
    ...overrides
  };
  storage.saveFinishedInventory(inv);
  return inv;
}

// ─────────────────────────────────────────────────────────────────────────────
// seedInitialData
// ─────────────────────────────────────────────────────────────────────────────
describe('seedInitialData', () => {
  it('inserts 4 batch mixes on first call', () => {
    storage.seedInitialData();
    expect(storage.getBatchMixes()).toHaveLength(4);
  });

  it('does not duplicate on second call', () => {
    storage.seedInitialData();
    storage.seedInitialData();
    expect(storage.getBatchMixes()).toHaveLength(4);
  });

  it('seeds an empty ingredient stock record', () => {
    storage.seedInitialData();
    const stock = storage.getIngredientStock();
    expect(stock).toBeDefined();
    expect(stock.flour).toBeDefined();
    expect(stock.flour.amount).toBe(0);
  });

  it('seeds default settings', () => {
    storage.seedInitialData();
    const settings = storage.getSettings();
    expect(settings.shopName).toBe('BakeFlow Bakery');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Batch Mixes
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch Mixes CRUD', () => {
  it('saves a new batch mix with generated id', () => {
    const mix = seedBatch();
    expect(mix.id).toBeTruthy();
    expect(mix.name).toBe('Test 10kg');
  });

  it('getBatchMixes returns all saved mixes', () => {
    seedBatch();
    seedBatch();
    expect(storage.getBatchMixes()).toHaveLength(2);
  });

  it('getBatchMixById returns correct mix', () => {
    const mix = seedBatch();
    expect(storage.getBatchMixById(mix.id)).toMatchObject({ id: mix.id });
  });

  it('getBatchMixById returns null for unknown id', () => {
    expect(storage.getBatchMixById('not-real')).toBeNull();
  });

  it('updateBatchMix updates name and keeps metadata', () => {
    const mix     = seedBatch();
    const updated = storage.updateBatchMix(mix.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    expect(updated.id).toBe(mix.id);
    expect(updated.updatedAt).toBeDefined();
  });

  it('updateBatchMix throws for unknown id', () => {
    expect(() => storage.updateBatchMix('unknown', {})).toThrow();
  });

  it('deleteBatchMix removes the mix', () => {
    const mix = seedBatch();
    storage.deleteBatchMix(mix.id);
    expect(storage.getBatchMixById(mix.id)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ingredient Stock
// ─────────────────────────────────────────────────────────────────────────────
describe('Ingredient Stock', () => {
  it('getIngredientStock returns empty stock by default', () => {
    const stock = storage.getIngredientStock();
    expect(stock.flour).toBeDefined();
    expect(stock.flour.amount).toBe(0);
  });

  it('adjustIngredientStock adds to stock', () => {
    seedFullStock();
    const before = storage.getIngredientStock().flour.amount;
    storage.adjustIngredientStock('flour', 10);
    expect(storage.getIngredientStock().flour.amount).toBe(before + 10);
  });

  it('adjustIngredientStock deducts from stock', () => {
    seedFullStock();
    storage.adjustIngredientStock('flour', -50);
    expect(storage.getIngredientStock().flour.amount).toBe(150);
  });

  it('adjustIngredientStock does not go below 0', () => {
    storage.adjustIngredientStock('flour', -1000);
    expect(storage.getIngredientStock().flour.amount).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Receipt Counter
// ─────────────────────────────────────────────────────────────────────────────
describe('incrementReceiptCounter', () => {
  it('starts at 1', () => {
    expect(storage.incrementReceiptCounter()).toBe(1);
  });

  it('increments on each call', () => {
    expect(storage.incrementReceiptCounter()).toBe(1);
    expect(storage.incrementReceiptCounter()).toBe(2);
    expect(storage.incrementReceiptCounter()).toBe(3);
  });

  it('persists value — getReceiptCounter returns current value', () => {
    storage.incrementReceiptCounter(); // 1
    storage.incrementReceiptCounter(); // 2
    expect(storage.getReceiptCounter()).toBe(2);
  });

  it('never returns the same number twice in sequential calls', () => {
    const vals = Array.from({ length: 10 }, () => storage.incrementReceiptCounter());
    const unique = new Set(vals);
    expect(unique.size).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// saveProduction
// ─────────────────────────────────────────────────────────────────────────────
describe('saveProduction', () => {
  it('deducts ingredients from stock', () => {
    const batch = seedBatch();
    seedFullStock();
    seedFinishedInventory();
    const flourBefore = storage.getIngredientStock().flour.amount;

    storage.saveProduction({
      batchId: batch.id, numberOfMixes: 2,
      output: { mini: 50, small: 100, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0 }
    });

    const flourAfter = storage.getIngredientStock().flour.amount;
    // 9.5 × 2 = 19 kg deducted
    expect(flourAfter).toBeCloseTo(flourBefore - 19, 2);
  });

  it('adds output to finished inventory', () => {
    const batch = seedBatch();
    seedFullStock();
    seedFinishedInventory({ small: 0 });

    storage.saveProduction({
      batchId: batch.id, numberOfMixes: 1,
      output: { mini: 0, small: 80, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0 }
    });

    const inv = storage.getFinishedInventory(today());
    expect(inv.small).toBe(80);
  });

  it('appends to finished inventory history', () => {
    const batch = seedBatch();
    seedFullStock();
    seedFinishedInventory({ small: 0 });

    storage.saveProduction({
      batchId: batch.id, numberOfMixes: 1,
      output: { mini: 0, small: 80, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0 }
    });

    const inv = storage.getFinishedInventory(today());
    const prodEntries = inv.history.filter(h => h.type === 'production' && h.breadType === 'small');
    expect(prodEntries.length).toBeGreaterThan(0);
    expect(prodEntries[0].quantity).toBe(80);
  });

  it('creates a production record in storage', () => {
    const batch = seedBatch();
    seedFullStock();
    seedFinishedInventory();

    storage.saveProduction({
      batchId: batch.id, numberOfMixes: 1,
      output: { mini: 0, small: 80, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0 }
    });

    expect(storage.getProductions()).toHaveLength(1);
  });

  it('throws when numberOfMixes is 0', () => {
    const batch = seedBatch();
    seedFullStock();
    expect(() => storage.saveProduction({
      batchId: batch.id, numberOfMixes: 0, output: {}
    })).toThrow();
  });

  it('throws when ingredients are insufficient', () => {
    const batch = seedBatch();
    // Don't seed stock — defaults to 0
    expect(() => storage.saveProduction({
      batchId: batch.id, numberOfMixes: 3,
      output: { mini: 0, small: 80, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0 }
    })).toThrow();
  });

  it('ingredient multiplication uses exact 3dp rounding (no float drift)', () => {
    const batch = seedBatch();
    seedFullStock();
    seedFinishedInventory();

    storage.saveProduction({
      batchId: batch.id, numberOfMixes: 3, // 9.5 × 3 = 28.5 (not 28.499...)
      output: { mini: 0, small: 0, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0 }
    });

    const prod = storage.getProductions()[0];
    expect(prod.ingredientsUsed.flour.amount).toBe(28.5);
  });

  it('upserts daily history after saving', () => {
    const batch = seedBatch();
    seedFullStock();
    seedFinishedInventory();

    storage.saveProduction({
      batchId: batch.id, numberOfMixes: 1,
      output: { mini: 0, small: 80, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0 }
    });

    const dh = storage.getDailyHistory(today());
    expect(dh).not.toBeNull();
    expect(dh.production.batches.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// saveSale
// ─────────────────────────────────────────────────────────────────────────────
describe('saveSale', () => {
  const saleData = () => ({
    customerId:          null,
    customerName:        'Walk-in',
    items:               [{ breadType: 'small', quantity: 10, unitPrice: 500, isRetailer: false, subtotal: 5000 }],
    totalAmount:         5000,
    amountPaid:          5000,
    paymentMethod:       'cash',
    previousDebtApplied: 0
  });

  beforeEach(() => seedFinishedInventory());

  it('deducts quantity from finished inventory', () => {
    storage.saveSale(saleData());
    const inv = storage.getFinishedInventory(today());
    expect(inv.small).toBe(90); // 100 - 10
  });

  it('appends sale entry to inventory history', () => {
    storage.saveSale(saleData());
    const inv      = storage.getFinishedInventory(today());
    const saleEntry = inv.history.find(h => h.type === 'sale' && h.breadType === 'small');
    expect(saleEntry).toBeDefined();
    expect(saleEntry.quantity).toBe(10);
  });

  it('assigns a unique receipt number', () => {
    const sale = storage.saveSale(saleData());
    expect(sale.receiptNumber).toMatch(/^RCP-\d{5}$/);
  });

  it('increments receipt counter on each sale', () => {
    const s1 = storage.saveSale(saleData());
    const s2 = storage.saveSale(saleData());
    expect(s1.receiptNumber).not.toBe(s2.receiptNumber);
  });

  it('throws when quantity exceeds stock', () => {
    expect(() => storage.saveSale({
      ...saleData(),
      items: [{ breadType: 'small', quantity: 9999, unitPrice: 500, isRetailer: false, subtotal: 0 }],
      totalAmount: 0
    })).toThrow();
  });

  it('throws when items array is empty', () => {
    expect(() => storage.saveSale({ ...saleData(), items: [] })).toThrow();
  });

  it('updates customer outstanding and debtHistory when customerId provided', () => {
    const customer = storage.saveCustomer({ name: 'Ngozi' });
    storage.saveSale({
      ...saleData(),
      customerId:    customer.id,
      customerName:  'Ngozi',
      totalAmount:   5000,
      amountPaid:    3000,  // ₦2000 outstanding
      paymentMethod: 'cash'
    });
    const updated = storage.getCustomerById(customer.id);
    // debtHistory should reflect the outstanding and the payment
    expect(updated.debtHistory.length).toBeGreaterThan(0);
    expect(updated.outstanding).toBe(recalculateOutstanding(updated));
  });

  it('upserts daily history after saving', () => {
    storage.saveSale(saleData());
    const dh = storage.getDailyHistory(today());
    expect(dh).not.toBeNull();
    expect(dh.sales.totalRevenue).toBe(5000);
  });
});

// Helper from utils (imported at top)
function recalculateOutstanding(customer) {
  if (!customer?.debtHistory?.length) return 0;
  return customer.debtHistory.reduce((acc, tx) => acc + (Number(tx.delta) || 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────────────────────────────────────
describe('Customer CRUD', () => {
  it('saves and retrieves a customer', () => {
    const c = storage.saveCustomer({ name: 'Amaka', phone: '08012345678' });
    expect(c.id).toBeTruthy();
    expect(storage.getCustomerById(c.id)).toMatchObject({ name: 'Amaka' });
  });

  it('new customer has outstanding = 0', () => {
    const c = storage.saveCustomer({ name: 'Tunde' });
    expect(c.outstanding).toBe(0);
    expect(c.debtHistory).toHaveLength(0);
  });

  it('recordPayment appends to debtHistory and recalculates outstanding', () => {
    const c = storage.saveCustomer({ name: 'Fatima' });
    // Manually add debt first via updateCustomer
    const withDebt = storage.updateCustomer(c.id, {
      debtHistory: [{ delta: 1000, timestamp: new Date().toISOString(), reference: 'SALE-1' }]
    });
    expect(withDebt.outstanding).toBe(1000);

    const afterPayment = storage.recordPayment(c.id, 400);
    expect(afterPayment.outstanding).toBe(600);
    expect(afterPayment.totalPaid).toBe(400);
  });

  it('recordPayment throws for unknown customer', () => {
    expect(() => storage.recordPayment('unknown', 100)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Expenses
// ─────────────────────────────────────────────────────────────────────────────
describe('saveExpense', () => {
  it('saves expense and returns record with id', () => {
    const e = storage.saveExpense({ category: 'gas', amount: 5000, description: 'Gas refill' });
    expect(e.id).toBeTruthy();
    expect(e.category).toBe('gas');
    expect(e.amount).toBe(5000);
  });

  it('throws for invalid category', () => {
    expect(() => storage.saveExpense({ category: 'luxury', amount: 100 })).toThrow();
  });

  it('throws for zero or negative amount', () => {
    expect(() => storage.saveExpense({ category: 'gas', amount: 0 })).toThrow();
    expect(() => storage.saveExpense({ category: 'gas', amount: -100 })).toThrow();
  });

  it('upserts daily history after saving', () => {
    storage.saveExpense({ category: 'fuel', amount: 2000 });
    const dh = storage.getDailyHistory(today());
    expect(dh.expenses.totalExpenses).toBe(2000);
    expect(dh.expenses.breakdown.fuel).toBe(2000);
  });

  it('voidExpense marks expense as voided without deleting it', () => {
    const e     = storage.saveExpense({ category: 'packaging', amount: 1000 });
    const voided = storage.voidExpense(e.id, { voidReason: 'Duplicate entry' });
    expect(voided.voided).toBe(true);
    // Record still exists
    expect(storage.getExpenses().find(x => x.id === e.id)).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// upsertDailyHistory
// ─────────────────────────────────────────────────────────────────────────────
describe('upsertDailyHistory', () => {
  it('returns a zeroed record when no activity exists for a date', () => {
    const dh = storage.upsertDailyHistory('2025-01-01');
    expect(dh.sales.totalRevenue).toBe(0);
    expect(dh.expenses.totalExpenses).toBe(0);
    expect(dh.profit.netProfit).toBe(0);
    expect(dh.date).toBe('2025-01-01');
  });

  it('aggregates multiple expenses correctly', () => {
    storage.saveExpense({ category: 'gas',  amount: 3000 });
    storage.saveExpense({ category: 'fuel', amount: 2000 });
    const dh = storage.getDailyHistory(today());
    expect(dh.expenses.totalExpenses).toBe(5000);
    expect(dh.expenses.breakdown.gas).toBe(3000);
    expect(dh.expenses.breakdown.fuel).toBe(2000);
  });

  it('profit.profitMargin is 0 when revenue is 0 (no divide-by-zero)', () => {
    storage.saveExpense({ category: 'gas', amount: 1000 });
    const dh = storage.getDailyHistory(today());
    expect(dh.profit.profitMargin).toBe(0);
    expect(isFinite(dh.profit.profitMargin)).toBe(true);
  });

  it('excludes voided expenses from totals', () => {
    const e = storage.saveExpense({ category: 'gas', amount: 3000 });
    storage.voidExpense(e.id, { voidReason: 'error' });
    storage.upsertDailyHistory(today());
    const dh = storage.getDailyHistory(today());
    expect(dh.expenses.totalExpenses).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────
describe('Settings', () => {
  it('getSettings returns default when not set', () => {
    const s = storage.getSettings();
    expect(s.shopName).toBe('BakeFlow Bakery');
    expect(s.theme).toBe('light');
  });

  it('saveSettings merges and persists', () => {
    storage.saveSettings({ shopName: 'My Bakery', phone: '0800000000' });
    const s = storage.getSettings();
    expect(s.shopName).toBe('My Bakery');
    expect(s.phone).toBe('0800000000');
    expect(s.theme).toBe('light'); // not overwritten
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exportBackup / importBackup
// ─────────────────────────────────────────────────────────────────────────────
describe('exportBackup / importBackup', () => {
  it('round-trips all batch mixes', () => {
    seedBatch();
    const json = storage.exportBackup();
    localStorage.clear();
    storage.importBackup(json);
    expect(storage.getBatchMixes()).toHaveLength(1);
  });

  it('round-trips settings', () => {
    storage.saveSettings({ shopName: 'Round-trip Bakery' });
    const json = storage.exportBackup();
    localStorage.clear();
    storage.importBackup(json);
    expect(storage.getSettings().shopName).toBe('Round-trip Bakery');
  });

  it('does not reset receipt counter to a lower value on import', () => {
    // Advance counter to 5
    for (let i = 0; i < 5; i++) storage.incrementReceiptCounter();
    expect(storage.getReceiptCounter()).toBe(5);

    // Export has counter = 5, then advance local to 8
    const json = storage.exportBackup();
    for (let i = 0; i < 3; i++) storage.incrementReceiptCounter();
    expect(storage.getReceiptCounter()).toBe(8);

    // Import should NOT lower counter back to 5
    storage.importBackup(json);
    expect(storage.getReceiptCounter()).toBe(8);
  });

  it('throws on invalid JSON', () => {
    expect(() => storage.importBackup('{bad json')).toThrow();
  });

  it('throws on missing data object', () => {
    expect(() => storage.importBackup('{"version":"1.0"}')).toThrow();
  });

  it('exported JSON is valid and parseable', () => {
    const json = storage.exportBackup();
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).version).toBe('1.0');
    expect(JSON.parse(json).exportedAt).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStorageUsage
// ─────────────────────────────────────────────────────────────────────────────
describe('getStorageUsage', () => {
  it('returns an object with usedBytes, limitBytes, ratio, and warningLevel', () => {
    const usage = storage.getStorageUsage();
    expect(typeof usage.usedBytes).toBe('number');
    expect(typeof usage.ratio).toBe('number');
    expect(['ok', 'warning', 'critical']).toContain(usage.warningLevel);
  });

  it('returns warningLevel of ok for empty storage', () => {
    expect(storage.getStorageUsage().warningLevel).toBe('ok');
  });
});
