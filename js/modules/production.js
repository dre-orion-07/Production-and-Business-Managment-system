/**
 * @fileoverview BakeFlow ERP — production.js
 * Records a production run: select batch, enter number of mixes,
 * auto-scale ingredients, enter bread output, save.
 *
 * Save flow:
 *   1. Validate ingredient stock
 *   2. Deduct ingredients from stock
 *   3. Add bread output to finished inventory
 *   4. Save production record
 *   5. Upsert daily history
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import table   from '../components/table.js';
import {
  INGREDIENT_KEYS, INGREDIENT_LABELS, BREAD_TYPES,
  computeIngredientsUsed, computeProductionCost,
  formatCurrency, formatDate, today, logger
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

/** Bread type display labels */
const BREAD_LABELS = {
  mini:      'Mini',
  small:     'Small',
  medium:    'Medium',
  big:       'Big',
  sardine:   'Sardine',
  chocolate: 'Chocolate',
  coconut:   'Coconut'
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
 * Renders the production page: form at top, history table below.
 * @param {HTMLElement} container
 */
function render(container) {
  container.innerHTML = '';

  // ── Page header ──────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div>
      <h1 class="page-title">Production</h1>
      <p class="page-subtitle">Record a production run. Ingredients are deducted and bread stock is updated automatically.</p>
    </div>
  `;
  container.appendChild(header);

  // ── Layout: form + history side by side on desktop ───────────────────────
  const layout = document.createElement('div');
  layout.className = 'production-layout';
  container.appendChild(layout);

  // Left: production form
  const formPanel = document.createElement('div');
  formPanel.className = 'production-form-panel card';
  renderProductionForm(formPanel, container);
  layout.appendChild(formPanel);

  // Right: today's production history
  const historyPanel = document.createElement('div');
  historyPanel.className = 'production-history-panel';
  renderProductionHistory(historyPanel);
  layout.appendChild(historyPanel);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds and mounts the production entry form.
 * @param {HTMLElement} panel
 * @param {HTMLElement} pageContainer - for re-render on save
 */
function renderProductionForm(panel, pageContainer) {
  panel.innerHTML = '';

  const batches = storage.getBatchMixes();

  if (batches.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon" aria-hidden="true">🧪</div>
        <p class="empty-state__title">No batch mixes found</p>
        <p class="empty-state__body">Create at least one batch mix before recording production.</p>
        <a href="#/batch-mixes" class="btn btn-primary" style="margin-top:1rem;">Go to Batch Mixes</a>
      </div>
    `;
    return;
  }

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = 'New Production Run';
  panel.appendChild(title);

  const form = document.createElement('form');
  form.className = 'production-form';
  form.noValidate = true;

  // ── Batch selector ───────────────────────────────────────────────────────
  const batchGroup = document.createElement('div');
  batchGroup.className = 'form-group';
  batchGroup.innerHTML = `
    <label class="form-label required" for="prod-batch">Select Batch</label>
    <select id="prod-batch" name="batchId" class="form-select" required>
      <option value="">Choose a batch mix…</option>
      ${batches.map(b => `<option value="${b.id}">${escHtml(b.name)} (${b.size})</option>`).join('')}
    </select>
    <p class="form-error" id="prod-batch-error" aria-live="polite"></p>
  `;
  form.appendChild(batchGroup);

  // ── Mixes + Date row ─────────────────────────────────────────────────────
  const row = document.createElement('div');
  row.className = 'form-row';
  row.innerHTML = `
    <div class="form-group">
      <label class="form-label required" for="prod-mixes">Number of Mixes</label>
      <input id="prod-mixes" name="numberOfMixes" type="number"
             class="form-input" min="1" step="1" value="1" required />
      <p class="form-hint">Ingredients are multiplied by this number.</p>
      <p class="form-error" id="prod-mixes-error" aria-live="polite"></p>
    </div>
    <div class="form-group">
      <label class="form-label required" for="prod-date">Production Date</label>
      <input id="prod-date" name="date" type="date"
             class="form-input" value="${today()}" required />
    </div>
  `;
  form.appendChild(row);

  // ── Ingredients preview (auto-updates) ───────────────────────────────────
  const ingSection = document.createElement('div');
  ingSection.className = 'ing-preview';
  ingSection.id = 'ing-preview';
  ingSection.innerHTML = `<p class="ing-preview__empty text-muted">Select a batch to see ingredient quantities.</p>`;
  form.appendChild(ingSection);

  // ── Production output ────────────────────────────────────────────────────
  const outputSection = document.createElement('div');
  outputSection.className = 'output-section';
  outputSection.innerHTML = `<h3 class="form-section-title">Production Output</h3>`;

  const outputGrid = document.createElement('div');
  outputGrid.className = 'output-grid';
  outputGrid.id = 'output-grid';

  for (const bt of BREAD_TYPES) {
    const g = document.createElement('div');
    g.className = 'form-group';
    g.innerHTML = `
      <label class="form-label" for="out-${bt}">${BREAD_LABELS[bt]}</label>
      <input id="out-${bt}" name="out_${bt}" type="number"
             class="form-input" min="0" step="1" value="0" />
    `;
    outputGrid.appendChild(g);
  }
  outputSection.appendChild(outputGrid);

  // Total output display
  const totalRow = document.createElement('div');
  totalRow.className = 'output-total';
  totalRow.id = 'output-total';
  totalRow.innerHTML = `<span class="text-muted">Total Output:</span> <strong id="total-loaves">0 loaves</strong>`;
  outputSection.appendChild(totalRow);

  // Production cost display
  const costRow = document.createElement('div');
  costRow.className = 'output-total';
  costRow.innerHTML = `<span class="text-muted">Production Cost:</span> <strong id="prod-cost">₦0.00</strong>`;
  outputSection.appendChild(costRow);

  form.appendChild(outputSection);

  // ── Submit button ────────────────────────────────────────────────────────
  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn-primary btn-full';
  submitBtn.textContent = 'Finish Production';
  submitBtn.id = 'prod-submit-btn';
  form.appendChild(submitBtn);

  panel.appendChild(form);

  // ── Wire up live calculations ────────────────────────────────────────────
  const batchSelect  = form.querySelector('#prod-batch');
  const mixesInput   = form.querySelector('#prod-mixes');
  const outputInputs = form.querySelectorAll('[name^="out_"]');

  /** Updates ingredient preview and cost when batch/mixes change */
  function updateIngredientPreview() {
    const batchId = batchSelect.value;
    const mixes   = Math.max(1, parseInt(mixesInput.value) || 1);
    const batch   = storage.getBatchMixById(batchId);
    const stock   = storage.getIngredientStock();

    if (!batch) {
      ingSection.innerHTML = `<p class="ing-preview__empty text-muted">Select a batch to see ingredient quantities.</p>`;
      document.getElementById('prod-cost').textContent = '₦0.00';
      return;
    }

    const used     = computeIngredientsUsed(batch.ingredients, mixes);
    const settings = storage.getSettings();
    const { cost, hasMissingCosts } = computeProductionCost(used, settings.unitCosts || {});

    // Build preview table
    let html = `<h3 class="form-section-title">Ingredients Used</h3><div class="ing-preview-grid">`;
    for (const key of INGREDIENT_KEYS) {
      const { amount, unit } = used[key] || { amount: 0, unit: '' };
      if (amount === 0) {continue;}
      const available  = stock[key]?.amount ?? 0;
      const sufficient = available >= amount;
      html += `
        <div class="ing-preview-item ${sufficient ? '' : 'ing-preview-item--warn'}">
          <span class="ing-preview-item__name">${INGREDIENT_LABELS[key]}</span>
          <span class="ing-preview-item__amount">${amount} ${unit}</span>
          ${!sufficient
            ? `<span class="ing-preview-item__stock-warn" title="Insufficient stock">
                ⚠ Have: ${available} ${unit}
               </span>`
            : `<span class="ing-preview-item__stock-ok">✓ ${available} ${unit} avail.</span>`}
        </div>`;
    }
    html += `</div>`;
    ingSection.innerHTML = html;

    // Cost
    document.getElementById('prod-cost').textContent = formatCurrency(cost);
    if (hasMissingCosts) {
      document.getElementById('prod-cost').title = 'Some ingredient costs not set in Settings';
    }
  }

  /** Updates total loaf count */
  function updateTotalOutput() {
    let total = 0;
    outputInputs.forEach(input => { total += parseInt(input.value) || 0; });
    document.getElementById('total-loaves').textContent = `${total} loaves`;
  }

  batchSelect.addEventListener('change', updateIngredientPreview, { signal: controller.signal });
  mixesInput.addEventListener('input',   updateIngredientPreview, { signal: controller.signal });
  outputInputs.forEach(input => {
    input.addEventListener('input', updateTotalOutput, { signal: controller.signal });
  });

  // ── Submit handler ───────────────────────────────────────────────────────
  submitBtn.addEventListener('click', () => {
    handleProductionSubmit(form, pageContainer);
  }, { signal: controller.signal });
}

