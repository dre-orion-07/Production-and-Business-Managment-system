/**
 * @fileoverview BakeFlow ERP — inventory.js
 * Displays and manages raw ingredient stock levels.
 * Allows manual stock adjustments (e.g. restocking flour).
 *
 * Task 4 additions:
 * - Restock form includes a "New Price (₦)" field per ingredient
 * - Ingredient cards show last-restock amount and rolling price history
 *   (current price always shown; previous price shown only when it differs)
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import {
  CUSTOM_INGREDIENT_UNITS, formatCurrency, logger
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

// ─────────────────────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
async function init(container) {
  controller = new AbortController();
  await render(container);
}

function destroy() {
  controller?.abort();
  controller = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
async function render(container) {
  container.innerHTML = '<div class="page-loading" aria-label="Loading ingredients…"><div class="spinner"></div></div>';

  // Fetch all ingredient data from the API
  let ingredients;
  try {
    await storage.getIngredientStock(); // warms the cache
    const keys       = await storage.getIngredientKeys();
    const labels     = await storage.getIngredientLabels();
    const units      = await storage.getIngredientUnits();
    const thresholds = await storage.getIngredientThresholds();
    const stock      = await storage.getIngredientStock();
    const customIngs = await storage.getCustomIngredients();
    const customKeys = customIngs.map(c => c.key);

    // Fetch raw ingredient documents for price history (Task 4)
    // We call the internal API via storage which caches them
    // The _ingredientsCache is populated by getIngredientStock → fetchIngredients
    // We need the full documents — fetch again to get price fields
    const { ingredients: rawDocs } = await import('../api.js').then(m => m.get('/ingredients'));
    const priceMap = {};
    for (const doc of (rawDocs || [])) {
      priceMap[doc.key] = doc;
    }

    container.innerHTML = '';

    // ── Page header ──────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'page-header';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `
      <h1 class="page-title">Ingredient Stock</h1>
      <p class="page-subtitle">Current levels of raw ingredients. Deducted automatically when production is recorded.</p>
    `;

    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';

    const restockBtn = document.createElement('button');
    restockBtn.className = 'btn btn-primary';
    restockBtn.innerHTML = '<span aria-hidden="true">+</span> Restock Ingredients';
    restockBtn.addEventListener('click', () => openRestockForm(container, keys, labels, units, stock, priceMap), { signal: controller.signal });

    const adjustBtn = document.createElement('button');
    adjustBtn.className = 'btn btn-secondary';
    adjustBtn.innerHTML = '✏️ Manual Adjust';
    adjustBtn.addEventListener('click', () => openAdjustForm(container, keys, labels, units, stock), { signal: controller.signal });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary';
    addBtn.innerHTML = '<span aria-hidden="true">🧂+</span> Add New Ingredient';
    addBtn.addEventListener('click', () => openAddIngredientForm(container), { signal: controller.signal });

    btnGroup.appendChild(restockBtn);
    btnGroup.appendChild(addBtn);
    btnGroup.appendChild(adjustBtn);

    header.appendChild(titleWrap);
    header.appendChild(btnGroup);
    container.appendChild(header);

    // ── Low-stock alerts ─────────────────────────────────────────────────
    const lowItems = keys.filter(key => {
      const amount    = stock[key]?.amount ?? 0;
      const threshold = thresholds[key] ?? 0;
      return amount <= threshold;
    });

    if (lowItems.length > 0) {
      const alertBanner = document.createElement('div');
      alertBanner.className = 'alert alert--warning';
      alertBanner.setAttribute('role', 'alert');
      alertBanner.innerHTML = `
        <span class="alert__icon" aria-hidden="true">⚠️</span>
        <div>
          <strong>Low Stock Alert:</strong>
          ${lowItems.map(k => `${labels[k]} (${stock[k]?.amount ?? 0} ${units[k]})`).join(', ')}
        </div>
      `;
      container.appendChild(alertBanner);
    }

    // ── Stock cards grid ─────────────────────────────────────────────────
    const grid = document.createElement('div');
    grid.className = 'inventory-grid';
    grid.id = 'ingredient-stock-grid';

    for (const key of keys) {
      const amount    = stock[key]?.amount ?? 0;
      const unit      = units[key];
      const threshold = thresholds[key] ?? 0;
      const isLow     = amount <= threshold;
      const isEmpty   = amount === 0;
      const isCustom  = customKeys.includes(key);
      const priceDoc  = priceMap[key] || {};

      const card = document.createElement('div');
      card.className = `inv-card ${isEmpty ? 'inv-card--empty' : isLow ? 'inv-card--low' : 'inv-card--ok'}`;
      card.setAttribute('data-key', key);

      // Progress bar (relative to a sensible max)
      const maxDisplay = Math.max(threshold * 5, amount, 1);
      const pct        = Math.min(100, (amount / maxDisplay) * 100).toFixed(1);

      // ── Task 4: Price history display ─────────────────────────────────
      const currentPrice  = priceDoc.currentPrice ?? 0;
      const previousPrice = priceDoc.previousPrice ?? null;
      const priceChanged  = previousPrice !== null && previousPrice !== currentPrice;

      let priceHtml = '';
      if (currentPrice > 0) {
        if (priceChanged) {
          priceHtml = `
            <p class="inv-card__price">
              <span class="inv-card__price-new">${formatCurrency(currentPrice)}</span>
              <span class="inv-card__price-old">was ${formatCurrency(previousPrice)}</span>
            </p>`;
        } else {
          priceHtml = `<p class="inv-card__price">${formatCurrency(currentPrice)} / ${unit}</p>`;
        }
      }

      // ── Task 4: Last restock info ──────────────────────────────────────
      let restockHtml = '';
      if (priceDoc.lastRestockAmount && priceDoc.lastRestockDate) {
        restockHtml = `<p class="inv-card__restock">Last restock: ${priceDoc.lastRestockAmount} ${unit} on ${priceDoc.lastRestockDate}</p>`;
      }
      // ──────────────────────────────────────────────────────────────────

      card.innerHTML = `
        <div class="inv-card__header">
          <span class="inv-card__name">${labels[key]}</span>
          ${isEmpty  ? '<span class="badge badge-danger">Out</span>'   : ''}
          ${isLow && !isEmpty ? '<span class="badge badge-warning">Low</span>' : ''}
          ${!isLow  ? '<span class="badge badge-success">OK</span>'    : ''}
          ${isCustom ? `<button type="button" class="inv-card__remove" title="Remove custom ingredient" aria-label="Remove ${labels[key]}">✕</button>` : ''}
        </div>
        <div class="inv-card__amount">
          <span class="inv-card__value">${amount}</span>
          <span class="inv-card__unit">${unit}</span>
        </div>
        <div class="inv-card__bar" role="progressbar"
             aria-valuenow="${amount}" aria-valuemin="0" aria-valuemax="${maxDisplay}"
             aria-label="${labels[key]} stock level">
          <div class="inv-card__bar-fill" style="width:${pct}%"></div>
        </div>
        <p class="inv-card__threshold">Low threshold: ${threshold} ${unit}</p>
        ${priceHtml}
        ${restockHtml}
      `;

      if (isCustom) {
        card.querySelector('.inv-card__remove').addEventListener('click', (e) => {
          e.stopPropagation();
          confirmRemoveIngredient(key, labels[key], container);
        }, { signal: controller.signal });
      }

      grid.appendChild(card);
    }

    container.appendChild(grid);
  } catch (err) {
    logger.error('Inventory render failed', err);
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title" style="color:var(--color-danger)">Failed to load ingredients</p>
        <p class="empty-state__body">${err.message || 'Network error'}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTOCK FORM (Task 4 — price field added)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens a form to add stock to all ingredients at once.
 * Now includes a "New Price (₦)" field per ingredient (Task 4).
 * @param {HTMLElement} pageContainer
 * @param {string[]} keys
 * @param {object} labels
 * @param {object} units
 * @param {object} stock
 * @param {object} priceMap  - raw ingredient docs keyed by ingredient key
 */
