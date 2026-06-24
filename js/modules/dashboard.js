/**
 * @fileoverview BakeFlow ERP — dashboard.js
 * Main dashboard: key metrics, quick actions, low-stock alerts, recent activity.
 * All data is read live from storage on every init().
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import card    from '../components/card.js';
import { navigate } from '../router.js';
import {
  BREAD_TYPES, INGREDIENT_KEYS, INGREDIENT_LABELS,
  formatCurrency, formatDate, timeAgo,
  today, calculateNetProfit
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

/** Ingredient low-stock thresholds (kg/g/liters) */
const ING_THRESHOLDS = {
  flour: 5, wheatFlour: 2, sugar: 1, salt: 0.5, yeast: 50,
  margarine: 0.3, oil: 0.3, improver: 10, preservative: 5, flavour: 5, water: 2
};

/** Bread low-stock thresholds (loaves) */
const BREAD_THRESHOLDS = {
  mini: 5, small: 10, medium: 5, big: 3, sardine: 2, chocolate: 2, coconut: 2
};

const BREAD_LABELS = {
  mini: 'Mini', small: 'Small', medium: 'Medium', big: 'Big',
  sardine: 'Sardine', chocolate: 'Chocolate', coconut: 'Coconut'
};

const ING_UNITS = {
  flour: 'kg', wheatFlour: 'kg', sugar: 'kg', salt: 'kg', yeast: 'g',
  margarine: 'kg', oil: 'liters', improver: 'g', preservative: 'g', flavour: 'ml', water: 'liters'
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

  const todayStr = today();

  // ── Gather data ──────────────────────────────────────────────────────────
  const todaySales     = storage.getSales({ date: todayStr }).filter(s => !s.voided);
  const todayProds     = storage.getProductions({ date: todayStr });
  const todayExpenses  = storage.getExpenses({ date: todayStr }).filter(e => !e.voided);
  const allCustomers   = storage.getCustomers();
  const ingStock       = storage.getIngredientStock();
  const breadInv       = storage.getFinishedInventory(todayStr);

  // Compute today's figures
  const todayRevenue   = todaySales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalExpenses  = todayExpenses.reduce((s, x) => s + (x.amount || 0), 0);
  const totalOutstanding = allCustomers.reduce((s, c) => s + (c.outstanding || 0), 0);
  const totalLoaves    = todayProds.reduce((s, p) => s + (p.totalOutput || 0), 0);
  const { netProfit }  = calculateNetProfit(todaySales, todayProds, todayExpenses);

  // Low-stock alerts
  const lowIngredients = INGREDIENT_KEYS.filter(k =>
    (ingStock[k]?.amount ?? 0) <= ING_THRESHOLDS[k]
  );
  const lowBread = BREAD_TYPES.filter(bt =>
    (breadInv[bt] || 0) <= BREAD_THRESHOLDS[bt]
  );

  // ── Page header ──────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">${formatDate(todayStr)} — Good ${getGreeting()}, let's bake! 🍞</p>
    </div>
  `;
  container.appendChild(header);

  // ── Quick Actions ────────────────────────────────────────────────────────
  container.appendChild(buildQuickActions());

  // ── Low-stock banner ─────────────────────────────────────────────────────
  if (lowIngredients.length > 0 || lowBread.length > 0) {
    container.appendChild(buildLowStockBanner(lowIngredients, lowBread, ingStock, breadInv));
  }

  // ── Metrics grid ─────────────────────────────────────────────────────────
  container.appendChild(buildMetricsGrid(todayRevenue, totalExpenses, totalOutstanding, totalLoaves, netProfit, todaySales.length));

  // ── Two-column layout: activity + breakdown ───────────────────────────────
  const columns = document.createElement('div');
  columns.className = 'dashboard-columns';
  columns.appendChild(buildRecentActivity(todaySales, todayProds, todayExpenses));
  columns.appendChild(buildTodayBreakdown(breadInv, todayProds, todayExpenses));
  container.appendChild(columns);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {HTMLElement}
 */
function buildQuickActions() {
  const section = document.createElement('div');
  section.className = 'quick-actions';

  const actions = [
    { label: 'New Production', icon: '🍞', path: '/production',  variant: 'primary' },
    { label: 'New Sale',       icon: '🛒', path: '/sales',       variant: 'primary' },
    { label: 'Add Expense',    icon: '💸', path: '/expenses',    variant: 'secondary' },
    { label: 'Restock Stock',  icon: '🌾', path: '/inventory',   variant: 'secondary' },
    { label: 'Add Customer',   icon: '👤', path: '/customers',   variant: 'secondary' },
    { label: 'View Reports',   icon: '📈', path: '/reports',     variant: 'ghost' }
  ];

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className = `btn btn-${action.variant} quick-action-btn`;
    btn.innerHTML = `<span aria-hidden="true">${action.icon}</span> ${action.label}`;
    btn.addEventListener('click', () => navigate(action.path), { signal: controller.signal });
    section.appendChild(btn);
  }

  return section;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW STOCK BANNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string[]} lowIng
 * @param {string[]} lowBread
 * @param {object} ingStock
 * @param {object} breadInv
 * @returns {HTMLElement}
 */
function buildLowStockBanner(lowIng, lowBread, ingStock, breadInv) {
  const banner = document.createElement('div');
  banner.className = 'low-stock-banner';
  banner.setAttribute('role', 'alert');

  const title = document.createElement('div');
  title.className = 'low-stock-banner__title';
  title.innerHTML = '<span aria-hidden="true">⚠️</span> Low Stock Alerts';
  banner.appendChild(title);

  const list = document.createElement('div');
  list.className = 'low-stock-banner__list';

  for (const key of lowIng) {
    const amt = ingStock[key]?.amount ?? 0;
    const chip = document.createElement('button');
    chip.className = `low-stock-chip ${amt === 0 ? 'low-stock-chip--out' : 'low-stock-chip--low'}`;
    chip.textContent = `${INGREDIENT_LABELS[key]}: ${amt} ${ING_UNITS[key]}`;
    chip.title = 'Click to restock';
    chip.addEventListener('click', () => navigate('/inventory'), { signal: controller.signal });
    list.appendChild(chip);
  }

  for (const bt of lowBread) {
    const qty = breadInv[bt] || 0;
    const chip = document.createElement('button');
    chip.className = `low-stock-chip ${qty === 0 ? 'low-stock-chip--out' : 'low-stock-chip--low'}`;
    chip.textContent = `${BREAD_LABELS[bt]} bread: ${qty} loaves`;
    chip.title = 'Click to view bread stock';
    chip.addEventListener('click', () => navigate('/finished-inventory'), { signal: controller.signal });
    list.appendChild(chip);
  }

  banner.appendChild(list);
  return banner;
}

// ─────────────────────────────────────────────────────────────────────────────
// METRICS GRID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} revenue
 * @param {number} expenses
 * @param {number} outstanding
 * @param {number} loaves
 * @param {number} netProfit
 * @param {number} salesCount
 * @returns {HTMLElement}
 */
function buildMetricsGrid(revenue, expenses, outstanding, loaves, netProfit, salesCount) {
  const grid = document.createElement('div');
  grid.className = 'metrics-grid';

  const metrics = [
    {
      label:    "Today's Revenue",
      value:    formatCurrency(revenue),
      icon:     '💰',
      subValue: `${salesCount} sale${salesCount !== 1 ? 's' : ''}`,
      variant:  revenue > 0 ? 'success' : 'default'
    },
    {
      label:    'Net Profit',
      value:    formatCurrency(netProfit),
      icon:     '📊',
      subValue: `Revenue − Production − Expenses`,
      variant:  netProfit > 0 ? 'brand' : netProfit < 0 ? 'danger' : 'default'
    },
    {
      label:    'Total Outstanding Debt',
      value:    formatCurrency(outstanding),
      icon:     '⚠️',
      subValue: 'All customers combined',
      variant:  outstanding > 0 ? 'warning' : 'success'
    },
    {
      label:    "Today's Production",
      value:    `${loaves} loaves`,
      icon:     '🍞',
      subValue: `${storage.getProductions({ date: today() }).length} batch run(s)`,
      variant:  loaves > 0 ? 'info' : 'default'
    },
    {
      label:    "Today's Expenses",
      value:    formatCurrency(expenses),
      icon:     '💸',
      subValue: expenses > 0 ? 'Reduces net profit' : 'None recorded',
      variant:  expenses > 0 ? 'warning' : 'default'
    },
    {
      label:    'Active Customers',
      value:    String(storage.getCustomers().length),
      icon:     '👥',
      subValue: `${storage.getCustomers().filter(c => c.outstanding > 0).length} with outstanding debt`,
      variant:  'default'
    }
  ];

  for (const m of metrics) {
    const cardEl = card.create({
      label:    m.label,
      value:    m.value,
      subValue: m.subValue,
      icon:     m.icon,
      variant:  m.variant
    });
    // Make cards clickable to relevant module
    cardEl.style.cursor = 'default';
    grid.appendChild(cardEl);
  }

  return grid;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT ACTIVITY FEED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Array} sales
 * @param {Array} productions
 * @param {Array} expenses
 * @returns {HTMLElement}
 */
function buildRecentActivity(sales, productions, expenses) {
  const panel = document.createElement('div');
  panel.className = 'dashboard-panel';

  const heading = document.createElement('h2');
  heading.className = 'dashboard-panel__title';
  heading.textContent = "Today's Activity";
  panel.appendChild(heading);

  // Build unified activity list sorted by time (newest first)
  const events = [];

  for (const s of sales) {
    events.push({
      time:  s.createdAt,
      icon:  '🛒',
      type:  'sale',
      label: `Sale — ${s.customerName}`,
      value: formatCurrency(s.totalAmount),
      badge: s.outstanding > 0 ? `+${formatCurrency(s.outstanding)} debt` : 'Paid in full',
      badgeVariant: s.outstanding > 0 ? 'badge-warning' : 'badge-success'
    });
  }

  for (const p of productions) {
    events.push({
      time:  p.createdAt,
      icon:  '🍞',
      type:  'production',
      label: `Production — ${p.batchName} ×${p.numberOfMixes}`,
      value: `${p.totalOutput} loaves`,
      badge: null
    });
  }

  for (const e of expenses) {
    events.push({
      time:  e.createdAt,
      icon:  '💸',
      type:  'expense',
      label: `Expense — ${capitalise(e.category.replace('_', ' '))}`,
      value: formatCurrency(e.amount),
      badge: e.description || null,
      badgeVariant: 'badge-info'
    });
  }

  events.sort((a, b) => new Date(b.time) - new Date(a.time));

  if (events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state empty-state--sm';
    empty.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true">📋</div>
      <p class="empty-state__title">No activity yet today</p>
      <p class="empty-state__body">Use the quick actions above to get started.</p>
    `;
    panel.appendChild(empty);
    return panel;
  }

  const feed = document.createElement('ul');
  feed.className = 'activity-feed';

  for (const event of events.slice(0, 15)) { // Cap at 15 items
    const item = document.createElement('li');
    item.className = `activity-item activity-item--${event.type}`;
    item.innerHTML = `
      <span class="activity-item__icon" aria-hidden="true">${event.icon}</span>
      <div class="activity-item__body">
        <span class="activity-item__label">${escHtml(event.label)}</span>
        ${event.badge
          ? `<span class="badge ${event.badgeVariant || 'badge-info'} activity-item__badge">${escHtml(event.badge)}</span>`
          : ''}
        <span class="activity-item__time">${timeAgo(event.time)}</span>
      </div>
      <span class="activity-item__value">${event.value}</span>
    `;
    feed.appendChild(item);
  }

  panel.appendChild(feed);

  if (events.length > 15) {
    const moreLink = document.createElement('p');
    moreLink.className = 'text-muted text-sm text-center';
    moreLink.style.marginTop = '0.75rem';
    moreLink.textContent = `+${events.length - 15} more events today`;
    panel.appendChild(moreLink);
  }

  return panel;
}

