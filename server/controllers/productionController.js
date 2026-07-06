/**
 * @fileoverview BakeFlow ERP — controllers/productionController.js
 * Full production save flow (mirrors storage.js saveProduction logic):
 *  1. Validate ingredient stock
 *  2. Compute ingredients used (batch × mixes)
 *  3. Deduct from ingredient stock
 *  4. Add output to finished inventory + append history
 *  5. Save production record with costSnapshot (Task 6)
 *  6. Upsert daily history
 *
 * Task 6: costSnapshot is computed server-side using current ingredient prices,
 * frozen at save time. Water is excluded from cost calculations.
 */

'use strict';

const BatchMix         = require('../models/BatchMix');
const Ingredient       = require('../models/Ingredient');
const Production       = require('../models/Production');
const FinishedInventory = require('../models/FinishedInventory');
const Settings         = require('../models/Settings');
const { upsertDailyHistoryForDate } = require('./dailyHistoryController');

const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];

/** Rounds to 3 decimal places — same rule as utils.js roundTo3dp */
const r3 = (n) => parseFloat(Number(n).toFixed(3));
/** Rounds to 2 decimal places */
const r2 = (n) => parseFloat(Number(n).toFixed(2));

/**
 * GET /api/production
 * Query params: date?, start?, end?
 */
async function getProductions(req, res) {
  try {
    const { date, start, end } = req.query;
    const filter = { userId: req.userId };

    if (date)         { filter.date = date; }
    else if (start && end) { filter.date = { $gte: start, $lte: end }; }

    const productions = await Production.find(filter).sort({ createdAt: 1 });
    res.json({ productions });
  } catch (err) {
    console.error('[Production] getProductions:', err);
    res.status(500).json({ error: 'Failed to load productions.' });
  }
}

/**
 * POST /api/production
 * Body: { batchId, numberOfMixes, output: { mini, small, ... }, date? }
 */
async function saveProduction(req, res) {
  try {
    const { batchId, numberOfMixes, output, date: rawDate } = req.body;
    const dateStr = rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (!batchId) {
      return res.status(400).json({ error: 'batchId is required.' });
    }
    if (!numberOfMixes || numberOfMixes < 1) {
      return res.status(400).json({ error: 'Number of mixes must be at least 1.' });
    }

    // ── 1. Load batch mix ──────────────────────────────────────────────────
    const batch = await BatchMix.findOne({ _id: batchId, userId: req.userId });
    if (!batch) {
      return res.status(404).json({ error: `Batch mix not found: ${batchId}` });
    }

    // ── 2. Compute ingredients used ────────────────────────────────────────
    const ingredientsMap = batch.ingredients instanceof Map
      ? batch.ingredients
      : new Map(Object.entries(batch.ingredients || {}));

    const ingredientsUsed = {};
    for (const [key, { amount, unit }] of ingredientsMap.entries()) {
      ingredientsUsed[key] = { amount: r3(amount * numberOfMixes), unit };
    }

    // ── 3. Validate stock ──────────────────────────────────────────────────
    const allIngredients = await Ingredient.find({ userId: req.userId });
    const stockMap = Object.fromEntries(allIngredients.map(ing => [ing.key, ing]));

    const stockErrors = [];
    for (const [key, { amount, unit }] of Object.entries(ingredientsUsed)) {
      const available = stockMap[key]?.amount ?? 0;
      if (amount > available) {
        const label = stockMap[key]?.label || key;
        stockErrors.push(`Insufficient ${label}: need ${amount} ${unit}, have ${available} ${unit}.`);
      }
    }
    if (stockErrors.length) {
      return res.status(422).json({ error: stockErrors.join('\n'), stockErrors });
    }

    // ── 4. Deduct ingredients ──────────────────────────────────────────────
    const deductOps = Object.entries(ingredientsUsed).map(([key, { amount }]) => ({
      updateOne: {
        filter: { userId: req.userId, key },
        update: {
          $inc: { amount: -amount },
          $set: { updatedAt: new Date() },
        },
      },
    }));
    await Ingredient.bulkWrite(deductOps);
    // Clamp to 0 (prevent floating-point negative from $inc)
    await Ingredient.updateMany(
      { userId: req.userId, amount: { $lt: 0 } },
      { $set: { amount: 0 } }
    );

    // ── 5. Compute cost snapshot (Task 6) — water excluded ────────────────
    const settings    = await Settings.findOne({ userId: req.userId });
    const unitCostsMap = settings?.unitCosts instanceof Map
      ? settings.unitCosts
      : new Map(Object.entries(settings?.unitCosts || {}));

    const costSnapshot = {};
    let productionCost = 0;

    for (const [key, { amount }] of Object.entries(ingredientsUsed)) {
      if (key === 'water') { continue; }   // exclude water from cost

      // Use Ingredient.currentPrice if available, fall back to Settings.unitCosts
      const ingredientDoc = allIngredients.find(i => i.key === key);
      const unitCost = ingredientDoc?.currentPrice
        ?? parseFloat(unitCostsMap.get(key) || 0);

      const lineCost = r2(amount * unitCost);
      productionCost += lineCost;

      costSnapshot[key] = { amountUsed: amount, unitCost, lineCost };
    }
    productionCost = r2(productionCost);

    // ── 6. Update finished inventory ───────────────────────────────────────
    const now = new Date().toISOString();
    let inv   = await FinishedInventory.findOne({ userId: req.userId, date: dateStr });
    if (!inv) {
      inv = new FinishedInventory({ userId: req.userId, date: dateStr });
    }

    const productionId = new (require('mongoose').Types.ObjectId)().toString();
    for (const bt of BREAD_TYPES) {
      const qty = Number(output?.[bt]) || 0;
      if (qty <= 0) { continue; }
      inv[bt] = (inv[bt] || 0) + qty;
      inv.history.push({ type: 'production', breadType: bt, quantity: qty, timestamp: now, reference: productionId });
    }
    inv.lastUpdated = now;
    await inv.save();

    // ── 7. Save production record ──────────────────────────────────────────
    const totalOutput = BREAD_TYPES.reduce((s, bt) => s + (Number(output?.[bt]) || 0), 0);
    const outputMap   = Object.fromEntries(BREAD_TYPES.map(bt => [bt, Number(output?.[bt]) || 0]));

    const record = await Production.create({
      _id:            productionId,
      userId:         req.userId,
      batchId:        batch._id,
      batchName:      batch.name,
      numberOfMixes:  Number(numberOfMixes),
      date:           dateStr,
      ingredientsUsed,
      output:         outputMap,
      totalOutput,
      productionCost,
      costSnapshot,
      createdAt:      new Date(),
    });

    // ── 8. Upsert daily history ────────────────────────────────────────────
    await upsertDailyHistoryForDate(req.userId, dateStr);

    res.status(201).json({ production: record });
  } catch (err) {
    console.error('[Production] saveProduction:', err);
    res.status(500).json({ error: err.message || 'Failed to save production.' });
  }
}

module.exports = { getProductions, saveProduction };
