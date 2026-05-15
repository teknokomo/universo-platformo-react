# Documentation Refresh Plan (2026-05-15)

> Goal: comprehensive update of GitBook documentation in `docs/en` and `docs/ru` to match current platform state, remove non-existent functionality, remove legacy terminology, add screenshots, improve quality, and align with modern documentation patterns.

## QA Analysis Status: ✅ COMPLETE

**Comprehensive QA analysis completed on 2026-05-15. Key findings:**

### ✅ Good News (Already Complete)
1. **Legacy terminology cleanup:** NOT NEEDED - already done throughout codebase
2. **Russian localization:** MINIMAL WORK - already complete, only new content needs translation
3. **Implementation verification:** All core features (Pages, LMS, Ledgers) are fully implemented

### ❌ Critical Gaps Identified
1. **Pages entity documentation:** MISSING - must create user-facing guide
2. **LMS screenshots:** MISSING - directories are empty, need comprehensive visual documentation
3. **Ledgers screenshots:** MISSING - need visual aids for operational data flows
4. **Non-existent functionality:** MUST DELETE - 26 files documenting features that don't exist

### 📊 Updated Scope
- **Files to delete:** 26 (UPDL, Space Builder, Metaverses, Analytics, guides)
- **Files to create:** 2 (Pages guide EN + RU)
- **Files to update:** ~70-80
- **Screenshots to generate:** 40-50 (20-25 unique, each in EN + RU locales)

**See "QA Analysis Summary" section at the end for complete findings.**

---

## Overview

**QA-VERIFIED STATUS:** The documentation in `docs/` contains outdated content including:
- **Non-existent functionality** — UPDL nodes, Space Builder, Metaverses, Analytics sections describe planned features not currently implemented (**QA VERIFIED:** 26 files to delete)
- **Legacy terminology** — (**QA VERIFIED:** ✅ Already cleaned up - no "Attribute" or "Catalog" references found)
- **English terms in Russian documentation** — (**QA VERIFIED:** ✅ Already localized - no English technical terms found in RU docs)
- **Missing screenshots** — especially for LMS (**QA VERIFIED:** directories are empty), Workspaces, Applications, Pages entity type
- **Incomplete descriptions** — LMS, Entities, Workspaces, Ledgers, Pages functionality needs better coverage
- **Missing Pages entity documentation** — Pages entity type with Editor.js is not documented (**QA VERIFIED:** Critical gap - implementation exists but no user docs)

This plan addresses all documentation issues systematically.

## User Requirements Clarification

Based on user feedback:
1. **Remove all non-existent functionality** — Delete UPDL nodes, Space Builder, Metaverses sections completely. Documentation will be added when features are implemented.
2. **Prioritize based on modern documentation patterns** — Use task-oriented structure, clear navigation, visual aids.
3. **Russian screenshots required** — All screenshots must be generated in Russian locale for Russian documentation, matching English screenshots.

## Affected Areas

| Area | Current State | Required Actions |
|------|---------------|------------------|
| Platform Overview | UPDL/Metaverses/Space Builder sections exist | **DELETE** non-existent functionality sections |
| UPDL Section | 7 node type pages + main page | **DELETE** entire `docs/*/platform/updl/` directory |
| Space Builder | Exists as placeholder | **DELETE** `docs/*/platform/space-builder.md` |
| Metaverses | Exists as placeholder | **DELETE** `docs/*/platform/metaverses.md` |
| Analytics | Generic placeholder | **DELETE** or rewrite to describe actual functionality |
| Metahubs Docs | Good structure | Add Pages entity documentation |
| Entity Docs | Missing Pages coverage | Add Pages entity type with Editor.js |
| LMS Guides | Good content, needs screenshots | Add visual documentation (EN + RU) |
| Ledgers Guide | Exists and accurate | Verify and add screenshots |
| Architecture Docs | Generally accurate | Minor terminology sync |
| API Reference | Stable | Verify accuracy |
| Russian Docs | English terms present | Full localization pass + RU screenshots |
| Assets/Screenshots | Limited coverage | Generate via Playwright (EN + RU locales) |

## Phase 1: Analysis And Preparation

### 1.1. Document Inventory And Audit

