# Active Context

> **Last Updated**: 2026-01-27
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: QA Fixes - useApi Shim & i18n ✅ (2026-01-27)

**Status**: Implementation complete, user testing pending 🧪

**Summary**: Fixed critical bugs discovered during browser testing of newly extracted Tools and Credentials packages.

**Problems Found & Fixed**:

1. **useApi returning null data** ✅
   - Root cause: `hooks/useApi.js` was a build-time stub returning `{ data: null, loading: false }`
   - Real implementation in nested `hooks/hooks/useApi.jsx`
   - Fix: Updated exports in `hooks/index.ts`, `index.ts`, `package.json`
   - Fixed 12 component files with relative imports

2. **CredentialListDialog showing i18n keys** ✅
   - Root cause: Double namespace - `useTranslation('credentials')` + `t('credentials.key')`
   - Fix: Removed duplicate prefix from t() calls

3. **AdminPanel dead code** ✅
   - Calls `/api/v1/users` which doesn't exist in backend
   - Fix: Deleted AdminPanel.jsx and removed route

**Files Modified** (flowise-template-mui/base/src):
- `hooks/index.ts` - export from `./hooks/` subfolder
- `index.ts` - export from `./hooks/hooks/`
- `package.json` - explicit hook exports
- 12 component files with relative imports fixed

**Files Deleted**:
- `hooks/useApi.js` (stub)
- `hooks/useConfirm.js` (stub)
- `flowise-ui/src/views/up-admin/AdminPanel.jsx`

**Build**: ✅ 42/42 packages

---

## Previous: Credentials Package Extraction ✅ (2025-11-27)

**Next**: User testing - database migrations, browser CRUD operations

---

## Recent Completions (Last 7 Days)

### 2025-11-27: Tools Package Extraction ✅
- Extracted to @universo/flowise-tools-srv and @universo/flowise-tools-frt
- Migration: 1693891895164-AddTools.ts
- Bot review fixes applied (PR #564)
- User testing pending
- Details: progress.md#2025-11-27

### 2025-11-25: AR.js Node Connections Mode Fix ✅
- Fixed `quizState is not defined` error
- Browser testing pending
- Details: progress.md#2025-11-25

### 2025-11-25: QA Fixes & Documentation ✅
- Fixed unused `t` in ClusterMembers.tsx
- Fixed campaigns-frt/clusters-frt README files
- Details: progress.md#2025-11-25

---

## Active Blockers

### Template MUI CommonJS Shims (DEFERRED)
- **Problem**: flowise-ui ESM/CJS conflict with @flowise/template-mui
- **Solution**: Extract to @universo package with dual build
- **Impact**: Blocks UI component imports

---

## Quick Reference

### Core Patterns
- i18n Architecture: systemPatterns.md#i18n-architecture
- Universal List: systemPatterns.md#universal-list-pattern
- DI Service Factory: Tools/Credentials extraction pattern
- TypeORM Repository: systemPatterns.md#typeorm-repository-pattern

### Key Commands
```bash
pnpm --filter <package> build    # Build single package
pnpm build                       # Full workspace build
pnpm --filter <package> lint     # Lint single package
```

---

**Note**: For implementation details older than 7 days, see progress.md. For planned work, see tasks.md.
