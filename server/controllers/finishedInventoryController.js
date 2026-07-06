/**
 * @fileoverview BakeFlow ERP — controllers/finishedInventoryController.js
 * Per-date bread stock management.
 */

'use strict';

const FinishedInventory = require('../models/FinishedInventory');

const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];

function makeEmpty(userId, date) {
  return new FinishedInventory({ userId, date, history: [] });
}

/** GET /api/finished-inventory — returns all records */
async function getAllFinishedInventory(req, res) {
  try {
    const records = await FinishedInventory.find({ userId: req.userId }).sort({ date: -1 });
    res.json({ records });
  } catch (err) {
    console.error('[FinishedInventory] getAllFinishedInventory:', err);
    res.status(500).json({ error: 'Failed to load finished inventory.' });
  }
}

/** GET /api/finished-inventory/:date */
async function getFinishedInventory(req, res) {
  try {
    const date = req.params.date;
    let record = await FinishedInventory.findOne({ userId: req.userId, date });
    if (!record) {
      record = makeEmpty(req.userId, date);
    }
    res.json({ record });
  } catch (err) {
    console.error('[FinishedInventory] getFinishedInventory:', err);
    res.status(500).json({ error: 'Failed to load finished inventory.' });
  }
}

/** PUT /api/finished-inventory/:date — upserts a full record */
async function saveFinishedInventory(req, res) {
  try {
    const date   = req.params.date;
    const update = { ...req.body, userId: req.userId, date, lastUpdated: new Date().toISOString() };

    const record = await FinishedInventory.findOneAndUpdate(
      { userId: req.userId, date },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ record });
  } catch (err) {
    console.error('[FinishedInventory] saveFinishedInventory:', err);
    res.status(500).json({ error: 'Failed to save finished inventory.' });
  }
}

module.exports = { getAllFinishedInventory, getFinishedInventory, saveFinishedInventory };