// ─────────────────────────────────────────────────────────────────────────────
// TODAY'S BREAKDOWN PANEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} breadInv
 * @param {Array} todayProds
 * @param {Array} todayExpenses
 * @returns {HTMLElement}
 */
function buildTodayBreakdown(breadInv, todayProds, todayExpenses) {
  const panel = document.createElement('div');
  panel.className = 'dashboard-panel';

  const heading = document.createElement('h2');
  heading.className = 'dashboard-panel__title';
  heading.textContent = "Today's Snapshot";
  panel.appendChild(heading);

  // ── Bread stock mini-view ────────────────────────────────────────────────
  const stockTitle = document.createElement('h3');
  stockTitle.className = 'breakdown-section-title';
  stockTitle.textContent = 'Current Bread Stock';
  panel.appendChild(stockTitle);

  const stockList = document.createElement('ul');
  stockList.className = 'mini-stock-list';

  for (const bt of BREAD_TYPES) {
    const qty   = breadInv[bt] || 0;
    const isOut = qty === 0;
    const isLow = !isOut && qty <= BREAD_THRESHOLDS[bt];

    const item = document.createElement('li');
    item.className = 'mini-stock-item';
    item.innerHTML = `
      <span class="mini-stock-item__name">${BREAD_LABELS[bt]}</span>
      <div class="mini-stock-item__right">
        <span class="mini-stock-item__qty ${isOut ? 'text-danger' : isLow ? 'text-warning' : ''}">${qty}</span>
        ${isOut ? '<span class="badge badge-danger">Out</span>'    : ''}
        ${isLow ? '<span class="badge badge-warning">Low</span>'   : ''}
      </div>
    `;
    stockList.appendChild(item);
  }
  panel.appendChild(stockList);

  // ── Production summary ───────────────────────────────────────────────────
  if (todayProds.length > 0) {
    const prodTitle = document.createElement('h3');
    prodTitle.className = 'breakdown-section-title';
    prodTitle.textContent = 'Production Runs';
    panel.appendChild(prodTitle);

    const prodList = document.createElement('ul');
    prodList.className = 'mini-list';
    for (const p of todayProds) {
      const li = document.createElement('li');
      li.className = 'mini-list__item';
      li.innerHTML = `
        <span>${escHtml(p.batchName)} ×${p.numberOfMixes}</span>
        <span class="text-muted">${p.totalOutput} loaves</span>
      `;
      prodList.appendChild(li);
    }
    panel.appendChild(prodList);
  }

  // ── Expense breakdown ────────────────────────────────────────────────────
  if (todayExpenses.length > 0) {
    const expTitle = document.createElement('h3');
    expTitle.className = 'breakdown-section-title';
    expTitle.textContent = 'Expenses Today';
    panel.appendChild(expTitle);

    const expList = document.createElement('ul');
    expList.className = 'mini-list';
    for (const e of todayExpenses) {
      const li = document.createElement('li');
      li.className = 'mini-list__item';
      li.innerHTML = `
        <span>${capitalise(e.category.replace('_', ' '))}</span>
        <span class="text-danger">${formatCurrency(e.amount)}</span>
      `;
      expList.appendChild(li);
    }
    panel.appendChild(expList);
  }

  // ── Navigation links ─────────────────────────────────────────────────────
  const navLinks = document.createElement('div');
  navLinks.className = 'breakdown-nav-links';
  [
    { label: '→ View Bread Stock',    path: '/finished-inventory' },
    { label: '→ View All Expenses',   path: '/expenses' },
    { label: '→ View Daily History',  path: '/daily-history' }
  ].forEach(({ label, path }) => {
    const a = document.createElement('a');
    a.href = `#${path}`;
    a.className = 'breakdown-nav-link';
    a.textContent = label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(path);
    }, { signal: controller.signal });
    navLinks.appendChild(a);
  });
  panel.appendChild(navLinks);

  return panel;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a time-of-day greeting.
 * @returns {string}
 */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) {return 'morning';}
  if (h < 17) {return 'afternoon';}
  return 'evening';
}

