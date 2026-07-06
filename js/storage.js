/**
 * @fileoverview BakeFlow ERP — storage.js (v3 — Synchronous Cached API Layer)
 *
 * Implements an in-memory cache of all database collections.
 * The cache is preloaded once during app boot using loadAllData().
 *
 * - READS: 100% SYNCHRONOUS. Instantly returns data from the local cache.
 *   This prevents having to rewrite all query calls in the 11 UI modules.
 * - WRITES: ASYNCHRONOUS. Calls the Express API, awaits the response,
 *   re-syncs the entire cache via loadAllData() to guarantee consistency,
 *   and returns the result.
 */

import api from './api.js';
import { BREAD_TYPES, generateId, today, logger } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE DATABASE CACHE
// ─────────────────────────────────────────────────────────────────────────────

let _cache = {
  ingredients: [],
  batchMixes: [],
  productions: [],
  finishedInventory: [],
  sales: [],
  customers: [],
  expenses: [],
  dailyHistory: [],
  settings: { unitCosts: {} }
};

/**
 * Preloads all backend collections in parallel.
 * Call this at app boot (after successful login) and after any write.
 * @returns {Promise<void>}
 */
export async function loadAllData() {
  logger.info('[storage v3] Preloading all database collections into cache...');
  try {
    const [
      ingRes, mixRes, prodRes, finRes, saleRes, custRes, expRes, histRes, settRes
    ] = await Promise.all([
      api.get('/ingredients'),
      api.get('/batch-mixes'),
      api.get('/production'),
      api.get('/finished-inventory'),
      api.get('/sales'),
      api.get('/customers'),
      api.get('/expenses'),
      api.get('/daily-history'),
      api.get('/settings')
    ]);

    _cache.ingredients       = ingRes.ingredients || [];
    _cache.batchMixes        = (mixRes.mixes || []).map(normaliseMix);
    _cache.productions       = prodRes.productions || [];
    _cache.finishedInventory = finRes.records || [];
    _cache.sales             = saleRes.sales || [];
    _cache.customers         = custRes.customers || [];
    _cache.expenses          = expRes.expenses || [];
    _cache.dailyHistory      = histRes.records || [];

    // Normalise Settings Map -> Object
    const rawSettings = settRes.settings || {};
    const unitCosts   = rawSettings.unitCosts;
    _cache.settings   = {
      ...rawSettings,
      unitCosts: (unitCosts && typeof unitCosts === 'object' && !(unitCosts instanceof Map))
        ? unitCosts
        : Object.fromEntries(unitCosts || [])
    };

    logger.info('[storage v3] Preload complete.');
  } catch (err) {
    logger.error('[storage v3] Failed to preload data from server', err);
    throw err;
  }
}

// Helper to normalise Mongoose Map of ingredients -> plain object
function normaliseMix(mix) {
  if (!mix) { return mix; }
  const ing = mix.ingredients;
  if (ing && typeof ing === 'object' && !(ing instanceof Map)) {
    return { ...mix, id: mix._id || mix.id };
  }
  return { ...mix, id: mix._id || mix.id, ingredients: Object.fromEntries(ing || []) };
}

