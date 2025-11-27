# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.38.0-alpha | 2025-11-22 | Secret Organization 🥷 | Organizations module, Projects management, AR.js Quiz Nodes, Member i18n refactor |
| 0.37.0-alpha | 2025-11-14 | Smooth Horizons 🌅 | REST API docs refactoring, Uniks metrics update, UnikBoard expansion, Clusters breadcrumbs |
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frt architecture improvements, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n refactoring migration, TypeScript type safety, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System fixes (429 errors, API modernization), Metaverses module architecture refactoring, Quiz timer feature |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas version metadata editing, Chatflow→Canvas terminology refactoring, Opt-in PostHog telemetry, Metaverses pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Material-UI template system |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes |

---

## January 2026

### 2026-01-26: useApi → useMutation QA Fixes ✅

**Summary**: QA analysis identified and fixed remaining issues after main useApi → useMutation refactoring.

**Fixes Applied**:
| Task | Files Changed | Status |
|------|---------------|--------|
| handleInviteMember migration | 5 *Members.tsx pages | ✅ |
| uniks-frt useMemberMutations API | mutations.ts, UnikMember.tsx | ✅ |
| Delete unused useApi.ts | 7 files deleted (spaces-frt kept) | ✅ |
| refreshList duplication | N/A (part of ActionContext pattern) | ✅ |

**handleInviteMember Migration**:
- Replaced direct API calls with `useInviteMember().mutateAsync()`
- Removed manual `isInviting` state - now uses `inviteMember.isPending`
- Preserved special error handling (404 userNotFound, 409 alreadyMember)
- Packages: organizations-frt, projects-frt, storages-frt, metaverses-frt, clusters-frt

**uniks-frt API Unification**:
- `useMemberMutations(unikId)` now accepts unikId parameter like other packages
- Fixed incorrect usage in UnikMember.tsx (`useUpdateMemberRole(unikId)` → `useMemberMutations(unikId)`)

**Deleted Files (7)**:
- storages-frt/hooks/useApi.ts
- projects-frt/hooks/useApi.ts
- metaverses-frt/hooks/useApi.ts
- organizations-frt/hooks/useApi.ts
- uniks-frt/hooks/useApi.ts
- campaigns-frt/hooks/useApi.ts
- clusters-frt/hooks/useApi.ts
- Note: spaces-frt/hooks/useApi.ts retained (still used by useCanvases.ts)

**Build**: Full project (40/40 packages) ✅

---

## November 2025

### 2025-11-27: Tools Package Extraction ✅

**Summary**: Extracted tools functionality from flowise-ui/flowise-server into separate packages `@universo/flowise-tools-srv` (backend) and `@universo/flowise-tools-frt` (frontend).

**Backend Package (@universo/flowise-tools-srv)**:
- TypeORM entity `Tool` with ManyToOne relation to Unik
- Consolidated migration `1748400000000-AddTools.ts` (idempotent, after uniks migration)
- DI-based `createToolsService()` factory with telemetry/metrics
- Express router factory `createToolsRouter()` with embedded controller logic
- Removed old Init migration tool table, deleted ModifyTool migration

**Frontend Package (@universo/flowise-tools-frt)**:
- Source-only package with peerDependencies
- Moved Tools page from flowise-ui/src/views/tools
- TypeScript module declarations added to consuming packages

**API Client Updates**:
- Added `CustomTool` type (distinct from component Tool)
- CRUD methods: `getCustomTools`, `createCustomTool`, `updateCustomTool`, `deleteCustomTool`
- Endpoints: `/unik/${unikId}/tools` pattern

**Files Deleted** (flowise-server):
- `src/services/tools/` directory
- `src/controllers/tools/` directory  
- `src/routes/tools/` directory
- Old migrations: `1693997339912-ModifyTool.ts`

