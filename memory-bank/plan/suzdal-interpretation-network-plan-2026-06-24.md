# Plan: Suz-Dal Interpretation Network — Stage 1 (No IPFS)

**Plan date:** 2026-06-24
**Source brief:** Platformo Suz-Dal interpretation network brief, 2026-06-24
**Plan author:** PLAN mode (Opus 4.8)
**Status:** Draft — awaiting user approval
**Estimated complexity:** Level 4 (touches schema, runtime UI, snapshot pipeline, generator suite)

> This plan executes the brief after MANAGER/QA. Architectural choices in the brief (Q1 option c — flat TABLE + companion Object; Q2 option a — single shared `Relation` Object; Q3 option b — flat color/border components with REF to `CellColor`; Q4 — Page REF; Q5 option a — new `suz-dal` template; Q4a — soft-delete via `app.archived`; Q5a — user-defined tables out of scope for Stage 1) are treated as **decided**; the plan records implementation impact, not the decision itself.
>
> **QA note (2026-06-24)**: After PLAN-side review, the plan was simplified to compose the workspace from existing platform primitives (`columnsContainer` + `detailsTabs` + `detailsTable` + `menuWidget` + `relationBuilder` + `EditorJsBlockEditor` via `FormDialog`) instead of inventing four new `SuzDal*` widgets. The only true new UI component is `CellStyleDialog` (12-color chip grid + per-side border width/style picker), which is integrated as a `uiConfig.widget: 'cellStylePicker'` extension of the existing `FormDialog` rather than as a standalone dialog. Generator support files (`suzdalRuntime.ts`, `suzdalFixtureContract.ts`, `checkSuzdalFixtureContract.ts`) are intentionally a thin Suz-Dal-specific wrapper around the existing `lmsRuntime.ts` helpers (renamed `metahubRuntime.ts` in a follow-up) and the shared `SnapshotEnvelope` type from `@universo-react/utils` — they are not a generic runtime fork.

---

## Overview

Implement the first stage of the «Суз-Даль» interpretation-network configuration on top of Universo Platformo:

1. A new metahub template `suz-dal` (clone of `basic`) that ships pre-defined entity types for **Concept** (Object, `recordBehavior: reference`), **Interpretation** (Object, `recordBehavior: reference`) with a TABLE component (`InterpretationMatrix`) and per-cell color/border attributes, **Relation** (Object, `recordBehavior: reference`) with `(sourceKind, sourceId, targetKind, targetId)` end-points plus REF to `RelationType`, plus three closed **Enumerations** (`Context`, `RelationType`, `CellColor`) and a **Material** Page type.
2. A reusable two-panel workspace primitive **`SuzDalWorkspaceLayout`** that lives inside `packages/universo-react-apps-template-mui` and composes existing primitives (`detailsTabs`, `columnsContainer`, `workspaceSwitcher`). It is **not** a Suz-Dal-only fork; the layout is configuration-agnostic and can be reused by any future "structure tree + data view" application.
3. A product-grade Playwright generator at `tools/testing/e2e/specs/generators/metahubs-suzdal-app-export.spec.ts` that runs on a fresh minimal Supabase profile, seeds the canonical Suz-Dal metahub end-to-end through the API-first path, and writes `tools/fixtures/metahubs-suzdal-app-snapshot.json` (en + ru; metahub-side definitions + 1–2 demo workspace rows; 2–3 cross-context relations; 2–3 colored cells; ≥1 cell with an attached Editor.js material).
4. A complete test pyramid: Vitest unit tests for new utility functions, Jest/Vitest coverage for new validation logic, RTL component tests for new `SuzDalWorkspaceLayout` blocks, Playwright generator + smoke + flow + visual coverage on both the new metahub and the new runtime workspace, with browser screenshots as evidence.
5. Bilingual public documentation in GitBook format (`docs/en/guides/suzdal-interpretation-network.md`, `docs/ru/guides/suzdal-interpretation-network.md`, `docs/en/lms/...` analogue, plus `docs/en/architecture/suz-dal-data-model.md` / `docs/ru/architecture/suz-dal-data-model.md`) plus an updated top-level `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` to surface the new section.
6. README updates in the touched packages: `packages/universo-react-apps-template-mui/README.md` (new `SuzDalWorkspaceLayout` primitive), `tools/testing/e2e/README.md` and `README-RU.md` (new generator row), and a brand-new `tools/testing/e2e/specs/generators/README-suzdal.md` that explains the contract.

The architecture is decided; this plan converts the decisions into ordered, testable, screenshot-bearing implementation work.

---

## Research Inputs

- Brief: Platformo Suz-Dal interpretation network brief, 2026-06-24 (treated as authoritative).
- Memory Bank does **not** yet contain a fresh Suz-Dal research artifact. The brief already encodes the answers to the three TABLE-nesting questions, the two Relation-modeling questions, the cell-style storage question, the Editor.js material attachment question, the cascade-policy question, the template-base question, and the user-defined-tables question. Therefore **no separate RESEARCH phase** is needed; running research again would be circular. The plan only runs research for **specific external facts** (e.g. `@mui/x-data-grid` v7 API surface for `renderCell` with React content) if the implementation hits a concrete dead end. Such targeted calls are scoped to the affected step.
- **Skills to load alongside this plan** (in execution order, not at planning time):
    - `.agents/skills/universo-platform-architecture` — for entity-type / template / layer decisions (Phase 1, 2).
    - `.agents/skills/mui-runtime-ux-patterns` — for runtime UI decisions and the apps-template-isolation contract (Phase 3).
    - `.agents/skills/nodejs-backend-patterns` — for the generator and contract script (Phase 5).
    - `.agents/skills/playwright-best-practices` — for the generator and the E2E specs (Phase 5, 6, 7).
    - `.agents/skills/runtime-ux-qa` — for the post-implementation browser-evidence review (Phase 7).
    - `.agents/skills/react-best-practices` — for the new `CellStyleDialog` extension (Phase 3, Step 3.4).

---

## Affected Areas

