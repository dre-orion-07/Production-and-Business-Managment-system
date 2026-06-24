/**
 * @fileoverview BakeFlow ERP — sales.js
 * POS system: customer selection, multi-item sale, retailer pricing,
 * previous debt carry-forward, payment handling, receipt generation.
 *
 * Business rules enforced here:
 * - Previous debt is added to the sale total (functional, not cosmetic)
 * - Retailer flag is per line item, not per customer
 * - Finished inventory is validated before save
 * - Receipt numbers are sequential and never reset
 * - No hard delete of sales — void only
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import table   from '../components/table.js';
import {
  BREAD_TYPES, PRICE_SMALL_RETAILER, PRICE_SMALL_NORMAL,
  formatCurrency, formatDate, formatDateTime, today, logger
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

/** Bread type display labels */
const BREAD_LABELS = {
  mini: 'Mini', small: 'Small', medium: 'Medium', big: 'Big',
  sardine: 'Sardine', chocolate: 'Chocolate', coconut: 'Coconut'
};

/**
 * Pricing table: retailer and normal prices per bread type.
 * Small bread: ₦450 retailer / ₦500 normal.
 * Other types priced relative to small (adjust per business).
 */
const PRICES = {
  mini:      { retailer: 200,  normal: 250  },
  small:     { retailer: PRICE_SMALL_RETAILER, normal: PRICE_SMALL_NORMAL },
  medium:    { retailer: 700,  normal: 800  },
  big:       { retailer: 1200, normal: 1400 },
  sardine:   { retailer: 500,  normal: 600  },
  chocolate: { retailer: 500,  normal: 600  },
  coconut:   { retailer: 500,  normal: 600  }
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

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div>
      <h1 class="page-title">Sales (POS)</h1>
      <p class="page-subtitle">Record sales, handle customer debt, and generate receipts.</p>
    </div>
  `;
  container.appendChild(header);

  const layout = document.createElement('div');
  layout.className = 'sales-layout';
  container.appendChild(layout);

  // Left: POS form
  const posPanel = document.createElement('div');
  posPanel.className = 'pos-panel card';
  renderPOSForm(posPanel, container);
  layout.appendChild(posPanel);

  // Right: today's sales history
  const historyPanel = document.createElement('div');
  historyPanel.className = 'sales-history-panel';
  renderSalesHistory(historyPanel, container);
  layout.appendChild(historyPanel);
}

// ─────────────────────────────────────────────────────────────────────────────
// POS FORM STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory cart items for the current sale.
 * @type {Array<{ breadType: string, quantity: number, unitPrice: number, isRetailer: boolean, subtotal: number }>}
 */
let cart = [];

/**
 * ID of the currently selected customer (null = walk-in).
 * @type {string|null}
 */
let selectedCustomerId = null;

/**
 * Previous outstanding debt of the selected customer.
 * @type {number}
 */
let previousDebt = 0;

// ─────────────────────────────────────────────────────────────────────────────
// POS FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds and mounts the POS form.
 * @param {HTMLElement} panel
 * @param {HTMLElement} pageContainer
 */
function renderPOSForm(panel, pageContainer) {
  // Reset state on each render
  cart               = [];
  selectedCustomerId = null;
  previousDebt       = 0;

  panel.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = 'New Sale';
  panel.appendChild(title);

  // ── Customer selector ────────────────────────────────────────────────────
  const customerSection = buildCustomerSection(panel, pageContainer);
  panel.appendChild(customerSection);

  // ── Previous debt banner ─────────────────────────────────────────────────
  const debtBanner = document.createElement('div');
  debtBanner.id    = 'prev-debt-banner';
  debtBanner.className = 'debt-banner hidden';
  panel.appendChild(debtBanner);

  // ── Add item section ─────────────────────────────────────────────────────
  const itemSection = buildItemSection(panel);
  panel.appendChild(itemSection);

  // ── Cart display ─────────────────────────────────────────────────────────
  const cartSection = document.createElement('div');
  cartSection.id    = 'cart-section';
  cartSection.className = 'cart-section';
  panel.appendChild(cartSection);

  // ── Payment section ──────────────────────────────────────────────────────
  const paymentSection = buildPaymentSection(panel, pageContainer);
  panel.appendChild(paymentSection);

  // Initial cart render
  refreshCart(panel);
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER SECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} panel
 * @param {HTMLElement} pageContainer
 * @returns {HTMLElement}
 */
function buildCustomerSection(panel, pageContainer) {
  const wrap = document.createElement('div');
  wrap.className = 'pos-customer-section';

  const customers = storage.getCustomers();

  wrap.innerHTML = `
    <div class="form-group">
      <label class="form-label" for="pos-customer">Customer</label>
      <div class="pos-customer-row">
        <select id="pos-customer" class="form-select">
          <option value="">Walk-in (no account)</option>
          ${customers.map(c =>
            `<option value="${c.id}">${escHtml(c.name)}${c.outstanding > 0 ? ` — ⚠ Debt: ${formatCurrency(c.outstanding)}` : ''}</option>`
          ).join('')}
        </select>
        <button type="button" class="btn btn-secondary btn-sm" id="pos-add-customer-btn">+ New</button>
      </div>
    </div>
  `;

  // Customer change → update debt banner
  wrap.querySelector('#pos-customer').addEventListener('change', (e) => {
    const cId = e.target.value;
    selectedCustomerId = cId || null;
    if (cId) {
      const customer = storage.getCustomerById(cId);
      previousDebt = customer?.outstanding || 0;
    } else {
      previousDebt = 0;
    }
    refreshDebtBanner(panel);
    refreshTotals(panel);
  }, { signal: controller.signal });

  // Quick-add customer
  wrap.querySelector('#pos-add-customer-btn').addEventListener('click', () => {
    openQuickAddCustomer(panel, pageContainer);
  }, { signal: controller.signal });

  return wrap;
}

/**
 * Opens a minimal quick-add customer form.
 * Refreshes the customer dropdown on save.
 * @param {HTMLElement} panel
 * @param {HTMLElement} pageContainer
 */
function openQuickAddCustomer(panel, pageContainer) {
  modal.form({
    title: 'Quick Add Customer',
    submitLabel: 'Add Customer',
    fields: [
      { name: 'name',  label: 'Full Name',    type: 'text', required: true, placeholder: 'e.g. John Doe' },
      { name: 'phone', label: 'Phone Number', type: 'tel',  required: false, placeholder: '08012345678' }
    ],
    onSubmit(values) {
      try {
        const saved = storage.saveCustomer(values);
        toast.show('success', `"${saved.name}" added.`);
        // Re-render the whole POS form so customer list is fresh
        renderPOSForm(panel, pageContainer);
        // Pre-select the new customer
        setTimeout(() => {
          const sel = panel.querySelector('#pos-customer');
          if (sel) {
            sel.value = saved.id;
            sel.dispatchEvent(new Event('change'));
          }
        }, 50);
      } catch (err) {
        toast.show('error', err.message || 'Failed to add customer.');
      }
    }
  });
}

/**
 * Updates the previous debt banner visibility and content.
 * @param {HTMLElement} panel
 */
function refreshDebtBanner(panel) {
  const banner = panel.querySelector('#prev-debt-banner');
  if (!banner) {return;}
  if (previousDebt > 0) {
    banner.className = 'debt-banner';
    banner.innerHTML = `
      <span class="debt-banner__icon" aria-hidden="true">⚠</span>
      <div>
        <strong>Previous Debt: ${formatCurrency(previousDebt)}</strong>
        <p>This will be added to today's sale total.</p>
      </div>
    `;
  } else {
    banner.className = 'debt-banner hidden';
    banner.innerHTML = '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM SECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the "Add item" row (bread type, qty, retailer toggle).
 * @param {HTMLElement} panel
 * @returns {HTMLElement}
 */
function buildItemSection(panel) {
  const section = document.createElement('div');
  section.className = 'pos-item-section';

  const heading = document.createElement('h3');
  heading.className = 'pos-section-title';
  heading.textContent = 'Add Items';
  section.appendChild(heading);

  // Current bread stock for display
  const inv = storage.getFinishedInventory(today());

  // Item entry row
  const row = document.createElement('div');
  row.className = 'pos-item-row';
  row.innerHTML = `
    <div class="form-group">
      <label class="form-label" for="item-bread">Bread Type</label>
      <select id="item-bread" class="form-select">
        ${BREAD_TYPES.map(bt => {
          const stock = inv[bt] || 0;
          return `<option value="${bt}" ${stock === 0 ? 'disabled' : ''}>
            ${BREAD_LABELS[bt]} (${stock} in stock)
          </option>`;
        }).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="item-qty">Quantity</label>
      <input id="item-qty" type="number" class="form-input" min="1" step="1" value="1" />
    </div>
    <div class="form-group">
      <label class="form-label" for="item-retailer">Retailer?</label>
      <div class="retailer-toggle" id="retailer-toggle">
        <button type="button" class="retailer-btn retailer-btn--no active" id="btn-no-retailer">No</button>
        <button type="button" class="retailer-btn retailer-btn--yes" id="btn-yes-retailer">Yes</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Price Each</label>
      <div class="pos-price-display" id="item-price-display">—</div>
    </div>
    <div class="form-group">
      <label class="form-label">Subtotal</label>
      <div class="pos-price-display" id="item-subtotal-display">—</div>
    </div>
  `;
  section.appendChild(row);

  // Add to cart button
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-secondary';
  addBtn.textContent = '+ Add to Cart';
  section.appendChild(addBtn);

  // ── Wire up live price display ───────────────────────────────────────────
  let isRetailer = false;

  function updatePriceDisplay() {
    const bt  = section.querySelector('#item-bread').value;
    const qty = parseInt(section.querySelector('#item-qty').value) || 0;
    if (!bt) {return;}
    const price    = isRetailer ? PRICES[bt]?.retailer : PRICES[bt]?.normal;
    const subtotal = (price || 0) * qty;
    section.querySelector('#item-price-display').textContent   = formatCurrency(price || 0);
    section.querySelector('#item-subtotal-display').textContent = formatCurrency(subtotal);
  }

  section.querySelector('#item-bread').addEventListener('change', updatePriceDisplay, { signal: controller.signal });
  section.querySelector('#item-qty').addEventListener('input', updatePriceDisplay, { signal: controller.signal });

  section.querySelector('#btn-yes-retailer').addEventListener('click', () => {
    isRetailer = true;
    section.querySelector('#btn-yes-retailer').classList.add('active');
    section.querySelector('#btn-no-retailer').classList.remove('active');
    updatePriceDisplay();
  }, { signal: controller.signal });

  section.querySelector('#btn-no-retailer').addEventListener('click', () => {
    isRetailer = false;
    section.querySelector('#btn-no-retailer').classList.add('active');
    section.querySelector('#btn-yes-retailer').classList.remove('active');
    updatePriceDisplay();
  }, { signal: controller.signal });

  // Trigger initial display
  updatePriceDisplay();

  // Add to cart
  addBtn.addEventListener('click', () => {
    const bt  = section.querySelector('#item-bread').value;
    const qty = parseInt(section.querySelector('#item-qty').value) || 0;
    const stock = inv[bt] || 0;

    if (!bt) { toast.show('error', 'Select a bread type.'); return; }
    if (qty < 1) { toast.show('error', 'Quantity must be at least 1.'); return; }

    // Check if adding to existing cart would exceed stock
    const alreadyInCart = cart.filter(i => i.breadType === bt).reduce((s, i) => s + i.quantity, 0);
    if (alreadyInCart + qty > stock) {
      toast.show('error', `Not enough ${BREAD_LABELS[bt]} in stock (${stock} available, ${alreadyInCart} already in cart).`);
      return;
    }

    const price    = isRetailer ? PRICES[bt].retailer : PRICES[bt].normal;
    const subtotal = price * qty;
    cart.push({ breadType: bt, quantity: qty, unitPrice: price, isRetailer, subtotal });

    // Reset item form
    section.querySelector('#item-qty').value = '1';
    isRetailer = false;
    section.querySelector('#btn-no-retailer').classList.add('active');
    section.querySelector('#btn-yes-retailer').classList.remove('active');
    updatePriceDisplay();

    refreshCart(panel.closest('.pos-panel') || panel);
  }, { signal: controller.signal });

  return section;
}

// ─────────────────────────────────────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-renders the cart display and refreshes totals.
 * @param {HTMLElement} panel
 */
function refreshCart(panel) {
  const cartSection = panel.querySelector('#cart-section');
  if (!cartSection) {return;}
  cartSection.innerHTML = '';

  if (cart.length === 0) {
    cartSection.innerHTML = `<p class="text-muted text-sm cart-empty">No items added yet.</p>`;
    refreshTotals(panel);
    return;
  }

  const heading = document.createElement('h3');
  heading.className = 'pos-section-title';
  heading.textContent = 'Cart';
  cartSection.appendChild(heading);

  const cartList = document.createElement('ul');
  cartList.className = 'cart-list';

  cart.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      <div class="cart-item__info">
        <span class="cart-item__name">
          ${BREAD_LABELS[item.breadType]} ×${item.quantity}
          ${item.isRetailer ? '<span class="badge badge-info">Retailer</span>' : ''}
        </span>
        <span class="cart-item__price">${formatCurrency(item.unitPrice)} each</span>
      </div>
      <div class="cart-item__right">
        <span class="cart-item__subtotal">${formatCurrency(item.subtotal)}</span>
        <button type="button" class="btn btn-ghost btn-icon cart-item__remove"
                aria-label="Remove item" data-idx="${idx}">✕</button>
      </div>
    `;
    cartList.appendChild(li);
  });

  cartList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-idx]');
    if (!btn) {return;}
    const idx = parseInt(btn.dataset.idx);
    cart.splice(idx, 1);
    refreshCart(panel);
  }, { signal: controller.signal });

  cartSection.appendChild(cartList);
  refreshTotals(panel);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT SECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} panel
 * @param {HTMLElement} pageContainer
 * @returns {HTMLElement}
 */