function openRestockForm(pageContainer, keys, labels, units, stock, priceMap) {
  // Build interleaved fields: amount + price for each ingredient
  const fields = [];
  for (const key of keys) {
    const currentPrice = priceMap[key]?.currentPrice ?? 0;
    fields.push({
      name:        `amount_${key}`,
      label:       `${labels[key]} (${units[key]}) — stock: ${stock[key]?.amount ?? 0}`,
      type:        'number',
      value:       '',
      placeholder: 'Amount to add…',
    });
    fields.push({
      name:        `price_${key}`,
      label:       `${labels[key]} price / ${units[key]} (₦)${currentPrice > 0 ? ` — current: ${formatCurrency(currentPrice)}` : ''}`,
      type:        'number',
      value:       currentPrice > 0 ? currentPrice : '',
      placeholder: 'Leave blank to keep current price',
      hint:        currentPrice > 0 ? null : 'Enter a price to enable production cost tracking',
    });
  }

  modal.form({
    title:       'Restock Ingredients',
    fields,
    submitLabel: 'Add Stock',
    async onSubmit(values) {
      try {
        let updated = 0;
        for (const key of keys) {
          const toAdd    = parseFloat(values[`amount_${key}`]) || 0;
          const newPrice = values[`price_${key}`] !== '' && values[`price_${key}`] !== undefined
            ? parseFloat(values[`price_${key}`])
            : null;

          if (toAdd > 0 || (newPrice !== null && !isNaN(newPrice))) {
            // Use the dedicated restock endpoint (Task 4)
            const body = { amount: toAdd > 0 ? toAdd : 0 };
            if (newPrice !== null && !isNaN(newPrice)) { body.price = newPrice; }

            if (toAdd > 0 || body.price !== undefined) {
              const { default: api } = await import('../api.js');
              await api.patch(`/ingredients/${key}/restock`, body);
              updated++;
            }
          }
        }

        if (updated === 0) {
          toast.show('warning', 'No quantities entered. Nothing was added.');
        } else {
          toast.show('success', `Restock saved for ${updated} ingredient(s).`);
          await render(pageContainer);
        }
      } catch (err) {
        logger.error('Restock failed', err);
        toast.show('error', err.message || 'Failed to update stock.');
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL ADJUST FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens a form to set exact stock levels for all ingredients.
 * @param {HTMLElement} pageContainer
 * @param {string[]} keys
 * @param {object} labels
 * @param {object} units
 * @param {object} stock
 */
function openAdjustForm(pageContainer, keys, labels, units, stock) {
  const fields = keys.map(key => ({
    name:        key,
    label:       `${labels[key]} (${units[key]})`,
    type:        'number',
    value:       stock[key]?.amount ?? 0,
    placeholder: '0'
  }));

  modal.form({
    title:       'Manual Stock Adjustment',
    fields,
    submitLabel: 'Save Stock Levels',
    async onSubmit(values) {
      try {
        const newStock = {};
        for (const key of keys) {
          const amount = parseFloat(values[key]);
          newStock[key] = {
            amount: isNaN(amount) || amount < 0 ? 0 : parseFloat(amount.toFixed(3)),
            unit:   units[key]
          };
        }
        await storage.saveIngredientStock(newStock);
        toast.show('success', 'Stock levels saved.');
        await render(pageContainer);
      } catch (err) {
        logger.error('Manual adjust failed', err);
        toast.show('error', err.message || 'Failed to save stock levels.');
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD NEW INGREDIENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} pageContainer
 */
function openAddIngredientForm(pageContainer) {
  modal.form({
    title:  'Add New Ingredient',
    fields: [
      {
        name: 'label', label: 'Ingredient Name', type: 'text',
        required: true, placeholder: 'e.g. Cocoa Powder'
      },
      {
        name: 'unit', label: 'Unit', type: 'select',
        required: true, options: CUSTOM_INGREDIENT_UNITS
      },
      {
        name: 'price', label: 'Price per unit (₦)', type: 'number',
        required: true, value: 0, placeholder: '0.00'
      },
      {
        name: 'initialStock', label: 'Starting Stock', type: 'number',
        value: 0, placeholder: '0'
      },
      {
        name: 'threshold', label: 'Low-stock threshold (optional)', type: 'number',
        value: 0, placeholder: '0',
        hint: 'You\'ll get a low-stock alert when the amount falls to or below this.'
      }
    ],
    submitLabel: 'Add Ingredient',
    async onSubmit(values) {
      try {
        const entry = await storage.addCustomIngredient({
          label:        values.label,
          unit:         values.unit,
          price:        parseFloat(values.price) || 0,
          initialStock: parseFloat(values.initialStock) || 0,
          threshold:    parseFloat(values.threshold) || 0
        });
        toast.show('success', `"${entry.label}" added — usable in Batch Mix recipes now.`);
        await render(pageContainer);
      } catch (err) {
        logger.error('Add ingredient failed', err);
        toast.show('error', err.message || 'Failed to add ingredient.');
      }
    }
  });
}

/**
 * @param {string} key
 * @param {string} label
 * @param {HTMLElement} pageContainer
 */
function confirmRemoveIngredient(key, label, pageContainer) {
  modal.confirm(
    `Remove "${label}"? Its stock and price will be deleted. Any batch mix recipes that already use it will treat it as 0 going forward.`,
    async () => {
      try {
        await storage.removeCustomIngredient(key);
        toast.show('success', `"${label}" removed.`);
        await render(pageContainer);
      } catch (err) {
        logger.error('Remove ingredient failed', err);
        toast.show('error', err.message || 'Failed to remove ingredient.');
      }
    },
    null,
    'Remove Ingredient',
    'Remove',
    'danger'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-inventory-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-inventory-styles';
  style.textContent = `
    .page-loading {
      display: flex; align-items: center; justify-content: center;
      min-height: 200px;
    }
    .spinner {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary, #6366f1);
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .inventory-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .inv-card {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: 1rem;
      display: flex; flex-direction: column; gap: 0.5rem;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--transition-fast);
    }
    .inv-card:hover { box-shadow: var(--shadow-md); }
    .inv-card--ok     { border-color: var(--color-success); }
    .inv-card--low    { border-color: var(--color-warning); }
    .inv-card--empty  { border-color: var(--color-danger);  opacity: 0.85; }

    .inv-card__header {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
    }
    .inv-card__remove {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: var(--color-text-muted); font-size: var(--font-size-sm);
      line-height: 1; padding: 0.125rem 0.25rem; border-radius: var(--radius-sm);
    }
    .inv-card__remove:hover { color: var(--color-danger); background: rgb(239 68 68 / 0.1); }
    .inv-card__name {
      font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
    .inv-card__amount {
      display: flex; align-items: baseline; gap: 0.25rem;
    }
    .inv-card__value {
      font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .inv-card__unit {
      font-size: var(--font-size-sm); color: var(--color-text-muted);
    }
    .inv-card__bar {
      height: 6px; background: var(--color-border);
      border-radius: var(--radius-full); overflow: hidden;
    }
    .inv-card__bar-fill {
      height: 100%; border-radius: var(--radius-full);
      background: var(--color-success);
      transition: width 0.3s ease;
    }
    .inv-card--low   .inv-card__bar-fill { background: var(--color-warning); }
    .inv-card--empty .inv-card__bar-fill { background: var(--color-danger); }

    .inv-card__threshold {
      font-size: var(--font-size-xs); color: var(--color-text-muted);
    }

    /* Task 4: Price display */
    .inv-card__price {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;
      margin-top: 0.25rem;
    }
    .inv-card__price-new {
      font-weight: var(--font-weight-semibold);
      color: var(--color-success);
    }
    .inv-card__price-old {
      text-decoration: line-through;
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
    }
    .inv-card__restock {
      font-size: var(--font-size-xs); color: var(--color-text-muted);
      font-style: italic; margin-top: 0.1rem;
    }

    .alert {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.875rem 1rem; border-radius: var(--radius-lg);
      border: 1px solid; margin-bottom: 1rem;
      font-size: var(--font-size-sm);
    }
    .alert--warning {
      border-color: var(--color-warning);
      background: rgb(245 158 11 / 0.08);
      color: var(--color-text-primary);
    }
    .alert__icon { flex-shrink: 0; margin-top: 1px; }

    .btn-group { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    @media (max-width: 480px) {
      .inventory-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
