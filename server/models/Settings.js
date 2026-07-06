/**
 * @fileoverview BakeFlow ERP — models/Settings.js
 * Per-bakery configuration: shop name, address, ingredient unit costs, theme.
 * One document per user.
 */

'use strict';

const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  shopName: { type: String, default: 'BakeFlow Bakery', trim: true },
  address:  { type: String, default: '', trim: true },
  phone:    { type: String, default: '', trim: true },
  theme:    { type: String, enum: ['light', 'dark'], default: 'light' },
  /**
   * Unit costs per ingredient key in NGN.
   * Stored here for backward compatibility, but Tasks 4/5 use Ingredient.currentPrice.
   * Both are kept in sync: restocking an ingredient updates both.
   */
  unitCosts: {
    type: Map,
    of: Number,
    default: () => ({}),
  },
  /** Sequential receipt counter — never resets, persists across sessions */
  receiptCounter: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Settings', SettingsSchema);