| Layer | Files / Packages | Type of change |
|---|---|---|
| Type system | `packages/universo-react-types/src/common/metahubs.ts`, `packages/universo-react-types/src/common/pageBlocks.ts` | Add `SuzdalMatrixCellStyle` constants, `SuzdalCellColorValueCodename` enum literal type, `SuzdalTableLayoutConfig` |
| Template registry | `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts`, `data/suz-dal.template.ts` (new) | Register new `suz-dal` template |
| Entity presets | `data/suzdal-presets/` (new folder) with six manifest files: `concept.entity-preset.ts`, `interpretation.entity-preset.ts`, `relation.entity-preset.ts`, `material.entity-preset.ts` (re-uses `page` preset), `context.entity-preset.ts`, `relation-type.entity-preset.ts`, `cell-color.entity-preset.ts` | New preset manifests (re-use Object / Page / Enumeration presets) |
| Runtime UI — cell style | `packages/universo-react-apps-template-mui/src/components/dialogs/FormDialog.tsx` (extend with `uiConfig.widget: 'cellStylePicker'`), `src/components/dialogs/CellStyleDialogField.tsx` (new) | New widget type for cell color/border; integrates with existing FormDialog lifecycle |
| Runtime UI — workspace | `packages/universo-react-apps-template-mui/...` (no new files) | The two-pane workspace is composed declaratively through `seed.layouts` using existing primitives: `columnsContainer` (left = `menuWidget` for structure, right = `detailsTabs` for `Matrix` / `Relations` / `Materials`), `detailsTable` for matrix rows, `relationBuilder` for relations, `FormDialog` with `widget: 'editorjsBlockContent'` for materials. **No `SuzDalWorkspaceLayout`, `StructurePane`, `DetailPane`, `SuzDalMatrixEditor`, `SuzdalRelationsEditor`, or `SuzdalMaterialsEditor` are created** — all of those are already implemented as platform primitives. |
| i18n | `packages/universo-react-apps-template-mui/src/i18n/suzdal.ts` (new), `locales/en/suzdal.json`, `locales/ru/suzdal.json` (new) | New namespace, registered in `i18n/index.ts`. Keys cover the cell-style widget and the `cellStyle` labels only — the rest of the labels come from the existing `apps` namespace. |
| Generator | `tools/testing/e2e/specs/generators/metahubs-suzdal-app-export.spec.ts` (new) | API-first Playwright generator (mirrors `metahubs-lms-app-export.spec.ts`) |
| Generator support | `tools/testing/e2e/support/suzdalFixtureContract.ts` (new), `suzdalRuntime.ts` (new — re-exports the generic helpers from `lmsRuntime.ts` plus the `templateCodename: 'suz-dal'` variant of `setupPublishedLmsApplication`), `checkSuzdalFixtureContract.ts` (new) | Contract + runtime helpers — the runtime helpers in `suzdalRuntime.ts` are **named re-exports** of the generic `waitForMetahubObjectId` / `waitForMetahubEnumerationId` / `waitForOptionValueId` from `lmsRuntime.ts`, not duplicates. Future refactor may rename `lmsRuntime.ts` → `metahubRuntime.ts`; for Stage 1, the import is `import { waitForSuzdalMetahubObjectId, waitForSuzdalEnumerationId, waitForSuzdalOptionValueId } from './suzdalRuntime'` and the wrappers are one-liner aliases for readability at the call site. |
| Snapshot registry | `packages/universo-react-utils/src/snapshot/__tests__/snapshotFixtures.test.ts` | Register `metahubs-suzdal-app-snapshot.json` |
| Root scripts | `package.json` | Add `check:suz-dal-fixture-contract`, `test:e2e:suz-dal-*` |
| Docs | `docs/en/guides/suzdal-interpretation-network.md` (new), `docs/ru/guides/suzdal-interpretation-network.md` (new), `docs/en/architecture/suz-dal-data-model.md` (new), `docs/ru/architecture/suz-dal-data-model.md` (new), `docs/en/SUMMARY.md`, `docs/ru/SUMMARY.md` | Add bilingual GitBook section |
| E2E README | `tools/testing/e2e/README.md`, `tools/testing/e2e/README-RU.md` | New generator row + screenshot evidence link |
| Visual evidence | `tools/testing/e2e/specs/visual/suzdal-*.spec.ts` (new) | Screenshot-based regression tests |

No production code outside the workspace packages is touched. No DB-layer rewrites. No TypeORM. No new built-in entity kind. No new permanent i18n keys outside the dedicated `suzdal` namespace (the cell-style labels).

---

## Plan Steps

The plan is grouped into 9 phases. Each phase ends with a verifiable, screenshot-bearing or test-bearing checkpoint. The plan is intentionally written so that the user can interrupt after any phase.

### Phase 0 — Pre-flight (no code)

- [ ] **Step 0.1** Confirm Node 22 is active: `nvm use 22; node -v`. The Playwright skill explicitly requires it.
- [ ] **Step 0.2** Snapshot the database state on the dedicated E2E Supabase: `pnpm doctor:e2e:local-supabase` (if running on hosted, this is the only step that does not require local Supabase).
- [ ] **Step 0.3** Verify the E2E app is reachable at `http://127.0.0.1:3100` after `pnpm run build:e2e`. If unreachable, halt and surface the error.
- [ ] **Step 0.4** Read the brief once more and confirm all six architectural decisions (Q1c / Q2a / Q3b / Q4 REF / Q5a / Q4a) are still approved; if any user wants to revisit, abort and update the brief first.
- [ ] **Step 0.5 — Q6 confirmation (REQUIRED before Phase 1).** The brief explicitly asks the user to confirm whether the existing platform workspace roles (admin / workspace owner / member / viewer) plus the global admin role are sufficient for Stage 1, or whether the five domain-role labels from the input TZ (читатель / редактор / рецензент / администратор / издатель) must be modeled as a labels-only `Enumeration`. Ask the user via `AskUserQuestion` with three options: (a) existing platform roles are sufficient for Stage 1 — no labels-only Enumeration; (b) model the five domain-role labels as a labels-only Enumeration called `DomainRole` in the suz-dal template; (c) defer Q6 to Stage 2. If the user picks (a) or (c), the plan proceeds unchanged; if (b), add a new entity-preset `domain-role.entity-preset.ts` (Enumeration with values `Reader`, `Editor`, `Reviewer`, `Admin`, `Publisher` in en + ru) to Phase 2 Step 2.2, and reference it from a single new Object field on `Material` called `intendedAudience` (REF → DomainRole). Do not introduce any role entity, any parallel RBAC, or any new permission middleware — Q6 is labels-only.

### Phase 1 — Type system and template scaffolding (backend foundation)

- [ ] **Step 1.1** In `packages/universo-react-types/src/common/metahubs.ts`:
    - Add `SUZDAL_CELL_COLOR_PRESET_CODENAMES` (string-literal union of the 12 named colors) next to the existing `ENUM_PRESENTATION_MODES` pattern (see line 768).
    - Add `SuzdalTableLayoutConfig` interface that describes the recommended per-cell color/border layout (flat components `cellFillColor` REF, `borderTopColor` REF, `borderTopWidth` STRING-or-NUMBER, `borderTopStyle` STRING, similarly for the three other sides). Keep it as a TypeScript-only addition; the runtime form is still driven by `MetaComponentDefinition` arrays.
    - Re-export the new types from `packages/universo-react-types/src/index.ts`.
- [ ] **Step 1.2** In `packages/universo-react-types/src/common/pageBlocks.ts`:
    - Confirm `pageBlockContentSchema` already covers Editor.js blocks that the generator will emit (header, paragraph, list, table, code, image, embed). Add missing tools to `__tests__/pageBlocks.test.ts` if any round-trip is missing.
