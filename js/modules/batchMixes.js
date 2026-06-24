/**
 * @fileoverview BakeFlow ERP — batchMixes.js
 * Module for creating, editing, duplicating, and deleting batch mix recipes.
 * This is the foundation of the entire system — production depends on these records.
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import table   from '../components/table.js';
import {
  INGREDIENT_KEYS, INGREDIENT_LABELS, BATCH_SIZES,
  validateBatchMix, formatCurrency, logger
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

// ─────────────────────────────────────────────────────────────────────────────
// INGREDIENT FORM FIELDS
// ─────────────────────────────────────────────────────────────────────────────

/** Unit for each ingredient key (for display and input) */
const INGREDIENT_UNITS = {
  flour:        'kg',
  wheatFlour:   'kg',
  sugar:        'kg',
  salt:         'kg',
  yeast:        'g',
  margarine:    'kg',
  oil:          'liters',
  improver:     'g',
  preservative: 'g',
  flavour:      'ml',
  water:        'liters'
};

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises the Batch Mixes module.
 * @param {HTMLElement} container - The #app mount point
 */
function init(container) {
  controller = new AbortController();
  render(container);
}

/**
 * Renders the full batch mixes page into the container.
 * @param {HTMLElement} container
 */
function render(container) {
  container.innerHTML = '';

  // ── Page header ──────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'page-header';

  const titleEl = document.createElement('h1');
  titleEl.className = 'page-title';
  titleEl.textContent = 'Batch Mixes';

  const subtitle = document.createElement('p');
  subtitle.className = 'page-subtitle';
  subtitle.textContent = 'Define ingredient recipes for each batch size. Production uses these to scale ingredients automatically.';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.innerHTML = '<span aria-hidden="true">+</span> New Batch';
  addBtn.addEventListener('click', () => openBatchForm(null, container), { signal: controller.signal });

  header.appendChild(titleEl);
  header.appendChild(subtitle);
  header.appendChild(addBtn);
  container.appendChild(header);

  // ── Batch list ───────────────────────────────────────────────────────────
  const listSection = document.createElement('section');
  listSection.className = 'section';
  listSection.setAttribute('aria-label', 'Saved batch mixes');
  renderBatchList(listSection, container);
  container.appendChild(listSection);
}

/**
 * Renders (or re-renders) the batch list table.
 * @param {HTMLElement} section
 * @param {HTMLElement} pageContainer - needed for re-render on actions
 */