/**
 * Validates and saves the production record.
 * @param {HTMLFormElement} form
 * @param {HTMLElement} pageContainer
 */
function handleProductionSubmit(form, pageContainer) {
  // Clear previous errors
  form.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; });

  const batchId      = form.querySelector('#prod-batch').value;
  const numberOfMixes = parseInt(form.querySelector('#prod-mixes').value) || 0;
  const date         = form.querySelector('#prod-date').value;

  if (!batchId) {
    document.getElementById('prod-batch-error').textContent = 'Please select a batch mix.';
    return;
  }
  if (numberOfMixes < 1) {
    document.getElementById('prod-mixes-error').textContent = 'Number of mixes must be at least 1.';
    return;
  }

  // Collect output
  const output = {};
  let totalOutput = 0;
  for (const bt of BREAD_TYPES) {
    const qty   = parseInt(form.querySelector(`#out-${bt}`)?.value) || 0;
    output[bt]  = qty;
    totalOutput += qty;
  }

  if (totalOutput === 0) {
    modal.confirm(
      'Total output is 0 loaves. Are you sure you want to record a production run with no bread output?',
      () => saveProduction(batchId, numberOfMixes, date, output, pageContainer),
      undefined,
      'Zero Output Warning',
      'Yes, Save Anyway'
    );
    return;
  }

  saveProduction(batchId, numberOfMixes, date, output, pageContainer);
}

