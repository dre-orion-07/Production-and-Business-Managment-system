/**
 * @fileoverview BakeFlow ERP — app.js
 * Application entry point. Boot sequence:
 * 1. Check session → show login page if not authenticated
 * 2. On auth success → init storage + sidebar + navbar
 * 3. Register all module routes
 * 4. Init router (activates current hash)
 */

import storage    from './storage.js';
import auth       from './auth.js';
import loginPage  from './components/loginPage.js';
import { initRouter, register } from './router.js';
import { logger } from './utils.js';
import sidebar    from './components/sidebar.js';
import navbar     from './components/navbar.js';
import toast      from './components/toast.js';

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
// APP BOOT
// ─────────────────────────────────────────────────────────────────────────────

async function bootApp() {
  logger.info('BakeFlow ERP booting…');

  // 1. Preload all database collections into cache
  try {
    await storage.loadAllData();
  } catch (err) {
    logger.error('Failed to load database collections during boot', err);
    toast.show('error', 'Failed to load data from the server. Please refresh the page.', 8000);
    return;
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

  if (sidebarEl) { sidebar.init(sidebarEl); }
  if (navbarEl)  { navbar.init(navbarEl); }

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
  if (bootLoader) { bootLoader.remove(); }

  // 6. Init router (activates current hash route)
  initRouter(appEl);

  // 7. Listen for auth-required events (session expired mid-session)
  window.addEventListener('bakeflow:auth-required', () => {
    toast.show('warning', 'Your session has expired. Please log in again.', 5000);
    setTimeout(() => {
      location.reload(); // Re-trigger the auth check on next boot
    }, 2000);
  });

  logger.info('BakeFlow ERP ready');
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT — Auth gate before boot
// ─────────────────────────────────────────────────────────────────────────────

async function start() {
  console.log('[BakeFlow Boot] Initializing application startup sequence...');
  const appShell = document.getElementById('app-shell');
  const appEl    = document.getElementById('app');

  // Remove boot loader immediately (login page handles its own loading)
  const bootLoader = document.getElementById('boot-loader');
  if (bootLoader) {
    console.log('[BakeFlow Boot] Removing temporary boot-loader element');
    bootLoader.remove();
  }

  let isAuthenticated = false;
  console.log('[BakeFlow Boot] Verifying session with backend /api/auth/me...');
  try {
    isAuthenticated = await auth.checkSession();
    console.log(`[BakeFlow Boot] Session check completed. Authenticated: ${isAuthenticated}`);
  } catch (err) {
    logger.warn('Could not reach server. Is the backend running?', err);
    console.error('[BakeFlow Boot] Network/Server connection failed during auth check:', err);
    // Show a clear error rather than the login page
    if (appEl) {
      appEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:1rem;text-align:center;padding:2rem;">
          <span style="font-size:3rem">🔌</span>
          <h2 style="color:var(--color-text-primary)">Cannot reach server</h2>
          <p style="color:var(--color-text-muted);max-width:380px">
            BakeFlow ERP needs the backend server to be running.<br>
            Start it with <code style="background:var(--color-bg-surface);padding:2px 6px;border-radius:4px">npm run server</code>
            then refresh this page.
          </p>
          <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;border-radius:6px;background:var(--color-primary,#6366f1);color:#fff;border:none;cursor:pointer;font-size:1rem">Retry</button>
        </div>
      `;
    }
    return;
  }

  if (!isAuthenticated) {
    console.log('[BakeFlow Boot] User is not authenticated. Preparing login/signup page...');
    // Render login page — hide the main app shell chrome (sidebar/navbar) via CSS
    if (appShell)  {
      console.log('[BakeFlow Boot] Adding "auth-mode" class to app-shell');
      appShell.classList.add('auth-mode');
    }
    if (appEl) {
      console.log('[BakeFlow Boot] Rendering login/signup screen in #app container');
      appEl.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      loginPage.render(appEl, async () => {
        console.log('[BakeFlow Boot] Login successful. Restoring standard app chrome...');
        // Auth succeeded — restore layout and boot the app
        if (appShell)  {
          appShell.classList.remove('auth-mode');
        }
        document.body.style.overflow = '';
        console.log('[BakeFlow Boot] Complete booting of main app modules...');
        await bootApp();
      });
    }
    return;
  }

  // Already authenticated — boot directly
  console.log('[BakeFlow Boot] User is already authenticated. Booting main app directly...');
  await bootApp();
}

start().catch(err => {
  logger.error('Fatal boot error', err);
  console.error('[BakeFlow Boot] Fatal startup failure:', err);
});