function ingredientsArrayToStockMap(ingredientsArr) {
  const map = {};
  for (const ing of (ingredientsArr || [])) {
    map[ing.key] = { amount: ing.amount ?? 0, unit: ing.unit ?? '' };
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNCHRONOUS READ QUERIES (Instant Cache Access)
// ─────────────────────────────────────────────────────────────────────────────

function getIngredientStock() {
  return ingredientsArrayToStockMap(_cache.ingredients);
}

function getCustomIngredients() {
  return _cache.ingredients.filter(i => i.isCustom);
}

function getIngredientKeys() {
  return _cache.ingredients.map(i => i.key);
}

function getIngredientLabels() {
  return Object.fromEntries(_cache.ingredients.map(i => [i.key, i.label]));
}

function getIngredientUnits() {
  return Object.fromEntries(_cache.ingredients.map(i => [i.key, i.unit]));
}

function getIngredientThresholds() {
  return Object.fromEntries(_cache.ingredients.map(i => [i.key, i.threshold ?? 0]));
}

function getBatchMixes() {
  return _cache.batchMixes;
}

function getBatchMixById(id) {
  return _cache.batchMixes.find(m => m.id === id || m._id === id) || null;
}

function getAllFinishedInventory() {
  return _cache.finishedInventory;
}

function getFinishedInventory(date) {
  const d = date || today();
  return _cache.finishedInventory.find(r => r.date === d) || {
    id: generateId(),
    date: d,
    mini: 0, small: 0, medium: 0, big: 0, sardine: 0, chocolate: 0, coconut: 0,
    lastUpdated: new Date().toISOString(),
    history: []
  };
}

function getProductions(filter) {
  let list = _cache.productions;
  if (filter?.date) {
    list = list.filter(p => p.date === filter.date);
  }
  if (filter?.start) {
    list = list.filter(p => p.date >= filter.start);
  }
  if (filter?.end) {
    list = list.filter(p => p.date <= filter.end);
  }
  return list;
}

function getCustomers() {
  return _cache.customers;
}

function getCustomerById(id) {
  return _cache.customers.find(c => c.id === id || c._id === id) || null;
}

function getSales(filter) {
  let list = _cache.sales;
  if (filter?.date) {
    list = list.filter(s => s.date === filter.date);
  }
  if (filter?.start) {
    list = list.filter(s => s.date >= filter.start);
  }
  if (filter?.end) {
    list = list.filter(s => s.date <= filter.end);
  }
  return list;
}

// Added this to support reports.js or any other queries expecting filtered lists
function getExpenses(filter) {
  let list = _cache.expenses;
  if (filter?.date) {
    list = list.filter(e => e.date === filter.date);
  }
  if (filter?.start) {
    list = list.filter(e => e.date >= filter.start);
  }
  if (filter?.end) {
    list = list.filter(e => e.date <= filter.end);
  }
  return list;
}

function getAllDailyHistory() {
  return _cache.dailyHistory;
}

function getDailyHistory(date) {
  return _cache.dailyHistory.find(h => h.date === date) || null;
}

function getSettings() {
  return _cache.settings;
}

function getReceiptCounter() {
  return _cache.settings.receiptCounter || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASYNCHRONOUS WRITES (API Calls + Auto Cache Invalidation)
// ─────────────────────────────────────────────────────────────────────────────

async function saveIngredientStock(stock) {
  await api.put('/ingredients', { stock });
  await loadAllData();
  return stock;
}

async function adjustIngredientStock(key, deltaAmount) {
  await api.patch(`/ingredients/${key}/adjust`, { delta: deltaAmount });
  await loadAllData();
  return getIngredientStock();
}

async function addCustomIngredient({ label, unit, price = 0, initialStock = 0, threshold = 0 }) {
  const { ingredient } = await api.post('/ingredients/custom', { label, unit, price, initialStock, threshold });
  await loadAllData();
  return ingredient;
}

async function removeCustomIngredient(key) {
  await api.del(`/ingredients/custom/${key}`);
  await loadAllData();
}

async function saveBatchMix(mix) {
  const { mix: saved } = await api.post('/batch-mixes', mix);
  await loadAllData();
  return normaliseMix(saved);
}

async function updateBatchMix(id, updates) {
  const { mix } = await api.put(`/batch-mixes/${id}`, updates);
  await loadAllData();
  return normaliseMix(mix);
}

async function deleteBatchMix(id) {
  await api.del(`/batch-mixes/${id}`);
  await loadAllData();
}

async function saveFinishedInventory(record) {
  const { record: saved } = await api.put(`/finished-inventory/${record.date}`, record);
  await loadAllData();
  return saved;
}

async function reconcileFinishedInventory(date) {
  const d   = date || today();
  const inv = getFinishedInventory(d);
  for (const bt of BREAD_TYPES) {
    inv[bt] = (inv.history || [])
      .filter(tx => tx.breadType === bt)
      .reduce((acc, tx) => acc + (tx.type === 'production' ? tx.quantity : -tx.quantity), 0);
  }
  inv.lastUpdated = new Date().toISOString();
  return saveFinishedInventory(inv);
}

async function saveProduction(data) {
  const { production } = await api.post('/production', data);
  await loadAllData();
  return production;
}

async function saveCustomer(customer) {
  const { customer: saved } = await api.post('/customers', customer);
  await loadAllData();
  return saved;
}

async function updateCustomer(id, updates) {
  const { customer } = await api.put(`/customers/${id}`, updates);
  await loadAllData();
  return customer;
}

async function recordPayment(customerId, amount, reference) {
  const { customer } = await api.post(`/customers/${customerId}/payment`, { amount, reference });
  await loadAllData();
  return customer;
}

async function saveSale(data) {
  const { sale } = await api.post('/sales', data);
  await loadAllData();
  return sale;
}

async function voidSale(id, updates) {
  const { sale } = await api.patch(`/sales/${id}/void`, updates);
  await loadAllData();
  return sale;
}

async function saveExpense(data) {
  const { expense } = await api.post('/expenses', data);
  await loadAllData();
  return expense;
}

async function voidExpense(id, updates) {
  const { expense } = await api.patch(`/expenses/${id}/void`, updates);
  await loadAllData();
  return expense;
}

async function upsertDailyHistory(_date) {
  // No-op client-side — managed server-side
}

async function saveSettings(updates) {
  const { settings } = await api.put('/settings', updates);
  await loadAllData();
  return settings;
}

async function incrementReceiptCounter() {
  return getReceiptCounter();
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS & SYSTEM METHODS
// ─────────────────────────────────────────────────────────────────────────────

async function exportBackup() {
  window.open(`${api.API_BASE}/settings/export`, '_blank');
  return null;
}

async function importBackup(jsonString) {
  let parsed;
  try { parsed = JSON.parse(jsonString); }
  catch { throw new Error('Invalid backup: JSON parse failed.'); }

  await api.post('/settings/import-localStorage', parsed);
  await loadAllData();
}

async function getAutoBackups() { return []; }
async function seedInitialData() {}
function getStorageUsage() {
  return { usedBytes: 0, limitBytes: Infinity, ratio: 0, warningLevel: 'ok' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const storage = {
  loadAllData, // Used by app.js on boot
  // Batch Mixes
  getBatchMixes, getBatchMixById, saveBatchMix, updateBatchMix, deleteBatchMix,
  // Ingredient Stock
  getIngredientStock, saveIngredientStock, adjustIngredientStock,
  // Custom Ingredients
  getCustomIngredients, getIngredientKeys, getIngredientLabels,
  getIngredientUnits, getIngredientThresholds,
  addCustomIngredient, removeCustomIngredient,
  // Production
  getProductions, saveProduction,
  // Finished Inventory
  getAllFinishedInventory, getFinishedInventory, saveFinishedInventory, reconcileFinishedInventory,
  // Sales
  getSales, saveSale, voidSale,
  // Customers
  getCustomers, getCustomerById, saveCustomer, updateCustomer, recordPayment,
  // Expenses
  getExpenses, saveExpense, voidExpense,
  // Daily History
  getAllDailyHistory, getDailyHistory, upsertDailyHistory,
  // Settings
  getSettings, saveSettings,
  // Receipt Counter
  getReceiptCounter, incrementReceiptCounter,
  // Backup / Restore
  exportBackup, importBackup, getAutoBackups,
  // Init
  seedInitialData,
  // Diagnostics
  getStorageUsage,
};

export default storage;
