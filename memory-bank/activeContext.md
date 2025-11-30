# Active Context

> **Last Updated**: 2025-11-29
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: ChatMessage Full Migration Complete ✅ (2025-11-29)

**Status**: All legacy code deleted. Build 38/38 successful. Database reset required for testing.

**Migration Complete**:
- All ChatMessage functionality now in `@universo/flowise-chatmessage-srv`
- Deleted 10 legacy migration files from flowise-server
- Deleted all legacy services, controllers, routes, utils
- Created utility wrappers for backward compatibility

**Key Changes**:
- `routes/index.ts` - DI-based service/controller/router creation
- `buildCanvasFlow.ts` - imports utilAddChatMessage from chatmessage-srv
- `stats/index.ts` - imports utilGetChatMessage from chatmessage-srv
- `export-import/index.ts` - direct repository queries (no canvasMessagesService)

**Kept in flowise-server**:
- `1710497452584-FieldTypes.ts` - only assistant credential varchar→uuid change

**Next Steps for Testing**:
1. Drop existing database (test project, no production data)
2. Run fresh migrations
3. Test chat functionality end-to-end

**Build**: ✅ 38/38 packages

---

## Previous: ChatMessage Package QA Fixes ✅ (2025-11-29)

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
