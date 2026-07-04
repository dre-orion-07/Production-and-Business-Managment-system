/**
 * @fileoverview BakeFlow ERP — storage.js
 * Singleton localStorage service. ALL reads/writes go through this module.
 * Direct localStorage calls anywhere else are FORBIDDEN.
 *
 * API mimics async signatures so it's easy to swap to IndexedDB in v2.
 */

import {
  safeParse, generateId, today,
  computeIngredientsUsed, computeProductionCost,
  recalculateOutstanding, calculateNetProfit,
  validateIngredientStock, validateSaleStock,
  BREAD_TYPES, EXPENSE_CATEGORIES, MAX_BACKUP_COUNT,
  INGREDIENT_KEYS, INGREDIENT_LABELS, INGREDIENT_UNITS, LOW_STOCK_THRESHOLDS,
  slugifyIngredientKey,
  logger, formatReceiptNumber
} from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// localStorage KEY MAP
// ─────────────────────────────────────────────────────────────────────────────
const KEYS = Object.freeze({
  BATCH_MIXES:         'BF_BATCH_MIXES',
  PRODUCTIONS:         'BF_PRODUCTIONS',
  FINISHED_INVENTORY:  'BF_FINISHED_INVENTORY',
  INGREDIENT_STOCK:    'BF_INGREDIENT_STOCK',
  SALES:               'BF_SALES',
  CUSTOMERS:           'BF_CUSTOMERS',
  EXPENSES:            'BF_EXPENSES',
  DAILY_HISTORY:       'BF_DAILY_HISTORY',
  SETTINGS:            'BF_SETTINGS',
  RECEIPT_COUNTER:     'BF_RECEIPT_COUNTER',
  BACKUPS:             'BF_BACKUPS',
  SEEDED:              'BF_SEEDED',
  CUSTOM_INGREDIENTS:  'BF_CUSTOM_INGREDIENTS'
});

// ─────────────────────────────────────────────────────────────────────────────
// QUOTA GUARD
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_LIMIT_BYTES    = 5 * 1024 * 1024; // 5 MB
const STORAGE_WARN_THRESHOLD = 0.80;
const STORAGE_BLOCK_THRESHOLD = 0.95;

/**
 * Estimates current localStorage usage in bytes.
 * @returns {number}
 */
function estimateStorageUsage() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const val = localStorage.getItem(key);
    total += (key?.length || 0) + (val?.length || 0);
  }
  return total * 2; // UTF-16 chars = 2 bytes each
}

/**
 * Safely sets a localStorage key after quota check.
 * Warns at 80%, blocks at 95%.
 * @param {string} key
 * @param {string} json
 * @throws {Error} if storage is 95%+ full
 */
function safeSave(key, json) {
  const used  = estimateStorageUsage();
  const ratio = used / STORAGE_LIMIT_BYTES;
  if (ratio >= STORAGE_BLOCK_THRESHOLD) {
    throw new Error('Storage is full (>95%). Please export a backup and clear old data.');
  }
  if (ratio >= STORAGE_WARN_THRESHOLD) {
    // Caller should surface this via toast — we just log here
    logger.warn('localStorage approaching limit', { usedBytes: used, ratio: ratio.toFixed(2) });
    // Emit a custom event that the UI layer can listen for
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bakeflow:storage-warning', { detail: { ratio } }));
    }
  }
  localStorage.setItem(key, json);
}

/**
 * Reads and parses a localStorage key.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function read(key, fallback) {
  return safeParse(localStorage.getItem(key), fallback);
}

/**
 * Writes a value to localStorage as JSON.
 * @param {string} key
 * @param {any} value
 */
