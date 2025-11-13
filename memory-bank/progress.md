# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frt architecture improvements, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n refactoring migration, TypeScript type safety, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System fixes (429 errors, API modernization), Metaverses module architecture refactoring, Quiz timer feature |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas version metadata editing, Chatflow→Canvas terminology refactoring, Opt-in PostHog telemetry, Metaverses pagination, Publish slug system, Role-based permissions, Publication system with Base58 links |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Localized default canvas handling, Chatflow→Canvas API refactoring, Material-UI template system |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors, QR code download, Testing strategy & shared utilities, AR.js camera disable mode, Passport.js + Supabase session architecture |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes, Space Builder provider/model selection, Metaverses module introduction, Singular routing pattern |

---

## November 2025 (Latest)

### 2025-11-14: Uniks Module Refactoring (Stages 1-8 Complete) ✅
**Problem**: After Metaverses refactoring, Uniks showed 3 UI issues: (1) Route conflicts showing old UI, (2) Wrong metrics in UnikBoard (Sections/Entities instead of Spaces/Tools), (3) Legacy code copied from Metaverses.

**Architecture Decision**: QA analysis revealed critical error in initial plan—Uniks and Metaverses are INDEPENDENT modules with different purposes:
- **Uniks**: 3D content + Tools + Members
- **Metaverses**: Sections + Entities + Members

**Implementation** (8 stages):
1. **Route Cleanup**: Removed all Unik-related routes from flowise-template-mui (MainRoutes.jsx) to eliminate conflict with universo-template-mui
2. **Legacy File Deletion**: Removed unused sections.ts and entities.ts from uniks-frt (copy-paste waste from Metaverses, 0 imports found via grep)
3. **Type Definitions**: Updated Unik interface in types.ts (sectionsCount/entitiesCount → spacesCount/toolsCount), removed Section/Entity interfaces
4. **Backend API**: Enhanced GET /unik/:id endpoint to calculate and return spacesCount (from public.spaces), toolsCount (from public.tool), membersCount (from public.unik_member)
5. **i18n Updates**: Replaced board.stats.sections/entities with board.stats.spaces/tools in en/uniks.json and ru/uniks.json
6. **Component Updates**: Modified UnikBoard.tsx to use new metrics (spacesData/toolsData instead of sectionsData/entitiesData)
7. **API Cleanup**: Removed legacy methods from uniks.ts API client (getUnikSections, getUnikEntities, addEntityToUnik, removeEntityFromUnik, reorderUnikEntities, addSectionToUnik)
8. **Build Validation**: Full pnpm build successful (30/30 packages), lint errors fixed with --fix, only non-critical console warnings remain

**Files Modified**:
- packages/flowise-template-mui/base/src/routes/MainRoutes.jsx (routes removed)
- packages/uniks-frt/base/src/api/sections.ts (DELETED)
- packages/uniks-frt/base/src/api/entities.ts (DELETED)
- packages/uniks-frt/base/src/types.ts (Unik interface updated)
- packages/uniks-srv/base/src/routes/uniksRoutes.ts (GET /unik/:id enhanced)
- packages/uniks-frt/base/src/i18n/locales/en/uniks.json (i18n keys updated)
- packages/uniks-frt/base/src/i18n/locales/ru/uniks.json (i18n keys updated)
- packages/uniks-frt/base/src/pages/UnikBoard.tsx (component refactored)
- packages/uniks-frt/base/src/api/uniks.ts (legacy methods removed)

**Status**: Implementation complete, browser testing pending (Stage 7).

### 2025-11-13: Space Builder Namespace Refactor ✅
Registered dedicated `spaceBuilder` namespace (was merged into default), bound components to `useTranslation('spaceBuilder')`, short keys (`t('title')`). Fixed JSX parse errors. Build OK.

### 2025-11-12: i18n Systematic Fixes (Phases 1-5) ✅
**Residual Keys**: Registered PlayCanvas template namespace, fixed SpeechToText/Space Builder hooks. **Publish RU**: Fixed JSON structure (`common` under `publish` root). **Phase 4**: Canvas nodes, VectorStore, Configuration (14 files). **Phase 2-3**: Singleton binding (`getInstance()` → `i18n`), 18 canvas menu colon syntax, ViewMessages/ViewLeads namespace binding, AddNodes categories path. **Translation Keys**: Publish namespace registration, canvas menu 9 keys added, legacy i18nInstance.js removed. 30 packages built.

**Critical Pattern**:
```typescript
// ❌ Double namespace
const { t } = useTranslation('canvas')
t('canvas.key') // → canvas:canvas.key (broken)

// ✅ Correct
const { t } = useTranslation('canvas')
t('key') // → canvas:key

// ✅ Cross-namespace
const { t } = useTranslation()
t('canvas:key') // → canvas:key
```

### 2025-11-11: Canvas MinimalLayout + Members API ✅
**MinimalLayout**: Created bare `<Outlet/>` layout (no sidebar), restructured routes (Canvas paths in MinimalRoutes array), full-screen editing mode. **Members API**: Backend TypeORM repositories, Zod validation, pagination with standard headers (`X-Pagination-*`). Fixed pagination TypeError. Canvas crash mitigation: CanvasVersionsDialog feature detection, safe wrappers, placeholder UI when `api.canvasVersions` undefined.

### 2025-11-10: i18n Double Namespace Fix ✅
Fixed Assistants/Credentials/API Keys pages showing raw keys (`assistants:custom.title` with `useTranslation('assistants')` → double prefix). Changed to `useTranslation()` without namespace param. 16 files fixed, 3 builds OK.

### 2025-11-09: MSW Handlers + createMemberActions Factory ✅
**MSW**: Pagination metadata унификация, relative dates (dayjs), critical fixes (400/404/409 responses). **Factory**: createMemberActions pattern (action hooks), TypeScript generics, 1543 LOC refactored. MetaverseBoardGrid simplification, architecture QA fixes.

### 2025-11-07 to 2025-11-08: Error Handling + Profile QA ✅
HTTP error middleware (http-errors package, Variant A), i18n error messages (members.errors), proper status codes. Profile service tests fixed, OpenAPI YAML fixes, Member dialog UX, Test infrastructure validation, Profile entity duplication fix.

### 2025-11-06: Metaverse Module Stabilization ✅
**Dashboard**: Analytics backend (TypeORM), 3 stat cards + 2 charts, TanStack Query caching. **Universal List Pattern**: SectionList, EntityList, MetaverseMembers (1543 LOC), backend pagination (Zod), role-based filtering (documented in systemPatterns.md). **Fixes**: N+1 query batch loading, entity count sync triggers, React StrictMode production bug (RouterContext wrapper), search LIKE→Russian, form reset UX, MUI v5→v6 grid spacing.

### 2025-11-02: Backend Pagination + Router Context ✅
Unified pagination utilities (Zod schemas), applied to metaverses/sections/entities endpoints. Added react-router-dom peerDependency to @flowise/template-mui (resolved RouterContext loss).

---

## October 2025

Rate limiting with Redis, i18n migration to TypeScript, metaverses namespace consolidation, tsdown build system migration (all packages), template-mui extraction, white screen production fix, publication system 429 errors resolved.

## September 2025

Chatflow→Canvas terminology refactoring, canvas versioning backend, Space Builder enhancements, Passport.js session hardening, TanStack Query pagination, AR.js configuration management, routing fixes.

---

**Note**: For detailed older entries, see Git history. For current work → tasks.md. For architectural patterns → systemPatterns.md.