function renderBatchList(section, pageContainer) {
  section.innerHTML = '';
  const batches = storage.getBatchMixes();

  if (batches.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true">🧪</div>
      <p class="empty-state__title">No batch mixes yet</p>
      <p class="empty-state__body">Create your first batch mix to get started with production.</p>
    `;
    section.appendChild(empty);
    return;
  }

  table.render(section, {
    id: 'batch-mixes-table',
    columns: [
      { key: 'name',  label: 'Batch Name', sortable: true },
      { key: 'size',  label: 'Size',        sortable: true },
      {
        key: 'ingredients',
        label: 'Key Ingredients',
        render: (ingredients) => {
          const parts = [];
          if (ingredients?.flour?.amount)   {parts.push(`Flour: ${ingredients.flour.amount}kg`);}
          if (ingredients?.sugar?.amount)   {parts.push(`Sugar: ${ingredients.sugar.amount}kg`);}
          if (ingredients?.yeast?.amount)   {parts.push(`Yeast: ${ingredients.yeast.amount}g`);}
          return `<span class="text-muted text-sm">${parts.join(' · ')}</span>`;
        }
      },
      {
        key: 'totalCost',
        label: 'Est. Cost',
        sortable: true,
        render: (val) => `<span class="badge badge-info">${val ? formatCurrency(val) : '—'}</span>`
      },
      {
        key: 'updatedAt',
        label: 'Last Updated',
        sortable: true,
        render: (val) => val ? new Date(val).toLocaleDateString('en-NG') : '—'
      }
    ],
    rows: batches,
    actions: [
      {
        label: 'Edit',
        variant: 'secondary',
        handler: (row) => openBatchForm(row, pageContainer)
      },
      {
        label: 'Duplicate',
        variant: 'secondary',
        handler: (row) => duplicateBatch(row, pageContainer)
      },
      {
        label: 'Delete',
        variant: 'danger',
        handler: (row) => confirmDeleteBatch(row, pageContainer)
      }
    ],
    emptyMessage: 'No batch mixes found.',
    searchable: true,
    searchKeys: ['name', 'size']
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens the batch mix create/edit form as a full modal panel.
 * @param {object|null} existing - null for create, existing record for edit
 * @param {HTMLElement} pageContainer
 */
function openBatchForm(existing, pageContainer) {
  const isEdit  = Boolean(existing);
  const title   = isEdit ? `Edit: ${existing.name}` : 'New Batch Mix';

  // Build form manually (more control than modal.form for complex ingredient grid)
  const formEl = document.createElement('form');
  formEl.className = 'modal-form batch-form';
  formEl.noValidate = true;

  // ── Name + Size ──────────────────────────────────────────────────────────
  const basicRow = document.createElement('div');
  basicRow.className = 'form-row';

  basicRow.innerHTML = `
    <div class="form-group">
      <label class="form-label required" for="batch-name">Batch Name</label>
      <input id="batch-name" name="name" type="text" class="form-input"
             placeholder="e.g. 10kg Standard" required
             value="${escapeHtml(existing?.name || '')}" />
      <p class="form-error" id="batch-name-error" aria-live="polite"></p>
    </div>
    <div class="form-group">
      <label class="form-label required" for="batch-size">Batch Size</label>
      <select id="batch-size" name="size" class="form-select" required>
        <option value="">Select size…</option>
        ${BATCH_SIZES.map(s =>
          `<option value="${s}" ${existing?.size === s ? 'selected' : ''}>${s}</option>`
        ).join('')}
      </select>
      <p class="form-error" id="batch-size-error" aria-live="polite"></p>
    </div>
  `;
  formEl.appendChild(basicRow);

  // ── Ingredients grid ─────────────────────────────────────────────────────
  const ingHeading = document.createElement('h3');
  ingHeading.className = 'form-section-title';
  ingHeading.textContent = 'Ingredients';
  formEl.appendChild(ingHeading);

  const ingGrid = document.createElement('div');
  ingGrid.className = 'ingredient-grid';

  for (const key of INGREDIENT_KEYS) {
    const unit    = INGREDIENT_UNITS[key];
    const current = existing?.ingredients?.[key]?.amount ?? 0;

    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label class="form-label" for="ing-${key}">
        ${INGREDIENT_LABELS[key]}
        <span class="form-unit">(${unit})</span>
      </label>
      <input id="ing-${key}" name="ing_${key}" type="number"
             class="form-input" min="0" step="0.001"
             value="${current}" />
    `;
    ingGrid.appendChild(group);
  }
  formEl.appendChild(ingGrid);

  // ── Open modal ───────────────────────────────────────────────────────────
  modal.form({
    title,
    fields: [],         // We use our own bodyEl, not modal.form's field builder
    submitLabel: isEdit ? 'Save Changes' : 'Create Batch',
    onSubmit: () => {},  // overridden below
    onCancel: () => {}
  });

  // Replace modal body with our custom form
  // (modal.form doesn't support bodyEl directly, so we inject it manually)
  const modalBody = document.querySelector('.modal__body');
  if (modalBody) {
    modalBody.innerHTML = '';
    modalBody.appendChild(formEl);
  }

  // Wire submit button
  const submitBtn = document.querySelector('.modal__footer .btn-primary');
  if (submitBtn) {
    submitBtn.onclick = () => handleBatchSubmit(formEl, existing, pageContainer);
  }
}

/**
 * Handles form submission for create/edit.
 * @param {HTMLFormElement} formEl
 * @param {object|null} existing
 * @param {HTMLElement} pageContainer
 */
