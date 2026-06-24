/**
 * @fileoverview BakeFlow ERP — utils.js
 * Pure helper functions: decimal arithmetic, formatting, validation, constants.
 * NO DOM access, NO localStorage access, NO side effects.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** @type {readonly string[]} Fixed bread types — do not change in v1 */
export const BREAD_TYPES = Object.freeze([
  'mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'
]);

/** @type {readonly string[]} Valid expense categories */
export const EXPENSE_CATEGORIES = Object.freeze([
  'gas', 'packaging', 'fuel', 'salary', 'repairs',
  'electricity', 'maintenance', 'owner_withdrawal', 'miscellaneous'
]);

/** @type {readonly string[]} Valid batch sizes */
export const BATCH_SIZES = Object.freeze(['10kg', '12kg', '14kg', '16kg']);

/** @type {readonly string[]} Valid payment methods */
export const PAYMENT_METHODS = Object.freeze(['cash', 'transfer', 'debt']);

/** @type {readonly string[]} Ingredient keys */
export const INGREDIENT_KEYS = Object.freeze([
  'flour', 'wheatFlour', 'sugar', 'salt', 'yeast',
  'margarine', 'oil', 'improver', 'preservative', 'flavour', 'water'
]);

/** @type {{ [key: string]: string }} Human-readable ingredient labels */
export const INGREDIENT_LABELS = Object.freeze({
  flour:        'Flour',
  wheatFlour:   'Wheat Flour',
  sugar:        'Sugar',
  salt:         'Salt',
  yeast:        'Yeast',
  margarine:    'Margarine',
  oil:          'Oil',
  improver:     'Improver',
  preservative: 'Preservative',
  flavour:      'Flavour',
  water:        'Water'
});

/** @type {{ [key: string]: string }} Human-readable expense category labels */
export const EXPENSE_CATEGORY_LABELS = Object.freeze({
  gas:               'Gas',
  packaging:         'Packaging',
  fuel:              'Fuel',
  salary:            'Salary',
  repairs:           'Repairs',
  electricity:       'Electricity',
  maintenance:       'Maintenance',
  owner_withdrawal:  'Owner Withdrawal',
  miscellaneous:     'Miscellaneous'
});

/** Retailer price for small bread in Naira */
export const PRICE_SMALL_RETAILER = 450;
/** Non-retailer price for small bread in Naira */
export const PRICE_SMALL_NORMAL = 500;

/** Maximum number of auto-backups to keep */
export const MAX_BACKUP_COUNT = 5;

// ─────────────────────────────────────────────────────────────────────────────
// DECIMAL ARITHMETIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rounds a number to 3 decimal places to prevent floating-point drift.
 * Always use this after multiplying ingredient amounts.
 * @param {number} value
 * @returns {number}
 * @example
 * roundTo3dp(9.5 * 3) // 28.5  (not 28.499999...)
 */
export function roundTo3dp(value) {
  return parseFloat(Number(value).toFixed(3));
}

/**
 * Rounds a number to 2 decimal places (for currency).
 * @param {number} value
 * @returns {number}
 */
export function roundTo2dp(value) {
  return parseFloat(Number(value).toFixed(2));
}

/**
 * Multiplies an ingredient amount by number of mixes with correct rounding.
 * @param {number} amount       - Base ingredient amount from batch recipe
 * @param {number} numberOfMixes
 * @returns {number} Rounded to 3 d.p.
 */
export function multiplyIngredient(amount, numberOfMixes) {
  return roundTo3dp(amount * numberOfMixes);
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a number as Nigerian Naira currency string.
 * @param {number} amount
 * @returns {string} e.g. "₦1,500.00"
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '₦' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a number with thousand separators (no currency symbol).
 * @param {number} value
 * @returns {string} e.g. "1,500"
 */
export function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('en-NG');
}

