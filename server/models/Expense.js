/**
 * @fileoverview BakeFlow ERP — models/Expense.js
 * Expense record with category and soft-delete (voided flag).
 */

'use strict';

const mongoose = require('mongoose');

const EXPENSE_CATEGORIES = [
  'gas', 'packaging', 'fuel', 'salary', 'repairs',
  'electricity', 'maintenance', 'owner_withdrawal', 'miscellaneous'
];

const ExpenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category:    { type: String, enum: EXPENSE_CATEGORIES, required: true },
  amount:      { type: Number, required: true, min: 0 },
  description: { type: String, default: '', trim: true },
  /** Date as YYYY-MM-DD */
  date:        { type: String, required: true },
  voided:      { type: Boolean, default: false },
  voidReason:  { type: String, default: '' },
  voidedAt:    { type: String, default: null },
  createdAt:   { type: Date, default: Date.now },
});

ExpenseSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
