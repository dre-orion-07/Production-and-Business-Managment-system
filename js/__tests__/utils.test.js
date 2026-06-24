/**
 * @fileoverview Unit tests for js/utils.js — pure functions only.
 * Coverage target: 90%+
 */

import {
  roundTo3dp, roundTo2dp, multiplyIngredient,
  formatCurrency, formatDate, formatDateTime, toYYYYMMDD, today, formatReceiptNumber,
  generateId, recalculateOutstanding, computeStock, calculateNetProfit,
  computeIngredientsUsed, computeProductionCost,
  validateIngredientStock, validateSaleStock,
  validateBatchMix, validateCustomer, validateExpense, validateSale,
  safeParse, getDateRange, isInDateRange, timeAgo,
  BREAD_TYPES, EXPENSE_CATEGORIES, BATCH_SIZES, PAYMENT_METHODS, INGREDIENT_KEYS
} from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
describe('Constants', () => {
  it('BREAD_TYPES contains exactly 7 fixed types', () => {
    expect(BREAD_TYPES).toHaveLength(7);
    expect(BREAD_TYPES).toContain('mini');
    expect(BREAD_TYPES).toContain('small');
    expect(BREAD_TYPES).toContain('chocolate');
    expect(BREAD_TYPES).toContain('coconut');
  });

  it('EXPENSE_CATEGORIES contains owner_withdrawal', () => {
    expect(EXPENSE_CATEGORIES).toContain('owner_withdrawal');
    expect(EXPENSE_CATEGORIES).toContain('miscellaneous');
  });

  it('BREAD_TYPES is frozen (immutable)', () => {
    expect(() => { BREAD_TYPES.push('new'); }).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Decimal arithmetic
// ─────────────────────────────────────────────────────────────────────────────
describe('roundTo3dp', () => {
  it('fixes the classic 9.5 × 3 floating-point error', () => {
    expect(roundTo3dp(9.5 * 3)).toBe(28.5);
  });

  it('fixes 11.4 × 3', () => {
    expect(roundTo3dp(11.4 * 3)).toBe(34.2);
  });

  it('handles integer values', () => {
    expect(roundTo3dp(5)).toBe(5);
  });

  it('handles zero', () => {
    expect(roundTo3dp(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(roundTo3dp(-1.23456)).toBe(-1.235);
  });

  it('rounds at the 4th decimal place', () => {
    // 1.0004 → 1.000 (rounds down), 1.00049 → 1.000
    expect(roundTo3dp(1.0004)).toBe(1);
    // 1.0006 → 1.001 (rounds up)
    expect(roundTo3dp(1.0006)).toBe(1.001);
  });

  it('handles non-numeric input gracefully', () => {
    expect(roundTo3dp(NaN)).toBeNaN();
    expect(roundTo3dp(undefined)).toBeNaN();
  });
});

describe('multiplyIngredient', () => {
  it('multiplies and rounds to 3dp', () => {
    expect(multiplyIngredient(9.5, 3)).toBe(28.5);
    expect(multiplyIngredient(0.5, 3)).toBe(1.5);
    expect(multiplyIngredient(100, 3)).toBe(300);
  });

  it('returns 0 when amount is 0', () => {
    expect(multiplyIngredient(0, 5)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Currency formatting
// ─────────────────────────────────────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formats 1500 as ₦1,500.00', () => {
    expect(formatCurrency(1500)).toBe('₦1,500.00');
  });

  it('formats 0 as ₦0.00', () => {
    expect(formatCurrency(0)).toBe('₦0.00');
  });

  it('formats large amounts with commas', () => {
    expect(formatCurrency(1234567.89)).toBe('₦1,234,567.89');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-500)).toBe('₦-500.00');
  });

  it('handles non-numeric input gracefully', () => {
    expect(formatCurrency(null)).toBe('₦0.00');
    expect(formatCurrency(undefined)).toBe('₦0.00');
    expect(formatCurrency('abc')).toBe('₦0.00');
  });

  it('uses ₦ symbol not letter N', () => {
    const result = formatCurrency(100);
    expect(result.startsWith('₦')).toBe(true);
    expect(result.charCodeAt(0)).toBe(8358); // Unicode ₦
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities
// ─────────────────────────────────────────────────────────────────────────────
describe('toYYYYMMDD', () => {
  it('returns YYYY-MM-DD string for a Date object', () => {
    const d = new Date('2025-07-07T12:00:00.000Z');
    const result = toYYYYMMDD(d);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2025-07-07');
  });

  it('accepts an ISO string', () => {
    expect(toYYYYMMDD('2025-01-15T00:00:00Z')).toBe('2025-01-15');
  });

  it('returns empty string for invalid date', () => {
    expect(toYYYYMMDD('not-a-date')).toBe('');
  });

  it('never returns a Date object', () => {
    const result = toYYYYMMDD(new Date());
    expect(typeof result).toBe('string');
    expect(result instanceof Date).toBe(false);
  });
});

describe('today', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDate', () => {
  it('formats to DD/MM/YYYY', () => {
    expect(formatDate('2025-07-07T00:00:00Z')).toBe('07/07/2025');
  });

  it('returns — for invalid dates', () => {
    expect(formatDate('bad')).toBe('—');
  });
});

describe('formatReceiptNumber', () => {
  it('pads to 5 digits with RCP- prefix', () => {
    expect(formatReceiptNumber(1)).toBe('RCP-00001');
    expect(formatReceiptNumber(999)).toBe('RCP-00999');
    expect(formatReceiptNumber(10000)).toBe('RCP-10000');
  });
});

describe('isInDateRange', () => {
  it('returns true when date is within range', () => {
    expect(isInDateRange('2025-07-07', '2025-07-01', '2025-07-31')).toBe(true);
  });

  it('returns true on boundary dates', () => {
    expect(isInDateRange('2025-07-01', '2025-07-01', '2025-07-31')).toBe(true);
    expect(isInDateRange('2025-07-31', '2025-07-01', '2025-07-31')).toBe(true);
  });

  it('returns false when outside range', () => {
    expect(isInDateRange('2025-06-30', '2025-07-01', '2025-07-31')).toBe(false);
    expect(isInDateRange('2025-08-01', '2025-07-01', '2025-07-31')).toBe(false);
  });
});

describe('getDateRange', () => {
  it('returns same start and end for today', () => {
    const { start, end } = getDateRange('today');
    expect(start).toBe(end);
    expect(start).toBe(today());
  });

  it('returns a start before end for 7days', () => {
    const { start, end } = getDateRange('7days');
    expect(start < end).toBe(true);
  });

  it('lastMonth end is before this month start', () => {
    const lm = getDateRange('lastMonth');
    const tm = getDateRange('thisMonth');
    expect(lm.end < tm.start).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Business logic helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('recalculateOutstanding', () => {
  it('sums positive deltas', () => {
    const customer = { debtHistory: [{ delta: 500 }, { delta: 300 }] };
    expect(recalculateOutstanding(customer)).toBe(800);
  });

  it('sums positive and negative deltas', () => {
    const customer = { debtHistory: [{ delta: 500 }, { delta: -200 }, { delta: 300 }] };
    expect(recalculateOutstanding(customer)).toBe(600);
  });

  it('returns 0 for empty debtHistory', () => {
    expect(recalculateOutstanding({ debtHistory: [] })).toBe(0);
  });

  it('returns 0 when customer has no debtHistory', () => {
    expect(recalculateOutstanding({})).toBe(0);
    expect(recalculateOutstanding(null)).toBe(0);
  });

  it('handles a fully paid debt (sum = 0)', () => {
    const customer = { debtHistory: [{ delta: 1000 }, { delta: -1000 }] };
    expect(recalculateOutstanding(customer)).toBe(0);
  });
});

describe('computeStock', () => {
  const history = [
    { type: 'production', breadType: 'small', quantity: 100 },
    { type: 'sale',       breadType: 'small', quantity: 30 },
    { type: 'production', breadType: 'mini',  quantity: 50 },
    { type: 'sale',       breadType: 'small', quantity: 20 }
  ];

  it('adds production, subtracts sales', () => {
    expect(computeStock(history, 'small')).toBe(50); // 100 - 30 - 20
  });

  it('handles a bread type with only production', () => {
    expect(computeStock(history, 'mini')).toBe(50);
  });

  it('returns 0 for a bread type not in history', () => {
    expect(computeStock(history, 'coconut')).toBe(0);
  });

  it('returns 0 for empty history', () => {
    expect(computeStock([], 'small')).toBe(0);
  });

  it('returns 0 for null history', () => {
    expect(computeStock(null, 'small')).toBe(0);
  });
});

describe('calculateNetProfit', () => {
  it('returns zeroes when called with no arguments', () => {
    const result = calculateNetProfit();
    expect(result.grossProfit).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.profitMargin).toBe(0);
  });

  it('returns 0 profitMargin when revenue is 0 (no divide-by-zero)', () => {
    const result = calculateNetProfit([], [], [{ amount: 500 }]);
    expect(result.profitMargin).toBe(0);
    expect(() => calculateNetProfit([], [], [{ amount: 500 }])).not.toThrow();
  });

  it('calculates correctly for simple case', () => {
    const sales     = [{ totalAmount: 10000 }];
    const prods     = [{ productionCost: 4000 }];
    const expenses  = [{ amount: 2000 }];
    const result    = calculateNetProfit(sales, prods, expenses);
    expect(result.grossProfit).toBe(6000);
    expect(result.netProfit).toBe(4000);
    expect(result.profitMargin).toBe(40);
  });

  it('handles loss scenario (negative net profit)', () => {
    const result = calculateNetProfit(
      [{ totalAmount: 1000 }],
      [{ productionCost: 3000 }],
      []
    );
    expect(result.netProfit).toBeLessThan(0);
    expect(result.grossProfit).toBe(-2000);
  });

  it('sums multiple sales, productions, and expenses', () => {
    const result = calculateNetProfit(
      [{ totalAmount: 5000 }, { totalAmount: 3000 }],
      [{ productionCost: 2000 }, { productionCost: 1000 }],
      [{ amount: 500 }, { amount: 500 }]
    );
    expect(result.grossProfit).toBe(5000);
    expect(result.netProfit).toBe(4000);
  });
});

describe('computeIngredientsUsed', () => {
  const ingredients = {
    flour: { amount: 9.5, unit: 'kg' },
    yeast: { amount: 100, unit: 'g' }
  };

  it('multiplies each ingredient by numberOfMixes', () => {
    const result = computeIngredientsUsed(ingredients, 3);
    expect(result.flour.amount).toBe(28.5); // not 28.499999
    expect(result.yeast.amount).toBe(300);
  });

  it('preserves units', () => {
    const result = computeIngredientsUsed(ingredients, 2);
    expect(result.flour.unit).toBe('kg');
    expect(result.yeast.unit).toBe('g');
  });

  it('handles numberOfMixes = 1', () => {
    const result = computeIngredientsUsed(ingredients, 1);
    expect(result.flour.amount).toBe(9.5);
  });
});

describe('computeProductionCost', () => {
  it('calculates cost from amounts and unit costs', () => {
    const used     = { flour: { amount: 9.5, unit: 'kg' } };
    const unitCosts = { flour: 1000 };
    const { cost, hasMissingCosts } = computeProductionCost(used, unitCosts);
    expect(cost).toBe(9500);
    expect(hasMissingCosts).toBe(false);
  });

  it('returns hasMissingCosts=true when a unit cost is 0', () => {
    const used     = { flour: { amount: 9.5, unit: 'kg' }, yeast: { amount: 100, unit: 'g' } };
    const unitCosts = { flour: 1000 }; // yeast not set
    const { hasMissingCosts } = computeProductionCost(used, unitCosts);
    expect(hasMissingCosts).toBe(true);
  });

  it('does not throw when unitCosts is empty', () => {
    const used = { flour: { amount: 9.5, unit: 'kg' } };
    expect(() => computeProductionCost(used, {})).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────
describe('validateIngredientStock', () => {
  const batchIngredients = {
    flour: { amount: 9.5, unit: 'kg' },
    sugar: { amount: 1, unit: 'kg' }
  };
  const currentStock = {
    flour: { amount: 30, unit: 'kg' },
    sugar: { amount: 5, unit: 'kg' }   // 5 kg > 1*3=3 needed
  };

  it('returns empty array when stock is sufficient', () => {
    expect(validateIngredientStock(batchIngredients, 3, currentStock)).toHaveLength(0);
  });

  it('returns error when numberOfMixes is 0', () => {
    const errors = validateIngredientStock(batchIngredients, 0, currentStock);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns error when numberOfMixes is negative', () => {
    const errors = validateIngredientStock(batchIngredients, -1, currentStock);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns error message for insufficient ingredient', () => {
    const lowStock = { flour: { amount: 5, unit: 'kg' }, sugar: { amount: 2, unit: 'kg' } };
    const errors   = validateIngredientStock(batchIngredients, 3, lowStock);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/flour/i);
  });

  it('identifies multiple insufficient ingredients', () => {
    const noStock = { flour: { amount: 0, unit: 'kg' }, sugar: { amount: 0, unit: 'kg' } };
    const errors  = validateIngredientStock(batchIngredients, 3, noStock);
    expect(errors.length).toBe(2);
  });
});

describe('validateSaleStock', () => {
  const stockLevels = { small: 100, mini: 50, chocolate: 0 };

  it('returns empty array when stock is sufficient', () => {
    const items = [{ breadType: 'small', quantity: 10 }, { breadType: 'mini', quantity: 5 }];
    expect(validateSaleStock(items, stockLevels)).toHaveLength(0);
  });

  it('returns error when quantity exceeds stock', () => {
    const items  = [{ breadType: 'small', quantity: 200 }];
    const errors = validateSaleStock(items, stockLevels);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/small/i);
  });

  it('returns error for invalid bread type', () => {
    const items  = [{ breadType: 'mystery-bread', quantity: 1 }];
    const errors = validateSaleStock(items, stockLevels);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('correctly aggregates quantities for the same bread type', () => {
    // Two line items for small: 60 + 50 = 110 > 100 in stock
    const items  = [
      { breadType: 'small', quantity: 60 },
      { breadType: 'small', quantity: 50 }
    ];
    const errors = validateSaleStock(items, stockLevels);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateExpense', () => {
  it('returns empty array for valid expense', () => {
    expect(validateExpense({ category: 'gas', amount: 500, date: '2025-07-07' })).toHaveLength(0);
  });

  it('returns error for invalid category', () => {
    expect(validateExpense({ category: 'unknown', amount: 500, date: '2025-07-07' }).length).toBeGreaterThan(0);
  });

  it('returns error for zero amount', () => {
    expect(validateExpense({ category: 'gas', amount: 0, date: '2025-07-07' }).length).toBeGreaterThan(0);
  });

  it('returns error for negative amount', () => {
    expect(validateExpense({ category: 'gas', amount: -100, date: '2025-07-07' }).length).toBeGreaterThan(0);
  });
});

describe('validateCustomer', () => {
  it('passes with name only', () => {
    expect(validateCustomer({ name: 'Amaka' })).toHaveLength(0);
  });

  it('fails with empty name', () => {
    expect(validateCustomer({ name: '' }).length).toBeGreaterThan(0);
  });

  it('fails with short phone number', () => {
    expect(validateCustomer({ name: 'Amaka', phone: '123' }).length).toBeGreaterThan(0);
  });

  it('passes with valid phone', () => {
    expect(validateCustomer({ name: 'Amaka', phone: '08012345678' })).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeParse
// ─────────────────────────────────────────────────────────────────────────────
describe('safeParse', () => {
  it('parses valid JSON', () => {
    expect(safeParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns fallback for null', () => {
    expect(safeParse(null, [])).toEqual([]);
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeParse('{invalid}', {})).toEqual({});
  });

  it('returns fallback for undefined', () => {
    expect(safeParse(undefined, 'default')).toBe('default');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateId
// ─────────────────────────────────────────────────────────────────────────────
describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});