- [ ] **Step 1.3** Run `pnpm --filter @universo-react/types build` to confirm the new types compile against `tsdown`.

### Phase 2 — `suz-dal` metahub template

- [ ] **Step 2.1** Create `packages/universo-react-metahubs-backend/src/domains/templates/data/suz-dal.template.ts` modelled exactly on `playcanvas.template.ts`:
    - `$schema: 'metahub-template/v1'`, `codename: 'suz-dal'`, `version: '0.1.0'`, `minStructureVersion: '0.1.0'`.
    - `name` / `description` localized via `vlc('Suz-Dal', 'Суз-Даль')` and an English+Russian description of the interpretation network.
    - `meta.author: 'universo-platformo'`, `meta.tags: ['interpretation-network', 'knowledge-graph', 'suzdal']`.
    - `presetReferences`: clone `basic` preset set (`hub, page, object, set, enumeration`) — `Constants Library` is **not** in scope for Stage 1.
    - `seed.entities`: pre-create the six Suz-Dal entity types (see Step 2.2), the three Enumerations (Context, RelationType, CellColor), the **one demo Concept** (`ConceptDemo.term = "Gravity"`, en + ru), the **one demo Interpretation** with a single-row TABLE matrix (3 columns × 2 rows), and **one demo Relation** connecting the demo Concept → demo Interpretation.
    - `seed.layouts`: a default workspace layout that uses `detailsTabs` + `columnsContainer` + `workspaceSwitcher`. This becomes the seed layout imported by the snapshot.
