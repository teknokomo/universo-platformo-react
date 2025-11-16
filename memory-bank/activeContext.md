# Active Context

> **Last Updated**: 2025-11-17
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Projects Integration 100% Complete (Production-Ready) ✅

### Final i18n Consistency Fix (2025-11-17) ✅
**Issue #23**: Mixed Russian terminology - "Вехи" (milestones) vs "Этапы" (stages)
**User Request**: Единообразное название - оставить только "Этапы"
**Implementation**:
- Replaced all 14 occurrences of "Вех*" forms with "Этап*" in `projects.json`
- Grammatical forms handled: Вехи→Этапы, веха→этап, веху→этап, вехе→этапе, вех→этапов
- Updated: stats titles, table headers, section titles, search placeholders, empty states, dialogs, form labels, validation messages
- Build: projects-frt ✅ (3.7s), flowise-ui ✅ (1m 11s)
- i18n bundle size: 14.23 kB → 14.26 kB (+30 bytes due to longer word "этап")
**Status**: ✅ Complete - all Russian text now uses consistent "Этапы" terminology
**Next**: User hard refresh browser (Ctrl+F5) to verify consistent terminology

---

## Recent Completed Work

### Projects Runtime Fixes & UX Improvements (2025-11-17) ✅
**Context**: After completing 11 QA fixes, discovered 12 additional runtime/UX issues during browser testing. All fixed.

**Backend Critical Fixes**:
- **Issue #12**: Build error in uniks-srv - removed return from res.json() calls (TypeScript compliance)
- **Issue #13**: Migration error "must be owner of table users" - removed auth.users index creation (Supabase system table)
- **Issue #14**: ".map is not a function" error - backend returning HTML instead of JSON
- **Issue #15**: Namespace capitalization - changed 'Projects' to 'projects' across 9+ files
- **Issue #16**: **CRITICAL** - Projects router never mounted! Added registration to flowise-server/apiRoutes.ts
- **Issue #17**: Duplicate AuthUser entity - deleted local copy, imported from @universo/auth-srv (TypeORM metadata conflict fix)

**Frontend UX Fixes**:
- **Issue #18**: Russian translations wrong - showing "Метавселенные" instead of "Проекты" - fixed all namespace references
- **Issue #19**: Main menu showing instead of internal project menu - added projectMatch regex and menu detection to MenuContent.tsx
- **Issue #20**: Wrong menu order (Milestones→Tasks) - swapped to Tasks→Milestones (matches Resources→Domains pattern)
- **Issue #21**: URL param mismatch - MilestoneList used PascalCase ProjectId but route defines camelCase projectId - fixed useParams
- **Issue #22**: Browser verification passed ✅ - all pages loading correctly
- **Issue #23**: Terminology consistency - replaced "Вехи" with "Этапы" throughout Russian UI (14 replacements)

**Final Validation**:
- ✅ All 23 issues fixed (11 QA + 12 runtime)
- ✅ Build: TypeScript 0 errors, ESLint clean, all packages successful
- ✅ Backend: Router registered, all routes working, entities migrated
- ✅ Frontend: All pages loading, correct menu navigation, proper breadcrumbs
- ✅ i18n: Consistent terminology in both English and Russian
- ✅ Pattern Compliance: 100% match with Metaverses/Clusters reference

**Impact**: Projects module now **production-ready** with full feature parity to Metaverses/Clusters.

---

## Recent Completed Work

### Uniks Package Refactoring (2025-01-14) ✅
**Implementation completed** - Applied best practices from Metaverses/Clusters to Uniks package:

**Backend Changes**:
- Created `guards.ts` with createAccessGuards factory (ROLE_PERMISSIONS, ensureUnikAccess, assertNotOwner)
- Refactored 8 endpoints in `uniksRoutes.ts` to use guards pattern instead of inline permission checks
- Added `permissions` field to GET /:id response (enables Edit/Delete menu in UI)
- Renamed migration: CreateUniksSchema → AddUniksAndLinked (follows naming convention, no Flowise mention)

**Frontend Changes**:
- Updated UnikList.tsx columns: added Name column first (20% width, bold), replaced Sections/Entities with Spaces
- Added i18n translations for "table.spaces" in EN and RU common.json files

**Build & Lint**: ✅ Both packages compile successfully, lint clean (1 acceptable console warning in migration)