- [ ] Create complete inventory of all documentation files
- [ ] **Identify all non-existent functionality for deletion:**
  - [ ] UPDL section: `docs/*/platform/updl/` (7 files + README = 8 files per locale, 16 total)
  - [ ] Space Builder: `docs/*/platform/space-builder.md` (2 files)
  - [ ] Metaverses: `docs/*/platform/metaverses.md` (2 files)
  - [ ] Analytics: `docs/*/platform/analytics.md` (2 files - describes generic concepts, not actual functionality)
  - [ ] Working with UPDL guide: `docs/*/guides/working-with-updl.md` (2 files)
  - [ ] Multi-Platform Export guide: `docs/*/guides/multi-platform-export.md` (2 files - describes generic concepts)
  - [ ] All SUMMARY.md references to above sections
- [ ] **Verify legacy terminology status:**
  - [x] ✅ Catalog → Object terminology: Already updated in all docs (no matches found)
  - [x] ✅ Attribute → Component terminology: Already updated in all docs (no matches found)
- [ ] **Verify Russian localization status:**
  - [x] ✅ English terms in Russian docs: Already properly localized (no English technical terms found in RU docs)
- [ ] List all missing screenshots by comparing doc references to actual assets
- [ ] **Verify screenshot localization:**
  - [ ] Check if existing screenshots in `docs/ru/.gitbook/assets/` are in Russian locale
  - [ ] Identify which screenshots need Russian locale versions
- [ ] Create priority matrix based on modern documentation patterns:
  1. **Getting Started** (installation, quick start) — highest priority
  2. **Core Concepts** (Metahubs, Entities, Applications) — high priority
  3. **Task-Oriented Guides** (LMS, Workspaces, Ledgers, Pages) — high priority
  4. **Architecture** (for developers) — medium priority
  5. **API Reference** — medium priority
  6. **Contributing** — lower priority

### 1.2. Terminology Baseline

**Terminology changes (completed in code, docs need sync):**

| Old Term | New Term | Notes |
|----------|----------|-------|
| Attribute | Component | Field definitions are now components |
| Catalog | Object / Object Collection | Universal entity type |
| Linked Collection | Object Collection | In object references |
| _mhb_attributes | _mhb_components | System tables |
| _app_attributes | _app_components | Runtime tables |
| Field Definition | Component | When referring to attributes |
| Fixed Value | Fixed Value | Unchanged (was Constant) |
| Option Value | Option Value | Unchanged (was Enumeration Value) |
| Record | Record | Unchanged (was Element) |

**Terms to keep:**
- UPDL (architectural concept, but reduce emphasis)
- Metaverse (planned functionality, keep in context)
- Space Builder (planned functionality, mark as future)

### 1.3. Screenshot Requirements

Generate screenshots using Playwright CLI for **both EN and RU locales**:

| Feature Area | Required Screenshots | Locales | Priority |
|--------------|---------------------|---------|----------|
| Metahubs | Entities workspace, Hub tree, Object records, Pages editor | EN + RU | High |
| Applications | Dashboard, Connectors, Workspaces | EN + RU | High |
| LMS | Guest runtime, Module viewer, Quiz taking, Progress | EN + RU | High |
| Admin | Roles, Settings | EN + RU | Medium |
| Resources | Shared components, layouts, scripts | EN + RU | Medium |
| Publications | List, versions, applications | EN + RU | Medium |
| Ledgers | Ledger list, fact append, projections | EN + RU | Medium |

**Important:** Each screenshot must be generated twice:
1. Once with EN locale for `docs/en/.gitbook/assets/`
2. Once with RU locale for `docs/ru/.gitbook/assets/`

## Phase 2: Content Deletion (Non-Existent Functionality)

### 2.1. Delete UPDL Section

- [ ] **DELETE** `docs/en/platform/updl/` directory (8 files total):
  - [ ] README.md
  - [ ] space-nodes.md
  - [ ] entity-nodes.md
  - [ ] component-nodes.md
  - [ ] action-nodes.md
  - [ ] event-nodes.md
  - [ ] data-nodes.md
- [ ] **DELETE** `docs/ru/platform/updl/` directory (8 files total)
- [ ] Remove UPDL section from `docs/en/SUMMARY.md`
- [ ] Remove UPDL section from `docs/ru/SUMMARY.md`

### 2.2. Delete Space Builder

