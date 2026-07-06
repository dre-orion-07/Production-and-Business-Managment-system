/**
 * @fileoverview BakeFlow ERP — models/FinishedInventory.js
 * Per-date bread stock + history log of production and sale transactions.
 * Mirrors the existing localStorage FinishedInventory structure.
 */

'use strict';

const mongoose = require('mongoose');

const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];

const HistoryEntrySchema = new mongoose.Schema({
  type:      { type: String, enum: ['production', 'sale'], required: true },
  breadType: { type: String, enum: BREAD_TYPES, required: true },
  quantity:  { type: Number, required: true },
  timestamp: { type: String, required: true },
  /** ID of the production or sale record that generated this entry */
  reference: { type: String, required: true },
}, { _id: false });

const FinishedInventorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  /** Date as YYYY-MM-DD — one document per date per bakery */
  date: {
    type: String,
    required: true,
  },
  // Current stock counts per bread type
  mini:      { type: Number, default: 0 },
  small:     { type: Number, default: 0 },
  medium:    { type: Number, default: 0 },
  big:       { type: Number, default: 0 },
  sardine:   { type: Number, default: 0 },
  chocolate: { type: Number, default: 0 },
  coconut:   { type: Number, default: 0 },
  /** Ordered log of all production/sale events for this date */
  history:   { type: [HistoryEntrySchema], default: [] },
  lastUpdated: { type: String },
});

FinishedInventorySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('FinishedInventory', FinishedInventorySchema);
