/**
 * @fileoverview BakeFlow ERP — models/Production.js
 * Mirrors the existing localStorage Production record + Task 6 cost snapshot.
 * costSnapshot is frozen at save time so historical reports stay accurate
 * even if ingredient prices change later.
 */

'use strict';

const mongoose = require('mongoose');

const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];

/** { amount, unit } per ingredient used */
const IngredientUsedSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  unit:   { type: String, required: true },
}, { _id: false });

/** Task 6: per-ingredient cost line frozen at save time */
const CostLineSchema = new mongoose.Schema({
  amountUsed: { type: Number, required: true },
  unitCost:   { type: Number, required: true },
  lineCost:   { type: Number, required: true },
}, { _id: false });

const ProductionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  /** Reference to the BatchMix document used */
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BatchMix',
    required: true,
  },
  /** Denormalised name so reports work even if batch is later deleted */
  batchName: {
    type: String,
    required: true,
    trim: true,
  },
  numberOfMixes: {
    type: Number,
    required: true,
    min: 1,
  },
  /** Production date as YYYY-MM-DD string */
  date: {
    type: String,
    required: true,
  },
  /** Ingredient quantities actually consumed (batch × mixes) */
  ingredientsUsed: {
    type: Map,
    of: IngredientUsedSchema,
    default: {},
  },
  /** Bread output per type */
  output: {
    type: Map,
    of: Number,
    default: () => Object.fromEntries(BREAD_TYPES.map(bt => [bt, 0])),
  },
  totalOutput: {
    type: Number,
    default: 0,
  },
  /**
   * Total production cost — snapshot at save time (Task 6).
   * Water is excluded from this calculation.
   */
  productionCost: {
    type: Number,
    default: 0,
  },
  /**
   * Task 6: Per-ingredient cost breakdown, frozen at save time.
   * Map of ingredientKey → { amountUsed, unitCost, lineCost }
   * Water is excluded.
   */
  costSnapshot: {
    type: Map,
    of: CostLineSchema,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ProductionSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Production', ProductionSchema);
