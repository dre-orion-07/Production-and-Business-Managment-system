/**
 * @fileoverview BakeFlow ERP — reports.js
 * Time-filtered reports: revenue, expenses, production, profit, debt.
 * Includes CSV export for each section.
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import {
  BREAD_TYPES, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS,
  formatCurrency, getDateRange, calculateNetProfit
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

const BREAD_LABELS = {
  mini:'Mini', small:'Small', medium:'Medium', big:'Big',
  sardine:'Sardine', chocolate:'Chocolate', coconut:'Coconut'
};

const RANGE_OPTIONS = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days',     label: 'Last 7 Days' },
  { value: '30days',    label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' }
];

// ─────────────────────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
function init(container) {
  controller = new AbortController();
  render(container, 'today');
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
 * @param {string} range
 */
async function render(container, range) {
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:200px;"><div class="spinner" style="width:32px;height:32px;border-radius:50%;border:3px solid var(--color-border);border-top-color:var(--color-primary,#6366f1);animation:spin 0.7s linear infinite"></div></div>';

  // ── Page header ──────────────────────────────────────────────────────────
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div>
      <h1 class="page-title">Reports</h1>
      <p class="page-subtitle">Business performance over time. Export any section to CSV.</p>
    </div>
  `;
  container.appendChild(header);

  // ── Range filter bar ─────────────────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.className = 'report-filter-bar';
  filterBar.setAttribute('role', 'group');
  filterBar.setAttribute('aria-label', 'Date range filter');

  for (const opt of RANGE_OPTIONS) {
    const btn = document.createElement('button');
    btn.className = `filter-chip ${opt.value === range ? 'filter-chip--active' : ''}`;
    btn.textContent = opt.label;
    btn.setAttribute('aria-pressed', String(opt.value === range));
    btn.addEventListener('click', () => render(container, opt.value), { signal: controller.signal });
    filterBar.appendChild(btn);
  }
  container.appendChild(filterBar);

  // ── Load data ────────────────────────────────────────────────────────────
  const { start, end } = getDateRange(range);

  const [sales, prods, expenses, customers] = await Promise.all([
    storage.getSales({ start, end }),
    storage.getProductions({ start, end }),
    storage.getExpenses({ start, end }),
    storage.getCustomers(),
  ]);

  const filteredSales    = sales.filter(s => !s.voided);
  const filteredExpenses = expenses.filter(e => !e.voided);

  const { grossProfit, netProfit, profitMargin } = calculateNetProfit(filteredSales, prods, filteredExpenses);
  const totalRevenue   = filteredSales.reduce((s, x) => s + (x.totalAmount  || 0), 0);
  const totalProdCost  = prods.reduce((s, x) => s + (x.productionCost || 0), 0);
  const totalExpenses  = filteredExpenses.reduce((s, x) => s + (x.amount     || 0), 0);
  const totalDebt      = customers.reduce((s, c) => s + (c.outstanding || 0), 0);
  const _debtCreated    = filteredSales.reduce((s, x) => s + (x.outstanding   || 0), 0);

  const rangeLabel = RANGE_OPTIONS.find(o => o.value === range)?.label || range;

  // ── Summary metrics row ──────────────────────────────────────────────────
  const metricsRow = document.createElement('div');
  metricsRow.className = 'report-metrics';

  [
    { label:'Revenue',       value: formatCurrency(totalRevenue),  cls:'text-success', icon:'💰' },
    { label:'Production Cost', value: formatCurrency(totalProdCost),cls:'',            icon:'🌾' },
    { label:'Expenses',      value: formatCurrency(totalExpenses),  cls:'text-danger', icon:'💸' },
    { label:'Gross Profit',  value: formatCurrency(grossProfit),    cls: grossProfit  >= 0 ? 'text-success' : 'text-danger', icon:'📈' },
    { label:'Net Profit',    value: formatCurrency(netProfit),      cls: netProfit    >= 0 ? 'text-success' : 'text-danger', icon:'💎' },
    { label:'Profit Margin', value: `${profitMargin}%`,             cls: profitMargin >= 0 ? 'text-success' : 'text-danger', icon:'%' },
    { label:'Total Sales',   value: String(sales.length),           cls:'', icon:'🛒' },
    { label:'All Customer Debt', value: formatCurrency(totalDebt),  cls: totalDebt > 0 ? 'text-danger' : 'text-success', icon:'⚠️' }
  ].forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'report-metric';
    chip.innerHTML = `
      <span class="report-metric__icon" aria-hidden="true">${m.icon}</span>
      <span class="report-metric__label">${m.label}</span>
      <span class="report-metric__value ${m.cls}">${m.value}</span>
    `;
    metricsRow.appendChild(chip);
  });
  container.appendChild(metricsRow);

  // ── Report sections ──────────────────────────────────────────────────────
  const sections = document.createElement('div');
  sections.className = 'report-sections';
  container.appendChild(sections);

  renderSalesSection(sections,      filteredSales,    rangeLabel, start, end);
  renderProductionSection(sections, prods,    rangeLabel);
  renderExpenseSection(sections,    filteredExpenses, rangeLabel);
  renderProfitSection(sections,     filteredSales, prods, filteredExpenses, rangeLabel, start, end);
  renderDebtSection(sections,       customers);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 * @param {Array} sales
 * @param {string} rangeLabel
 * @param {string} start
 * @param {string} end
 */
function renderSalesSection(container, sales, rangeLabel, start, end) {
  const total = sales.reduce((s, x) => s + x.totalAmount, 0);
  const paid  = sales.reduce((s, x) => s + x.amountPaid,  0);
  const debt  = sales.reduce((s, x) => s + x.outstanding, 0);

  // Bread breakdown
  const breadTotals = Object.fromEntries(BREAD_TYPES.map(bt => [bt, { qty: 0, revenue: 0 }]));
  for (const s of sales) {
    for (const item of (s.items || [])) {
      if (breadTotals[item.breadType]) {
        breadTotals[item.breadType].qty     += item.quantity || 0;
        breadTotals[item.breadType].revenue += item.subtotal || 0;
      }
    }
  }

  const section = createReportSection('🛒 Sales', rangeLabel);
  container.appendChild(section.el);

  section.addSummary([
    { label: 'Total Revenue',   value: formatCurrency(total), cls: 'text-success' },
    { label: 'Amount Collected', value: formatCurrency(paid), cls: '' },
    { label: 'Debt Created',     value: formatCurrency(debt), cls: debt > 0 ? 'text-danger' : '' },
    { label: 'Number of Sales',  value: String(sales.length), cls: '' }
  ]);

  // Bread breakdown table
  const breadRows = BREAD_TYPES
    .filter(bt => breadTotals[bt].qty > 0)
    .map(bt => ({ bread: BREAD_LABELS[bt], qty: breadTotals[bt].qty, revenue: formatCurrency(breadTotals[bt].revenue) }));

  if (breadRows.length > 0) {
    section.addTable(
      ['Bread Type', 'Qty Sold', 'Revenue'],
      breadRows.map(r => [r.bread, String(r.qty), r.revenue])
    );
  }

  // CSV export
  section.addExportBtn(() => {
    const rows = [
      ['Date', 'Receipt', 'Customer', 'Total', 'Paid', 'Outstanding', 'Method'],
      ...sales.map(s => [
        s.date, s.receiptNumber, s.customerName,
        s.totalAmount, s.amountPaid, s.outstanding, s.paymentMethod
      ])
    ];
    downloadCSV(`sales-${start}-${end}.csv`, rows);
  });
}

/**
 * @param {HTMLElement} container
 * @param {Array} prods
 * @param {string} rangeLabel
 */
function renderProductionSection(container, prods, rangeLabel) {
  const totalLoaves = prods.reduce((s, p) => s + (p.totalOutput || 0), 0);

  /**
   * Task 6: use costSnapshot.total if it exists (frozen at save time).
   * For older records without costSnapshot, fall back to productionCost.
   */
  const totalCost = prods.reduce((s, p) => {
    const snapshot = p.costSnapshot;
    const snapshotTotal = snapshot instanceof Map
      ? snapshot.get('_total') || p.productionCost
      : (snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0
          ? p.productionCost   // server already stores productionCost from snapshot
          : p.productionCost);
    return s + (snapshotTotal || p.productionCost || 0);
  }, 0);

  const breadTotals = Object.fromEntries(BREAD_TYPES.map(bt => [bt, 0]));
  for (const p of prods) {
    const outputMap = p.output instanceof Map ? Object.fromEntries(p.output) : (p.output || {});
    for (const bt of BREAD_TYPES) {
      breadTotals[bt] += Number(outputMap[bt]) || 0;
    }
  }

  const section = createReportSection('🍞 Production', rangeLabel);
  container.appendChild(section.el);

  section.addSummary([
    { label: 'Total Loaves',    value: String(totalLoaves),         cls: '' },
    { label: 'Production Runs', value: String(prods.length),        cls: '' },
    { label: 'Total Cost',      value: formatCurrency(totalCost),   cls: '', title: 'Cost is snapshotted at production time — price changes do not retroactively affect old records.' }
  ]);

  const breadRows = BREAD_TYPES
    .filter(bt => breadTotals[bt] > 0)
    .map(bt => [BREAD_LABELS[bt], String(breadTotals[bt])]);

  if (breadRows.length > 0) {
    section.addTable(['Bread Type', 'Total Produced'], breadRows);
  }

  section.addExportBtn(() => {
    const rows = [
      ['Date', 'Batch', 'Mixes', 'Total Output', 'Production Cost (Snapshot)',
       ...BREAD_TYPES.map(bt => BREAD_LABELS[bt])],
      ...prods.map(p => [
        p.date, p.batchName, p.numberOfMixes, p.totalOutput, p.productionCost,
        ...BREAD_TYPES.map(bt => {
          const outputMap = p.output instanceof Map ? Object.fromEntries(p.output) : (p.output || {});
          return outputMap[bt] || 0;
        })
      ])
    ];
    downloadCSV(`production-report.csv`, rows);
  });
}

/**
 * @param {HTMLElement} container
 * @param {Array} expenses
 * @param {string} rangeLabel
 */
function renderExpenseSection(container, expenses, rangeLabel) {
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const catTotals = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0]));
  for (const e of expenses) { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; }

  const section = createReportSection('💸 Expenses', rangeLabel);
  container.appendChild(section.el);

  section.addSummary([
    { label: 'Total Expenses', value: formatCurrency(total), cls: 'text-danger' },
    { label: 'Entries',        value: String(expenses.length), cls: '' }
  ]);

  const catRows = EXPENSE_CATEGORIES
    .filter(c => catTotals[c] > 0)
    .map(c => [EXPENSE_CATEGORY_LABELS[c], formatCurrency(catTotals[c])]);

  if (catRows.length > 0) {
    section.addTable(['Category', 'Total'], catRows);
  }

  section.addExportBtn(() => {
    const rows = [
      ['Date', 'Category', 'Amount', 'Description'],
      ...expenses.map(e => [e.date, EXPENSE_CATEGORY_LABELS[e.category], e.amount, e.description])
    ];
    downloadCSV(`expenses-report.csv`, rows);
  });
}

/**
 * @param {HTMLElement} container
 * @param {Array} sales
 * @param {Array} prods
 * @param {Array} expenses
 * @param {string} rangeLabel
 * @param {string} start
 * @param {string} end
 */
function renderProfitSection(container, sales, prods, expenses, rangeLabel, start, end) {
  const { grossProfit, netProfit, profitMargin } = calculateNetProfit(sales, prods, expenses);
  const revenue    = sales.reduce((s, x) => s + x.totalAmount, 0);
  const prodCost   = prods.reduce((s, p) => s + p.productionCost, 0);
  const totalExp   = expenses.reduce((s, e) => s + e.amount, 0);

  const section = createReportSection('📊 Profit Summary', rangeLabel);
  container.appendChild(section.el);

  section.addTable(
    ['Item', 'Amount'],
    [
      ['Revenue',         formatCurrency(revenue)],
      ['− Production Cost', `−${formatCurrency(prodCost)}`],
      ['= Gross Profit',  formatCurrency(grossProfit)],
      ['− Expenses',      `−${formatCurrency(totalExp)}`],
      ['= Net Profit',    formatCurrency(netProfit)],
      ['Profit Margin',   `${profitMargin}%`]
    ]
  );

  section.addExportBtn(() => {
    const rows = [
      ['Metric', 'Value'],
      ['Revenue', revenue], ['Production Cost', prodCost], ['Gross Profit', grossProfit],
      ['Expenses', totalExp], ['Net Profit', netProfit], ['Profit Margin %', profitMargin]
    ];
    downloadCSV(`profit-${start}-${end}.csv`, rows);
  });
}

/**
 * @param {HTMLElement} container
 * @param {Array} customers
 */
function renderDebtSection(container, customers) {
  const withDebt   = customers.filter(c => c.outstanding > 0);
  const totalDebt  = withDebt.reduce((s, c) => s + c.outstanding, 0);

  const section = createReportSection('⚠️ Outstanding Debt', 'All Customers');
  container.appendChild(section.el);

  section.addSummary([
    { label: 'Customers with Debt', value: String(withDebt.length),     cls: withDebt.length > 0 ? 'text-danger' : '' },
    { label: 'Total Debt',          value: formatCurrency(totalDebt),    cls: totalDebt > 0 ? 'text-danger' : 'text-success' }
  ]);

  if (withDebt.length > 0) {
    const sorted = [...withDebt].sort((a, b) => b.outstanding - a.outstanding);
    section.addTable(
      ['Customer', 'Outstanding', 'Lifetime Purchases'],
      sorted.map(c => [c.name, formatCurrency(c.outstanding), formatCurrency(c.lifetimePurchases || 0)])
    );
  }

  section.addExportBtn(() => {
    const rows = [
      ['Name', 'Phone', 'Outstanding', 'Lifetime Purchases', 'Total Paid'],
      ...withDebt.map(c => [c.name, c.phone, c.outstanding, c.lifetimePurchases, c.totalPaid])
    ];
    downloadCSV('debt-report.csv', rows);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION BUILDER HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a collapsible report section card with builder methods.
 * @param {string} title
 * @param {string} rangeLabel
 * @returns {{ el: HTMLElement, addSummary, addTable, addExportBtn }}
 */
function createReportSection(title, rangeLabel) {
  const el = document.createElement('div');
  el.className = 'report-section card';

  const sectionHeader = document.createElement('div');
  sectionHeader.className = 'report-section__header';
  sectionHeader.innerHTML = `
    <h2 class="report-section__title">${title}</h2>
    <span class="report-section__range badge badge-info">${rangeLabel}</span>
  `;
  el.appendChild(sectionHeader);

  const body = document.createElement('div');
  body.className = 'report-section__body';
  el.appendChild(body);

  return {
    el,

    addSummary(items) {
      const row = document.createElement('div');
      row.className = 'report-summary-row';
      for (const item of items) {
        const chip = document.createElement('div');
        chip.className = 'report-summary-chip';
        chip.innerHTML = `
          <span class="report-summary-chip__label">${item.label}</span>
          <span class="report-summary-chip__value ${item.cls || ''}">${item.value}</span>
        `;
        row.appendChild(chip);
      }
      body.appendChild(row);
    },

    addTable(headers, rows) {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrapper';
      wrap.style.overflowX = 'auto';
      wrap.style.marginTop = '0.75rem';

      const t = document.createElement('table');
      t.className = 'data-table';
      t.innerHTML = `
        <thead>
          <tr>${headers.map(h => `<th class="data-table__th" scope="col">${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr class="data-table__row">
              ${row.map(cell => `<td class="data-table__td">${escHtml(String(cell ?? ''))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      `;
      wrap.appendChild(t);
      body.appendChild(wrap);
    },

    addExportBtn(handler) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-sm';
      btn.style.marginTop = '0.75rem';
      btn.innerHTML = '⬇️ Export CSV';
      btn.addEventListener('click', handler, { signal: controller.signal });
      body.appendChild(btn);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggers a CSV file download in the browser.
 * @param {string} filename
 * @param {Array<Array<any>>} rows - first row is headers
 */
function downloadCSV(filename, rows) {
  const csv = rows.map(row =>
    row.map(cell => {
      const val = String(cell ?? '').replace(/"/g, '""');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-reports-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-reports-styles';
  style.textContent = `
    .report-filter-bar {
      display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;
    }
    .filter-chip {
      padding: 0.375rem 0.875rem; border-radius: var(--radius-full);
      border: 1px solid var(--color-border); background: var(--color-bg-surface);
      font-size: var(--font-size-sm); cursor: pointer; color: var(--color-text-secondary);
      transition: all var(--transition-fast);
    }
    .filter-chip:hover { border-color: var(--color-brand-primary); color: var(--color-brand-primary); }
    .filter-chip--active {
      background: var(--color-brand-primary); color: #fff;
      border-color: var(--color-brand-primary);
    }
    .report-metrics {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.75rem; margin-bottom: 1.5rem;
    }
    .report-metric {
      background: var(--color-bg-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); padding: 0.875rem;
      display: flex; flex-direction: column; gap: 0.25rem;
    }
    .report-metric__icon  { font-size: 1.25rem; }
    .report-metric__label { font-size: var(--font-size-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .report-metric__value { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); }

    .report-sections { display: flex; flex-direction: column; gap: 1.25rem; }
    .report-section {
      padding: 1.25rem; background: var(--color-bg-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm);
    }
    .report-section__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    .report-section__title  { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); }
    .report-section__body   { }

    .report-summary-row  { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.5rem; }
    .report-summary-chip { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.5rem 0.875rem;
      background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
    .report-summary-chip__label { font-size: var(--font-size-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .report-summary-chip__value { font-size: var(--font-size-base); font-weight: var(--font-weight-bold); }

    .text-success { color: var(--color-success); }
    .text-danger  { color: var(--color-danger); }
    .card { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }

    @media (max-width: 480px) {
      .report-metrics { grid-template-columns: repeat(2, 1fr); }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
