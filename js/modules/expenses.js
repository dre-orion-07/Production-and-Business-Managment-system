/**
 * @fileoverview BakeFlow ERP — expenses.js
 * Expense tracking: categorized expenses, reduces net profit automatically.
 * Expenses are soft-deleted (voided) like sales — no hard delete.
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import table   from '../components/table.js';
import {
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS,
  validateExpense, formatCurrency, formatDate, today, logger
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
    <h1 class="page-title">Expenses</h1>
    <p class="page-subtitle">Track all business expenses. Expenses reduce net profit automatically.</p>
  `;

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.innerHTML = '<span aria-hidden="true">+</span> Add Expense';
  addBtn.addEventListener('click', () => openExpenseForm(null, container), { signal: controller.signal });

  header.appendChild(titleWrap);
  header.appendChild(addBtn);
  container.appendChild(header);

  // ── Today's summary ──────────────────────────────────────────────────────
  const todayExpenses = storage.getExpenses({ date: today() }).filter(e => !e.voided);
  const todayTotal    = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const summary = document.createElement('div');
  summary.className = 'expense-summary';
  summary.innerHTML = `
    <div class="summary-chip summary-chip--danger">
      <span class="summary-chip__label">Today's Expenses</span>
      <span class="summary-chip__value">${formatCurrency(todayTotal)}</span>
    </div>
    <div class="summary-chip">
      <span class="summary-chip__label">Entries Today</span>
      <span class="summary-chip__value">${todayExpenses.length}</span>
    </div>
  `;
  container.appendChild(summary);

  // ── Expenses table ───────────────────────────────────────────────────────
  const allExpenses = storage.getExpenses().filter(e => !e.voided).slice().reverse();

  const tableContainer = document.createElement('div');
  tableContainer.className = 'section';

  table.render(tableContainer, {
    id: 'expenses-table',
    columns: [
      {
        key: 'date',
        label: 'Date',
        sortable: true,
        render: (val) => formatDate(val)
      },
      {
        key: 'category',
        label: 'Category',
        sortable: true,
        render: (val) => EXPENSE_CATEGORY_LABELS[val] || val
      },
      {
        key: 'amount',
        label: 'Amount',
        sortable: true,
        render: (val) => `<span class="text-danger font-semibold">${formatCurrency(val || 0)}</span>`
      },
      {
        key: 'description',
        label: 'Description',
        render: (val) => `<span class="text-muted text-sm">${escHtml(val || '—')}</span>`
      }
    ],
    rows: allExpenses,
    actions: [
      {
        label: 'Edit',
        variant: 'secondary',
        handler: (row) => openExpenseForm(row, container)
      },
      {
        label: 'Void',
        variant: 'danger',
        handler: (row) => confirmVoidExpense(row, container)
      }
    ],
    emptyMessage: 'No expenses recorded yet.',
    searchable: true,
    searchKeys: ['category', 'description', 'date']
  });

  container.appendChild(tableContainer);

  // ── Category breakdown (today) ───────────────────────────────────────────
  if (todayExpenses.length > 0) {
    const breakdown = buildCategoryBreakdown(todayExpenses);
    container.appendChild(breakdown);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object|null} existing
 * @param {HTMLElement} pageContainer
 */
