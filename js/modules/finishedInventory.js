/**
 * @fileoverview BakeFlow ERP — finishedInventory.js
 * Displays current finished bread stock per type and full transaction history.
 * Stock is derived from the history log (production adds, sales deduct).
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import {
  BREAD_TYPES, formatDate, formatDateTime, today
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

/** Human-readable bread type labels */
const BREAD_LABELS = {
  mini:      'Mini',
  small:     'Small',
  medium:    'Medium',
  big:       'Big',
  sardine:   'Sardine',
  chocolate: 'Chocolate',
  coconut:   'Coconut'
};

/** Bread type emoji for visual interest */
const BREAD_ICONS = {
  mini:      '🥖',
  small:     '🍞',
  medium:    '🥐',
  big:       '🍔',
  sardine:   '🐟',
  chocolate: '🍫',
  coconut:   '🥥'
};

/**
 * Low-stock threshold per bread type (loaves).
 * Show warning when stock is at or below this level.
 */
const LOW_STOCK_THRESHOLDS = {
  mini:      5,
  small:     10,
  medium:    5,
  big:       3,
  sardine:   2,
  chocolate: 2,
  coconut:   2
};

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
  header.innerHTML = `
    <div>
      <h1 class="page-title">Bread Stock</h1>
      <p class="page-subtitle">Current finished bread inventory. Updated automatically by production and sales.</p>
    </div>
  `;
  container.appendChild(header);

  // ── Date selector ────────────────────────────────────────────────────────
  const datePicker = buildDatePicker(container);
  container.appendChild(datePicker);

  // ── Stock for today by default ───────────────────────────────────────────
  const stockSection = document.createElement('div');
  stockSection.id = 'bread-stock-section';
  container.appendChild(stockSection);

  renderStockSection(stockSection, today());
}

/**
 * Builds a date picker that triggers re-render of the stock section.
 * @param {HTMLElement} pageContainer
 * @returns {HTMLElement}
 */
function buildDatePicker(pageContainer) {
  const wrap = document.createElement('div');
  wrap.className = 'date-picker-row';
  wrap.innerHTML = `
    <label class="form-label" for="fi-date-select">View stock for date:</label>
    <input type="date" id="fi-date-select" class="form-input" value="${today()}" style="max-width:180px;" />
  `;
  wrap.querySelector('#fi-date-select').addEventListener('change', (e) => {
    const section = pageContainer.querySelector('#bread-stock-section');
    if (section) {renderStockSection(section, e.target.value);}
  }, { signal: controller.signal });
  return wrap;
}

/**
 * Renders the stock cards and history for a specific date.
 * @param {HTMLElement} section
 * @param {string} date - YYYY-MM-DD
 */
