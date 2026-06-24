/**
 * @fileoverview Jest setupFilesAfterEnv — runs AFTER Jest framework is installed.
 * Safe to use beforeEach, afterEach, etc. here.
 */

// Clear localStorage before every test to ensure isolation
beforeEach(() => {
  localStorage.clear();
});
