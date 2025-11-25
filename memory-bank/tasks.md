# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### 2025-11-26: DepartmentList.tsx Bug Fix ✅ COMPLETE

**Status**: Fixed copy-paste error in DepartmentList.tsx, all other List pages verified correct.

**Summary**: Organization edit was not working due to wrong method names in createDepartmentContext.

**Root Cause**: Copy-paste from PositionList.tsx left `updatePosition`/`deletePosition` instead of `updateEntity`/`deleteEntity`.

**Fixed Files**:
- [x] organizations-frt/DepartmentList.tsx - Changed `updatePosition` → `updateEntity`, `deletePosition` → `deleteEntity`

**Verified Correct** (no changes needed):
- [x] organizations-frt/OrganizationList.tsx ✅ (fixed in previous session)
- [x] organizations-frt/PositionList.tsx ✅ (correctly uses position methods)
- [x] projects-frt/ProjectList.tsx, MilestoneList.tsx, TaskList.tsx ✅
- [x] metaverses-frt/MetaverseList.tsx, SectionList.tsx, EntityList.tsx ✅
- [x] storages-frt/StorageList.tsx, ContainerList.tsx, SlotList.tsx ✅
- [x] campaigns-frt/CampaignList.tsx, ActivityList.tsx, EventList.tsx ✅
- [x] clusters-frt/ClusterList.tsx, ResourceList.tsx, DomainList.tsx ✅
- [x] uniks-frt/UnikList.tsx ✅

---

### 2025-01-26: useApi → useMutation QA Fixes ✅ COMPLETE

**Status**: All 4 QA recommendations implemented, build passed (40/40)

**Summary**: QA analysis identified remaining issues after main refactoring.

**Completed Tasks**:
- [x] 1. Migrate handleInviteMember to use mutation hooks (5 packages)
  - organizations-frt/OrganizationMembers.tsx ✅
  - projects-frt/ProjectMembers.tsx ✅
  - storages-frt/StorageMembers.tsx ✅
  - metaverses-frt/MetaverseMembers.tsx ✅
  - clusters-frt/ClusterMembers.tsx ✅
  - Note: campaigns-frt already uses useMemberMutations correctly
- [x] 2. Unify uniks-frt useMemberMutations API (added unikId parameter)
  - Also fixed UnikMember.tsx to use unified API
- [x] 3. Delete 7 unused useApi.ts files (spaces-frt kept - still used)
- [x] 4. Reviewed refreshList helpers - no action needed (part of ActionContext pattern)

---

### 2025-11-25: useApi → useMutation Refactoring ✅ COMPLETE

**Status**: All 8 packages migrated, full build passed

**Summary**: Replaced custom useApi hook with idiomatic useMutation from @tanstack/react-query.
**Architecture**: 1 consolidated `hooks/mutations.ts` per package (TkDodo colocation principle).

**Completed Packages** (7 with mutations.ts + 1 N/A):
- [x] campaigns-frt ✅ - hooks/mutations.ts (12 hooks), lint/build passed
- [x] clusters-frt ✅ - hooks/mutations.ts (12 hooks), lint/build passed
- [x] metaverses-frt ✅ - hooks/mutations.ts (12 hooks), lint/build passed
- [x] organizations-frt ✅ - hooks/mutations.ts (~340 lines), 4 pages updated
- [x] projects-frt ✅ - hooks/mutations.ts (~330 lines), 4 pages updated
- [x] storages-frt ✅ - hooks/mutations.ts (~330 lines), 4 pages updated
- [x] uniks-frt ✅ - hooks/mutations.ts (~160 lines), 2 pages updated
- [x] spaces-frt - N/A (no useApi usage)

**Total Changes**: ~20 page files updated, 7 mutations.ts created (~2000 lines)

---

### 2025-11-25: PR #560 Bot Comments QA ✅ COMPLETE

**Status**: All valid issues fixed, PR merged

**Summary**: QA analysis of Copilot and Gemini Code Assist comments on PR #560.

