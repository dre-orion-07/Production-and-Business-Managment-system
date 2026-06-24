/**
 * @fileoverview BakeFlow ERP — dailyHistory.js
 * Shows auto-generated daily summaries. Each date card links to a full
 * detail view with production, sales, expenses, and profit breakdown.
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import {
  BREAD_TYPES, EXPENSE_CATEGORY_LABELS,
  formatCurrency, formatDate, today
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

const BREAD_LABELS = {
  mini:'Mini', small:'Small', medium:'Medium', big:'Big',
  sardine:'Sardine', chocolate:'Chocolate', coconut:'Coconut'
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
function init(container) {
  controller = new AbortController();
  renderList(container);
}

function destroy() {
  controller?.abort();
  controller = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST VIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
function renderList(container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div>
      <h1 class="page-title">Daily History</h1>
      <p class="page-subtitle">Auto-generated daily summaries. Click any day to see full details.</p>
    </div>
  `;
  container.appendChild(header);

  // Force-upsert today so it always appears
  try { storage.upsertDailyHistory(today()); } catch (_) { /* non-critical */ }

  const allHistory = storage.getAllDailyHistory()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first

  if (allHistory.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true">📅</div>
      <p class="empty-state__title">No history yet</p>
      <p class="empty-state__body">History is generated automatically as you record production, sales, and expenses.</p>
    `;
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'daily-history-grid';

  for (const day of allHistory) {
    grid.appendChild(buildDayCard(day, container));
  }

  container.appendChild(grid);
}

/**
 * Builds a summary card for one day.
 * @param {object} day - DailyHistory record
 * @param {HTMLElement} pageContainer
 * @returns {HTMLElement}
 */
function buildDayCard(day, pageContainer) {
  const isToday    = day.date === today();
  const profit     = day.profit?.netProfit || 0;
  const revenue    = day.sales?.totalRevenue || 0;
  const expenses   = day.expenses?.totalExpenses || 0;
  const loaves     = Object.values(day.production?.totalItemsProduced || {}).reduce((s, v) => s + v, 0);

  const card = document.createElement('div');
  card.className = `day-card ${isToday ? 'day-card--today' : ''} ${profit < 0 ? 'day-card--loss' : ''}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View details for ${formatDate(day.date)}`);

  card.innerHTML = `
    <div class="day-card__header">
      <span class="day-card__date">${formatDate(day.date)}</span>
      ${isToday ? '<span class="badge badge-brand">Today</span>' : ''}
      <span class="badge ${profit >= 0 ? 'badge-success' : 'badge-danger'}">${profit >= 0 ? 'Profit' : 'Loss'}</span>
    </div>
    <div class="day-card__metrics">
      <div class="day-metric">
        <span class="day-metric__label">Revenue</span>
        <span class="day-metric__value text-success">${formatCurrency(revenue)}</span>
      </div>
      <div class="day-metric">
        <span class="day-metric__label">Expenses</span>
        <span class="day-metric__value text-danger">${formatCurrency(expenses)}</span>
      </div>
      <div class="day-metric">
        <span class="day-metric__label">Net Profit</span>
        <span class="day-metric__value ${profit >= 0 ? 'text-success' : 'text-danger'} font-bold">${formatCurrency(profit)}</span>
      </div>
      <div class="day-metric">
        <span class="day-metric__label">Loaves</span>
        <span class="day-metric__value">${loaves}</span>
      </div>
    </div>
    <p class="day-card__cta">View Full Details →</p>
  `;

  const open = () => renderDetail(pageContainer, day.date);
  card.addEventListener('click', open, { signal: controller.signal });
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') {open();} }, { signal: controller.signal });

  return card;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 * @param {string} date - YYYY-MM-DD
 */
function renderDetail(container, date) {
  container.innerHTML = '';

  // Force upsert so data is fresh
  try { storage.upsertDailyHistory(date); } catch (_) { /* non-critical */ }

  const day = storage.getDailyHistory(date);
  if (!day) {
    toast_fallback(container, 'No history found for this date.');
    renderList(container);
    return;
  }

  const productions = storage.getProductions({ date });
  const sales       = storage.getSales({ date }).filter(s => !s.voided);
  const expenses    = storage.getExpenses({ date }).filter(e => !e.voided);

  // ── Back + header ────────────────────────────────────────────────────────
  const topBar = document.createElement('div');
  topBar.className = 'detail-top-bar';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-ghost';
  backBtn.innerHTML = '← Daily History';
  backBtn.addEventListener('click', () => renderList(container), { signal: controller.signal });
  topBar.appendChild(backBtn);
  container.appendChild(topBar);

  const pageHeader = document.createElement('div');
  pageHeader.className = 'page-header';
  pageHeader.innerHTML = `
    <div>
      <h1 class="page-title">${formatDate(date)}</h1>
      <p class="page-subtitle">Full daily summary</p>
    </div>
  `;
  container.appendChild(pageHeader);

  // ── Metrics row ──────────────────────────────────────────────────────────
  const metricsRow = document.createElement('div');
  metricsRow.className = 'day-detail-metrics';

  const profit       = day.profit?.netProfit    || 0;
  const grossProfit  = day.profit?.grossProfit  || 0;
  const profitMargin = day.profit?.profitMargin || 0;

  [
    { label: 'Revenue',       value: formatCurrency(day.sales?.totalRevenue || 0),     cls: 'text-success' },
    { label: 'Production Cost', value: formatCurrency(day.production?.totalProductionCost || 0), cls: '' },
    { label: 'Gross Profit',  value: formatCurrency(grossProfit),  cls: grossProfit  >= 0 ? 'text-success' : 'text-danger' },
    { label: 'Expenses',      value: formatCurrency(day.expenses?.totalExpenses || 0), cls: 'text-danger' },
    { label: 'Net Profit',    value: formatCurrency(profit),       cls: profit >= 0 ? 'text-success' : 'text-danger' },
    { label: 'Margin',        value: `${profitMargin}%`,           cls: profitMargin >= 0 ? 'text-success' : 'text-danger' },
    { label: 'Sales',         value: `${sales.length} sales`,      cls: '' },
    { label: 'Debt Created',  value: formatCurrency(day.sales?.totalDebtCreated || 0), cls: day.sales?.totalDebtCreated > 0 ? 'text-danger' : '' }
  ].forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'day-detail-metric';
    chip.innerHTML = `
      <span class="day-detail-metric__label">${m.label}</span>
      <span class="day-detail-metric__value ${m.cls}">${m.value}</span>
    `;
    metricsRow.appendChild(chip);
  });
  container.appendChild(metricsRow);

  // ── Two-column detail ────────────────────────────────────────────────────
  const cols = document.createElement('div');
  cols.className = 'day-detail-cols';
  container.appendChild(cols);

  // Left column
  const left = document.createElement('div');
  left.className = 'day-detail-col';
  cols.appendChild(left);

  // Right column
  const right = document.createElement('div');
  right.className = 'day-detail-col';
  cols.appendChild(right);

  // ── Production section ───────────────────────────────────────────────────
  appendDetailSection(left, '🍞 Production', () => {
    if (productions.length === 0) {return `<p class="text-muted text-sm">No production recorded.</p>`;}
    const totalProduced = day.production?.totalItemsProduced || {};
    const parts = BREAD_TYPES
      .filter(bt => (totalProduced[bt] || 0) > 0)
      .map(bt => `${BREAD_LABELS[bt]}: ${totalProduced[bt]}`);
    let html = `<ul class="detail-list">`;
    for (const p of productions) {
      html += `<li class="detail-list__item">
        <span>${escHtml(p.batchName)} ×${p.numberOfMixes}</span>
        <span>${p.totalOutput} loaves</span>
      </li>`;
    }
    html += `</ul>`;
    if (parts.length > 0) {
      html += `<div class="detail-subtotal">Output: ${parts.join(', ')}</div>`;
    }
    html += `<div class="detail-subtotal">Total Cost: <strong>${formatCurrency(day.production?.totalProductionCost || 0)}</strong></div>`;
    return html;
  });

  // ── Sales section ────────────────────────────────────────────────────────
  appendDetailSection(right, '🛒 Sales', () => {
    if (sales.length === 0) {return `<p class="text-muted text-sm">No sales recorded.</p>`;}
    let html = `<ul class="detail-list">`;
    for (const s of sales) {
      html += `<li class="detail-list__item">
        <span>${escHtml(s.receiptNumber)} — ${escHtml(s.customerName)}</span>
        <span class="${(s.outstanding || 0) > 0 ? 'text-danger' : ''}">${formatCurrency(s.totalAmount)}</span>
      </li>`;
    }
    html += `</ul>`;
    html += `<div class="detail-subtotal">Total Revenue: <strong class="text-success">${formatCurrency(day.sales?.totalRevenue || 0)}</strong></div>`;
    if ((day.sales?.totalDebtCreated || 0) > 0) {
      html += `<div class="detail-subtotal">Debt Created: <strong class="text-danger">${formatCurrency(day.sales?.totalDebtCreated)}</strong></div>`;
    }
    return html;
  });

  // ── Expenses section ─────────────────────────────────────────────────────
  appendDetailSection(left, '💸 Expenses', () => {
    if (expenses.length === 0) {return `<p class="text-muted text-sm">No expenses recorded.</p>`;}
    const _breakdown = day.expenses?.breakdown || {};
    let html = `<ul class="detail-list">`;
    for (const e of expenses) {
      html += `<li class="detail-list__item">
        <span>${EXPENSE_CATEGORY_LABELS[e.category] || e.category}${e.description ? ` — ${escHtml(e.description)}` : ''}</span>
        <span class="text-danger">${formatCurrency(e.amount)}</span>
      </li>`;
    }
    html += `</ul>`;
    html += `<div class="detail-subtotal">Total: <strong class="text-danger">${formatCurrency(day.expenses?.totalExpenses || 0)}</strong></div>`;
    return html;
  });

  // ── Profit summary section ───────────────────────────────────────────────
  appendDetailSection(right, '📊 Profit Calculation', () => `
    <ul class="profit-calc-list">
      <li class="profit-calc-list__item">
        <span>Revenue</span>
        <span class="text-success">+${formatCurrency(day.sales?.totalRevenue || 0)}</span>
      </li>
      <li class="profit-calc-list__item">
        <span>− Production Cost</span>
        <span class="text-danger">−${formatCurrency(day.production?.totalProductionCost || 0)}</span>
      </li>
      <li class="profit-calc-list__item profit-calc-list__item--sub">
        <span>= Gross Profit</span>
        <span class="${grossProfit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(grossProfit)}</span>
      </li>
      <li class="profit-calc-list__item">
        <span>− Expenses</span>
        <span class="text-danger">−${formatCurrency(day.expenses?.totalExpenses || 0)}</span>
      </li>
      <li class="profit-calc-list__item profit-calc-list__item--total">
        <span>= Net Profit</span>
        <strong class="${profit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(profit)}</strong>
      </li>
    </ul>
  `);
}

/**
 * Appends a titled detail section to a column.
 * @param {HTMLElement} col
 * @param {string} title
 * @param {Function} contentFn - returns HTML string
 */
function appendDetailSection(col, title, contentFn) {
  const section = document.createElement('div');
  section.className = 'detail-section card';
  const h = document.createElement('h2');
  h.className = 'detail-section__title';
  h.textContent = title;
  section.appendChild(h);
  const body = document.createElement('div');
  body.innerHTML = contentFn();
  section.appendChild(body);
  col.appendChild(section);
}

/** Simple inline error fallback (no toast import needed here) */
function toast_fallback(container, msg) {
  const p = document.createElement('p');
  p.className = 'text-danger text-sm';
  p.textContent = msg;
  container.appendChild(p);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-daily-history-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-daily-history-styles';
  style.textContent = `
    .daily-history-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .day-card {
      background: var(--color-bg-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-xl); padding: 1.25rem;
      box-shadow: var(--shadow-sm); cursor: pointer;
      transition: box-shadow var(--transition-fast), transform var(--transition-fast);
    }
    .day-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .day-card:focus { outline: 2px solid var(--color-brand-primary); outline-offset: 2px; }
    .day-card--today  { border-color: var(--color-brand-primary); }
    .day-card--loss   { border-color: var(--color-danger); }
    .day-card__header { display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem; }
    .day-card__date   { font-weight: var(--font-weight-semibold); color: var(--color-text-primary); flex:1; }
    .day-card__metrics { display:grid;grid-template-columns:1fr 1fr;gap:.5rem; }
    .day-metric { display:flex;flex-direction:column;gap:.1rem; }
    .day-metric__label { font-size:var(--font-size-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em; }
    .day-metric__value { font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold); }
    .day-card__cta { font-size:var(--font-size-xs);color:var(--color-brand-primary);margin-top:.75rem;text-align:right; }

    /* Detail view */
    .day-detail-metrics {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr));
      gap: 0.75rem; margin-bottom: 1.5rem;
    }
    .day-detail-metric {
      background: var(--color-bg-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); padding: 0.75rem;
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .day-detail-metric__label { font-size:var(--font-size-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em; }
    .day-detail-metric__value { font-size:var(--font-size-base);font-weight:var(--font-weight-bold); }

    .day-detail-cols { display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start; }
    @media (max-width:768px) { .day-detail-cols { grid-template-columns:1fr; } }

    .day-detail-col { display:flex;flex-direction:column;gap:1rem; }

    .detail-section {
      padding: 1rem 1.25rem;
      background: var(--color-bg-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
    }
    .detail-section__title {
      font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);
      margin-bottom:.75rem;padding-bottom:.5rem;border-bottom:1px solid var(--color-border);
    }
    .detail-list { list-style:none;display:flex;flex-direction:column;gap:.375rem; }
    .detail-list__item {
      display:flex;justify-content:space-between;align-items:center;
      font-size:var(--font-size-sm);padding:.25rem 0;
      border-bottom:1px dashed var(--color-border);
    }
    .detail-list__item:last-child { border-bottom:none; }
    .detail-subtotal {
      display:flex;justify-content:flex-end;
      font-size:var(--font-size-sm);color:var(--color-text-muted);
      padding-top:.5rem;margin-top:.25rem;border-top:1px solid var(--color-border);
    }

    .profit-calc-list { list-style:none;display:flex;flex-direction:column;gap:.375rem; }
    .profit-calc-list__item {
      display:flex;justify-content:space-between;font-size:var(--font-size-sm);padding:.25rem 0;
    }
    .profit-calc-list__item--sub {
      border-top:1px solid var(--color-border);padding-top:.5rem;margin-top:.25rem;
    }
    .profit-calc-list__item--total {
      font-size:var(--font-size-base);border-top:2px solid var(--color-border);
      padding-top:.5rem;margin-top:.25rem;
    }

    .badge-brand { background:var(--color-brand-primary);color:#fff; }
    .font-bold   { font-weight:var(--font-weight-bold); }
    .text-success { color:var(--color-success); }
    .text-danger  { color:var(--color-danger); }
    .text-muted   { color:var(--color-text-muted); }
    .text-sm      { font-size:var(--font-size-sm); }
    .card { background:var(--color-bg-surface);border:1px solid var(--color-border);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm); }
    .detail-top-bar { display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem; }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
