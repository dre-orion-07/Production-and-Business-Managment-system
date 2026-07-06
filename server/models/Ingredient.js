/**
 * @fileoverview BakeFlow ERP — models/Ingredient.js
 * Tracks stock level, low-stock threshold, price history (Tasks 4 & 5),
 * and the most recent restock event per ingredient per bakery.
 */

'use strict';

const mongoose = require('mongoose');

const IngredientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  /** CamelCase storage key, e.g. 'flour', 'wheatFlour' */
  key: {
    type: String,
    required: true,
    trim: true,
  },
  /** Human-readable label, e.g. 'Flour' */
  label: {
    type: String,
    required: true,
    trim: true,
  },
  /** Measurement unit: 'kg' | 'g' | 'liters' | 'ml' | 'pieces' */
  unit: {
    type: String,
    required: true,
    trim: true,
  },
  /** Current stock quantity */
  amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Low-stock alert threshold */
  threshold: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** False for built-in (flour, sugar, etc.), true for user-added */
  isCustom: {
    type: Boolean,
    default: false,
  },

  // ── Task 4: Price history (rolling — only last 2 prices kept) ───────────
  /** Current price per unit in NGN */
  currentPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Previous price per unit in NGN — only set when price changes */
  previousPrice: {
    type: Number,
    default: null,
  },
  /** Quantity added in the most recent restock event */
  lastRestockAmount: {
    type: Number,
    default: null,
  },
  /** Date of the most recent restock (YYYY-MM-DD) */
  lastRestockDate: {
    type: String,
    default: null,
  },
  // ─────────────────────────────────────────────────────────────────────────

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound unique index: one record per ingredient key per user
IngredientSchema.index({ userId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Ingredient', IngredientSchema);
