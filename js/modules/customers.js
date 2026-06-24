/**
 * @fileoverview BakeFlow ERP — customers.js
 * Customer management: CRUD, outstanding balance, purchase history,
 * debt history, payment recording.
 *
 * Business rules enforced here:
 * - Outstanding balance is always recalculated from debtHistory (never directly decremented)
 * - Payments append a negative delta to debtHistory
 * - No hard delete of customers with purchase history
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import table   from '../components/table.js';
import {
  validateCustomer, formatCurrency, formatDate, formatDateTime,
  recalculateOutstanding, logger
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

/** Current view: 'list' | 'detail' */
let currentView = 'list';
/** ID of customer being viewed in detail */
let detailCustomerId = null;

// ─────────────────────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
function init(container) {
  controller = new AbortController();
  currentView = 'list';
  detailCustomerId = null;
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
  currentView = 'list';
  container.innerHTML = '';

  // ── Page header ──────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'page-header';

  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `
    <h1 class="page-title">Customers</h1>
    <p class="page-subtitle">Manage customer accounts, outstanding balances, and payment history.</p>
  `;

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.innerHTML = '<span aria-hidden="true">+</span> New Customer';
  addBtn.addEventListener('click', () => openCustomerForm(null, container), { signal: controller.signal });

  header.appendChild(titleWrap);
  header.appendChild(addBtn);
  container.appendChild(header);

  // ── Summary cards ────────────────────────────────────────────────────────
  const customers = storage.getCustomers();
  const totalOutstanding = customers.reduce((s, c) => s + (c.outstanding || 0), 0);
  const withDebt = customers.filter(c => c.outstanding > 0).length;

  const summary = document.createElement('div');
  summary.className = 'customer-summary';
  summary.innerHTML = `
    <div class="summary-chip">
      <span class="summary-chip__label">Total Customers</span>
      <span class="summary-chip__value">${customers.length}</span>
    </div>
    <div class="summary-chip summary-chip--warning">
      <span class="summary-chip__label">With Outstanding Debt</span>
      <span class="summary-chip__value">${withDebt}</span>
    </div>
    <div class="summary-chip summary-chip--danger">
      <span class="summary-chip__label">Total Debt</span>
      <span class="summary-chip__value">${formatCurrency(totalOutstanding)}</span>
    </div>
  `;
  container.appendChild(summary);

  // ── Customers table ───────────────────────────────────────────────────────
  const tableContainer = document.createElement('div');
  tableContainer.className = 'section';

  table.render(tableContainer, {
    id: 'customers-table',
    columns: [
      { key: 'name',      label: 'Name',      sortable: true },
      { key: 'phone',     label: 'Phone',     sortable: false },
      {
        key: 'outstanding',
        label: 'Outstanding',
        sortable: true,
        render: (val) => {
          const amt = val || 0;
          if (amt <= 0) {return `<span class="badge badge-success">Cleared</span>`;}
          return `<span class="badge badge-danger">${formatCurrency(amt)}</span>`;
        }
      },
      {
        key: 'lifetimePurchases',
        label: 'Lifetime Purchases',
        sortable: true,
        render: (val) => formatCurrency(val || 0)
      },
      {
        key: 'createdAt',
        label: 'Member Since',
        sortable: true,
        render: (val) => formatDate(val)
      }
    ],
    rows: customers,
    actions: [
      {
        label: 'View',
        variant: 'secondary',
        handler: (row) => renderDetail(container, row.id)
      },
      {
        label: 'Pay Debt',
        variant: 'primary',
        show: (row) => (row.outstanding || 0) > 0,
        handler: (row) => openPaymentForm(row, container, () => renderList(container))
      },
      {
        label: 'Edit',
        variant: 'ghost',
        handler: (row) => openCustomerForm(row, container)
      }
    ],
    emptyMessage: 'No customers yet. Add your first customer.',
    searchable: true,
    searchKeys: ['name', 'phone', 'address']
  });

  container.appendChild(tableContainer);
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 * @param {string} customerId
 */
function renderDetail(container, customerId) {
  currentView       = 'detail';
  detailCustomerId  = customerId;

  const customer = storage.getCustomerById(customerId);
  if (!customer) {
    toast.show('error', 'Customer not found.');
    renderList(container);
    return;
  }

  container.innerHTML = '';

  // ── Back button + header ─────────────────────────────────────────────────
  const topBar = document.createElement('div');
  topBar.className = 'detail-top-bar';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-ghost';
  backBtn.innerHTML = '← Back to Customers';
  backBtn.addEventListener('click', () => renderList(container), { signal: controller.signal });

  const actionBtns = document.createElement('div');
  actionBtns.className = 'btn-group';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary';
  editBtn.textContent = 'Edit Customer';
  editBtn.addEventListener('click', () => openCustomerForm(customer, container), { signal: controller.signal });

  if ((customer.outstanding || 0) > 0) {
    const payBtn = document.createElement('button');
    payBtn.className = 'btn btn-primary';
    payBtn.textContent = 'Record Payment';
    payBtn.addEventListener('click', () => {
      openPaymentForm(customer, container, () => renderDetail(container, customerId));
    }, { signal: controller.signal });
    actionBtns.appendChild(payBtn);
  }

  actionBtns.appendChild(editBtn);
  topBar.appendChild(backBtn);
  topBar.appendChild(actionBtns);
  container.appendChild(topBar);

  // ── Customer info card ───────────────────────────────────────────────────
  const infoCard = document.createElement('div');
  infoCard.className = 'customer-info-card card';
  infoCard.innerHTML = `
    <div class="customer-info-card__avatar" aria-hidden="true">
      ${customer.name.charAt(0).toUpperCase()}
    </div>
    <div class="customer-info-card__details">
      <h1 class="customer-info-card__name">${escHtml(customer.name)}</h1>
      ${customer.phone   ? `<p class="customer-info-card__meta">📞 ${escHtml(customer.phone)}</p>` : ''}
      ${customer.address ? `<p class="customer-info-card__meta">📍 ${escHtml(customer.address)}</p>` : ''}
      ${customer.notes   ? `<p class="customer-info-card__meta text-muted">📝 ${escHtml(customer.notes)}</p>` : ''}
      <p class="customer-info-card__meta text-muted">Member since ${formatDate(customer.createdAt)}</p>
    </div>
    <div class="customer-info-card__stats">
      <div class="customer-stat ${(customer.outstanding || 0) > 0 ? 'customer-stat--danger' : 'customer-stat--success'}">
        <span class="customer-stat__label">Outstanding</span>
        <span class="customer-stat__value">${formatCurrency(customer.outstanding || 0)}</span>
      </div>
      <div class="customer-stat">
        <span class="customer-stat__label">Lifetime Purchases</span>
        <span class="customer-stat__value">${formatCurrency(customer.lifetimePurchases || 0)}</span>
      </div>
      <div class="customer-stat">
        <span class="customer-stat__label">Total Paid</span>
        <span class="customer-stat__value">${formatCurrency(customer.totalPaid || 0)}</span>
      </div>
    </div>
  `;
  container.appendChild(infoCard);

  // ── Tabs: Purchase History | Debt History | Payments ─────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  tabBar.setAttribute('role', 'tablist');

  const tabs = [
    { id: 'tab-purchases', label: `Purchases (${(customer.purchaseHistory || []).length})` },
    { id: 'tab-debt',      label: `Debt History (${(customer.debtHistory || []).length})` },
    { id: 'tab-payments',  label: `Payments (${(customer.paymentHistory || []).length})` }
  ];

  const tabContent = document.createElement('div');
  tabContent.className = 'tab-content';
  tabContent.id = 'customer-tab-content';

  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${i === 0 ? 'tab-btn--active' : ''}`;
    btn.id = tab.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      tabBar.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('tab-btn--active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('tab-btn--active');
      btn.setAttribute('aria-selected', 'true');
      renderTabContent(tabContent, tab.id, customer);
    }, { signal: controller.signal });
    tabBar.appendChild(btn);
  });

  container.appendChild(tabBar);
  container.appendChild(tabContent);

  // Render first tab by default
  renderTabContent(tabContent, 'tab-purchases', customer);
}

/**
 * Renders the content for the selected tab.
 * @param {HTMLElement} container
 * @param {string} tabId
 * @param {object} customer
 */
function renderTabContent(container, tabId, customer) {
  container.innerHTML = '';

  if (tabId === 'tab-purchases') {
    renderPurchaseHistory(container, customer);
  } else if (tabId === 'tab-debt') {
    renderDebtHistory(container, customer);
  } else if (tabId === 'tab-payments') {
    renderPaymentHistory(container, customer);
  }
}

/**
 * @param {HTMLElement} container
 * @param {object} customer
 */
function renderPurchaseHistory(container, customer) {
  const history = (customer.purchaseHistory || []).slice().reverse();

  if (history.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">No purchases recorded yet.</p>`;
    return;
  }

  table.render(container, {
    id: 'purchase-history-table',
    columns: [
      {
        key: 'timestamp',
        label: 'Date',
        sortable: true,
        render: (val) => formatDateTime(val)
      },
      {
        key: 'amount',
        label: 'Amount',
        sortable: true,
        render: (val) => formatCurrency(val || 0)
      },
      {
        key: 'reference',
        label: 'Reference',
        render: (val) => `<span class="text-muted text-xs">${escHtml(val || '—')}</span>`
      }
    ],
    rows: history,
    emptyMessage: 'No purchase history.'
  });
}