**Bot Review Fixes (PR #564)**:
- Registered `toolsErrorHandler` middleware in flowise-server routes/index.ts
- Removed duplicate `zod` from devDependencies in package.json
- Removed 3 redundant `typeof req.params === 'undefined'` checks in toolsRoutes.ts
- Kept `dbResponse.affected ?? undefined` (TypeORM DeleteResult.affected can be null)

**Build**: 41/41 packages successful

**Testing Pending**: Database migrations, browser functional testing

---

### 2025-11-25: PR #560 Bot Comments QA ✅

**Copilot Issues Fixed (3)**:
- Removed unused `authUserRepo` variable in campaignsRoutes.test.ts:320
- Removed unused `response` variable in campaignsRoutes.test.ts:734
- Removed unused `initializeCampaignsRateLimiters` import from routes/index.ts

**Gemini Issues Fixed (2)**:
- Fixed displayName `'clusters-srv'` → `'campaigns-srv'` in jest.config.js (HIGH priority)
- Renamed test file `clustersRoutes.test.ts` → `campaignsRoutes.test.ts`

**Deferred**: useApi → useMutation refactoring (MEDIUM) - requires changes across multiple packages (storages-frt, campaigns-frt, metaverses-frt). Architectural decision for separate PR.

**Lint**: campaigns-srv ✅ 0 errors, 0 warnings

---

### 2025-11-25: QA Fixes & Documentation Cleanup ✅

**Completed**:
- Fixed unused `t` variable in ClusterMembers.tsx (lint 0 errors)
- Fixed campaigns-frt README.md: 19+ replacements (package name, routes, links)
- Fixed clusters-frt README.md/README-RU.md: route paths, related packages links
- All README files: 384 lines each (perfect bilingual parity)

**Pattern Applied**: Plural for lists (`/campaigns`), singular for detail pages (`/campaign/:id`)

---

### 2025-11-25: AR.js Node Connections Mode Fix ✅

**Problem**: `ReferenceError: quizState is not defined` in "Соединение узлов" mode.

**Root Cause**: Nested template literal in `finishQuiz()` (line ~2605) evaluated `quizState.points` at compile-time.

**Solution**: Changed to string concatenation pattern in `generateNodeBasedScript()`.

**File**: `packages/template-quiz/base/src/arjs/handlers/DataHandler/index.ts`

**Build**: template-quiz (3.9s), full project (40/40 packages, 4m 13s)

---

### 2025-11-24: Storages i18n Architecture Fix ✅

**Problem**: Module-specific keys in common.json, wrong translation function usage.

**Solution**:
- Removed duplicates from storages.json (name, description, role)
- Removed module-specific keys from common.json (containers, slots)
- Changed `tc('table.containers')` → `t('table.containers')` in StorageList
- Removed DEBUG code from ContainerList/SlotList

**Files Modified**: 9 files, 67 lines changed

---

### 2025-11-23: Documentation Comprehensive Update ✅

**Configuration Docs** (Phase 1):
- Full EN→RU sync: 22 files copied
- File renaming: running-flowise-* → running-up-*
- Branding fixes: Flowise → Universo Platformo (10 files)
- 7 core files translated to Russian

**Integrations Docs**:
- Full EN→RU sync: 249 files
- 10 critical README files translated
- 6 missing LangChain sections now documented

**Applications Docs** (7/9 phases):
- Main README rewritten: 593→234 lines
- 4 new module pages (Organizations, Clusters, Projects, Spaces)
- Obsolete directories deleted (finance, resources, entities)
- Both EN/RU SUMMARY.md updated

**Documentation QA** (12/12 tasks):
- Priority 1: 6 critical issues fixed
- Priority 2: 16 new files created (frontend/backend docs for all major modules)

---

### 2025-11-22: i18n & ItemCard Fixes ✅

**i18n Refactoring**:
- Centralized `members` keys in common.json
- Decentralized module-specific table keys
- Updated 16+ files across 5 modules

**ItemCard Click Handling**:
- Replaced RouterLink with "Overlay Link" pattern
- Menu button z-index: 10, Link z-index: 5
- Fixed event propagation issues

**PR #554 Fixes**:
- RLS policy for organizations_users updated
- Unused variables removed
- ItemCard.test.tsx updated for new pattern

---

### 2025-11-17-18: Projects Integration & AR.js Fixes ✅

**Projects Integration**:
- 23 issues fixed (11 QA + 12 runtime)
- Router registered in flowise-server
- All pages loading, correct menu navigation
- Terminology consistency: "Этапы" throughout Russian UI

**AR.js InteractionMode**:
- Added interactionMode to LOAD_SETTINGS payload
- Fixed nested template string interpolation
- Line endings normalized: 260 files (CRLF→LF)
- Created .gitattributes for consistent line endings

---

### 2025-11-14: Code Quality & Clusters ✅

**Guards Factory** (auth-srv):
- Created `createAccessGuards<TRole, TMembership>` factory
- Refactored metaverses-srv and clusters-srv guards (~460 lines → ~150 lines)

**M2M Logic Fix**:
- Fixed `ensureSectionAccess` to check ALL linked metaverses
- Added LOWER(email) index to 3 migrations

**Cluster Breadcrumbs**:
- Created `useClusterName` hook with Map caching
- Support for /clusters/:id, /access, /resources, /domains

**QA for PR #545**:
- Fixed ensureDomainAccess M2M support
- Cleaned devDependencies: 51→19 packages
- Removed debug console.log from ClusterList

---

### 2025-11-13: Uniks & Space Builder ✅

**Uniks Refactoring** (Stages 1-8):
- Route cleanup, type definitions updated
- Backend: spacesCount/toolsCount metrics
- i18n: Updated board.stats keys
- Architecture: Uniks independent from Metaverses

**UnikBoard Dashboard**:
- Expanded from 3 to 7 metric cards
- Added: Credentials, Variables, API Keys, Documents
- Fixed apikey table reference
- Orthography: "Учетные данные" → "Учётные данные" (8 files)

**Space Builder**:
- Dedicated namespace registration
- `useTranslation('spaceBuilder')` binding

---

### 2025-11-06-12: i18n Phases & Module Stabilization ✅

**i18n Systematic Fixes**:
- Phase 1-5: Singleton binding, colon syntax, namespace registration
- Fixed double namespace bug: `t('canvas:key')` with `useTranslation('canvas')`
- 30 packages built successfully

**Metaverse Module**:
- Dashboard: 3 stat cards + 2 charts
- Universal List Pattern applied
- N+1 query optimization
- React StrictMode production fix

---

## October 2025

**Key Achievements**:
- Rate limiting with Redis implementation
- i18n migration to TypeScript
- tsdown build system migration (all packages)
- Publication system 429 errors resolved
- Chatflow→Canvas terminology refactoring
- Canvas versioning backend
- Space Builder enhancements
- Passport.js session hardening

---

## September 2025

**Key Achievements**:
- AR.js configuration management
- TanStack Query pagination patterns
- Resources/Entities cluster isolation
- i18n docs consistency checker
- GitHub Copilot modes
- Metaverses module introduction
- Singular routing pattern

---

## August 2025 (Summary)

- 0.27.0-alpha: Language switcher, MMOOMM template, Finance module
- 0.26.0-alpha: MMOOMM modular package, Multiplayer Colyseus server
- 0.25.0-alpha: Space Builder MVP, Metaverse module, @universo/types

---

## July-Earlier 2025 (Summary)

- 0.24.0-alpha: Space Builder, UPDL nodes, AR.js wallpaper mode
- 0.23.0-alpha: Russian docs translation, UPDL conditional params
- 0.22.0-alpha: Memory Bank rules, MMOOMM laser mining, resource system
- 0.21.0-alpha: Handler refactoring, PlayCanvas MMOOMM stabilization
- 0.20.0-alpha: UPDL node refactoring, Template-First architecture
- Pre-alpha (0.10-0.19): Flowise integration, Supabase auth, UPDL basics

---

**Note**: For detailed implementation logs, see Git history. For current work → tasks.md. For patterns → systemPatterns.md.