function buildPaymentSection(panel, pageContainer) {
  const section = document.createElement('div');
  section.className = 'pos-payment-section';
  section.id        = 'payment-section';

  section.innerHTML = `
    <h3 class="pos-section-title">Payment</h3>

    <div class="totals-breakdown" id="totals-breakdown">
      <div class="totals-row">
        <span>Items Total</span>
        <span id="total-items">₦0.00</span>
      </div>
      <div class="totals-row totals-row--debt hidden" id="prev-debt-row">
        <span>Previous Debt</span>
        <span id="total-prev-debt" class="text-danger">+₦0.00</span>
      </div>
      <div class="totals-row totals-row--grand">
        <span>Grand Total</span>
        <span id="grand-total">₦0.00</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="amount-paid">Amount Paid (₦)</label>
      <input id="amount-paid" type="number" class="form-input"
             min="0" step="1" value="0" placeholder="0" />
    </div>

    <div class="form-group">
      <label class="form-label" for="payment-method">Payment Method</label>
      <select id="payment-method" class="form-select">
        <option value="cash">Cash</option>
        <option value="transfer">Bank Transfer</option>
        <option value="debt">Full Debt (₦0 paid now)</option>
      </select>
    </div>

    <div class="outstanding-display" id="outstanding-display">
      <span class="text-muted">Outstanding after payment:</span>
      <strong id="outstanding-amount" class="text-danger">₦0.00</strong>
    </div>

    <button type="button" class="btn btn-primary btn-full" id="complete-sale-btn">
      Complete Sale
    </button>
  `;

  // Live outstanding calc
  section.querySelector('#amount-paid').addEventListener('input', () => {
    refreshTotals(panel);
  }, { signal: controller.signal });

  section.querySelector('#payment-method').addEventListener('change', (e) => {
    if (e.target.value === 'debt') {
      section.querySelector('#amount-paid').value = '0';
      refreshTotals(panel);
    }
  }, { signal: controller.signal });

  section.querySelector('#complete-sale-btn').addEventListener('click', () => {
    handleCompleteSale(panel, pageContainer);
  }, { signal: controller.signal });

  return section;
}

