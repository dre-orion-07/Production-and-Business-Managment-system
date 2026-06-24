/**
 * @fileoverview BakeFlow ERP — modal.js
 * Replaces all native alert()/confirm()/prompt() calls.
 * Never use window.alert, window.confirm, or window.prompt anywhere else.
 */

const backdrop = /** @type {HTMLElement} */ (document.getElementById('modal-backdrop'));
const modalEl  = /** @type {HTMLElement} */ (document.getElementById('modal'));

/** @type {AbortController|null} */
let keyController = null;

/**
 * Shows the modal backdrop.
 */
function show() {
  backdrop.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('is-open');
  backdrop.style.display = 'flex';
  // Trap focus inside modal
  const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length) /** @type {HTMLElement} */ (focusable[0]).focus();
}

/**
 * Hides the modal backdrop and clears content.
 */
function hide() {
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('is-open');
  backdrop.style.display = 'none';
  modalEl.innerHTML = '';
  if (keyController) { keyController.abort(); keyController = null; }
}

/**
 * Displays a simple alert dialog (replaces window.alert).
 * @param {string} message
 * @param {string} [title]
 * @returns {Promise<void>}
 */
function alert(message, title = 'Notice') {
  return new Promise(resolve => {
    _render({
      title,
      body: message,
      actions: [{ label: 'OK', variant: 'primary', handler: () => { hide(); resolve(); } }]
    });
  });
}

/**
 * Displays a confirmation dialog (replaces window.confirm).
 * @param {string} message
 * @param {function} onConfirm - called when user confirms
 * @param {function} [onCancel]
 * @param {string} [title]
 * @param {string} [confirmLabel]
 * @param {'danger'|'primary'} [confirmVariant]
 */
function confirm(message, onConfirm, onCancel, title = 'Confirm', confirmLabel = 'Confirm', confirmVariant = 'primary') {
  _render({
    title,
    body: message,
    actions: [
      {
        label: 'Cancel',
        variant: 'secondary',
        handler: () => { hide(); if (onCancel) onCancel(); }
      },
      {
        label: confirmLabel,
        variant: confirmVariant,
        handler: () => { hide(); onConfirm(); }
      }
    ]
  });
}

/**
 * Displays a form dialog.
 * @param {{
 *   title: string,
 *   fields: Array<{
 *     name: string, label: string, type: string,
 *     required?: boolean, options?: string[]|Array<{value:string,label:string}>,
 *     value?: any, placeholder?: string, hint?: string
 *   }>,
 *   submitLabel?: string,
 *   onSubmit: (values: object) => void,
 *   onCancel?: () => void
 * }} config
 */
function form(config) {
  const { title, fields, submitLabel = 'Save', onSubmit, onCancel } = config;

  // Build form DOM
  const formEl = document.createElement('form');
  formEl.className = 'modal-form';
  formEl.noValidate = true;

  for (const field of fields) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label' + (field.required ? ' required' : '');
    label.textContent = field.label;
    label.setAttribute('for', `modal-field-${field.name}`);

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'form-select';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = `Select ${field.label}...`;
      input.appendChild(placeholder);
      for (const opt of (field.options || [])) {
        const optEl = document.createElement('option');
        if (typeof opt === 'string') { optEl.value = opt; optEl.textContent = opt; }
        else { optEl.value = opt.value; optEl.textContent = opt.label; }
        if (String(field.value) === optEl.value) optEl.selected = true;
        input.appendChild(optEl);
      }
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'form-textarea';
      input.textContent = field.value || '';
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      input.className = 'form-input';
      if (field.value !== undefined) input.value = String(field.value);
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    input.id   = `modal-field-${field.name}`;
    input.name = field.name;
    if (field.required) input.required = true;

    group.appendChild(label);
    group.appendChild(input);

    if (field.hint) {
      const hint = document.createElement('p');
      hint.className = 'form-hint';
      hint.textContent = field.hint;
      group.appendChild(hint);
    }

    // Inline error placeholder
    const errEl = document.createElement('p');
    errEl.className = 'form-error';
    errEl.id = `modal-field-${field.name}-error`;
    errEl.setAttribute('aria-live', 'polite');
    group.appendChild(errEl);

    formEl.appendChild(group);
  }

  _render({
    title,
    bodyEl: formEl,
    actions: [
      {
        label: 'Cancel', variant: 'secondary',
        handler: () => { hide(); if (onCancel) onCancel(); }
      },
      {
        label: submitLabel, variant: 'primary', type: 'submit',
        handler: () => {
          // Clear previous errors
          formEl.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; });
          formEl.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));

          if (!formEl.checkValidity()) {
            // Show native validation messages inline
            fields.forEach(field => {
              const input = formEl.elements.namedItem(field.name);
              if (input && !input.validity.valid) {
                input.classList.add('is-error');
                const errEl = document.getElementById(`modal-field-${field.name}-error`);
                if (errEl) errEl.textContent = input.validationMessage;
              }
            });
            return; // Don't close
          }
          const values = {};
          for (const field of fields) {
            const input = formEl.elements.namedItem(field.name);
            values[field.name] = input ? input.value : '';
          }
          hide();
          onSubmit(values);
        }
      }
    ]
  });
}

/**
 * Internal renderer: builds modal DOM and shows it.
 * @param {{
 *   title: string,
 *   body?: string,
 *   bodyEl?: HTMLElement,
 *   actions: Array<{ label: string, variant: string, handler: Function, type?: string }>
 * }} config
 */
function _render({ title, body, bodyEl, actions }) {
  modalEl.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'modal__header';
  const titleEl = document.createElement('h2');
  titleEl.id = 'modal-title';
  titleEl.className = 'modal__title';
  titleEl.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost btn-icon modal__close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => hide());
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'modal__body';
  if (bodyEl) {
    bodyDiv.appendChild(bodyEl);
  } else {
    const p = document.createElement('p');
    p.className = 'modal__message';
    p.textContent = body || '';
    bodyDiv.appendChild(p);
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'modal__footer';
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className = `btn btn-${action.variant}`;
    btn.textContent = action.label;
    if (action.type === 'submit') btn.type = 'submit';
    btn.addEventListener('click', action.handler);
    footer.appendChild(btn);
  }

  modalEl.appendChild(header);
  modalEl.appendChild(bodyDiv);
  modalEl.appendChild(footer);

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) hide(); }, { once: true });

  // Close on Escape key
  keyController = new AbortController();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  }, { signal: keyController.signal });

  show();
}

// Modal CSS (appended to <head> if not already present)
if (!document.getElementById('bakeflow-modal-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-modal-styles';
  style.textContent = `
    .modal-backdrop {
      display: none; position: fixed; inset: 0;
      background: rgb(0 0 0 / 0.5); z-index: var(--z-modal);
      align-items: center; justify-content: center; padding: 1rem;
    }
    .modal-backdrop.is-open { display: flex; }
    .modal {
      background: var(--color-bg-surface); border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl); width: 100%; max-width: 480px;
      max-height: 90vh; display: flex; flex-direction: column;
      overflow: hidden;
    }
    .modal__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .modal__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); }
    .modal__body { padding: 1.5rem; overflow-y: auto; flex: 1; }
    .modal__message { color: var(--color-text-secondary); line-height: var(--line-height-relaxed); }
    .modal__footer {
      display: flex; justify-content: flex-end; gap: 0.5rem;
      padding: 1rem 1.5rem; border-top: 1px solid var(--color-border); flex-shrink: 0;
    }
    .modal-form { display: flex; flex-direction: column; gap: 1rem; }
  `;
  document.head.appendChild(style);
}

export default { alert, confirm, form, hide };
