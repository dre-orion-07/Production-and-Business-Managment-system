/**
 * @fileoverview BakeFlow ERP — controllers/ingredientController.js
 * CRUD for ingredient stock records + Task 4: restock with price history.
 *
 * Route handlers:
 *   GET    /api/ingredients          → getAllIngredients
 *   PUT    /api/ingredients          → saveAllIngredients  (manual adjust)
 *   PATCH  /api/ingredients/:key/restock  → restockIngredient (Task 4)
 *   PATCH  /api/ingredients/:key/adjust   → adjustIngredient
 *   POST   /api/ingredients/custom        → addCustomIngredient
 *   DELETE /api/ingredients/custom/:key   → removeCustomIngredient
 */

'use strict';

const Ingredient = require('../models/Ingredient');
const Settings   = require('../models/Settings');

/**
 * GET /api/ingredients
 * Returns all ingredient documents for the authenticated user.
 */
async function getAllIngredients(req, res) {
  try {
    const ingredients = await Ingredient.find({ userId: req.userId }).sort({ isCustom: 1, label: 1 });
    res.json({ ingredients });
  } catch (err) {
    console.error('[Ingredient] getAllIngredients:', err);
    res.status(500).json({ error: 'Failed to load ingredients.' });
  }
}

/**
 * PUT /api/ingredients
 * Bulk-updates stock levels for all ingredients (manual adjust).
 * Body: { stock: { flour: { amount: 9.5, unit: 'kg' }, ... } }
 */
async function saveAllIngredients(req, res) {
  try {
    const { stock } = req.body;
    if (!stock || typeof stock !== 'object') {
      return res.status(400).json({ error: 'stock object is required.' });
    }

    const ops = Object.entries(stock).map(([key, { amount, unit }]) => ({
      updateOne: {
        filter: { userId: req.userId, key },
        update: {
          $set: {
            amount: Math.max(0, parseFloat(Number(amount).toFixed(3))),
            unit,
            updatedAt: new Date(),
          },
        },
        upsert: false,
      },
    }));

    if (ops.length > 0) {
      await Ingredient.bulkWrite(ops);
    }

    const ingredients = await Ingredient.find({ userId: req.userId }).sort({ isCustom: 1, label: 1 });
    res.json({ ingredients });
  } catch (err) {
    console.error('[Ingredient] saveAllIngredients:', err);
    res.status(500).json({ error: 'Failed to save stock levels.' });
  }
}

/**
 * PATCH /api/ingredients/:key/adjust
 * Adjusts stock by a delta (positive = add, negative = deduct).
 * Body: { delta: number }
 */
async function adjustIngredient(req, res) {
  try {
    const { key } = req.params;
    const delta   = parseFloat(req.body.delta);

    if (isNaN(delta)) {
      return res.status(400).json({ error: 'delta must be a number.' });
    }

    const ingredient = await Ingredient.findOne({ userId: req.userId, key });
    if (!ingredient) {
      return res.status(404).json({ error: `Ingredient not found: ${key}` });
    }

    ingredient.amount = Math.max(0, parseFloat(((ingredient.amount || 0) + delta).toFixed(3)));
    ingredient.updatedAt = new Date();
    await ingredient.save();

    res.json({ ingredient });
  } catch (err) {
    console.error('[Ingredient] adjustIngredient:', err);
    res.status(500).json({ error: 'Failed to adjust ingredient stock.' });
  }
}

/**
 * PATCH /api/ingredients/:key/restock  (Task 4)
 * Restocks an ingredient and manages the rolling price history.
 *
 * Body: { amount: number, price?: number }
 *
 * Price history rules:
 * - If price is provided AND differs from currentPrice → shift currentPrice → previousPrice
 * - Only the last two prices are kept (rolling, not a full log)
 * - lastRestockAmount and lastRestockDate are always updated
 */
