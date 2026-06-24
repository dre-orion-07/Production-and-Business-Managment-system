/**
 * @fileoverview Jest setupFiles — runs BEFORE Jest framework is installed.
 * Only put environment setup here (no describe/it/beforeEach).
 */

// ─── localStorage mock ───────────────────────────────────────────────────────
const _store = {};

global.localStorage = {
  getItem:    (k)    => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem:    (k, v) => { _store[k] = String(v); },
  removeItem: (k)    => { delete _store[k]; },
  clear:      ()     => { Object.keys(_store).forEach(k => delete _store[k]); },
  get length()       { return Object.keys(_store).length; },
  key:        (i)    => Object.keys(_store)[i] ?? null
};

// ─── CustomEvent polyfill ─────────────────────────────────────────────────────
if (typeof global.CustomEvent === 'undefined') {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail ?? null;
    }
  };
}

// ─── window guard ─────────────────────────────────────────────────────────────
if (typeof global.window === 'undefined') {
  global.window = global;
}
if (global.window && !global.window.dispatchEvent) {
  global.window.dispatchEvent = () => true;
}