- [ ] **DELETE** `docs/en/platform/space-builder.md`
- [ ] **DELETE** `docs/ru/platform/space-builder.md`
- [ ] Remove from `docs/en/SUMMARY.md`
- [ ] Remove from `docs/ru/SUMMARY.md`

### 2.3. Delete Metaverses

- [ ] **DELETE** `docs/en/platform/metaverses.md`
- [ ] **DELETE** `docs/ru/platform/metaverses.md`
- [ ] Remove from `docs/en/SUMMARY.md`
- [ ] Remove from `docs/ru/SUMMARY.md`

### 2.4. Delete Analytics

- [x] ✅ **VERIFIED:** `docs/en/platform/analytics.md` describes generic concepts, not actual functionality
- [ ] **DELETE** `docs/en/platform/analytics.md`
- [ ] **DELETE** `docs/ru/platform/analytics.md`
- [ ] Remove from `docs/en/SUMMARY.md`
- [ ] Remove from `docs/ru/SUMMARY.md`

### 2.5. Delete/Update UPDL Guide

- [ ] **DELETE** `docs/en/guides/working-with-updl.md`
- [ ] **DELETE** `docs/ru/guides/working-with-updl.md`
- [ ] Remove from `docs/en/SUMMARY.md`
- [ ] Remove from `docs/ru/SUMMARY.md`

### 2.6. Delete Multi-Platform Export Guide

- [x] ✅ **VERIFIED:** `docs/en/guides/multi-platform-export.md` describes generic concepts, not actual functionality
- [ ] **DELETE** `docs/en/guides/multi-platform-export.md`
- [ ] **DELETE** `docs/ru/guides/multi-platform-export.md`
- [ ] Remove from `docs/en/SUMMARY.md`
- [ ] Remove from `docs/ru/SUMMARY.md`

## Phase 3: Russian Documentation Localization

### 3.1. Screenshot Locale Verification

**CRITICAL FINDING:** Both EN and RU documentation currently share the same screenshots from their respective `.gitbook/assets/` directories. Need to verify if existing screenshots are locale-appropriate:

- [ ] **Verify existing screenshots in `docs/en/.gitbook/assets/`:**
  - [ ] Check if UI text is in English
  - [ ] Identify screenshots that need regeneration
- [ ] **Verify existing screenshots in `docs/ru/.gitbook/assets/`:**
  - [ ] Check if UI text is in Russian
  - [ ] Identify screenshots that need regeneration with RU locale
- [ ] **Create list of screenshots needing locale-specific versions**

### 3.2. English Term Replacement (IF NEEDED)

**QA FINDING:** ✅ Grep search found NO English technical terms in Russian documentation. Russian localization is already complete.

This phase can be **SKIPPED** unless new content is added.

### 3.3. Structure Verification

- [ ] Verify all Russian docs have same structure as English docs
- [ ] Verify same number of lines (per i18n-docs.md rule)
- [ ] Verify all internal links work correctly
- [ ] Verify all screenshots have Russian alternatives where UI is visible

## Phase 4: Platform Section Updates

### 4.1. Platform README

**docs/en/platform/README.md:**
- [ ] Update table to reflect actual functionality only
- [ ] Remove references to UPDL, Space Builder, Metaverses, Analytics
- [ ] Add explicit LMS row to table
- [ ] Update description to focus on current functionality
- [ ] Clarify that this documents actual implementation, not planned features

**docs/ru/platform/README.md:**
- [ ] Mirror all EN changes exactly
- [ ] Verify Russian localization is complete

### 4.2. Metahubs Documentation

**docs/en/platform/metahubs.md:**
- [ ] Add section on Pages entity type with Editor.js
- [ ] Add section on Ledgers entity type
- [ ] Verify all entity types are documented: Hub, Object, Set, Enumeration, Page, Ledger
- [ ] Add references to detailed guides

**docs/ru/platform/metahubs.md:**
- [ ] Mirror all EN changes exactly

### 4.3. Applications Documentation

**docs/en/platform/applications.md:**
- [ ] Update for workspace management
- [ ] Add connector configuration details
- [ ] Verify screenshots are current

**docs/ru/platform/applications.md:**
- [ ] Mirror all EN changes exactly

### 4.4. Admin Documentation