async function restockIngredient(req, res) {
  try {
    const { key }  = req.params;
    const amount   = parseFloat(req.body.amount);
    const newPrice = req.body.price !== undefined ? parseFloat(req.body.price) : null;

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number.' });
    }

    const ingredient = await Ingredient.findOne({ userId: req.userId, key });
    if (!ingredient) {
      return res.status(404).json({ error: `Ingredient not found: ${key}` });
    }

    // ── Price history logic (Task 4) ────────────────────────────────────────
    if (newPrice !== null && !isNaN(newPrice) && newPrice >= 0) {
      if (newPrice !== ingredient.currentPrice) {
        // Shift: old current → previous
        ingredient.previousPrice = ingredient.currentPrice;
        ingredient.currentPrice  = newPrice;

        // Keep Settings.unitCosts in sync (backward compat)
        await Settings.findOneAndUpdate(
          { userId: req.userId },
          { $set: { [`unitCosts.${key}`]: newPrice, updatedAt: new Date() } }
        );
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Add stock
    ingredient.amount = parseFloat(((ingredient.amount || 0) + amount).toFixed(3));

    // Track last restock event
    const todayStr = new Date().toISOString().slice(0, 10);
    ingredient.lastRestockAmount = amount;
    ingredient.lastRestockDate   = todayStr;
    ingredient.updatedAt         = new Date();

    await ingredient.save();

    res.json({ ingredient });
  } catch (err) {
    console.error('[Ingredient] restockIngredient:', err);
    res.status(500).json({ error: 'Failed to restock ingredient.' });
  }
}

/**
 * POST /api/ingredients/custom
 * Adds a new custom ingredient (user-defined, beyond the 11 built-ins).
 * Body: { label, unit, price?, initialStock?, threshold? }
 */
async function addCustomIngredient(req, res) {
  try {
    const { label, unit, price = 0, initialStock = 0, threshold = 0 } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ error: 'Ingredient name is required.' });
    }
    if (!unit) {
      return res.status(400).json({ error: 'Ingredient unit is required.' });
    }

    // Generate camelCase key (same logic as utils.js slugifyIngredientKey)
    const words = label.trim().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    let baseKey = words.map((w, i) =>
      i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join('') || 'ingredient';

    // Ensure uniqueness within this user's ingredient set
    let key = baseKey;
    let n   = 2;
    while (await Ingredient.exists({ userId: req.userId, key })) {
      key = `${baseKey}${n++}`;
    }

    const ingredient = await Ingredient.create({
      userId:       req.userId,
      key,
      label:        label.trim(),
      unit,
      amount:       Math.max(0, parseFloat(Number(initialStock).toFixed(3)) || 0),
      threshold:    Math.max(0, Number(threshold) || 0),
      isCustom:     true,
      currentPrice: Math.max(0, Number(price) || 0),
    });

    // Sync unit cost into settings
    await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $set: { [`unitCosts.${key}`]: ingredient.currentPrice, updatedAt: new Date() } }
    );

    res.status(201).json({ ingredient });
  } catch (err) {
    console.error('[Ingredient] addCustomIngredient:', err);
    res.status(500).json({ error: 'Failed to add custom ingredient.' });
  }
}

/**
 * DELETE /api/ingredients/custom/:key
 * Removes a custom ingredient (built-ins cannot be removed).
 */
async function removeCustomIngredient(req, res) {
  try {
    const { key } = req.params;

    const ingredient = await Ingredient.findOne({ userId: req.userId, key });
    if (!ingredient) {
      return res.status(404).json({ error: `Ingredient not found: ${key}` });
    }
    if (!ingredient.isCustom) {
      return res.status(403).json({ error: 'Built-in ingredients cannot be removed.' });
    }

    await ingredient.deleteOne();

    // Remove from settings unitCosts
    await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $unset: { [`unitCosts.${key}`]: '' }, $set: { updatedAt: new Date() } }
    );

    res.json({ message: `Ingredient "${key}" removed.` });
  } catch (err) {
    console.error('[Ingredient] removeCustomIngredient:', err);
    res.status(500).json({ error: 'Failed to remove ingredient.' });
  }
}

module.exports = {
  getAllIngredients,
  saveAllIngredients,
  adjustIngredient,
  restockIngredient,
  addCustomIngredient,
  removeCustomIngredient,
};
