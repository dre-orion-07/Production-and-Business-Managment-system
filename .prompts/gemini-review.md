# Gemini — BakeFlow ERP Code Review Prompt

## Role
You are performing a code review for BakeFlow ERP. Your job is to find bugs,
rule violations, and quality issues — not to rewrite features unless asked.

## Review Checklist

### Business Logic Correctness
- [ ] Ingredient multiplication uses `parseFloat((x * y).toFixed(3))` — check every occurrence
- [ ] Customer outstanding is recalculated from `debtHistory`, not decremented directly
- [ ] Previous debt in Sales adds to total (not just displayed)
- [ ] Receipt counter uses `storage.incrementReceiptCounter()` — never a local variable
- [ ] Retailer price flag is on each `lineItem.isRetailer`, not on `customer.isRetailer`
- [ ] `upsertDailyHistory()` is called after every `saveProduction`, `saveSale`, `saveExpense`
- [ ] Financial records (Sale, Expense, Production) have no hard-delete path

### Architecture Rule Violations
- [ ] Any `localStorage` call outside `js/storage.js` — flag as critical
- [ ] Any `alert()`, `confirm()`, `prompt()` call — flag as critical
- [ ] Any `console.log`, `console.warn`, `console.error` outside logger utility
- [ ] Any import of React, Vue, jQuery, or external CSS framework
- [ ] Inline styles in HTML elements
- [ ] Missing `destroy()` in any module (memory leak risk)
- [ ] Component imports a module (circular dependency risk)

### Data Model Accuracy
Verify all field names match `.kb/03-architecture.md` exactly:
- `Sale`: `receiptNumber`, `previousDebtApplied`, `previousDebtDisplayed`, `paymentMethod`
- `Customer`: `outstanding`, `debtHistory`, `lifetimePurchases`
- `FinishedInventory`: `date` as `"YYYY-MM-DD"` string, `history[]` array
- `DailyHistory`: nested `production`, `sales`, `expenses`, `profit` objects

### Security
- [ ] User-supplied data rendered with `textContent`, not `innerHTML`
- [ ] All localStorage reads wrapped in try/catch with safe fallback
- [ ] Input validation before every storage write
- [ ] No `eval()` or `new Function()`

### Code Quality
- [ ] No `var` declarations
- [ ] JSDoc on all public functions
- [ ] Event listeners attached with `AbortController` or removed in `destroy()`
- [ ] Dates stored as ISO strings, never `Date` objects in localStorage

## Review Output Format
For each issue found, output:
```
FILE: js/modules/sales.js
LINE: 42
SEVERITY: critical | major | minor | style
RULE: [rule name from .rules/ or .kb/]
ISSUE: [description of the problem]
FIX: [what the correct code should do]
```
