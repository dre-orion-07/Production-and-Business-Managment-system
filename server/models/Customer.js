/**
 * @fileoverview BakeFlow ERP — models/Customer.js
 * Customer record with debt tracking via debtHistory log.
 * Outstanding balance is always recalculated from debtHistory — never stored directly.
 */

'use strict';

const mongoose = require('mongoose');

const DebtEntrySchema = new mongoose.Schema({
  delta: { type: Number, required: true },   // positive = debt added, negative = payment
  timestamp: { type: String, required: true },
  reference: { type: String, required: true },
}, { _id: false });

const PurchaseEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  timestamp: { type: String, required: true },
  reference: { type: String, required: true },
}, { _id: false });

const PaymentEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  timestamp: { type: String, required: true },
  reference: { type: String, required: true },
}, { _id: false });

const CustomerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  /** Computed from debtHistory sum — recalculated on every update */
  outstanding: { type: Number, default: 0 },
  lifetimePurchases: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  debtHistory: { type: [DebtEntrySchema], default: [] },
  purchaseHistory: { type: [PurchaseEntrySchema], default: [] },
  paymentHistory: { type: [PaymentEntrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Customer', CustomerSchema);
