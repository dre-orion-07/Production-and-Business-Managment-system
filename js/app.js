/**
 * @fileoverview BakeFlow ERP — app.js
 * Application entry point. Boot sequence:
 * 1. Init storage + seed data
 * 2. Init sidebar + navbar
 * 3. Register all module routes
 * 4. Init router (activates current hash)
 */

import storage from './storage.js';
import { initRouter, register } from './router.js';
import { logger } from './utils.js';
import sidebar from './components/sidebar.js';
import navbar  from './components/navbar.js';
import toast   from './components/toast.js';

// ─────────────────────────────────────────────────────────────────────────────
// LAZY MODULE LOADERS
// Each module is imported only when its route is first activated.
// This keeps initial load fast even as the codebase grows.
// ─────────────────────────────────────────────────────────────────────────────

/** Creates a lazy-loading module wrapper. */
function lazyModule(importFn) {
  let resolved = null;
  return {
    async init(container) {
      if (!resolved) {
        try {
          const mod = await importFn();
          resolved = mod.default;
        } catch (err) {
          logger.error('Failed to load module', err);
          container.innerHTML = '';
          const p = document.createElement('p');
          p.className = 'text-danger text-center mt-8';
          p.textContent = 'Failed to load this page. Please refresh.';
          container.appendChild(p);
          return;
        }
      }
      resolved.init(container);
    },
    destroy() {
      resolved?.destroy?.();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

async function boot() {
  logger.info('BakeFlow ERP booting…');

  // 1. Seed data on first run
  try {
    storage.seedInitialData();
  } catch (err) {
    logger.error('Failed to seed initial data', err);
  }

  // 2. Apply persisted theme before render (prevents flash)
  try {
    const settings = storage.getSettings();
    if (settings?.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  } catch (_) { /* non-critical */ }

  // 3. Init sidebar and navbar
  const sidebarEl = document.getElementById('sidebar');
  const navbarEl  = document.getElementById('navbar');
  const appEl     = document.getElementById('app');

  if (!appEl) {
    logger.error('Boot failed: #app element not found');
    return;
  }

  if (sidebarEl) {sidebar.init(sidebarEl);}
  if (navbarEl)  {navbar.init(navbarEl);}

  // 4. Register routes
  register('/dashboard',          lazyModule(() => import('./modules/dashboard.js')));
  register('/batch-mixes',        lazyModule(() => import('./modules/batchMixes.js')));
  register('/production',         lazyModule(() => import('./modules/production.js')));
  register('/inventory',          lazyModule(() => import('./modules/inventory.js')));
  register('/finished-inventory', lazyModule(() => import('./modules/finishedInventory.js')));
  register('/sales',              lazyModule(() => import('./modules/sales.js')));
  register('/customers',          lazyModule(() => import('./modules/customers.js')));
  register('/expenses',           lazyModule(() => import('./modules/expenses.js')));
  register('/daily-history',      lazyModule(() => import('./modules/dailyHistory.js')));
  register('/reports',            lazyModule(() => import('./modules/reports.js')));
  register('/settings',           lazyModule(() => import('./modules/settings.js')));

  // 5. Remove boot loader
  const bootLoader = document.getElementById('boot-loader');
  if (bootLoader) {bootLoader.remove();}

  // 6. Init router (activates current hash route)
  initRouter(appEl);

  // 7. Check storage on boot
  try {
    const { warningLevel, usedBytes } = storage.getStorageUsage();
    if (warningLevel !== 'ok') {
      const kb = (usedBytes / 1024).toFixed(0);
      toast.show(
        warningLevel === 'critical' ? 'error' : 'warning',
        `Storage is ${warningLevel}: ~${kb} KB used. Export a backup soon.`,
        8000
      );
    }
  } catch (_) { /* non-critical */ }

  logger.info('BakeFlow ERP ready');
}

// Start
boot().catch(err => {
  logger.error('Fatal boot error', err);
});
