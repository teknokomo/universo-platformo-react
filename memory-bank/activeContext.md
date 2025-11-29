# Active Context

> **Last Updated**: 2025-11-28
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Assistants Package Extraction Complete ✅ (2025-11-28)

**Status**: All implementation complete. Build 45/45 successful. Awaiting user testing.

**Recent Completion**:
- Extracted Assistants functionality into `@universo/flowise-assistants-srv` and `@universo/flowise-assistants-frt`
- DI factory pattern: `createAssistantsService`, `createAssistantsController`, `createAssistantsRouter`
- Consolidated migration combining AddAssistantEntity + AddTypeToAssistant
- Fixed cyclic dependency by using peerDependency in flowise-template-mui
- Pinned react-i18next to 15.5.3 for i18next 23.x compatibility
- Cleaned up legacy code from flowise-ui and spaces-frt

**Git Status**:
- Uncommitted changes for Assistants extraction
- Previous branch: `feature/apikey-package-extraction` (PR #570)

**Awaiting User Actions**:
1. Database migration testing
2. Browser functional testing (Assistants page, AssistantDialog in NodeInputHandler)
3. Commit changes and create PR

---

## Assistants Package Extraction ✅ (2025-11-28)

**Status**: Implementation complete, user testing pending

**Summary**: Extracted Assistants functionality from `flowise-server` and `flowise-ui` into separate packages following the established DI pattern.

**Packages Created**:

1. **@universo/flowise-assistants-srv** (Backend)
   - DI factory pattern with optional dependencies (nodesService, documentStoreRepository, nodesPool)
   - TypeORM entity with Unik ManyToOne relation
   - Consolidated migration: `1699325775451-AddAssistant.ts`
   - ~600 lines service covering custom and OpenAI assistants

2. **@universo/flowise-assistants-frt** (Frontend)
   - Source-only package (no dist build)
   - Pages: Assistants, AssistantDialog, CustomAssistant (4 files), OpenAI (5 files)
   - i18n with registerNamespace pattern (namespace: 'assistants')
   - EN/RU translations included

**Consumer Updates**:
- `universo-template-mui`: Added dependency, updated MainRoutesMUI.tsx
- `flowise-template-mui`: Added as peerDependency, updated NodeInputHandler.jsx

**Build**: ✅ 45/45 packages

---

## Previous: ApiKey Package Extraction ✅ (2025-11-28)

Moved to progress.md

---

## Recent Completions (Last 7 Days)

### 2025-11-28: Assistants Package Extraction ✅
- Extracted to @universo/flowise-assistants-srv and @universo/flowise-assistants-frt
- DI pattern with optional dependencies config
- Consolidated migration: 1699325775451-AddAssistant.ts
- Fixed cyclic dependency via peerDependency
- Pinned react-i18next for i18next 23.x compatibility
- User testing pending
- Details: progress.md#2025-11-28

### 2025-11-28: ApiKey Package Extraction ✅
- Extracted to @universo/flowise-apikey-srv and @universo/flowise-apikey-frt
- DI pattern with dual storage mode (JSON + DB)
- Migration: 1720230151480-AddApiKey.ts
- API Client implementation complete
- User testing pending
- Details: progress.md#2025-11-28

### 2025-11-28: Variables Package Extraction ✅
- Extracted to @universo/flowise-variables-srv and @universo/flowise-variables-frt
- DI pattern with Zod validation
- User testing pending
- Details: progress.md#2025-11-28

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
