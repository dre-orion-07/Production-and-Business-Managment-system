/**
 * @fileoverview BakeFlow ERP — sidebar.js
 * Navigation sidebar with active route highlighting.
 * Listens for bakeflow:route-changed events from router.js.
 */

import { navigate } from '../router.js';

const NAV_ITEMS = [
  { path: '/dashboard',         label: 'Dashboard',       icon: '📊' },
  { path: '/batch-mixes',       label: 'Batch Mixes',     icon: '🧪' },
  { path: '/production',        label: 'Production',      icon: '🍞' },
  { path: '/inventory',         label: 'Ingredients',     icon: '🌾' },
  { path: '/finished-inventory',label: 'Bread Stock',     icon: '📦' },
  { path: '/sales',             label: 'Sales (POS)',     icon: '🛒' },
  { path: '/customers',         label: 'Customers',       icon: '👥' },
  { path: '/expenses',          label: 'Expenses',        icon: '💸' },
  { path: '/daily-history',     label: 'Daily History',   icon: '📅' },
  { path: '/reports',           label: 'Reports',         icon: '📈' },
  { path: '/settings',          label: 'Settings',        icon: '⚙️'  }
];

/** @type {AbortController|null} */
let controller = null;

/**
 * Initialises the sidebar. Call from app.js after DOM is ready.
 * @param {HTMLElement} sidebarEl - The #sidebar element
 */
function init(sidebarEl) {
  controller = new AbortController();
  const { signal } = controller;

  sidebarEl.innerHTML = '';

  // Logo / Brand
  const brand = document.createElement('div');
  brand.className = 'sidebar__brand';
  brand.innerHTML = '<span class="sidebar__brand-icon" aria-hidden="true">🍞</span>' +
                    '<span class="sidebar__brand-name">BakeFlow</span>';
  sidebarEl.appendChild(brand);

  // Nav list
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Module navigation');
  const ul = document.createElement('ul');
  ul.className = 'sidebar__nav';

  for (const item of NAV_ITEMS) {
    const li   = document.createElement('li');
    li.className = 'sidebar__item';
    const link = document.createElement('a');
    link.className = 'sidebar__link';
    link.href      = `#${item.path}`;
    link.setAttribute('data-path', item.path);
    link.setAttribute('aria-label', item.label);

    const iconEl = document.createElement('span');
    iconEl.className = 'sidebar__icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = item.icon;

    const labelEl = document.createElement('span');
    labelEl.className = 'sidebar__label';
    labelEl.textContent = item.label;

    link.appendChild(iconEl);
    link.appendChild(labelEl);

    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.path);
      // Auto-close sidebar on mobile
      if (window.innerWidth < 768) {
        sidebarEl.classList.remove('is-open');
      }
    }, { signal });

    li.appendChild(link);
    ul.appendChild(li);
  }

  nav.appendChild(ul);
  sidebarEl.appendChild(nav);

  // Listen for route changes to update active state
  window.addEventListener('bakeflow:route-changed', (e) => {
    setActive(sidebarEl, e.detail.path);
  }, { signal });

  // Set initial active from current hash
  const hash = window.location.hash.replace('#', '') || '/dashboard';
  setActive(sidebarEl, hash);
}

/**
 * Updates the active link in the sidebar.
 * @param {HTMLElement} sidebarEl
 * @param {string} path
 */
function setActive(sidebarEl, path) {
  sidebarEl.querySelectorAll('.sidebar__link').forEach(link => {
    const linkPath = link.getAttribute('data-path');
    if (linkPath === path) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');
    }
  });
}

/**
 * Cleans up event listeners.
 */
function destroy() {
  controller?.abort();
  controller = null;
}

// Sidebar styles
if (!document.getElementById('bakeflow-sidebar-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-sidebar-styles';
  style.textContent = `
    .sidebar { overflow-y: auto; }
    .sidebar__brand {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1.25rem 1rem; border-bottom: 1px solid rgb(255 255 255 / 0.08);
      flex-shrink: 0;
    }
    .sidebar__brand-icon { font-size: 1.5rem; }
    .sidebar__brand-name {
      font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);
      color: #fff; letter-spacing: -0.02em;
    }
    .sidebar__nav { padding: 0.75rem 0; }
    .sidebar__item { list-style: none; }
    .sidebar__link {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.625rem 1rem; color: var(--color-text-sidebar);
      font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);
      text-decoration: none; border-radius: 0;
      transition: background-color var(--transition-fast), color var(--transition-fast);
      cursor: pointer;
    }
    .sidebar__link:hover,
    .sidebar__link:focus {
      background-color: rgb(255 255 255 / 0.06);
      color: #fff; outline: none;
    }
    .sidebar__link.is-active {
      background-color: var(--color-brand-primary);
      color: #fff;
    }
    .sidebar__icon { font-size: 1rem; flex-shrink: 0; width: 20px; text-align: center; }
    .sidebar__label { flex: 1; }
  `;
  document.head.appendChild(style);
}

export default { init, destroy, setActive };