**Next**: Browser verification by user:
- [ ] Navigate to /uniks and verify Name column displays first in table
- [ ] Click on a Unik and verify Edit/Delete menu appears for authorized users
- [ ] Verify Spaces column shows correct count
- [ ] Test member management with role-based permissions

**Technical Notes**:
- Guards pattern provides DRY, type-safe permission checks with structured logging
- Frontend actions menu already had correct filtering logic (`unik.permissions?.manageUnik`)
- Fixed compilation error: removed duplicate `dataSource` destructuring in PATCH route
- Pattern source: metaverses-srv/guards.ts and clusters-srv/guards.ts

---

## Recent Completed Work

### Cluster Breadcrumbs Implementation (2025-11-14) ✅
- Implemented useClusterName hook with Map-based caching (mirrored useMetaverseName pattern)
- Updated NavbarBreadcrumbs.tsx with cluster context detection and rendering
- Added breadcrumb support for 3 cluster sub-pages: access, resources, domains
- Name truncation at 30 chars for long cluster names
- Builds: @universo/template-mui ✅ (3203 kB CJS, 271 kB ESM), flowise-ui ✅ (1m 10s), full workspace ✅ (32/32 tasks, 3m 35s)
- Next: Browser verification - navigate to cluster pages and confirm breadcrumbs display correctly (tasks.md#2025-11-14)

### Clusters/Metaverses UI Improvements (2025-11-13) ✅
- Added "Name" column as first column to all entity lists (Domains, Resources, Sections, Entities)
- Fixed sidebar menu for Cluster context (now shows: Clusterboard, Resources, Domains, Access)
- Builds: All packages successful
- Next: Browser verification - check Name columns, test cluster sidebar menu (tasks.md#2025-11-13)

### i18n Phase 5 – Canvas Dialogs & Speech-to-Text (2025-11-13)
- Fixed CanvasConfigurationDialog, UpsertHistoryDialog, SpeechToText namespace binding
- Fixed PlayCanvas/ARJS publishers colon syntax for common namespace
- Modified 7 files (spaces-frt, template-mui, chatmessage packages)
- Builds: All successful (spaces-frt, template-mui, flowise-ui)
- Next: Browser verification (tasks.md#5.10)

### Space Builder Dedicated Namespace (2025-11-13)
- Replaced merger logic with explicit namespace registration
- Updated SpaceBuilderDialog/Fab to use `useTranslation('spaceBuilder')`
- Fixed JSX parse errors (missing closing tags)
- Builds: space-builder-frt successful (CJS 3596 kB, ESM 795 kB)
- Next: Browser QA (tasks.md#R5), restore compatibility export (tasks.md#R6)

### Uniks Functionality Refactoring (2025-11-10)
- Completed: TypeORM migration, frontend rebuild, routing, i18n, builds
- Status: Stage 9 (Canvas routes), Stage 11 (Versions crash mitigation)
- MinimalLayout created for full-screen Canvas editing
- Next: Browser test navigation, Canvas rendering (tasks.md#7.1-7.7)

---

## Active Blockers

### Template MUI CommonJS Shims
- Problem: flowise-ui cannot import from @flowise/template-mui (ESM/CJS conflict)
- Solution: Extract to @universo package with dual build (like space-builder-frt)
- Impact: Blocks UI component imports
- Status: DEFERRED

---

## Quick Reference

### Core Patterns
- i18n Architecture: systemPatterns.md#i18n-architecture
- Universal List: systemPatterns.md#universal-list-pattern
- React StrictMode: systemPatterns.md#react-strictmode
- TypeORM Repository: systemPatterns.md#typeorm-repository-pattern

### Key Commands
```bash
pnpm --filter <package> test
pnpm --filter <package> build
pnpm build
pnpm --filter <package> lint
```

---

## Previous Focus (Archived to progress.md)

- 2025-11-12: i18n Phase 3 (View Messages/Leads dialogs) – Details: progress.md#2025-11-12
- 2025-11-12: i18n Phase 2 (Singleton binding, colon syntax) – Details: progress.md#2025-11-12
- 2025-11-11: API Keys i18n migration – Details: progress.md#2025-11-11
- 2025-11-11: i18n Double namespace fix – Details: progress.md#2025-11-11
- 2025-11-07: HTTP Error Handling – Details: progress.md#2025-11-07
- 2025-11-06: Member Dialog UX – Details: progress.md#2025-11-06
- 2025-11-05: Dashboard implementation – Details: progress.md#2025-11-05

---

**Note**: For detailed implementation logs older than 7 days, see progress.md archive.
