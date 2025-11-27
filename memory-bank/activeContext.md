# Active Context

> **Last Updated**: 2025-11-27
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Tools Package Extraction ✅ (2025-11-27)

**Status**: Implementation complete, user testing pending 🧪

**Summary**: Extracted tools functionality from flowise-ui/flowise-server into separate packages.

**New Packages**:
- `@universo/flowise-tools-srv` - Backend (entity, migrations, service, routes)
- `@universo/flowise-tools-frt` - Frontend (Tools page, source-only)

**Key Changes**:
- Consolidated migration `1748400000000-AddTools.ts` (after uniks)
- DI factory pattern: `createToolsService()`, `createToolsRouter()`
- API client: `CustomTool` type with CRUD methods
- Routes updated in MainRoutesMUI.tsx and MainRoutes.jsx

**Build**: ✅ 41/41 packages (4m 48s)

**Next**: User testing - database migrations, browser functional testing

---

## Recent Completions (Last 7 Days)

### 2025-11-25: AR.js Node Connections Mode Fix ✅
- Fixed `quizState is not defined` error
- File: template-quiz/base/src/arjs/handlers/DataHandler/index.ts
- Browser testing pending
- Details: progress.md#2025-11-25

### 2025-11-25: QA Fixes & Documentation ✅
- Fixed unused `t` in ClusterMembers.tsx
- Fixed campaigns-frt/clusters-frt README files (19+ replacements)
- Details: progress.md#2025-11-25

### 2025-11-23: Documentation Major Refactoring ✅
- Configuration docs: Full EN/RU sync, 7 files translated
- Integrations docs: Full sync (249 files), 10 README files translated
- Applications docs: 7/9 phases complete, 11 files modified
- Details: progress.md#2025-11-23

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
