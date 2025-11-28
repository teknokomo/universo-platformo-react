# Active Context

> **Last Updated**: 2025-01-28
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Variables Package Extraction ✅ (2025-01-28)

**Status**: Implementation complete, user testing pending 🧪

**Summary**: Extracted Variables functionality from `flowise-server` and `flowise-ui` into separate packages following the established pattern from Tools and Credentials extractions.

**Packages Created**:

1. **@universo/flowise-variables-srv** (Backend)
   - DI factory pattern (`createVariablesService`, `createVariablesRouter`)
   - Zod validation for input schemas
   - UUID validation middleware
   - TypeORM entity with `!` assertions for strict mode
   - Migration: `1702200925471-AddVariables.ts` with hasTable checks

2. **@universo/flowise-variables-frt** (Frontend)
   - Source-only package (no dist build)
   - Variables.jsx, AddEditVariableDialog.jsx, HowToUseVariablesDialog.jsx
   - i18n with registerNamespace pattern
   - EN/RU translations included

**Integration Points**:
- flowise-server: Variable entity import, variablesService DI, variablesRouter
- universo-template-mui: MainRoutesMUI.tsx updated with new imports
- API Client: Using existing `VariablesApi` from `@universo/api-client`

**Files Deleted**:
- Old routes, controllers, services from flowise-server
- Old views from flowise-ui
- Duplicate i18n from universo-i18n and spaces-frt

**Build**: ✅ 43/43 packages

---

## Previous: QA Fixes - useApi Shim & i18n ✅ (2026-01-27)

Moved to progress.md

---

## Recent Completions (Last 7 Days)

### 2025-01-28: Variables Package Extraction ✅
- Extracted to @universo/flowise-variables-srv and @universo/flowise-variables-frt
- DI pattern with Zod validation
- Migration: 1702200925471-AddVariables.ts
- User testing pending
- Details: progress.md#2025-01-28

### 2025-11-27: Credentials Package Extraction ✅
- Extracted to @universo/flowise-credentials-srv and @universo/flowise-credentials-frt
- User testing pending

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
