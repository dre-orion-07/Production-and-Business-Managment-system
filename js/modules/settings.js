/**
 * @fileoverview BakeFlow ERP — settings.js
 * App configuration, ingredient unit costs, and data backup/restore.
 * Backup: single-click JSON export. Restore: import with validation.
 * Auto-backups: last 5 kept automatically.
 *
 * Public API: { init(container), destroy() }
 */

import storage from '../storage.js';
import modal   from '../components/modal.js';
import toast   from '../components/toast.js';
import {
  formatDateTime, logger
} from '../utils.js';

/** @type {AbortController|null} */
let controller = null;

// ─────────────────────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
function init(container) {
  controller = new AbortController();
  render(container);
}

function destroy() {
  controller?.abort();
  controller = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 */
function render(container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div>
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Configure your bakery profile, ingredient costs, and manage data backups.</p>
    </div>
  `;
  container.appendChild(header);

  const settingsLayout = document.createElement('div');
  settingsLayout.className = 'settings-layout';
  container.appendChild(settingsLayout);

  // Left column: bakery profile + ingredient costs
  const left = document.createElement('div');
  left.className = 'settings-col';
  settingsLayout.appendChild(left);

  // Right column: backup/restore + storage info
  const right = document.createElement('div');
  right.className = 'settings-col';
  settingsLayout.appendChild(right);

  renderBakeryProfileSection(left, container);
  renderIngredientCostsSection(left, container);
  renderBackupSection(right, container);
  renderStorageSection(right);
  renderAutoBackupsSection(right, container);
}

// ─────────────────────────────────────────────────────────────────────────────
// BAKERY PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} col
 * @param {HTMLElement} pageContainer
 */
function renderBakeryProfileSection(col, _pageContainer) {
  const settings = storage.getSettings();
  const section  = createSettingsCard('🏪 Bakery Profile');
  col.appendChild(section);

  const form = document.createElement('form');
  form.className = 'settings-form';
  form.noValidate = true;

  form.innerHTML = `
    <div class="form-group">
      <label class="form-label required" for="shop-name">Shop Name</label>
      <input id="shop-name" type="text" class="form-input" value="${escHtml(settings.shopName || '')}" placeholder="BakeFlow Bakery" required />
    </div>
    <div class="form-group">
      <label class="form-label" for="shop-address">Address</label>
      <input id="shop-address" type="text" class="form-input" value="${escHtml(settings.address || '')}" placeholder="123 Baker Street" />
    </div>
    <div class="form-group">
      <label class="form-label" for="shop-phone">Phone Number</label>
      <input id="shop-phone" type="tel" class="form-input" value="${escHtml(settings.phone || '')}" placeholder="08012345678" />
    </div>
    <div class="form-group">
      <label class="form-label" for="shop-theme">Theme</label>
      <select id="shop-theme" class="form-select">
        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
        <option value="dark"  ${settings.theme === 'dark'  ? 'selected' : ''}>Dark</option>
      </select>
    </div>
  `;

  // Theme live preview
  form.querySelector('#shop-theme').addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
  }, { signal: controller.signal });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save Profile';
  saveBtn.addEventListener('click', () => {
    const name = form.querySelector('#shop-name').value.trim();
    if (!name) { toast.show('error', 'Shop name is required.'); return; }
    try {
      storage.saveSettings({
        shopName: name,
        address:  form.querySelector('#shop-address').value.trim(),
        phone:    form.querySelector('#shop-phone').value.trim(),
        theme:    form.querySelector('#shop-theme').value
      });
      toast.show('success', 'Profile saved.');
    } catch (err) {
      toast.show('error', err.message || 'Failed to save settings.');
    }
  }, { signal: controller.signal });

  form.appendChild(saveBtn);
  section.appendChild(form);
}

// ─────────────────────────────────────────────────────────────────────────────
// INGREDIENT COSTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} col
 * @param {HTMLElement} pageContainer
 */
function renderIngredientCostsSection(col, _pageContainer) {
  const settings   = storage.getSettings();
  const unitCosts  = settings.unitCosts || {};

  const section = createSettingsCard('💰 Ingredient Unit Costs');
  col.appendChild(section);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.textContent = 'Set the cost per unit for each ingredient. Used to calculate production cost. Leave at 0 if unknown.';
  section.appendChild(hint);

  const form = document.createElement('form');
  form.className = 'settings-form';
  form.noValidate = true;

  const grid = document.createElement('div');
  grid.className = 'ingredient-costs-grid';

  const keys   = storage.getIngredientKeys();
  const labels = storage.getIngredientLabels();
  const units  = storage.getIngredientUnits();

  for (const key of keys) {
    const unit    = units[key];
    const current = unitCosts[key] ?? 0;

    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label class="form-label" for="cost-${key}">
        ${labels[key]}
        <span class="form-unit text-muted">(₦ per ${unit})</span>
      </label>
      <input id="cost-${key}" name="${key}" type="number"
             class="form-input" min="0" step="0.01" value="${current}" />
    `;
    grid.appendChild(group);
  }
  form.appendChild(grid);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save Costs';
  saveBtn.addEventListener('click', () => {
    const newCosts = {};
    for (const key of keys) {
      const val = parseFloat(form.querySelector(`#cost-${key}`)?.value);
      newCosts[key] = isNaN(val) || val < 0 ? 0 : val;
    }
    try {
      storage.saveSettings({ unitCosts: newCosts });
      toast.show('success', 'Ingredient costs saved. Production cost calculations updated.');
    } catch (err) {
      toast.show('error', err.message || 'Failed to save costs.');
    }
  }, { signal: controller.signal });

  form.appendChild(saveBtn);
  section.appendChild(form);
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP / RESTORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} col
 * @param {HTMLElement} pageContainer
 */
