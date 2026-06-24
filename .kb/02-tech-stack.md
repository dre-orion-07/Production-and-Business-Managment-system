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

# BakeFlow ERP — Tech Stack

## Runtime Environment
- **Platform:** Browser (no Node.js runtime in production)
- **Language:** Vanilla JavaScript — ES6+ (ES modules via `type="module"`)
- **No framework** — no React, Vue, Angular, Svelte, or any component library

## Storage
| Layer | Technology | Notes |
|---|---|---|
| Primary | `localStorage` | Key-value JSON; ~5 MB limit |
| Fallback (v2) | IndexedDB | Planned; not in v1 |
| Access pattern | `storage.js` wrapper | **All** reads/writes MUST go through this module |

## Styling
- **Custom CSS only** — no Bootstrap, Tailwind, or any external CSS framework
- CSS custom properties (variables) for theming (dark/light)
- Mobile-first responsive layout
- CSS files scoped by concern: `main.css`, `dashboard.css`, `inventory.css`, `production.css`, `sales.css`, `reports.css`

## Testing
- **Jest** — test runner
- **jsdom** — browser environment simulation for Jest
- JSDoc comments on all public functions
- ESLint for code quality

## Build / Tooling
- No build step in v1 — plain `.js` ES module files loaded directly in browser
- No bundler (Webpack, Vite, Rollup) in v1
- No transpilation (Babel) — write ES6+ that browsers support natively
- No package manager lock-in beyond `package.json` for dev dependencies (Jest, ESLint)

## CI/CD
- None in v1

## Deployment
- Static file hosting — local web server or any static host
- No server-side code, no API endpoints, no database server

## Dev Dependencies (package.json)
```json
{
  "devDependencies": {
    "jest": "^29.x",
    "jest-environment-jsdom": "^29.x",
    "eslint": "^8.x",
    "@eslint/js": "^8.x"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint js/**/*.js"
  },
  "jest": {
    "testEnvironment": "jsdom"
  }
}
```

## Module System
- ES modules (`import`/`export`) in browser via `<script type="module">`
- Jest uses CommonJS transform for test files (jest config handles this)
- Each module exports a single default object or named functions — no global pollution

## Logging
- No `console.log` in production code
- Use a structured logger utility (e.g. `logger.info()`, `logger.error()`) that can be silenced in production

## No-Go List (Forbidden Technologies)
| What | Why |
|---|---|
| React / Vue / Angular | Vanilla JS only per spec |
| jQuery | ES6 DOM APIs are sufficient |
| Bootstrap / Tailwind | Custom CSS only |
| Any backend / Node API | Browser-only app |
| `alert()` / `confirm()` | Use custom modal component |
| Direct `localStorage` calls | Must go through `storage.js` |
| Inline styles in HTML | Use CSS classes |
| `console.log` in prod | Use structured logger |
