<!--
SELF-UPDATE PROTOCOL
────────────────────
When you modify any system behaviour, API contract, data model, business rule,
or architectural decision that contradicts information in this file, you MUST:
1. Update the relevant section in this file immediately.
2. Add an entry to .kb/08-change-log.md with date, author, and a one-line summary.
3. If the change introduces a new architectural decision, add an ADR to .kb/07-decisions-and-adr.md.
Failure to follow this protocol makes the knowledge base stale and causes AI hallucinations.
-->

# BakeFlow ERP — Coding Standards

## Language Rules
- ES6+ only — use `const`/`let`, arrow functions, template literals, destructuring, spread, optional chaining (`?.`), nullish coalescing (`??`)
- No `var`
- No TypeScript (vanilla JS) — use JSDoc for type hints
- Strict equality: always `===` and `!==`

## File & Module Conventions
- One module per file; file name matches module name (camelCase)
- All modules use ES `import`/`export`
- No global variables — export functions/objects explicitly
- Max file length: 400 lines; split into sub-modules if exceeded

## Naming Conventions
| Thing | Convention | Example |
|---|---|---|
| Variables | camelCase | `totalAmount` |
| Functions | camelCase | `calculateNetProfit()` |
| Classes | PascalCase | `StorageService` |
| Constants | SCREAMING_SNAKE | `MAX_BACKUP_COUNT` |
| CSS classes | kebab-case | `sales-card` |
| Data model keys | camelCase | `createdAt`, `breadType` |
| localStorage keys | SCREAMING_SNAKE with `BF_` prefix | `BF_BATCH_MIXES`, `BF_SALES` |

## JSDoc Requirements
All public functions and data models must have JSDoc:
```js
/**
 * Calculates net profit for a date range.
 * @param {string} startDate - ISO date string
 * @param {string} endDate   - ISO date string
 * @returns {{ grossProfit: number, netProfit: number, profitMargin: number }}
 */
function calculateNetProfit(startDate, endDate) { ... }
```

## Error Handling
- Wrap all storage operations in try/catch
- Surface user-facing errors through `toast.show('error', message)` — never use `alert()`
- Log errors through the structured logger, not `console.log`
- Never swallow errors silently

## Decimal Arithmetic Rule (Critical)
```js
// ❌ WRONG — floating point drift
const used = batch.flour.amount * numberOfMixes; // 9.5 * 3 = 28.499999...

// ✅ CORRECT — round to 3 decimal places after multiplication
const used = parseFloat((batch.flour.amount * numberOfMixes).toFixed(3));
```
Apply `toFixed(3)` after every multiplication involving ingredient amounts.

## DOM Manipulation
- Use `document.createElement` and `element.appendChild` — avoid `innerHTML` for user-supplied data (XSS risk)
- `innerHTML` is acceptable only for static, developer-controlled strings
- Always sanitise before inserting user input into DOM

## CSS Rules
- No inline styles — use CSS classes
- Use CSS custom properties for all colours, spacing, and font sizes
- Mobile-first: base styles for mobile, `@media (min-width: 768px)` for desktop
- Dark/light theme via `data-theme="dark"` on `<html>`

## Event Listeners
- Remove event listeners in `module.destroy()` to prevent memory leaks
- Use event delegation on container elements where possible

## Storage Access
```js
// ❌ WRONG — direct localStorage access
localStorage.setItem('sales', JSON.stringify(sales));

// ✅ CORRECT — always through storage module
import storage from '../storage.js';
storage.saveSale(sale);
```

## No alert() / confirm()
```js
// ❌ WRONG
if (confirm('Delete this record?')) { ... }

// ✅ CORRECT
import modal from '../components/modal.js';
modal.confirm('Delete this record?', () => { ... });
```

## Logger Usage
```js
// ❌ WRONG
console.log('Sale saved', sale);

// ✅ CORRECT
import logger from '../utils.js';
logger.info('Sale saved', { id: sale.id, amount: sale.totalAmount });
```

## Immutability in Data Updates
Always create a new object rather than mutating in place:
```js
// ❌ WRONG
customer.outstanding -= payment;

// ✅ CORRECT
const updated = { ...customer, outstanding: recalculateOutstanding(customer) };
storage.updateCustomer(customer.id, updated);
```
