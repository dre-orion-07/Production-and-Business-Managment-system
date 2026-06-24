/**
 * @fileoverview BakeFlow ERP — table.js
 * Reusable sortable/filterable table renderer.
 * Renders into a provided container element — no direct module imports.
 */

/**
 * Renders a data table into a container element.
 *
 * @param {HTMLElement} container
 * @param {{
 *   columns: Array<{
 *     key: string,
 *     label: string,
 *     sortable?: boolean,
 *     render?: (value: any, row: object) => string | HTMLElement
 *   }>,
 *   rows: object[],
 *   actions?: Array<{
 *     label: string,
 *     variant?: string,
 *     handler: (row: object) => void,
 *     show?: (row: object) => boolean
 *   }>,
 *   emptyMessage?: string,
 *   searchable?: boolean,
 *   searchKeys?: string[],
 *   id?: string
 * }} config
 */
function render(container, config) {
  const {
    columns, rows = [], actions = [],
    emptyMessage = 'No records found.',
    searchable = false, searchKeys = [],
    id = 'bf-table'
  } = config;

  container.innerHTML = '';

  // Search bar
  let filteredRows = [...rows];
  let searchQuery  = '';

  if (searchable) {
    const searchBar = document.createElement('div');
    searchBar.className = 'table-search-bar';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'form-input';
    searchInput.placeholder = 'Search…';
    searchInput.setAttribute('aria-label', 'Search table');
    searchInput.addEventListener('input', () => {
      searchQuery  = searchInput.value.toLowerCase().trim();
      filteredRows = searchQuery
        ? rows.filter(row =>
            searchKeys.some(key => String(row[key] ?? '').toLowerCase().includes(searchQuery))
          )
        : [...rows];
      renderTable();
    });
    searchBar.appendChild(searchInput);
    container.appendChild(searchBar);
  }

  // Sort state
  let sortKey = '';
  let sortAsc  = true;

  function getSortedRows() {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }

  let tableWrapper;

  function renderTable() {
    if (tableWrapper) tableWrapper.remove();

    tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    tableWrapper.style.overflowX = 'auto';

    const displayRows = getSortedRows();

    if (displayRows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const p = document.createElement('p');
      p.className = 'empty-state__title';
      p.textContent = emptyMessage;
      empty.appendChild(p);
      tableWrapper.appendChild(empty);
      container.appendChild(tableWrapper);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.id = id;

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of columns) {
      const th = document.createElement('th');
      th.className = 'data-table__th' + (col.sortable ? ' sortable' : '');
      th.scope = 'col';
      th.textContent = col.label;
      if (col.key === sortKey) {
        th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
        th.setAttribute('aria-sort', sortAsc ? 'ascending' : 'descending');
      }
      if (col.sortable) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          if (sortKey === col.key) { sortAsc = !sortAsc; }
          else { sortKey = col.key; sortAsc = true; }
          renderTable();
        });
      }
      headerRow.appendChild(th);
    }
    if (actions.length) {
      const th = document.createElement('th');
      th.className = 'data-table__th';
      th.scope = 'col';
      th.textContent = 'Actions';
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const row of displayRows) {
      const tr = document.createElement('tr');
      tr.className = 'data-table__row';
      for (const col of columns) {
        const td = document.createElement('td');
        td.className = 'data-table__td';
        const rawValue = row[col.key];
        if (col.render) {
          const rendered = col.render(rawValue, row);
          if (rendered instanceof HTMLElement) {
            td.appendChild(rendered);
          } else {
            td.innerHTML = String(rendered ?? '');
          }
        } else {
          td.textContent = rawValue ?? '—';
        }
        tr.appendChild(td);
      }
      if (actions.length) {
        const tdActions = document.createElement('td');
        tdActions.className = 'data-table__td data-table__td--actions';
        for (const action of actions) {
          if (action.show && !action.show(row)) continue;
          const btn = document.createElement('button');
          btn.className = `btn btn-sm btn-${action.variant || 'secondary'}`;
          btn.textContent = action.label;
          btn.addEventListener('click', () => action.handler(row));
          tdActions.appendChild(btn);
        }
        tr.appendChild(tdActions);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
  }

  renderTable();
}

// Table styles
if (!document.getElementById('bakeflow-table-styles')) {
  const style = document.createElement('style');
  style.id = 'bakeflow-table-styles';
  style.textContent = `
    .table-search-bar { margin-bottom: 1rem; }
    .table-search-bar .form-input { max-width: 280px; }
    .table-wrapper { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
    .data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .data-table__th {
      padding: 0.625rem 1rem; text-align: left; font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--color-text-secondary); background: var(--color-bg);
      border-bottom: 1px solid var(--color-border); white-space: nowrap;
    }
    .data-table__th.sortable:hover { color: var(--color-brand-primary); }
    .data-table__th.sort-asc::after  { content: ' ↑'; }
    .data-table__th.sort-desc::after { content: ' ↓'; }
    .data-table__td {
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border);
      color: var(--color-text-primary); vertical-align: middle;
    }
    .data-table__row:last-child .data-table__td { border-bottom: none; }
    .data-table__row:hover { background-color: var(--color-bg); }
    .data-table__td--actions { white-space: nowrap; display: flex; gap: 0.25rem; }
  `;
  document.head.appendChild(style);
}

export default { render };
