# Progress Log

> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

## IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release      | Date       | Codename                    | Highlights                                                                               |
| ------------ | ---------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| 0.62.0-alpha | 2026-05-06 | Dynamic Portal 🌀           | LMS portal runtime MVP, Page entity authoring, Node.js 22 migration                      |
| 0.61.0-alpha | 2026-04-30 | Hardened Surface 🛡️         | Data-driven entity resource surfaces, runtime workspace management, GitBook docs refresh |
| 0.60.0-alpha | 2026-04-23 | Academic Foundation 🎓      | LMS MVP platform support, application layout management, empty template                  |
| 0.59.0-alpha | 2026-04-17 | Universal Entities 🧩       | Entity Component Architecture, entity-first transition, i18n refactoring                 |
| 0.58.0-alpha | 2026-04-08 | Ancient Manuscripts 📜      | Metahub scripting, quiz runtime, General section, shared attributes                      |
| 0.57.0-alpha | 2026-04-03 | Good Eyesight 🧐            | Playwright E2E coverage, QA hardening, controllers extraction                            |
| 0.56.0-alpha | 2026-03-27 | Cured Disease 🤒            | JSONB/VLC unification, security fixes, CSRF middleware                                   |
| 0.55.0-alpha | 2026-03-19 | Best Role 🎬                | Bootstrap superuser, admin roles, metapanel dashboard, workspaces                        |
| 0.54.0-alpha | 2026-03-13 | Beaver Migration 🦫         | Knex.js migration system, system app convergence, optimistic CRUD                        |
| 0.53.0-alpha | 2026-03-05 | Lucky Set 🍱                | Sets and constants, drag-and-drop ordering, metahub settings                             |
| 0.52.0-alpha | 2026-02-25 | Tabular Infinity 🤪         | TABLE attribute type, inline editing, NUMBER field improvements                          |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢          | Enumerations, migration guard, data-driven MainGrid                                      |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️               | Template system, declarative DDL, layout widgets, cloning                                |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮              | Layouts system, MUI 7 migration, display attributes, VLC support                         |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏                | Metahub branches, three-level system fields, optimistic locking                          |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶      | Publication versioning, schema-ddl package, runtime migrations                           |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊           | Applications modules, metahubs publications, DDD refactoring                             |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳     | Catalogs functionality, VLC localization, i18n integration                               |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding wizard, GDPR consent, Yandex SmartCaptcha                                     |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️‍♂️               | Onboarding wizard, start pages i18n, pagination fixes                                    |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯‍♀️             | VLC system, dynamic locales, Flowise 3.x agents integration                              |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄           | UUID v7 infrastructure, auth-frontend package, dynamic roles                             |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹            | Admin panel with RBAC, package extraction, global naming refactoring                     |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿          | Campaigns integration, storages management, useMutation pattern                          |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷      | Organizations module, projects hierarchy, AR.js quiz nodes                               |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅          | Agents system, clusters module, OpenAPI 3.1 refactoring                                  |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | Metaverse dashboard, analytics charts, sections refactoring                              |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃               | Rate limiting with Redis, i18n refactoring, TypeScript modernization                     |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️              | Global monorepo refactoring, tsdown implementation, dependency centralization            |
| 0.33.0-alpha | 2025-10-16 | School Test 💼              | Metaverses module, quiz timer, publication system fixes                                  |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴            | Publication system, Base58 links, access control, role-based permissions                 |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆         | Canvas versioning, Material-UI template system, UPDL refactoring                         |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪                | Passport.js + Supabase hybrid auth, Vitest coverage, AR.js camera mode                   |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒         | Metaverses architecture, cluster/domain/resource isolation, publication settings         |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨           | Resources and entities services, spaces refactoring, CTE queries                         |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣           | Template modularization, finance module, multiplayer-colyseus integration                |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌            | MMOOMM template extraction, PlayCanvas integration, Kiro IDE config                      |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼            | Metaverse module MVP, Space Builder, Gemini Code Assist rules                            |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌         | Space Builder prompt-to-flow, AR.js wallpaper mode, uniks extraction                     |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️       | UPDL conditional parameters, custom modes system, Russian docs                           |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️          | MMOOMM modular architecture, laser mining, inventory refactoring                         |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪             | PlayCanvas MMOOMM stabilization, handler refactoring, ship controls                      |

---

## Completed: Research-Aware Planning Workflow (2026-05-16)

The agent workflow now has a dedicated research-aware path for link-driven and current-information planning.

### Changes Made

- Added `RESEARCH` / `RPLAN` custom mode rules in `.gemini/rules/custom_modes/research_mode.md`.
- Updated `AGENTS.md` routing so the new research mode is part of the repository mode sequence.
- Updated `VAN` mode so it recommends `RESEARCH` / `RPLAN` before PLAN when the task includes links or current external facts.
- Updated `PLAN` mode so missing research no longer blocks planning; PLAN now completes required research inline or through a research-capable subagent when available, saves findings to `memory-bank/research/`, and continues planning.
- Updated PLAN behavior so agents save Markdown plans into `memory-bank/plan/` by default unless the user explicitly requests another destination or chat-only output.
- Mirrored the same research mode and PLAN research handling across `.github/agents`, `.claude/agents`, `.qoder/agents`, and `.kiro/steering/custom_modes`.
- Updated `.gemini/GEMINI.md` so Gemini CLI context routing includes `RESEARCH` / `RPLAN`.
- Added durable research artifact storage under `memory-bank/research/`.
- Imported `agents-best-practices` as a complete project-local skill.
- Imported a curated AI Research skill subset: `brainstorming-research-ideas`, `creative-thinking-for-research`, `instructor`, `dspy`, `langsmith`, and `ml-paper-writing`.
- Added the local `research-before-plan` skill with research artifact, source quality, and PLAN handoff references.
- Added `.agents/skills/SOURCES.md` to preserve source and license attribution for imported Skills.

### Validation

- Manual structure validation performed with `find`/`sed`/`rg`.
- No package build or test run was needed because the change only affects repository workflow rules, Memory Bank documentation, and agent skill files.

## Completed: LMS Platform Implementation Slice 7F - Operational Workflow Playwright Proof (2026-05-15)

Phase 7 now has browser/API E2E proof for the operational LMS workflow metadata generated from the snapshot fixture.

### Changes Made

- Extended `snapshot-import-lms-runtime.spec.ts` to exercise every configured LMS workflow action after snapshot import, linked application creation, schema sync, workspace runtime initialization, and role-policy capability grants.
- Covered assignment submission review actions, training attendance actions, certificate issue/revoke actions, development task actions, and notification outbox actions through the trusted runtime workflow endpoint.
- Verified optimistic version advancement and trusted response metadata for each action instead of relying on client-provided action JSON.
- Updated the runtime flow assertions to match the current LMS dashboard, Knowledge page, and Development page contracts.
- Fixed the shared published-app `ItemCard` primitive so clickable cards with inline action buttons do not render invalid nested `<button>` elements. Cards with inline actions now use a keyboard-accessible `div role="button"` wrapper while simple cards continue using `CardActionArea`.

### Validation

- `pnpm exec eslint --fix packages/apps-template-mui/src/components/runtime-ui/index.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
- `pnpm --filter @universo/apps-template-mui test -- RuntimeWorkspacesPage`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`

---

## Completed: LMS Platform Implementation Slice 7A - Trusted Runtime Workflow Action Endpoint (2026-05-15)

The first Phase 7 operational workflow slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

- Added `POST /applications/:applicationId/runtime/rows/:rowId/workflow/:actionCodename`.
  - The request accepts only `objectCollectionId` and a required `expectedVersion`.
  - The server resolves the workflow action from the selected Object metadata, not from client-provided JSON.
  - The existing runtime workflow action service applies status transitions with optimistic locking, workspace gating, capability checks, and audit facts.
- Reused existing runtime access checks.
  - The route requires `editContent`.
  - The workflow capability map includes the same aliases used by effective role-policy resolution, including `workflow.execute` for edit-capable roles.
- Added focused route coverage.
  - A configured action transitions the row and writes audit metadata.
  - An unconfigured action fails before any runtime row table is touched.

### Validation

- `pnpm --dir packages/applications-backend/base exec eslint --fix src/controllers/runtimeRowsController.ts src/routes/applicationsRoutes.ts src/tests/routes/applicationsRoutes.test.ts`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions applicationsRoutes.test.ts -t "workflow actions" --runInBand`

---

## Completed: LMS Platform Implementation Slice 6F - Details Table Workflow Action Editor (2026-05-15)

Phase 6 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

- Added typed `workflowActions` support to the generic `detailsTable` widget config contract.
  - The contract reuses the neutral workflow action schema from `@universo/types`.
  - Invalid workflow actions fail schema validation instead of being stored as arbitrary widget JSON.
- Extended the existing Application Layout widget behavior editor instead of adding a duplicate LMS-specific workflow screen.
  - Admins can configure action codename, title, source statuses, target status, required capabilities, status field metadata, optional script hook, posting command, and confirmation copy.
  - Workflow action settings are normalized before save and incomplete action slots are removed.
  - Missing or incomplete workflow settings show localized warning previews before save.
- Added English and Russian i18n labels for workflow action settings and warning copy.
- Added focused regression coverage for shared widget config contracts and editor normalization/warnings.
- Kept runtime mutation execution on the existing trusted backend workflow action service.
  - The published runtime must not execute actions directly from client-provided widget JSON.
  - A future runtime action button surface should resolve action contracts from trusted application metadata before calling the workflow mutation service.

### Validation

- `pnpm --filter @universo/types lint`
- `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/applications-frontend lint`
- `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
- `pnpm --filter @universo/applications-frontend build`

Note: the editor test still logs the existing MUI Select `anchorEl` JSDOM warning when opening menus. The test assertions pass.

---

## Completed: LMS Platform Implementation Slice 6E - Inline Report Definitions For Details Tables (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for workflow action settings editors.

### Changes Made

- Added typed inline `reportDefinition` support to the generic `detailsTable` widget config contract.
  - The contract reuses the existing neutral report definition schema.
  - Invalid inline reports fail schema validation instead of being accepted as arbitrary widget JSON.
- Extended the existing Application Layout widget behavior editor instead of adding a report-specific screen.
  - Admins can configure report codename, title, description, output columns, filters, and aggregations.
  - The editor can reuse the existing detailsTable datasource as the report datasource.
  - Incomplete or invalid report definitions show localized warning previews before save.
- Extended the published-app runtime table path.
  - `detailsTable` widgets with an inline report definition run through the existing runtime reports endpoint.
  - Runtime report rows are displayed through the existing shared data grid contract.
  - The runtime report API helper now accepts either saved report references or inline report definitions.
- Added English and Russian i18n labels for report definition settings and warnings.
- Added focused regression coverage for shared widget config contracts, editor normalization/warnings, API requests, and runtime rendering.

### Validation

- `pnpm --filter @universo/types lint`
- `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/applications-frontend lint`
- `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/apps-template-mui lint`
- `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/api/__tests__/runtimeReports.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`
- `pnpm --filter @universo/apps-template-mui build`

Note: the editor test still logs the existing MUI Select `anchorEl` JSDOM warning, and the runtime widget test still logs the existing missing i18next test-instance warning. The assertions pass.

---

## Completed: LMS Platform Implementation Slice 6D - Details Table Sequence Policy Editor (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for report definition and workflow action settings editors.

### Changes Made

- Added typed `sequencePolicy` support to the generic `detailsTable` widget config contract.
  - The contract reuses the neutral sequence/completion schema from `@universo/types`.
  - Invalid policies fail schema validation instead of being accepted as arbitrary widget JSON.
- Extended the existing Application Layout widget behavior editor instead of adding an LMS-specific sequence UI.
  - Admins can configure free, sequential, scheduled, and prerequisite modes.
  - Sequential, scheduled, prerequisite, retry, attempt, and completion-condition settings are normalized before save.
  - Empty or incomplete non-free sequence policies show localized warning previews.
- Added English and Russian i18n labels for sequence policy settings and warnings.
- Added focused regression coverage for shared widget config contracts and editor normalization/warnings.

### Validation

- `pnpm --filter @universo/types lint`
- `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/applications-frontend lint`
- `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
- `pnpm --filter @universo/applications-frontend build`

Note: the editor test still logs the existing MUI Select `anchorEl` JSDOM warning when opening menus. The test assertions pass.

---

## Completed: LMS Platform Implementation Slice 6C - Generic Resource Preview Layout Widget (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for report, workflow, and sequence settings editors.

### Changes Made

- Added a generic `resourcePreview` dashboard layout widget.
  - Registered it in shared dashboard widget metadata.
  - Added a typed `resourcePreviewWidgetConfigSchema` in `@universo/types`.
  - Reused the existing `ResourcePreview` runtime component in `packages/apps-template-mui`.
- Extended the existing Application Layout widget behavior editor instead of adding a new LMS-specific UI.
  - Admins can configure title, description, resource type, launch mode, URL, page codename, storage key, and MIME type.
  - The editor keeps valid resource source settings and drops invalid sources during normalized saves.
  - Invalid, missing, and deferred resource sources now show localized warning previews.
- Added English and Russian i18n labels for resource preview widget settings.
- Added regression coverage for shared widget config contracts, the structured editor, and runtime widget rendering.

### Validation

- `pnpm --filter @universo/types lint`
- `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/applications-frontend lint`
- `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/apps-template-mui lint`
- `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`
- `pnpm --filter @universo/apps-template-mui build`

Note: an early parallel test attempt overlapped with `@universo/types` build cleaning `dist`, so Vite temporarily could not resolve `@universo/types`. The sequential rerun after the build passed.

## Completed: LMS Platform Implementation Slice 6B - Widget Datasource Validation Preview (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for report, workflow, sequence, and resource settings editors.

### Changes Made

- Reused the existing `ApplicationWidgetBehaviorEditorDialog` instead of adding a new LMS-specific editor.
- Added a localized warning preview for incomplete widget datasource settings:
  - records list datasources without a section target
  - ledger datasources without a ledger target
  - ledger projections without a projection codename
  - chart datasources without X-axis or series fields
  - unsupported overview card metrics that will be removed on save
- Kept the existing fail-closed normalization behavior, so invalid datasource settings are still stripped or reduced before persistence.
- Added English and Russian i18n keys for the new validation warnings.
- Added regression coverage for incomplete datasource previews and unsupported overview metric previews.

### Validation

- `pnpm --filter @universo/applications-frontend lint`
- `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
- `pnpm --filter @universo/applications-frontend build`

Note: package-script Vitest runs that attempted to pass filename or `-t` filters still executed the broader suite in this workspace. Those broad runs reported existing timeout flakes in `ApplicationSettings` and `ApplicationLayouts`, plus one coverage temp-file collision when two broad runs overlapped. The direct single-file Vitest run for this slice passed.

## Completed: LMS Platform Implementation Slice 6A - Control Panel Role Policy Safety (2026-05-15)

The first Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for the broader widget, report, workflow, sequence, and resource settings editors.

### Changes Made

- Added shared role-policy safety helpers in `@universo/types`:
  - `collectUnsupportedActiveCapabilityRules()` reports active grants that use unsupported scopes.
  - `sanitizeApplicationRolePolicySettingsForSupportedScopes()` downgrades unsupported active grants to deny rules.
- Reused the existing Application Settings Access tab instead of adding a parallel UI surface.
  - Imported unsupported scoped active grants now show a localized warning preview.
  - Saving settings sanitizes unsupported grants before persistence.
- Added frontend save safety:
  - General/access settings saves now update the application detail query optimistically.
  - Failed saves roll back to the previous TanStack Query cache state.
- Added backend fail-closed persistence:
  - Application settings updates sanitize `rolePolicies` before merge and storage.
  - API bypasses cannot persist unsupported scoped active grants.
