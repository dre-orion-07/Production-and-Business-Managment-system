/**
 * @fileoverview BakeFlow ERP — models/DailyHistory.js
 * Daily summary snapshot — upserted after every production/sale/expense save.
 * Mirrors the existing localStorage DailyHistory structure.
 */

'use strict';

const mongoose = require('mongoose');

const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];
const EXPENSE_CATEGORIES = [
  'gas', 'packaging', 'fuel', 'salary', 'repairs',
  'electricity', 'maintenance', 'owner_withdrawal', 'miscellaneous'
];

const BatchRefSchema = new mongoose.Schema({
  id: { type: String, required: true },
  batchName: { type: String, required: true },
  mixes: { type: Number, required: true },
}, { _id: false });

const DailyHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  /** Date as YYYY-MM-DD */
  date: { type: String, required: true },

  production: {
    batches: { type: [BatchRefSchema], default: [] },
    totalItemsProduced: {
      type: Map,
      of: Number,
      default: () => Object.fromEntries(BREAD_TYPES.map(bt => [bt, 0])),
    },
    totalProductionCost: { type: Number, default: 0 },
  },

  sales: {
    totalRevenue: { type: Number, default: 0 },
    totalItemsSold: { type: Number, default: 0 },
    totalDebtCreated: { type: Number, default: 0 },
    totalDebtCleared: { type: Number, default: 0 },
  },

  expenses: {
    totalExpenses: { type: Number, default: 0 },
    breakdown: {
      type: Map,
      of: Number,
      default: () => Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0])),
    },
  },

  profit: {
    grossProfit: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 },
  },

  openingCash: { type: Number, default: 0 },
  closingCash: { type: Number, default: 0 },
});

DailyHistorySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyHistory', DailyHistorySchema);
