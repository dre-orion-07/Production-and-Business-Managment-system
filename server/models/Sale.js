/**
 * @fileoverview BakeFlow ERP — models/Sale.js
 * Sale record with receipt number, line items, and customer debt tracking.
 * Financial records use soft-delete (voided flag) — never hard-deleted.
 */

'use strict';

const mongoose = require('mongoose');

const BREAD_TYPES   = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];
const PAYMENT_METHODS = ['cash', 'transfer', 'debt'];

const SaleItemSchema = new mongoose.Schema({
  breadType:  { type: String, enum: BREAD_TYPES, required: true },
  quantity:   { type: Number, required: true, min: 1 },
  unitPrice:  { type: Number, required: true },
  isRetailer: { type: Boolean, default: false },
  lineTotal:  { type: Number, required: true },
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerId:           { type: String, default: null },
  customerName:         { type: String, default: 'Walk-in', trim: true },
  items:                { type: [SaleItemSchema], required: true },
  totalAmount:          { type: Number, required: true },
  amountPaid:           { type: Number, required: true },
  outstanding:          { type: Number, default: 0 },
  paymentMethod:        { type: String, enum: PAYMENT_METHODS, required: true },
  previousDebtApplied:  { type: Number, default: 0 },
  previousDebtDisplayed:{ type: Boolean, default: false },
  /** Date as YYYY-MM-DD */
  date:          { type: String, required: true },
  receiptNumber: { type: String, required: true },
  /** Sequential receipt counter value (for ordering) */
  receiptCounter:{ type: Number, required: true },
  voided:        { type: Boolean, default: false },
  voidReason:    { type: String, default: '' },
  voidedAt:      { type: String, default: null },
  createdAt:     { type: Date, default: Date.now },
});

SaleSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Sale', SaleSchema);