- Added localized English and Russian warning copy.
- Added focused regression coverage for shared helpers, frontend settings saves, and backend route updates.

### Validation

- `pnpm --filter @universo/types lint`
- `pnpm --filter @universo/types test -- lmsPlatform workflowActions --runInBand`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/applications-frontend lint`
- `pnpm --filter @universo/applications-frontend test -- ApplicationSettings.test.tsx --runInBand`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts -t "downgrades unsupported scoped active role policy grants" --runInBand`

Note: the broader `applicationsRoutes.test.ts guards.test.ts` backend test pattern still reports pre-existing runtime-script route failures unrelated to this slice. The new targeted backend route regression passes.

## Completed: LMS Platform Implementation Slice 4 - Generic Workflow Actions (2026-05-15)

Phase 4 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

- Added neutral workflow action contracts in `@universo/types`
  - `workflowActionSchema` now supports action codename, source statuses, target status, status field metadata, required capabilities, confirmation metadata, script hook codename, and optional posting command
  - Scoped capability contracts moved out of the LMS-specific platform file
- Added fail-closed workflow action availability evaluation
  - Actions require explicit source statuses and explicit capabilities
  - Missing capabilities deny execution
  - `recordOwner`, `department`, `class`, and `group` scoped capabilities deny execution until their predicates are implemented
- Added SQL-first runtime workflow action mutation service
  - Uses `qSchemaTable()` and `qColumn()` for dynamic identifiers
  - Requires a current positive `_upl_version`
  - Checks row lock, workspace context, current status, and current version before mutation
  - Uses `RETURNING` and fails closed on zero-row update results
- Added generic workflow action audit persistence
  - Runtime schemas now include `_app_workflow_action_audit`
  - Audit facts store object, table, row, workspace, action, from/to statuses, posting command, metadata, and audit user fields
- Added direct regression coverage
  - Workflow action contract parsing and availability rules
  - Backend mutation, audit insert, missing capability denial, version requirement, and unsupported scope denial
  - Schema generator creation of the audit system table

### Validation

- `pnpm --filter @universo/types lint` - PASSED
- `pnpm --filter @universo/types test -- workflowActions lmsPlatform --runInBand` - PASSED
- `pnpm --filter @universo/types build` - PASSED
- `pnpm --filter @universo/applications-backend lint` - PASSED
- `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions.test.ts runtimeRecordBehavior.test.ts --runInBand` - PASSED
- `pnpm --filter @universo/schema-ddl test -- SchemaGenerator --runInBand` - PASSED
- `pnpm --filter @universo/schema-ddl build` - PASSED
- `pnpm --filter @universo/schema-ddl lint` - PASSED with existing warnings only
- `pnpm --filter @universo/applications-backend build` - PASSED after the concurrent `schema-ddl build` finished
- `git diff --check` - PASSED

## Completed: LMS Platform Implementation Slice 3 - Generic Sequence And Completion Engine (2026-05-15)

Phase 3 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

- Added neutral sequence and completion contracts in `@universo/types`
  - `sequencePolicySchema` and `completionConditionSchema` now live in a shared module instead of the LMS-specific platform contract file
  - Sequence availability supports free, sequential, scheduled, and prerequisite-gated modes
  - Completion conditions support progress percentage, score percentage, attendance, certificate, manual, and all-steps-completed rules
- Added deterministic progress helpers
  - `calculateWeightedProgress()` handles mixed completion items with optional weights, partial progress, and scored pass/fail results
  - `isCompletionItemComplete()` gives runtime code one consistent completion predicate
- Reused the shared progress helper from the standalone guest LMS runtime path
  - Guest module progress now goes through the shared completion engine instead of an inline local formula
- Added focused regression tests
  - Weighted progress, completion conditions, sequential locking, scheduled locking, prerequisite locking, and LMS schema compatibility are covered

### Validation

- `pnpm --filter @universo/types lint` - PASSED
- `pnpm --filter @universo/types test -- sequenceCompletion lmsPlatform --runInBand` - PASSED
- `pnpm --filter @universo/types build` - PASSED
- `pnpm --filter @universo/apps-template-mui lint` - PASSED
- `pnpm --filter @universo/apps-template-mui test -- src/standalone/__tests__/GuestApp.test.tsx --runInBand` - PASSED
- `pnpm --filter @universo/apps-template-mui build` - PASSED
- `git diff --check` - PASSED

## Completed: LMS Platform Implementation Slice 2 - Generic Resource Engine (2026-05-15)

Phase 2 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

- Added shared safe resource source contracts in `@universo/types`
  - `parseSafeExternalUrl()` and `normalizeSafeExternalUrl()` allow only absolute `http`/`https` URLs
  - URL credentials, control characters, relative URLs, unsupported protocols, unsupported early MIME types, and unapproved embed hosts fail closed
  - `resourceSourceSchema` now covers `page`, `url`, `video`, `audio`, `document`, `embed`, `file`, and deferred `scorm`
- Reused shared resource contracts from LMS resource definitions and Page block validation
  - Image blocks use the safe external URL schema
  - Embed blocks use the explicit runtime embed allowlist
- Added generic published-app `ResourcePreview`
  - Renders page, URL, video, audio, document, and embed sources without LMS-specific screens
  - Shows explicit deferred state for SCORM, file, and storage-backed resources
  - Uses sandboxed iframes for allowed embeds
- Added backend write validation for configured JSON fields
  - `uiConfig.widget = "editorjsBlockContent"` normalizes through canonical block content validation
  - `uiConfig.widget = "resourceSource"` normalizes through `resourceSourceSchema`
  - Runtime row create/update paths now reject invalid configured JSON payloads even when bypassing the UI
- Expanded the LMS resource fixture contract and seeded current fixture coverage
  - Fixture now includes page, URL, video, audio, document, embed, and deferred SCORM resource sources
  - `LearningResources.Source` carries `uiConfig.widget = "resourceSource"`
  - Generator maps every resource source type to the matching `ResourceType` enumeration value

### Validation

- `pnpm --filter @universo/types build` - PASSED
- `pnpm --filter @universo/types lint` - PASSED
- `pnpm --filter @universo/types test -- resourceSources pageBlocks lmsPlatform --runInBand` - PASSED
- `pnpm --filter @universo/apps-template-mui lint` - PASSED
- `pnpm --filter @universo/apps-template-mui test -- src/components/resource-preview/__tests__/ResourcePreview.test.tsx --runInBand` - PASSED
- `pnpm --filter @universo/apps-template-mui build` - PASSED
- `pnpm --filter @universo/applications-backend lint` - PASSED
- `pnpm --filter @universo/applications-backend test -- runtimeHelpers.test.ts runtimeRowsController.test.ts --runInBand` - PASSED
- `pnpm --filter @universo/applications-backend build` - PASSED
- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand` - PASSED
- `pnpm --filter @universo/metahubs-backend build` - PASSED
- Manual Node fixture assertion verified snapshot hash, `LearningResources.Source` UI config, required resource source types, and deferred SCORM placeholder

## Completed: LMS Platform Implementation Slice 1 (2026-05-15)

The first implementation slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

- Isolated `packages/apps-template-mui` from `@universo/template-mui`
  - Added local runtime UI primitives and `useListDialogs`
  - Removed the package dependency
  - Added a package-boundary regression test
- Hardened published application runtime permissions
  - `createContent`, `editContent`, and `deleteContent` now fail closed unless explicitly `true`
  - Inline BOOLEAN editing is disabled when edit permission is not explicitly granted
  - Added regression coverage for missing, null, malformed, and denied permissions
- Added metadata-driven app-side block content authoring
  - Added an isolated Editor.js block editor to `packages/apps-template-mui`
  - Propagated component `uiConfig` into runtime `FieldConfig`
  - Added `JSON` field support for `uiConfig.widget = "editorjsBlockContent"`
  - Added localized block editor labels
- Replaced current LMS surrogate menu targets
  - Knowledge now targets `KnowledgeArticle`
  - Development now targets `DevelopmentPlans`
  - Added fixture contract gates preventing Knowledge -> Quizzes and Development -> Classes regressions
  - Updated the current LMS snapshot fixture and runtime E2E expectations

### Validation

- `pnpm --filter @universo/apps-template-mui build` - PASSED
- `pnpm --filter @universo/apps-template-mui lint` - PASSED
- `pnpm --filter @universo/apps-template-mui test -- src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx src/utils/__tests__/columns.test.tsx src/__tests__/packageBoundary.test.ts --runInBand` - PASSED
- `pnpm --filter @universo/applications-frontend lint` - PASSED
- `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationRuntime.test.tsx --runInBand` - PASSED
- `pnpm --filter @universo/metahubs-backend build` - PASSED
- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand` - PASSED
- Manual Node fixture assertion verified LMS menu targets in `tools/fixtures/metahubs-lms-app-snapshot.json`

## Completed: Documentation Refresh - Final Validation (2026-05-15)

Phase 6 final validation completed successfully. All documentation checks passed.

### Changes Made

- Fixed broken links in `docs/en/guides/README.md` and `docs/ru/guides/README.md`
  - Removed references to deleted UPDL and Multi-Platform Export guides
  - Added references to all current guides (LMS, Pages, Ledgers, etc.)
- Updated `tools/docs/check-i18n-docs.mjs` configuration
  - Removed deleted pages from `requiredScreenshotPages` list
  - Updated `screenshotExemptPages` to include new guides
- Verified EN and RU SUMMARY.md structure matches exactly
- Verified all 72 EN/RU page pairs have matching line counts and structure

### Validation

- `pnpm docs:i18n:check` - PASSED
- Checked 72 EN/RU page pairs
- No broken links found
- All structural checks passed (headings, code fences, bullets, lists, images, tables)
- Screenshot coverage verified

### Summary of Complete Documentation Refresh

**Phases Completed:**
1. ✅ Analysis (QA) - Identified gaps and outdated content
2. ✅ Content Deletion - Removed 26 files of non-existent functionality
3. ✅ Platform Section Updates - Updated core platform documentation
4. ✅ Pages Entity Documentation - Created comprehensive Pages guide (EN + RU)
5. ✅ Screenshot Generation - Generated 14 entity screenshots per locale
6. ✅ Final Validation - All documentation checks passed

**Impact:**
- Documentation now accurately reflects platform capabilities
- No misleading information about non-existent features
- Comprehensive Pages entity guide with Editor.js integration
- All screenshots show correct locale-specific UI
- EN and RU versions fully synchronized
- All internal links working correctly

## Completed: Documentation Refresh - Screenshot Generation (2026-05-15)

Phase 5 screenshot generation completed for entity documentation.

### Changes Made

- Generated entity screenshots for both EN and RU locales using Playwright
- Created screenshots for:
  - Entity workspace
  - Metahub create dialog
  - Entity create dialog
  - Hub tree view
  - Resources workspace (components, constants, values tabs)
  - Object records
  - Set fixed values
  - Enumeration option values
- Added screenshot references to Pages entity guide (EN + RU)
- Used local Supabase E2E environment for screenshot generation

### Validation

- `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs generators/docs-entity-screenshots.spec.ts`
- Verified screenshots exist in `docs/en/.gitbook/assets/entities/` (14 files)
- Verified screenshots exist in `docs/ru/.gitbook/assets/entities/` (14 files)
- Screenshots show correct locale-specific UI text

## Completed: Object/Component QA Warning Closure (2026-05-15)

The remaining QA findings from the Object/Component rename review are closed.

### Changes Made

-   Renamed the last active stale shared policy test file to `platformSystemComponentsPolicy`.
-   Hardened `TargetEntitySelector` so a preselected entity kind remains valid while entity type metadata is still loading, removing the MUI out-of-range Select warning without changing the unsupported-kind behavior after loading.
-   Added an i18n-backed accessible label for publication application row actions and tightened the related test layout mock so the MUI menu anchor is valid in jsdom.
-   Added localized EN/RU labels for the publication application row actions button.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- platformSystemComponentsPolicy`
-   `pnpm exec vitest run --config vitest.config.ts src/components/__tests__/TargetEntitySelector.test.tsx src/domains/publications/ui/__tests__/PublicationApplicationList.test.tsx`
-   `pnpm --filter @universo/metahubs-frontend lint`
-   `git diff --check`
-   Targeted `rg` audit for stale shared policy identifiers in the metahubs backend source.

## Completed: Object/Component Final QA Remediation (2026-05-14)

The final QA blockers for the Object/Component rename are closed.

### Changes Made

-   Replaced stale Playwright `createLinkedCollection` usage with `createObjectCollection` and removed remaining local `LinkedCollection` naming in the affected Object lifecycle/layout flows.
-   Updated `@universo/template-mui` breadcrumb, menu, and optimistic CRUD tests from Catalog/LinkedCollection assumptions to Object/ObjectCollection hooks, routes, labels, and cache keys.
-   Renamed the public shared layout authoring type from `LayoutAuthoringWidgetCatalogItem` to `LayoutAuthoringAvailableWidgetItem`.
-   Cleaned stale Catalog/Attribute wording in touched shared UI comments without introducing new UI components.

### Validation

-   `pnpm --filter @universo/template-mui test -- useBreadcrumbName MenuContent menuConfigs NavbarBreadcrumbs LayoutAuthoringDetails optimisticCrud.integration`
-   `pnpm --filter @universo/template-mui lint`
-   `pnpm --filter @universo/template-mui build`
-   `git diff --check`
-   Targeted `rg` audit for stale `createLinkedCollection`, `LayoutAuthoringWidgetCatalogItem`, `useLinkedCollectionName`, `/entities/catalog`, `kindKey: 'catalog'`, `_mhb_attributes`, `_app_attributes`, and `cat_` markers in the remediated areas.
-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium flows/metahub-entities-publication-runtime.spec.ts flows/metahub-global-entity-layouts.spec.ts`
-   `pnpm supabase:e2e:stop`

## Completed: Object Collections QA Remediation Closure (2026-05-14)

The Object/Component implementation review findings are closed.

### Changes Made

-   Aligned the layout widget frontend API, query keys, mocks, and tests with the backend `/zone-widgets/object` route.
-   Replaced the stale `CatalogTable.tsx` file name with `ObjectTable.tsx` and expanded `@universo/apps-template-mui` build coverage to include component barrels.
-   Updated remaining active user-facing Attribute wording, stale `cat_` system-app docs, Object/Component test fixtures, and renamed component route/service tests.
-   Ran package-local ESLint auto-formatting for touched frontend packages and verified the remaining rename-term grep hits are allowed migration-catalog, ABAC, and DnD API terms.

### Validation