/**
 * Formats a date as DD/MM/YYYY for Nigerian locale display.
 * @param {string|Date} date - ISO string or Date object
 * @returns {string} e.g. "07/07/2025"
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {return '—';}
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date as "DD/MM/YYYY HH:mm" for timestamp display.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {return '—';}
  const hour = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hour}:${min}`;
}

/**
 * Converts a Date or ISO string to "YYYY-MM-DD" string.
 * ALWAYS use this when keying DailyHistory or FinishedInventory records.
 * @param {string|Date} date
 * @returns {string} e.g. "2025-07-07"
 */
export function toYYYYMMDD(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {return '';}
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date as a "YYYY-MM-DD" string.
 * @returns {string}
 */
export function today() {
  return toYYYYMMDD(new Date());
}

/**
 * Formats an ingredient amount with its unit for display.
 * @param {number} amount
 * @param {string} unit
 * @returns {string} e.g. "9.5 kg" or "100 g"
 */
export function formatIngredient(amount, unit) {
  return `${amount} ${unit}`;
}

/**
 * Formats a receipt number from a counter integer.
 * @param {number} counter
 * @returns {string} e.g. "RCP-00001"
 */
export function formatReceiptNumber(counter) {
  return `RCP-${String(counter).padStart(5, '0')}`;
}

/**
 * Returns a relative time string (e.g. "2 hours ago").
 * @param {string|Date} date
 * @returns {string}
 */
export function timeAgo(date) {
  const d    = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  {return 'just now';}
  if (mins < 60) {return `${mins} min ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  {return `${hrs} hr ago`;}
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a unique ID string using timestamp + random suffix.
 * @returns {string}
 */
export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS LOGIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalculates a customer's outstanding balance from their debtHistory log.
 * NEVER decrement the outstanding field directly — always use this.
 * @param {{ debtHistory: Array<{ delta: number }> }} customer
 * @returns {number}
 */
export function recalculateOutstanding(customer) {
  if (!customer?.debtHistory?.length) {return 0;}
  return roundTo2dp(
    customer.debtHistory.reduce((acc, tx) => acc + (Number(tx.delta) || 0), 0)
  );
}

/**
 * Computes current stock for a bread type from the history log.
 * Production entries add stock; sale entries subtract.
 * @param {Array<{ type: string, breadType: string, quantity: number }>} history
 * @param {string} breadType
 * @returns {number}
 */
export function computeStock(history, breadType) {
  if (!Array.isArray(history)) {return 0;}
  return history
    .filter(tx => tx.breadType === breadType)
    .reduce((acc, tx) => {
      const qty = Number(tx.quantity) || 0;
      return acc + (tx.type === 'production' ? qty : -qty);
    }, 0);
}

/**
 * Calculates net profit from arrays of sales, productions, and expenses.
 * @param {Array<{ totalAmount: number }>} sales
 * @param {Array<{ productionCost: number }>} productions
 * @param {Array<{ amount: number }>} expenses
 * @returns {{ grossProfit: number, netProfit: number, profitMargin: number }}
 */
export function calculateNetProfit(sales = [], productions = [], expenses = []) {
  const totalRevenue    = sales.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
  const totalProdCost   = productions.reduce((s, x) => s + (Number(x.productionCost) || 0), 0);
  const totalExpenses   = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const grossProfit     = roundTo2dp(totalRevenue - totalProdCost);
  const netProfit       = roundTo2dp(grossProfit - totalExpenses);
  const profitMargin    = totalRevenue === 0
    ? 0
    : roundTo2dp((netProfit / totalRevenue) * 100);
  return { grossProfit, netProfit, profitMargin };
}

/**
 * Multiplies a batch's ingredients by numberOfMixes and returns the used amounts.
 * All values rounded to 3 d.p.
 * @param {{ [key: string]: { amount: number, unit: string } }} ingredients
 * @param {number} numberOfMixes
 * @returns {{ [key: string]: { amount: number, unit: string } }}
 */
export function computeIngredientsUsed(ingredients, numberOfMixes) {
  const result = {};
  for (const [key, { amount, unit }] of Object.entries(ingredients)) {
    result[key] = {
      amount: multiplyIngredient(amount, numberOfMixes),
      unit
    };
  }
  return result;
}

/**
 * Computes total production cost from ingredients used and unit cost settings.
 * Defaults to 0 for any ingredient without a unit cost — does NOT throw.
 * @param {{ [key: string]: { amount: number, unit: string } }} ingredientsUsed
 * @param {{ [key: string]: number }} unitCosts - from settings.unitCosts
 * @returns {{ cost: number, hasMissingCosts: boolean }}
 */
export function computeProductionCost(ingredientsUsed, unitCosts = {}) {
  let cost = 0;
  let hasMissingCosts = false;
  for (const [key, { amount }] of Object.entries(ingredientsUsed)) {
    const unitCost = unitCosts[key] ?? 0;
    if (unitCost === 0) {hasMissingCosts = true;}
    cost += amount * unitCost;
  }
  return { cost: roundTo2dp(cost), hasMissingCosts };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that ingredient stock is sufficient for a production run.
 * @param {{ [key: string]: { amount: number, unit: string } }} batchIngredients
 * @param {number} numberOfMixes
 * @param {{ [key: string]: { amount: number } }} currentStock
 * @returns {string[]} Array of error messages (empty = valid)
 */
export function validateIngredientStock(batchIngredients, numberOfMixes, currentStock) {
  const errors = [];
  if (!numberOfMixes || numberOfMixes <= 0) {
    errors.push('Number of mixes must be greater than 0.');
    return errors;
  }
  for (const [key, { amount, unit }] of Object.entries(batchIngredients)) {
    const required = multiplyIngredient(amount, numberOfMixes);
    const available = Number(currentStock?.[key]?.amount) || 0;
    if (required > available) {
      errors.push(
        `Insufficient ${INGREDIENT_LABELS[key] || key}: need ${required} ${unit}, have ${available} ${unit}.`
      );
    }
  }
  return errors;
}

/**
 * Validates that finished inventory has enough stock for a sale.
 * @param {Array<{ breadType: string, quantity: number }>} items
 * @param {{ [breadType: string]: number }} stockLevels
 * @returns {string[]} Array of error messages (empty = valid)
 */
export function validateSaleStock(items, stockLevels) {
  const errors = [];
  // Aggregate requested quantities per bread type
  const requested = {};
  for (const item of items) {
    const bt = item.breadType;
    if (!BREAD_TYPES.includes(bt)) {
      errors.push(`Invalid bread type: "${bt}".`);
      continue;
    }
    requested[bt] = (requested[bt] || 0) + (Number(item.quantity) || 0);
  }
  for (const [bt, qty] of Object.entries(requested)) {
    const available = Number(stockLevels?.[bt]) || 0;
    if (qty > available) {
      errors.push(
        `Insufficient ${bt} bread: need ${qty}, have ${available}.`
      );
    }
  }
  return errors;
}

/**
 * Validates a BatchMix object.
 * @param {object} mix
 * @returns {string[]}
 */
export function validateBatchMix(mix) {
  const errors = [];
  if (!mix?.name?.trim()) {errors.push('Batch name is required.');}
  if (!BATCH_SIZES.includes(mix?.size)) {errors.push(`Batch size must be one of: ${BATCH_SIZES.join(', ')}.`);}
  if (!mix?.ingredients || typeof mix.ingredients !== 'object') {
    errors.push('Ingredients object is required.');
  }
  return errors;
}

/**
 * Validates a Customer object.
 * @param {object} customer
 * @returns {string[]}
 */
export function validateCustomer(customer) {
  const errors = [];
  if (!customer?.name?.trim()) {errors.push('Customer name is required.');}
  if (customer?.phone && !/^\d{7,15}$/.test(customer.phone.replace(/\s/g, ''))) {
    errors.push('Phone number must be 7–15 digits.');
  }
  return errors;
}

/**
 * Validates an Expense object.
 * @param {object} expense
 * @returns {string[]}
 */
export function validateExpense(expense) {
  const errors = [];
  if (!EXPENSE_CATEGORIES.includes(expense?.category)) {
    errors.push(`Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.`);
  }
  const amount = Number(expense?.amount);
  if (isNaN(amount) || amount <= 0) {errors.push('Amount must be a positive number.');}
  if (!expense?.date) {errors.push('Date is required.');}
  return errors;
}

/**
 * Validates a Sale object.
 * @param {object} sale
 * @returns {string[]}
 */
export function validateSale(sale) {
  const errors = [];
  if (!Array.isArray(sale?.items) || sale.items.length === 0) {
    errors.push('Sale must have at least one item.');
  }
  const paid = Number(sale?.amountPaid);
  if (isNaN(paid) || paid < 0) {errors.push('Amount paid must be 0 or more.');}
  if (!PAYMENT_METHODS.includes(sale?.paymentMethod)) {
    errors.push(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`);
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED LOGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured logger utility.
 * In production, set logger.silent = true to suppress output.
 * Never use console.log directly in production code — use this instead.
 */
export const logger = (() => {
  const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  let _silent = false;
  let _level  = 'debug';

  /**
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} message
   * @param {any} [data]
   */
  function log(level, message, data) {
    if (_silent) {return;}
    if (LOG_LEVELS[level] < LOG_LEVELS[_level]) {return;}
    const ts      = new Date().toISOString();
    const prefix  = `[BakeFlow ${level.toUpperCase()}] ${ts}`;
    const args    = data !== undefined ? [prefix, message, data] : [prefix, message];
    // Use the native console methods — this IS the logger, so console.* is allowed here
    /* eslint-disable no-console */
    switch (level) {
      case 'debug': console.debug(...args); break;
      case 'info':  console.info(...args);  break;
      case 'warn':  console.warn(...args);  break;
      case 'error': console.error(...args); break;
    }
    /* eslint-enable no-console */
  }

  return {
    debug: (msg, data) => log('debug', msg, data),
    info:  (msg, data) => log('info',  msg, data),
    warn:  (msg, data) => log('warn',  msg, data),
    error: (msg, data) => log('error', msg, data),
    /** Silence all output (e.g. in test environments) */
    silence: () => { _silent = true; },
    /** Re-enable output */
    unmute: () => { _silent = false; },
    /** Set minimum log level */
    setLevel: (level) => { _level = level; },
    get silent() { return _silent; }
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// SAFE JSON PARSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a JSON string safely; returns fallback on error.
 * @template T
 * @param {string|null} json
 * @param {T} fallback
 * @returns {T}
 */
export function safeParse(json, fallback) {
  if (json === null || json === undefined) {return fallback;}
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE RANGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns start and end "YYYY-MM-DD" strings for a named date range.
 * @param {'today'|'yesterday'|'7days'|'30days'|'thisMonth'|'lastMonth'} range
 * @returns {{ start: string, end: string }}
 */
export function getDateRange(range) {
  const now   = new Date();
  const todayStr = toYYYYMMDD(now);

  switch (range) {
    case 'today':
      return { start: todayStr, end: todayStr };

    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const ys = toYYYYMMDD(y);
      return { start: ys, end: ys };
    }

    case '7days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { start: toYYYYMMDD(d), end: todayStr };
    }

    case '30days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { start: toYYYYMMDD(d), end: todayStr };
    }

    case 'thisMonth': {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { start, end: todayStr };
    }

    case 'lastMonth': {
      const lm    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toYYYYMMDD(lm), end: toYYYYMMDD(lmEnd) };
    }

    default:
      return { start: todayStr, end: todayStr };
  }
}

/**
 * Returns true if a date string (YYYY-MM-DD) is within [start, end] inclusive.
 * @param {string} dateStr  - YYYY-MM-DD
 * @param {string} start    - YYYY-MM-DD
 * @param {string} end      - YYYY-MM-DD
 * @returns {boolean}
 */
export function isInDateRange(dateStr, start, end) {
  return dateStr >= start && dateStr <= end;
}