function renderStockSection(section, date) {
  section.innerHTML = '';

  const inv = storage.getFinishedInventory(date);

  // ── Check for out-of-stock types ─────────────────────────────────────────
  const outOfStock = BREAD_TYPES.filter(bt => (inv[bt] || 0) === 0);
  // lowStock computed for future banner use (currently only outOfStock shown)
  const _lowStock  = BREAD_TYPES.filter(bt => {
    const qty = inv[bt] || 0;
    return qty > 0 && qty <= LOW_STOCK_THRESHOLDS[bt];
  });

  if (outOfStock.length > 0) {
    const banner = document.createElement('div');
    banner.className = 'alert alert--warning';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <span class="alert__icon" aria-hidden="true">⚠️</span>
      <div>
        <strong>Out of Stock:</strong>
        ${outOfStock.map(bt => BREAD_LABELS[bt]).join(', ')}
      </div>
    `;
    section.appendChild(banner);
  }

  // ── Stock cards grid ─────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'bread-stock-grid';
  grid.setAttribute('aria-label', 'Bread stock levels');

  // Compute max for progress bar scaling
  const allQtys  = BREAD_TYPES.map(bt => inv[bt] || 0);
  const maxQty   = Math.max(...allQtys, 1);

  for (const bt of BREAD_TYPES) {
    const qty       = inv[bt] || 0;
    const isEmpty   = qty === 0;
    const isLow     = !isEmpty && qty <= LOW_STOCK_THRESHOLDS[bt];
    const pct       = ((qty / maxQty) * 100).toFixed(1);

    const card = document.createElement('div');
    card.className = `bread-card ${isEmpty ? 'bread-card--empty' : isLow ? 'bread-card--low' : 'bread-card--ok'}`;
    card.setAttribute('data-bread-type', bt);

    card.innerHTML = `
      <div class="bread-card__icon" aria-hidden="true">${BREAD_ICONS[bt]}</div>
      <div class="bread-card__header">
        <span class="bread-card__name">${BREAD_LABELS[bt]}</span>
        ${isEmpty ? '<span class="badge badge-danger">Out</span>'    : ''}
        ${isLow   ? '<span class="badge badge-warning">Low</span>'   : ''}
        ${!isEmpty && !isLow ? '<span class="badge badge-success">In Stock</span>' : ''}
      </div>
      <div class="bread-card__qty">${qty}</div>
      <div class="bread-card__bar-track"
           role="progressbar"
           aria-valuenow="${qty}" aria-valuemin="0" aria-valuemax="${maxQty}"
           aria-label="${BREAD_LABELS[bt]} stock">
        <div class="bread-card__bar-fill" style="width:${pct}%"></div>
      </div>
      <p class="bread-card__label-small">${qty === 1 ? 'loaf' : 'loaves'}</p>
    `;

    grid.appendChild(card);
  }

  section.appendChild(grid);

  // ── Transaction history ──────────────────────────────────────────────────
  if (inv.history && inv.history.length > 0) {
    const histHeading = document.createElement('h2');
    histHeading.className = 'section-title';
    histHeading.style.marginTop = '2rem';
    histHeading.textContent = `Transaction History — ${formatDate(date)}`;
    section.appendChild(histHeading);

    renderHistoryTable(section, inv.history);
  } else {
    const noHistory = document.createElement('p');
    noHistory.className = 'text-muted text-sm';
    noHistory.style.marginTop = '1.5rem';
    noHistory.textContent = `No transactions recorded for ${formatDate(date)}.`;
    section.appendChild(noHistory);
  }

  // ── All dates summary ────────────────────────────────────────────────────
  const allInv = storage.getAllFinishedInventory();
  if (allInv.length > 1) {
    renderAllDatesTable(section, allInv);
  }
}

/**
 * Renders the transaction history table for a single day's inventory.
 * @param {HTMLElement} container
 * @param {Array} history
 */
function renderHistoryTable(container, history) {
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrapper';
  tableWrap.style.overflowX = 'auto';

  const t = document.createElement('table');
  t.className = 'data-table';
  t.innerHTML = `
    <thead>
      <tr>
        <th class="data-table__th" scope="col">Time</th>
        <th class="data-table__th" scope="col">Type</th>
        <th class="data-table__th" scope="col">Bread</th>
        <th class="data-table__th" scope="col">Qty</th>
        <th class="data-table__th" scope="col">Reference</th>
      </tr>
    </thead>
    <tbody>
      ${[...history].reverse().map(tx => `
        <tr class="data-table__row">
          <td class="data-table__td">${formatDateTime(tx.timestamp)}</td>
          <td class="data-table__td">
            <span class="badge ${tx.type === 'production' ? 'badge-info' : 'badge-warning'}">
              ${tx.type === 'production' ? '+ Production' : '− Sale'}
            </span>
          </td>
          <td class="data-table__td">${BREAD_LABELS[tx.breadType] || tx.breadType}</td>
          <td class="data-table__td">${tx.type === 'production' ? '+' : '−'}${tx.quantity}</td>
          <td class="data-table__td text-muted text-xs">${tx.reference || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  tableWrap.appendChild(t);
  container.appendChild(tableWrap);
}

/**
 * Renders a summary table of all inventory dates.
 * @param {HTMLElement} container
 * @param {Array} allInv
 */
function renderAllDatesTable(container, allInv) {
  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.style.marginTop = '2rem';
  heading.textContent = 'All Dates Summary';
  container.appendChild(heading);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrapper';
  tableWrap.style.overflowX = 'auto';

  const sorted = [...allInv].sort((a, b) => b.date.localeCompare(a.date));

  const t = document.createElement('table');
  t.className = 'data-table';
  t.innerHTML = `
    <thead>
      <tr>
        <th class="data-table__th" scope="col">Date</th>
        ${BREAD_TYPES.map(bt => `<th class="data-table__th" scope="col">${BREAD_LABELS[bt]}</th>`).join('')}
        <th class="data-table__th" scope="col">Transactions</th>
      </tr>
    </thead>
    <tbody>
      ${sorted.map(inv => `
        <tr class="data-table__row">
          <td class="data-table__td">${formatDate(inv.date)}</td>
          ${BREAD_TYPES.map(bt => {
            const qty   = inv[bt] || 0;
            const empty = qty === 0;
            return `<td class="data-table__td ${empty ? 'text-danger' : ''}">${qty}</td>`;
          }).join('')}
          <td class="data-table__td text-muted">${(inv.history || []).length}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  tableWrap.appendChild(t);
  container.appendChild(tableWrap);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-finished-inv-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-finished-inv-styles';
  style.textContent = `
    .date-picker-row {
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 1.25rem; flex-wrap: wrap;
    }
    .bread-stock-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 1rem;
    }
    .bread-card {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: 1rem;
      display: flex; flex-direction: column; align-items: center;
      gap: 0.4rem; text-align: center;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--transition-fast);
    }
    .bread-card:hover { box-shadow: var(--shadow-md); }
    .bread-card--ok    { border-color: var(--color-success); }
    .bread-card--low   { border-color: var(--color-warning); }
    .bread-card--empty { border-color: var(--color-danger); opacity: 0.8; }

    .bread-card__icon  { font-size: 2rem; line-height: 1; }
    .bread-card__header {
      display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; justify-content: center;
    }
    .bread-card__name  {
      font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
    .bread-card__qty {
      font-size: var(--font-size-3xl, 2rem); font-weight: var(--font-weight-bold);
      color: var(--color-text-primary); line-height: 1.1;
    }
    .bread-card--empty .bread-card__qty { color: var(--color-danger); }
    .bread-card--low   .bread-card__qty { color: var(--color-warning); }
    .bread-card--ok    .bread-card__qty { color: var(--color-success); }

    .bread-card__bar-track {
      width: 100%; height: 6px; background: var(--color-border);
      border-radius: var(--radius-full); overflow: hidden;
    }
    .bread-card__bar-fill {
      height: 100%; border-radius: var(--radius-full);
      background: var(--color-success);
      transition: width 0.3s ease;
    }
    .bread-card--low   .bread-card__bar-fill { background: var(--color-warning); }
    .bread-card--empty .bread-card__bar-fill { background: var(--color-danger); width: 0% !important; }

    .bread-card__label-small {
      font-size: var(--font-size-xs); color: var(--color-text-muted);
    }

    .text-danger { color: var(--color-danger); }
    .text-xs     { font-size: var(--font-size-xs); }
    .text-sm     { font-size: var(--font-size-sm); }
    .text-muted  { color: var(--color-text-muted); }

    @media (max-width: 480px) {
      .bread-stock-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
