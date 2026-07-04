/**
 * @fileoverview BakeFlow ERP — inventory.js
 * Displays and manages raw ingredient stock levels.
 * Allows manual stock adjustments (e.g. restocking flour).
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import {
  CUSTOM_INGREDIENT_UNITS, logger
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

// ─────────────────────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
function init(container) {
  controller = new AbortController();
  render(container);
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
function render(container) {
  container.innerHTML = '';

  // ── Page header ──────────────────────────────────────────────────────────
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
  restockBtn.addEventListener('click', () => openRestockForm(container), { signal: controller.signal });

  const adjustBtn = document.createElement('button');
  adjustBtn.className = 'btn btn-secondary';
  adjustBtn.innerHTML = '✏️ Manual Adjust';
  adjustBtn.addEventListener('click', () => openAdjustForm(container), { signal: controller.signal });

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

  // ── Low-stock alerts ─────────────────────────────────────────────────────
  const stock       = storage.getIngredientStock();
  const customKeys  = storage.getCustomIngredients().map(c => c.key);
  const allKeys     = storage.getIngredientKeys();
  const labels      = storage.getIngredientLabels();
  const units       = storage.getIngredientUnits();
  const thresholds  = storage.getIngredientThresholds();

  const lowItems = allKeys.filter(key => {
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

  // ── Stock cards grid ─────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'inventory-grid';
  grid.id = 'ingredient-stock-grid';

  for (const key of allKeys) {
    const amount    = stock[key]?.amount ?? 0;
    const unit      = units[key];
    const threshold = thresholds[key] ?? 0;
    const isLow     = amount <= threshold;
    const isEmpty   = amount === 0;
    const isCustom  = customKeys.includes(key);

    const card = document.createElement('div');
    card.className = `inv-card ${isEmpty ? 'inv-card--empty' : isLow ? 'inv-card--low' : 'inv-card--ok'}`;
    card.setAttribute('data-key', key);

    // Progress bar (relative to a sensible max, e.g. 5× threshold)
    const maxDisplay = Math.max(threshold * 5, amount, 1);
    const pct        = Math.min(100, (amount / maxDisplay) * 100).toFixed(1);

    card.innerHTML = `
      <div class="inv-card__header">
        <span class="inv-card__name">${labels[key]}</span>
        ${isEmpty  ? '<span class="badge badge-danger">Out</span>'   : ''}
        ${isLow && !isEmpty ? '<span class="badge badge-warning">Low</span>' : ''}
        ${!isLow  ? '<span class="badge badge-success">OK</span>'    : ''}
        ${isCustom ? '<button type="button" class="inv-card__remove" title="Remove custom ingredient" aria-label="Remove ' + labels[key] + '">✕</button>' : ''}
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
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTOCK FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens a form to add stock to all ingredients at once.
 * @param {HTMLElement} pageContainer
 */
function openRestockForm(pageContainer) {
  const stock  = storage.getIngredientStock();
  const keys   = storage.getIngredientKeys();
  const labels = storage.getIngredientLabels();
  const units  = storage.getIngredientUnits();

  const fields = keys.map(key => ({
    name:        key,
    label:       `${labels[key]} (${units[key]}) — currently ${stock[key]?.amount ?? 0}`,
    type:        'number',
    value:       '',
    placeholder: 'Amount to add…',
    hint:        null
  }));

  modal.form({
    title:       'Restock Ingredients',
    fields,
    submitLabel: 'Add Stock',
    onSubmit(values) {
      try {
        let updated = 0;
        for (const key of keys) {
          const toAdd = parseFloat(values[key]) || 0;
          if (toAdd > 0) {
            storage.adjustIngredientStock(key, toAdd);
            updated++;
          }
        }
        if (updated === 0) {
          toast.show('warning', 'No quantities entered. Nothing was added.');
        } else {
          toast.show('success', `Stock updated for ${updated} ingredient(s).`);
          render(pageContainer);
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
 */
function openAdjustForm(pageContainer) {
  const stock  = storage.getIngredientStock();
  const keys   = storage.getIngredientKeys();
  const labels = storage.getIngredientLabels();
  const units  = storage.getIngredientUnits();

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
    onSubmit(values) {
      try {
        // Build a complete stock object and save it
        const newStock = {};
        for (const key of keys) {
          const amount = parseFloat(values[key]);
          newStock[key] = {
            amount: isNaN(amount) || amount < 0 ? 0 : parseFloat(amount.toFixed(3)),
            unit:   units[key]
          };
        }
        storage.saveIngredientStock(newStock);
        toast.show('success', 'Stock levels saved.');
        render(pageContainer);
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
 * Opens a form to register a brand-new ingredient with a name, unit,
 * price per unit, and starting stock — no code changes required.
 * The ingredient immediately becomes available in Inventory, Settings
 * (unit costs), and Batch Mix recipes.
 * @param {HTMLElement} pageContainer
 */
function openAddIngredientForm(pageContainer) {
  modal.form({
    title:       'Add New Ingredient',
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
    onSubmit(values) {
      try {
        const entry = storage.addCustomIngredient({
          label:        values.label,
          unit:         values.unit,
          price:        parseFloat(values.price) || 0,
          initialStock: parseFloat(values.initialStock) || 0,
          threshold:    parseFloat(values.threshold) || 0
        });
        toast.show('success', `"${entry.label}" added — usable in Batch Mix recipes now.`);
        render(pageContainer);
      } catch (err) {
        logger.error('Add ingredient failed', err);
        toast.show('error', err.message || 'Failed to add ingredient.');
      }
    }
  });
}

/**
 * Confirms and removes a custom ingredient.
 * @param {string} key
 * @param {string} label
 * @param {HTMLElement} pageContainer
 */
function confirmRemoveIngredient(key, label, pageContainer) {
  modal.confirm(
    `Remove "${label}"? Its stock and price will be deleted. Any batch mix recipes that already use it will treat it as 0 going forward.`,
    () => {
      try {
        storage.removeCustomIngredient(key);
        toast.show('success', `"${label}" removed.`);
        render(pageContainer);
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
