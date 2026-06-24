/**
 * @fileoverview BakeFlow ERP — toast.js
 * Non-blocking notification toasts: success, error, warning, info.
 * Usage: toast.show('success', 'Sale saved!');
 */

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ'
};

const DEFAULT_DURATION = 4000; // ms

/**
 * Shows a toast notification.
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} message
 * @param {number} [duration] - ms before auto-dismiss (0 = sticky)
 */
function show(type, message, duration = DEFAULT_DURATION) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  // Icon
  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[type] || 'ℹ';

  // Message
  const msg = document.createElement('span');
  msg.className = 'toast__message';
  msg.textContent = message;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast__close btn btn-ghost btn-icon';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => dismiss(toast), { once: true });

  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismiss(toast), duration);
  }

  return toast;
}

/**
 * Dismisses a toast element with animation.
 * @param {HTMLElement} toastEl
 */
function dismiss(toastEl) {
  if (!toastEl || !toastEl.parentNode) return;
  toastEl.classList.remove('toast--visible');
  toastEl.classList.add('toast--exiting');
  toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
  // Fallback remove in case transition doesn't fire
  setTimeout(() => { if (toastEl.parentNode) toastEl.remove(); }, 400);
}

/** Dismisses all visible toasts. */
function dismissAll() {
  const container = document.getElementById('toast-container');
  if (!container) return;
  container.querySelectorAll('.toast').forEach(dismiss);
}

// Inject toast styles
if (!document.getElementById('bakeflow-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-toast-styles';
  style.textContent = `
    .toast-container {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      z-index: var(--z-toast); display: flex; flex-direction: column;
      gap: 0.5rem; pointer-events: none; max-width: 380px; width: calc(100vw - 2rem);
    }
    .toast {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.75rem 1rem; border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg); pointer-events: all;
      opacity: 0; transform: translateX(100%);
      transition: opacity 200ms ease, transform 250ms ease;
      border-left: 4px solid transparent;
      background: var(--color-bg-surface);
    }
    .toast--visible   { opacity: 1; transform: translateX(0); }
    .toast--exiting   { opacity: 0; transform: translateX(100%); }
    .toast--success   { border-color: var(--color-success); }
    .toast--error     { border-color: var(--color-danger); }
    .toast--warning   { border-color: var(--color-warning); }
    .toast--info      { border-color: var(--color-info); }
    .toast__icon {
      font-weight: bold; flex-shrink: 0; margin-top: 1px;
    }
    .toast--success .toast__icon { color: var(--color-success); }
    .toast--error   .toast__icon { color: var(--color-danger); }
    .toast--warning .toast__icon { color: var(--color-warning); }
    .toast--info    .toast__icon { color: var(--color-info); }
    .toast__message { flex: 1; font-size: var(--font-size-sm); color: var(--color-text-primary); line-height: 1.5; }
    .toast__close { color: var(--color-text-muted); padding: 0; font-size: 0.75rem; }
    @media (max-width: 480px) {
      .toast-container { bottom: 1rem; right: 1rem; left: 1rem; max-width: none; width: auto; }
    }
  `;
  document.head.appendChild(style);
}

export default { show, dismiss, dismissAll };