**docs/en/platform/admin.md:**
- [ ] Verify accuracy
- [ ] Verify screenshots are current

**docs/ru/platform/admin.md:**
- [ ] Mirror all EN changes exactly

## Phase 5: Documentation Content Updates

### 5.1. Add Missing Entity Type Documentation

**Pages Entity Type (NEW - HIGH PRIORITY):**

**QA FINDINGS:**
- ✅ Pages entity is fully implemented with `kindKey: 'page'`
- ✅ Editor.js integration exists in `@universo/template-mui` via `EditorJsBlockEditor` component
- ✅ Used in LMS for `LearnerHome` entity (confirmed in `architecture/lms-entities.md`)
- ✅ Backend normalizes Editor.js blocks to canonical Page block schema
- ✅ Frontend renders via `EntityBlockContentPage.tsx` in `metahubs-frontend`
- ❌ **CRITICAL GAP:** No user-facing documentation exists for this entity type

**Tasks:**
- [ ] Create `docs/en/guides/pages-entity-type.md`
  - [ ] Explain what Pages entity type is
  - [ ] Document Editor.js integration
  - [ ] Show how to create and edit Pages
  - [ ] Explain block types supported (paragraph, header, list, etc.)
  - [ ] Document content localization (multiple locale support)
  - [ ] Show use cases (LMS LearnerHome, content pages, documentation)
  - [ ] Add screenshots of Pages editor in action
- [ ] Create `docs/ru/guides/pages-entity-type.md`
  - [ ] Full Russian translation matching EN version exactly
- [ ] Add to SUMMARY.md in both locales under Guides section
- [ ] Reference from `platform/metahubs.md` in entity types overview

### 5.2. Metahubs Subsection (docs/en/platform/metahubs, docs/ru/platform/metahubs)

**QA FINDINGS:**
- ✅ Terminology already updated (no "Attribute" or "Catalog" found)
- ✅ Component terminology is current throughout codebase

**common-section.md (Resources Workspace):**
- [ ] Verify terminology is current (already updated per QA)
- [ ] Verify screenshots are current
- [ ] Mirror changes to RU version

**shared-components.md:**
- [ ] Verify terminology is current (already updated per QA)
- [ ] Verify screenshot is current
- [ ] Mirror changes to RU version

**shared-fixed-values.md:**
- [ ] Verify content accuracy
- [ ] Verify screenshot is current
- [ ] Mirror changes to RU version

**shared-option-values.md:**
- [ ] Verify content accuracy
- [ ] Verify screenshot is current
- [ ] Mirror changes to RU version

**scripts.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**shared-scripts.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**script-scopes.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**exclusions.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**shared-behavior-settings.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

### 5.3. LMS Guides (docs/en/guides, docs/ru/guides)

**QA FINDINGS:**
- ✅ LMS functionality is fully implemented
- ✅ LMS fixture exists: `tools/fixtures/metahubs-lms-app-snapshot.json`
- ✅ Architecture documented in `architecture/lms-entities.md`
- ❌ Missing screenshots in `docs/en/.gitbook/assets/lms/` (directory is empty)
- ❌ Missing screenshots in `docs/ru/.gitbook/assets/lms/` (directory is empty)

**lms-overview.md:**
- [ ] Verify accuracy against current implementation
- [ ] **Add screenshots:** LMS dashboard, guest flow, module viewer
- [ ] Generate screenshots in both EN and RU locales
- [ ] Mirror changes to RU version

**lms-setup.md:**
- [ ] Verify step-by-step accuracy
- [ ] **Add screenshots:** Setup wizard, configuration steps
- [ ] Generate screenshots in both EN and RU locales
- [ ] Mirror changes to RU version

**lms-resource-model.md:**
- [ ] Verify accuracy against `architecture/lms-entities.md`
- [ ] Add diagram if needed
- [ ] Mirror changes to RU version

**lms-reports.md:**
- [ ] Verify accuracy
- [ ] **Add screenshots:** Progress reports, quiz results
- [ ] Generate screenshots in both EN and RU locales
- [ ] Mirror changes to RU version

**lms-guest-access.md:**
- [ ] Verify accuracy
- [ ] **Add screenshots:** Guest login, session management, access links
- [ ] Generate screenshots in both EN and RU locales
- [ ] Mirror changes to RU version