function handleBatchSubmit(formEl, existing, pageContainer) {
  // Clear previous errors
  formEl.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; });
  formEl.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));

  const name = formEl.querySelector('#batch-name')?.value?.trim() || '';
  const size = formEl.querySelector('#batch-size')?.value || '';

  // Collect ingredients
  const ingredients = {};
  for (const key of INGREDIENT_KEYS) {
    const inputEl = formEl.querySelector(`[name="ing_${key}"]`);
    const amount  = parseFloat(inputEl?.value) || 0;
    ingredients[key] = { amount, unit: INGREDIENT_UNITS[key] };
  }

  const mixData = { name, size, ingredients };
  const errors  = validateBatchMix(mixData);

  if (errors.length) {
    errors.forEach(err => {
      if (err.includes('name')) {showFieldError('batch-name-error', err);}
      else if (err.includes('size')) {showFieldError('batch-size-error', err);}
      else {toast.show('error', err);}
    });
    return;
  }

  try {
    if (existing) {
      storage.updateBatchMix(existing.id, { name, size, ingredients });
      toast.show('success', `"${name}" updated successfully.`);
    } else {
      storage.saveBatchMix({ name, size, ingredients, totalCost: 0 });
      toast.show('success', `"${name}" created successfully.`);
    }
    modal.hide();
    render(pageContainer);
  } catch (err) {
    logger.error('Batch mix save failed', err);
    toast.show('error', err.message || 'Failed to save batch mix.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Duplicates a batch mix with "Copy of …" name prefix.
 * @param {object} batch
 * @param {HTMLElement} pageContainer
 */
function duplicateBatch(batch, pageContainer) {
  try {
    const copy = {
      name:        `Copy of ${batch.name}`,
      size:        batch.size,
      ingredients: JSON.parse(JSON.stringify(batch.ingredients)),
      totalCost:   0
    };
    storage.saveBatchMix(copy);
    toast.show('success', `Duplicated as "${copy.name}".`);
    render(pageContainer);
  } catch (err) {
    logger.error('Batch mix duplicate failed', err);
    toast.show('error', err.message || 'Failed to duplicate batch mix.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows a confirm dialog then deletes the batch mix.
 * Batch mixes are non-financial records — hard delete is permitted.
 * @param {object} batch
 * @param {HTMLElement} pageContainer
 */
function confirmDeleteBatch(batch, pageContainer) {
  modal.confirm(
    `Delete "${batch.name}"? This cannot be undone. Any production records using this batch will retain their data.`,
    () => {
      try {
        storage.deleteBatchMix(batch.id);
        toast.show('success', `"${batch.name}" deleted.`);
        render(pageContainer);
      } catch (err) {
        logger.error('Batch mix delete failed', err);
        toast.show('error', err.message || 'Failed to delete batch mix.');
      }
    },
    undefined,
    'Delete Batch Mix',
    'Delete',
    'danger'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Displays an error message in an inline error element.
 * @param {string} elementId
 * @param {string} message
 */
function showFieldError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {el.textContent = message;}
  const inputId = elementId.replace('-error', '');
  const input   = document.getElementById(inputId);
  if (input) {input.classList.add('is-error');}
}

/**
 * Escapes HTML special characters for safe interpolation into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// DESTROY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cleans up module event listeners.
 */
function destroy() {
  controller?.abort();
  controller = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-batchmixes-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-batchmixes-styles';
  style.textContent = `
    .batch-form { max-height: 70vh; overflow-y: auto; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-section-title {
      font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--color-text-secondary); margin: 1rem 0 0.75rem;
      padding-bottom: 0.25rem; border-bottom: 1px solid var(--color-border);
    }
    .form-unit { font-weight: normal; color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .ingredient-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
    }
    .ingredient-grid .form-group { margin-bottom: 0; }
    @media (max-width: 480px) {
      .form-row { grid-template-columns: 1fr; }
      .ingredient-grid { grid-template-columns: 1fr 1fr; }
    }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
