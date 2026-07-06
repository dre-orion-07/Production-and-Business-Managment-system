/**
 * @fileoverview BakeFlow ERP — controllers/customerController.js
 * CRUD for customers + payment recording.
 * Outstanding is always recalculated from debtHistory — never stored directly.
 */

'use strict';

const Customer = require('../models/Customer');

const r2 = (n) => parseFloat(Number(n).toFixed(2));

/** Recalculates outstanding from debtHistory deltas */
function recalcOutstanding(customer) {
  return r2(customer.debtHistory.reduce((s, tx) => s + (Number(tx.delta) || 0), 0));
}

/** GET /api/customers */
async function getCustomers(req, res) {
  try {
    const customers = await Customer.find({ userId: req.userId }).sort({ name: 1 });
    res.json({ customers });
  } catch (err) {
    console.error('[Customer] getCustomers:', err);
    res.status(500).json({ error: 'Failed to load customers.' });
  }
}

/** GET /api/customers/:id */
async function getCustomerById(req, res) {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, userId: req.userId });
    if (!customer) { return res.status(404).json({ error: 'Customer not found.' }); }
    res.json({ customer });
  } catch (err) {
    console.error('[Customer] getCustomerById:', err);
    res.status(500).json({ error: 'Failed to load customer.' });
  }
}

/** POST /api/customers */
async function saveCustomer(req, res) {
  try {
    const { name, phone, address, notes } = req.body;
    if (!name?.trim()) { return res.status(400).json({ error: 'Customer name is required.' }); }

    const customer = await Customer.create({
      userId: req.userId,
      name:    name.trim(),
      phone:   phone?.trim() || '',
      address: address?.trim() || '',
      notes:   notes?.trim() || '',
    });
    res.status(201).json({ customer });
  } catch (err) {
    console.error('[Customer] saveCustomer:', err);
    res.status(500).json({ error: 'Failed to save customer.' });
  }
}

/** PUT /api/customers/:id */
async function updateCustomer(req, res) {
  try {
    const { name, phone, address, notes } = req.body;
    const updates = { updatedAt: new Date() };
    if (name    !== undefined) { updates.name    = name.trim(); }
    if (phone   !== undefined) { updates.phone   = phone.trim(); }
    if (address !== undefined) { updates.address = address.trim(); }
    if (notes   !== undefined) { updates.notes   = notes.trim(); }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!customer) { return res.status(404).json({ error: 'Customer not found.' }); }
    customer.outstanding = recalcOutstanding(customer);
    await customer.save();
    res.json({ customer });
  } catch (err) {
    console.error('[Customer] updateCustomer:', err);
    res.status(500).json({ error: 'Failed to update customer.' });
  }
}

/**
 * POST /api/customers/:id/payment
 * Records a payment — appends a negative delta to debtHistory.
 * Body: { amount: number, reference?: string }
 */
async function recordPayment(req, res) {
  try {
    const { amount, reference } = req.body;
    const amt = r2(Number(amount));
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Payment amount must be a positive number.' });
    }

    const customer = await Customer.findOne({ _id: req.params.id, userId: req.userId });
    if (!customer) { return res.status(404).json({ error: 'Customer not found.' }); }

    const now = new Date().toISOString();
    const ref = reference || 'PAYMENT';
    customer.debtHistory.push({ delta: -amt, timestamp: now, reference: ref });
    customer.paymentHistory.push({ amount: amt, timestamp: now, reference: ref });
    customer.totalPaid   = r2((customer.totalPaid || 0) + amt);
    customer.outstanding = recalcOutstanding(customer);
    customer.updatedAt   = new Date();
    await customer.save();

    res.json({ customer });
  } catch (err) {
    console.error('[Customer] recordPayment:', err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
}

module.exports = { getCustomers, getCustomerById, saveCustomer, updateCustomer, recordPayment };