### 5.4. Architecture Section (docs/en/architecture, docs/ru/architecture)

**QA FINDINGS:**
- ✅ Architecture docs are generally accurate and current
- ✅ `lms-entities.md` is comprehensive and accurate
- ✅ `ledgers.md` is comprehensive and accurate
- ✅ `entity-systems.md` is accurate with current terminology

**README.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**entity-systems.md:**
- [ ] Verify terminology is current (already updated per QA)
- [ ] Mirror changes to RU version

**entity-component-system.md:**
- [ ] Verify Component terminology is current (already updated per QA)
- [ ] Verify clarity on Entity Components vs React components
- [ ] Mirror changes to RU version

**lms-entities.md:**
- [x] ✅ **VERIFIED:** Accurate and comprehensive
- [ ] Mirror any updates to RU version

**scripting-system.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**ledgers.md:**
- [x] ✅ **VERIFIED:** Accurate and comprehensive
- [ ] Mirror any updates to RU version

**All other architecture docs:**
- [ ] Quick verification pass for accuracy
- [ ] Mirror changes to RU versions

### 5.5. API Reference (docs/en/api-reference, docs/ru/api-reference)

**README.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**rest-api.md:**
- [ ] Verify endpoint accuracy
- [ ] Mirror changes to RU version

**scripts.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**All other API docs:**
- [ ] Quick verification pass
- [ ] Mirror changes to RU versions

### 5.6. Contributing Section (docs/en/contributing, docs/ru/contributing)

**README.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**development-setup.md:**
- [ ] Verify Node.js version requirements (currently >=22.6.0 per tech.md)
- [ ] Verify Supabase setup instructions
- [ ] Mirror changes to RU version

**coding-guidelines.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

**creating-packages.md:**
- [ ] Verify accuracy
- [ ] Mirror changes to RU version

### 5.7. Other Guides (docs/en/guides, docs/ru/guides)

**transactional-objects.md:**
- [ ] Verify accuracy
- [ ] Add screenshots if missing
- [ ] Mirror changes to RU version

**ledgers.md:**
- [ ] Verify accuracy
- [ ] **Add screenshots:** Ledger list, fact append, projections view
- [ ] Generate screenshots in both EN and RU locales
- [ ] Mirror changes to RU version

**All other guides:**
- [ ] Quick verification pass for accuracy and terminology
- [ ] Mirror changes to RU versions

## Phase 6: Screenshot Generation

### 6.1. Playwright Setup For Documentation

**QA FINDINGS:**
- ✅ Playwright is already configured in the project
- ✅ LMS fixture exists: `tools/fixtures/metahubs-lms-app-snapshot.json`
- ✅ E2E infrastructure is in place

**Tasks:**
- [ ] Create dedicated Playwright spec for doc screenshots: `tools/testing/e2e/specs/docs/documentation-screenshots.spec.ts`
- [ ] Use existing LMS fixture for consistent state
- [ ] Configure for high-resolution screenshots (1920x1080 minimum)
- [ ] **Set up locale switching mechanism:**
  - [ ] Use Playwright's `locale` context option
  - [ ] Create helper function to switch between 'en' and 'ru' locales
  - [ ] Ensure UI renders in correct language before capturing
- [ ] Create helper functions for locale-aware screenshot capture:
  - [ ] `captureScreenshot(page, name, locale)` - saves to correct assets directory
  - [ ] `captureScreenshotBothLocales(page, name)` - captures EN and RU versions

### 6.2. Screenshot Categories (EN + RU for each)

**CRITICAL:** Each screenshot must be generated TWICE - once with EN locale for `docs/en/.gitbook/assets/`, once with RU locale for `docs/ru/.gitbook/assets/`

**Metahub Screenshots:**
- [ ] **Verify existing screenshots:**
  - [ ] entities-workspace.png (check if current, regenerate if needed)
  - [ ] hub-tree-view.png (check if current, regenerate if needed)
  - [ ] object-records.png (check if current, regenerate if needed)
  - [ ] resources-workspace.png (check if current, regenerate if needed)
  - [ ] shared-components.png (check if current, regenerate if needed)
  - [ ] set-fixed-values.png (check if current, regenerate if needed)
  - [ ] enumeration-option-values.png (check if current, regenerate if needed)
  - [ ] shared-constants.png (check if current, regenerate if needed)
  - [ ] shared-values.png (check if current, regenerate if needed)
  - [ ] component-list.png (check if current, regenerate if needed)
  - [ ] metahub-create-dialog.png (check if current, regenerate if needed)
  - [ ] metahub-entities-create-dialog.png (check if current, regenerate if needed)