/**
 * @param {HTMLElement} container
 * @param {object} customer
 */
function renderDebtHistory(container, customer) {
  const history = (customer.debtHistory || []).slice().reverse();

  if (history.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">No debt history recorded.</p>`;
    return;
  }

  // Running balance from oldest to newest, then reverse for display
  let running = 0;
  const withBalance = [...customer.debtHistory].map(tx => {
    running += tx.delta || 0;
    return { ...tx, runningBalance: running };
  }).reverse();

  table.render(container, {
    id: 'debt-history-table',
    columns: [
      {
        key: 'timestamp',
        label: 'Date/Time',
        sortable: true,
        render: (val) => formatDateTime(val)
      },
      {
        key: 'delta',
        label: 'Change',
        sortable: true,
        render: (val) => {
          const n = Number(val) || 0;
          const cls = n > 0 ? 'text-danger' : 'text-success';
          const sign = n > 0 ? '+' : '';
          return `<span class="${cls} font-semibold">${sign}${formatCurrency(Math.abs(n))}</span>`;
        }
      },
      {
        key: 'runningBalance',
        label: 'Balance After',
        sortable: false,
        render: (val) => {
          const cls = val > 0 ? 'text-danger' : 'text-success';
          return `<span class="${cls}">${formatCurrency(val || 0)}</span>`;
        }
      },
      {
        key: 'reference',
        label: 'Reference',
        render: (val) => `<span class="text-muted text-xs">${escHtml(val || '—')}</span>`
      }
    ],
    rows: withBalance,
    emptyMessage: 'No debt history.'
  });

  // Current balance summary
  const current = document.createElement('div');
  current.className = 'debt-current-balance';
  const bal = recalculateOutstanding(customer);
  current.innerHTML = `
    <span class="text-muted">Current Outstanding:</span>
    <strong class="${bal > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(bal)}</strong>
  `;
  container.prepend(current);
}

