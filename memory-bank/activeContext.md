# Active Context

> **Last Updated**: 2025-11-25
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: AR.js Node Connections Mode ✅ (2025-11-25)

**Status**: Implementation complete, browser testing pending 🧪

**Problem**: `ReferenceError: quizState is not defined` in "Соединение узлов" mode when publishing UPDL nodes.

**Root Cause**: Template literal in `finishQuiz()` evaluated `quizState.points` at TypeScript compile-time.

**Solution**: Fixed string generation pattern in `packages/template-quiz/base/src/arjs/handlers/DataHandler/index.ts` line ~2605.

**Build**: ✅ template-quiz (3.9s), full project (40/40 packages, 4m 13s)

**Next**: User browser testing - verify quiz displays correctly in node connections mode.

---

## Recent Completions (Last 7 Days)

### 2025-11-25: QA Fixes & Documentation ✅
- Fixed unused `t` in ClusterMembers.tsx
- Fixed campaigns-frt/clusters-frt README files (19+ replacements)
- Details: progress.md#2025-11-25

### 2025-11-23: Documentation Major Refactoring ✅
- Configuration docs: Full EN/RU sync, 7 files translated
- Integrations docs: Full sync (249 files), 10 README files translated
- Applications docs: 7/9 phases complete, 11 files modified
- Details: progress.md#2025-11-23

### 2025-11-22: i18n Members & Tables Refactoring ✅
- Centralized `members` keys in common.json
- Decentralized module-specific table keys
- Pattern: `tc()` for common, `t()` for module-specific
- Details: progress.md#2025-11-22

### 2025-11-22: ItemCard Click Handling Fix ✅
- Implemented "Overlay Link" pattern
- Fixed menu button triggering navigation
- Build: @universo/template-mui + flowise-ui successful
- Details: progress.md#2025-11-22

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
\`\`\`bash
pnpm --filter <package> build    # Build single package
pnpm build                       # Full workspace build
pnpm --filter <package> lint     # Lint single package
\`\`\`

---

**Note**: For implementation details older than 7 days, see progress.md. For planned work, see tasks.md.
