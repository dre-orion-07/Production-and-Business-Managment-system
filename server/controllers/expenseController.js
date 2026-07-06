/**
 * @fileoverview BakeFlow ERP — controllers/expenseController.js
 * Saves and soft-voids expense records. Financial records never hard-deleted.
 */

'use strict';

const Expense  = require('../models/Expense');
const { upsertDailyHistoryForDate } = require('./dailyHistoryController');

const EXPENSE_CATEGORIES = [
  'gas', 'packaging', 'fuel', 'salary', 'repairs',
  'electricity', 'maintenance', 'owner_withdrawal', 'miscellaneous'
];

const r2 = (n) => parseFloat(Number(n).toFixed(2));

/** GET /api/expenses  — query: date?, start?, end? */
async function getExpenses(req, res) {
  try {
    const { date, start, end } = req.query;
    const filter = { userId: req.userId };
    if (date)              { filter.date = date; }
    else if (start && end) { filter.date = { $gte: start, $lte: end }; }

    const expenses = await Expense.find(filter).sort({ createdAt: 1 });
    res.json({ expenses });
  } catch (err) {
    console.error('[Expense] getExpenses:', err);
    res.status(500).json({ error: 'Failed to load expenses.' });
  }
}

/** POST /api/expenses */
async function saveExpense(req, res) {
  try {
    const { category, amount, description, date: rawDate } = req.body;
    const dateStr = rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (!EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }
    const amt = r2(Number(amount));
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const expense = await Expense.create({
      userId:      req.userId,
      category,
      amount:      amt,
      description: description?.trim() || '',
      date:        dateStr,
    });

    await upsertDailyHistoryForDate(req.userId, dateStr);

    res.status(201).json({ expense });
  } catch (err) {
    console.error('[Expense] saveExpense:', err);
    res.status(500).json({ error: 'Failed to save expense.' });
  }
}

/** PATCH /api/expenses/:id/void */
async function voidExpense(req, res) {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { voided: true, voidReason: req.body.voidReason || '', voidedAt: new Date().toISOString() } },
      { new: true }
    );
    if (!expense) { return res.status(404).json({ error: 'Expense not found.' }); }
    await upsertDailyHistoryForDate(req.userId, expense.date);
    res.json({ expense });
  } catch (err) {
    console.error('[Expense] voidExpense:', err);
    res.status(500).json({ error: 'Failed to void expense.' });
  }
}

module.exports = { getExpenses, saveExpense, voidExpense };
