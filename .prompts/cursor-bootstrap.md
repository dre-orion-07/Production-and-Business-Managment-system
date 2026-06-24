# Cursor — BakeFlow ERP Bootstrap Prompt

## What Is This Project?
BakeFlow ERP is a browser-only, offline-capable bakery management system built
with vanilla JavaScript (ES6+ modules), custom CSS, and localStorage. No frameworks,
no build step, no server.

## How Cursor Should Work in This Repo

### Always Available Context
Cursor should index and reference these files for every completion:
- `.kb/03-architecture.md` — data models and save flows
- `.kb/05-hallucination-traps.md` — common mistakes to avoid
- `.rules/03-forbidden-patterns.mdc` — patterns that must never appear

### File Ownership Rules
| File | Who Can Write to It |
|---|---|
| `js/storage.js` | Only this file touches localStorage |
| `js/utils.js` | Pure helpers only — no DOM, no storage |
| `js/modules/*.js` | Module logic + DOM rendering |
| `js/components/*.js` | Reusable UI — no business logic |

### Autocomplete Hints
When completing code in `js/modules/`:
- Suggest `storage.*` calls, not raw `localStorage`
- Suggest `toast.show()` for user feedback
- Suggest `modal.confirm()` for destructive actions
- Suggest `parseFloat((x * y).toFixed(3))` for ingredient arithmetic

### Quick Reference — Key localStorage Keys
| Key | Content |
|---|---|
| `BF_BATCH_MIXES` | `BatchMix[]` |
| `BF_PRODUCTIONS` | `Production[]` |
| `BF_FINISHED_INVENTORY` | `FinishedInventory[]` (one per day) |
| `BF_SALES` | `Sale[]` |
| `BF_CUSTOMERS` | `Customer[]` |
| `BF_EXPENSES` | `Expense[]` |
| `BF_DAILY_HISTORY` | `DailyHistory[]` |
| `BF_SETTINGS` | `Settings` |
| `BF_INGREDIENT_STOCK` | `Record<string, { amount, unit }>` |
| `BF_RECEIPT_COUNTER` | `number` (never reset) |
| `BF_BACKUPS` | last 5 serialised backups |

### Module Init Pattern
Every new module must follow this skeleton:
```js
import storage from '../storage.js';
import { formatCurrency, toYYYYMMDD } from '../utils.js';
import toast from '../components/toast.js';
import modal from '../components/modal.js';

/** @type {AbortController} */
let controller;

export default {
  init(container) {
    controller = new AbortController();
    render(container);
    attachListeners(container, controller.signal);
  },
  destroy() {
    controller?.abort();
  }
};
```

### Running Tests
```bash
npm test
npm run test:watch
npm run lint
```