function renderBackupSection(col, pageContainer) {
  const section = createSettingsCard('💾 Backup & Restore');
  col.appendChild(section);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.textContent = 'Export all data as a JSON file for safekeeping. Import to restore on any device.';
  section.appendChild(hint);

  // ── Export ───────────────────────────────────────────────────────────────
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-primary';
  exportBtn.innerHTML = '⬇️ Export Full Backup';
  exportBtn.addEventListener('click', () => {
    try {
      const json     = storage.exportBackup();
      const dateStr  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `bakeflow-backup-${dateStr}.json`;
      const blob     = new Blob([json], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      toast.show('success', `Backup exported: ${filename}`);
    } catch (err) {
      logger.error('Export failed', err);
      toast.show('error', err.message || 'Export failed.');
    }
  }, { signal: controller.signal });
  section.appendChild(exportBtn);

  // ── Import ───────────────────────────────────────────────────────────────
  const importLabel = document.createElement('label');
  importLabel.className = 'btn btn-secondary import-btn-label';
  importLabel.innerHTML = '⬆️ Import Backup';

  const fileInput = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    modal.confirm(
      `⚠️ Importing "${file.name}" will OVERWRITE all current data. This cannot be undone. Are you sure?`,
      () => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            storage.importBackup(ev.target.result);
            toast.show('success', 'Backup imported successfully. Refreshing…');
            setTimeout(() => render(pageContainer), 800);
          } catch (err) {
            logger.error('Import failed', err);
            toast.show('error', err.message || 'Import failed. Check the file format.');
          }
        };
        reader.onerror = () => toast.show('error', 'Failed to read file.');
        reader.readAsText(file);
      },
      () => { fileInput.value = ''; },
      'Confirm Data Import',
      'Yes, Overwrite All Data',
      'danger'
    );
    // Reset so same file can be selected again
    fileInput.value = '';
  }, { signal: controller.signal });

  importLabel.appendChild(fileInput);
  section.appendChild(importLabel);
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE INFO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} col
 */
function renderStorageSection(col) {
  const section = createSettingsCard('📦 Storage Usage');
  col.appendChild(section);

  const { usedBytes, limitBytes, warningLevel } = storage.getStorageUsage();
  const usedKB   = (usedBytes  / 1024).toFixed(1);
  const limitKB  = (limitBytes / 1024).toFixed(0);
  const usedPct  = ((usedBytes / limitBytes) * 100).toFixed(1);

  const statusCls = warningLevel === 'ok' ? 'text-success' : warningLevel === 'warning' ? 'text-warning' : 'text-danger';

  const info = document.createElement('div');
  info.innerHTML = `
    <div class="storage-bar-wrap">
      <div class="storage-bar">
        <div class="storage-bar__fill storage-bar__fill--${warningLevel}" style="width:${usedPct}%"></div>
      </div>
      <span class="${statusCls} font-semibold">${usedPct}% used</span>
    </div>
    <p class="settings-hint">${usedKB} KB of ~${limitKB} KB limit (localStorage)</p>
    <p class="settings-hint">
      Status: <strong class="${statusCls}">${warningLevel === 'ok' ? 'Healthy' : warningLevel === 'warning' ? 'Getting full — export a backup soon' : '⚠️ Critical — export backup immediately'}</strong>
    </p>
  `;
  section.appendChild(info);

  // Data counts
  const counts = [
    ['Batch Mixes',    storage.getBatchMixes().length],
    ['Productions',    storage.getProductions().length],
    ['Sales',          storage.getSales().length],
    ['Customers',      storage.getCustomers().length],
    ['Expenses',       storage.getExpenses().length],
    ['Daily History',  storage.getAllDailyHistory().length]
  ];

  const countsEl = document.createElement('div');
  countsEl.className = 'data-counts';
  countsEl.innerHTML = counts.map(([label, count]) =>
    `<div class="data-count-chip">
       <span class="data-count-chip__label">${label}</span>
       <span class="data-count-chip__value">${count}</span>
     </div>`
  ).join('');
  section.appendChild(countsEl);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-BACKUPS LIST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} col
 * @param {HTMLElement} pageContainer
 */