- [ ] **NEW screenshots needed:**
  - [ ] pages-editor.png (Pages entity with Editor.js) - **HIGH PRIORITY**
  - [ ] pages-editor-blocks.png (Editor.js block types)
  - [ ] pages-content-localization.png (Multiple locale tabs)

**Application Screenshots:**
- [ ] **Verify existing screenshots:**
  - [ ] applications-list.png (check if current)
  - [ ] application-connectors.png (check if current)
  - [ ] publication-versions.png (check if current)
  - [ ] publication-applications.png (check if current)
  - [ ] publications-list.png (check if current)
- [ ] **NEW screenshots needed:**
  - [ ] application-dashboard.png
  - [ ] application-workspaces.png

**LMS Screenshots (ALL NEW - HIGH PRIORITY):**
- [ ] lms-dashboard.png
- [ ] lms-guest-login.png
- [ ] lms-module-viewer.png
- [ ] lms-module-content.png
- [ ] lms-quiz-taking.png
- [ ] lms-quiz-results.png
- [ ] lms-progress-tracking.png
- [ ] lms-learner-home.png (Pages entity in action)

**Ledgers Screenshots (ALL NEW - MEDIUM PRIORITY):**
- [ ] ledgers-list.png
- [ ] ledger-create-dialog.png
- [ ] ledger-field-roles.png
- [ ] ledger-facts-list.png
- [ ] ledger-fact-append.png
- [ ] ledger-projections.png

**Admin Screenshots:**
- [ ] **Verify existing screenshots:**
  - [ ] admin-roles.png (check if current)
  - [ ] admin-settings.png (check if current)

**Quiz Tutorial Screenshots:**
- [ ] **Verify existing screenshots:**
  - [ ] application-settings-general.png (check if current)
  - [ ] layout-quiz-widget.png (check if current)
  - [ ] metahub-scripts.png (check if current)
  - [ ] runtime-quiz.png (check if current)

### 6.3. Screenshot Quality Standards

- Use 1920x1080 viewport minimum
- Capture clean state without test data artifacts
- **Ensure UI is in correct locale:**
  - EN screenshots for `docs/en/.gitbook/assets/`
  - RU screenshots for `docs/ru/.gitbook/assets/`
- Use consistent naming: `feature-description.png`
- Store in appropriate `.gitbook/assets/` subdirectory
- Verify text is readable and UI elements are visible
- **Verify locale-specific UI elements:**
  - Button labels
  - Menu items
  - Form labels
  - Error messages
  - Tooltips

## Phase 7: Documentation Testing

### 7.1. Link Validation

- [ ] Create script to validate all internal links
- [ ] Fix broken links
- [ ] Verify external links still work
- [ ] Verify cross-references between EN and RU docs

### 7.2. Terminology Validation

**QA FINDING:** ✅ Legacy terminology already removed from all documentation

- [ ] Final grep pass to confirm no legacy terms remain
- [ ] Verify consistent terminology across all docs
- [ ] Verify technical terms are used correctly

### 7.3. i18n Consistency Check

- [ ] Verify EN and RU SUMMARY.md match exactly
- [ ] Verify EN and RU file counts match
- [ ] Verify EN and RU structure matches
- [ ] **Verify line count matches** (per i18n-docs.md rule)
- [ ] Verify all screenshots have locale-appropriate versions

## Phase 8: Summary.md Updates

### 8.1. English SUMMARY.md

**Current state verified:** Contains references to all sections to be deleted

- [ ] **Remove deleted sections:**
  - [ ] UPDL section and all subsections (7 files)
  - [ ] Builder Flows (space-builder.md)
  - [ ] Analytics and Observability (analytics.md)
  - [ ] Simulation and Virtual Worlds (metaverses.md)
  - [ ] Working with UPDL guide
  - [ ] Multi-Platform Export guide