/**
 * @param {HTMLElement} container
 * @param {object} customer
 */
function renderPaymentHistory(container, customer) {
  const history = (customer.paymentHistory || []).slice().reverse();

  if (history.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">No payments recorded yet.</p>`;
    return;
  }

  table.render(container, {
    id: 'payment-history-table',
    columns: [
      {
        key: 'timestamp',
        label: 'Date/Time',
        sortable: true,
        render: (val) => formatDateTime(val)
      },
      {
        key: 'amount',
        label: 'Amount Paid',
        sortable: true,
        render: (val) => `<span class="text-success font-semibold">${formatCurrency(val || 0)}</span>`
      },
      {
        key: 'reference',
        label: 'Reference',
        render: (val) => `<span class="text-muted text-xs">${escHtml(val || '—')}</span>`
      }
    ],
    rows: history,
    emptyMessage: 'No payment history.'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER FORM (CREATE / EDIT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object|null} existing
 * @param {HTMLElement} pageContainer
 */
function openCustomerForm(existing, pageContainer) {
  const isEdit = Boolean(existing);

  modal.form({
    title:       isEdit ? `Edit: ${existing.name}` : 'New Customer',
    submitLabel: isEdit ? 'Save Changes' : 'Add Customer',
    fields: [
      {
        name:     'name',
        label:    'Full Name',
        type:     'text',
        required: true,
        value:    existing?.name || '',
        placeholder: 'e.g. John Doe'
      },
      {
        name:     'phone',
        label:    'Phone Number',
        type:     'tel',
        required: false,
        value:    existing?.phone || '',
        placeholder: 'e.g. 08012345678'
      },
      {
        name:     'address',
        label:    'Address',
        type:     'text',
        required: false,
        value:    existing?.address || '',
        placeholder: 'e.g. 12 Baker Street'
      },
      {
        name:     'notes',
        label:    'Notes',
        type:     'textarea',
        required: false,
        value:    existing?.notes || '',
        placeholder: 'Any additional notes…'
      }
    ],
    onSubmit(values) {
      const errors = validateCustomer(values);
      if (errors.length) {
        errors.forEach(e => toast.show('error', e));
        return;
      }
      try {
        if (isEdit) {
          storage.updateCustomer(existing.id, {
            name:    values.name.trim(),
            phone:   values.phone.trim(),
            address: values.address.trim(),
            notes:   values.notes.trim()
          });
          toast.show('success', `"${values.name}" updated.`);
          // Refresh current view
          if (currentView === 'detail' && detailCustomerId === existing.id) {
            renderDetail(pageContainer, existing.id);
          } else {
            renderList(pageContainer);
          }
        } else {
          storage.saveCustomer(values);
          toast.show('success', `"${values.name}" added.`);
          renderList(pageContainer);
        }
      } catch (err) {
        logger.error('Customer save failed', err);
        toast.show('error', err.message || 'Failed to save customer.');
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens a modal to record a debt payment.
 * @param {object} customer
 * @param {HTMLElement} pageContainer
 * @param {Function} onSuccess - callback after successful payment
 */
function openPaymentForm(customer, pageContainer, onSuccess) {
  const outstanding = customer.outstanding || 0;

  modal.form({
    title:       `Record Payment — ${customer.name}`,
    submitLabel: 'Record Payment',
    fields: [
      {
        name:     'amount',
        label:    `Payment Amount (Outstanding: ${formatCurrency(outstanding)})`,
        type:     'number',
        required: true,
        value:    '',
        placeholder: `Max ${outstanding}`
      },
      {
        name:     'notes',
        label:    'Notes (optional)',
        type:     'text',
        required: false,
        value:    '',
        placeholder: 'e.g. Cash payment'
      }
    ],
    onSubmit(values) {
      const amount = parseFloat(values.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.show('error', 'Payment amount must be a positive number.');
        return;
      }
      if (amount > outstanding + 0.01) {
        toast.show('error', `Amount exceeds outstanding balance of ${formatCurrency(outstanding)}.`);
        return;
      }
      try {
        const reference = values.notes?.trim() || 'PAYMENT';
        storage.recordPayment(customer.id, amount, reference);
        toast.show('success', `Payment of ${formatCurrency(amount)} recorded for ${customer.name}.`);
        onSuccess();
      } catch (err) {
        logger.error('Payment record failed', err);
        toast.show('error', err.message || 'Failed to record payment.');
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
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

if (!document.getElementById('bakeflow-customers-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-customers-styles';
  style.textContent = `
    /* Summary chips */
    .customer-summary {
      display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem;
    }
    .summary-chip {
      display: flex; flex-direction: column; gap: 0.15rem;
      padding: 0.625rem 1rem; border-radius: var(--radius-lg);
      background: var(--color-bg-surface); border: 1px solid var(--color-border);
      box-shadow: var(--shadow-sm);
    }
    .summary-chip--warning { border-color: var(--color-warning); }
    .summary-chip--danger  { border-color: var(--color-danger); }
    .summary-chip__label { font-size: var(--font-size-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .summary-chip__value { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
    .summary-chip--warning .summary-chip__value { color: var(--color-warning); }
    .summary-chip--danger  .summary-chip__value { color: var(--color-danger); }

    /* Detail top bar */
    .detail-top-bar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.25rem; gap: 0.5rem; flex-wrap: wrap;
    }

    /* Customer info card */
    .customer-info-card {
      display: flex; align-items: flex-start; gap: 1.25rem;
      padding: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .customer-info-card__avatar {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--color-brand-primary);
      color: #fff; font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .customer-info-card__details { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
    .customer-info-card__name {
      font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .customer-info-card__meta { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
    .customer-info-card__stats {
      display: flex; gap: 1rem; flex-wrap: wrap;
      margin-left: auto;
    }
    .customer-stat { display: flex; flex-direction: column; gap: 0.15rem; min-width: 120px; }
    .customer-stat--danger  .customer-stat__value { color: var(--color-danger); }
    .customer-stat--success .customer-stat__value { color: var(--color-success); }
    .customer-stat__label { font-size: var(--font-size-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .customer-stat__value { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); }

    /* Tabs */
    .tab-bar {
      display: flex; gap: 0; border-bottom: 2px solid var(--color-border);
      margin-bottom: 1rem; overflow-x: auto;
    }
    .tab-btn {
      padding: 0.625rem 1.25rem; font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium); color: var(--color-text-muted);
      background: none; border: none; border-bottom: 2px solid transparent;
      margin-bottom: -2px; cursor: pointer; white-space: nowrap;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }
    .tab-btn:hover { color: var(--color-text-primary); }
    .tab-btn--active {
      color: var(--color-brand-primary);
      border-bottom-color: var(--color-brand-primary);
    }
    .tab-content { min-height: 200px; }

    /* Debt history */
    .debt-current-balance {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem 1rem; background: var(--color-bg);
      border-radius: var(--radius-lg); margin-bottom: 0.75rem;
      font-size: var(--font-size-sm);
    }

    /* Utility */
    .text-success    { color: var(--color-success); }
    .text-danger     { color: var(--color-danger); }
    .text-muted      { color: var(--color-text-muted); }
    .text-sm         { font-size: var(--font-size-sm); }
    .text-xs         { font-size: var(--font-size-xs); }
    .font-semibold   { font-weight: var(--font-weight-semibold); }
    .card            { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }
    .btn-group       { display: flex; gap: 0.5rem; }
    .section         { margin-top: 1rem; }

    @media (max-width: 600px) {
      .customer-info-card { flex-direction: column; }
      .customer-info-card__stats { margin-left: 0; }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy, openPaymentForm };
