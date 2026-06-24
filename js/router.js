/**
 * @fileoverview BakeFlow ERP — router.js
 * Hash-based SPA router. Manages module lifecycle: init + destroy.
 */

import { logger } from './utils.js';

/** @type {Map<string, { init(container: HTMLElement): void, destroy(): void }>} */
const routes = new Map();

/** @type {{ init: Function, destroy: Function } | null} */
let currentModule = null;

/** @type {string} */
let currentRoute = '';

/** Mount point element */
let appContainer = null;

/**
 * Registers a route → module mapping.
 * @param {string} path                  - e.g. '/dashboard'
 * @param {{ init(c: HTMLElement): void, destroy(): void }} module
 */
export function register(path, module) {
  routes.set(path, module);
}

/**
 * Navigates to a route by updating the URL hash.
 * @param {string} path - e.g. '/sales'
 */
export function navigate(path) {
  window.location.hash = path;
}

/**
 * Activates the module for the given path.
 * Calls destroy() on the outgoing module, clears the container,
 * then calls init(container) on the incoming module.
 * @param {string} path
 */
function activate(path) {
  if (!appContainer) {
    logger.error('Router: #app container not found');
    return;
  }

  // Destroy outgoing module
  if (currentModule && typeof currentModule.destroy === 'function') {
    try { currentModule.destroy(); }
    catch (err) { logger.error('Router: error during module destroy', err); }
  }

  const module = routes.get(path) || routes.get('/dashboard');
  if (!module) {
    logger.warn('Router: no module registered for path', { path });
    appContainer.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'text-muted text-center mt-8';
    msg.textContent = `Page not found: ${path}`;
    appContainer.appendChild(msg);
    currentModule = null;
    currentRoute  = path;
    return;
  }

  // Clear container
  appContainer.innerHTML = '';
  currentModule = module;
  currentRoute  = path;

  // Update active state in sidebar
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bakeflow:route-changed', { detail: { path } }));
  }

  // Init incoming module
  try { module.init(appContainer); }
  catch (err) { logger.error('Router: error during module init', { path, err }); }

  logger.debug('Router: activated', { path });
}

/**
 * Parses the current hash and returns the path portion.
 * e.g. "#/sales" → "/sales"
 * @returns {string}
 */
function getHashPath() {
  const hash = window.location.hash || '';
  // Strip leading '#'
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  return path || '/dashboard';
}

/**
 * Handles hashchange events.
 */
function onHashChange() {
  activate(getHashPath());
}

/**
 * Initialises the router. Call once from app.js after modules are registered.
 * @param {HTMLElement} container - The #app mount point element
 */
export function initRouter(container) {
  appContainer = container;
  window.addEventListener('hashchange', onHashChange);
  // Activate the current hash on load
  activate(getHashPath());
}

/**
 * Removes the hashchange listener (for cleanup / testing).
 */
export function destroyRouter() {
  window.removeEventListener('hashchange', onHashChange);
  if (currentModule && typeof currentModule.destroy === 'function') {
    try { currentModule.destroy(); } catch (_) { /* noop */ }
  }
  currentModule = null;
}

/** Returns the currently active route path. */
export function getCurrentRoute() {
  return currentRoute;
}

export default { register, navigate, initRouter, destroyRouter, getCurrentRoute };