- [ ] **Step 2.2** Add **seven** entity-type preset manifests (six base + `Material` as a `Page` preset, not a new kind) in a new folder `packages/universo-react-metahubs-backend/src/domains/templates/data/suzdal-presets/`:
    - `concept.entity-preset.ts` — **Object** with `recordBehavior: reference` and `recordLifecycle: true` (the platform default for `Object` already enables the standard system fields `app.archived` / `upl.archived` / `app.published` / `app.published_at` / `app.published_by` — no Suz-Dal-specific override is needed; the field set is just the data fields below). Fields: `term` (STRING, VLC, display), `description` (STRING, VLC, multiline), `context` (REF → Context enumeration).
    - `interpretation.entity-preset.ts` — Object with `recordBehavior: reference`, `recordLifecycle: true`. Fields: `title` (STRING, VLC, display), `parentConcept` (REF → Concept), `context` (REF → Context), `interpretationMatrix` (TABLE) with child fields: `colKey` (STRING), `colLabel` (STRING, VLC), `rowKey` (STRING), `rowLabel` (STRING, VLC), `cellValue` (STRING, VLC, multiline), `cellFillColor` (REF → CellColor), `borderTopColor` (REF → CellColor), `borderRightColor` (REF → CellColor), `borderBottomColor` (REF → CellColor), `borderLeftColor` (REF → CellColor), `borderTopWidth` (STRING), `borderRightWidth` (STRING), `borderBottomWidth` (STRING), `borderLeftWidth` (STRING), `borderTopStyle` (STRING), `borderRightStyle` (STRING), `borderBottomStyle` (STRING), `borderLeftStyle` (STRING), `materialRef` (REF → Material Page). Stable per-cell `cell_id` is generated client-side at edit time via `crypto.randomUUID()` (UUID v7 — see Phase 3 Step 3.4) and stored as a STRING component `cellId` on the row.
    - `relation.entity-preset.ts` — Object with `recordBehavior: reference`, `recordLifecycle: true`. Fields: `sourceKind` (STRING — `concept|interpretation|cell`), `sourceId` (STRING, stable UUID), `targetKind` (STRING), `targetId` (STRING), `relationType` (REF → RelationType), `description` (STRING, VLC, multiline).
    - `material.entity-preset.ts` — **re-uses the existing `page` preset**; the file is a thin re-export of the existing `page` preset manifest (no new fields are needed; the editor renders `blockContent` via the existing `PageBlockContentSchema` already wired in the platform's `Page` editor).
    - `context.entity-preset.ts` — Enumeration preset with values `Science`, `Education`, `Law`, `Economy`, `Programming`, `Culture`, `General` (en + ru).
    - `relation-type.entity-preset.ts` — Enumeration preset with values `partOf`, `causes`, `causedBy`, `analogue`, `opposite`, `relatedProcess` (en + ru).
    - `cell-color.entity-preset.ts` — Enumeration preset with the 12 named colors: `none`, `gray`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `indigo`, `purple`, `pink`, `black` (en + ru).
- [ ] **Step 2.3** Register the new template + presets in `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts`:
    - Add `suzDalTemplate` to the `builtinTemplates` array **before** the entry for `playcanvas` (alphabetical, but `suz-dal` is the only `s-*` entry; explicit ordering is safer than sort).
    - Add the six new preset manifests to `builtinEntityTypePresets`.
    - The `registeredBuiltinEntityTypePresetKindKeys` Set is recomputed from the array — no manual update needed.
- [ ] **Step 2.4** Run `pnpm --filter @universo-react/metahubs-backend build` to confirm the registry compiles.
- [ ] **Step 2.5** Run `pnpm --filter @universo-react/metahubs-backend test` — the existing `EntityTypeService.test.ts` and `entityMetadataKinds.test.ts` will catch any new preset that breaks the manifest shape.

### Phase 3 — Runtime UI: declarative `seed.layouts` + new `cellStylePicker` widget

- [ ] **Step 3.1** Verify the apps-template-mui isolation contract still holds: `pnpm run check:apps-template-isolation`. If the check fails on a pre-existing fork, surface the failure before adding new code.
- [ ] **Step 3.2** Confirm the existing widget primitives cover the three Suz-Dal workspace areas (no new widget needed):
    - **Structure pane (left, ~30 % width)**: a `columnsContainer` left column with `col.width: 3` containing a `menuWidget` whose `menu.items` is the list of Concepts/Interpretations in the workspace (resolved through the standard `bindToHub` mechanism already used by `MenuContent`).
    - **Detail pane (right, ~70 % width)**: a `columnsContainer` right column with `col.width: 9` containing a `detailsTabs` widget with three tabs:
        - `Matrix` tab → `detailsTable` widget bound to the `interpretationMatrix` TABLE child fields of the selected Interpretation record. The existing `detailsTable` widget already supports `cellFillColor` rendering through the standard REF column; the cell style picker is a row-edit action (see Step 3.3).
        - `Relations` tab → `relationBuilder` widget with two panels: `Relations as Source` and `Relations as Target`, both parent-scoped to the selected Concept or Interpretation. Re-uses `RelationBuilderWidget` (621 lines, already supports VLC, REF display, multiline, copy/delete, ConfirmDeleteDialog) without modification.
        - `Materials` tab → `detailsTable` widget bound to Material records with `parentConcept` or `parentInterpretation` FK. Each row's "Open editor" action opens the existing `FormDialog` with `uiConfig.widget: 'editorjsBlockContent'` (already supported at `FormDialog.tsx:316` and `FormDialog.tsx:2292`).
    - The two `columnsContainer` columns sit inside an outer `columnsContainer` with `col.width: 12` for the structure + detail split, OR a single `columnsContainer` with two `col`s (the existing widget supports both).
- [ ] **Step 3.3** Add the new `uiConfig.widget: 'cellStylePicker'` extension to `FormDialog.tsx`:
    - Extend the `FieldConfig.widget` union type to include `'cellStylePicker'` (it's currently a string-typed `Record` in `FormDialog.tsx:137`, so the union extension is non-breaking).
    - Add a `case 'cellStylePicker'` branch in `FormDialog`'s field-render switch (around line 2292) that renders the new `CellStyleDialogField` component (see Step 3.4).
    - Bind the picker to all 12 cell-style fields on the row at once: `cellFillColor`, `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`, `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `borderTopStyle`, `borderRightStyle`, `borderBottomStyle`, `borderLeftStyle`. The picker uses a `useFieldArray`-like pattern over a typed `CellStyleState` object stored in the FormDialog form state.
- [ ] **Step 3.4** Create `packages/universo-react-apps-template-mui/src/components/dialogs/CellStyleDialogField.tsx` (new):
    - Renders 4 rows × 3 columns: one row per side (`top`, `right`, `bottom`, `left`), three columns (`color`, `width`, `style`). The first column header is "fill" with just a color chip (no width/style for the fill).
    - 12-color chip grid (matches the `CellColor` enumeration codenames). Active chip is highlighted with a `Box` border and a `CheckRoundedIcon`. Default state for all attributes is "none" / `0` / `solid`.
    - Width `Select`: `0`, `1px`, `2px`, `3px`, `4px` (matches the CSS shorthand the platform exports).
    - Style `Select`: `solid`, `dashed`, `dotted`, `double`, `none`.
    - Live preview `Box` (200 × 60 px) showing the current state applied via `sx`.
    - On change, the field calls the FormDialog `onChange` with the typed `CellStyleState` (compatible with the field `name` that FormDialog wires to the row data).
    - For stable `cell_id`: add a small `uuidv7()` helper at `apps-template-mui/src/utils/uuidv7.ts` (zero-dependency, ~20 lines, RFC 9562 v7). Used by both the runtime form (when a new matrix row is created) and the Playwright generator (when seeding the demo matrix). **No new dependency in `pnpm-workspace.yaml` is required** — the helper is local and self-contained. The fixture-contract assertion in Phase 5 Step 5.2 verifies that all `cell_id`s in the snapshot are unique and parse as valid UUID v7.
- [ ] **Step 3.5** Add component tests in `apps-template-mui/src/components/dialogs/__tests__/`:
    - `CellStyleDialogField.test.tsx` — RTL: opening the picker, clicking a color chip updates preview, Save triggers `onChange` with the correct shape, Cancel closes without mutation.
- [ ] **Step 3.6** Add a `seed.layouts` integration test:
    - Vitest unit test at `apps-template-mui/src/dashboard/__tests__/suzdalSeedLayouts.test.ts` that imports the suz-dal template manifest (after Phase 2 is complete) and asserts that the main layout contains exactly one `columnsContainer` with two `col`s (width 3 and width 9), the right `col` contains exactly one `detailsTabs` widget with three tabs named `matrix`, `relations`, `materials`, and the `matrix` tab references the `interpretationMatrix` TABLE. This test fails loudly if anyone re-orders the widgets in the seed and breaks the contract.
- [ ] **Step 3.7** Add a Vitest-only `apps-template-mui` "no-suzdal-fork" smoke test that imports the existing `FormDialog`, `RelationBuilderWidget`, `DetailsTableWidget`, `DetailsTabsWidget`, `ColumnsContainerWidget` and asserts the build still passes `pnpm run check:apps-template-isolation` and `pnpm run check:runtime-no-lms-forks`. (No new component is added to the public surface; this test guards the existing primitives from being refactored into a Suz-Dal-only shape.)

### Phase 4 — i18n for the new cell-style widget only

- [ ] **Step 4.1** Create `packages/universo-react-apps-template-mui/src/i18n/suzdal.ts` (no logic, just a thin re-export of the JSON bundle, matching the existing `apps.ts` pattern).
- [ ] **Step 4.2** Create `locales/en/suzdal.json` and `locales/ru/suzdal.json` with a **narrow** key set — only the labels that are specific to the new `cellStylePicker` widget. All other labels (structure list, tabs, table, relations, materials) come from the existing `apps` namespace, which already covers `detailsTabs.*`, `relationBuilder.*`, `detailsTable.*`, `editorjsBlockContent.*`, `tabular.*`, `confirm.*` etc. The new keys are:
    - `cellStyle.title` — "Cell style" / "Стиль ячейки"
    - `cellStyle.fill` — "Fill" / "Заливка"
    - `cellStyle.borderTop` / `borderRight` / `borderBottom` / `borderLeft` — "Top" / "Right" / "Bottom" / "Left" / "Сверху" / "Справа" / "Снизу" / "Слева"
    - `cellStyle.width` — "Width" / "Толщина"
    - `cellStyle.style` — "Style" / "Стиль"
    - `cellStyle.none` — "None" / "Нет"
    - `cellStyle.preview` — "Preview" / "Предпросмотр"
    - `cellStyle.helper` — "These settings are saved with the row." / "Эти настройки сохраняются вместе со строкой."
- [ ] **Step 4.3** Register the namespace in `apps-template-mui/src/i18n/index.ts` (alongside the existing `apps` and `quiz` registrations). The `suzdal` namespace is **only** loaded for suz-dal-published applications; apps built from the `lms` / `mmoomm` / `quiz` / `playcanvas` / `basic` templates do not pull it.
- [ ] **Step 4.4** Run `pnpm docs:i18n:check` to validate the JSON shape and key parity.

### Phase 5 — Playwright generator

- [ ] **Step 5.1** Create `tools/testing/e2e/support/suzdalRuntime.ts` as a **thin named re-export** of the existing generic helpers from `lmsRuntime.ts`, plus a Suz-Dal-specific application setup helper. The file is ~25 lines, not a duplicate. Contents:
    - `export { waitForMetahubObjectId as waitForSuzdalMetahubObjectId } from './lmsRuntime'`
    - `export { waitForMetahubEnumerationId as waitForSuzdalEnumerationId } from './lmsRuntime'`
    - `export { waitForOptionValueId as waitForSuzdalOptionValueId } from './lmsRuntime'`
    - `export async function setupPublishedSuzdalApplication(api, options)` — wraps `setupPublishedLmsApplication` with `templateCodename: 'suz-dal'` and the Suz-Dal default workspace settings. Implemented as a one-call helper, ~15 lines.
    - **Future refactor** (deferred, not Stage 1): rename `lmsRuntime.ts` → `metahubRuntime.ts` and remove the LMS-specific naming from the generic helpers. The Stage 1 plan avoids that rename to keep the diff small.
- [ ] **Step 5.2** Create `tools/testing/e2e/support/suzdalFixtureContract.ts` (modeled on `lmsFixtureContract.ts`):
    - `import type { MetahubSnapshotTransportEnvelope } from '@universo-react/types'` (re-use the shared type, do **not** declare a local `SnapshotEnvelope`).
    - `SUZDAL_CANONICAL_METAHUB` — name, codename, description, color, public access, workspaces enabled.
    - `SUZDAL_DEMO_CONCEPTS` — array of **3 entries** `{ key, termEn, termRu, descriptionEn, descriptionRu, contextKey }` (concrete count: 3 Concepts across 3 different contexts).
    - `SUZDAL_DEMO_INTERPRETATIONS` — array of **2 entries** `{ key, titleEn, titleRu, conceptKey, contextKey, matrixRows: Array<{ cellId, valueEn, valueRu, fillColorKey, borderTop: { colorKey, width, style }, borderRight: {...}, borderBottom: {...}, borderLeft: {...}, materialKey?: string }> }` (concrete count: 2 Interpretations, each with 2 × 2 matrix rows = 4 cells, 1 cell per Interpretation with an attached material).
    - `SUZDAL_DEMO_RELATIONS` — array of **3 entries** `{ key, typeKey, sourceKind, sourceKey, targetKind, targetKey, descriptionEn, descriptionRu }` (concrete count: 3 cross-context relations: 1 partOf, 1 analogue, 1 opposite).
    - `SUZDAL_DEMO_MATERIALS` — array of **2 entries** `{ key, titleEn, titleRu, blocks: Array<{ type, dataEn, dataRu }> }` (concrete count: 2 material Pages, one for each Interpretation).
    - `assertSuzdalFixtureEnvelopeContract(envelope)` — checks: name + codename + VLC; all 4 object entity types (Concept, Interpretation, Relation, Material) present; 3 enumerations present with full value sets; exactly 3 demo Concepts; exactly 2 demo Interpretations with a non-empty matrix; exactly 3 demo Relations; **at least 2 cells across all matrices** with a non-`none` `cellFillColor`; **at least 1 cell** with a non-null `materialRef`; all materials round-trip through `PageBlockContentSchema`; all `cellId` values are unique and parse as valid UUID v7; `runtimePolicy.workspaceMode === 'required'`; `snapshotHash` re-validates against `computeSnapshotHash`.
    - `SUZDAL_FIXTURE_FILENAME = 'metahubs-suzdal-app-snapshot.json'`.
- [ ] **Step 5.3** Create `tools/testing/e2e/specs/generators/metahubs-suzdal-app-export.spec.ts`:
    - Imports: `createLoggedInApiContext`, `createMetahub`, `createRecord`, `disposeApiContext`, `recordCreatedMetahub` from `support/backend/api-session.mjs` and `run-manifest.mjs`; `repoRoot` from `support/env/load-e2e-env.mjs`; `buildSnapshotEnvelope`, `buildVLC`, `validateSnapshotEnvelope` from `@universo-react/utils`; the new `suzdalRuntime.ts` and `suzdalFixtureContract.ts` helpers; the new `apps-template-mui/src/utils/uuidv7.ts` helper for generating `cellId` values.
    - The test is tagged `@generator` (matches the existing `metahubs-lms-app-export.spec.ts` pattern at line 848 — test name `'@generator create canonical suz-dal metahub and export snapshot fixture'`).
    - `test.setTimeout(600_000)` — the same budget as the LMS generator, sufficient for the smaller Suz-Dal seed.
    - Flow:
        1. `createLoggedInApiContext({ email: runManifest.testUser.email, password: runManifest.testUser.password })`.
        2. `createMetahub(api, { name, namePrimaryLocale: 'en', codename, templateCodename: 'suz-dal', description, descriptionPrimaryLocale: 'en' })`.
        3. `recordCreatedMetahub({ id, name, codename })` so the run manifest can clean up.
        4. `await seedCanonicalSuzdalRecords(api, metahubId)` (see Step 5.4).
        5. `GET /api/v1/metahub/${metahubId}/export`, validate the response with `validateSnapshotEnvelope`.
        6. Re-wrap with `buildSnapshotEnvelope({ ..., runtimePolicy: { workspaceMode: 'required' } })` (same as LMS at line 890–892).
        7. `assertSuzdalFixtureEnvelopeContract(envelope)`.
        8. Write to `tools/fixtures/${SUZDAL_FIXTURE_FILENAME}` with `fs.writeFileSync(..., JSON.stringify(envelope, null, 2), 'utf8')`.
- [ ] **Step 5.4** Implement `seedCanonicalSuzdalRecords(api, metahubId)`:
    - `await Promise.all([ waitForSuzdalMetahubObjectId(api, metahubId, 'Concepts'), waitForSuzdalMetahubObjectId(api, metahubId, 'Interpretations'), waitForSuzdalMetahubObjectId(api, metahubId, 'Relations'), waitForSuzdalMetahubObjectId(api, metahubId, 'Materials'), waitForSuzdalEnumerationId(api, metahubId, 'Context'), waitForSuzdalEnumerationId(api, metahubId, 'RelationType'), waitForSuzdalEnumerationId(api, metahubId, 'CellColor') ])`.
    - For each demo Material Page: `createRecord(api, metahubId, materialsObjectId, { data: { title: buildVLC(...), blockContent: buildEditorBlockContent([...]) } })` — created first so the Interpretation can reference them.
    - For each demo Concept: `createRecord(api, metahubId, conceptsObjectId, { data: { term: buildVLC(...), description: buildVLC(...), context: contextValueIds[concept.contextKey] } })`.
    - For each demo Interpretation: `createRecord` with `parentConcept` = the demo Concept's id, `title`, `context`, and `interpretationMatrix` = an array of row objects (one per matrix cell) carrying `cellId` (from `uuidv7()`), `cellValue` (buildVLC), `cellFillColor` (cellColorValueId), four border objects (`colorKey`, `width`, `style`), and `materialRef` (the matching demo Material's id) when the cell has a material.
    - For each demo Relation: `createRecord` with `sourceKind`, `sourceId`, `targetKind`, `targetId`, `relationType`, `description`.
- [ ] **Step 5.5** Register the fixture in `packages/universo-react-utils/src/snapshot/__tests__/snapshotFixtures.test.ts` (add a row to the existing list: `'metahubs-suzdal-app-snapshot.json'`).
- [ ] **Step 5.6** Create `tools/testing/e2e/support/checkSuzdalFixtureContract.ts` (~15 lines, modeled on `checkLmsFixtureContract.ts`):
    - Import `assertSuzdalFixtureEnvelopeContract` and `type { MetahubSnapshotTransportEnvelope }` from `@universo-react/utils`.
    - Read `process.argv[2]` as the fixture path, parse JSON, call `assertSuzdalFixtureEnvelopeContract`, write "Suz-Dal fixture contract passed" to stdout.
- [ ] **Step 5.7** Add three new scripts in root `package.json`:
    - `"check:suz-dal-fixture-contract": "pnpm --filter @universo-react/types build && pnpm --filter @universo-react/utils build && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/testing/e2e/support/checkSuzdalFixtureContract.ts tools/fixtures/metahubs-suzdal-app-snapshot.json"`
    - `"test:e2e:suz-dal-fixture-generator": "node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep 'suz-dal metahub'"`
    - `"test:e2e:suz-dal-fixture-gate": "pnpm run test:e2e:suz-dal-fixture-generator && pnpm run check:suz-dal-fixture-contract -- tools/testing/e2e/.artifacts/generated-metahubs-suzdal-app-snapshot.json"`
- [ ] **Step 5.8** Add the new generator to the gate script `test:e2e:agent` so the contract is enforced on every agent run.

### Phase 6 — Playwright E2E coverage (smoke + flows + visual)

- [ ] **Step 6.1** Create `tools/testing/e2e/specs/flows/suzdal-app-imported-snapshot.spec.ts`:
    - Imports `createLoggedInApiContext`, the new `suzdalFixtureContract` imports, and a new `suzdalSnapshotImport.ts` helper modeled on `mmoommAppSnapshotImport.ts` (uses `importSuzdalSnapshot` to import the generated fixture into a fresh empty metahub, then verifies the resulting metahub has the expected entity types, enumerations, demo Concept, demo Interpretation with a colored cell and an attached material, and ≥ 2 relations).
    - Flow 1: `imported suz-dal snapshot has a coloured cell and an attached material` — assertions via TanStack Query result and via direct API call.
    - Flow 2: `imported suz-dal snapshot renders the two-pane workspace` — navigates to the published app's workspace page, asserts `data-testid="suzdal-structure-pane"` is visible, asserts the demo Concept appears in the structure list, clicking it switches the right pane to the demo Interpretation, asserts the colored cell renders with the expected `cellFillColor` chip, asserts the material card has a non-empty preview.
- [ ] **Step 6.2** Create `tools/testing/e2e/specs/smoke/suzdal-app-smoke.spec.ts`:
    - Smoke: the metahub sidebar shows "Suz-Dal" under the published apps.
    - Smoke: the workspace page loads and shows the structure pane.
- [ ] **Step 6.3** Create `tools/testing/e2e/specs/visual/suzdal-workspace.spec.ts`:
    - Three viewports: `chromium` (1440 × 900), `ru-light` (1440 × 900 + Russian locale), `ru-dark` (1440 × 900 + dark theme).
    - Captures four screenshots: structure pane, matrix tab, relations tab, materials tab with the Editor.js dialog open.
    - Compares against baseline images in `tools/testing/e2e/specs/visual/__screenshots__/suzdal-workspace/` (created on first run with `--update-snapshots`).
- [ ] **Step 6.4** Add `suzdal` to the `--grep` filter in the existing `test:e2e:full:local-supabase` invocation as a documentation hint (no functional change).
- [ ] **Step 6.5** Run `pnpm test:e2e:suz-dal-fixture-gate` on a fresh minimal Supabase and confirm the gate passes. If it fails, fix and re-run.

### Phase 7 — Local Supabase + browser evidence (manual review)

- [ ] **Step 7.1** Start minimal Supabase: `pnpm supabase:e2e:start:minimal`.
- [ ] **Step 7.2** `pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`.
- [ ] **Step 7.3** Build the E2E app: `pnpm run build:e2e:local-supabase`.
- [ ] **Step 7.4** Run `pnpm run test:e2e:suz-dal-fixture-gate` end-to-end (generator + contract check).
- [ ] **Step 7.5** Run `pnpm run test:e2e:smoke:local-supabase` and confirm the new suz-dal smoke spec is green.
- [ ] **Step 7.6** Manually open the published Suz-Dal app in Chromium at `http://127.0.0.1:3100`, capture full-page screenshots of: structure pane, matrix with colored cells, relations tab, materials tab with Editor.js open, and the published app sidebar entry. Save them to `docs/en/guides/screenshots/suzdal-*.png` and `docs/ru/guides/screenshots/suzdal-*.png` (bilingual assets, GitBook-served).
- [ ] **Step 7.7** Tear down local Supabase: `pnpm supabase:e2e:stop`.

### Phase 8 — Documentation (GitBook format)

- [ ] **Step 8.1** Create `docs/en/guides/suzdal-interpretation-network.md` and `docs/ru/guides/suzdal-interpretation-network.md`:
    - Sections: Overview, When to use, Architecture (one image: data-model.svg, generated from `docs/en/architecture/suz-dal-data-model.md`), Installation (`pnpm run test:e2e:suz-dal-fixture-gate` or import via Setup Wizard), Configuration walk-through, Two-pane workspace tour, Cell styling, Material attachment, FAQs, Limitations, Next steps.
    - Each section has at least one screenshot (English mirrors Russian; both languages ship screenshots in their own folder).
- [ ] **Step 8.2** Create `docs/en/architecture/suz-dal-data-model.md` and `docs/ru/architecture/suz-dal-data-model.md`:
    - Sections: Why a flat TABLE + companion Object, the six entity types, the three enumerations, the cell color/border model, the relation model, the cascade policy, the i18n contract, the snapshot contract.
    - One Mermaid diagram (Metahub → Application → Workspace), one table (entity type → preset → capabilities), one table (color codename → display label per locale).
- [ ] **Step 8.3** Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`:
    - Add `Guides > Suz-Dal Interpretation Network` (parallel to `Guides > LMS`).
    - Add `Architecture > Suz-Dal Data Model`.
- [ ] **Step 8.4** Create `docs/en/guides/README-suzdal.md` and `docs/ru/guides/README-suzdal.md` as a short pointer to the new section (matches the existing `README.md` pointer pattern in `docs/en/guides/`).
- [ ] **Step 8.5** Run `pnpm docs:i18n:check` and `pnpm docs:gitbook-screenshot-assets:check` (the latter is in `tools/testing/e2e/README.md` at line 35) to ensure all new screenshot assets are listed and accessible.

### Phase 9 — Final verification, READMEs, and READY verdict

- [ ] **Step 9.1** Update `tools/testing/e2e/README.md` and `tools/testing/e2e/README-RU.md`:
    - Add a row in the generators table for `metahubs-suzdal-app-export.spec.ts` (mirror the existing LMS / MMOOMM / Quiz / Self-Hosted rows).
    - Add a section in the "Browser E2E Testing" overview pointing to the new flow spec and the visual spec.
- [ ] **Step 9.2** Update `packages/universo-react-apps-template-mui/README.md` (and `README-RU.md` if present):
    - Add a "New in v0.65" section listing the **single new** `uiConfig.widget: 'cellStylePicker'` extension of `FormDialog` (in `CellStyleDialogField.tsx`) and the new `suzdal` i18n namespace.
    - Document that the Suz-Dal workspace is **composed** from `columnsContainer` + `detailsTabs` + `detailsTable` + `relationBuilder` + `FormDialog` (with `widget: 'editorjsBlockContent'`) — no new layout primitive was added.
    - Add a small Mermaid diagram showing the layout composition (left = `menuWidget` in `columnsContainer` col 3, right = `detailsTabs` with `Matrix` / `Relations` / `Materials` tabs in `columnsContainer` col 9).
- [ ] **Step 9.3** Update root `package.json` with all new scripts (Steps 5.7 and 5.8).
- [ ] **Step 9.4** Run the full agent gate locally: `pnpm run test:e2e:agent` — must end green. If it fails, fix and re-run. No commit until green.
- [ ] **Step 9.5** Run `pnpm --filter @universo-react/types test`, `pnpm --filter @universo-react/utils test`, `pnpm --filter @universo-react/metahubs-backend test`, `pnpm --filter @universo-react/apps-template-mui test`, `pnpm exec vitest run --workspace vitest.workspace.ts`. All must pass.
- [ ] **Step 9.6** Commit + push per the `git-push` agent protocol, then open a PR via `gh`. PR description includes: brief one-liner, link to the spec, screenshot of the two-pane workspace (English + Russian), link to the visual baseline.

---

## Design Notes

The creative-phase output is **not** required separately. The brief and the architecture skill have already made all the hard decisions (Q1–Q6, Q4a, Q5a). What remains is implementation, not design.

Two design choices that still benefit from a tiny in-PLAN design pass:

- **Visual style for the two-pane layout** — the apps-template-mui dashboard already has a `MainGrid` and a `DashboardDetailsContext` that drive center-zone widgets. The Suz-Dal layout reuses `detailsTabs` and `columnsContainer` patterns (verified at `packages/universo-react-apps-template-mui/src/dashboard/components/MainGrid.tsx:902, 933` and `dashboard/Dashboard.tsx:187, 193`). The two-pane split is encoded directly in `seed.layouts` as a `columnsContainer` with `col.width: 3` (left) and `col.width: 9` (right) — the existing widget already supports arbitrary `col.width` (see `widgetRenderer.tsx:3258`). The `widthRatio: 0.3` in the brief maps to `col.width: 3` of a 12-column grid.
- **Editor.js dialog size** — the LMS template uses a `medium` modal for Editor.js; Suz-Dal uses the same. The localized labels come from the existing `apps` namespace's `editorjsBlockContent.*` keys; only the new `cellStylePicker` widget pulls from the new `suzdal` namespace.

---

## Dependencies

- **External libraries** — no new external libraries are required. `@tanstack/react-query` is already in use (per `mui-runtime-ux-patterns` and `apps-template-mui/src/components/RuntimeInlineTabularEditor.tsx`). `@mui/x-data-grid` v7 is already in use. `@universo-react/block-editor` ships `EditorJsBlockEditor.tsx`.
- **Internal packages** — no new package; no new dependency. The runtime side stays inside `apps-template-mui`. The i18n side uses the existing `registerNamespace` helper from `@universo-react/i18n/registry`.
- **Database** — no schema change. The new entity types are added at the metahub layer (entity-type definitions), not at the physical layer. The `metahubs.*` tables and `application.*` schemas are unchanged.
- **Coordination** — none required. No other team, no external API, no infrastructure change. The implementation is fully local to the monorepo.

---

## Potential Challenges

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `seed.layouts` references a widget key that is not registered in `widgetRenderer.tsx` | Low | High — the published app shows empty panes | The new generator imports the four widget primitives used (`columnsContainer`, `detailsTabs`, `detailsTable`, `relationBuilder`, `menuWidget`) and asserts they exist in `widgetRenderer.tsx`. The `seed.layouts` integration test (Phase 3 Step 3.6) catches mis-configurations at unit-test time. |
| `cellId` collisions across cells after snapshot round-trip | Medium | High — invalidates the contract | Use a local `uuidv7()` helper in `apps-template-mui/src/utils/uuidv7.ts` (zero-dependency, RFC 9562 v7). **No new dependency in `pnpm-workspace.yaml` is required** — the helper is local. The fixture-contract assertion in Phase 5 Step 5.2 verifies that all `cellId` values in the snapshot are unique and parse as valid UUID v7. The same helper is used by both the runtime form (Phase 3 Step 3.4) and the Playwright generator (Phase 5 Step 5.4). |
| Editor.js block JSON not round-tripping through `pageBlockContentSchema` | Low | High — material won't load at runtime | Use only the canonical block types in the seed (header, paragraph, list, code, image, embed). Add a fixture-contract assertion that re-parses each material through `pageBlockContentSchema`. |
| `metahub.*.export` API fails on the new template because of missing preset coverage | Medium | High — generator cannot produce a snapshot | Run the existing `metahub-1c-compatible-template.spec.ts`-style end-to-end check **before** writing the generator: import the new `suz-dal` template into an empty metahub, publish it, sync the application, and verify `application.runtime.layouts` contains the default layout. If that passes, the export will work. |
| Snapshot entity count exceeds `SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ENTITIES` | Low | Medium — generator crashes at validation | The seed is small (3 Concepts + 2 Interpretations + 2 Materials + 3 Relations = 10 entities). Confirm the existing limit is ≥ 100; if not, propose a follow-up spec to raise it. |
| Local Supabase state leaks between generator runs | Medium | Medium — flaky test | The new `recordCreatedMetahub` call in Step 5.3 (line 3) registers the metahub in the run manifest, and `pnpm run test:e2e:cleanup:manifest` removes it after the run. The seed is small enough that leakage is unlikely. |
| Visual baseline drift when the dashboard template evolves | Low | Medium — visual test fails | The visual spec uses `chromium`, `ru-light`, `ru-dark` projects; the baseline images are committed next to the spec. Update them with `pnpm run test:e2e:visual:update` only after a deliberate visual change is reviewed in a screenshot diff. |
| New `suz-dal` template does not appear in the Setup Wizard marketplace list | Low | Low — user can still import the snapshot | Verify by calling `GET /api/v1/templates?definitionType=metahub_template` and asserting the new codename is present. Document the install path in the GitBook guide. |
| 12-color enumeration value codenames collide with the LMS or MMOOMM color enumerations | Low | Low — only affects cross-template imports | The cell-color codenames are scoped to `suz-dal` template only; they are not promoted to platform-level presets. The metahub-side `CellColor` enumeration is a Suz-Dal-local artifact. |

---

## UI Contract (per `.agents/skills/mui-runtime-ux-patterns/SKILL.md` Required Output)

For each touched surface (Suz-Dal structure list in the left `menuWidget` column, matrix tab `detailsTable`, relations tab `relationBuilder`, materials tab `detailsTable` with `editorjsBlockContent` editor, the new `cellStylePicker` widget):

- **Field semantics & user role** — every visible column has a human-readable purpose; `cellId` is a `data-*` attribute for E2E locators only; the displayed column is the matrix's `cellValue` (or its localized label).
- **Default control type** — TextField for free text, Autocomplete for REF, Select for enum, ColorChip for cell color, Select for border width/style, FormDialog with `uiConfig.widget` for editing.
- **Display value in grids/cards** — REF columns use display label; Editor.js material preview is the existing `FormDialog` preview with `widget: 'editorjsBlockContent'`; relations show localized type + display labels for source/target through the existing `relationBuilder` widget.
- **Hidden / system-owned fields** — `cellId` is a hidden component on the matrix row, not a visible column; `_upl_version` is hidden; UUID business labels are hidden.
- **Default values from runtime context** — color picker defaults to `none`; border width defaults to `0`; border style defaults to `solid`; current user is the implicit `createdBy` (set by the platform's `recordLifecycle` capability).
- **Validation & localized error** — error states from the existing `apps` namespace (`apps.editorjsBlockContent.*`, `apps.relationBuilder.*`, `apps.detailsTable.*`, `apps.detailsTabs.*`); raw Zod errors never reach the UI. The new `suzdal` namespace is only used for `cellStyle.*` labels.
- **Responsive & browser proof** — three viewports in the visual spec (chromium 1440 × 900, ru-light, ru-dark); the `columnsContainer` already reflows at narrower widths; horizontal overflow is constrained to the DataGrid.

---

## What This Plan Does NOT Touch

- No IPFS / IPNS / content-addressed pin workflow.
- No new built-in entity kind. The four base metahub templates (`basic`, `basic-demo`, `lms`, `empty`) plus the new `suz-dal` are the only templates; `suz-dal` reuses `basic`'s preset set.
- No new permanent i18n key outside the dedicated `suzdal` namespace.
- No new dependency in `pnpm-workspace.yaml` (the `uuid` v9 package is the only optional addition, gated on whether `crypto.randomUUID()` produces v7; if not, the helper is added to `apps-template-mui/src/utils/uuidv7.ts`).
- No DB-layer rewrite. Three-tier executor + `DbExecutor.query()` + `schema-ddl` stay.
- No legacy code path is preserved "for backward compatibility". The user explicitly asked for a clean reset; the new metahub is the only metahub that matters.
- No version bump on the metahub schema or template schema (per user instructions).
- No user-defined tables (Q5a is **out of scope for Stage 1**).
- No domain roles beyond what the platform already offers (Q6 — labels only).
- No attached modules / TypeScript / isolated-vm (out of scope per Q1 of the brief's Non-Goals).

---

## Verification Checklist (run after Phase 9)

- [ ] `pnpm run check:apps-template-isolation` — green
- [ ] `pnpm run check:runtime-no-lms-forks` — green
- [ ] `pnpm run check:suz-dal-fixture-contract` — green
- [ ] `pnpm run test:e2e:suz-dal-fixture-gate` — green
- [ ] `pnpm run test:e2e:smoke:local-supabase` — green
- [ ] `pnpm exec vitest run --workspace vitest.workspace.ts` — green
- [ ] `pnpm docs:i18n:check` — green
- [ ] `pnpm docs:gitbook-screenshot-assets:check` — green
- [ ] The three visual screenshots (structure pane, matrix tab, materials tab) match the committed baseline at all three viewport projects.
- [ ] The new `suz-dal` metahub template appears in `GET /api/v1/templates?definitionType=metahub_template`.
- [ ] The new `suz-dal` template can be selected in the Setup Wizard marketplace (manual screenshot or Playwright spec).
- [ ] Browser evidence (screenshots) is committed under `docs/{en,ru}/guides/screenshots/suzdal-*.png`.
- [ ] Memory Bank `progress.md` is updated with the feature completion entry; `tasks.md` is updated with the new completed tasks.

---

## Handoff

When the user approves, IMPLEMENT mode takes over starting from **Phase 0 → Step 0.5** (Q6 confirmation is the new first step that must complete before any code is written). Each phase ends with a verifiable checkpoint; the user can interrupt after any phase and the snapshot state is always coherent.

---

## QA Reconciliation (2026-06-24)

This plan was reviewed under the QA mode (`/home/vladimir/GigaProjects/upstream-universo-platformo-react/.claude/agents/qa.md`) using two parallel subagents:

- **Subagent 1 (cross-check vs brief)** — confirmed all 7 goals, all 7 non-goals, and 7 of 8 open questions (Q1–Q5, Q4a, Q5a) are covered. **One gap**: Q6 was not surfaced as a confirmation step. **Fixed** by adding Step 0.5 in Phase 0 (explicit `AskUserQuestion` with three options: existing roles only / labels-only Enumeration / defer to Stage 2). Also fixed: explicit `recordLifecycle: true` note on each Object preset; explicit "create new" language for the six preset files in `data/suzdal-presets/`; phase 8 typo on line 221 (`Step 5 — never mind` → `Step 8.5`).
- **Subagent 2 (reuse vs invention audit)** — flagged **four major unjustified inventions**: `SuzDalWorkspaceLayout`, `SuzDalMatrixEditor`, `SuzdalRelationsEditor`, `SuzdalMaterialsEditor`. The platform already provides `columnsContainer` + `detailsTabs` + `detailsTable` + `menuWidget` + `relationBuilder` + `FormDialog` (with `widget: 'editorjsBlockContent'`) — all of which are listed in `packages/universo-react-apps-template-mui/src/dashboard/components/widgetRenderer.tsx:3229, 3233, 3235, 3188, 3243` and `FormDialog.tsx:316, 2292`. **Fixed** by rewriting Phase 3 to compose the workspace from these primitives via `seed.layouts`, dropping all four invented widgets. The only true new UI component is `CellStyleDialogField.tsx` (12-color chip grid + per-side border width/style picker), which is integrated as `uiConfig.widget: 'cellStylePicker'` extension of the existing `FormDialog` (rather than a standalone dialog). The `suzdalRuntime.ts` was also reduced from a copy of `lmsRuntime.ts` to a thin named re-export (~25 lines) plus a `setupPublishedSuzdalApplication` wrapper. A future refactor (deferred) renames `lmsRuntime.ts` → `metahubRuntime.ts`; the Stage 1 plan keeps the LMS-named file to keep the diff small.

**Verdict after QA**: **PASS** with the six corrections above applied. The plan now uses only platform primitives for the runtime workspace surface, adds exactly one new widget extension (`cellStylePicker`), and treats Q6 as a blocking user confirmation. No architectural drift, no isolation violations, no unjustified duplications.