/**
 * Recalculates and updates all totals in the payment section.
 * @param {HTMLElement} panel
 */
function refreshTotals(panel) {
  const itemsTotal  = cart.reduce((s, i) => s + i.subtotal, 0);
  const grandTotal  = itemsTotal + previousDebt;
  const amountPaid  = parseFloat(panel.querySelector('#amount-paid')?.value) || 0;
  const outstanding = Math.max(0, grandTotal - amountPaid);

  const set = (id, text) => { const el = panel.querySelector(`#${id}`); if (el) {el.textContent = text;} };

  set('total-items',       formatCurrency(itemsTotal));
  set('grand-total',       formatCurrency(grandTotal));
  set('outstanding-amount', formatCurrency(outstanding));

  const prevDebtRow = panel.querySelector('#prev-debt-row');
  if (prevDebtRow) {
    if (previousDebt > 0) {
      prevDebtRow.classList.remove('hidden');
      set('total-prev-debt', `+${formatCurrency(previousDebt)}`);
    } else {
      prevDebtRow.classList.add('hidden');
    }
  }

  // Colour outstanding amount
  const outEl = panel.querySelector('#outstanding-amount');
  if (outEl) {
    outEl.className = outstanding > 0 ? 'text-danger' : 'text-success';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE SALE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates and saves the sale, then shows the receipt.
 * @param {HTMLElement} panel
 * @param {HTMLElement} pageContainer
 */
function handleCompleteSale(panel, pageContainer) {
  if (cart.length === 0) {
    toast.show('error', 'Add at least one item before completing the sale.');
    return;
  }

  const _customerEl   = panel.querySelector('#pos-customer');
  const amountPaidEl = panel.querySelector('#amount-paid');
  const methodEl     = panel.querySelector('#payment-method');

  const customerId    = selectedCustomerId;
  const customerName  = customerId
    ? (storage.getCustomerById(customerId)?.name || 'Unknown')
    : 'Walk-in';

  const amountPaid    = parseFloat(amountPaidEl?.value) || 0;
  const paymentMethod = methodEl?.value || 'cash';
  const itemsTotal    = cart.reduce((s, i) => s + i.subtotal, 0);
  const totalAmount   = itemsTotal + previousDebt;

  if (amountPaid < 0) {
    toast.show('error', 'Amount paid cannot be negative.');
    return;
  }
  if (amountPaid > totalAmount + 0.01) {
    toast.show('error', `Amount paid (${formatCurrency(amountPaid)}) exceeds total (${formatCurrency(totalAmount)}).`);
    return;
  }

  // If customer has debt but no customer selected, warn
  if (previousDebt > 0 && !customerId) {
    toast.show('warning', 'Previous debt shown requires a customer account.');
  }

  // Confirm before completing large outstanding balance
  const outstanding = Math.max(0, totalAmount - amountPaid);
  if (outstanding > 0 && !customerId) {
    modal.confirm(
      `This sale has ₦${outstanding.toLocaleString()} outstanding but no customer account selected. The debt cannot be tracked. Continue as walk-in?`,
      () => submitSale(customerId, customerName, amountPaid, paymentMethod, totalAmount, outstanding, pageContainer),
      undefined,
      'Untracked Debt Warning',
      'Continue',
      'danger'
    );
    return;
  }

  submitSale(customerId, customerName, amountPaid, paymentMethod, totalAmount, outstanding, pageContainer);
}

/**
 * Calls storage.saveSale and handles receipt display.
 */
function submitSale(customerId, customerName, amountPaid, paymentMethod, totalAmount, outstanding, pageContainer) {
  try {
    const record = storage.saveSale({
      customerId,
      customerName,
      items:              [...cart],
      totalAmount,
      amountPaid,
      paymentMethod,
      previousDebtApplied: previousDebt,
      date:               today()
    });

    toast.show('success', `Sale ${record.receiptNumber} saved — ${formatCurrency(record.totalAmount)}`);
    showReceipt(record, pageContainer);
  } catch (err) {
    logger.error('Sale save failed', err);
    err.message.split('\n').forEach(line => {
      if (line.trim()) {toast.show('error', line.trim(), 6000);}
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Displays the receipt in a modal after a successful sale.
 * @param {object} record - The saved sale record
 * @param {HTMLElement} pageContainer
 */
function showReceipt(record, pageContainer) {
  const settings  = storage.getSettings();
  const shopName  = settings.shopName || 'BakeFlow Bakery';

  const receiptEl = document.createElement('div');
  receiptEl.className = 'receipt';
  receiptEl.innerHTML = `
    <div class="receipt__header">
      <p class="receipt__shop">${escHtml(shopName)}</p>
      <p class="receipt__receipt-no">${record.receiptNumber}</p>
      <p class="receipt__date">${formatDateTime(record.createdAt)}</p>
    </div>
    <div class="receipt__customer">
      <span>Customer:</span>
      <strong>${escHtml(record.customerName)}</strong>
    </div>
    <div class="receipt__divider"></div>
    <ul class="receipt__items">
      ${record.items.map(item => `
        <li class="receipt__item">
          <span>${BREAD_LABELS[item.breadType]} ×${item.quantity}${item.isRetailer ? ' (R)' : ''}</span>
          <span>${formatCurrency(item.subtotal)}</span>
        </li>
      `).join('')}
    </ul>
    <div class="receipt__divider"></div>
    ${record.previousDebtApplied > 0 ? `
      <div class="receipt__row">
        <span>Items Subtotal</span>
        <span>${formatCurrency(record.totalAmount - record.previousDebtApplied)}</span>
      </div>
      <div class="receipt__row text-danger">
        <span>Previous Debt</span>
        <span>+${formatCurrency(record.previousDebtApplied)}</span>
      </div>
    ` : ''}
    <div class="receipt__row receipt__row--total">
      <span>TOTAL</span>
      <strong>${formatCurrency(record.totalAmount)}</strong>
    </div>
    <div class="receipt__row">
      <span>Paid (${record.paymentMethod})</span>
      <span>${formatCurrency(record.amountPaid)}</span>
    </div>
    ${record.outstanding > 0 ? `
      <div class="receipt__row text-danger">
        <span>Outstanding</span>
        <strong>${formatCurrency(record.outstanding)}</strong>
      </div>
    ` : `
      <div class="receipt__row text-success">
        <span>✓ Fully Paid</span>
      </div>
    `}
    <div class="receipt__footer">
      <p>Thank you for your business!</p>
    </div>
  `;

  // Show in modal with "New Sale" action
  const backdrop = document.getElementById('modal-backdrop');
  const modalEl  = document.getElementById('modal');
  if (!backdrop || !modalEl) {
    render(pageContainer);
    return;
  }

  modalEl.innerHTML = '';

  const mHeader = document.createElement('div');
  mHeader.className = 'modal__header';
  mHeader.innerHTML = `<h2 class="modal__title" id="modal-title">Receipt — ${record.receiptNumber}</h2>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost btn-icon modal__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('is-open');
    backdrop.style.display = 'none';
    modalEl.innerHTML = '';
    render(pageContainer);
  });
  mHeader.appendChild(closeBtn);

  const mBody = document.createElement('div');
  mBody.className = 'modal__body';
  mBody.appendChild(receiptEl);

  const mFooter = document.createElement('div');
  mFooter.className = 'modal__footer';
  const newSaleBtn = document.createElement('button');
  newSaleBtn.className = 'btn btn-primary';
  newSaleBtn.textContent = 'New Sale';
  newSaleBtn.addEventListener('click', () => {
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('is-open');
    backdrop.style.display = 'none';
    modalEl.innerHTML = '';
    render(pageContainer);
  });
  const printBtn = document.createElement('button');
  printBtn.className = 'btn btn-secondary';
  printBtn.textContent = '🖨 Print';
  printBtn.addEventListener('click', () => window.print());

  mFooter.appendChild(printBtn);
  mFooter.appendChild(newSaleBtn);
  modalEl.appendChild(mHeader);
  modalEl.appendChild(mBody);
  modalEl.appendChild(mFooter);

  backdrop.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('is-open');
  backdrop.style.display = 'flex';
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES HISTORY TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} panel
 * @param {HTMLElement} pageContainer
 */
function renderSalesHistory(panel, pageContainer) {
  panel.innerHTML = '';

  // Today's stats bar
  const todaySales   = storage.getSales({ date: today() }).filter(s => !s.voided);
  const todayRevenue = todaySales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const todayDebt    = todaySales.reduce((s, x) => s + (x.outstanding || 0), 0);

  const statsBar = document.createElement('div');
  statsBar.className = 'sales-stats-bar';
  statsBar.innerHTML = `
    <div class="sales-stat">
      <span class="sales-stat__label">Today's Sales</span>
      <span class="sales-stat__value">${todaySales.length}</span>
    </div>
    <div class="sales-stat">
      <span class="sales-stat__label">Today's Revenue</span>
      <span class="sales-stat__value text-success">${formatCurrency(todayRevenue)}</span>
    </div>
    <div class="sales-stat ${todayDebt > 0 ? 'sales-stat--warn' : ''}">
      <span class="sales-stat__label">Today's Debt Created</span>
      <span class="sales-stat__value ${todayDebt > 0 ? 'text-danger' : ''}">${formatCurrency(todayDebt)}</span>
    </div>
  `;
  panel.appendChild(statsBar);

  // Today's sales table
  const todayHeading = document.createElement('h2');
  todayHeading.className = 'section-title';
  todayHeading.textContent = "Today's Sales";
  panel.appendChild(todayHeading);

  const todayTableContainer = document.createElement('div');
  renderSalesTable(todayTableContainer, todaySales, pageContainer);
  panel.appendChild(todayTableContainer);

  // All sales
  const allHeading = document.createElement('h2');
  allHeading.className = 'section-title';
  allHeading.style.marginTop = '2rem';
  allHeading.textContent = 'All Sales History';
  panel.appendChild(allHeading);

  const allSales          = storage.getSales().filter(s => !s.voided).slice().reverse();
  const allTableContainer = document.createElement('div');
  renderSalesTable(allTableContainer, allSales, pageContainer, true);
  panel.appendChild(allTableContainer);
}

/**
 * Renders a sales table.
 * @param {HTMLElement} container
 * @param {Array} sales
 * @param {HTMLElement} pageContainer
 * @param {boolean} [searchable]
 */
function renderSalesTable(container, sales, pageContainer, searchable = false) {
  table.render(container, {
    id: searchable ? 'all-sales-table' : 'today-sales-table',
    columns: [
      { key: 'receiptNumber', label: 'Receipt', sortable: true },
      {
        key: 'date',
        label: 'Date',
        sortable: true,
        render: (val) => formatDate(val)
      },
      { key: 'customerName', label: 'Customer', sortable: true },
      {
        key: 'totalAmount',
        label: 'Total',
        sortable: true,
        render: (val) => formatCurrency(val || 0)
      },
      {
        key: 'amountPaid',
        label: 'Paid',
        sortable: true,
        render: (val) => formatCurrency(val || 0)
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        sortable: true,
        render: (val) => {
          const n = val || 0;
          return n > 0
            ? `<span class="badge badge-danger">${formatCurrency(n)}</span>`
            : `<span class="badge badge-success">Cleared</span>`;
        }
      },
      {
        key: 'paymentMethod',
        label: 'Method',
        render: (val) => `<span class="badge badge-info">${val || '—'}</span>`
      }
    ],
    rows: sales,
    actions: [
      {
        label: 'Void',
        variant: 'danger',
        show: (row) => !row.voided,
        handler: (row) => confirmVoidSale(row, pageContainer)
      }
    ],
    emptyMessage: 'No sales recorded.',
    searchable,
    searchKeys: ['receiptNumber', 'customerName', 'date']
  });
}

/**
 * Confirms and voids a sale.
 * @param {object} sale
 * @param {HTMLElement} pageContainer
 */
function confirmVoidSale(sale, pageContainer) {
  modal.form({
    title:       `Void Sale ${sale.receiptNumber}`,
    submitLabel: 'Void Sale',
    fields: [{
      name:     'voidReason',
      label:    'Reason for voiding',
      type:     'text',
      required: true,
      placeholder: 'e.g. Entered in error'
    }],
    onSubmit(values) {
      try {
        storage.voidSale(sale.id, { voidReason: values.voidReason });
        toast.show('success', `Sale ${sale.receiptNumber} voided.`);
        render(pageContainer);
      } catch (err) {
        toast.show('error', err.message || 'Failed to void sale.');
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

if (!document.getElementById('bakeflow-sales-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-sales-styles';
  style.textContent = `
    /* Layout */
    .sales-layout {
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 900px) { .sales-layout { grid-template-columns: 1fr; } }

    .pos-panel { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }

    /* Customer section */
    .pos-customer-row { display: flex; gap: 0.5rem; align-items: center; }
    .pos-customer-row .form-select { flex: 1; }

    /* Debt banner */
    .debt-banner {
      display: flex; align-items: flex-start; gap: 0.75rem;
      background: rgb(245 158 11 / 0.1); border: 1px solid var(--color-warning);
      border-radius: var(--radius-lg); padding: 0.75rem 1rem;
      font-size: var(--font-size-sm);
    }
    .debt-banner.hidden { display: none; }
    .debt-banner__icon { font-size: 1.2rem; color: var(--color-warning); flex-shrink: 0; }
    .debt-banner strong { color: var(--color-warning); }
    .debt-banner p { color: var(--color-text-muted); margin-top: 2px; font-size: var(--font-size-xs); }

    /* Item section */
    .pos-section-title {
      font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--color-text-muted);
      padding-bottom: 0.25rem; border-bottom: 1px solid var(--color-border);
      margin-bottom: 0.5rem;
    }
    .pos-item-row {
      display: grid;
      grid-template-columns: 1fr 80px auto auto auto;
      gap: 0.5rem; align-items: end;
    }
    @media (max-width: 600px) { .pos-item-row { grid-template-columns: 1fr 1fr; } }

    /* Retailer toggle */
    .retailer-toggle {
      display: flex; border: 1px solid var(--color-border);
      border-radius: var(--radius-md); overflow: hidden;
    }
    .retailer-btn {
      flex: 1; padding: 0.4rem 0.6rem; font-size: var(--font-size-sm);
      background: none; border: none; cursor: pointer;
      color: var(--color-text-muted); transition: all var(--transition-fast);
    }
    .retailer-btn.active.retailer-btn--yes { background: var(--color-brand-primary); color: #fff; }
    .retailer-btn.active.retailer-btn--no  { background: var(--color-bg); color: var(--color-text-primary); }
    .retailer-btn:not(.active):hover { background: var(--color-bg); }

    /* Price display */
    .pos-price-display {
      padding: 0.5rem 0.75rem; border: 1px solid var(--color-border);
      border-radius: var(--radius-md); font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold); color: var(--color-text-primary);
      background: var(--color-bg); min-height: 38px; display: flex; align-items: center;
    }

    /* Cart */
    .cart-section { min-height: 40px; }
    .cart-empty { padding: 0.5rem 0; }
    .cart-list { list-style: none; display: flex; flex-direction: column; gap: 0.375rem; }
    .cart-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0.75rem; background: var(--color-bg);
      border-radius: var(--radius-md); border: 1px solid var(--color-border);
      font-size: var(--font-size-sm);
    }
    .cart-item__info { display: flex; flex-direction: column; gap: 2px; }
    .cart-item__name { font-weight: var(--font-weight-medium); }
    .cart-item__price { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .cart-item__right { display: flex; align-items: center; gap: 0.5rem; }
    .cart-item__subtotal { font-weight: var(--font-weight-semibold); }
    .cart-item__remove { color: var(--color-danger); padding: 0.2rem; font-size: 0.75rem; }

    /* Totals */
    .pos-payment-section { display: flex; flex-direction: column; gap: 0.75rem; }
    .totals-breakdown {
      background: var(--color-bg); border-radius: var(--radius-lg);
      padding: 0.75rem 1rem; border: 1px solid var(--color-border);
      display: flex; flex-direction: column; gap: 0.375rem;
    }
    .totals-row {
      display: flex; justify-content: space-between;
      font-size: var(--font-size-sm); color: var(--color-text-secondary);
    }
    .totals-row--debt { color: var(--color-danger); }
    .totals-row--grand {
      font-size: var(--font-size-base); font-weight: var(--font-weight-bold);
      color: var(--color-text-primary); border-top: 1px solid var(--color-border);
      padding-top: 0.375rem; margin-top: 0.25rem;
    }
    .totals-row.hidden { display: none; }
    .outstanding-display {
      display: flex; justify-content: space-between;
      padding: 0.5rem 0; font-size: var(--font-size-sm);
    }
    .btn-full { width: 100%; }

    /* Stats bar */
    .sales-stats-bar {
      display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;
    }
    .sales-stat {
      display: flex; flex-direction: column; gap: 0.1rem;
      padding: 0.625rem 1rem; background: var(--color-bg-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .sales-stat--warn { border-color: var(--color-warning); }
    .sales-stat__label { font-size: var(--font-size-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .sales-stat__value { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); }

    /* Receipt */
    .receipt {
      font-family: monospace; font-size: 0.875rem;
      max-width: 320px; margin: 0 auto;
    }
    .receipt__header { text-align: center; margin-bottom: 0.75rem; }
    .receipt__shop { font-size: 1rem; font-weight: bold; }
    .receipt__receipt-no { font-size: 0.75rem; color: var(--color-text-muted); }
    .receipt__date { font-size: 0.75rem; color: var(--color-text-muted); }
    .receipt__customer { display: flex; justify-content: space-between; margin: 0.5rem 0; font-size: 0.8rem; }
    .receipt__divider { border-top: 1px dashed var(--color-border); margin: 0.5rem 0; }
    .receipt__items { list-style: none; display: flex; flex-direction: column; gap: 0.25rem; }
    .receipt__item { display: flex; justify-content: space-between; }
    .receipt__row { display: flex; justify-content: space-between; padding: 0.15rem 0; }
    .receipt__row--total { font-size: 1rem; font-weight: bold; border-top: 1px solid var(--color-border); padding-top: 0.4rem; margin-top: 0.25rem; }
    .receipt__footer { text-align: center; margin-top: 0.75rem; font-size: 0.75rem; color: var(--color-text-muted); }

    /* Misc */
    .text-success { color: var(--color-success); }
    .text-danger  { color: var(--color-danger); }
    .text-muted   { color: var(--color-text-muted); }
    .text-sm      { font-size: var(--font-size-sm); }
    .section-title {
      font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary); margin-bottom: 0.75rem;
    }
    .card { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }

    @media print {
      body > * { display: none !important; }
      .receipt { display: block !important; }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
