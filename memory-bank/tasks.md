# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### i18n Residual Keys – TemplateSelect, SpeechToText, Space Builder
- [x] R1: TemplateSelect (PlayCanvas) namespace registration
- [x] R2: SpeechToText namespace binding cleanup
- [x] R3: Space Builder dedicated namespace
- [x] R4: Build validation (publish-frt, template-mui, space-builder-frt)
- [ ] R5: Browser verify (USER): TemplateSelect, Speech-to-Text, Space Builder all localized
- [ ] R6: Restore compatibility export for Space Builder i18n (`registerSpaceBuilderI18n()`)

### i18n Publish & Speech-to-Text – JSON fix & build validation
- [x] P1: Fix RU JSON structure in publish-frt/i18n/locales/ru/main.json
- [ ] P2: Build impacted packages (publish-frt, template-mui, universo-template-mui, flowise-ui)
- [ ] P3: Full workspace build
- [ ] P4: Update progress.md with summary

### i18n Phase 5 – Residual fixes
- [x] 5.1: CanvasConfigurationDialog – bind 'canvas' namespace
- [x] 5.2: UpsertHistoryDialog – bind 'vectorStore' namespace
- [x] 5.3: CanvasHeader – colon namespace for publish/delete actions
- [x] 5.4: Build affected packages
- [ ] 5.5: Browser verification (USER): Configuration dialog, Upsert History, Canvas header actions
- [x] 5.6: SpeechToText.jsx – short keys after binding
- [x] 5.7: ChatPopUp.jsx – drop `chatMessage.` prefix
- [x] 5.8: Publish/Export dialog audit (PlayCanvas/ARJS colon syntax)
- [x] 5.9: Rebuild impacted packages
- [ ] 5.10: Update progress.md with Phase 5 summary

### i18n Phase 3 – View Messages/Leads Dialog Fixes
- [x] 1-8: All code fixes and builds complete
- [ ] 9: Browser verification (USER): Canvas settings tooltip, View Messages/Leads dialogs, Configuration dialog, EN↔RU toggle

---

## 🚧 IN PROGRESS

### Uniks Functionality Refactoring
**Status**: Stages 1-8 complete, Stage 7,9,11 browser testing pending

#### Stage 1-6: Implementation (COMPLETED ✅)
- [x] 1.1: Remove duplicate /uniks routes from old UI (MainRoutes.jsx)
- [x] 1.2: Delete legacy sections.ts and entities.ts files
- [x] 1.3: Update TypeScript types (Unik interface)
- [x] 1.4: Enhance backend GET /unik/:id endpoint
- [x] 1.5: Update i18n translation keys
- [x] 1.6: Update UnikBoard component to use new metrics
- [x] 1.7: Clean up unused API methods
- [x] 1.8: Build and verify all packages (✅ 30/30 successful)

#### Stage 7: Browser Testing (USER)
- [ ] 7.1: Test navigation (/uniks → UnikList → UnikBoard)
- [ ] 7.2: Verify menu shows all 10 sections
- [ ] 7.3: Test UnikBoard metrics (Spaces, Tools, Members)
- [ ] 7.4: Test UnikMember access management
- [ ] 7.5: Verify legacy components load
- [ ] 7.6: Verify redirects (/unik → /uniks)
- [ ] 7.7: Test EN ↔ RU switching

#### Stage 8: API Path Alignment Fix
- [x] 8.1-8.2: Update endpoints from /uniks/ to /unik/
- [ ] 8.3: Rebuild uniks-frt
- [ ] 8.4: Browser test: /unik/:id/access members request (Content-Type: application/json)
- [ ] 8.5: Verify owner membership renders
- [ ] 8.6: Invite second member
- [ ] 8.7: Clean up diagnostics

#### Stage 9: Canvas Routes Registration (COMPLETED ✅)
- [x] 9.1-9.7: All Canvas routes registered, reactflow unified
- [ ] 9.8: Browser test: /unik/:id/spaces/new loads
- [ ] 9.9: Verify no "api is not defined" errors
- [ ] 9.10: Verify ReactFlow components render

#### Stage 11: Canvas Versions Crash Mitigation (COMPLETED ✅)
- [x] 11.1-11.5, 11.M1-11.M8: Defensive guards, MinimalLayout created
- [ ] 11.6: Browser verify no crash, graceful message
- [ ] 11.M9: Verify Canvas renders WITHOUT sidebar (full-screen)

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

### 2025-11-13: Space Builder Namespace Refactor ✅
- Details: progress.md#2025-11-13

### 2025-11-12: i18n Phase 2-3 Fixes ✅
- Singleton binding, colon syntax, dialog fixes
- Details: progress.md#2025-11-12

### 2025-11-11: API Keys & Assistants i18n ✅
- Colon syntax migration, double namespace fix
- Details: progress.md#2025-11-11

### 2025-11-08: Profile Tests & OpenAPI YAML ✅
- Details: progress.md#2025-11-08

### 2025-11-07: HTTP Error Handling ✅
- Details: progress.md#2025-11-07

### 2025-11-06: Member Dialog UX ✅
- Details: progress.md#2025-11-06

### 2025-11-05: Dashboard & Universal Lists ✅
- Details: progress.md#2025-11-05

### 2025-11-04: React StrictMode Fix ✅
- Details: progress.md#2025-11-04

### 2025-11-03: Backend Pagination & Metrics ✅
- Details: progress.md#2025-11-03

---

## 📦 DEFERRED

### createMemberActions Factory Implementation
- Completed: Factory created, metaverses-frt refactored
- Pending: Browser tests for edit/remove functionality
- Details: progress.md#2025-11-XX

### Metaverses Architecture Refactoring
- Completed: Dashboard migration, actions consolidation, test organization
- Pending: Browser testing for dashboard and actions menu
- Details: progress.md#2025-11-XX

### API Client Migration (@universo/api-client)
- Problem: flowise-ui uses fetch() directly
- Solution: Create shared types package
- Status: DEFERRED (not blocking)

### Test Infrastructure Improvements
- MSW integration for proper API mocking
- Increase coverage beyond current levels
- Apply pattern to other list components

### QA Recommendations
- Form validation cleanup (remove manual regex, use Zod)
- Error handling improvements
- Details: progress.md#2025-11-XX

---

**Note**: For completed tasks older than 30 days, see progress.md. For detailed implementation steps, see progress.md entries by date.