function openExpenseForm(existing, pageContainer) {
  const isEdit = Boolean(existing);

  modal.form({
    title:       isEdit ? 'Edit Expense' : 'Add Expense',
    submitLabel: isEdit ? 'Save Changes' : 'Save Expense',
    fields: [
      {
        name:     'category',
        label:    'Category',
        type:     'select',
        required: true,
        value:    existing?.category || '',
        options:  EXPENSE_CATEGORIES.map(c => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }))
      },
      {
        name:        'amount',
        label:       'Amount (₦)',
        type:        'number',
        required:    true,
        value:       existing?.amount || '',
        placeholder: '0.00'
      },
      {
        name:        'description',
        label:       'Description',
        type:        'text',
        required:    false,
        value:       existing?.description || '',
        placeholder: 'e.g. Bought 2 gas cylinders'
      },
      {
        name:     'date',
        label:    'Date',
        type:     'date',
        required: true,
        value:    existing?.date || today()
      }
    ],
    onSubmit(values) {
      const expenseData = {
        category:    values.category,
        amount:      parseFloat(values.amount),
        description: values.description?.trim() || '',
        date:        values.date
      };

      const errors = validateExpense(expenseData);
      if (errors.length) {
        errors.forEach(e => toast.show('error', e));
        return;
      }

      try {
        if (isEdit) {
          // Void old, create new (financial records: no in-place edit of amounts)
          storage.voidExpense(existing.id, { voidReason: 'Edited' });
          storage.saveExpense(expenseData);
          toast.show('success', 'Expense updated.');
        } else {
          storage.saveExpense(expenseData);
          toast.show('success', `${EXPENSE_CATEGORY_LABELS[values.category]} expense of ${formatCurrency(expenseData.amount)} saved.`);
        }
        render(pageContainer);
      } catch (err) {
        logger.error('Expense save failed', err);
        toast.show('error', err.message || 'Failed to save expense.');
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VOID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} expense
 * @param {HTMLElement} pageContainer
 */
function confirmVoidExpense(expense, pageContainer) {
  modal.confirm(
    `Void ${EXPENSE_CATEGORY_LABELS[expense.category]} expense of ${formatCurrency(expense.amount)} on ${formatDate(expense.date)}? This cannot be undone.`,
    () => {
      try {
        storage.voidExpense(expense.id, { voidReason: 'Manually voided' });
        toast.show('success', 'Expense voided.');
        render(pageContainer);
      } catch (err) {
        toast.show('error', err.message || 'Failed to void expense.');
      }
    },
    undefined,
    'Void Expense',
    'Void',
    'danger'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a category breakdown chart (horizontal bar) for a set of expenses.
 * @param {Array} expenses
 * @returns {HTMLElement}
 */
function buildCategoryBreakdown(expenses) {
  const section = document.createElement('div');
  section.className = 'expense-breakdown';

  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = "Today's Breakdown by Category";
  section.appendChild(heading);

  // Aggregate by category
  const totals = {};
  let grandTotal = 0;
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
    grandTotal += e.amount;
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max    = sorted[0]?.[1] || 1;

  const bars = document.createElement('div');
  bars.className = 'category-bars';

  for (const [cat, total] of sorted) {
    const pct = ((total / max) * 100).toFixed(1);
    const pctOfTotal = ((total / grandTotal) * 100).toFixed(0);

    const row = document.createElement('div');
    row.className = 'category-bar-row';
    row.innerHTML = `
      <span class="category-bar-row__label">${EXPENSE_CATEGORY_LABELS[cat] || cat}</span>
      <div class="category-bar-row__track">
        <div class="category-bar-row__fill" style="width:${pct}%"></div>
      </div>
      <span class="category-bar-row__amount">${formatCurrency(total)}</span>
      <span class="category-bar-row__pct text-muted">${pctOfTotal}%</span>
    `;
    bars.appendChild(row);
  }

  section.appendChild(bars);

  const totalRow = document.createElement('div');
  totalRow.className = 'category-total-row';
  totalRow.innerHTML = `
    <span>Total Expenses Today</span>
    <strong class="text-danger">${formatCurrency(grandTotal)}</strong>
  `;
  section.appendChild(totalRow);

  return section;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-expenses-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-expenses-styles';
  style.textContent = `
    .expense-summary { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .expense-breakdown { margin-top: 2rem; }
    .section-title {
      font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary); margin-bottom: 0.75rem;
    }
    .category-bars { display: flex; flex-direction: column; gap: 0.625rem; }
    .category-bar-row {
      display: grid; grid-template-columns: 140px 1fr 100px 40px;
      align-items: center; gap: 0.75rem; font-size: var(--font-size-sm);
    }
    .category-bar-row__label { color: var(--color-text-secondary); font-weight: var(--font-weight-medium); }
    .category-bar-row__track {
      height: 10px; background: var(--color-border);
      border-radius: var(--radius-full); overflow: hidden;
    }
    .category-bar-row__fill {
      height: 100%; background: var(--color-danger);
      border-radius: var(--radius-full); transition: width 0.4s ease;
    }
    .category-bar-row__amount { font-weight: var(--font-weight-semibold); color: var(--color-danger); text-align: right; }
    .category-bar-row__pct    { font-size: var(--font-size-xs); text-align: right; }
    .category-total-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem 0; border-top: 1px solid var(--color-border);
      margin-top: 0.5rem; font-size: var(--font-size-sm);
    }
    .summary-chip { display:flex;flex-direction:column;gap:.15rem;padding:.625rem 1rem;border-radius:var(--radius-lg);background:var(--color-bg-surface);border:1px solid var(--color-border);box-shadow:var(--shadow-sm); }
    .summary-chip--danger { border-color: var(--color-danger); }
    .summary-chip__label { font-size:var(--font-size-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em; }
    .summary-chip__value { font-size:var(--font-size-lg);font-weight:var(--font-weight-bold);color:var(--color-text-primary); }
    .summary-chip--danger .summary-chip__value { color: var(--color-danger); }
    .text-danger   { color: var(--color-danger); }
    .text-muted    { color: var(--color-text-muted); }
    .text-sm       { font-size: var(--font-size-sm); }
    .font-semibold { font-weight: var(--font-weight-semibold); }
    .section       { margin-top: 1rem; }

    @media (max-width: 600px) {
      .category-bar-row { grid-template-columns: 100px 1fr 80px; }
      .category-bar-row__pct { display: none; }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