- [ ] **Add new sections:**
  - [ ] Pages Entity Type guide under Guides section
- [ ] Verify all links point to existing files
- [ ] Update section descriptions if needed
- [ ] Ensure logical organization

### 8.2. Russian SUMMARY.md

- [ ] Mirror all English changes exactly
- [ ] Use Russian section headers
- [ ] Verify all links work
- [ ] Verify structure matches EN version exactly

## Phase 9: Final Validation

### 9.1. Build Test

- [ ] Run `pnpm docs:i18n:check` if available
- [ ] Verify GitBook can build the docs
- [ ] Check for any formatting issues
- [ ] Verify all images load correctly

### 9.2. Review Checklist

- [ ] ✅ All non-existent functionality removed (UPDL, Space Builder, Metaverses, Analytics, guides)
- [ ] ✅ All legacy terminology already removed (verified via grep)
- [ ] All screenshots generated and placed (EN + RU)
- [ ] ✅ All Russian docs already fully localized (verified via grep)
- [ ] All internal links work
- [ ] All external links valid
- [ ] Structure matches between EN and RU
- [ ] Line counts match between EN and RU (per i18n-docs.md)
- [ ] ✅ No English terms in Russian docs (verified via grep)
- [ ] Pages entity type documented with Editor.js integration
- [ ] Ledgers documented with screenshots
- [ ] LMS documented with screenshots

## QA Analysis Summary

### ✅ Verified Findings

1. **Legacy Terminology:** Already removed from all documentation
   - No "Catalog" references found
   - No "Attribute" references found
   - Terminology is current throughout

2. **Russian Localization:** Already complete
   - No English technical terms found in Russian docs
   - Proper Russian terminology used throughout

3. **Pages Entity Implementation:** Fully implemented
   - `kindKey: 'page'` exists in codebase
   - Editor.js integration via `EditorJsBlockEditor` component
   - Used in LMS for `LearnerHome` entity
   - Backend normalization and validation in place

4. **LMS Implementation:** Fully functional
   - Complete entity model documented in `architecture/lms-entities.md`
   - Fixture file exists: `tools/fixtures/metahubs-lms-app-snapshot.json`
   - All entities implemented: LearnerHome, Classes, Students, Modules, Quizzes, etc.

5. **Ledgers Implementation:** Fully functional
   - Comprehensive documentation in `architecture/ledgers.md`
   - Runtime API implemented
   - Used in LMS for ProgressLedger and ScoreLedger

### ❌ Critical Gaps Identified

1. **Pages Entity Documentation:** No user-facing documentation exists
   - Need to create `docs/*/guides/pages-entity-type.md`
   - Need screenshots of Pages editor with Editor.js

2. **LMS Screenshots:** Missing entirely
   - `docs/en/.gitbook/assets/lms/` directory is empty
   - `docs/ru/.gitbook/assets/lms/` directory is empty
   - Need comprehensive LMS workflow screenshots

3. **Ledgers Screenshots:** Missing
   - Need screenshots of ledger list, facts, projections

4. **Non-Existent Functionality Documentation:** Must be deleted
   - UPDL section (16 files total: 8 EN + 8 RU)
   - Space Builder (2 files)
   - Metaverses (2 files)
   - Analytics (2 files)
   - Working with UPDL guide (2 files)
   - Multi-Platform Export guide (2 files)
   - **Total: 26 files to delete**

5. **Screenshot Locale Verification:** Needed
   - Existing screenshots may not be locale-appropriate
   - Need to verify and regenerate with correct locale

### 📊 Updated Scope Estimate

| Phase | Files to Delete | Files to Create | Files to Update | Screenshots |
|-------|----------------|-----------------|-----------------|-------------|
| Phase 2 | 26 files | 0 | 2 (SUMMARY.md) | 0 |
| Phase 3 | 0 | 0 | ~10 (verification) | 0 |
| Phase 4 | 0 | 0 | ~10 (platform) | 0 |
| Phase 5 | 0 | 2 (Pages guide) | ~50-60 (content) | 0 |
| Phase 6 | 0 | 0 | 0 | 40-50 (EN+RU) |
| Phase 7-9 | 0 | 0 | As needed | 0 |

