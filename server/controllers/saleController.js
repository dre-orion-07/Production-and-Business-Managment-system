/**
 * @fileoverview BakeFlow ERP — controllers/saleController.js
 * Full sale save flow: validate stock → deduct inventory → update customer → save → upsert daily history.
 */

'use strict';

const Sale             = require('../models/Sale');
const Customer         = require('../models/Customer');
const FinishedInventory = require('../models/FinishedInventory');
const Settings         = require('../models/Settings');
const { upsertDailyHistoryForDate } = require('./dailyHistoryController');

const BREAD_TYPES     = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];
const PAYMENT_METHODS = ['cash', 'transfer', 'debt'];

const r2 = (n) => parseFloat(Number(n).toFixed(2));

/**
 * GET /api/sales
 * Query: date?, start?, end?
 */
async function getSales(req, res) {
  try {
    const { date, start, end } = req.query;
    const filter = { userId: req.userId };

    if (date)              { filter.date = date; }
    else if (start && end) { filter.date = { $gte: start, $lte: end }; }

    const sales = await Sale.find(filter).sort({ createdAt: 1 });
    res.json({ sales });
  } catch (err) {
    console.error('[Sale] getSales:', err);
    res.status(500).json({ error: 'Failed to load sales.' });
  }
}

/**
 * POST /api/sales
 * Body mirrors storage.js saveSale data parameter.
 */
async function saveSale(req, res) {
  try {
    const { customerId, customerName, items, totalAmount, amountPaid,
            paymentMethod, previousDebtApplied, date: rawDate } = req.body;

    const dateStr = rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

    // Validation
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Sale must have at least one item.' });
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.` });
    }

    // ── 1. Validate finished inventory stock ───────────────────────────────
    let inv = await FinishedInventory.findOne({ userId: req.userId, date: dateStr });
    if (!inv) {
      inv = new FinishedInventory({ userId: req.userId, date: dateStr });
    }

    const requested = {};
    for (const item of items) {
      if (!BREAD_TYPES.includes(item.breadType)) {
        return res.status(400).json({ error: `Invalid bread type: "${item.breadType}".` });
      }
      requested[item.breadType] = (requested[item.breadType] || 0) + (Number(item.quantity) || 0);
    }

    const stockErrors = [];
    for (const [bt, qty] of Object.entries(requested)) {
      const available = inv[bt] || 0;
      if (qty > available) {
        stockErrors.push(`Insufficient ${bt} bread: need ${qty}, have ${available}.`);
      }
    }
    if (stockErrors.length) {
      return res.status(422).json({ error: stockErrors.join('\n'), stockErrors });
    }

    // ── 2. Deduct from finished inventory ──────────────────────────────────
    const now    = new Date().toISOString();
    const saleId = new (require('mongoose').Types.ObjectId)().toString();

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) { continue; }
      inv[item.breadType] = (inv[item.breadType] || 0) - qty;
      inv.history.push({ type: 'sale', breadType: item.breadType, quantity: qty, timestamp: now, reference: saleId });
    }
    inv.lastUpdated = now;
    await inv.save();

    // ── 3. Receipt number ─────────────────────────────────────────────────
    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $inc: { receiptCounter: 1 }, $set: { updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    const receiptCounter = settings.receiptCounter;
    const receiptNumber  = `RCP-${String(receiptCounter).padStart(5, '0')}`;

    // ── 4. Update customer outstanding ────────────────────────────────────
    const outstanding = r2((totalAmount || 0) - (amountPaid || 0));

    if (customerId) {
      const customer = await Customer.findOne({ _id: customerId, userId: req.userId });
      if (customer) {
        if (outstanding !== 0) {
          customer.debtHistory.push({ delta: outstanding, timestamp: now, reference: saleId });
        }
        if (Number(amountPaid) > 0) {
          customer.debtHistory.push({ delta: -Number(amountPaid), timestamp: now, reference: saleId });
          customer.paymentHistory.push({ amount: Number(amountPaid), timestamp: now, reference: saleId });
          customer.totalPaid = r2((customer.totalPaid || 0) + Number(amountPaid));
        }
        customer.lifetimePurchases = r2((customer.lifetimePurchases || 0) + Number(totalAmount));
        customer.purchaseHistory.push({ amount: Number(totalAmount), timestamp: now, reference: saleId });
        customer.outstanding = r2(customer.debtHistory.reduce((s, tx) => s + (Number(tx.delta) || 0), 0));
        customer.updatedAt   = new Date();
        await customer.save();
      }
    }

    // ── 5. Save sale record ───────────────────────────────────────────────
    const record = await Sale.create({
      _id:                    saleId,
      userId:                 req.userId,
      customerId:             customerId || null,
      customerName:           customerName || 'Walk-in',
      items,
      totalAmount:            r2(Number(totalAmount)),
      amountPaid:             r2(Number(amountPaid)),
      outstanding,
      paymentMethod,
      previousDebtApplied:    r2(Number(previousDebtApplied || 0)),
      previousDebtDisplayed:  Boolean(previousDebtApplied),
      date:                   dateStr,
      receiptNumber,
      receiptCounter,
      voided:                 false,
      createdAt:              new Date(),
    });

    // ── 6. Upsert daily history ───────────────────────────────────────────
    await upsertDailyHistoryForDate(req.userId, dateStr);

    res.status(201).json({ sale: record });
  } catch (err) {
    console.error('[Sale] saveSale:', err);
    res.status(500).json({ error: err.message || 'Failed to save sale.' });
  }
}

/**
 * PATCH /api/sales/:id/void
 * Soft-deletes a sale. Financial records are never hard-deleted.
 * Body: { voidReason: string }
 */
async function voidSale(req, res) {
  try {
    const sale = await Sale.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { voided: true, voidReason: req.body.voidReason || '', voidedAt: new Date().toISOString() } },
      { new: true }
    );
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found.' });
    }
    await upsertDailyHistoryForDate(req.userId, sale.date);
    res.json({ sale });
  } catch (err) {
    console.error('[Sale] voidSale:', err);
    res.status(500).json({ error: 'Failed to void sale.' });
  }
}

module.exports = { getSales, saveSale, voidSale };
