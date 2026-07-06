/**
 * @fileoverview BakeFlow ERP — controllers/dailyHistoryController.js
 * Recalculates and upserts the DailyHistory for a given date.
 * Called internally after every saveProduction, saveSale, and saveExpense.
 */

'use strict';

const Production       = require('../models/Production');
const Sale             = require('../models/Sale');
const Expense          = require('../models/Expense');
const DailyHistory     = require('../models/DailyHistory');

const BREAD_TYPES        = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];
const EXPENSE_CATEGORIES = [
  'gas', 'packaging', 'fuel', 'salary', 'repairs',
  'electricity', 'maintenance', 'owner_withdrawal', 'miscellaneous'
];

const r2 = (n) => parseFloat(Number(n).toFixed(2));

/**
 * Recalculates and upserts DailyHistory for a given date.
 * Exported for use by production, sale, and expense controllers.
 * @param {string} userId
 * @param {string} date - YYYY-MM-DD
 */
async function upsertDailyHistoryForDate(userId, date) {
  const [prods, sales, expenses] = await Promise.all([
    Production.find({ userId, date }),
    Sale.find({ userId, date, voided: false }),
    Expense.find({ userId, date, voided: false }),
  ]);

  // Production aggregation
  const totalItemsProduced = Object.fromEntries(BREAD_TYPES.map(bt => [bt, 0]));
  let totalProductionCost  = 0;
  const batchRefs          = [];

  for (const p of prods) {
    totalProductionCost += p.productionCost || 0;
    batchRefs.push({ id: p._id.toString(), batchName: p.batchName, mixes: p.numberOfMixes });
    const outputMap = p.output instanceof Map ? p.output : new Map(Object.entries(p.output || {}));
    for (const bt of BREAD_TYPES) {
      totalItemsProduced[bt] += Number(outputMap.get(bt)) || 0;
    }
  }

  // Sales aggregation
  let totalRevenue     = 0;
  let totalItemsSold   = 0;
  let totalDebtCreated = 0;

  for (const s of sales) {
    totalRevenue     += s.totalAmount || 0;
    totalItemsSold   += (s.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
    totalDebtCreated += s.outstanding || 0;
  }

  // Expenses aggregation
  const breakdown   = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0]));
  let totalExpenses = 0;
  for (const e of expenses) {
    totalExpenses        += e.amount || 0;
    breakdown[e.category] = r2((breakdown[e.category] || 0) + e.amount);
  }

  // Profit
  const totalRevR  = sales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalProdC = prods.reduce((s, x) => s + (x.productionCost || 0), 0);
  const totalExpR  = expenses.reduce((s, x) => s + (x.amount || 0), 0);
  const grossProfit  = r2(totalRevR - totalProdC);
  const netProfit    = r2(grossProfit - totalExpR);
  const profitMargin = totalRevR === 0 ? 0 : r2((netProfit / totalRevR) * 100);

  await DailyHistory.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        production: {
          batches: batchRefs,
          totalItemsProduced,
          totalProductionCost: r2(totalProductionCost),
        },
        sales: {
          totalRevenue:     r2(totalRevenue),
          totalItemsSold,
          totalDebtCreated: r2(totalDebtCreated),
          totalDebtCleared: 0,
        },
        expenses: {
          totalExpenses: r2(totalExpenses),
          breakdown,
        },
        profit: { grossProfit, netProfit, profitMargin },
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * GET /api/daily-history
 */
async function getAllDailyHistory(req, res) {
  try {
    const records = await DailyHistory.find({ userId: req.userId }).sort({ date: -1 });
    res.json({ records });
  } catch (err) {
    console.error('[DailyHistory] getAllDailyHistory:', err);
    res.status(500).json({ error: 'Failed to load daily history.' });
  }
}

/**
 * GET /api/daily-history/:date
 */
async function getDailyHistory(req, res) {
  try {
    const record = await DailyHistory.findOne({ userId: req.userId, date: req.params.date });
    res.json({ record: record || null });
  } catch (err) {
    console.error('[DailyHistory] getDailyHistory:', err);
    res.status(500).json({ error: 'Failed to load daily history.' });
  }
}

module.exports = { getAllDailyHistory, getDailyHistory, upsertDailyHistoryForDate };
