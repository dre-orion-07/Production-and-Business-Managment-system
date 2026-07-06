/**
 * @fileoverview BakeFlow ERP — controllers/settingsController.js
 * App configuration, ingredient unit costs, and data backup/restore.
 */

'use strict';

const Settings         = require('../models/Settings');
const Ingredient       = require('../models/Ingredient');
const BatchMix         = require('../models/BatchMix');
const Production       = require('../models/Production');
const FinishedInventory = require('../models/FinishedInventory');
const Sale             = require('../models/Sale');
const Customer         = require('../models/Customer');
const Expense          = require('../models/Expense');
const DailyHistory     = require('../models/DailyHistory');

/** GET /api/settings */
async function getSettings(req, res) {
  try {
    let settings = await Settings.findOne({ userId: req.userId });
    if (!settings) {
      settings = await Settings.create({ userId: req.userId });
    }
    res.json({ settings });
  } catch (err) {
    console.error('[Settings] getSettings:', err);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
}

/** PUT /api/settings */
async function saveSettings(req, res) {
  try {
    const { shopName, address, phone, theme, unitCosts } = req.body;
    const updates = { updatedAt: new Date() };

    if (shopName  !== undefined) { updates.shopName  = shopName.trim(); }
    if (address   !== undefined) { updates.address   = address.trim(); }
    if (phone     !== undefined) { updates.phone     = phone.trim(); }
    if (theme     !== undefined) { updates.theme     = theme; }
    if (unitCosts !== undefined) { updates.unitCosts = unitCosts; }

    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ settings });
  } catch (err) {
    console.error('[Settings] saveSettings:', err);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
}

/**
 * GET /api/settings/export
 * Exports entire data store as JSON for manual backup.
 */
async function exportBackup(req, res) {
  try {
    const uid = req.userId;
    const [ingredients, batchMixes, productions, finishedInventory, sales, customers, expenses, dailyHistory, settings] =
      await Promise.all([
        Ingredient.find({ userId: uid }),
        BatchMix.find({ userId: uid }),
        Production.find({ userId: uid }),
        FinishedInventory.find({ userId: uid }),
        Sale.find({ userId: uid }),
        Customer.find({ userId: uid }),
        Expense.find({ userId: uid }),
        DailyHistory.find({ userId: uid }),
        Settings.findOne({ userId: uid }),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      data: { ingredients, batchMixes, productions, finishedInventory, sales, customers, expenses, dailyHistory, settings },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bakeflow-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(payload);
  } catch (err) {
    console.error('[Settings] exportBackup:', err);
    res.status(500).json({ error: 'Export failed.' });
  }
}

/**
 * POST /api/settings/import-localStorage
 * One-time migration: imports localStorage-era JSON backup into MongoDB.
 * Body: the raw JSON object from exportBackup() (v1 format).
 */
async function importLocalStorageBackup(req, res) {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data object.' });
    }

    const uid = req.userId;
    const BREAD_TYPES = ['mini', 'small', 'medium', 'big', 'sardine', 'chocolate', 'coconut'];
    const now = new Date();

    // ── Batch mixes ──────────────────────────────────────────────────────
    const rawMixes = data['BF_BATCH_MIXES'] || [];
    if (rawMixes.length > 0) {
      await BatchMix.deleteMany({ userId: uid });
      await BatchMix.insertMany(rawMixes.map(m => ({
        userId:      uid,
        name:        m.name,
        size:        m.size,
        ingredients: m.ingredients || {},
        totalCost:   m.totalCost || 0,
        createdAt:   m.createdAt ? new Date(m.createdAt) : now,
        updatedAt:   m.updatedAt ? new Date(m.updatedAt) : now,
      })));
    }

    // ── Ingredient stock + unit costs ────────────────────────────────────
    const rawStock    = data['BF_INGREDIENT_STOCK'] || {};
    const rawSettings = data['BF_SETTINGS'] || {};
    const unitCosts   = rawSettings.unitCosts || {};

    for (const [key, { amount, unit }] of Object.entries(rawStock)) {
      await Ingredient.findOneAndUpdate(
        { userId: uid, key },
        { $set: { amount: amount || 0, unit: unit || 'kg', currentPrice: unitCosts[key] || 0, updatedAt: now } },
        { upsert: true }
      );
    }

    // ── Settings ─────────────────────────────────────────────────────────
    const receiptCounter = data['BF_RECEIPT_COUNTER'] || 0;
    await Settings.findOneAndUpdate(
      { userId: uid },
      {
        $set: {
          shopName:       rawSettings.shopName || 'BakeFlow Bakery',
          address:        rawSettings.address  || '',
          phone:          rawSettings.phone    || '',
          theme:          rawSettings.theme    || 'light',
          unitCosts:      unitCosts,
          receiptCounter: receiptCounter,
          updatedAt:      now,
        },
      },
      { upsert: true }
    );

    // ── Customers ─────────────────────────────────────────────────────────
    const rawCustomers = data['BF_CUSTOMERS'] || [];
    if (rawCustomers.length > 0) {
      await Customer.deleteMany({ userId: uid });
      await Customer.insertMany(rawCustomers.map(c => ({ ...c, _id: undefined, userId: uid })));
    }

    // ── Sales ─────────────────────────────────────────────────────────────
    const rawSales = data['BF_SALES'] || [];
    if (rawSales.length > 0) {
      await Sale.deleteMany({ userId: uid });
      await Sale.insertMany(rawSales.map(s => ({ ...s, _id: undefined, userId: uid, receiptCounter: s.receiptCounter || 0 })));
    }

    // ── Expenses ──────────────────────────────────────────────────────────
    const rawExpenses = data['BF_EXPENSES'] || [];
    if (rawExpenses.length > 0) {
      await Expense.deleteMany({ userId: uid });
      await Expense.insertMany(rawExpenses.map(e => ({ ...e, _id: undefined, userId: uid })));
    }

    // ── Productions ──────────────────────────────────────────────────────
    const rawProds = data['BF_PRODUCTIONS'] || [];
    if (rawProds.length > 0) {
      await Production.deleteMany({ userId: uid });
      await Production.insertMany(rawProds.map(p => ({ ...p, _id: undefined, userId: uid })));
    }

    // ── Finished inventory ─────────────────────────────────────────────
    const rawInv = data['BF_FINISHED_INVENTORY'] || [];
    if (rawInv.length > 0) {
      await FinishedInventory.deleteMany({ userId: uid });
      await FinishedInventory.insertMany(rawInv.map(r => ({ ...r, _id: undefined, userId: uid })));
    }

    res.json({ message: 'localStorage data imported successfully. Welcome to the cloud!' });
  } catch (err) {
    console.error('[Settings] importLocalStorageBackup:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
}

module.exports = { getSettings, saveSettings, exportBackup, importLocalStorageBackup };
