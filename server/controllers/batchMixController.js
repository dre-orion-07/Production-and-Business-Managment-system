/**
 * @fileoverview BakeFlow ERP — controllers/batchMixController.js
 * CRUD for batch mix recipes. Non-financial — hard delete is allowed.
 */

'use strict';

const BatchMix = require('../models/BatchMix');

/**
 * GET /api/batch-mixes
 */
async function getBatchMixes(req, res) {
  try {
    const mixes = await BatchMix.find({ userId: req.userId }).sort({ createdAt: 1 });
    res.json({ mixes });
  } catch (err) {
    console.error('[BatchMix] getBatchMixes:', err);
    res.status(500).json({ error: 'Failed to load batch mixes.' });
  }
}

/**
 * GET /api/batch-mixes/:id
 */
async function getBatchMixById(req, res) {
  try {
    const mix = await BatchMix.findOne({ _id: req.params.id, userId: req.userId });
    if (!mix) {
      return res.status(404).json({ error: 'Batch mix not found.' });
    }
    res.json({ mix });
  } catch (err) {
    console.error('[BatchMix] getBatchMixById:', err);
    res.status(500).json({ error: 'Failed to load batch mix.' });
  }
}

/**
 * POST /api/batch-mixes
 * Body: { name, size, ingredients: { key: { amount, unit }, ... } }
 */
async function createBatchMix(req, res) {
  try {
    const { name, size, ingredients } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Batch name is required.' });
    }
    if (!['10kg', '12kg', '14kg', '16kg'].includes(size)) {
      return res.status(400).json({ error: 'Batch size must be one of: 10kg, 12kg, 14kg, 16kg.' });
    }

    const mix = await BatchMix.create({
      userId: req.userId,
      name:   name.trim(),
      size,
      ingredients: ingredients || {},
      totalCost: 0,
    });

    res.status(201).json({ mix });
  } catch (err) {
    console.error('[BatchMix] createBatchMix:', err);
    res.status(500).json({ error: 'Failed to create batch mix.' });
  }
}

/**
 * PUT /api/batch-mixes/:id
 * Body: partial { name?, size?, ingredients?, totalCost? }
 */
async function updateBatchMix(req, res) {
  try {
    const { name, size, ingredients, totalCost } = req.body;
    const updates = { updatedAt: new Date() };

    if (name !== undefined)        { updates.name        = name.trim(); }
    if (size !== undefined)        { updates.size        = size; }
    if (ingredients !== undefined) { updates.ingredients = ingredients; }
    if (totalCost !== undefined)   { updates.totalCost   = totalCost; }

    const mix = await BatchMix.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!mix) {
      return res.status(404).json({ error: 'Batch mix not found.' });
    }

    res.json({ mix });
  } catch (err) {
    console.error('[BatchMix] updateBatchMix:', err);
    res.status(500).json({ error: 'Failed to update batch mix.' });
  }
}

/**
 * DELETE /api/batch-mixes/:id
 * Non-financial record — hard delete allowed.
 */
async function deleteBatchMix(req, res) {
  try {
    const result = await BatchMix.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Batch mix not found.' });
    }
    res.json({ message: 'Batch mix deleted.' });
  } catch (err) {
    console.error('[BatchMix] deleteBatchMix:', err);
    res.status(500).json({ error: 'Failed to delete batch mix.' });
  }
}

module.exports = { getBatchMixes, getBatchMixById, createBatchMix, updateBatchMix, deleteBatchMix };
