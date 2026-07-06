/**
 * @fileoverview BakeFlow ERP — models/BatchMix.js
 * Mirrors the existing localStorage BatchMix structure exactly.
 * Ingredients stored as a Map (key → { amount, unit }).
 */

'use strict';

const mongoose = require('mongoose');

const IngredientEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  unit:   { type: String, required: true, trim: true },
}, { _id: false });

const BatchMixSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  /** Human-readable name, e.g. '10kg Standard' */
  name: {
    type: String,
    required: true,
    trim: true,
  },
  /** Batch size label, e.g. '10kg', '12kg', '14kg', '16kg' */
  size: {
    type: String,
    required: true,
    enum: ['10kg', '12kg', '14kg', '16kg'],
  },
  /**
   * ingredients: Map of ingredientKey → { amount, unit }
   * e.g. { flour: { amount: 9.5, unit: 'kg' }, sugar: { amount: 1, unit: 'kg' }, ... }
   */
  ingredients: {
    type: Map,
    of: IngredientEntrySchema,
    default: {},
  },
  /** Cached total cost (recalculated on production) */
  totalCost: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('BatchMix', BatchMixSchema);
