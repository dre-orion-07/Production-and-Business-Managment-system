/**
 * @fileoverview BakeFlow ERP — navbar.js
 * Top navigation bar with theme toggle and mobile sidebar toggle.
 */

import storage from '../storage.js';
import auth    from '../auth.js';
import toast   from './toast.js';

/** @type {AbortController|null} */
let controller = null;

/**
 * Initialises the navbar.
 * @param {HTMLElement} navbarEl - The #navbar element
 */
function init(navbarEl) {
  controller = new AbortController();
  const { signal } = controller;

  navbarEl.innerHTML = '';

  // Mobile sidebar toggle
  const menuBtn = document.createElement('button');
  menuBtn.className = 'btn btn-ghost btn-icon navbar__menu-btn';
  menuBtn.setAttribute('aria-label', 'Toggle navigation menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-controls', 'sidebar');
  menuBtn.textContent = '☰';
  menuBtn.addEventListener('click', () => {
    const sidebar  = document.getElementById('sidebar');
    const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!expanded));
    sidebar?.classList.toggle('is-open', !expanded);
  }, { signal });

  // Page title (updates on route change)
  const titleEl = document.createElement('span');
  titleEl.className = 'navbar__title';
  titleEl.id = 'navbar-title';
  titleEl.textContent = 'BakeFlow ERP';

  // Spacer
  const spacer = document.createElement('div');
  spacer.className = 'flex-1';

  // Storage warning indicator
  const storageBtn = document.createElement('button');
  storageBtn.className = 'btn btn-ghost btn-icon navbar__storage-btn';
  storageBtn.setAttribute('aria-label', 'Storage status');
  storageBtn.textContent = '💾';
  storageBtn.addEventListener('click', () => {
    const { usedBytes, limitBytes, warningLevel } = storage.getStorageUsage();
    const usedKB = (usedBytes / 1024).toFixed(1);
    const limitKB = (limitBytes / 1024).toFixed(0);
    toast.show(
      warningLevel === 'ok' ? 'info' : warningLevel === 'warning' ? 'warning' : 'error',
      `Storage: ${usedKB} KB / ~${limitKB} KB used`
    );
  }, { signal });

  // Theme toggle button
  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn btn-ghost btn-icon navbar__theme-btn';
  themeBtn.setAttribute('aria-label', 'Toggle dark/light theme');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

  themeBtn.addEventListener('click', () => {
    const html     = document.documentElement;
    const isDark   = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    // Persist theme preference (async — non-critical)
    storage.saveSettings({ theme: newTheme }).catch(() => {});
  }, { signal });

  // Logout button
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-ghost btn-icon navbar__logout-btn';
  logoutBtn.setAttribute('aria-label', 'Log out');
  logoutBtn.textContent = '🔒';
  logoutBtn.title = `Log out${auth.getCurrentUser()?.email ? ` (${auth.getCurrentUser().email})` : ''}`;
  logoutBtn.addEventListener('click', async () => {
    try {
      await auth.logout();
      toast.show('success', 'Logged out successfully.');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.show('error', 'Logout failed. Please try again.');
    }
  }, { signal });

  navbarEl.appendChild(menuBtn);
  navbarEl.appendChild(titleEl);
  navbarEl.appendChild(spacer);
  navbarEl.appendChild(themeBtn);
  navbarEl.appendChild(logoutBtn);

  // Update title on route changes
  window.addEventListener('bakeflow:route-changed', (e) => {
    const label = _routeLabel(e.detail.path);
    titleEl.textContent = label;
    document.title = `${label} — BakeFlow ERP`;
  }, { signal });

  // Storage warning listener
  window.addEventListener('bakeflow:storage-warning', (e) => {
    const ratio = (e.detail.ratio * 100).toFixed(0);
    toast.show('warning', `Storage ${ratio}% full. Export a backup soon.`, 6000);
  }, { signal });

  // Apply persisted theme
  try {
    const settings = storage.getSettings();
    if (settings?.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
      themeBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
    }
  } catch (_) { /* non-critical */ }
}

/**
 * Maps a route path to a human-readable page title.
 * @param {string} path
 * @returns {string}
 */
function _routeLabel(path) {
  const map = {
    '/dashboard':          'Dashboard',
    '/batch-mixes':        'Batch Mixes',
    '/production':         'Production',
    '/inventory':          'Ingredient Stock',
    '/finished-inventory': 'Bread Stock',
    '/sales':              'Sales (POS)',
    '/customers':          'Customers',
    '/expenses':           'Expenses',
    '/daily-history':      'Daily History',
    '/reports':            'Reports',
    '/settings':           'Settings'
  };
  return map[path] || 'BakeFlow ERP';
}

/**
 * Cleans up event listeners.
 */
function destroy() {
  controller?.abort();
  controller = null;
}

// Navbar styles
if (!document.getElementById('bakeflow-navbar-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-navbar-styles';
  style.textContent = `
    .navbar__menu-btn { display: flex; }
    @media (min-width: 768px) { .navbar__menu-btn { display: none; } }
    .navbar__title {
      font-size: var(--font-size-base); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
    .navbar__theme-btn  { font-size: 1rem; }
    .navbar__logout-btn { font-size: 1rem; }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
