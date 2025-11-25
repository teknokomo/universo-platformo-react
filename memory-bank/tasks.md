# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### 2025-11-25: PR #560 Bot Comments QA ✅ COMPLETE

**Status**: All valid issues fixed

**Summary**: QA analysis of Copilot and Gemini Code Assist comments on PR #560.

**Copilot Issues (3)** ✅:
- [x] Unused variable `authUserRepo` in `campaignsRoutes.test.ts:320` - Removed
- [x] Unused variable `response` in `campaignsRoutes.test.ts:734` - Removed 
- [x] Unused import `initializeCampaignsRateLimiters` in `routes/index.ts:46` - Removed

**Gemini Issues (3)**:
- [x] **HIGH**: `displayName: 'clusters-srv'` → `'campaigns-srv'` in `jest.config.js` ✅
- [x] **MEDIUM**: Rename `clustersRoutes.test.ts` → `campaignsRoutes.test.ts` ✅
- [x] **MEDIUM**: useApi vs useMutation - DEFERRED (architectural, separate PR)

**Lint Results**: campaigns-srv ✅ 0 errors, 0 warnings

**Deferred**: useApi → useMutation refactoring requires changes across multiple packages (storages-frt, campaigns-frt, metaverses-frt). Will be addressed in dedicated refactoring PR.

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