**Total estimated work:**
- Files to delete: 26
- Files to create: 2 (Pages guide EN + RU)
- Files to update: ~70-80
- Screenshots to generate: 40-50 (20-25 unique, each in EN + RU)

### 🎯 Priority Recommendations

**Phase 2 (Deletion) - HIGHEST PRIORITY:**
- Removes all misleading documentation about non-existent features
- Clean slate for accurate documentation
- Quick wins with immediate impact

**Phase 5.1 (Pages Documentation) - HIGH PRIORITY:**
- Critical gap in entity type documentation
- Pages are actively used in LMS
- Users need guidance on Editor.js integration

**Phase 6 (LMS Screenshots) - HIGH PRIORITY:**
- LMS is fully functional but undocumented visually
- Empty screenshot directories indicate complete gap
- Essential for user understanding of LMS workflows

**Phase 6 (Ledgers Screenshots) - MEDIUM PRIORITY:**
- Ledgers are documented but lack visual aids
- Important for understanding operational data flows

**Phase 3 (Russian Localization) - LOW PRIORITY:**
- Already complete per QA analysis
- Only needed for new content (Pages guide)

## Potential Challenges

### 1. Screenshot Generation Complexity

**Challenge:** Screenshots require running application with specific state.
**Solution:** Use existing LMS fixture and Playwright product specs. Run local Supabase for E2E screenshots.

### 2. Terminology Ambiguity

**Challenge:** Some terms like "Component" have multiple meanings (Entity Component vs React Component).
**Solution:** Use context-appropriate disambiguation. In Entity context, "Component" refers to Entity Components. In UI context, use "React Component" or "UI Component".

### 3. Russian Localization Quality

**Challenge:** Some technical terms may not have established Russian equivalents.
**Solution:** Use transliteration for established tech terms (Runtime → Рантайм, Dashboard → Дашборд) while maintaining Russian for domain concepts.

### 4. Maintaining Sync Between EN and RU

**Challenge:** Risk of docs drifting out of sync during updates.
**Solution:** Update both EN and RU versions in same commit. Use line count verification as final check.

## Dependencies

- No cross-team dependencies
- Requires local Supabase for Playwright screenshots
- Requires Playwright CLI tools already in repository

## Estimated Scope

**Updated based on QA analysis:**

| Phase | Estimated Files | Estimated Screenshots | Notes |
|-------|----------------|----------------------|-------|
| Phase 1 | N/A (analysis) | N/A | Analysis and planning - PARTIALLY COMPLETE |
| Phase 2 | 26 files deleted | N/A | Remove non-existent functionality |
| Phase 3 | ~10 files verified | N/A | Russian localization verification only |
| Phase 4 | ~10 files updated | N/A | Platform section updates |
| Phase 5 | ~52-62 files (2 new + 50-60 updated) | N/A | Content updates + Pages guide |
| Phase 6 | N/A | 40-50 screenshots | EN + RU for each (20-25 unique) |
| Phase 7-9 | As needed | N/A | Testing and validation |

**Total estimated work:**
- Files to delete: 26 (UPDL, Space Builder, Metaverses, Analytics, guides)
- Files to create: 2 (Pages guide EN + RU)
- Files to update: ~70-80
- Screenshots to generate: 40-50 (20-25 unique, each in EN + RU)

**QA Findings Impact:**
- ✅ Legacy terminology cleanup: NOT NEEDED (already done)
- ✅ Russian localization: MINIMAL WORK (already complete, only new content needs translation)
- ❌ Pages documentation: CRITICAL GAP (must create)
- ❌ LMS screenshots: COMPLETE GAP (directory empty)
- ❌ Ledgers screenshots: MISSING (need to add)
- ❌ Non-existent functionality: MUST DELETE (26 files)

## Success Criteria

1. **All non-existent functionality removed** — No UPDL nodes, Space Builder, or Metaverses documentation remains
2. All documentation uses current terminology (Component, Object, Object Collection)
3. All Russian documentation is fully localized with minimal English terms
4. **All referenced screenshots exist in both EN and RU locales** and are current
5. **Pages entity type is documented** with Editor.js integration explained
6. **Ledgers are documented** with screenshots
7. All internal links work correctly
8. EN and RU documentation structure matches exactly
9. GitBook builds successfully without warnings
10. Documentation follows modern patterns: task-oriented, clear navigation, visual aids