/**
 * Calls storage.saveProduction and handles success/error.
 * @param {string} batchId
 * @param {number} numberOfMixes
 * @param {string} date
 * @param {object} output
 * @param {HTMLElement} pageContainer
 */
function saveProduction(batchId, numberOfMixes, date, output, pageContainer) {
  try {
    const record = storage.saveProduction({ batchId, numberOfMixes, output, date });
    toast.show('success', `Production saved — ${record.totalOutput} loaves recorded.`);
    render(pageContainer);
  } catch (err) {
    logger.error('Production save failed', err);
    // Show each error line as a toast
    err.message.split('\n').forEach(line => {
      if (line.trim()) {toast.show('error', line.trim(), 6000);}
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION HISTORY TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the production history for today (and optionally past dates).
 * @param {HTMLElement} panel
 */
function renderProductionHistory(panel) {
  panel.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = "Today's Production";
  panel.appendChild(heading);

  const todayRecords = storage.getProductions({ date: today() });

  if (todayRecords.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state empty-state--sm';
    empty.innerHTML = `<p class="empty-state__title">No production recorded today</p>`;
    panel.appendChild(empty);
  } else {
    const tableContainer = document.createElement('div');
    table.render(tableContainer, {
      id: 'today-production-table',
      columns: [
        { key: 'batchName',     label: 'Batch',   sortable: true },
        { key: 'numberOfMixes', label: 'Mixes',   sortable: true },
        {
          key: 'output',
          label: 'Output',
          render: (output) => {
            if (!output) {return '—';}
            return BREAD_TYPES
              .filter(bt => (output[bt] || 0) > 0)
              .map(bt => `${BREAD_LABELS[bt]}: ${output[bt]}`)
              .join(', ') || '—';
          }
        },
        { key: 'totalOutput',   label: 'Total',   sortable: true },
        {
          key: 'productionCost',
          label: 'Cost',
          sortable: true,
          render: (val) => formatCurrency(val || 0)
        }
      ],
      rows: todayRecords,
      emptyMessage: 'No production records for today.'
    });
    panel.appendChild(tableContainer);
  }

  // ── All-time history ─────────────────────────────────────────────────────
  const allHeading = document.createElement('h2');
  allHeading.className = 'section-title';
  allHeading.style.marginTop = '2rem';
  allHeading.textContent = 'All Production History';
  panel.appendChild(allHeading);

  const allRecords = storage.getProductions().slice().reverse(); // newest first
  const allTableContainer = document.createElement('div');

  table.render(allTableContainer, {
    id: 'all-production-table',
    columns: [
      {
        key: 'date',
        label: 'Date',
        sortable: true,
        render: (val) => formatDate(val)
      },
      { key: 'batchName',     label: 'Batch',    sortable: true },
      { key: 'numberOfMixes', label: 'Mixes',    sortable: true },
      { key: 'totalOutput',   label: 'Loaves',   sortable: true },
      {
        key: 'productionCost',
        label: 'Cost',
        sortable: true,
        render: (val) => formatCurrency(val || 0)
      }
    ],
    rows: allRecords,
    searchable: true,
    searchKeys: ['batchName', 'date'],
    emptyMessage: 'No production history yet.'
  });
  panel.appendChild(allTableContainer);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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

if (!document.getElementById('bakeflow-production-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-production-styles';
  style.textContent = `
    .production-layout {
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 900px) {
      .production-layout { grid-template-columns: 1fr; }
    }

    .production-form-panel { padding: 1.5rem; }
    .card-title {
      font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);
      margin-bottom: 1.25rem; color: var(--color-text-primary);
    }
    .production-form { display: flex; flex-direction: column; gap: 1rem; }

    /* Ingredient preview */
    .ing-preview { background: var(--color-bg); border-radius: var(--radius-lg);
      padding: 0.75rem 1rem; border: 1px solid var(--color-border); }
    .ing-preview__empty { font-size: var(--font-size-sm); }
    .ing-preview-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr));
      gap: 0.5rem; margin-top: 0.5rem;
    }
    .ing-preview-item {
      display: flex; flex-direction: column;
      font-size: var(--font-size-sm); padding: 0.4rem 0.5rem;
      border-radius: var(--radius-md);
      background: var(--color-bg-surface); border: 1px solid var(--color-border);
    }
    .ing-preview-item--warn { border-color: var(--color-warning); background: rgb(245 158 11 / 0.05); }
    .ing-preview-item__name { font-weight: var(--font-weight-medium); color: var(--color-text-primary); }
    .ing-preview-item__amount { color: var(--color-text-secondary); }
    .ing-preview-item__stock-warn { color: var(--color-warning); font-size: var(--font-size-xs); margin-top: 2px; }
    .ing-preview-item__stock-ok  { color: var(--color-success);  font-size: var(--font-size-xs); margin-top: 2px; }

    /* Output grid */
    .output-section { display: flex; flex-direction: column; gap: 0.75rem; }
    .output-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(120px,1fr)); gap: 0.75rem;
    }
    .output-total {
      display: flex; justify-content: space-between; align-items: center;
      font-size: var(--font-size-sm); padding: 0.5rem 0;
      border-top: 1px solid var(--color-border);
    }
    .output-total strong { font-size: var(--font-size-base); }

    /* History */
    .section-title {
      font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary); margin-bottom: 0.75rem;
    }
    .empty-state--sm { padding: 1.5rem; }

    .btn-full { width: 100%; margin-top: 0.5rem; }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
