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
async function init(container) {
  controller = new AbortController();
  await render(container);
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
async function render(container) {
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

  // Right column: backup/restore + migration
  const right = document.createElement('div');
  right.className = 'settings-col';
  settingsLayout.appendChild(right);

  await renderBakeryProfileSection(left, container);
  await renderIngredientCostsSection(left, container);
  await renderBackupSection(right, container);
  renderMigrationSection(right, container);
}

// ─────────────────────────────────────────────────────────────────────────────
// BAKERY PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} col
 * @param {HTMLElement} pageContainer
 */
async function renderBakeryProfileSection(col, _pageContainer) {
  const settings = await storage.getSettings();
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
  saveBtn.addEventListener('click', async () => {
    const name = form.querySelector('#shop-name').value.trim();
    if (!name) { toast.show('error', 'Shop name is required.'); return; }
    try {
      await storage.saveSettings({
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
async function renderIngredientCostsSection(col, _pageContainer) {
  const settings   = await storage.getSettings();
  const unitCosts  = settings.unitCosts || {};

  const section = createSettingsCard('💰 Ingredient Unit Costs');
  col.appendChild(section);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.textContent = 'Set the cost per unit for each ingredient. Used to calculate production cost. Updating here also updates ingredient price history.';
  section.appendChild(hint);

  const form = document.createElement('form');
  form.className = 'settings-form';
  form.noValidate = true;

  const grid = document.createElement('div');
  grid.className = 'ingredient-costs-grid';

  const keys   = await storage.getIngredientKeys();
  const labels = await storage.getIngredientLabels();
  const units  = await storage.getIngredientUnits();

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
  saveBtn.addEventListener('click', async () => {
    const newCosts = {};
    for (const key of keys) {
      const val = parseFloat(form.querySelector(`#cost-${key}`)?.value);
      newCosts[key] = isNaN(val) || val < 0 ? 0 : val;
    }
    try {
      await storage.saveSettings({ unitCosts: newCosts });
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
async function renderBackupSection(col, pageContainer) {
  const section = createSettingsCard('💾 Backup & Restore');
  col.appendChild(section);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.textContent = 'Export all data from the cloud database as a JSON file for safekeeping. Import to restore on any device.';
  section.appendChild(hint);

  // ── Export ─────────────────────────────────────────────────────────────
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-primary';
  exportBtn.innerHTML = '⬇️ Export Full Backup';
  exportBtn.addEventListener('click', async () => {
    try {
      exportBtn.disabled    = true;
      exportBtn.textContent = 'Preparing…';
      await storage.exportBackup();   // opens a /api/settings/export download in a new tab
      toast.show('success', 'Backup download started.');
    } catch (err) {
      logger.error('Export failed', err);
      toast.show('error', err.message || 'Export failed.');
    } finally {
      exportBtn.disabled  = false;
      exportBtn.innerHTML = '⬇️ Export Full Backup';
    }
  }, { signal: controller.signal });
  section.appendChild(exportBtn);

  // ── Import (restore from a previously exported JSON) ───────────────────
  const importInput = document.createElement('input');
  importInput.type    = 'file';
  importInput.accept  = '.json';
  importInput.id      = 'settings-import-file';
  importInput.style.display = 'none';

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      modal.confirm(
        `⚠️ Importing "${file.name}" will OVERWRITE all current data. This cannot be undone. Are you sure?`,
        async () => {
          try {
            await storage.importBackup(evt.target.result);
            toast.show('success', 'Backup restored. Reloading…');
            setTimeout(() => location.reload(), 1200);
          } catch (err) {
            logger.error('Import failed', err);
            toast.show('error', err.message || 'Import failed. Check the file format.');
          }
        },
        () => { importInput.value = ''; },
        'Confirm Data Import',
        'Yes, Overwrite All Data',
        'danger'
      );
    };
    reader.onerror = () => toast.show('error', 'Failed to read file.');
    reader.readAsText(file);
    importInput.value = '';
  }, { signal: controller.signal });
  section.appendChild(importInput);

  const importLabel = document.createElement('label');
  importLabel.htmlFor    = 'settings-import-file';
  importLabel.className  = 'btn btn-secondary import-btn-label';
  importLabel.style.marginTop = '0.5rem';
  importLabel.innerHTML  = '⬆️ Import Cloud Backup';
  section.appendChild(importLabel);
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION TOOL — localStorage → MongoDB (one-time, optional)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the one-time localStorage-to-cloud migration card.
 * Only useful if the user has old data in their browser's localStorage
 * from before the backend was added.
 * @param {HTMLElement} col
 * @param {HTMLElement} pageContainer
 */
function renderMigrationSection(col, _pageContainer) {
  const section = createSettingsCard('🚚 Migrate Old Data');
  col.appendChild(section);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.innerHTML = `
    If you used BakeFlow before the cloud backend was set up, your old data is still
    in this browser's <code>localStorage</code>. Use this tool to import it into the cloud
    database — <strong>one time only</strong>.
    <br><br>
    After migration, your data will sync across all devices automatically.
  `;
  section.appendChild(hint);

  // Check if there's anything in localStorage to migrate
  const hasLegacyData = Object.keys(window.localStorage)
    .some(k => k.startsWith('BF_'));

  if (!hasLegacyData) {
    const ok = document.createElement('p');
    ok.style.cssText = 'color:var(--color-success);font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);';
    ok.textContent = '✅ No legacy localStorage data found — nothing to migrate.';
    section.appendChild(ok);
    return;
  }

  // Show what's available
  const legacyKeys = Object.keys(window.localStorage).filter(k => k.startsWith('BF_'));
  const preview = document.createElement('p');
  preview.className = 'settings-hint';
  preview.innerHTML = `Found <strong>${legacyKeys.length} keys</strong> in localStorage: <code>${legacyKeys.join(', ')}</code>`;
  section.appendChild(preview);

  const migrateBtn = document.createElement('button');
  migrateBtn.className  = 'btn btn-primary';
  migrateBtn.innerHTML  = '🚀 Migrate to Cloud';
  migrateBtn.addEventListener('click', () => {
    modal.confirm(
      'This will import all localStorage data into the cloud database. Existing cloud records with the same IDs will be replaced. Continue?',
      async () => {
        migrateBtn.disabled    = true;
        migrateBtn.textContent = 'Migrating…';
        try {
          // Build the v1 data object from localStorage
          const data = {};
          for (const key of legacyKeys) {
            try { data[key] = JSON.parse(window.localStorage.getItem(key)); }
            catch { data[key] = window.localStorage.getItem(key); }
          }
          const payload = JSON.stringify({ exportedAt: new Date().toISOString(), version: '1.0', data });
          await storage.importBackup(payload);
          toast.show('success', '✅ Migration complete! Your data is now in the cloud.', 6000);

          // Optionally clear localStorage after migration
          modal.confirm(
            'Migration successful! Do you want to clear the old localStorage data? (Recommended — it is now safely in the cloud.)',
            () => {
              for (const key of legacyKeys) { window.localStorage.removeItem(key); }
              toast.show('info', 'Old localStorage data cleared.');
              location.reload();
            },
            () => { location.reload(); },
            'Clear Old Data',
            'Yes, Clear localStorage',
            'warning'
          );
        } catch (err) {
          logger.error('Migration failed', err);
          toast.show('error', err.message || 'Migration failed. Check the console for details.');
        } finally {
          migrateBtn.disabled    = false;
          migrateBtn.innerHTML   = '🚀 Migrate to Cloud';
        }
      },
      undefined,
      'Confirm Migration',
      'Migrate',
      'primary'
    );
  }, { signal: controller.signal });
  section.appendChild(migrateBtn);
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
