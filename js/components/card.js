/**
 * @fileoverview BakeFlow ERP — card.js
 * Metric card component for the dashboard.
 * Returns a DOM element — does not mount itself.
 */

/**
 * Creates a metric card element.
 * @param {{
 *   label: string,
 *   value: string,
 *   subValue?: string,
 *   icon?: string,
 *   trend?: 'up' | 'down' | 'neutral',
 *   trendLabel?: string,
 *   variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
 * }} config
 * @returns {HTMLElement}
 */
function create(config) {
  const { label, value, subValue, icon, trend, trendLabel, variant = 'default' } = config;

  const card = document.createElement('div');
  card.className = `metric-card metric-card--${variant}`;

  // Icon
  if (icon) {
    const iconEl = document.createElement('div');
    iconEl.className = 'metric-card__icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = icon;
    card.appendChild(iconEl);
  }

  // Label
  const labelEl = document.createElement('p');
  labelEl.className = 'metric-card__label';
  labelEl.textContent = label;
  card.appendChild(labelEl);

  // Value
  const valueEl = document.createElement('p');
  valueEl.className = 'metric-card__value';
  valueEl.textContent = value;
  card.appendChild(valueEl);

  // Sub-value / trend
  if (subValue || (trend && trendLabel)) {
    const sub = document.createElement('p');
    sub.className = 'metric-card__sub';
    if (trend && trendLabel) {
      const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
      sub.className += ` metric-card__sub--${trend}`;
      sub.textContent = `${trendIcon} ${trendLabel}`;
    } else {
      sub.textContent = subValue || '';
    }
    card.appendChild(sub);
  }

  return card;
}

/**
 * Updates an existing metric card's value and optional sub-value in place.
 * @param {HTMLElement} cardEl
 * @param {{ value?: string, subValue?: string, variant?: string }} updates
 */
function update(cardEl, updates) {
  if (updates.value !== undefined) {
    const valueEl = cardEl.querySelector('.metric-card__value');
    if (valueEl) valueEl.textContent = updates.value;
  }
  if (updates.subValue !== undefined) {
    const sub = cardEl.querySelector('.metric-card__sub');
    if (sub) sub.textContent = updates.subValue;
  }
  if (updates.variant) {
    cardEl.className = cardEl.className.replace(/metric-card--\S+/, `metric-card--${updates.variant}`);
  }
}

// Card styles
if (!document.getElementById('bakeflow-card-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-card-styles';
  style.textContent = `
    .metric-card {
      background: var(--color-bg-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-xl); padding: 1.25rem;
      display: flex; flex-direction: column; gap: 0.25rem;
      box-shadow: var(--shadow-sm); transition: box-shadow var(--transition-fast);
    }
    .metric-card:hover { box-shadow: var(--shadow-md); }
    .metric-card__icon { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .metric-card__label {
      font-size: var(--font-size-xs); font-weight: var(--font-weight-medium);
      color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;
    }
    .metric-card__value {
      font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);
      color: var(--color-text-primary); line-height: 1.2;
    }
    .metric-card__sub { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .metric-card__sub--up   { color: var(--color-success); }
    .metric-card__sub--down { color: var(--color-danger); }

    .metric-card--success { border-color: var(--color-success); }
    .metric-card--success .metric-card__value { color: var(--color-success); }
    .metric-card--warning { border-color: var(--color-warning); }
    .metric-card--warning .metric-card__value { color: var(--color-warning); }
    .metric-card--danger  { border-color: var(--color-danger); }
    .metric-card--danger  .metric-card__value { color: var(--color-danger); }
    .metric-card--brand   { border-color: var(--color-brand-primary); }
    .metric-card--brand   .metric-card__value { color: var(--color-brand-primary); }
  `;
  document.head.appendChild(style);
}

export default { create, update };