function write(key, value) {
  safeSave(key, JSON.stringify(value));
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
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

/** Default empty ingredient stock record */
function makeEmptyIngredientStock() {
  return {
    flour:        { amount: 0, unit: 'kg' },
    wheatFlour:   { amount: 0, unit: 'kg' },
    sugar:        { amount: 0, unit: 'kg' },
    salt:         { amount: 0, unit: 'kg' },
    yeast:        { amount: 0, unit: 'g' },
    margarine:    { amount: 0, unit: 'kg' },
    oil:          { amount: 0, unit: 'liters' },
    improver:     { amount: 0, unit: 'g' },
    preservative: { amount: 0, unit: 'g' },
    flavour:      { amount: 0, unit: 'ml' },
    water:        { amount: 0, unit: 'liters' }
  };
}

/** Default empty finished inventory for a date */
function makeEmptyFinishedInventory(date) {
  return {
    id:          generateId(),
    date,
    mini:        0, small:     0, medium:    0,
    big:         0, sardine:   0, chocolate: 0, coconut: 0,
    lastUpdated: new Date().toISOString(),
    history:     []
  };
}

/** Default settings object */
function makeDefaultSettings() {
  return {
    shopName:    'BakeFlow Bakery',
    address:     '',
    phone:       '',
    theme:       'light',
    unitCosts:   {
      flour: 0, wheatFlour: 0, sugar: 0, salt: 0, yeast: 0,
      margarine: 0, oil: 0, improver: 0, preservative: 0, flavour: 0, water: 0
    },
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-BACKUP HELPER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Saves a new auto-backup snapshot; keeps at most MAX_BACKUP_COUNT entries.
 */
function autoBackup() {
  try {
    const snapshot = {
      timestamp: new Date().toISOString(),
      data: {
        [KEYS.BATCH_MIXES]:        read(KEYS.BATCH_MIXES, []),
        [KEYS.PRODUCTIONS]:        read(KEYS.PRODUCTIONS, []),
        [KEYS.FINISHED_INVENTORY]: read(KEYS.FINISHED_INVENTORY, []),
        [KEYS.INGREDIENT_STOCK]:   read(KEYS.INGREDIENT_STOCK, makeEmptyIngredientStock()),
        [KEYS.SALES]:              read(KEYS.SALES, []),
        [KEYS.CUSTOMERS]:          read(KEYS.CUSTOMERS, []),
        [KEYS.EXPENSES]:           read(KEYS.EXPENSES, []),
        [KEYS.DAILY_HISTORY]:      read(KEYS.DAILY_HISTORY, []),
        [KEYS.SETTINGS]:           read(KEYS.SETTINGS, makeDefaultSettings()),
        [KEYS.RECEIPT_COUNTER]:    read(KEYS.RECEIPT_COUNTER, 0)
      }
    };
    const backups = read(KEYS.BACKUPS, []);
    backups.unshift(snapshot);
    if (backups.length > MAX_BACKUP_COUNT) {backups.length = MAX_BACKUP_COUNT;}
    // Use raw localStorage here (this IS storage.js, so it's allowed)
    localStorage.setItem(KEYS.BACKUPS, JSON.stringify(backups));
  } catch (err) {
    logger.warn('Auto-backup failed', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT COUNTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current receipt counter value (does NOT increment).
 * @returns {number}
 */
function getReceiptCounter() {
  return read(KEYS.RECEIPT_COUNTER, 0);
}

/**
 * Increments the receipt counter and returns the NEW value.
 * Receipt numbers are sequential and NEVER reset.
 * @returns {number}
 */
function incrementReceiptCounter() {
  const next = getReceiptCounter() + 1;
  write(KEYS.RECEIPT_COUNTER, next);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {object} Settings object */
function getSettings() {
  return read(KEYS.SETTINGS, makeDefaultSettings());
}

/**
 * @param {object} settings
 * @returns {object} Updated settings
 */
function saveSettings(settings) {
  const updated = { ...getSettings(), ...settings, updatedAt: new Date().toISOString() };
  write(KEYS.SETTINGS, updated);
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// INGREDIENT STOCK
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {object} Ingredient stock record */
function getIngredientStock() {
  return read(KEYS.INGREDIENT_STOCK, makeEmptyIngredientStock());
}

/**
 * Saves a complete ingredient stock record.
 * @param {object} stock
 * @returns {object}
 */
function saveIngredientStock(stock) {
  write(KEYS.INGREDIENT_STOCK, stock);
  return stock;
}

/**
 * Adjusts a single ingredient's stock by a delta amount (positive = add, negative = deduct).
 * @param {string} key         - ingredient key
 * @param {number} deltaAmount - positive to add, negative to deduct
 * @returns {object} Updated full stock record
 */
function adjustIngredientStock(key, deltaAmount) {
  const stock = getIngredientStock();
  if (!stock[key]) {
    logger.warn('Unknown ingredient key in adjustIngredientStock', { key });
    return stock;
  }
  stock[key] = {
    ...stock[key],
    amount: Math.max(0, parseFloat(((stock[key].amount || 0) + deltaAmount).toFixed(3)))
  };
  write(KEYS.INGREDIENT_STOCK, stock);
  return stock;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM INGREDIENTS
// ─────────────────────────────────────────────────────────────────────────────
// Lets the bakery add new ingredients (name, unit, price, stock) at runtime,
// without touching code. Built-ins (INGREDIENT_KEYS) stay hardcoded for
// stability; anything added here is layered on top everywhere ingredients
// are used — Inventory, Settings costs, Batch Mix recipes, Production, Dashboard.

/**
 * @returns {Array<{ key: string, label: string, unit: string, threshold: number }>}
 */
function getCustomIngredients() {
  return read(KEYS.CUSTOM_INGREDIENTS, []);
}

/** @returns {string[]} Built-in + custom ingredient keys */
function getIngredientKeys() {
  return [...INGREDIENT_KEYS, ...getCustomIngredients().map(c => c.key)];
}

/** @returns {{ [key: string]: string }} Built-in + custom ingredient labels */
function getIngredientLabels() {
  const labels = { ...INGREDIENT_LABELS };
  for (const c of getCustomIngredients()) {labels[c.key] = c.label;}
  return labels;
}

/** @returns {{ [key: string]: string }} Built-in + custom ingredient units */
function getIngredientUnits() {
  const units = { ...INGREDIENT_UNITS };
  for (const c of getCustomIngredients()) {units[c.key] = c.unit;}
  return units;
}

/** @returns {{ [key: string]: number }} Built-in + custom low-stock thresholds */
function getIngredientThresholds() {
  const thresholds = { ...LOW_STOCK_THRESHOLDS };
  for (const c of getCustomIngredients()) {thresholds[c.key] = c.threshold ?? 0;}
  return thresholds;
}

/**
 * Adds a brand-new ingredient: registers it, seeds its stock, and sets its
 * unit cost — all in one call, no code changes required.
 * @param {{ label: string, unit: string, price?: number, initialStock?: number, threshold?: number }} input
 * @returns {{ key: string, label: string, unit: string, threshold: number }} The newly created ingredient
 * @throws {Error} if label is missing or unit is invalid
 */
function addCustomIngredient({ label, unit, price = 0, initialStock = 0, threshold = 0 }) {
  const trimmedLabel = String(label || '').trim();
  if (!trimmedLabel) {throw new Error('Ingredient name is required.');}
  if (!unit) {throw new Error('Ingredient unit is required.');}

  const existingKeys = getIngredientKeys();
  const key = slugifyIngredientKey(trimmedLabel, existingKeys);

  const entry = { key, label: trimmedLabel, unit, threshold: Number(threshold) || 0 };
  const custom = getCustomIngredients();
  custom.push(entry);
  write(KEYS.CUSTOM_INGREDIENTS, custom);

  // Seed stock for the new ingredient
  const stock = getIngredientStock();
  stock[key] = { amount: Math.max(0, Number(initialStock) || 0), unit };
  write(KEYS.INGREDIENT_STOCK, stock);

  // Seed unit cost for the new ingredient
  const settings = getSettings();
  const unitCosts = { ...(settings.unitCosts || {}), [key]: Math.max(0, Number(price) || 0) };
  saveSettings({ unitCosts });

  logger.info('Custom ingredient added', { key, label: trimmedLabel, unit });
  return entry;
}

/**
 * Removes a custom ingredient (built-in ingredients cannot be removed).
 * Clears its stock entry and unit cost. Any batch mix recipes that already
 * reference it keep the leftover key harmlessly (treated as 0 going forward).
 * @param {string} key
 */
function removeCustomIngredient(key) {
  const custom = getCustomIngredients();
  const filtered = custom.filter(c => c.key !== key);
  if (filtered.length === custom.length) {
    logger.warn('Attempted to remove unknown or built-in ingredient', { key });
    return;
  }
  write(KEYS.CUSTOM_INGREDIENTS, filtered);

  const stock = getIngredientStock();
  delete stock[key];
  write(KEYS.INGREDIENT_STOCK, stock);

  const settings = getSettings();
  const unitCosts = { ...(settings.unitCosts || {}) };
  delete unitCosts[key];
  saveSettings({ unitCosts });

  logger.info('Custom ingredient removed', { key });
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH MIXES
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {Array} All batch mixes */
function getBatchMixes() {
  return read(KEYS.BATCH_MIXES, []);
}

/**
 * @param {string} id
 * @returns {object|null}
 */
function getBatchMixById(id) {
  return getBatchMixes().find(m => m.id === id) || null;
}

/**
 * Saves a new batch mix.
 * @param {object} mix - Without id/createdAt/updatedAt (these are set here)
 * @returns {object} Saved mix with id
 */
function saveBatchMix(mix) {
  const now    = new Date().toISOString();
  const record = { ...mix, id: generateId(), totalCost: mix.totalCost || 0, createdAt: now, updatedAt: now };
  const mixes  = getBatchMixes();
  mixes.push(record);
  write(KEYS.BATCH_MIXES, mixes);
  logger.info('BatchMix saved', { id: record.id, name: record.name });
  return record;
}

/**
 * Updates an existing batch mix by id.
 * @param {string} id
 * @param {object} updates
 * @returns {object} Updated mix
 */
function updateBatchMix(id, updates) {
  const mixes   = getBatchMixes();
  const idx     = mixes.findIndex(m => m.id === id);
  if (idx === -1) {throw new Error(`BatchMix not found: ${id}`);}
  mixes[idx]    = { ...mixes[idx], ...updates, id, updatedAt: new Date().toISOString() };
  write(KEYS.BATCH_MIXES, mixes);
  return mixes[idx];
}

/**
 * Deletes a batch mix (non-financial record — hard delete is allowed).
 * @param {string} id
 */
function deleteBatchMix(id) {
  const mixes = getBatchMixes().filter(m => m.id !== id);
  write(KEYS.BATCH_MIXES, mixes);
  logger.info('BatchMix deleted', { id });
}

// ─────────────────────────────────────────────────────────────────────────────
// FINISHED INVENTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all finished inventory records.
 * @returns {Array}
 */
function getAllFinishedInventory() {
  return read(KEYS.FINISHED_INVENTORY, []);
}

/**
 * Returns the finished inventory record for a specific date (YYYY-MM-DD).
 * Creates an empty record if none exists.
 * @param {string} [date] - defaults to today
 * @returns {object}
 */
function getFinishedInventory(date) {
  const d       = date || today();
  const all     = getAllFinishedInventory();
  return all.find(r => r.date === d) || makeEmptyFinishedInventory(d);
}

/**
 * Saves or updates the finished inventory for a date.
 * @param {object} record
 * @returns {object}
 */
function saveFinishedInventory(record) {
  const all = getAllFinishedInventory();
  const idx = all.findIndex(r => r.date === record.date);
  if (idx === -1) {
    all.push(record);
  } else {
    all[idx] = record;
  }
  write(KEYS.FINISHED_INVENTORY, all);
  return record;
}

/**
 * Recomputes each bread type's stock from history and saves.
 * Use this to keep stock counts in sync with history log.
 * @param {string} [date] - defaults to today
 * @returns {object} Updated finished inventory
 */
function reconcileFinishedInventory(date) {
  const d       = date || today();
  const inv     = getFinishedInventory(d);
  for (const bt of BREAD_TYPES) {
    inv[bt] = inv.history
      .filter(tx => tx.breadType === bt)
      .reduce((acc, tx) => acc + (tx.type === 'production' ? tx.quantity : -tx.quantity), 0);
  }
  inv.lastUpdated = new Date().toISOString();
  return saveFinishedInventory(inv);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all production records, optionally filtered by date (YYYY-MM-DD).
 * @param {{ date?: string, start?: string, end?: string }} [filter]
 * @returns {Array}
 */
function getProductions(filter) {
  const all = read(KEYS.PRODUCTIONS, []);
  if (!filter) {return all;}
  return all.filter(r => {
    const d = r.date ? r.date.split('T')[0] : '';
    if (filter.date)  {return d === filter.date;}
    if (filter.start && filter.end) {return d >= filter.start && d <= filter.end;}
    return true;
  });
}

/**
 * Full production save flow:
 * 1. Validate ingredient stock
 * 2. Compute ingredients used (rounded)
 * 3. Deduct from ingredient stock
 * 4. Add output to finished inventory + append history
 * 5. Save production record
 * 6. Upsert daily history
 * 7. Auto-backup
 *
 * @param {{
 *   batchId: string,
 *   numberOfMixes: number,
 *   output: object,
 *   date?: string
 * }} data
 * @returns {object} Saved production record
 * @throws {Error} if validation fails
 */
function saveProduction(data) {
  const { batchId, numberOfMixes, output, date: rawDate } = data;
  const dateStr = rawDate ? rawDate.split('T')[0] : today();

  if (!numberOfMixes || numberOfMixes <= 0) {
    throw new Error('Number of mixes must be greater than 0.');
  }

  const batch = getBatchMixById(batchId);
  if (!batch) {throw new Error(`Batch not found: ${batchId}`);}

  const currentStock = getIngredientStock();
  const errors       = validateIngredientStock(batch.ingredients, numberOfMixes, currentStock);
  if (errors.length) {throw new Error(errors.join('\n'));}

  // Compute ingredients used
  const ingredientsUsed = computeIngredientsUsed(batch.ingredients, numberOfMixes);

  // Deduct each ingredient from stock
  for (const [key, { amount }] of Object.entries(ingredientsUsed)) {
    adjustIngredientStock(key, -amount);
  }

  // Compute production cost
  const settings = getSettings();
  const { cost: productionCost } = computeProductionCost(ingredientsUsed, settings.unitCosts || {});

  // Add output to finished inventory
  const inv         = getFinishedInventory(dateStr);
  const now         = new Date().toISOString();
  const productionId = generateId();

  for (const bt of BREAD_TYPES) {
    const qty = Number(output?.[bt]) || 0;
    if (qty <= 0) {continue;}
    inv[bt]      = (inv[bt] || 0) + qty;
    inv.history.push({
      type:      'production',
      breadType: bt,
      quantity:  qty,
      timestamp: now,
      reference: productionId
    });
  }
  inv.lastUpdated = now;
  saveFinishedInventory(inv);

  // Build and save production record
  const totalOutput = BREAD_TYPES.reduce((s, bt) => s + (Number(output?.[bt]) || 0), 0);
  const record = {
    id:              productionId,
    batchId,
    batchName:       batch.name,
    numberOfMixes,
    date:            dateStr,
    ingredientsUsed,
    output:          { ...Object.fromEntries(BREAD_TYPES.map(bt => [bt, Number(output?.[bt]) || 0])) },
    totalOutput,
    productionCost,
    createdAt:       now
  };

  const productions = read(KEYS.PRODUCTIONS, []);
  productions.push(record);
  write(KEYS.PRODUCTIONS, productions);

  upsertDailyHistory(dateStr);
  autoBackup();

  logger.info('Production saved', { id: record.id, batch: batch.name, mixes: numberOfMixes });
  return record;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {Array} All customers */
function getCustomers() {
  return read(KEYS.CUSTOMERS, []);
}

/**
 * @param {string} id
 * @returns {object|null}
 */
function getCustomerById(id) {
  return getCustomers().find(c => c.id === id) || null;
}

/**
 * Saves a new customer.
 * @param {object} customer
 * @returns {object} Saved customer
 */
function saveCustomer(customer) {
  const now    = new Date().toISOString();
  const record = {
    id:               generateId(),
    name:             customer.name?.trim() || '',
    phone:            customer.phone?.trim() || '',
    address:          customer.address?.trim() || '',
    notes:            customer.notes?.trim() || '',
    outstanding:      0,
    lifetimePurchases:0,
    totalPaid:        0,
    createdAt:        now,
    updatedAt:        now,
    purchaseHistory:  [],
    paymentHistory:   [],
    debtHistory:      []
  };
  const customers = getCustomers();
  customers.push(record);
  write(KEYS.CUSTOMERS, customers);
  return record;
}

/**
 * Updates an existing customer by id.
 * @param {string} id
 * @param {object} updates
 * @returns {object}
 */
function updateCustomer(id, updates) {
  const customers = getCustomers();
  const idx       = customers.findIndex(c => c.id === id);
  if (idx === -1) {throw new Error(`Customer not found: ${id}`);}
  customers[idx]  = { ...customers[idx], ...updates, id, updatedAt: new Date().toISOString() };
  // Always keep outstanding in sync with debtHistory
  customers[idx].outstanding = recalculateOutstanding(customers[idx]);
  write(KEYS.CUSTOMERS, customers);
  return customers[idx];
}

/**
 * Records a payment from a customer.
 * Appends to debtHistory with a negative delta and recalculates outstanding.
 * @param {string} customerId
 * @param {number} amount
 * @param {string} [reference]
 * @returns {object} Updated customer
 */
function recordPayment(customerId, amount, reference) {
  const customers = getCustomers();
  const idx       = customers.findIndex(c => c.id === customerId);
  if (idx === -1) {throw new Error(`Customer not found: ${customerId}`);}
  const now = new Date().toISOString();
  const amt = parseFloat(Number(amount).toFixed(2));
  customers[idx].debtHistory.push({ delta: -amt, timestamp: now, reference: reference || 'PAYMENT' });
  customers[idx].paymentHistory.push({ amount: amt, timestamp: now, reference: reference || 'PAYMENT' });
  customers[idx].totalPaid    = parseFloat(((customers[idx].totalPaid || 0) + amt).toFixed(2));
  customers[idx].outstanding  = recalculateOutstanding(customers[idx]);
  customers[idx].updatedAt    = now;
  write(KEYS.CUSTOMERS, customers);
  return customers[idx];
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all sales, optionally filtered.
 * @param {{ date?: string, start?: string, end?: string }} [filter]
 * @returns {Array}
 */
function getSales(filter) {
  const all = read(KEYS.SALES, []);
  if (!filter) {return all;}
  return all.filter(r => {
    const d = r.date ? r.date.split('T')[0] : '';
    if (filter.date)  {return d === filter.date;}
    if (filter.start && filter.end) {return d >= filter.start && d <= filter.end;}
    return true;
  });
}

/**
 * Full sale save flow:
 * 1. Validate finished inventory stock
 * 2. Deduct from finished inventory + append history
 * 3. Update customer outstanding via debtHistory
 * 4. Assign receipt number
 * 5. Save sale record
 * 6. Upsert daily history
 * 7. Auto-backup
 *
 * @param {{
 *   customerId: string|null,
 *   customerName: string,
 *   items: Array,
 *   totalAmount: number,
 *   amountPaid: number,
 *   paymentMethod: string,
 *   previousDebtApplied: number,
 *   date?: string
 * }} data
 * @returns {object} Saved sale record
 * @throws {Error} if validation fails
 */
function saveSale(data) {
  const dateStr = data.date ? data.date.split('T')[0] : today();

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('Sale must have at least one item.');
  }

  // Build stock levels map from current finished inventory
  const inv         = getFinishedInventory(dateStr);
  const stockLevels = Object.fromEntries(BREAD_TYPES.map(bt => [bt, inv[bt] || 0]));

  const stockErrors = validateSaleStock(data.items, stockLevels);
  if (stockErrors.length) {throw new Error(stockErrors.join('\n'));}

  // Deduct from finished inventory
  const now    = new Date().toISOString();
  const saleId = generateId();

  for (const item of data.items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) {continue;}
    inv[item.breadType] = (inv[item.breadType] || 0) - qty;
    inv.history.push({
      type:      'sale',
      breadType: item.breadType,
      quantity:  qty,
      timestamp: now,
      reference: saleId
    });
  }
  inv.lastUpdated = now;
  saveFinishedInventory(inv);

  // Update customer outstanding
  if (data.customerId) {
    const customers = getCustomers();
    const cIdx      = customers.findIndex(c => c.id === data.customerId);
    if (cIdx !== -1) {
      const outstanding = parseFloat((data.totalAmount - data.amountPaid).toFixed(2));
      // debtDelta is the full amount owed including previous debt — kept for future use
      // const _debtDelta = parseFloat(((data.totalAmount - data.amountPaid) + (data.previousDebtApplied || 0)).toFixed(2));
      // Append debt entry for new amount owed (net of payment)
      if (outstanding !== 0) {
        customers[cIdx].debtHistory.push({ delta: outstanding, timestamp: now, reference: saleId });
      }
      // If previousDebtApplied is already in their history, no double-add needed —
      // the previous debt was already in debtHistory; what we're tracking here is the NEW delta
      customers[cIdx].lifetimePurchases = parseFloat(
        ((customers[cIdx].lifetimePurchases || 0) + data.totalAmount).toFixed(2)
      );
      customers[cIdx].totalPaid = parseFloat(
        ((customers[cIdx].totalPaid || 0) + data.amountPaid).toFixed(2)
      );
      customers[cIdx].purchaseHistory.push({ amount: data.totalAmount, timestamp: now, reference: saleId });
      if (data.amountPaid > 0) {
        customers[cIdx].paymentHistory.push({ amount: data.amountPaid, timestamp: now, reference: saleId });
        customers[cIdx].debtHistory.push({ delta: -data.amountPaid, timestamp: now, reference: saleId });
      }
      customers[cIdx].outstanding = recalculateOutstanding(customers[cIdx]);
      customers[cIdx].updatedAt   = now;
      write(KEYS.CUSTOMERS, customers);
    }
  }

  // Assign receipt number
  const receiptNum    = incrementReceiptCounter();
  const receiptNumber = formatReceiptNumber(receiptNum);

  const record = {
    id:                     saleId,
    customerId:             data.customerId || null,
    customerName:           data.customerName || 'Walk-in',
    items:                  data.items,
    totalAmount:            parseFloat(Number(data.totalAmount).toFixed(2)),
    amountPaid:             parseFloat(Number(data.amountPaid).toFixed(2)),
    outstanding:            parseFloat((data.totalAmount - data.amountPaid).toFixed(2)),
    paymentMethod:          data.paymentMethod,
    previousDebtApplied:    parseFloat(Number(data.previousDebtApplied || 0).toFixed(2)),
    previousDebtDisplayed:  Boolean(data.previousDebtApplied),
    date:                   dateStr,
    receiptNumber,
    createdAt:              now,
    voided:                 false
  };

  const sales = read(KEYS.SALES, []);
  sales.push(record);
  write(KEYS.SALES, sales);

  upsertDailyHistory(dateStr);
  autoBackup();

  logger.info('Sale saved', { id: record.id, receipt: receiptNumber, total: record.totalAmount });
  return record;
}

/**
 * Soft-edits (voids) a sale record. Financial records are never hard-deleted.
 * @param {string} id
 * @param {{ voidReason: string }} updates
 * @returns {object}
 */
function voidSale(id, updates) {
  const sales = read(KEYS.SALES, []);
  const idx   = sales.findIndex(s => s.id === id);
  if (idx === -1) {throw new Error(`Sale not found: ${id}`);}
  sales[idx]  = { ...sales[idx], ...updates, voided: true, voidedAt: new Date().toISOString() };
  write(KEYS.SALES, sales);
  return sales[idx];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all expenses, optionally filtered.
 * @param {{ date?: string, start?: string, end?: string }} [filter]
 * @returns {Array}
 */
function getExpenses(filter) {
  const all = read(KEYS.EXPENSES, []);
  if (!filter) {return all;}
  return all.filter(r => {
    const d = r.date ? r.date.split('T')[0] : '';
    if (filter.date)  {return d === filter.date;}
    if (filter.start && filter.end) {return d >= filter.start && d <= filter.end;}
    return true;
  });
}

/**
 * Saves a new expense, then upserts daily history.
 * @param {{
 *   category: string,
 *   amount: number,
 *   description: string,
 *   date?: string
 * }} data
 * @returns {object} Saved expense
 */
function saveExpense(data) {
  if (!EXPENSE_CATEGORIES.includes(data.category)) {
    throw new Error(`Invalid category: ${data.category}`);
  }
  const amount = parseFloat(Number(data.amount).toFixed(2));
  if (isNaN(amount) || amount <= 0) {throw new Error('Expense amount must be a positive number.');}

  const now     = new Date().toISOString();
  const dateStr = data.date ? data.date.split('T')[0] : today();
  const record  = {
    id:          generateId(),
    category:    data.category,
    amount,
    description: data.description?.trim() || '',
    date:        dateStr,
    createdAt:   now,
    voided:      false
  };
  const expenses = read(KEYS.EXPENSES, []);
  expenses.push(record);
  write(KEYS.EXPENSES, expenses);

  upsertDailyHistory(dateStr);
  autoBackup();

  logger.info('Expense saved', { id: record.id, category: record.category, amount: record.amount });
  return record;
}

/**
 * Soft-edits (voids) an expense. Financial records are never hard-deleted.
 * @param {string} id
 * @param {{ voidReason: string }} updates
 * @returns {object}
 */
function voidExpense(id, updates) {
  const expenses = read(KEYS.EXPENSES, []);
  const idx      = expenses.findIndex(e => e.id === id);
  if (idx === -1) {throw new Error(`Expense not found: ${id}`);}
  expenses[idx]  = { ...expenses[idx], ...updates, voided: true, voidedAt: new Date().toISOString() };
  write(KEYS.EXPENSES, expenses);
  return expenses[idx];
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all daily history records.
 * @returns {Array}
 */
function getAllDailyHistory() {
  return read(KEYS.DAILY_HISTORY, []);
}

/**
 * Returns the daily history record for a date.
 * @param {string} date - YYYY-MM-DD
 * @returns {object|null}
 */
function getDailyHistory(date) {
  return getAllDailyHistory().find(r => r.date === date) || null;
}

/**
 * Builds a zeroed DailyHistory scaffold for a date.
 * @param {string} date
 * @returns {object}
 */
function makeEmptyDailyHistory(date) {
  return {
    id:   generateId(),
    date,
    production: {
      batches:           [],
      totalItemsProduced:Object.fromEntries(BREAD_TYPES.map(bt => [bt, 0])),
      totalProductionCost:0
    },
    sales: { totalRevenue:0, totalItemsSold:0, totalDebtCreated:0, totalDebtCleared:0 },
    expenses: {
      totalExpenses: 0,
      breakdown: Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0]))
    },
    profit: { grossProfit:0, netProfit:0, profitMargin:0 },
    openingCash: 0,
    closingCash:  0
  };
}

/**
 * Recalculates and upserts the DailyHistory for a given date from source data.
 * MUST be called after every saveProduction, saveSale, and saveExpense.
 * @param {string} date - YYYY-MM-DD
 * @returns {object} Updated DailyHistory
 */
function upsertDailyHistory(date) {
  const existing   = getDailyHistory(date) || makeEmptyDailyHistory(date);
  const prods      = getProductions({ date });
  const sales      = getSales({ date }).filter(s => !s.voided);
  const expenses   = getExpenses({ date }).filter(e => !e.voided);

  // Production aggregation
  const totalItemsProduced = Object.fromEntries(BREAD_TYPES.map(bt => [bt, 0]));
  let totalProductionCost  = 0;
  const batchRefs          = [];
  for (const p of prods) {
    totalProductionCost += p.productionCost || 0;
    batchRefs.push({ id: p.id, batchName: p.batchName, mixes: p.numberOfMixes });
    for (const bt of BREAD_TYPES) {
      totalItemsProduced[bt] += Number(p.output?.[bt]) || 0;
    }
  }

  // Sales aggregation
  let totalRevenue     = 0;
  let totalItemsSold   = 0;
  let totalDebtCreated = 0;
  const totalDebtCleared = 0;
  for (const s of sales) {
    totalRevenue   += s.totalAmount || 0;
    totalItemsSold += (s.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
    totalDebtCreated += s.outstanding || 0;
  }

  // Expenses aggregation
  const breakdown  = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0]));
  let totalExpenses = 0;
  for (const e of expenses) {
    totalExpenses      += e.amount || 0;
    breakdown[e.category] = parseFloat(((breakdown[e.category] || 0) + e.amount).toFixed(2));
  }

  // Profit
  const { grossProfit, netProfit, profitMargin } = calculateNetProfit(
    sales,
    prods,
    expenses
  );

  const updated = {
    ...existing,
    production: {
      batches:            batchRefs,
      totalItemsProduced: { ...totalItemsProduced, ...Object.fromEntries(BREAD_TYPES.map(bt => [bt, parseFloat(totalItemsProduced[bt].toFixed(0))])) },
      totalProductionCost:parseFloat(totalProductionCost.toFixed(2))
    },
    sales: {
      totalRevenue:    parseFloat(totalRevenue.toFixed(2)),
      totalItemsSold,
      totalDebtCreated:parseFloat(totalDebtCreated.toFixed(2)),
      totalDebtCleared:parseFloat(totalDebtCleared.toFixed(2))
    },
    expenses: { totalExpenses: parseFloat(totalExpenses.toFixed(2)), breakdown },
    profit:   { grossProfit, netProfit, profitMargin }
  };

  const all = getAllDailyHistory();
  const idx = all.findIndex(r => r.date === date);
  if (idx === -1) {all.push(updated);} else {all[idx] = updated;}
  write(KEYS.DAILY_HISTORY, all);
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP / RESTORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports the entire data store as a JSON string.
 * @returns {string}
 */
function exportBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version:    '1.0',
    data: {
      [KEYS.BATCH_MIXES]:        read(KEYS.BATCH_MIXES, []),
      [KEYS.PRODUCTIONS]:        read(KEYS.PRODUCTIONS, []),
      [KEYS.FINISHED_INVENTORY]: read(KEYS.FINISHED_INVENTORY, []),
      [KEYS.INGREDIENT_STOCK]:   read(KEYS.INGREDIENT_STOCK, makeEmptyIngredientStock()),
      [KEYS.SALES]:              read(KEYS.SALES, []),
      [KEYS.CUSTOMERS]:          read(KEYS.CUSTOMERS, []),
      [KEYS.EXPENSES]:           read(KEYS.EXPENSES, []),
      [KEYS.DAILY_HISTORY]:      read(KEYS.DAILY_HISTORY, []),
      [KEYS.SETTINGS]:           read(KEYS.SETTINGS, makeDefaultSettings()),
      [KEYS.RECEIPT_COUNTER]:    read(KEYS.RECEIPT_COUNTER, 0)
    }
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports data from a JSON backup string.
 * Validates structure before overwriting. Never resets receipt counter to a lower value.
 * @param {string} jsonString
 * @throws {Error} if JSON is invalid or structure is wrong
 */
function importBackup(jsonString) {
  let parsed;
  try { parsed = JSON.parse(jsonString); }
  catch { throw new Error('Invalid backup: JSON parse failed.'); }

  if (!parsed?.data || typeof parsed.data !== 'object') {
    throw new Error('Invalid backup: missing data object.');
  }
  const { data } = parsed;

  // Write each key that exists in the backup
  const importableKeys = [
    KEYS.BATCH_MIXES, KEYS.PRODUCTIONS, KEYS.FINISHED_INVENTORY,
    KEYS.INGREDIENT_STOCK, KEYS.SALES, KEYS.CUSTOMERS, KEYS.EXPENSES,
    KEYS.DAILY_HISTORY, KEYS.SETTINGS
  ];
  for (const key of importableKeys) {
    if (data[key] !== undefined) {write(key, data[key]);}
  }

  // Receipt counter: only import if backup value is HIGHER than current
  const backupCounter  = Number(data[KEYS.RECEIPT_COUNTER]) || 0;
  const currentCounter = getReceiptCounter();
  if (backupCounter > currentCounter) {
    write(KEYS.RECEIPT_COUNTER, backupCounter);
  }

  logger.info('Backup imported', { exportedAt: parsed.exportedAt });
}

/**
 * Returns the list of stored auto-backups (newest first).
 * @returns {Array}
 */
function getAutoBackups() {
  return read(KEYS.BACKUPS, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED INITIAL DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seeds initial data on first run. Safe to call every boot — checks seeded flag.
 */
function seedInitialData() {
  if (read(KEYS.SEEDED, false)) {return;}

  const now = new Date().toISOString();
  const batches = SEED_BATCH_MIXES.map(mix => ({
    ...mix,
    id:        generateId(),
    totalCost: 0,
    createdAt: now,
    updatedAt: now
  }));
  write(KEYS.BATCH_MIXES, batches);
  write(KEYS.INGREDIENT_STOCK, makeEmptyIngredientStock());
  write(KEYS.FINISHED_INVENTORY, [makeEmptyFinishedInventory(today())]);
  write(KEYS.SETTINGS, makeDefaultSettings());
  write(KEYS.SEEDED, true);

  logger.info('Seed data inserted', { batchCount: batches.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE USAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns current localStorage usage info.
 * @returns {{ usedBytes: number, limitBytes: number, ratio: number, warningLevel: string }}
 */
function getStorageUsage() {
  const usedBytes = estimateStorageUsage();
  const ratio     = usedBytes / STORAGE_LIMIT_BYTES;
  let warningLevel = 'ok';
  if (ratio >= STORAGE_BLOCK_THRESHOLD) {warningLevel = 'critical';}
  else if (ratio >= STORAGE_WARN_THRESHOLD) {warningLevel = 'warning';}
  return { usedBytes, limitBytes: STORAGE_LIMIT_BYTES, ratio, warningLevel };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const storage = {
  // Batch Mixes
  getBatchMixes, getBatchMixById, saveBatchMix, updateBatchMix, deleteBatchMix,
  // Ingredient Stock
  getIngredientStock, saveIngredientStock, adjustIngredientStock,
  // Custom Ingredients
  getCustomIngredients, getIngredientKeys, getIngredientLabels,
  getIngredientUnits, getIngredientThresholds,
  addCustomIngredient, removeCustomIngredient,
  // Production
  getProductions, saveProduction,
  // Finished Inventory
  getAllFinishedInventory, getFinishedInventory, saveFinishedInventory, reconcileFinishedInventory,
  // Sales
  getSales, saveSale, voidSale,
  // Customers
  getCustomers, getCustomerById, saveCustomer, updateCustomer, recordPayment,
  // Expenses
  getExpenses, saveExpense, voidExpense,
  // Daily History
  getAllDailyHistory, getDailyHistory, upsertDailyHistory,
  // Settings
  getSettings, saveSettings,
  // Receipt Counter
  getReceiptCounter, incrementReceiptCounter,
  // Backup / Restore
  exportBackup, importBackup, getAutoBackups,
  // Init
  seedInitialData,
  // Diagnostics
  getStorageUsage,
  // Keys (for tests)
  KEYS
};

export default storage;
