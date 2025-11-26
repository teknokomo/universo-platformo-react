# Active Context

> **Last Updated**: 2026-01-26
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: useApi → useMutation QA Fixes ✅ (2026-01-26)

**Status**: All 4 QA recommendations implemented, build passed (40/40 packages)

**Summary**: QA analysis identified remaining issues after main refactoring.

**Fixes Applied**:
1. ✅ **handleInviteMember migration** - 5 *Members.tsx pages now use `useInviteMember().mutateAsync()`
2. ✅ **uniks-frt useMemberMutations API** - unified to accept `unikId` parameter
3. ✅ **Deleted 7 unused useApi.ts files** (spaces-frt retained - still used)
4. ✅ **refreshList helpers** - reviewed, no action needed (part of ActionContext pattern)

**Build**: Full project (40/40 packages) ✅, Lint: 0 errors

---

## Recent Completions (Last 7 Days)

### 2025-11-25: useApi → useMutation Refactoring ✅
- Replaced custom `useApi` hook with `useMutation` from @tanstack/react-query
- 7 mutations.ts files created (~2000 lines total)
- ~20 page files updated
- Details: progress.md#2025-11-25

### 2025-11-25: AR.js Node Connections Mode ✅
- Fixed `quizState is not defined` error
- Build: template-quiz ✅, full project ✅
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
- React StrictMode: systemPatterns.md#react-strictmode
- TypeORM Repository: systemPatterns.md#typeorm-repository-pattern

### Key Commands
```bash
pnpm --filter <package> build    # Build single package
pnpm build                       # Full workspace build
pnpm --filter <package> lint     # Lint single package
```

---

**Note**: For implementation details older than 7 days, see progress.md. For planned work, see tasks.md.