-   `pnpm --filter @universo/metahubs-frontend test -- --runInBand LayoutDetails.cacheInvalidation LayoutDetails.inheritedWidgets queryKeys TargetEntitySelector LayoutList.copyFlow QuizWidgetEditorDialog EntityScriptsTab MetahubBoard`
-   `pnpm --filter @universo/metahubs-backend test -- componentRoutes MetahubComponentsService systemComponentSeed layoutsRoutes entityInstancesRoutes fixedValuesRoutes EntityDeletePatterns SnapshotRestoreService snapshotLayouts`
-   `pnpm --filter @universo/applications-backend test -- applicationReleaseBundle syncLayoutPersistence syncLayoutMaterialization runtimeRowsController applicationWorkspaces publicRuntimeAccess applicationsRoutes`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-frontend lint`
-   `git diff --check`

## Completed: Object Collections QA Remediation (2026-05-14)

The Object/Component rename QA gaps are closed after the implementation pass.

### Changes Made

-   Updated Playwright flow specs and API helpers to use the Object Collection contract, including `objectCollectionId`, `objectCollections`, and the `object` template/kind expectations.
-   Fixed the shared component settings target mapping so component targets resolve through Objects rather than the removed Catalog contract.
-   Hardened published app runtime permissions to fail closed when backend payloads omit CRUD flags, including dashboard create actions, row actions, and the deprecated tabular adapter/view.
-   Removed remaining current documentation/context references to `_app_attributes`, `_mhb_attributes`, stale catalog screenshots, and `cat_publications` in active docs.
-   Updated E2E selectors to match the current Object UI labels proven by Playwright screenshots.

### Validation

-   `pnpm --filter @universo/schema-ddl test -- --runInBand`
-   `pnpm --filter @universo/metahubs-frontend test -- --runInBand SharedEntitySettingsFields`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/apps-template-mui test -- --runInBand`
-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium flows/metahub-entities-publication-runtime.spec.ts`
-   `git diff --check`
-   Targeted `rg` audits for stale Catalog/Attribute runtime contract markers in E2E specs, active docs, and shared component settings code.

## Completed: Local Supabase Env Profile Generation Improvement (2026-05-13)

Local Supabase profile generation now preserves the full backend environment contract from the normal env files.

### Changes Made

-   Updated `tools/local-supabase/write-env.mjs` so development profiles use `.env` first, then `.env.example`, then a minimal generated fallback.
-   Updated E2E local profile generation to use `.env.e2e`, then `.env`, then `.env.e2e.example`, then `.env.example`, preserving unrelated settings while replacing local Supabase/PostgreSQL values and E2E-safe defaults.
-   Cleared hosted-only Postgres/Auth overrides such as `DATABASE_SSL_KEY_BASE64`, `SUPABASE_JWKS_URL`, and `SUPABASE_JWT_ISSUER` from generated local profiles.
-   Kept previous generated profile values as fallback for generated secrets when the selected base file does not define them.
-   Removed obsolete `*.local-supabase.example` files because the standard env examples are now the canonical tracked contract.
-   Updated backend README, GitBook configuration/quick-start/E2E docs, and E2E README files in EN/RU.
-   Added focused Vitest coverage for hosted-value replacement, unrelated setting preservation, and base env source ordering.

### Validation

-   `node --check tools/local-supabase/write-env.mjs`
-   `node --check tools/local-supabase/shared.mjs`
-   `pnpm run test:local-supabase:tools`

## Completed: Local Supabase Docker Switch (2026-05-13)

Local Supabase switching is available for development and E2E without changing hosted Supabase defaults.

### Changes Made

-   Added Supabase CLI dev dependency and committed `supabase/config.toml` plus an empty `supabase/seed.sql`.
-   Added local Supabase root scripts for init, localhost-bound Docker network creation, start, minimal start, status, stop, nuke, env generation, doctor checks, local app start, local allclean start, and local E2E smoke flows.
-   Added `tools/local-supabase/write-env.mjs` to generate gitignored backend/frontend local dev and E2E profiles from `supabase status -o env`.
-   Added local-host guards so local profile generation and doctor checks reject hosted Supabase URLs before destructive workflows.
-   Added `tools/local-supabase/doctor.mjs` to validate Docker, Supabase CLI, Auth health, REST API, service-role Auth Admin API access, direct PostgreSQL connectivity, and JWT secret configuration.
-   Added local Supabase `.env.*.example` files for core backend and frontend.
-   Updated GitBook docs and package/E2E READMEs in EN/RU with local/hosted switching, doctor usage, and local E2E flow.
-   Added Vitest coverage for local tool contracts and Jest coverage for HS256 token verification with local Supabase JWT secret.

### Validation

-   `pnpm run test:local-supabase:tools`
-   `pnpm --filter @universo/auth-backend test -- --runTestsByPath src/tests/utils/verifySupabaseJwt.localSupabase.test.ts`
-   `pnpm --filter @universo/auth-backend build`
-   `pnpm --filter @universo/auth-backend lint` exits 0 with existing unrelated warnings only
-   `pnpm run docs:i18n:check`
-   `for file in tools/local-supabase/*.mjs tools/local-supabase/__tests__/*.mjs; do node --check "$file"; done`
-   `pnpm exec prettier --check package.json vitest.workspace.ts tools/local-supabase/*.mjs tools/local-supabase/__tests__/*.mjs packages/auth-backend/base/src/tests/utils/verifySupabaseJwt.localSupabase.test.ts`
-   `pnpm supabase:local:init`
-   `pnpm supabase:local:network`
-   `pnpm exec supabase start --help | rg "storage-api|edge-runtime|vector|network-id"`

## Completed: Scoped Menu Contract Closure (2026-05-13)

The remaining catalog/page-specific menu widget authoring and runtime branches are removed from the scoped layout work.

### Changes Made

-   Standardized menu widget item kinds on `section`, `hub`, and `link`.
-   Removed Catalog/Page/Ledger-specific menu editor branches and runtime destination comparisons.
-   Menu section targets are discovered from layout-capable Entity type metadata, so future Entity types can opt into menu destinations through constructor capabilities.
-   Replaced active menu auto-generation config with `autoShowAllSections` across shared schemas, templates, LMS/self-hosted/quiz fixtures, and fixture contracts.
-   Updated runtime menu selection and standalone section-link conversion to accept only neutral `section` menu items for Entity destinations.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/metahubs-frontend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend exec eslint --ext .ts src/domains/templates/data/basic.template.ts src/domains/shared/layoutDefaults.ts src/tests/services/MetahubLayoutsService.test.ts src/tests/services/templateManifestValidator.test.ts --fix`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/applications-backend build`
-   Direct focused tests passed through `pnpm --dir ... exec vitest run ...` / `jest --runInBand` for menu helpers, scope visibility, runtime menu behavior, application layout/runtime behavior, and runtime controller behavior.
-   Note: package-level `test` scripts for `metahubs-frontend` and `applications-frontend` still run the full suite when file args are passed and exposed unrelated existing failures; direct focused runs for touched files pass.

## Completed: Scoped Widget Visibility QA Closure (2026-05-13)

The remaining QA gaps in centralized widget visibility management for generic Entity-scoped layouts are closed.

### Changes Made

-   Added generic metahub layout API endpoints for listing and updating global widget visibility per layout-capable Entity scope.
-   Global widget visibility updates now validate the target Entity through `layoutConfig`, create a scoped layout automatically on the first override, and store sparse `_mhb_layout_widget_overrides` rows instead of duplicating widget definitions.
-   Added a reusable `WidgetScopeVisibilityPanel` and integrated it into existing global widget editors (`WidgetBehaviorEditorDialog`, `MenuWidgetEditorDialog`, `ColumnsContainerEditorDialog`, `QuizWidgetEditorDialog`) without LMS-specific UI.
-   The panel renders localized Entity names/codenames, inherited/overridden state, and scoped-layout presence, so reverse override state is visible from the global layout editor.
-   Runtime global-menu startup token lookup now filters to renderable runtime sections only: catalog-compatible objects or Pages.
-   Auto-created scoped layout names are stored as canonical VLC records.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/MetahubLayoutsService.test.ts` passes.
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/controllers/runtimeRowsController.test.ts` passes.
-   `pnpm --filter @universo/metahubs-frontend test -- src/domains/layouts/ui/__tests__/WidgetScopeVisibilityPanel.test.tsx --runInBand` ran the package suite and passed: 71 files, 288 tests.
-   `pnpm --filter @universo/metahubs-backend build`, `pnpm --filter @universo/metahubs-frontend build`, and `pnpm --filter @universo/applications-backend build` pass.
-   `pnpm --filter @universo/metahubs-backend exec eslint --fix --ext .ts src/`, `pnpm --filter @universo/metahubs-frontend exec eslint --fix --ext .ts,.tsx,.jsx src/`, and `pnpm --filter @universo/applications-backend lint` pass; metahubs-backend still reports pre-existing warnings only.
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-global-entity-layouts.spec.ts` passes: 2 tests.

## Completed: Scoped Layout QA Closure (2026-05-13)

The remaining QA gaps in generic startup scope resolution and LMS browser regression coverage are closed.

### Changes Made

-   Removed the residual Catalog/Page candidate filter from global-menu startup token resolution so the lookup layer stays Entity-agnostic.
-   Added a backend regression proving startup tokens can resolve arbitrary runtime Entity ids/codenames before downstream rendering rules decide whether a destination is usable.
-   Extended the imported LMS runtime Playwright flow with explicit negative assertions that Home-only dashboard labels never appear on Knowledge, Development, or Reports.
-   Captured a dedicated non-Home screenshot artifact for the clean Knowledge view without inherited Home dashboard widgets.
-   Cleared the outstanding `@universo/applications-backend` Prettier lint findings already present in the scoped-layout sync helper changes.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/controllers/runtimeRowsController.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts`

## Completed: Scoped Layout Widget Visibility Implementation (2026-05-12)

Generic Entity-scoped layout overlays now replace the previous catalog-specific layout contract for widget visibility and runtime materialization.

### Changes Made

-   Replaced generic layout contracts with `scopeEntityId`, `scopedLayouts`, and `layoutWidgetOverrides` across shared types, metahub snapshot export/restore, template validation/seeding, application sync, and layout APIs.
-   Kept `linkedCollectionId` only where it still means runtime record/datasource collection identity, not layout scope.
-   Added capability-driven scoped layout validation through `components.layoutConfig.enabled`, so future Entity types can opt into layout customization without hardcoded kind checks.
-   Materialized inherited scoped widgets with `source_base_widget_id` links and persisted UUID v7 row ids instead of storing synthetic ids in runtime widget tables.
-   Preserved sparse override config, activation, and placement when scoped layouts inherit global widgets.
-   Updated the LMS template and snapshot so the `LearnerHome` Page owns overview cards and charts through a Page-scoped layout, while the global layout no longer enables Home-only dashboard widgets or the empty three-column container.
-   Hardened `columnsContainer` rendering so inactive nested widgets and empty columns render nothing instead of blank cards.
-   Closed the final browser-found regression in scoped layout creation by matching Entity type capability SQL to the actual soft-delete-only `_mhb_entity_type_definitions` schema, then updated the generic Playwright flow to use the Entity layout route and current UI heading.
-   Updated GitBook docs and package README notes from catalog-specific layouts to Entity-scoped layouts.

### Validation

-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/schema-ddl build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/syncLayoutMaterialization.test.ts src/tests/controllers/runtimeRowsController.test.ts src/tests/controllers/applicationLayoutsController.test.ts src/tests/utils/applicationLayoutHash.test.ts src/tests/services/syncLayoutPersistence.test.ts`
-   `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/shared/snapshotLayouts.test.ts src/tests/services/SnapshotRestoreService.test.ts src/tests/services/MetahubLayoutsService.test.ts src/tests/routes/layoutsRoutes.test.ts src/tests/services/metahubSchemaService.test.ts src/tests/services/templateManifestValidator.test.ts`
-   `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/MetahubLayoutsService.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/metahubs-frontend test -- src/domains/entities/presets/ui/__tests__/SettingsOriginTabs.test.tsx src/domains/metahubs/ui/__tests__/actionsFactories.test.ts src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx`
-   `pnpm run build:e2e`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-global-entity-layouts.spec.ts`

## Completed: Connector Schema Diff Entity Metrics QA (2026-05-12)

The schema creation preview in the application connector no longer shows misleading `0 fields, 0 elements` summaries for Entity types whose useful preview data is not field/record based.

### Changes Made

-   Added generic backend schema diff metrics to publication sync details for Hubs, Pages, Sets, Enumerations, Catalogs, and custom fallback Entity types.
-   Kept Catalog summaries as fields/elements while showing Hubs as linked entities, Pages as blocks, Sets as constants, and Enumerations as values.
-   Updated the connector schema diff dialog to render metric summaries and a neutral empty preview state instead of forcing every Entity type into Catalog-like field/element text.
-   Extended i18n for EN/RU metric labels with pluralization.
-   Added backend and frontend regression coverage for the new metric contract and for the absence of misleading `0 fields, 0 elements` text.
-   Extended the imported LMS runtime Playwright flow with focused schema diff sanity assertions and screenshot evidence for the metrics preview.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm build`
-   `git diff --check`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Connector QA Closure (2026-05-12)

The post-QA connector and localization closure fixed the remaining contract and preview issues found after the LMS connector/entity localization pass.

### Changes Made

-   Added `schemaDiffLocalizedLabels` to the strict backend application settings schema so the generic Connectors tab setting is accepted and persisted, including explicit `false`.
-   Added API regression coverage proving the setting is preserved with the rest of sanitized application dialog settings.
-   Hardened managed role policy matching so templates such as `memberPolicy` apply even when imported records omit `baseRole`.
-   Split connector schema diff field codenames into canonical lookup keys and localized display labels, preventing localized UI labels from breaking preview record value lookup.
-   Updated schema diff tests to assert localized Entity type, Entity codename, and field display behavior without relying on ambiguous single-text matches.
-   Updated the imported LMS runtime Playwright flow to assert the source-Metahub Workspace isolation copy.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts guards.test.ts applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/apps-template-mui test -- MenuContent.test.tsx displayValue.test.ts tabularCellValues.test.tsx`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm build`
-   `git diff --check`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Connector And Entity Localization Remediation (2026-05-12)

The latest manual QA findings from the rebuilt LMS Metahub and application were closed without adding LMS-specific runtime forks or bumping schema/template versions.

### Changes Made

-   Updated LMS Page seed generation so Page entities keep stable canonical EN codenames while gaining RU codename VLC values from localized names.
-   Made Metahub Settings entity tabs follow Entity constructor ordering from entity type metadata, placing Pages immediately after Hubs without a hardcoded kind list.
-   Improved the required Workspace connector schema diff UX by moving the explanatory notice above the disabled enabled switch and rewriting the copy around the source Metahub requirement.
-   Added a generic Application Settings `Connectors` tab with a default-enabled option for localized schema diff labels.
-   Expanded connector schema diff details to include all transferred Entity types grouped dynamically by Entity metadata, with localized type, entity, and field labels when enabled.
-   Added primary-VLC fallback behavior so administrators can switch schema diff labels back to canonical primary text.
-   Marked the published app Home menu item active on root application URLs before a concrete section id is present.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator and validated bilingual Page codenames.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- templateSeedTransactionScope.test.ts templateManifestValidator.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- MenuContent.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "metahubs-lms-app-export"`
-   Direct JSON contract check for EN/RU Page codenames in `tools/fixtures/metahubs-lms-app-snapshot.json`

## Completed: LMS Runtime Manual QA Remediation (2026-05-12)

The manual QA findings from the freshly rebuilt LMS application were closed without adding LMS-specific runtime branches.

### Changes Made

-   Improved the required-Workspace connector diff dialog: required publications now show a disabled enabled switch and explanatory text, while the irreversible acknowledgement checkbox is reserved only for optional admin-initiated Workspace enablement.
-   Updated workspace policy validation so required publication policy can force Workspace mode without asking the application administrator for an acknowledgement they cannot act on.
-   Added generic runtime value formatting for objects, arrays, localized values, report definitions, and quiz option arrays, preventing `[object Object]` output in grids, details tables, and tabular edit surfaces.
-   Restored published-app menu active state for both metadata-selected items and safe URL link items, matching the original MUI dashboard selected-list behavior with `aria-current="page"`.
-   Fixed LMS fixture/generator seed localization for class records and strengthened the fixture contract to require EN/RU localized values.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator.
-   Extended unit and browser coverage for required Workspace UX, structured value rendering, active runtime menu state, bilingual fixture integrity, and the imported LMS runtime path.

### Validation

-   `pnpm --filter @universo/utils test -- workspacePolicy.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx`
-   `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- displayValue.test.ts tabularCellValues.test.tsx MenuContent.test.tsx`
-   `git diff --check`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/utils lint` (existing warnings only)
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/core-frontend build`
-   `pnpm --filter @universo/utils build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/core-backend build`
-   `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "metahubs-lms-app-export"`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Roadmap QA Remediation (2026-05-12)

The post-implementation QA pass found and closed the remaining gaps in the iSpring-like LMS roadmap implementation without adding LMS-specific runtime forks.

### Changes Made

-   Restricted runtime report execution to saved `Reports` Catalog records by accepting only `reportId` or `reportCodename` at the API boundary.
-   Added regression coverage proving inline report definitions are rejected before runtime metadata lookup.
-   Added server-side report aggregation execution through safe field metadata and stable public aliases.
-   Shared the ordinary runtime Catalog filter between runtime row APIs and report target discovery so registrar-only ledger Catalogs stay hidden from manual/report execution surfaces.
-   Added a generic Access tab to application settings for role/capability policy editing through existing MUI settings patterns.
-   Updated the isolated app template report API helper to use saved report references and validate aggregation output.
-   Extended the LMS imported runtime Playwright flow to execute a saved report from the generated fixture.
-   Updated GitBook LMS report docs and memory-bank records with the final saved-report execution contract.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts guards.test.ts applicationsRoutes.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- runtimeReports.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

## Completed: Runtime Report Endpoint Wiring Closure (2026-05-11)

The safe generic runtime report runner is now connected to authenticated application runtime APIs instead of remaining service-only code.

### Changes Made

-   Added `POST /applications/:applicationId/runtime/reports/run` for generic `ReportDefinition` execution.
-   Resolved report datasource targets from published runtime metadata in `_app_objects` and `_app_attributes`.
-   Applied lifecycle and workspace row conditions before report execution.
-   Rejected users without `readReports` before touching runtime metadata.
-   Added a typed `apps-template-mui` `runRuntimeReport` helper with CSRF and Zod response validation.
-   Added route and API helper tests for authorized execution and fail-closed unauthorized access.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts runtimeReportsService.test.ts guards.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui test -- runtimeReports.test.ts`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`

## Completed: LMS Roadmap Role Policies, Widget Metadata Pickers, And Final Validation (2026-05-11)

The iSpring-like LMS roadmap implementation was completed through the remaining role-policy, report authorization, widget authoring, and validation phases without adding LMS-specific runtime forks or bumping the template/schema versions.

### Changes Made

-   Added generic application role-policy normalization and effective permission resolution from existing application settings.
-   Added `readReports` as a generic application/runtime capability and enforced it fail-closed in the safe runtime report runner.
-   Extended the existing widget behavior editor to use metadata-backed section pickers for `records.list` datasources while preserving manual section fallback for advanced cases.
-   Reused the existing layout authoring and behavior dialog for details tables, title widgets, charts, and overview cards instead of adding LMS-only UI.
-   Added TanStack Query optimistic cache rollback coverage for failed layout widget configuration saves.
-   Added a no-version-bump guard to the LMS fixture contract for bundle version, snapshot version, structure version, snapshot format version, and unpinned exported template version.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator after the contract update.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/types test -- lmsPlatform.test.ts`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-backend test -- guards.test.ts runtimeReportsService.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend test -- ApplicationWidgetBehaviorEditorDialog.test.tsx ApplicationLayouts.test.tsx`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `node tools/testing/e2e/run-playwright-suite.mjs generators/metahubs-lms-app-export.spec.ts`
-   `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

## Completed: iSpring-like LMS Roadmap Implementation Slice And Import Runtime Closure (2026-05-11)

The LMS platform roadmap implementation slice expanded the generic contracts, LMS template, generated product snapshot, safe report runtime, docs, and workspace seeding robustness without adding an LMS-specific runtime fork.

### Changes Made

-   Added strict shared LMS/platform primitive schemas for resources, sequence policies, lifecycle statuses, workflow actions, role policy templates, report definitions, and acceptance matrix entries in `@universo/types`.
-   Expanded the LMS Metahub template with richer Catalog/Page/Set/Enumeration metadata, realistic seeded records, report definitions, development-plan and knowledge-base structures, and generic runtime widget datasource usage.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator and strengthened the fixture contract.
-   Added `RuntimeReportsService` as a safe V1 report runner over validated published runtime datasource descriptors.
-   Hardened imported publication workspace seeding for restored snapshots: dependency ordering includes table child attributes, unresolved references are retried, unique `_seed_source_key` fallback is available, and legacy table-name object ids can resolve seed rows.
-   Updated package READMEs and GitBook docs for LMS resource and report model guidance.

### Validation

-   `pnpm --filter @universo/types test`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts`
-   `pnpm --filter @universo/applications-backend test -- applicationWorkspaces.test.ts runtimeReportsService.test.ts`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-backend lint`
-   `node tools/testing/e2e/run-playwright-suite.mjs generators/metahubs-lms-app-export.spec.ts`
-   `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

---

## Completed: Fix start:allclean Database Reset + App.initDatabase Test Repair (2026-05-11)

> Goal: Fix `pnpm start:allclean` which never reset the Supabase database due to `--reset-db` flag being lost in the `run-script-os -> npm` chain. Also fix 5 pre-existing test failures in `App.initDatabase.test.ts`.

### Summary

The `--reset-db` CLI flag was unreachable because `run-script-os` spawns `npm run start:default --reset-db`, and npm without `--` separator does not forward unknown flags. Replaced with `_FORCE_DATABASE_RESET=true` env var. Auth user deletion switched from Supabase Admin HTTP API (timed out ~35s/user) to direct SQL `DELETE FROM auth.users`, reducing reset from 3+ minutes to 4 seconds.

### Changes Made

-   **`package.json:30`**: `start:allclean` uses `_FORCE_DATABASE_RESET=true pnpm start`
-   **`start.ts`**: Removed dead `--reset-db` flag
-   **`startupReset.ts`**: SQL-based `deleteAllAuthUsers(db, authUsers)` via `DELETE FROM auth.users WHERE id = ANY($1::uuid[])`; removed `createSupabaseAdminClient`, `StartupResetEnabledConfig`, `getStartupResetConfig`, `assertPresent`
-   **`startupReset.test.ts`**: Removed Supabase Admin mocks; tests verify SQL deletion
-   **`App.initDatabase.test.ts`**: Added missing `getPoolExecutor`+`seedTemplates` mocks
-   **`start-command.test.ts`**: New test verifying `--reset-db` flag is not exposed
-   **`docs/en/`+`docs/ru/`**: Updated `start:allclean` description

---

## Completed: Workspace Policy QA Remediation Hardening (2026-05-10)

Snapshot import fails closed on invalid `runtimePolicy.workspaceMode`. No-Workspace runtime regression stabilized. Playwright flow reuses existing `Title` field definitions and verifies shared runtime rows with `editor` user.

### Changes Made

-   Added explicit `runtimePolicy` object validation and `parseWorkspaceModePolicy` to snapshot import
-   Added route-level import regression proving invalid workspace policies return `400`
-   Strengthened imported-runtime-policy test to assert canonical publication stores required Workspace policy
-   Stabilized no-Workspace Playwright flow around existing default `Title` fields

---

## Completed: LMS Workspace Policy Fixture And Import Closure (2026-05-10)

LMS snapshot now requires `runtimePolicy.workspaceMode = "required"`. Snapshot import preserves valid runtime policy when rebuilding canonical publication. Optional no-Workspace sync path remains covered by route tests.

### Changes Made

-   Added required Workspace runtime policy injection to LMS product Playwright generator
-   Added LMS fixture contract validation for `snapshot.runtimePolicy.workspaceMode === "required"`
-   Preserved imported snapshot runtime policy in `metahubsController.importFromSnapshot`
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator

---

## Completed: Generic Posting Registrar Kind QA Closure (2026-05-10)

Runtime posting movements receive registrar kind from `_app_objects.kind` instead of hardcoding `catalog`. Missing registrar kind fails closed with controlled API error.

### Changes Made

-   Added `kind` loading to `resolveRuntimeLinkedCollection`
-   Passed `linkedCollection.kind` into posting append/reversal calls as `registrarKind`
-   Removed hardcoded `registrarKind: 'catalog'` from posting movement append and reverse flows
-   Updated posting movement regressions to prove non-Catalog registrar kinds forwarded to Ledger service

---

## Completed: Catalog-Backed Ledger Schema Templates (2026-05-10)

Ledger schemas support catalog-backed fact attributes with typed fact columns, auto-generated index tables, idempotent DDL, and E2E posting proof. Generic Ledger schema entity constructor supports fixed/dynamic catalog bindings, option-list enumeration columns, and shared validation.

### Summary

Catalog entity type templates now expose the generic `ledgerSchema` capability in the same Entity constructor contract that already drives behavior, scripts, layouts, and field definitions. LMS template models progress, score, enrollment, attendance, certificate, points, activity, and notification registers as Catalog instances with `config.ledger`. These Catalog-backed ledger objects are registrar-only in runtime.

### Changes Made

-   Enabled `ledgerSchema` in the standard Catalog entity type definition and added `ledgerSchema` tab to Catalog authoring contract
-   Removed default Ledger preset seeding from `basic`, `basic-demo`, and LMS metahub templates; standalone Ledger preset preserved for manual use
-   Converted LMS ledger-like objects to `kind: catalog` entities with `config.ledger`, registrar-only source policy, field roles, and projections
-   Reused generic Ledger schema UI in standard Catalog create/edit/copy dialogs
-   Updated linked-collection backend helpers to validate, persist, copy, and remove `config.ledger` safely
-   Kept registrar-only Catalog-backed ledger objects out of ordinary runtime row lists and automatic workspace seed passes

---

## Completed: Ledger Schema QA Closure (2026-05-10)

Ledger runtime access fails closed with controlled API errors for invalid, missing, or unavailable Ledger ids. `config.ledger` references validated in Entity create/update/copy flows and snapshot publication/import paths.

### Changes Made

-   Added controlled Ledger id validation and unavailable-ledger errors in runtime Ledger controllers and services
-   Enforced strict Ledger config reference validation across frontend authoring, backend CRUD, copy, publication serialization, and snapshot restore
-   Removed remaining Ledger kind-only compatibility checks from schema/runtime/workspace/script paths
-   Fixed workspace seed type discovery for generated child TABLE JSONB columns
-   Fixed Entity dialog action helpers so validation/can-save callbacks tolerate uninitialized form values

---

## Completed: Generic Ledger Schema Entity Constructor Implementation (2026-05-10)

Ledger semantics exposed through generic `ledgerSchema` component contract. Shared types normalize and validate `config.ledger`. Metahub Entity dialog exposes reusable Ledger schema tab. Application layout widgets consume generic `ledger.facts` and `ledger.projection` datasources.

### Changes Made

-   Added strict Ledger config schemas, normalizers, component capability helpers, and reference validation to `@universo/types`
-   Replaced Ledger kind-only checks in schema generation, published snapshot serialization, runtime Ledger services, scripts, and workspace copy/delete flows with capability-aware gates
-   Added generic `LedgerSchemaFields` UI surface wired into shared Entity instance dialog via `ledgerSchema` tab
-   Extended Entity type authoring so `ledgerSchema` component settings can be enabled for future compatible custom or hybrid entity types
-   Extended application widget behavior editor with generic `records.list`, `ledger.facts`, and `ledger.projection` datasource editing

---

## Completed: Linked Collection Record Behavior QA Fixes (2026-05-09)

The linked-collection preset keeps the Entity constructor contract generic. Script, action, event, and record behavior script lookups use the active route `kindKey` first, falling back to entity kind when no route kind is available. Copy dialogs now include edited `config.recordBehavior` payload.

### Changes Made

-   Added linked-collection attachment-kind resolver preferring `routeKindKey` over base entity kind
-   Replaced hardcoded Catalog attachment kinds in linked-collection script tabs and record behavior script queries
-   Replaced remaining generic Entity list linked-collection script/action/event attachment fallback with resolved active kind key
-   Added regression tests for non-Catalog linked-collection script tab attachment and record behavior copy payload preservation

---

## Completed: Entity-Driven Catalog Record Behavior UI (2026-05-09)

Catalog record behavior exposed through generic Entity authoring surface. `behavior` tab appears from entity type `components` plus `ui.tabs`, not from Catalog-only branching. Template path defect fixed: `TemplateManifestValidator` now preserves `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema` instead of stripping them.

### Changes Made

-   Added shared `CatalogRecordBehavior` validation and normalization in `@universo/types`
-   Reused shared normalizer/schema from schema generation, application runtime services, and `apps-template-mui`
-   Added component-driven `behavior` tab in Entity authoring and reusable `RecordBehaviorFields` form
-   Persisted `config.recordBehavior` without dropping existing entity config keys
-   Added structured constructor controls for `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema`
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator

---

## Completed: LMS Runtime Datasource QA Closure (2026-05-09)

Integrated published application runtime provides dashboard widgets with active locale, runtime sections, and linked collections. Chart widgets localize MUI Charts empty-data overlay. Backend runtime list validation resolves localized attribute codenames before checking sort/filter fields.

### Changes Made

-   Passed `locale`, `sections`, and `linkedCollections` into integrated `DashboardDetailsProvider` data from `ApplicationRuntime`
-   Added localized no-data support to shared `SessionsChart` and `PageViewsBarChart` wrappers
-   Propagated runtime list `search`, `sort`, and `filters` through production applications frontend adapter/API
-   Resolved localized backend attribute codenames in runtime sort/filter validation

---

## Completed: LMS Runtime UX QA Remediation (2026-05-09)

Ledger collections use consolidated `ledgers` i18n namespace in metahub UI. Ledger rows/cards open shared field-definition resource surface. Field-definition tabs and empty-state fallbacks have shared localized keys. Runtime dashboard widget contract accepts localized text for stat-card titles, chart titles, intervals, and series labels.

### Changes Made

-   Added `ledgers` to metahub i18n bundle consolidation path
-   Extended generic entity instance list so standard Ledger rows open configured data-schema resource surface route
-   Added shared and Ledger-specific field-definition i18n keys in English and Russian
-   Extended application layout widget schemas to accept localized widget text
-   Resolved localized widget text in apps-template dashboard renderer for overview cards and record-series charts
-   Suppressed demo chart series whenever configured `records.list` datasource has no rows

---

## Completed: LMS Catalog/Ledger Platform Implementation (2026-05-08)

> Consolidation of 20+ LMS QA/feature closures from 2026-05-08.

**Runtime & Security**: Public guest runtime uses neutral platform aliases (`participantId`, `assessmentId`, `contentNodeId`). Guest session secrets stored as SHA-256 hashes. Application settings preserves server-managed `publicRuntime`/`guestRuntime`. Registrar-only Ledger writes rejected. Bounded guest answer validation.

**Ledger & Posting**: Ledger projection errors return controlled `UpdateFailure` responses. Manual-editable Ledger facts observable through guarded `PATCH`/`DELETE` routes. Reversal idempotency via `_app_reversal_of_fact_id` system column. Runtime section sort/filter state reset on section switch.

**LMS Fixture**: LMS metahub snapshot carries explicit `application.publicRuntime.guest` settings. LMS template seeds lifecycle scripts, bilingual page entities, transactional event catalogs, additional ledger definitions. Generic runtime policy settings, overview card metrics, chart datasource authoring, details table datasource authoring.

**Datasource & Widgets**: Generic metric widgets, runtime datasource tables, generic widget datasource closure. Placeholder configuration cleanup. Posting movement E2E proof with authenticated runtime record commands through real UI action menu.

### Key Changes Made

-   Added `ledger` as first-class standard entity kind; shared Catalog `recordBehavior` plus Ledger `config.ledger` contracts
-   Added template seed-script support with manifest validation, compilation, checksum storage, and entity attachment resolution
-   Added `RuntimePostingMovementService` for movement normalization, target-ledger validation, and Ledger append orchestration
-   Added `RuntimeLedgerService` for metadata loading, fact listing, projection queries, append-only writes, idempotent append, and reversal batches
-   Added `RuntimeNumberingService` and `RuntimeRecordCommandService` for transactional Catalog record commands
-   Added runtime response metadata for `recordBehavior` and posting state fields; `RowActionsMenu` with state chip and command actions
-   Added `runtimeDataSources` schemas and types; extended `detailsTableWidgetConfigSchema` with optional `datasource` descriptor
-   Added `statCardWidgetConfigSchema` and `overviewCardsWidgetConfigSchema` for generic metric widgets
-   Added `records-series` chart widget config; registered chart config validation; updated `MainGrid` to fetch chart records
-   Added codename target fields to generic `records.list` and `records.count` datasource schemas
-   Added bounded guest answer validation for question count, selected-option count, and session-token length
-   Converted Ledger projection service failures to stable 400/404/409 API responses with error codes
-   Added guarded Ledger fact `PATCH` and `DELETE` routes with `manualEditable` policy enforcement and soft delete
-   Added neutral `publicRuntime.guest` object and field keys; backwards-compatible aliases for legacy guest runtime settings
-   Added `_app_reversal_of_fact_id` to generated Ledger tables with partial unique index
-   Reset runtime DataGrid sort/filter state when switching sections to avoid cross-catalog field leakage
-   Added `buildTransactionalCatalogConfig()` to LMS template; applied to QuizResponses, Assignments, TrainingEvents, Certificates, Enrollments
-   Added LMS lifecycle scripts: `AutoEnrollmentRuleScript`, `QuizAttemptPostingScript`, `ModuleCompletionPostingScript`, `CertificateIssuePostingScript`
-   Added bilingual Page entities: `CourseOverview`, `KnowledgeArticle`, `AssignmentInstructions`, `CertificatePolicy`
-   Added transactional event catalogs: `QuizAttempts`, `AssignmentSubmissions`, `TrainingAttendance`, `CertificateIssues`
-   Added additional Ledgers: `LearningActivityLedger`, `EnrollmentLedger`, `AttendanceLedger`, `CertificateLedger`, `PointsLedger`, `NotificationLedger`
-   Added generic runtime policy settings: `dashboardDefaultMode`, `datasourceExecutionPolicy`, `workspaceOpenBehavior`
-   Added compact multi-card controls to `ApplicationWidgetBehaviorEditorDialog` for overview-card metric authoring
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator multiple times

### Validation

-   Full root build passed (30/30 Turbo tasks)
-   All focused backend/frontend/template tests passed
-   LMS snapshot import/runtime Playwright flow passed with browser issue collection, security edge assertions, and UI geometry checks

---

## Completed: LMS Catalog And Ledger Metadata Foundation (2026-05-07)

Added `ledger` as first-class standard entity kind. Shared Catalog `recordBehavior` plus Ledger `config.ledger` contracts. Ledgers flow through standard templates, metahub routing, publication snapshots, schema helpers, scripts capability metadata, i18n, docs, and canonical LMS Playwright fixture without LMS-specific runtime widgets.

### Changes Made

-   Added shared Catalog record behavior and Ledger config types in `@universo/types`
-   Extended Entity component manifests with identity fields, record lifecycle, posting, and ledger schema flags
-   Added `ledger` to standard entity kinds, settings, surface labels, script attachment kinds, and schema DDL built-in helpers
-   Added standard Ledger preset and default `Main` ledger instance
-   Extended standard Catalog config with default record behavior; added LMS `ProgressLedger` and `ScoreLedger` definitions
-   Routed Ledgers through existing generic Entity list/details authoring surface
-   Added EN/RU labels and breadcrumb titles; documented Ledgers in GitBook architecture docs

---

## Completed: Startup Supabase Full Reset (2026-05-07)

Full database reset on startup: drops project-owned schemas, deletes auth users, verifies cleanup. Safety: production guard, advisory lock, schema validation, post-reset residue check. Triggered by `FULL_DATABASE_RESET=true` env var or `_FORCE_DATABASE_RESET=true` env var (set by `start:allclean`).

### Changes Made

-   New module `startupReset.ts` with config parsing, production guard, advisory lock, schema discovery, safe schema drop, auth user deletion, post-reset verification
-   Integration in `index.ts` — `executeStartupFullReset()` called before migrations in `initDatabase()`
-   Environment: `.env.example` / `.env` — "DANGER ZONE" block with `FULL_DATABASE_RESET`
-   Tests: 14 new tests (13 in `startupReset.test.ts`, 1 in `App.initDatabase.test.ts`)
-   Documentation: `docs/en/` and `docs/ru/getting-started/configuration.md` — "Danger Zone" section

---

## Completed: Node.js 22 Migration (2026-05-06)

Migrated from Node.js 20 to Node.js 22.6.0+ with upgraded isolated-vm 6.x. All configuration files, documentation, and CI/CD workflows updated.

### Changes Made

-   `package.json` engines.node updated to `>=22.6.0`; `.nvmrc` created
-   `packages/scripting-engine/base/package.json` upgraded isolated-vm from 5.0.4 to ^6.1.2
-   `.github/workflows/main.yml` updated CI matrix to Node.js 22.x
-   Documentation: `.kiro/steering/tech.md`, `README.md`, `memory-bank/techContext.md`, migration guides updated
-   Critical: isolated-vm 5.0.4 does NOT support Node.js 22; 6.x REQUIRED; migration sequence: upgrade isolated-vm first

---

## Completed: Runtime Start Section Stale Placeholder Suppression (2026-05-06)

Published application root no longer briefly renders non-start section while menu-defined start page is loading. `useCrudDashboard` suppresses mismatched section data as loading state.

### Changes Made

-   `useCrudDashboard` suppresses mismatched section data and returns loading state when current response section differs from initial menu start section
-   Initial menu section detection treats `page` items as valid section targets
-   Extended LMS browser flow to assert Access Links is not visible on runtime root loading

---

## Completed: Application Sync RLS Transaction Boundary (2026-05-06)

Application schema sync no longer runs inside request-scoped RLS transaction. Sync route uses plain authenticated middleware with application access checks and sync-engine advisory locks.

---

## Completed: Generic Localized Variant Tabs For Page Content (2026-05-06)

Page content language tabs render through shared `LocalizedVariantTabs` in `@universo/template-mui`. Same typography parity as metahub MUI tab customization.

### Changes Made

-   Extracted `LocalizedVariantTabs` into `@universo/template-mui` for reuse
-   Matched localized content tabs to metahub MUI tab typography and compact 28px action/add button geometry
-   Marked primary content locale with 16px `Star` icon affordance

---

## Completed: LMS Page Content Import And Editor.js UX Closure (2026-05-06)

LMS snapshot contains full EN/RU Editor.js block content. Page block content renders on first open. Editor.js block picker stays visible/scrollable inside viewport.

### Changes Made

-   Removed short preset Welcome page from LMS output; kept `LearnerHome` as stable codename
-   Added `localizeCodenameFromName` for seed entities to opt out of codename localization
-   Regenerated LMS fixture through official Playwright generator with full EN/RU Welcome block content
-   Fixed late-data initialization so content renders on first open; constrained block toolbox to remain visible/scrollable

---

## Completed: Page Entity Authoring And LMS UX Closures (2026-05-05)

Multiple Page entity authoring closures: shared action icons, Editor.js toolbar geometry, language tab parity, primary locale ordering, hubs picker VLC codename crash fix, generic Page form capability, stable labels/loading/dialog titles.

### Key Changes Made

-   Added standard CRUD action icon factories in `@universo/template-mui`; centralized icon factories removed Page/Catalog menu drift
-   Editor.js wrapper keeps add/tune controls inside editor card and left of block text without overlap
-   `ContainerSelectionPanel` resolves VLC codenames through `getVLCString` before rendering (fixed React error #31)
-   Generic Entity form accepts standard `hubs` tab alias and exposes Page `Hubs` and `Layouts` tabs from template capability metadata
-   Generic Entity list helpers and navbar breadcrumbs use localized built-in fallbacks before async metadata resolves
-   Standard Entity template presets expose localized `presentation.dialogTitles` for create/edit/copy/delete actions
-   `EditorJsBlockEditor` accepts `contentLocale` separately from UI locale; merges saves back into selected locale only
-   Metahub Page content route exposes content-language tabs labeled from admin content locales
-   Editor.js toolbar/popover CSS reserves left-side toolbar space and keeps opened menu inside content card
-   Regenerated LMS snapshot through Playwright generator

---

## Completed: Page Block Content And Editor.js Authoring (2026-05-04)

Implemented real Editor.js authoring for metahub Page content. Shared `EditorJsBlockEditor` in `@universo/template-mui` is domain-neutral and reusable by any `blockContent` Entity type. `apps-template-mui` remains Editor.js-free, rendering canonical Page blocks through safe MUI runtime components.

### Changes Made

-   Added official Editor.js core/tools through central PNPM catalog
-   Added lazy-loaded `EditorJsBlockEditor` and tool factory in `@universo/template-mui`
-   Added shared Editor.js-to-Page block adapters that normalize list 2.x data, reject nested lists and inline HTML
-   Hardened entity create/update validation so Page block content is normalized before persistence
-   Added entity-owned `/content` route for `components.blockContent.enabled` Entity types
-   `SnapshotRestoreService` normalizes imported Page `config.blockContent` and rejects unsafe content
-   Added `allowedBlockTypes` and `maxBlocks` constraints to block normalizer
-   Regenerated LMS fixture; fixed LMS snapshot import failure (empty import presets for `page` type)
-   Fixed `[object Object]` import error display with shared formatter

---

## Completed: LMS Workspace Policy, Page Type, And Runtime Cleanup (2026-05-03 to 2026-05-02)

Implemented Page metadata type, publication-version workspace policy, connector-owned workspace schema decisions, and regenerated LMS product snapshot. Removed old no-workspaces publication policy; valid policies are `optional | required`. Connector schema options persisted only after successful sync.

### Key Changes Made

-   Added `page` to metahub/script/runtime kind unions; added `blockContent` component; introduced `WorkspaceModePolicy` plus shared validation helpers
-   Registered Page preset in standard templates; added LMS `LearnerHome` Page with Editor.js-compatible blocks
-   Added physical-table contract so `hub`, `set`, `enumeration`, `page` sync as metadata-only objects with nullable runtime `table_name`
-   Publication versions store `optional | required`; transition guards prevent disabling previously required workspace contract
-   `schema_options` on connector-publication links stores optional workspace choices; `workspaces_enabled` updated after successful schema sync
-   Guest sessions persist access link id, workspace id, secret, expiry; validation rejects tampered tokens
-   `apps-template-mui` renders Page block content through existing dashboard details surface; supports Page menu items
-   `sanitizeMenuHref`/`isSafeMenuHref` in `@universo/utils`; editors reject protocol-relative/unsafe-scheme links
-   `MenuContent.tsx` uses whitelist (`/`, `https:`, `mailto:`, `tel:`, `#`); unsafe links render as inert items
-   JSONB/VLC runtime writes: plain string STRING fields normalized to VLC object before insert/update
-   Application `member` is now read-only: create/edit/copy/delete fail closed
-   TABLE child-row listing no longer requires mutation permissions; mutations fail closed

---

## Completed: Runtime Workspace Management Implementation (2026-04-27 to 2026-04-29)

`isPublic` mutable through application update. Runtime workspace/member endpoints support paginated/searchable responses. Published workspace management renders as full dashboard section. Workspace copy resets runtime system metadata. Runtime workspace API returns stable error codes. Workspace navigation uses host-provided SPA navigation.

### Key Changes Made

-   Owners can change public/closed visibility through settings page; workspace mode is structural read-only
-   Backend workspace API: pagination/search for workspace/member listing; member invitation accepts email or user id
-   `@universo/apps-template-mui` owns full runtime workspace section with card/list, pagination, search, CRUD, invite, remove
-   Workspace copy excludes runtime system columns; resets metadata with fresh timestamps
-   Workspace endpoints return stable error `code` values alongside messages
-   Runtime workspace navigation uses host-provided SPA navigation callbacks
-   Sidebar workspace switcher reads VLC names with active `i18n.language`
-   `_app_workspaces` no longer creates machine-name column; create/edit/copy accept only `name`
-   Workspace-enabled app sync materializes `workspaceSwitcher` widget in left layout zone
-   Workspace routes validate UUID format before schema resolution or service execution
-   Playwright flow performs real negative UI actions for invalid creation, blocked removal, missing-user invite

---

## Completed: Application Layout Management (2026-04-22)

Converged application/metahub layout detail onto shared `LayoutAuthoringDetails` in `@universo/template-mui`. Shared `LayoutAuthoringList` for both application and metahub layout lists. Application layout authors can configure `overviewCards`, chart widgets, and `detailsTable` through shared widget behavior editor.

### Changes Made

-   Added `LayoutAuthoringList` to `@universo/template-mui` as common card/list renderer; restored metahub compact embedded-header behavior
-   `LayoutAuthoringDetails` is common five-zone widget authoring surface for both metahub and application layout detail
-   Added shared `LayoutAuthoringDetails` move action menu with accessible zone-move control
-   `ConnectorDiffDialog` exposes stable select ids and test hooks for bulk/per-layout resolution
-   Read access policy honors explicit per-application `settings.applicationLayouts.readRoles`
-   Shared widget validation via `@universo/types` schema-driven parsers

---

## Completed: LMS MVP Implementation (2026-04-19 to 2026-04-21)

LMS MVP as metahub configuration data. Guest/public runtime access end-to-end: public link resolution, guest session creation, quiz submission, progress updates. LMS fixture/docs scaffolding. Guest runtime credential transport hardened. Canonical LMS snapshot regenerated through Playwright generator.

### Key Changes Made

-   Header-based guest runtime transport (`X-Guest-Student-Id`/`X-Guest-Session-Token`)
-   Shared-workspace-aware access-link resolver; inline SVG fixture assets
-   `workspaceId` query override with UUID format validation and membership check
-   Public workspace discovery limited to active shared only; personal-workspace member-management fail-closed with explicit `403`
-   String-based child-table references remapped to workspace-scoped ids during personal-workspace seeding
-   Transaction-safe `createSharedWorkspace`/`addWorkspaceMember`; server-side guest session expiry
-   Public script delivery with `Content-Type`, `nosniff`, CSP, cache headers
-   Widget/runtime UX hardening (QRCode timeout cleanup, completion screen for last module item)
-   EN/RU locale resources include guest completion keys; defensive locale resolution from URL query

---

## Completed: Entity-First Final Refactoring (2026-04-14 to 2026-04-18)

Eliminated all top-level legacy `domains/` folders. Neutralized metadata route segments, public type exports, API helpers, mutation hooks. Backend: removed specialized child-controller factories, moved to generic entity controller + behavior registry. Bulk parameter renaming across 7 packages. Resources tabs made dynamic from entity type `ComponentManifest`.

### Key Changes Made

-   Renamed all entity type display names from surface-key terminology (`tree_entity`, `linked_collection`, `value_group`, `option_list`) to traditional names (Hubs, Catalogs, Sets, Enumerations). Internal surface keys preserved unchanged
-   Automated renames via perl: `enumerationId`->`optionListId` (321 refs), `setId`->`valueGroupId` (393 refs), `catalogId`->`linkedCollectionId` (904 refs), `hubId`->`treeEntityId` (957 refs)
-   `copyOptions.ts` treats `TreeEntityCopyOptions`/`LinkedCollectionCopyOptions`/`ValueGroupCopyOptions`/`OptionListCopyOptions` as canonical
-   Removed unused controller-factory tails; deleted `valueGroupController.ts`, `treeController.ts`, `linkedCollectionController.ts`
-   Generic custom-entity ACL maps to `createContent`/`editContent`/`deleteContent`
-   Removed `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families
-   Backend routes mount `field-definitions`/`fixed-values`/`records` suffixes; frontend URLs/navigation updated
-   `HubList`/`CatalogList`/`SetList`/`EnumerationList` replaced with neutral names
-   `@universo/types` exposes neutral `EntitySurfaceKey`, `EntitySettingsScope`, surface-kind resolvers
-   `MainRoutes.tsx` no longer registers old hubs/catalogs/sets/enumerations pages; unified `/entities/:kindKey/...` authoring surface
-   Top-level `domains/attributes`/`domains/constants`/`domains/elements`/`domains/general` physically deleted
-   Entity-owned routes, read-only definition access, explicit shared-field labels, and browser workspace parity aligned
-   Entity types, actions, event bindings, lifecycle orchestration, and resolver DB extension validated as backend seams
-   Shared/Common is the single authoring shell for shared attributes/constants/values/scripts/layouts
-   ECAE (Entity-Component-Action-Event) architecture: entity presets, script tabs, lifecycle dispatch, runtime execution, browser proof all landed

## 2026-05-13: Local Supabase Minimal App Start Commands

-   Added `start:local-supabase:minimal` and `start:allclean:local-supabase:minimal` root scripts so the app can run against the reduced Supabase Docker stack without manually starting it first.
-   Preserved the same safety order as the full local stack: start Supabase, regenerate local env profiles, run `doctor:local-supabase`, then start or reset the app with explicit local env files.
-   Added local Supabase tool test coverage for the minimal script contract.
-   Updated backend README and GitBook EN/RU quick-start/configuration docs with the minimal profile behavior and the cases that still require the full Supabase stack.
-   Documented Supabase Studio as the default local web console on `http://127.0.0.1:54323`, distinct from the local API URL on `http://127.0.0.1:54321`.

## 2026-05-13: Dedicated E2E Supabase Profile And Agent Playwright Guidance

-   Added a centralized local Supabase profile model with separate dev and E2E project ids, workdirs, ports, generated E2E `config.toml`, and profile-safe CLI wrappers.
-   Local E2E Supabase now uses a dedicated project on API `55321`, database `55322`, and Studio `55323`; local E2E scripts start the minimal dedicated stack before env generation and doctor checks.
-   Hardened E2E env loading with explicit provider/isolation policy. Dedicated hosted E2E no longer falls back silently to `.env`; shared/main modes require `E2E_ALLOW_MAIN_SUPABASE=true` and `E2E_FULL_RESET_MODE=off`.
-   Updated the Playwright agent skill with repository-specific rules: use wrapper commands, port `3100`, `.env.e2e`, and no `pnpm dev` for browser E2E.
-   Added focused Vitest coverage for local Supabase profiles, package-script contracts, E2E source policy, generated E2E config, and agent skill rules.
-   Updated backend README, E2E README, GitBook EN/RU configuration/quick-start/E2E docs, env examples, active context, and tasks.

---

## 2026-04-13 And Earlier: Archive

### 2026-04-13: Legacy Removal + Metahub QA

-   Removed legacy `HubList`/`CatalogList`/`SetList`/`EnumerationList` frontend exports; neutral `getTypeById`/`listTypes`/`createType` naming
-   `createRlsExecutor` scopes transaction depth lexically; middleware-owned request transactions reused directly
-   `entity.hub|catalog|set|enumeration.*` settings keys replace plural legacy prefixes
-   `TemplateSeedExecutor` applies hub-assignment remap pass after seeded entities receive real ids
-   Entity-Type Codename Enforcement: server-side duplicate codename blocking via `EntityTypeService`; `_mhb_entity_type_definitions` active-row unique index
-   Legacy Frontend Route Tree Cleanup: unified `/entities/:kindKey/...` authoring surface

### 2026-04-12: Metahub QA + Entity V2 Closure

-   `EntityFormDialog` resets incoming initial state before paint on first open; no render-phase ref writes
-   Shared shell-spacing contract extracted to `pageSpacing.ts`; `SkeletonGrid` exposes semantic `insetMode`
-   Standalone metahub pages respect outer gutter from `MainLayoutMUI`
-   Entity V2 route-ownership, compatibility, review-triage, automation, and workspace/browser seams closed

### 2026-04-09 to 2026-04-10: ECAE Delivery + Catalog V2 Closeout

-   Strict Catalogs V2 parity: backend/frontend/browser/runtime paths treat catalog-compatible entity kinds as shared catalog surfaces
-   Snapshot v3, DDL custom-type propagation, runtime `section*` aliases generalized
-   Dynamic published custom-entity menu zone is permission-aware and stable
-   First generic entity instance UI with focused browser proof passed on real product route surface
-   Entity presets reuse template registry/versioning flow; frontend authoring workspace integrated into shared shell

### 2026-04-08: ECAE Foundation And QA Recovery

-   Backend service foundation: entity types, actions, event bindings, lifecycle orchestration, resolver DB extension
-   Generic CRUD and compatibility layer: custom-only generic entity CRUD shipped first, then legacy built-in delete/detach/reorder semantics lifted into shared helpers
-   Design-time service genericization: shared child copy and object-scoped system-attribute management behind reusable helpers
-   Review and QA hardening: PR review fixes, lint closure, attribute move ownership, strict E2E finalization

### 2026-04-07: Shared/Common And Runtime Materialization

-   Common is the single authoring shell for shared attributes/constants/values/scripts/layouts
-   Shared sections export/import as first-class snapshot data, materialized into flattened runtime/app-sync view
-   Catalog layout inherited widgets stay sparse, read-only for config, gated by shared behavior rules

### 2026-04-06: Layout, Runtime, Fixture, And Docs

-   General/Common page owns single shell; catalog-specific layouts remain sparse overlays
-   Self-hosted and quiz fixtures regenerated from real generator/browser flows
-   Dialog settings, GitBook documentation, screenshot generation brought into EN/RU parity

### 2026-04-05: Scripting And Quiz Delivery

-   Embedded scripts are SDK-only; browser worker execution restricted; server runtime pooled; public RPC boundaries fail closed
-   Scripts tabs, quizWidget, runtime execution, fixture export/import, and browser-authored quiz flows all landed
-   `sdkApiVersion`, CSRF retry, default capability resets, and runtime script sync fail-closed behavior became cross-package contracts

### 2026-04-04: Self-Hosted Parity

-   Fixture identity and codename fidelity through repeated real-generator reruns
-   Snapshot import/export, publication linkage, runtime inheritance, and browser-import fidelity aligned with live product

### 2026-04-03: Snapshot, E2E Reset, And Turbo Hardening

-   Direct metahub export/import, publication version export, `SnapshotRestoreService`, browser verification all landed
-   Wrapper-managed E2E runs start from and return to project-empty state with doctor/reset tooling
-   Turbo 2 root migration, cache correctness, and repeated-build cache hits became documented build contract

### 2026-04-02 To 2026-03-11: Condensed Archive

| Date                     | Theme                           | Durable outcome                                                                                                                                      |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-02               | Playwright full-suite hardening | Route timing, determinism, restart-safe cleanup, diagnostics, locale/theme, route-surface browser-testing closed                                     |
| 2026-04-01               | Supabase auth + E2E QA          | HS256/JWKS verification, RLS cleanup, E2E runner cleanup, public-route/auth QA seams stabilized                                                      |
| 2026-03-31               | Breadcrumbs + security          | Breadcrumb/query restore behavior, JSONB/text selector drift, dependency/security tail closed                                                        |
| 2026-03-30               | Metahubs/applications refactor  | Thin routes, controller/service/store decomposition, shared hooks, shared mutation/error helpers                                                     |
| 2026-03-28 to 2026-03-24 | CSRF + codename convergence     | `csurf` replacement, vulnerability cleanup, codename JSONB/VLC single-field contract                                                                 |
| 2026-03-19 to 2026-03-11 | Platform foundation             | Request/pool/DDL DB access tiers, fixed system-app convergence, runtime-sync ownership, managed naming helpers, bootstrap/application workspace work |

### Older 2025-07 To 2026-02 Summary

-   Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model
-   Release milestones `0.21.0-alpha` through `0.52.0-alpha` in the version table above remain the canonical high-level timeline for those earlier waves


---

## 2026-05-15: Documentation Refresh Implementation (Phase 1-4 Complete)

**Goal**: Comprehensive update of GitBook documentation to match current platform state, remove non-existent functionality, add Pages entity documentation, and prepare for screenshot generation.

**Status**: Core documentation updates complete. Screenshot generation pending.

### Completed Work

**Phase 1: QA Analysis (Complete)**
- ✅ Verified legacy terminology already removed from all documentation
- ✅ Verified Russian localization already complete
- ✅ Verified Pages entity implementation exists in codebase
- ✅ Identified 26 files documenting non-existent functionality
- ✅ Identified LMS and Ledgers screenshot gaps

**Phase 2: Content Deletion (Complete)**
- ✅ Deleted UPDL section documentation (16 files: 8 EN + 8 RU)
  - Removed `docs/en/platform/updl/` directory (8 files)
  - Removed `docs/ru/platform/updl/` directory (8 files)
- ✅ Deleted Space Builder documentation (2 files)
- ✅ Deleted Metaverses documentation (2 files)
- ✅ Deleted Analytics documentation (2 files)
- ✅ Deleted Working with UPDL guide (2 files)
- ✅ Deleted Multi-Platform Export guide (2 files)
- ✅ Updated `docs/en/SUMMARY.md` to remove deleted sections
- ✅ Updated `docs/ru/SUMMARY.md` to remove deleted sections

**Phase 3: Platform Section Updates (Complete)**
- ✅ Updated `docs/en/platform/README.md` - removed non-existent functionality, added actual features
- ✅ Updated `docs/ru/platform/README.md` - mirrored EN changes exactly
- ✅ Updated `docs/en/platform/metahubs.md` - added entity types table with Pages and Ledgers
- ✅ Updated `docs/ru/platform/metahubs.md` - mirrored EN changes exactly

**Phase 4: Pages Entity Documentation (Complete - CRITICAL GAP CLOSED)**
- ✅ Created `docs/en/guides/pages-entity-type.md` - comprehensive Pages guide
  - Overview and key features
  - Creating and editing Pages
  - Supported block types (paragraph, header, list, quote, code, etc.)
  - Multilingual content support
  - Content validation and safety
  - Use cases (LMS, documentation, landing pages)
  - Runtime behavior and performance
  - Best practices and troubleshooting
- ✅ Created `docs/ru/guides/pages-entity-type.md` - full Russian translation
- ✅ Added Pages guide to `docs/en/SUMMARY.md`
- ✅ Added Pages guide to `docs/ru/SUMMARY.md`

### Impact

**Documentation Cleanup:**
- Removed 26 files of misleading documentation about non-existent features
- Documentation now accurately reflects current platform capabilities
- Cleaner navigation structure in SUMMARY.md files

**Critical Gap Closed:**
- Pages entity type now has comprehensive user-facing documentation
- Users can now learn how to use Editor.js integration
- Multilingual content authoring is documented
- LMS use case is explained

**Platform Overview Improved:**
- Platform README now lists actual running features
- Metahubs documentation includes all entity types
- Clear references to detailed guides

### Remaining Work

**Phase 5: Screenshot Generation (READY TO EXECUTE)**
- ✅ Created Playwright screenshot generation spec
- ✅ Implemented locale switching (using existing helpers)
- ✅ Created comprehensive documentation
- 📸 Ready to generate 40-50 screenshots (20-25 unique, each in EN + RU)
- Priority areas ready:
  - Pages editor screenshots (spec created)
  - LMS workflow screenshots (spec created)
  - Ledgers screenshots (spec created)

**Execution Instructions:**
1. Start local Supabase E2E: `pnpm supabase:e2e:start:minimal`
2. Run generator: `npx playwright test --project=chromium tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts`
3. Screenshots saved to `docs/{locale}/.gitbook/assets/` directories

**Phase 6: Final Validation (Pending)**
- Link validation
- EN/RU structure verification
- Line count matching verification
- GitBook build test

### Technical Details

**Files Modified:**
- Deleted: 26 files (UPDL, Space Builder, Metaverses, Analytics, guides)
- Created: 4 files (Pages guide EN + RU, screenshot spec, README)
- Updated: 6 files (SUMMARY.md x2, Platform README x2, Metahubs x2)

**Screenshot Infrastructure:**
- Created: `tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts`
- Created: `tools/testing/e2e/specs/generators/README-SCREENSHOTS.md`
- Locale support: EN and RU via `applyBrowserPreferences()`
- Output directories: `docs/{locale}/.gitbook/assets/{category}/`

**Documentation Quality:**
- EN and RU versions maintain exact structure
- All internal links updated
- No broken references to deleted content
- Comprehensive Pages documentation with examples

### Validation Evidence

- ✅ All deleted files confirmed removed
- ✅ SUMMARY.md files updated and consistent
- ✅ Pages guide created with comprehensive content
- ✅ EN and RU versions match in structure
- ✅ Platform documentation reflects actual features

### Next Steps

1. Create Playwright screenshot generation spec
2. Generate locale-specific screenshots (EN + RU)
3. Verify all internal links work
4. Run GitBook build test
5. Update this progress entry with screenshot completion

## 2026-05-15 - LMS Platform Implementation Slice 7B: Published Runtime Workflow Actions

### Summary

Completed the published-application runtime layer for metadata-backed workflow actions. Object collection workflow actions are now returned in runtime app data, visible in the existing row actions menu when the selected row status matches the configured transition, and executed through the trusted backend workflow endpoint with optimistic concurrency.

### Implemented

- Added workflow actions to the apps-template runtime response schema for `section`, `objectCollection`, `sections`, and `objectCollections`.
- Added `runAppWorkflowAction()` and the corresponding `CrudDataAdapter.workflowAction()` contract.
- Extended `useCrudDashboard()` with `handleWorkflowAction()` and `isWorkflowActionPending`.
- Reused the existing `RowActionsMenu` instead of introducing a new LMS-specific action surface.
- Resolved workflow `statusFieldCodename` to physical runtime column names in the frontend menu and backend route, while keeping `statusColumnName` available for explicit low-level configuration.
- Returned `_upl_version` in runtime rows only when the active object collection has configured workflow actions, so the UI can fail closed before submitting stale actions.
- Added localized workflow action success/error messages in EN/RU.

### Safety Notes

- Workflow actions remain server-trusted: the browser can request an action codename, but the backend loads the action from object collection metadata and rejects unconfigured actions.
- The backend requires `editContent`, a current user id, CSRF-protected POST, a positive `expectedVersion`, safe identifiers, row locking, and workspace scoping where applicable.
- The frontend hides workflow actions without a current `_upl_version` and sends the version read from the current runtime row.

### Validation

- `pnpm --filter @universo/apps-template-mui lint`
- `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/__tests__/RowActionsMenu.recordCommands.test.tsx src/hooks/__tests__/useCrudDashboard.test.tsx`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions applicationsRoutes.test.ts -t "workflow actions" --runInBand`
- `pnpm --filter @universo/applications-backend build`
- `git diff --check`

## 2026-05-15 - LMS Platform Implementation Slice 7C: Workflow Capability Policy

### Summary

Added an effective workflow capability map for runtime requests so metadata-backed workflow actions can use exact LMS capabilities such as `assignment.review` and `certificate.issue` instead of being limited to base permissions like `editContent`.

### Implemented

- Added `resolveEffectiveRoleCapabilities()` in application access guards.
- The capability map starts from effective base permissions and their aliases, then applies exact role-policy rules for supported `application` and `workspace` scopes.
- Unsupported scoped role-policy rules such as `department`, `class`, `group`, and `recordOwner` remain fail-closed until their predicates are implemented.
- Runtime schema context now carries `workflowCapabilities`.
- Published runtime app data now exposes `workflowCapabilities`.
- `RowActionsMenu` now filters metadata workflow actions by exact `requiredCapabilities` before showing them.
- Backend workflow execution now uses `ctx.workflowCapabilities`, so the browser and server evaluate the same effective capability set while the server remains authoritative.

### Validation

- `pnpm --filter @universo/applications-backend test -- guards.test.ts runtimeWorkflowActions applicationsRoutes.test.ts -t "role|workflow actions|configured workflow" --runInBand`
- `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/__tests__/RowActionsMenu.recordCommands.test.tsx src/hooks/__tests__/useCrudDashboard.test.tsx`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/apps-template-mui build`

## 2026-05-15 - LMS Platform Implementation Slice 7D: Knowledge and Development Portal Navigation

### Summary

Completed the LMS portal-navigation correction that was called out by the product roadmap: Knowledge and Development now open real portal Page entities instead of surrogate operational collections. The canonical LMS fixture was regenerated through the Playwright generator, so the committed snapshot matches the template and fixture contract.

### Implemented

- Added `KnowledgeHome` as a Page entity with EN/RU Editor.js blocks describing knowledge spaces, folders, articles, and bookmarks.
- Added `DevelopmentHome` as a Page entity with EN/RU Editor.js blocks describing development plans, stages, tasks, mentors, and monitors.
- Updated primary LMS menu seed data so `lms-nav-knowledge` targets `KnowledgeHome` and `lms-nav-development` targets `DevelopmentHome`.
- Extended backend template manifest tests for the new Page entities and menu targets.
- Extended the LMS fixture contract acceptance matrix and page checks for `KnowledgeHome` and `DevelopmentHome`.
- Added explicit fixture contract guards that reject Knowledge/Development primary navigation when it points to old surrogate collection targets.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` only through the Playwright LMS generator.

### Validation

- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
- `pnpm --dir packages/metahubs-backend/base exec eslint --fix src/domains/templates/data/lms.template.ts src/tests/services/templateManifestValidator.test.ts`
- `pnpm exec eslint --fix tools/testing/e2e/support/lmsFixtureContract.ts`
- `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
- `pnpm supabase:e2e:stop`
- `git diff --check -- packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts tools/testing/e2e/support/lmsFixtureContract.ts`

## 2026-05-15 - LMS Platform Implementation Slice 7E: LMS Workflow Metadata

### Summary

Added product-level LMS workflow actions as generic object metadata rather than new LMS-specific runtime screens. The published app can now receive action definitions for assignment review, attendance, certificate issue/revoke, development tasks, and notification delivery through the existing runtime workflow action pipeline.

### Implemented

- Added reusable LMS workflow action builders in the LMS template.
- Added `workflowActions` support to the LMS transactional object config helper.
- Added assignment submission actions: `StartSubmissionReview`, `AcceptSubmission`, and `DeclineSubmission`.
- Added training attendance actions: `MarkAttendanceAttended`, `MarkAttendanceNoShow`, and `CancelAttendance`.
- Added certificate issue actions: `IssueCertificate` and `RevokeCertificate`, bound to `CertificateIssuePostingScript`.
- Added development task actions: `StartDevelopmentTask`, `CompleteDevelopmentTask`, and `ReopenDevelopmentTask`.
- Added notification outbox actions: `MarkNotificationSent`, `MarkNotificationFailed`, and `CancelNotification`.
- Normalized executable workflow status fields to string lifecycle states where the current generic workflow engine compares status codenames directly.
- Extended backend template manifest tests with workflow action contract checks.
- Extended the LMS fixture contract to require every operational workflow action and capability.
- Updated the LMS Playwright generator seed for `DevelopmentPlanTasks.Status`.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the official Playwright LMS generator.

### Validation

- `pnpm --dir packages/metahubs-backend/base exec eslint --fix src/domains/templates/data/lms.template.ts src/tests/services/templateManifestValidator.test.ts`
- `pnpm exec eslint --fix tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
- `pnpm supabase:e2e:stop`
- Snapshot sanity check for required workflow action metadata.
- `git diff --check -- packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/fixtures/metahubs-lms-app-snapshot.json`

## 2026-05-15 - LMS Platform Implementation Slice 8A: Saved Runtime Report CSV Export

### Summary

Added the first generic reporting export slice for published applications. Runtime report widgets now execute and export saved report definitions by `reportCodename`, while arbitrary browser-supplied inline report definitions remain rejected by the backend before runtime metadata lookup.

### Implemented

- Added `POST /applications/:applicationId/runtime/reports/export` for CSV export of saved `records.list` reports.
- Reused the existing runtime reports resolution path for Reports object lookup, target metadata resolution, workspace scoping, lifecycle filtering, and `readReports` permission checks.
- Added bounded export limits with a 5,000-row maximum and CSV serialization that uses configured report columns only.
- Added a typed `exportRuntimeReportCsv()` published-app API helper with CSRF protection and workspace-aware URLs.
- Updated the existing detailsTable report widget to call saved reports by codename and expose a small localized CSV export action instead of inventing an LMS-specific report screen.
- Added EN/RU localization keys for report export states.

### Validation

- `pnpm exec eslint --fix packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/routes/applicationsRoutes.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts packages/apps-template-mui/src/api/api.ts packages/apps-template-mui/src/api/index.ts packages/apps-template-mui/src/api/__tests__/runtimeReports.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
- `pnpm --filter @universo/apps-template-mui test -- runtimeReports widgetRenderer`
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts -t "Runtime reports route contract"`
- `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/apps-template-mui build`
- `git diff --check -- packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/routes/applicationsRoutes.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts packages/apps-template-mui/src/api/api.ts packages/apps-template-mui/src/api/index.ts packages/apps-template-mui/src/api/__tests__/runtimeReports.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`

## 2026-05-15 - LMS Platform Implementation Slice 8B: Report Aggregation Overview Metrics

### Summary

Extended generic analytics widgets so overview cards can display aggregations from saved runtime reports. This keeps LMS dashboard/report homes configurable through existing layout widgets instead of adding hardcoded LMS React surfaces.

### Implemented

- Added a typed `report.aggregation` metric datasource for stat cards.
- Kept `records.count` behavior unchanged and limited overview cards to implemented metric keys.
- Updated the published-app `RuntimeStatCard` path to call the saved runtime report endpoint and display a configured aggregation alias.
- Extended the existing Application Widget Behavior editor for overview cards with a metric type selector and report aggregation fields.
- Added validation warnings for incomplete report aggregation metric configuration.
- Added EN/RU localization keys for the new overview card metric controls.

### Validation

- `pnpm exec eslint --fix packages/universo-types/base/src/common/runtimeDataSources.ts packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx packages/applications-frontend/base/src/components/layouts/ApplicationWidgetBehaviorEditorDialog.tsx packages/applications-frontend/base/src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
- `pnpm --filter @universo/types test -- applicationLayouts.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/apps-template-mui test -- MainGrid`
- `pnpm --filter @universo/applications-frontend test -- ApplicationWidgetBehaviorEditorDialog.test.tsx`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/apps-template-mui build`

## 2026-05-15 - LMS Platform Implementation Slice 13A: Deferred xAPI And Broad File Resources

### Summary

Extended the generic learning resource contract so xAPI and storage-backed broad file formats are represented honestly as configured-but-deferred resources. This keeps the LMS fixture close to iSpring-like content coverage without pretending that xAPI, SCORM, office documents, MOV/FLV, or uploaded media players are already implemented.

### Implemented

- Added `xapi` to the shared `ResourceSource` type contract.
- Kept `scorm`, `xapi`, `file`, and any storage-backed resource behind `isDeferredResourceSource()`.
- Allowed storage-backed video, audio, and document resources while keeping URL-backed runtime players limited to safe supported MIME types.
- Updated the published app `ResourcePreview` icon and tests so xAPI and storage-backed office documents show the deferred runtime state.
- Added xAPI resource acceptance to LMS platform and resource preview widget schema tests.
- Added `Xapi` to the LMS ResourceType enumeration template.
- Updated the LMS Playwright generator and fixture contract to seed and validate an explicit deferred xAPI placeholder.
- Updated the committed LMS snapshot fixture and recomputed its integrity hash.

### Validation

- `pnpm exec eslint --fix packages/universo-types/base/src/common/resourceSources.ts packages/universo-types/base/src/__tests__/resourceSources.test.ts packages/universo-types/base/src/__tests__/lmsPlatform.test.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
- `pnpm --filter @universo/types test -- resourceSources.test.ts lmsPlatform.test.ts applicationLayouts.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/apps-template-mui test -- ResourcePreview`
- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/utils test -- snapshotFixtures.test.ts`
- `pnpm supabase:e2e:start:minimal`
- `pnpm env:e2e:local-supabase`
- `pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
- `pnpm supabase:e2e:stop`
- Snapshot hash and resource-type sanity checks for the regenerated LMS fixture.

## 2026-05-15 - LMS Platform Implementation Slice 9A: Runtime Dashboard Card Grid Parity

### Summary

Restored one concrete part of `packages/apps-template-mui` dashboard visual parity by making runtime record cards fill the configured dashboard grid columns. This keeps record card views aligned with the existing workspace card behavior and the original MUI dashboard card layout without adding LMS-specific UI.

### Implemented

- Updated the runtime details card grid to expose a stable test target for visual and unit checks.
- Passed `allowStretch` to the shared `ItemCard` when dashboard records are rendered in card mode.
- Added a focused `MainGrid` test that locks the stretched-card contract for configured card grids.

### Validation

- `pnpm exec eslint --fix packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx`
- `pnpm --filter @universo/apps-template-mui test -- MainGrid`
- `pnpm --filter @universo/apps-template-mui build`
- `git diff --check -- packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx memory-bank/tasks.md memory-bank/progress.md`

## 2026-05-15 - LMS Platform Implementation Slice 12A: LMS Resource And Report Docs

### Summary

Updated GitBook LMS documentation to match the implemented resource and report runtime contracts. The docs now describe xAPI and broad storage-backed formats as deferred resources, and explain saved report rendering, CSV export, and report aggregation metrics through existing generic widgets.

### Implemented

- Updated `docs/en/guides/lms-resource-model.md` and `docs/ru/guides/lms-resource-model.md` for xAPI, SCORM, storage-backed media, documents, and office-format deferred states.
- Updated `docs/en/guides/lms-reports.md` and `docs/ru/guides/lms-reports.md` for saved `detailsTable` report rendering, CSV export, and `report.aggregation` stat-card metrics.
- Updated `docs/en/architecture/ledgers.md` and `docs/ru/architecture/ledgers.md` so the LMS ledger list matches the current operational template.
- Recorded the Phase 12 documentation slice in the active task ledger.

### Validation

- `git diff --check -- docs/en/guides/lms-resource-model.md docs/ru/guides/lms-resource-model.md docs/en/guides/lms-reports.md docs/ru/guides/lms-reports.md docs/en/architecture/ledgers.md docs/ru/architecture/ledgers.md memory-bank/tasks.md memory-bank/progress.md`
- `pnpm docs:i18n:check`

## 2026-05-15 - LMS Platform Implementation Slice 7G: Gamification And Achievements

### Summary

Completed the operational gamification slice for the canonical LMS configuration without adding LMS-specific runtime UI. Points, badges, achievements, leaderboard snapshots, and achievement reports are modeled as ordinary Objects, workflow metadata, scripts, and saved report definitions.

### Implemented

- Added `GamificationSettings`, `PointAwardRules`, `PointTransactions`, `BadgeDefinitions`, `BadgeIssues`, and `LeaderboardSnapshots` Objects to the LMS template.
- Added `PointSourceType` enumeration values for course, track, assignment, training event, certificate, and manual point sources.
- Added `GamificationEnabled` and `DefaultPointAward` app configuration constants.
- Added metadata-backed workflow actions for approving/reversing point transactions and issuing/revoking badges.
- Added `PointTransactionPostingScript` so approved point transactions can post movement facts into `PointsLedger`.
- Extended the LMS Playwright generator to seed gamification settings, deterministic point rules, point transactions, badges, badge issues, leaderboard snapshots, and the `Leaderboard` and `Achievements` report definitions.
- Strengthened the LMS fixture contract and template manifest tests for gamification entities, workflow metadata, fixed values, transactional behavior, script attachment, report definitions, and deterministic seeded row counts.
- Updated LMS report GitBook pages so saved leaderboard and achievement reports are documented alongside progress/course reports.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator; the new snapshot hash is `ac024a08166da02149930284fd7b1640f38abf4f8aa5b1028745191d89de2bf0`.

### Validation

- `pnpm exec eslint --fix packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/utils test -- snapshotFixtures.test.ts`
- `pnpm supabase:e2e:start:minimal`
- `pnpm env:e2e:local-supabase`
- `pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
- Snapshot sanity check for gamification object row counts, leaderboard totals, and point transaction status totals.
- `pnpm supabase:e2e:stop`

## 2026-05-15 - LMS Platform Implementation Slice 11A: Committed LMS Fixture Contract

### Summary

Added a focused committed-fixture unit contract for the canonical LMS snapshot so gamification, achievements, leaderboard rows, and saved report definitions are protected outside the Playwright generator path.

### Implemented

- Extended `packages/universo-utils/base/src/snapshot/__tests__/snapshotFixtures.test.ts` with a deterministic LMS fixture test.
- Added local snapshot helpers for localized entity codenames and Object row lookup without importing E2E support code into `@universo/utils`.
- Locked committed snapshot row counts for `GamificationSettings`, `PointAwardRules`, `PointTransactions`, `BadgeDefinitions`, `BadgeIssues`, and `LeaderboardSnapshots`.
- Locked deterministic totals for approved point transactions, current leaderboard totals, issued badges, and the top leaderboard row.
- Locked saved report codenames for `LearnerProgress`, `CourseProgress`, `Leaderboard`, and `Achievements`.

### Validation

- `pnpm exec eslint --fix packages/universo-utils/base/src/snapshot/__tests__/snapshotFixtures.test.ts`
- `pnpm --filter @universo/utils test -- snapshotFixtures.test.ts`

## 2026-05-15 - LMS Platform Implementation Slice 12B: Gamification Guide

### Summary

Added a dedicated GitBook guide for LMS gamification and achievements so the new template entities, workflows, posting script, ledger boundary, and saved reports are documented as generic platform configuration.

### Implemented

- Added `docs/en/guides/lms-gamification.md`.
- Added `docs/ru/guides/lms-gamification.md`.
- Linked both pages from the EN/RU GitBook summaries next to the LMS reports guide.
- Reused the existing Object records screenshot because gamification settings, badges, issues, point transactions, and leaderboard snapshots are Object-backed rows.

### Validation

- `pnpm docs:i18n:check`
- `git diff --check -- docs/en/guides/lms-gamification.md docs/ru/guides/lms-gamification.md docs/en/SUMMARY.md docs/ru/SUMMARY.md memory-bank/tasks.md memory-bank/progress.md packages/universo-utils/base/src/snapshot/__tests__/snapshotFixtures.test.ts`

## 2026-05-15 - LMS Platform Implementation Slice 9B: Workspace Metric Card Parity

### Summary

Aligned the workspace dashboard summary cards with the original MUI dashboard card surface by using the standard outlined Card/CardContent pattern instead of a custom bordered Box.

### Implemented

- Replaced the custom `WorkspaceMetricCard` Box surface in `packages/apps-template-mui` with `Card variant="outlined"` and `CardContent`.
- Preserved stable dimensions, text wrapping, and existing data-driven workspace dashboard behavior.
- Added a focused runtime workspace test assertion for the three metric cards rendered on the workspace dashboard route.

### Validation

- `pnpm exec eslint --fix packages/apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx packages/apps-template-mui/src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx`
- `pnpm --filter @universo/apps-template-mui test -- RuntimeWorkspacesPage`
- `pnpm --filter @universo/apps-template-mui build`

## 2026-05-16 - LMS Platform Implementation Slice 9C/11B: Workspace Metric Screenshot Gate And LMS Flow Cleanup

### Summary

Added a real Playwright screenshot gate for workspace dashboard metric cards and brought stale LMS flow tests back onto the current Object-based runtime API.

### Implemented

- Extended `lms-workspace-management.spec.ts` with dashboard metric-card coverage, a no-horizontal-overflow assertion, and the `runtime-workspace-dashboard-metric-cards.png` screenshot artifact.
- Updated the workspace flow to use the current published-app navigation contract (`Modules`) and role/label-based Playwright locators instead of stale `Object` and title-attribute selectors.
- Replaced removed `waitForApplicationCatalogId` imports with `waitForApplicationObjectId` in the workspace, class/module/quiz, and QR access-link LMS flows.
- Migrated the affected runtime-row setup payloads from legacy `linkedCollectionId` to `objectCollectionId`, so tests now target the intended LMS Objects under the current API contract.
- Added required `Slug` data to module rows created by the class/module/quiz and QR access-link flows.

### Validation

- `pnpm exec eslint --fix tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts tools/testing/e2e/specs/flows/lms-class-module-quiz.spec.ts tools/testing/e2e/specs/flows/lms-qr-code.spec.ts`
- `pnpm supabase:e2e:start:minimal`
- `pnpm env:e2e:local-supabase`
- `pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts --project=chromium`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-class-module-quiz.spec.ts --project=chromium`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-qr-code.spec.ts --project=chromium`

## 2026-05-16 - LMS Platform Implementation Slice 9D/12C: Published Runtime README Alignment

### Summary

Closed the remaining visual-parity and documentation checklist drift by documenting the current independent published-app runtime architecture instead of the removed legacy package dependency.

### Implemented

- Confirmed Phase 9 acceptance coverage already exists through runtime record-card unit coverage plus workspace/workspace-dashboard Playwright screenshot gates.
- Updated `packages/apps-template-mui/README.md` and `README-RU.md` to describe package-local runtime UI primitives, app-side Editor.js content authoring, generic resource preview states, workflow actions, saved-report rendering/export, and runtime workspace surfaces.
- Removed stale README guidance that still described `EnhancedDetailsSection` as consuming `@universo/template-mui` components.
- Replaced the obsolete related-package reference to `@universo/template-mui` with the actual published-runtime dependencies on `@universo/i18n` and `@universo/utils`.
- Marked Phases 9, 11, and 12 complete after all tracked sub-items had concrete implementation and validation artifacts.

### Validation

- `pnpm --filter @universo/apps-template-mui test -- MainGrid RuntimeWorkspacesPage packageBoundary`
- `git diff --check -- packages/apps-template-mui/README.md packages/apps-template-mui/README-RU.md memory-bank/tasks.md memory-bank/progress.md`

## 2026-05-16 - LMS Platform Implementation Slice 1B/12D: Shared Block Editor Package

### Summary

Removed the remaining duplicated Editor.js implementation by extracting a neutral shared package that is reused by both administrative authoring and published-app content creation flows.

### Implemented

- Added `@universo/block-editor` with the shared `EditorJsBlockEditor`, locale-aware Editor.js helpers, package-local Editor.js type declarations, Vitest coverage, and EN/RU package READMEs.
- Moved Editor.js tool dependencies to the new package owner instead of keeping duplicate dependencies in `@universo/template-mui` and `@universo/apps-template-mui`.
- Replaced both consumer-local editor implementations with workspace-package imports while preserving the existing public re-export surface from `@universo/template-mui` and `@universo/apps-template-mui`.
- Removed the duplicated editor source files and duplicate Editor.js declaration files from both consumers.
- Updated package documentation and `packages/README.md` so the package map reflects the real shared authoring boundary.

### Validation

- `pnpm install --lockfile-only`
- `pnpm install`
- `pnpm --filter @universo/block-editor lint`
- `pnpm --filter @universo/block-editor test`
- `pnpm --filter @universo/block-editor build`
- `pnpm --filter @universo/template-mui lint`
- `pnpm --filter @universo/template-mui build`
- `pnpm --filter @universo/template-mui test --runInBand`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm --filter @universo/apps-template-mui test -- FormDialog.blockEditor packageBoundary`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm supabase:e2e:start:minimal`
- `pnpm env:e2e:local-supabase`
- `pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-basic-pages-ux.spec.ts --project=chromium`
- `git diff --check -- packages/universo-block-editor packages/apps-template-mui packages/universo-template-mui packages/README.md memory-bank/tasks.md pnpm-lock.yaml`

## 2026-05-16 - LMS QA Remediation: Runtime Scripts And Workflow Capability Gate

### Summary

Closed the QA findings from the LMS implementation pass by fixing stale runtime script route fixtures and adding browser-level workflow permission proof to the LMS import flow.

### Implemented

- Updated runtime script route tests to use canonical application schema names (`app_<uuid without dashes>`) and the current SQL identifier format (`"schema"."_app_scripts"`), so route coverage now matches the production schema guard.
- Kept public runtime script RPC denial semantics fail-closed: missing `rpc.client` and lifecycle public RPC calls now remain covered by the route test suite with HTTP 403 expectations.
- Extended the LMS snapshot import Playwright flow with a real published-app row-action permission gate:
  - before role-policy grants, the `StartSubmissionReview` workflow action is hidden from the row actions menu;
  - the trusted backend workflow endpoint rejects the same action with `WORKFLOW_ACTION_UNAVAILABLE`, `missingCapability`, and `assignment.review`;
  - after the generic owner role-policy grant, the same workflow action becomes visible in the browser and succeeds through the UI.
- Added screenshots for the hidden and visible workflow-action menu states.

### Validation

- `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand -t "runtime/scripts"`
- `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
- `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions runtimeReportsService guards applicationsRoutes --runInBand`
- `pnpm --filter @universo/types test -- workflowActions lmsPlatform resourceSources pageBlocks`
- `pnpm --filter @universo/types lint`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/block-editor test`
- `pnpm --filter @universo/block-editor lint`
- `pnpm --filter @universo/block-editor build`
- `pnpm --filter @universo/apps-template-mui test -- RowActionsMenu useCrudDashboard ResourcePreview`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm docs:i18n:check`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `git diff --check`

### E2E Environment Blocker

- Started and checked the minimal local Supabase E2E stack with `pnpm supabase:e2e:start:minimal`, `pnpm env:e2e:local-supabase`, and `pnpm doctor:e2e:local-supabase`.
- The LMS Playwright wrapper run did not reach test execution because the backend failed during startup: `isolated-vm` has no native build for the current local runtime (`node=20.19.4`, while the repository requires `>=22.6.0`; the error also reports Electron ABI 115).
- `pnpm rebuild isolated-vm` completed but did not repair the local native module mismatch.
- The local Supabase E2E stack was stopped with `pnpm supabase:e2e:stop`.

## 2026-05-16 - Node 22 Environment And LMS E2E Remediation

### Summary

Resolved the local Node runtime mismatch that blocked the LMS Playwright validation and reran the previously blocked browser flow against the minimal local Supabase E2E stack.

### Implemented

- Removed obsolete nvm-managed Node versions and set the nvm default runtime to Node 22.22.2.
- Left the system `/usr/bin/node` package untouched because it is managed by the OS package manager, not nvm.
- Updated repository and package documentation from stale Node 18/20 and PNPM 9 requirements to the current Node 22 and PNPM 10 requirement.
- Added a repository-specific Playwright skill rule to activate Node 22 explicitly before E2E wrapper runs when a non-interactive shell can resolve an older system Node.
- Fixed the published application runtime workflow path exposed by the Node 22 Playwright run:
  - backend runtime columns now expose normalized string codenames for localized component metadata;
  - the authenticated published-app runtime adapter now wires metadata-backed workflow actions;
  - LMS E2E runtime row helpers map physical runtime fields back to stable component codenames for assertions.

### Validation

- `node -v` after `nvm use --silent 22`: `v22.22.2`
- `pnpm docs:i18n:check`
- `git diff --check`
- `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/routes/applicationsRoutes.test.ts --runInBand`
- `pnpm --filter @universo/applications-frontend test -- src/api/__tests__/apiWrappers.test.ts --runInBand`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed.

## 2026-05-16 - LMS QA Follow-up Remediation Complete

### Summary

Closed the remaining QA findings from the implemented iSpring-like LMS roadmap by tightening workflow capability boundaries, replacing native confirmations, expanding browser walkthrough coverage, and aligning Node 22 / PNPM 10 workspace metadata.

### Implemented

- Decoupled published-app metadata workflow actions from broad `editContent` permission in both UI visibility and backend route gating; exact metadata workflow capabilities remain fail-closed.
- Replaced `window.confirm` workflow prompts with the existing MUI runtime dialog surface and added focused component coverage for confirmed workflow actions.
- Expanded the LMS Playwright runtime flow so operational actions for submissions, attendance, certificates, development tasks, and notifications are exercised through real browser row-action clicks before assertions.
- Aligned remaining workspace Node type metadata and root documentation with the current Node 22 / PNPM 10 baseline.
- Marked the LMS roadmap status as implemented with QA follow-up remediation.

### Validation

- `pnpm --filter @universo/apps-template-mui test -- RowActionsMenu`
- `pnpm --filter @universo/applications-backend test -- guards runtimeWorkflowActions --runInBand`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm docs:i18n:check`
- `git diff --check`
- `pnpm supabase:e2e:start:minimal`
- `pnpm env:e2e:local-supabase`
- `pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed.

## 2026-05-16 - Final LMS QA Gap Closure

### Summary

Closed the final implementation gaps found by the last QA pass: the published runtime rows browser flow now reuses the seeded Title component, app-side Editor.js authoring is stable in production builds, persisted block-content JSON strings are parsed before edit dialogs open, and the full LMS snapshot browser flow was rerun under Node 22 against the minimal local Supabase E2E stack.

### Implemented

- Updated `application-runtime-rows.spec.ts` so the test reuses the seeded `Title` component and creates only the additional metadata-driven Editor.js content component required for the rich-content browser proof.
- Hardened `EditorJsBlockEditor` so empty authoring values seed an editable paragraph without mutating storage eagerly.
- Stabilized the Editor.js lifecycle by deriving dependency keys from block-editor constraints rather than array identity, preventing remount loops when parent forms recreate equivalent `allowedBlockTypes` arrays.
- Updated published-app `FormDialog` JSON block-content normalization to parse persisted JSON strings before passing values to the shared Editor.js editor.
- Added focused regression coverage for empty Editor.js authoring, stable block-editor lifecycle, and persisted JSON-string edit values.

### Validation

- `node -v` after `nvm use --silent 22`: `v22.22.2`
- `pnpm --filter @universo/block-editor test`: 12 passed.
- `pnpm --filter @universo/block-editor lint`
- `pnpm --filter @universo/block-editor build`
- `pnpm --filter @universo/apps-template-mui test -- FormDialog.blockEditor`: 134 passed in the package run.
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm docs:i18n:check`: GitBook documentation OK, 73 EN/RU page pairs checked.
- `git diff --check`
- `pnpm run build:e2e:local-supabase`: 31 workspace build tasks passed.
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-runtime-rows.spec.ts --project=chromium`: 2 passed.
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed.
- `pnpm supabase:e2e:stop`: local E2E Supabase profile stopped.

## 2026-05-16 - Published LMS Authoring and Workspace UI Closure

### Summary

Closed the user-visible LMS gaps found after importing `tools/fixtures/metahubs-lms-app-snapshot.json`: the published application now exposes real metadata-driven content authoring surfaces for LMS content, Editor.js block content is created and edited inside the published app, and workspace cards/tables/pagination use isolated `apps-template-mui` MUI surfaces aligned with the original dashboard/template style.

### Implemented

- Changed the LMS template navigation so primary published-app sections open operational object surfaces for Courses, Modules, Learning Resources, Knowledge Articles, and Development Plans instead of informational-only portal pages.
- Added metadata-level Editor.js JSON body fields and seeded block content for runtime-authored LMS content, including Knowledge Articles linked through folders and bookmarks.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator and tightened the fixture contract so regressions in menu targets, block-editor fields, or stale knowledge links fail fast.
- Reworked isolated runtime UI primitives in `packages/apps-template-mui` for cards, list tables, and `TablePagination`-based pagination without importing from `packages/universo-template-mui`.
- Expanded browser coverage to create and edit a Knowledge Article through the published app block editor, assert persisted Editor.js JSON through the runtime API, and verify real workspace card/table/pagination surfaces with screenshots.

### Validation

- `node -v` after `nvm use --silent 22`: `v22.22.2`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts`: 18 passed.
- `pnpm --filter @universo/apps-template-mui test -- src/components/runtime-ui/__tests__/runtimeUi.test.tsx src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx`: 135 passed in the package run.
- `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts`: 311 passed in the package run.
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm run build:e2e:local-supabase`
- `pnpm supabase:e2e:start:minimal`
- `pnpm env:e2e:local-supabase`
- `pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=generators specs/generators/metahubs-lms-app-export.spec.ts`: 2 passed.
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/lms-workspace-management.spec.ts`: 2 passed.
- `pnpm supabase:e2e:stop`: local E2E Supabase profile stopped.

## 2026-05-16 - LMS Final QA Follow-up Closure

### Summary

Closed the latest published LMS QA follow-up: Reports remains a direct primary navigation item instead of moving under More, generic runtime UI fallbacks are localized, workflow execution no longer rides on the broad edit-content alias, and stale Playwright/Turborepo skill references no longer point agents at Node 20 or PNPM 9 examples.

### Implemented

- Raised the LMS runtime menu `maxPrimaryItems` contract to 8 in the template, fixture, snapshot hash, manifest tests, and E2E contract so Home, Modules, Courses, Resources, Knowledge, Development, Reports, and Workspaces stay directly reachable.
- Tightened the LMS browser flow to assert that Reports is visible as a direct navigation item and that no More overflow item is rendered for this LMS menu.
- Replaced hardcoded generic runtime strings such as `More`, `Search`, table column fallbacks, empty state, and sort controls with `apps` namespace i18n keys.
- Removed `workflow.execute` from the broad `editContent` capability alias and updated guard/unit coverage to keep workflow actions exact and fail closed.
- Updated Playwright and Turborepo skill references from Node 20 / PNPM 9 examples to Node 22 / PNPM 10 guidance.

### Validation

- `node -v` after `nvm use --silent 22`: `v22.22.2`
- `pnpm --filter @universo/applications-backend test -- guards runtimeRowsController --runInBand`: 20 passed.
- `pnpm --filter @universo/apps-template-mui test -- src/components/runtime-ui/__tests__/runtimeUi.test.tsx src/hooks/__tests__/useCrudDashboard.test.tsx src/dashboard/components/__tests__/MenuContent.test.tsx --runInBand`: apps-template focused suite passed.
- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
- `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts --runInBand`: 311 passed in the package run.
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm docs:i18n:check`: 73 EN/RU page pairs checked.
- `git diff --check`
- `pnpm supabase:e2e:start:minimal`
- `pnpm env:e2e:local-supabase`
- `pnpm doctor:e2e:local-supabase`
- `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.
- `pnpm supabase:e2e:stop`: local E2E Supabase profile stopped.