function renderAutoBackupsSection(col, pageContainer) {
  const backups = storage.getAutoBackups();
  const section = createSettingsCard(`🔄 Auto-Backups (${backups.length})`);
  col.appendChild(section);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.textContent = `The last ${backups.length} auto-backups are shown below (kept after each production, sale, and expense).`;
  section.appendChild(hint);

  if (backups.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-muted text-sm';
    p.textContent = 'No auto-backups yet. They are created automatically as you use the app.';
    section.appendChild(p);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'auto-backup-list';

  backups.forEach((backup, idx) => {
    const li = document.createElement('li');
    li.className = 'auto-backup-item';

    const time = formatDateTime(backup.timestamp);
    li.innerHTML = `
      <div class="auto-backup-item__info">
        <span class="auto-backup-item__index">#${backups.length - idx}</span>
        <span class="auto-backup-item__time">${time}</span>
      </div>
    `;

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn btn-ghost btn-sm';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => {
      modal.confirm(
        `Restore auto-backup from ${time}? This will overwrite all current data.`,
        () => {
          try {
            storage.importBackup(JSON.stringify({ exportedAt: backup.timestamp, version: '1.0', data: backup.data }));
            toast.show('success', 'Auto-backup restored successfully.');
            setTimeout(() => render(pageContainer), 500);
          } catch (err) {
            toast.show('error', err.message || 'Restore failed.');
          }
        },
        undefined,
        'Restore Auto-Backup',
        'Yes, Restore',
        'danger'
      );
    }, { signal: controller.signal });

    li.appendChild(restoreBtn);
    list.appendChild(li);
  });

  section.appendChild(list);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a settings card container.
 * @param {string} title
 * @returns {HTMLElement}
 */
function createSettingsCard(title) {
  const card = document.createElement('div');
  card.className = 'settings-card card';
  const h = document.createElement('h2');
  h.className = 'settings-card__title';
  h.textContent = title;
  card.appendChild(h);
  return card;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CSS
// ─────────────────────────────────────────────────────────────────────────────

if (!document.getElementById('bakeflow-settings-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-settings-styles';
  style.textContent = `
    .settings-layout {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;
    }
    @media (max-width: 768px) { .settings-layout { grid-template-columns: 1fr; } }

    .settings-col  { display: flex; flex-direction: column; gap: 1.25rem; }
    .settings-card {
      padding: 1.25rem; background: var(--color-bg-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm);
    }
    .settings-card__title {
      font-size: var(--font-size-base); font-weight: var(--font-weight-semibold);
      margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);
    }
    .settings-form { display: flex; flex-direction: column; gap: 0.875rem; }
    .settings-hint { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: 0.75rem; line-height: 1.5; }

    .ingredient-costs-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .ingredient-costs-grid .form-group { margin-bottom: 0; }
    .form-unit { font-weight: normal; font-size: var(--font-size-xs); }

    /* Backup buttons */
    .import-btn-label { cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; }

    /* Storage bar */
    .storage-bar-wrap { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
    .storage-bar {
      flex: 1; height: 12px; background: var(--color-border);
      border-radius: var(--radius-full); overflow: hidden;
    }
    .storage-bar__fill {
      height: 100%; border-radius: var(--radius-full); transition: width 0.3s ease;
    }
    .storage-bar__fill--ok       { background: var(--color-success); }
    .storage-bar__fill--warning  { background: var(--color-warning); }
    .storage-bar__fill--critical { background: var(--color-danger); }

    .data-counts { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .data-count-chip {
      display: flex; flex-direction: column; gap: 0.1rem;
      padding: 0.4rem 0.75rem; background: var(--color-bg);
      border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    }
    .data-count-chip__label { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .data-count-chip__value { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); }

    /* Auto-backup list */
    .auto-backup-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
    .auto-backup-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0.75rem; background: var(--color-bg);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
    }
    .auto-backup-item__info  { display: flex; gap: 0.75rem; align-items: center; }
    .auto-backup-item__index { font-weight: var(--font-weight-semibold); color: var(--color-text-muted); }
    .auto-backup-item__time  { color: var(--color-text-secondary); }

    .text-success  { color: var(--color-success); }
    .text-warning  { color: var(--color-warning); }
    .text-danger   { color: var(--color-danger); }
    .text-muted    { color: var(--color-text-muted); }
    .text-sm       { font-size: var(--font-size-sm); }
    .font-semibold { font-weight: var(--font-weight-semibold); }
    .card { background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }
  `;
  document.head.appendChild(style);
}

export default { init, destroy };
