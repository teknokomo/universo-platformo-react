# Active Context

> **Last Updated**: 2025-11-08
>
> **Purpose**: Tracks current development focus. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus

### Profile Service Tests Fixed ✅ (2025-11-08)
- Fixed Jest mock hoisting error in profile-srv
- All 7 tests passing (28ms)
- Details: progress.md#2025-11-08-profile-tests

---

## Previous Focus (Last 7 Days)

### HTTP Error Handling ✅ (2025-11-07)
- Implemented http-errors middleware
- Fixed ESM/CJS imports in guards.ts
- All 25 backend tests passing
- Details: progress.md#2025-11-07-http-errors

### Member Dialog UX ✅ (2025-11-06)
- Added i18n character counter
- Fixed textarea padding (MUI v6 pattern)
- Details: progress.md#2025-11-06-member-dialog-ux

### MetaverseBoard Dashboard ✅ (2025-11-05)
- Created dashboard with 3 stat cards, 2 charts
- TanStack Query integration
- Details: progress.md#2025-11-05-dashboard

### MetaverseMembers Testing ✅ (2025-11-05)
- Migrated to happy-dom (4-9x faster)
- All 35 tests passing (566ms)
- Pattern: systemPatterns.md#testing-environment
- Details: progress.md#2025-11-05-metaversemembers-testing

### React StrictMode Production Bug ✅ (2025-11-04)
- Fixed RouterContext provider wrapper
- Pattern: systemPatterns.md#react-strictmode
- Details: progress.md#2025-11-04-router-context-fix

### Universal List Pattern ✅ (2025-11-04)
- Created SectionList, EntityList, MetaverseMembers (1543 LOC)
- Backend pagination, permissions filtering
- Pattern: systemPatterns.md#universal-list-pattern
- Details: progress.md#2025-11-04-universal-lists

### Dashboard Metrics Implementation ✅ (2025-11-03)
- Created AnalyticsService backend (TypeORM + Zod)
- Dashboard API endpoints with caching
- Details: progress.md#2025-11-03-dashboard-metrics

---

## Active Blockers

### HIGH: CommonJS Shims Required for @flowise/template-mui
**Problem**: flowise-ui (React app) cannot import from template-mui:
```
SyntaxError: The requested module '@flowise/template-mui' does not provide export 'MetaverseDialog'
```

**Root Cause**: ESM build files don't include React hooks. Vitest mock system requires full CJS shims.

**Solution**: Short-term - create manual shims (MetaverseDialog, UniversalList)

**Long-term**: Extract @flowise/template-mui to separate @universo package with dual ESM/CJS build (like space-builder-frt)

**Impact**: Blocks all UI component imports from template-mui

**Status**: ACTIVE - awaiting implementation decision

### DEFERRED: API Client Migration (@universo/api-client)
**Problem**: flowise-ui uses fetch() directly, no shared types

**Solution**: Create @universo/api-client package with generated types

**Status**: DEFERRED - not blocking current work

---

## Quick Reference

### Core Patterns
- **Universal List**: systemPatterns.md#universal-list-pattern
- **React StrictMode**: systemPatterns.md#react-strictmode
- **Testing (happy-dom)**: systemPatterns.md#testing-environment
- **TypeORM Repository**: systemPatterns.md#typeorm-repository-pattern
- **i18n Architecture**: systemPatterns.md#i18n-architecture

### Key Commands
```bash
# Run specific package tests
pnpm --filter <package> test

# Build specific package
pnpm --filter <package> build

# Full workspace build
pnpm build

# Lint specific package
pnpm --filter <package> lint
```

### Recent Test Fixes
- Profile Service: afterEach cleanup for TypeORM connections
- MetaverseMembers: happy-dom + rehype mocks
- HTTP Errors: http-errors middleware + ESM/CJS compat

---

**Note**: For older completions (pre-2025-11-03), see progress.md archive.
