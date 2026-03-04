# Active Context

> **Last Updated**: 2026-03-04
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: PR #706 Review Feedback — In Progress

**Status**: 🔄 In Progress
**Date**: 2026-03-04
**Branch**: `cleanup/remove-legacy-packages`
**PR**: [#706](https://github.com/teknokomo/universo-platformo-react/pull/706) → main

### Context

PR #706 (legacy cleanup + repo restructuring) was pushed and reviewed by Copilot and Gemini bots. Addressing validated review feedback.

### Fixes applied

1. **Restored `pnpm.onlyBuiltDependencies`** — returned `["sqlite3"]` allowlist (removed `faiss-node` since it's no longer in the project)
2. **Synced `flowise-components` removal** — removed stale reference from `.kiro/steering/pnpm-not-npm.md` and `.gemini/rules/pnpm-not-npm.md`
3. **Compressed `activeContext.md`** — removed 11 historical "Previous Focus" sections (moved to progress.md per memory-bank rules)

### Review comments not actioned (with reasoning)

- **CI `working-directory` change** (Copilot) — Cypress needs `working-directory` set to the backend package to correctly launch the server. This is the same pattern used in main branch. Root `pnpm start` does the same thing but Cypress expects CWD context.

### Next steps

- Build verification
- Commit and push fixes to PR branch

---

## Current Project State

- **Build**: 23/23 packages passing (`pnpm build`) after legacy cleanup
- **Branch**: `cleanup/remove-legacy-packages` (PR #706 → main)
- **Key Packages**: admin-backend, admin-frontend, metahubs-backend, metahubs-frontend, universo-template-mui, universo-core-backend, universo-core-frontend
- **Codename Defaults**: `pascal-case` style, `en-ru` alphabet, mixed alphabets disallowed
- **DnD Runtime**: Unified through `@universo/template-mui` re-exports to prevent @dnd-kit context split

## Key Technical Context

- **Circular build dependency**: template-mui builds before metahubs-frontend; solved with `(m: any)` cast in lazy imports
- **CollapsibleSection**: Reusable component in universo-template-mui
- **DDL after transaction**: Knex DDL runs after TypeORM transaction commit to avoid deadlocks
- **ConfirmDialog pattern**: Each page using `useConfirm()` must render its own `<ConfirmDialog />` instance
- **Copy mechanism**: `generateCopyName()` + i18n " (copy N)" suffix + advisory locks
- **Codename validation**: `getCodenameSettings()` batch helper in codenameStyleHelper.ts for parallel style+alphabet queries
- **validateSettingValue**: Shared module at `domains/shared/validateSettingValue.ts`
- **pnpm.onlyBuiltDependencies**: Allowlist containing `sqlite3` for supply-chain hardening

---

## Immediate Next Steps

1. Merge PR #706 after review approval
2. Run full QA pass on merged main
3. Implement follow-up test harness and route tests for `@universo/admin-backend`