/**
 * Capitalises the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escapes HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-dashboard-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-dashboard-styles';
  style.textContent = `
    /* Quick Actions */
    .quick-actions {
      display: flex; flex-wrap: wrap; gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .quick-action-btn {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: var(--font-size-sm);
    }

    /* Low-stock banner */
    .low-stock-banner {
      background: rgb(245 158 11 / 0.08);
      border: 1px solid var(--color-warning);
      border-radius: var(--radius-lg);
      padding: 0.875rem 1rem;
      margin-bottom: 1.25rem;
    }
    .low-stock-banner__title {
      font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
      color: var(--color-warning); margin-bottom: 0.5rem;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .low-stock-banner__list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .low-stock-chip {
      font-size: var(--font-size-xs); padding: 0.2rem 0.6rem;
      border-radius: var(--radius-full); border: 1px solid;
      cursor: pointer; transition: opacity var(--transition-fast);
      background: none;
    }
    .low-stock-chip:hover { opacity: 0.8; }
    .low-stock-chip--low  { border-color: var(--color-warning); color: var(--color-warning); }
    .low-stock-chip--out  { border-color: var(--color-danger);  color: var(--color-danger); }

    /* Metrics grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    /* Two-column layout */
    .dashboard-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 768px) {
      .dashboard-columns { grid-template-columns: 1fr; }
    }

    /* Activity feed */
    .dashboard-panel {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
    }
    .dashboard-panel__title {
      font-size: var(--font-size-base); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary); margin-bottom: 1rem;
      padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);
    }
    .activity-feed { list-style: none; display: flex; flex-direction: column; gap: 0.625rem; }
    .activity-item {
      display: flex; align-items: flex-start; gap: 0.625rem;
      padding: 0.5rem 0; border-bottom: 1px solid var(--color-border);
      font-size: var(--font-size-sm);
    }
    .activity-item:last-child { border-bottom: none; }
    .activity-item__icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
    .activity-item__body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .activity-item__label { font-weight: var(--font-weight-medium); color: var(--color-text-primary); }
    .activity-item__badge { align-self: flex-start; }
    .activity-item__time  { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .activity-item__value { font-weight: var(--font-weight-semibold); color: var(--color-text-primary); flex-shrink: 0; }

    /* Breakdown panel */
    .breakdown-section-title {
      font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--color-text-muted); margin: 1rem 0 0.5rem;
    }
    .mini-stock-list { list-style: none; display: flex; flex-direction: column; gap: 0.375rem; }
    .mini-stock-item {
      display: flex; justify-content: space-between; align-items: center;
      font-size: var(--font-size-sm); padding: 0.25rem 0;
    }
    .mini-stock-item__name  { color: var(--color-text-secondary); }
    .mini-stock-item__right { display: flex; align-items: center; gap: 0.4rem; }
    .mini-stock-item__qty   { font-weight: var(--font-weight-semibold); }

    .mini-list { list-style: none; display: flex; flex-direction: column; gap: 0.375rem; }
    .mini-list__item {
      display: flex; justify-content: space-between; align-items: center;
      font-size: var(--font-size-sm); padding: 0.25rem 0;
      border-bottom: 1px dashed var(--color-border);
    }
    .mini-list__item:last-child { border-bottom: none; }

    .breakdown-nav-links { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 1rem; }
    .breakdown-nav-link {
      font-size: var(--font-size-sm); color: var(--color-brand-primary);
      text-decoration: none;
    }
    .breakdown-nav-link:hover { text-decoration: underline; }

    .text-warning { color: var(--color-warning); }
    .text-center  { text-align: center; }

    @media (max-width: 480px) {
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
      .quick-actions { gap: 0.375rem; }
      .quick-action-btn { font-size: var(--font-size-xs); padding: 0.4rem 0.75rem; }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