---

### 2025-11-25: AR.js Node Connections Mode Fix ✅ COMPLETE

**Status**: Implementation complete, browser testing pending 🧪

**Summary**: Fixed `quizState is not defined` error in Node Connections mode.
- File: `packages/template-quiz/base/src/arjs/handlers/DataHandler/index.ts`
- Build: ✅ Full project (40/40 packages)
- Details: progress.md#2025-11-25

**Browser Testing (USER)** 🧪:
- [ ] Navigate to AR.js publishing page
- [ ] Set "Режим взаимодействия" to "Соединение узлов"
- [ ] Verify quiz displays correctly, no console errors

---

### 2025-01-22: Campaigns Integration ⏳ Phase 8/9

**Status**: Build fixes complete, menu integration in progress

**Summary**: Three-tier hierarchy (Campaigns → Events → Activities) following Metaverses/Clusters patterns.

**Completed Phases**:
- [x] Phase 1-7: Backend + Frontend + Routes + Menu + Breadcrumbs
- [x] Phase 8.1-8.16: Build error fixes (9 files, 22+ changes)

**Remaining**:
- [ ] Phase 9: Browser testing (USER) - CRUD operations, permissions, i18n

**Build Fixes Applied**:
- IconBullhorn → IconFlag
- createActivityActions → createEntityActions (3 files)
- BaseActivityMenu → BaseEntityMenu (4 files, 22 changes)

---

### 2025-01-20: PR #558 Storages QA ✅ COMPLETE

**Status**: Pushed to upstream PR #558

**Summary**: 17 bot recommendations validated, 9 fixed, 3 false alarms identified.

**Fixed**: Duplicate files deleted, copy-paste errors, BOM characters, unused code.

**False Alarms**: RLS filtering (correct by design), lazy router pattern (global).

---

## 🚧 IN PROGRESS

### 2025-01-19: Organizations Integration ⏸️ PAUSED

**Status**: Phases 1-8 complete, paused for ItemCard fix

**Summary**: Full backend + frontend integration ready.

**Remaining**: Phase 9 browser testing after ItemCard fix.

---

### 2025-11-22: ItemCard Click Handling ✅ 🧪 TESTING

**Status**: Implementation complete, browser testing pending

**Summary**: "Overlay Link" pattern implemented.

**Browser Tests** (USER):
- [ ] Card body click → navigation
- [ ] Menu button click → menu opens (no navigation)
- [ ] All modules: Organizations, Metaverses, Clusters, Projects

---

## 📦 DEFERRED

### Template MUI CommonJS Shims
- **Problem**: flowise-ui ESM/CJS conflict
- **Solution**: Extract to @universo package with dual build
- **Status**: DEFERRED

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

### 2025-11-25
- Compression Rules Enhancement ✅
  - Added trigger condition: compress ONLY files exceeding limits
  - Added minimum size requirement: ≥80% of limit after compression
  - Updated validation rubric with over-compression check
  - File: `.github/instructions/memory-bank-compression.instructions.md`
- QA Fixes & Documentation Cleanup ✅
- AR.js Node Connections Mode Fix ✅

### 2025-11-23-24
- Documentation Major Refactoring ✅
- Storages i18n Architecture Fix ✅

### 2025-11-22
- i18n Members & Tables Refactoring ✅
- ItemCard Click Handling Fix ✅
- PR #554 Fixes ✅
- Applications Documentation ✅

### 2025-11-17-18
- Projects Integration (23 issues fixed) ✅
- AR.js InteractionMode Persistence ✅
- Line Endings Normalization ✅

### 2025-11-14
- Cluster Breadcrumbs ✅
- Code Quality (Guards Factory) ✅
- PR #545 QA Fixes ✅

### 2025-11-13
- Uniks Refactoring (Stages 1-8) ✅
- UnikBoard Dashboard Expansion ✅
- Space Builder Namespace ✅

---

**Note**: For completed tasks older than 30 days, see progress.md.
