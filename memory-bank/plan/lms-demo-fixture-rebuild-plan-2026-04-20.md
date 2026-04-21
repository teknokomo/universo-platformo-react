# LMS Demo Fixture Rebuild Plan

> **Date**: 2026-04-20
> **Complexity**: Level 4 (Major / Cross-package)
> **Status**: DRAFT v1 — based on live codebase analysis, focused Playwright evidence, and creative review; awaiting approval

---

## Table of Contents

1. [Overview](#overview)
2. [Validated Findings](#validated-findings)
3. [Goals and Non-Goals](#goals-and-non-goals)
4. [Affected Areas](#affected-areas)
5. [Architecture Decisions](#architecture-decisions)
6. [Phase 0 — Fixture Integrity and Root-Cause Repairs](#phase-0--fixture-integrity-and-root-cause-repairs)
7. [Phase 1 — Canonical LMS Demo Data Model](#phase-1--canonical-lms-demo-data-model)
8. [Phase 2 — Runtime Widget and Layout Upgrade](#phase-2--runtime-widget-and-layout-upgrade)
9. [Phase 3 — Snapshot Generator and Product Playwright Rewrite](#phase-3--snapshot-generator-and-product-playwright-rewrite)
10. [Phase 4 — Validation Matrix](#phase-4--validation-matrix)
11. [Phase 5 — Documentation and GitBook Refresh](#phase-5--documentation-and-gitbook-refresh)
12. [File Change Summary](#file-change-summary)
13. [Risks and Mitigations](#risks-and-mitigations)
14. [Approval Gate](#approval-gate)

---

## Overview

Rebuild the LMS template and canonical snapshot fixture so that this flow becomes reliable on a clean database:

1. Import [tools/fixtures/metahubs-lms-app-snapshot.json](../../../tools/fixtures/metahubs-lms-app-snapshot.json).
2. Create an application from the imported metahub.
3. Immediately see a working bilingual space-themed LMS demo with:
   - curated demo data,
   - a working module viewer,
   - a working statistics widget,
   - a real QR/public access link,
   - a working guest quiz flow,
   - meaningful workspace-aware runtime data.

The rebuilt fixture must stop behaving like an internal E2E artifact and start behaving like a product-quality demo asset.

---

## Validated Findings

### F-1: The current canonical LMS snapshot is still an E2E-shaped artifact

- The exported snapshot keeps transient suffixes in `metahub.name` and `metahub.codename`.
- Example evidence: [tools/fixtures/metahubs-lms-app-snapshot.json](../../../tools/fixtures/metahubs-lms-app-snapshot.json) contains `LMS Metahub e2e-...` and `LmsMetahube2e...` values.
- Root cause: [tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts](../../../tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts) creates the source metahub with run-id-specific naming and exports it directly.

### F-2: The default LMS template still seeds a placeholder QR target

- [packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts](../../../packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts) sets the QR widget URL to `https://example.com/lms/demo-module`.
- This makes the template and the snapshot non-self-contained until later browser setup patches the widget config.

### F-3: The imported demo is not self-contained for runtime widget discovery

- The exported snapshot contains module and stats scripts plus widget config references.
- The module viewer widget config currently uses `attachedToKind: 'catalog'`, while the exported fixture module script is attached to `metahub`.
- This can break runtime script discovery after clean import because runtime script filtering is attachment-aware before codename selection.
- Likely runtime seam: [packages/apps-template-mui/src/dashboard/components/runtimeWidgetHelpers.ts](../../../packages/apps-template-mui/src/dashboard/components/runtimeWidgetHelpers.ts) and [packages/applications-backend/base/src/services/runtimeScriptsService.ts](../../../packages/applications-backend/base/src/services/runtimeScriptsService.ts).

### F-4: The fixture contract is too weak for product-grade demo guarantees

- [tools/testing/e2e/support/lmsFixtureContract.ts](../../../tools/testing/e2e/support/lmsFixtureContract.ts) validates only a narrow subset of LMS integrity.
- It does not yet require:
  - canonical non-e2e naming,
  - self-contained demo content,
  - real access-link wiring,
  - widget/script attachment correctness,
  - seeded runtime-ready statistics data,
  - screenshot-based browser proof.

### F-5: The current LMS browser proof is setup-heavy instead of fixture-first

- The focused LMS Playwright flows create or patch significant parts of the demo state at runtime.
- This is valid for coverage, but it means the committed snapshot does not yet prove that import alone gives a usable sample.

---

## Goals and Non-Goals

### Goals

1. Make the LMS fixture importable and immediately understandable for a human evaluator.
2. Replace transient E2E naming with canonical product-facing naming in EN and RU.
3. Seed real demo content on a space theme in EN and RU.
4. Ensure the application dashboard renders working module, stats, and QR surfaces after clean import.
5. Ensure the public guest flow works from the seeded data without manual authoring.
6. Regenerate the canonical LMS snapshot through Playwright from the upgraded flow.
7. Add deep Jest, Vitest, and Playwright coverage for the new fixture integrity and runtime behavior.
8. Refresh README and GitBook docs in both EN and RU.
9. Keep the solution compatible with the existing metahub template and snapshot version contracts without increasing schema or template versions.

### Non-Goals

1. Do not build a new LMS package or a second LMS-specific runtime shell.
2. Do not bypass the entity-first metahub/application architecture.
3. Do not hardcode product behavior into frontend packages if the same result can be expressed via template seed, runtime rows, layouts, or scripts.
4. Do not depend on manual post-import fixes for demo readiness.
5. Do not preserve avoidable legacy-only LMS fixture code paths just for compatibility with disposable E2E-only data.

---

## Affected Areas

### Backend / Template / Snapshot

- [packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts](../../../packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts)
- [packages/metahubs-backend/base/src/domains/templates/services/TemplateManifestValidator.ts](../../../packages/metahubs-backend/base/src/domains/templates/services/TemplateManifestValidator.ts)
- [packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts](../../../packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts)
- [packages/applications-backend/base/src/services/runtimeScriptsService.ts](../../../packages/applications-backend/base/src/services/runtimeScriptsService.ts)
- [packages/applications-backend/base/src/routes/sync/syncScriptPersistence.ts](../../../packages/applications-backend/base/src/routes/sync/syncScriptPersistence.ts)

### Frontend Runtime

- [packages/apps-template-mui/src/dashboard/components/ModuleViewerWidget.tsx](../../../packages/apps-template-mui/src/dashboard/components/ModuleViewerWidget.tsx)
- [packages/apps-template-mui/src/dashboard/components/StatsViewerWidget.tsx](../../../packages/apps-template-mui/src/dashboard/components/StatsViewerWidget.tsx)
- [packages/apps-template-mui/src/dashboard/components/QRCodeWidget.tsx](../../../packages/apps-template-mui/src/dashboard/components/QRCodeWidget.tsx)
- [packages/apps-template-mui/src/dashboard/components/runtimeWidgetHelpers.ts](../../../packages/apps-template-mui/src/dashboard/components/runtimeWidgetHelpers.ts)
- [packages/apps-template-mui/src/standalone/GuestApp.tsx](../../../packages/apps-template-mui/src/standalone/GuestApp.tsx)

### Types / Shared Utilities / i18n

- [packages/universo-types/base/src/common/metahubs.ts](../../../packages/universo-types/base/src/common/metahubs.ts)
- [packages/universo-i18n/base](../../../packages/universo-i18n/base)
- [packages/apps-template-mui/src/i18n](../../../packages/apps-template-mui/src/i18n)
- [packages/metahubs-frontend/base/src/i18n](../../../packages/metahubs-frontend/base/src/i18n)

### Playwright / Fixtures / Docs

- [tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts](../../../tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts)
- [tools/testing/e2e/support/lmsFixtureContract.ts](../../../tools/testing/e2e/support/lmsFixtureContract.ts)
- [tools/testing/e2e/specs/flows/lms-class-module-quiz.spec.ts](../../../tools/testing/e2e/specs/flows/lms-class-module-quiz.spec.ts)
- [tools/testing/e2e/specs/flows/lms-statistics.spec.ts](../../../tools/testing/e2e/specs/flows/lms-statistics.spec.ts)
- [tools/testing/e2e/specs/flows/lms-qr-code.spec.ts](../../../tools/testing/e2e/specs/flows/lms-qr-code.spec.ts)
- [tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts](../../../tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts)
- [tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts](../../../tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts)
- [tools/fixtures/metahubs-lms-app-snapshot.json](../../../tools/fixtures/metahubs-lms-app-snapshot.json)
- [docs/en](../../../docs/en)
- [docs/ru](../../../docs/ru)

---

## Architecture Decisions

### AD-1: The canonical LMS fixture must be self-contained after import

The fixture must not require follow-up browser or API patching to become useful. Product-level Playwright may still create extra rows for scenario breadth, but import alone must yield a coherent demo.

### AD-2: Runtime widget behavior stays script-driven, not package-hardcoded

Module viewer and stats viewer should keep using the runtime widget script contract. The fix must come from correct script attachment, snapshot data, seed data, and validation, not from special-case frontend fallbacks.

### AD-3: The demo should be data-first and bilingual

The space theme, module curriculum, quiz prompts, statistics labels, and access-link presentation must be stored in localized data or localized script payloads, not hidden in test-only constants.

### AD-4: The QR widget must point to a real imported public route

The canonical LMS fixture should no longer carry `example.com` placeholders. The seeded QR target must either:

1. resolve deterministically from a canonical access-link slug after application creation, or
2. be post-created by an officially supported generator step that is itself part of the canonical fixture regeneration contract.

Because the product requirement is a clean import plus manual application creation by the user, the approved target architecture must converge on option 1. A generator-only patch is acceptable only as a temporary migration aid while the implementation is in progress, not as the final shipped contract.

### AD-5: The dashboard should remain within current widget/layout patterns

The rebuilt LMS sample should reuse:

- existing zone widgets,
- existing runtime widget hooks,
- current menu and details shell,
- existing standalone GuestApp journey.

No new parallel LMS rendering framework should be introduced.

### AD-6: The canonical fixture and the product Playwright flow must be regenerated together

The committed LMS snapshot must come from the same upgraded product flow that proves the imported demo works. Manual JSON edits must not be the regeneration path.

### AD-7: Reuse the established quiz-fixture generator pattern where possible

The LMS generator rewrite should follow the same canonical separation already present in the quiz fixture flow:

- canonical user-facing names and descriptions in the fixture contract,
- temporary run-id-specific live names only inside the generator execution,
- layout normalization and script registration handled through supported APIs,
- final export validated through a dedicated fixture contract.

The LMS plan must prefer extending shared generator helpers or mirroring the current quiz pattern over inventing a parallel fixture pipeline.

### AD-8: Demo rows should use existing design-time seed mechanisms before adding new runtime seeding seams

The current metahub template stack already supports seeded design-time entities, catalog elements, and enumeration option values through the template manifest and snapshot restore paths. The plan should therefore prefer:

- `seed.entities` for object definitions,
- `seed.elements` for catalog demo rows,
- `seed.optionValues` for enumeration data,
- snapshot-carried design-time data that naturally publishes into application runtime,

before introducing any new application-runtime-only seeding mechanism.

---

## Phase 0 — Fixture Integrity and Root-Cause Repairs

### Objective

Repair the structural mismatches that prevent the current fixture from behaving like a clean product demo.

### Steps

- [ ] Audit all LMS widget-to-script attachment pairs and define one canonical attachment contract for module viewer and stats viewer.
- [ ] Repair the module viewer `attachedToKind` mismatch between widget config and exported script records.
- [ ] Decide whether module viewer scripts should be metahub-attached or catalog-attached in the shipped LMS sample, then enforce that consistently in template seed, fixture generation, and runtime validation.
- [ ] Remove transient run-id naming from the canonical exported LMS snapshot while preserving run-id-specific names only inside temporary generator runtime state.
- [ ] Replace placeholder QR configuration in the LMS template with a supported canonical strategy.
- [ ] Strengthen LMS fixture validation so export/import fails early when widget configs reference missing or mismatched scripts.

### Expected output

- A fixture integrity contract that can reject broken LMS snapshots before they are committed.

---

## Phase 1 — Canonical LMS Demo Data Model

### Objective

Turn the LMS sample into a real product demo with bilingual space-theme data.

### Data package

- [ ] Define canonical demo naming:
  - Metahub: `LMS Metahub` / `Метахаб LMS`
  - Application: `LMS Application` / `Приложение LMS`
  - Publication: `LMS Publication` / `Публикация LMS`
- [ ] Define a canonical narrative hub such as `Orbital Academy` / `Орбитальная академия`.
- [ ] Seed at least 2 classes with distinct learner contexts.
- [ ] Seed at least 3 modules with ordered progression, localized copy, duration, and visual assets.
- [ ] Seed 1 quiz per module with real bilingual questions and option sets.
- [ ] Seed access links for at least one starter module and one secondary route.
- [ ] Seed enrolled students, quiz responses, and module progress rows so statistics are non-empty immediately after application creation.
- [ ] Keep guest-session rows unseeded so the public guest flow still proves real row creation.
- [ ] Implement seeded demo rows through the existing metahub template and snapshot mechanisms first (`seed.elements`, `seed.optionValues`, and exported design-time data), and only add a new runtime seeding seam if code analysis proves the current publication pipeline cannot carry the required LMS demo rows.

### Content strategy

- [ ] Use a unified space theme across module titles, descriptions, lesson visuals, quiz copy, and dashboard language.
- [ ] Ensure EN and RU have equal content breadth, not summary-only RU copy.
- [ ] Prefer stable remote media assets only when needed and safe; otherwise use repository-safe assets or URLs already acceptable for product demos.

### Expected output

- A self-contained bilingual LMS demo dataset that communicates product value without authoring work.

---

## Phase 2 — Runtime Widget and Layout Upgrade

### Objective

Improve the imported application dashboard so it behaves like a guided LMS demo instead of a raw runtime table.

### Layout plan

- [ ] Replace the current table-first emphasis with a guided dashboard composition based on existing zone widgets.
- [ ] Promote module viewer to the primary center experience.
- [ ] Keep detailsTable available, but reduce its dominance in first-view UX.
- [ ] Keep stats viewer and QR card in the right rail as operator-facing side widgets.
- [ ] Refine menu widget title, ordering, and visibility for curated LMS navigation.

### Widget behavior plan

- [ ] Ensure module viewer renders from real seeded content rather than empty-state fallback.
- [ ] Ensure stats viewer derives meaningful values from seeded rows or supported script-fed calculations.
- [ ] Ensure QR widget shows a real public route, visible text URL, and copyable link.
- [ ] Confirm GuestApp can start from the seeded public link and reach module, quiz, score, and completion states without fixture-only hacks.

### UI proof plan

- [ ] Capture authenticated dashboard screenshots in EN and RU.
- [ ] Capture guest flow screenshots for start, module, quiz result, and completion.
- [ ] Keep screenshots tied to real Playwright flows rather than manual browser exploration.

---

## Phase 3 — Snapshot Generator and Product Playwright Rewrite

### Objective

Rewrite the LMS product fixture flow so the canonical snapshot is produced from the upgraded end-to-end demo, not from a test-only partial setup.

### Generator rewrite

- [ ] Refactor [tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts](../../../tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts) so the committed fixture is exported from canonical non-e2e naming.
- [ ] Reuse the structural pattern already established by [tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts](../../../tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts) for canonical naming, fixture-contract validation, and layout normalization instead of inventing a separate LMS-only export style.
- [ ] Move demo-data creation into the officially supported generator path.
- [ ] Ensure the generator creates every required script, layout binding, access link, and data row before export.
- [ ] Ensure the generator writes the fixture only after passing stronger LMS fixture contract assertions.

### Product Playwright rewrite

- [ ] Update LMS product flows so they validate the imported fixture as product behavior, not only the programmatically augmented runtime.
- [ ] Add a dedicated clean-import proof:
  1. import canonical LMS snapshot,
  2. create application,
  3. assert dashboard readiness,
  4. assert seeded data visibility,
  5. assert public link behavior,
  6. assert guest completion behavior.
- [ ] Keep focused happy-path and negative-path flows, but reduce avoidable test setup duplication by reusing canonical seeded data where appropriate.

### Screenshot and evidence requirements

- [ ] Add screenshot artifacts for dashboard EN, dashboard RU, guest start, guest quiz result, guest completion, and QR card.
- [ ] Keep screenshot assertions or artifact capture in the supported Playwright flow, not as ad hoc manual steps.

---

## Phase 4 — Validation Matrix

### Objective

Add deep validation across backend, frontend, and browser layers.

### Jest / backend

- [ ] Add fixture-integrity tests for LMS script/widget attachment compatibility.
- [ ] Add snapshot export/import validation tests for LMS-specific integrity rules.
- [ ] Add sync/runtime tests proving imported scripts remain discoverable through application runtime script APIs.
- [ ] Add route tests for canonical public link and runtime row expectations if new backend seams are introduced.

### Vitest / frontend

- [ ] Add runtime widget helper tests for attachment mismatch prevention and fail-loud behavior.
- [ ] Add module viewer and stats viewer tests for real seeded-script contracts.
- [ ] Add QR widget tests for real public-path rendering and copy interaction.
- [ ] Extend GuestApp tests to reflect the upgraded canonical bilingual demo content where useful.

### Playwright / browser

- [ ] Keep and upgrade these proof bundles:
  - workspace management,
  - class → module → quiz → progress,
  - statistics rendering,
  - QR/link access,
  - negative guest access behavior,
  - clean import → application creation → immediate usability.
- [ ] Explicitly review whether the shared quiz product/generator pattern also needs changes so LMS and quiz fixtures keep one consistent canonical export architecture instead of drifting into two incompatible generator models.
- [ ] Add at least one RU-locale proof in the LMS browser surface.
- [ ] Keep screenshot capture and visual verification on real browser output.

### Workspace build boundary

- [ ] Run package-focused checks during development.
- [ ] Require canonical root `pnpm build` before closure.

---

## Phase 5 — Documentation and GitBook Refresh

### Objective

Update repository docs to match the rebuilt LMS demo workflow.

### Scope

- [ ] Update the relevant package README files in EN first, then mirror them in RU with identical structure.
- [ ] Refresh root or package-level LMS fixture regeneration guidance.
- [ ] Refresh GitBook docs under [docs/en](../../../docs/en) and [docs/ru](../../../docs/ru) to explain:
  - what the LMS demo contains,
  - how to import it,
  - how to create the application,
  - what demo modules and links are expected,
  - how to regenerate the fixture,
  - what Playwright proofs protect it.
- [ ] Document the clean-import verification workflow on port 3100 using the supported Playwright CLI path.

### Documentation rule

Every touched EN doc must be mirrored by an RU counterpart with the same structure and line count.

---

## File Change Summary

### Likely backend/template files

- `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/services/TemplateManifestValidator.ts`
- `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`
- `packages/applications-backend/base/src/services/runtimeScriptsService.ts`
- `packages/applications-backend/base/src/routes/sync/syncScriptPersistence.ts`

### Likely frontend/runtime files

- `packages/apps-template-mui/src/dashboard/components/runtimeWidgetHelpers.ts`
- `packages/apps-template-mui/src/dashboard/components/ModuleViewerWidget.tsx`
- `packages/apps-template-mui/src/dashboard/components/StatsViewerWidget.tsx`
- `packages/apps-template-mui/src/dashboard/components/QRCodeWidget.tsx`
- `packages/apps-template-mui/src/standalone/GuestApp.tsx`
- relevant EN/RU locale files in `packages/apps-template-mui/src/i18n`

### Likely Playwright / fixture files

- `tools/testing/e2e/support/lmsFixtureContract.ts`
- `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
- `tools/testing/e2e/specs/flows/lms-class-module-quiz.spec.ts`
- `tools/testing/e2e/specs/flows/lms-statistics.spec.ts`
- `tools/testing/e2e/specs/flows/lms-qr-code.spec.ts`
- `tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts`
- `tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts`
- `tools/fixtures/metahubs-lms-app-snapshot.json`

### Likely docs

- touched package `README.md` / `README-RU.md`
- touched GitBook pages under `docs/en/**` and `docs/ru/**`

---

## Risks and Mitigations

### Risk 1: Snapshot becomes too coupled to test-only setup

**Mitigation**: generator must create a canonical product demo state, not temporary assertions-only data.

### Risk 2: Widget scripts work in browser tests but fail after clean import

**Mitigation**: add explicit attachment-scope validation and a clean-import application proof.

### Risk 3: Bilingual content drifts between EN and RU

**Mitigation**: define canonical content pairs in one place and prove both locales in browser/doc flows.

### Risk 4: QR/public link remains application-id dependent in an unsafe way

**Mitigation**: choose one supported canonical strategy for generating or patching the real link and document it as part of fixture regeneration.

### Risk 5: Statistics remain decorative rather than data-backed

**Mitigation**: require non-empty seeded stats inputs and browser assertions for concrete labels and values.

### Risk 6: Scope grows into a new LMS runtime framework

**Mitigation**: keep all work inside current template, widget, script, layout, and GuestApp patterns.

---

## Approval Gate

Implementation should begin only after approval of these decisions:

1. The canonical LMS demo will become a self-contained product sample rather than a minimal E2E artifact.
2. The current LMS snapshot may be structurally regenerated and its demo content replaced.
3. The Playwright generator and product flows will be rewritten together as one protected fixture pipeline.
4. EN/RU docs will be updated in the same delivery wave.
