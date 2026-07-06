/**
 * @fileoverview BakeFlow ERP — components/loginPage.js
 * Login / Signup UI rendered before the main app boots.
 * Matches the existing BakeFlow design system (CSS custom properties, dark/light theme).
 *
 * Public API: { render(container, onSuccess) }
 */

import auth from '../auth.js';
import { logger } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
if (!document.getElementById('bakeflow-login-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-login-styles';
  style.textContent = `
    .app-shell.auth-mode { display: block; }
    .app-shell.auth-mode .sidebar { display: none !important; }
    .app-shell.auth-mode .navbar { display: none !important; }
    .app-shell.auth-mode .main-wrapper { margin-left: 0 !important; }
    .app-shell.auth-mode .content { padding: 0 !important; max-width: none !important; }

    .login-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg);
      padding: 1rem;
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg, 0 10px 40px rgba(0,0,0,0.15));
      padding: 2.5rem 2rem;
      animation: loginFadeIn 0.35s ease;
    }

    @keyframes loginFadeIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .login-logo {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 1.75rem;
    }
    .login-logo__icon {
      font-size: 2rem;
      line-height: 1;
    }
    .login-logo__name {
      font-size: var(--font-size-xl, 1.25rem);
      font-weight: var(--font-weight-bold, 700);
      color: var(--color-text-primary);
      letter-spacing: -0.01em;
    }
    .login-logo__tag {
      font-size: var(--font-size-xs, 0.75rem);
      color: var(--color-text-muted);
      display: block;
      font-weight: var(--font-weight-normal, 400);
    }

    .login-tabs {
      display: flex;
      border-bottom: 2px solid var(--color-border);
      margin-bottom: 1.5rem;
    }
    .login-tab {
      flex: 1;
      background: none;
      border: none;
      padding: 0.6rem 0;
      cursor: pointer;
      font-size: var(--font-size-sm, 0.875rem);
      font-weight: var(--font-weight-medium, 500);
      color: var(--color-text-muted);
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: color 0.15s, border-color 0.15s;
    }
    .login-tab.active {
      color: var(--color-primary, #6366f1);
      border-bottom-color: var(--color-primary, #6366f1);
    }

    .login-form { display: flex; flex-direction: column; gap: 1rem; }

    .login-error {
      background: rgb(239 68 68 / 0.1);
      border: 1px solid var(--color-danger, #ef4444);
      border-radius: var(--radius-md, 6px);
      padding: 0.6rem 0.875rem;
      font-size: var(--font-size-sm, 0.875rem);
      color: var(--color-danger, #ef4444);
      display: none;
    }
    .login-error.visible { display: block; }

    .login-submit {
      width: 100%;
      padding: 0.75rem;
      background: var(--color-primary, #6366f1);
      color: #fff;
      border: none;
      border-radius: var(--radius-md, 6px);
      font-size: var(--font-size-base, 1rem);
      font-weight: var(--font-weight-semibold, 600);
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
      margin-top: 0.25rem;
    }
    .login-submit:hover:not(:disabled) { opacity: 0.9; }
    .login-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .login-footer {
      text-align: center;
      font-size: var(--font-size-xs, 0.75rem);
      color: var(--color-text-muted);
      margin-top: 1.25rem;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the login/signup page into the given container.
 * @param {HTMLElement} container
 * @param {() => void} onSuccess - callback fired when auth succeeds
 */
function render(container, onSuccess) {
  container.innerHTML = '';
  container.className = 'login-shell';

  const card = document.createElement('div');
  card.className = 'login-card';
  card.innerHTML = `
    <div class="login-logo">
      <span class="login-logo__icon" aria-hidden="true">🍞</span>
      <div>
        <span class="login-logo__name">BakeFlow ERP</span>
        <span class="login-logo__tag">Bakery Management System</span>
      </div>
    </div>
    <div class="login-tabs" role="tablist" aria-label="Login or Signup">
      <button class="login-tab active" id="tab-login" role="tab" aria-selected="true"  aria-controls="panel-login">Log In</button>
      <button class="login-tab"        id="tab-signup" role="tab" aria-selected="false" aria-controls="panel-signup">Create Account</button>
    </div>
    <div id="login-error" class="login-error" role="alert" aria-live="polite"></div>
    <div id="panel-login"  role="tabpanel" aria-labelledby="tab-login"></div>
    <div id="panel-signup" role="tabpanel" aria-labelledby="tab-signup" hidden></div>
    <p class="login-footer">Your data is stored securely in the cloud and accessible from any device.</p>
  `;

  container.appendChild(card);

  const tabLogin  = card.querySelector('#tab-login');
  const tabSignup = card.querySelector('#tab-signup');
  const panelLogin  = card.querySelector('#panel-login');
  const panelSignup = card.querySelector('#panel-signup');
  const errorEl     = card.querySelector('#login-error');

  // ── Build login form ──────────────────────────────────────────────────
  panelLogin.innerHTML = `
    <form class="login-form" id="login-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="login-email">Email Address</label>
        <input id="login-email" class="form-input" type="email" autocomplete="email"
               placeholder="you@example.com" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="login-password">Password</label>
        <input id="login-password" class="form-input" type="password" autocomplete="current-password"
               placeholder="••••••••" required />
      </div>
      <button type="submit" class="login-submit" id="login-btn">Log In</button>
    </form>
  `;

  // ── Build signup form ─────────────────────────────────────────────────
  panelSignup.innerHTML = `
    <form class="login-form" id="signup-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="signup-bakery">Bakery Name</label>
        <input id="signup-bakery" class="form-input" type="text"
               placeholder="e.g. Sunrise Bakery" value="BakeFlow Bakery" />
      </div>
      <div class="form-group">
        <label class="form-label" for="signup-email">Email Address</label>
        <input id="signup-email" class="form-input" type="email" autocomplete="email"
               placeholder="you@example.com" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="signup-password">Password <span class="text-muted">(min. 6 chars)</span></label>
        <input id="signup-password" class="form-input" type="password" autocomplete="new-password"
               placeholder="••••••••" required minlength="6" />
      </div>
      <button type="submit" class="login-submit" id="signup-btn">Create Account</button>
    </form>
  `;

  // ── Tab switching ─────────────────────────────────────────────────────
  function showTab(tab) {
    const isLogin = tab === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabSignup.classList.toggle('active', !isLogin);
    tabLogin.setAttribute('aria-selected',  String(isLogin));
    tabSignup.setAttribute('aria-selected', String(!isLogin));
    panelLogin.hidden  = !isLogin;
    panelSignup.hidden = isLogin;
    clearError();
  }

  tabLogin.addEventListener('click',  () => showTab('login'));
  tabSignup.addEventListener('click', () => showTab('signup'));

  // ── Error display ─────────────────────────────────────────────────────
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }
  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  // ── Login submit ──────────────────────────────────────────────────────
  card.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const email    = card.querySelector('#login-email').value.trim();
    const password = card.querySelector('#login-password').value;
    const btn      = card.querySelector('#login-btn');

    if (!email || !password) { showError('Please enter your email and password.'); return; }

    btn.disabled  = true;
    btn.textContent = 'Logging in…';
    try {
      await auth.login(email, password);
      onSuccess();
    } catch (err) {
      logger.error('Login failed', err);
      showError(err.message || 'Login failed. Please try again.');
    } finally {
      btn.disabled   = false;
      btn.textContent = 'Log In';
    }
  });

  // ── Signup submit ─────────────────────────────────────────────────────
  card.querySelector('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const bakeryName = card.querySelector('#signup-bakery').value.trim();
    const email      = card.querySelector('#signup-email').value.trim();
    const password   = card.querySelector('#signup-password').value;
    const btn        = card.querySelector('#signup-btn');

    if (!email || !password) { showError('Please fill in all required fields.'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Creating account…';
    try {
      await auth.signup(email, password, bakeryName);
      onSuccess();
    } catch (err) {
      logger.error('Signup failed', err);
      showError(err.message || 'Signup failed. Please try again.');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Create Account';
    }
  });
}

export default { render };
