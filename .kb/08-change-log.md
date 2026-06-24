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

# BakeFlow ERP — Change Log

> This file tracks significant changes to the knowledge base and codebase.
> Add an entry every time you update .kb/ files, change a data model, or add/revoke a rule.

## Format
```
### YYYY-MM-DD — [Author / Agent]
- [module/file affected]: brief description of what changed and why
```

---

### 2025-07-07 — Initial Generation (generate-specs.mjs)
- All .kb/ files: initial creation of full knowledge base for GREENFIELD project
- All .rules/ files: initial rule set created
- All .prompts/ files: bootstrap prompts created
- AGENTS.md: created with bootstrap order and agent roles
