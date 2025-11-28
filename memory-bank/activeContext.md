# Active Context

> **Last Updated**: 2025-11-28
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: P1 Bug Fixes Complete, Awaiting User Testing 🧪 (2025-11-28)

**Status**: All implementation complete. PR #570 updated with P1 bug fixes.

**Recent Completion**:
- Fixed P1 bugs from PR bot review (unikId handling in validation)
- Added `getApiKeyById` method to apikeyService for direct key lookup
- Updated verify route to `/unik/:unikId/apikey/:apikey`
- Fixed validateCanvasApiKey and validateAPIKey functions

**Git Status**:
- Branch: `feature/apikey-package-extraction`
- Latest commit: `a96117a3` - fix(apikey): add getApiKeyById method and fix unikId handling
- PR #570: Updated with all fixes

**Awaiting User Actions**:
1. Database migration testing
2. Browser functional testing
3. PR review and merge

---

## ApiKey Package Extraction ✅ (2025-11-28)

**Status**: Implementation complete, user testing pending

**Summary**: Extracted ApiKey functionality from `flowise-server` and `flowise-ui` into separate packages following the established DI pattern from Tools, Credentials, and Variables extractions.

**Packages Created**:

1. **@universo/flowise-apikey-srv** (Backend)
   - DI factory pattern (`createApikeyService`, `createApikeyRouter`)
   - **Dual Storage Mode**: Supports JSON file storage + PostgreSQL via `ApikeyStorageConfig`
   - Zod validation with `validateUnikId`, `validateApiKeyId` middleware
   - TypeORM entity with Unik ManyToOne relation
   - Migration: `1720230151480-AddApiKey.ts` with hasTable checks
   - Utils: `generateAPIKey`, `generateSecretHash`, `compareKeys`, `getDefaultAPIKeyPath`
   - **New**: `getApiKeyById(id)` method for direct key lookup

2. **@universo/flowise-apikey-frt** (Frontend)
   - Source-only package (no dist build)
   - APIKey.jsx, APIKeyDialog.jsx, UploadJSONFileDialog.jsx
   - i18n with registerNamespace pattern (namespace: 'apiKeys')
   - EN/RU translations included

**API Client**:
- New `ApiKeyApi` class in `@universo/api-client`
- Methods: getAllAPIKeys, createNewAPI, updateAPI, deleteAPI, importAPI
- Types: ApiKey, CreateApiKeyPayload, UpdateApiKeyPayload, ImportApiKeysPayload

**Build**: ✅ 44/44 packages

---

## Previous: Variables Package Extraction ✅ (2025-11-28)

Moved to progress.md

---

## Recent Completions (Last 7 Days)

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
