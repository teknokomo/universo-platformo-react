# Research: Interpretation Network Single System Structure and Workspace Templates

> Created: 2026-07-19
> Status: Reviewed
> Trigger: RESEARCH request based on the stakeholder TZ and technical brief dated 2026-07-19
> Follow-up plan: ../plan/interpretation-network-single-structure-and-templates-plan-2026-07-19.md

## Research Question

What architecture best fits the repository for:

1. an optional Interpretation Network mode with one unnamed system-owned Structure that opens directly as a Matrix;
2. saving the active Structure/Matrix as a workspace template, optionally with cell Materials;
3. instantiating a new Structure from that template without leaking source identities, crossing workspace boundaries, or leaving partial data;
4. preserving the existing MUI runtime style, publication/materialization rules, permission model, and product fixture proof chain without a schema-version or metahub-template-version increment?

The research supports the next PLAN session. It does not authorize product-code changes.

## Scope And Decision Inputs

-   Local stakeholder TZ dated 2026-07-19.
-   Local bilingual technical brief dated 2026-07-19, including its QA revisions.
-   The completed unified-settings and Interpretation Network configuration work recorded in Memory Bank.
-   Current repository source, tests, fixtures, package versions, project skills, and public EN/RU documentation.
-   Current primary upstream documentation for React, MUI, React Router, Playwright, and PostgreSQL.
-   The `movefasta/elm-suz-dal` README as product-context evidence, not as an implementation authority.

No user-provided HTTP URL was present in the current command. URLs inherited from the brief were refreshed where the runtime allowed it.

## Skills And Code Intelligence Used

-   `research-before-plan` for source quality, durable artifact structure, uncertainty, and PLAN handoff.
-   `universo-platform-architecture` for metahub → application → workspace ownership and the no-new-entity-kind rule.
-   `mui-runtime-ux-patterns` and `runtime-ux-qa` for the published MUI surface and browser acceptance contract.
-   `playwright-best-practices` for focused E2E, isolated role contexts, semantic locators, and viewport evidence.
-   `context7:context7-mcp` was attempted for current library documentation, but its OAuth refresh failed with `invalid_grant` in this session.
-   OntoIndex semantic exploration was used to locate settings, sync, runtime routing, permissions, fixture, and workspace execution flows. The index matched the current commit but reported degraded freshness because the worktree contains two unrelated dirty documentation files and embeddings are unavailable; direct source inspection was used for all material conclusions.
-   Three read-only subagents independently examined architecture/settings, clone/permission semantics, and fixture/Playwright coverage.

## Tool Availability And Research Limits

-   In the original research run, a separate general web-search tool was not exposed and direct outbound DNS was unavailable.
-   In the resumed QA pass, the built-in web tool successfully opened current official React Router, MUI, Playwright, and PostgreSQL documentation directly.
-   Context7 tools were exposed in the original run but unusable because their OAuth refresh token was invalid; in the resumed QA pass no Context7 query tool was callable after tool discovery. No Context7 claim is presented as successfully refreshed in this artifact.
-   GitHub MCP successfully fetched current primary upstream documentation and exact source SHAs during the original run. Direct official-doc web checks in the resumed QA pass matched the same conclusions.
-   `https://lmn.rs/` could not be refreshed and remains product context only.

These limitations do not block PLAN because the relevant stable framework behaviors were verified against current official upstream repositories. PLAN should retry Context7 only if tool-specific proof is required.

## Source Inventory

| Source                                                                                                                                                                                 | Type                                        | Date / Freshness                                                               | Why It Matters                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stakeholder TZ dated 2026-07-19                                                                                                                                                        | Local primary input                         | Current                                                                        | Defines the requested behavior, no-legacy rule, fixture requirement, and no-version-bump constraint.                                                        |
| Technical brief dated 2026-07-19                                                                                                                                                       | Local decision input                        | QA-revised 2026-07-19                                                          | Defines the intended settings, runtime, template, authorization, and test outcomes.                                                                         |
| `memory-bank/research/unified-settings-and-workspace-overrides-research-2026-07-16.md`                                                                                                 | Local research                              | 3 days old                                                                     | Establishes the completed three-layer settings model and materialized application semantics.                                                                |
| `memory-bank/tasks.md` and `memory-bank/progress.md`                                                                                                                                   | Local Memory Bank                           | Current checkout                                                               | Records completed Interpretation Network settings/runtime/fixture work and remaining browser-evidence conventions.                                          |
| `.agents/skills/universo-platform-architecture/SKILL.md` and `references/configuration-workflow.md`                                                                                    | Local architecture authority                | Current checkout                                                               | Defines ownership: canonical configuration in metahub, deployment tuning in Application, user content in Workspace.                                         |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md` and runtime UX references                                                                                                            | Local UX authority                          | Current checkout                                                               | Requires `apps-template-mui` isolation, MUI primitive reuse, localized validation, keyboard usability, and no technical leakage/overflow.                   |
| `packages/universo-react-types/src/common/interpretationNetworkLayout.ts`                                                                                                              | Local code                                  | Current checkout                                                               | Strict widget config schema and all current Interpretation Network widget keys.                                                                             |
| `packages/universo-react-types/src/common/unifiedSettings.ts`                                                                                                                          | Local code                                  | Current checkout                                                               | Global/application/workspace setting registry; shows the new mode is not currently registered and workspace overrides are explicit allowlists.              |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.template.ts`                                                                               | Local code                                  | Current checkout                                                               | Canonical widget seed, template version `0.1.0`, default layout, entity codenames, and no seeded runtime rows.                                              |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.stage2.ts`                                                                                 | Local code                                  | Current checkout                                                               | Structure, Interpretation, Material, TableTemplate, Matrix and MaterialRef metadata.                                                                        |
| `packages/universo-react-metahubs-frontend/src/domains/settings/ui/SettingsPage.tsx` and `domains/layouts/ui/InterpretationNetworkWorkspaceWidgetEditorDialog.tsx`                     | Local code                                  | Current checkout                                                               | Metahub Settings aggregates contextual widget settings; typed Matrix authoring already exists.                                                              |
| `packages/universo-react-applications-frontend/src/pages/ApplicationSettings.tsx` and `application-settings/MatrixSettingsPanel.tsx`                                                   | Local code                                  | Current checkout                                                               | Application-level materialized widget editor, explicit parser/equality/save normalizer, and config whitelist.                                               |
| `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`                                                                                     | Local code                                  | Current checkout                                                               | Publication snapshots serialize metahub settings, layouts, widget configs, and system fields.                                                               |
| `packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts` and `syncLayoutPersistence.ts`                                                                           | Local code                                  | Current checkout                                                               | Materializes source layouts/widgets and preserves application-owned override/conflict state.                                                                |
| `packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`                                                                          | Local code                                  | Current checkout                                                               | Runtime orchestration currently loads Structures, Interpretations, Materials, but not TableTemplates.                                                       |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/structureActions.ts`                                                                        | Local code                                  | Current checkout                                                               | Current Structure creation is three client mutations with compensating deletes, not one database transaction.                                               |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/{WorkspaceShell,StructurePane,useStructureRoute,useMatrixRouteSelectionSync}.tsx` | Local code                                  | Current checkout                                                               | Current list/title/Back UI and URL selection/history behavior that single mode must branch.                                                                 |
| `packages/universo-react-applications-backend/src/controllers/runtimeRowsController.ts`                                                                                                | Local code                                  | Current checkout                                                               | Existing generic row copy is transactional and locks the source, but copies TABLE child values verbatim and cannot safely remap Matrix/Material identities. |
| `packages/universo-react-applications-backend/src/routes/guards.ts` and `packages/universo-react-types/src/common/roles.ts`                                                            | Local code                                  | Current checkout                                                               | Current permission vocabulary and role defaults.                                                                                                            |
| `packages/universo-react-applications-backend/src/services/applicationWorkspaces.ts` and `shared/runtimeHelpers.ts`                                                                    | Local code                                  | Current checkout                                                               | Workspace RLS, request-local workspace context, support tables, and active workspace isolation.                                                             |
| Product generator → fixture contract → drift → imported runtime chain under `tools/testing/e2e/`                                                                                       | Local test infrastructure                   | Current checkout                                                               | Canonical product proof and the only supported way to regenerate the fixture.                                                                               |
| `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`                                                                                                                     | Local generated product fixture             | Generated 2026-07-14                                                           | Current canary; contains metadata/settings but intentionally no authored Structure/Interpretation/Material/TableTemplate rows.                              |
| React docs: `https://react.dev/learn/sharing-state-between-components`                                                                                                                 | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `2fbef89180150915f106ed4de7b6fc51b88c569d`     | Confirms one owner/single source of truth for each state item.                                                                                              |
| React docs: `https://react.dev/learn/choosing-the-state-structure`                                                                                                                     | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `2533a53d85dad69330d8403a64ad448c925e399e`     | Supports avoiding duplicated/contradictory state and deriving values.                                                                                       |
| MUI Dialog docs: `https://mui.com/material-ui/react-dialog/`                                                                                                                           | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `891e9b695db584a1d702ba3a170a4e38de86f1d1`     | Confirms standard Dialog composition and responsive full-screen pattern.                                                                                    |
| MUI `useMediaQuery`: `https://mui.com/material-ui/react-use-media-query/`                                                                                                              | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `76879bf76fd8e81141afd1bc555f3a6c503f3ed3`     | Confirms breakpoint-aware responsive UI.                                                                                                                    |
| React Router 6.30.4 `useNavigate`: `https://reactrouter.com/6.30.4/hooks/use-navigate`                                                                                                 | Primary official docs                       | Tag `react-router@6.30.4`; file SHA `0db8e9ed82feab503f671a77744e21269ea80a82` | Confirms history replacement and delta navigation semantics matching the installed version.                                                                 |
| Playwright best practices: `https://playwright.dev/docs/best-practices`                                                                                                                | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `253dad0ea13200c1053fc9ecb220c3bd900cf0d5`     | Confirms user-visible behavior, resilient locators, and web-first assertions.                                                                               |
| Playwright isolation: `https://playwright.dev/docs/browser-contexts`                                                                                                                   | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `36f256da866cd8550b8bb28ebffce7f2baed2e62`     | Confirms per-test BrowserContext isolation and multi-context role scenarios.                                                                                |
| PostgreSQL INSERT: `https://www.postgresql.org/docs/current/sql-insert.html`                                                                                                           | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `121a9edcb99daf97db9f56c48517b9ffe54109ec`     | Supports `INSERT ... SELECT`, conflict handling, and `RETURNING` for copy commands.                                                                         |
| PostgreSQL row security: `https://www.postgresql.org/docs/current/ddl-rowsecurity.html`                                                                                                | Primary official docs                       | GitHub MCP 2026-07-19; file SHA `0fcdabd7877fc8600d1aa6d058309a1cf7b0cccd`     | Confirms policy-controlled row visibility/mutation and default-deny behavior.                                                                               |
| `https://github.com/movefasta/elm-suz-dal` README                                                                                                                                      | Primary project repository, product context | GitHub MCP 2026-07-19; SHA `9986c348ec96d7ac55ae81f8debe174b0e315b57`          | Confirms hierarchical-table, attached-file, local-copy, version-comparison, collaboration, and IPFS context; not a stack authority.                         |

## Resumed QA Verification

The resumed pass checked the artifact against the research-mode template and PLAN handoff checklist. The artifact is in `memory-bank/research/`, includes the research question, records source freshness, separates facts from inferences, lists conflicts and uncertainty, maps findings to repository areas, and ends with explicit open questions before PLAN.

Local path checks confirmed that the cited Memory Bank files, settings/runtime/backend/template/test files, and project skill files exist in the current checkout. The registered-template claim was rechecked against `builtinTemplates`, including `basic`, `basic-demo`, `empty`, `lms`, `1c-compatible`, `playcanvas`, and `interpretation-network`.

Current official web checks confirmed the external assumptions used by this research:

-   React Router 6.30.4 documents `useNavigate` with `replace?: boolean` and history-delta navigation, supporting the ID-free route repair recommendation.
-   MUI Dialog documents standard Dialog composition and responsive full-screen behavior via `useMediaQuery`, supporting the runtime dialog contract.
-   Playwright's best-practices documentation continues to emphasize user-visible locators and web-first assertions; repository-local Playwright guidance also prefers role/label locators and isolated contexts.
-   PostgreSQL current documentation confirms row-security policy behavior and the default-deny posture when RLS is enabled without matching policies.

## Current Stack Baseline

-   React: `18.3.1`.
-   MUI Material: resolved `7.3.8` from catalog range `^7.3.7`.
-   React Router / React Router DOM: `6.30.4`.
-   Playwright: `1.58.2`.
-   PostgreSQL client (`pg`): `8.11.1`; PostgreSQL/Supabase remains the only database target.
-   Shared validation uses Zod `3.25.76` through the root override.

The external patterns in the brief are consistent with the installed stack. No framework upgrade is required for this feature.

## Key Findings

### 1. The mode belongs to materialized widget configuration, not workspace preferences

**Fact:** Existing Interpretation Network display/behavior settings are stored in the `interpretationNetworkWorkspace` widget config. The metahub authoring dialog and aggregated Metahub Settings edit the same widget. Application Settings edits materialized copies of active widgets.

**Fact:** `UNIFIED_SETTINGS_REGISTRY` currently describes global application/workspace settings. Workspace-eligible keys are explicitly enumerated and the current application schema is strict. Adding an unrelated global key would create a second source of truth beside the widget config.

**Inference:** The clean contract is an enum in the shared widget schema, for example:

```text
structureMode = multiple | singleSystem
```

Default should remain `multiple`. The metahub widget config is the canonical source default, and the materialized Application widget config may override it. Workspace override is not appropriate because changing the invariant per workspace would make navigation, lifecycle, and administrative expectations inconsistent inside one deployment.

**PLAN implication:** Treat the setting as application-only materialized widget configuration. Project it into both Settings surfaces, but do not persist a duplicate scalar in application global settings or `_app_workspace_settings`.

### 2. One system Structure actually means one aggregate: Structure + Interpretation + root Matrix cell

**Fact:** The Matrix TABLE is not stored on Structure. It is stored on an Interpretation row through `InterpretationMatrix`; an Interpretation references its Structure through `ParentStructure`.

**Fact:** Normal Structure creation creates a Structure row, then an Interpretation row, then the root `Universe` / `Вселенная` Matrix child row.

**Fact:** The current three-step frontend helper uses compensating deletes. It cannot guarantee atomicity if compensation fails.

**Inference:** The system invariant is not merely “exactly one Structure”. It is “exactly one system Structure with exactly one canonical Interpretation and a valid initial Matrix root for hierarchical mode”. Direct Matrix entry cannot work reliably unless the whole aggregate exists.

**PLAN implication:** Add one server-side aggregate command/service. Do not reuse the client helper for system bootstrap, template saving, or instantiation.

### 3. A hidden identity field is safer than overloading the required display Name

**Fact:** `Structure.Name` is the display component. The backend automatically makes display components required. An empty/null Name is invalid even if the UI hides it.

**Fact:** The user forbids a user-entered or visible name, not an internal server-owned value.

**Recommended contract:**

-   add a hidden, server-owned Structure component such as `SystemKey`;
-   use a stable value such as `primary` only for the single system aggregate;
-   keep a non-empty localized server-owned Name, for example `Main structure` / `Основная структура`, but never render it in single mode;
-   keep a non-empty canonical Interpretation title for data integrity;
-   deny ordinary rename/delete of the system aggregate while single mode is active.

This also produces a reasonable visible fallback if an administrator later returns the application to multi mode.

### 4. Lazy, explicit, idempotent server bootstrap is the most robust lifecycle boundary

**Fact:** The product fixture intentionally contains no workspace-authored runtime rows. Workspaces are runtime isolation units created after application materialization.

**Fact:** Application sync operates on metadata/layouts, not every future workspace's content.

**Inference:** Seeding the system Structure in the metahub snapshot would violate workspace ownership and the existing no-seeded-runtime-row fixture contract. Creating it only during application sync would miss later workspaces.

**Recommended lifecycle:**

1. When a workspace is created, the runtime may eagerly call the same aggregate ensure service.
2. On first entry to the Structures section, call an explicit idempotent server command as the authoritative fallback.
3. The command runs only when the effective materialized widget config is `singleSystem`.
4. It executes under workspace RLS context inside one transaction.
5. It serializes concurrent first entry with a transaction-scoped advisory lock keyed by application/workspace/Object identity or an equivalent uniqueness boundary.
6. Zero aggregate rows → create Structure, canonical Interpretation, and root cell.
7. Exactly one unmarked compatible aggregate → adopt it only under a documented rule; otherwise require the hidden system key.
8. Multiple active candidates or duplicate system keys → fail closed with a localized administrative error; never choose by row order.

The command is system bootstrap, not user-authored creation. A read-only workspace member must still be able to open the Matrix, so bootstrap authorization should be based on legitimate runtime/workspace read access plus the effective single-mode config, not on exposing generic `createContent` to that member.

### 5. Current route state assumes a Structure ID in the path

**Fact:** Current routes use `/a/:applicationId/:structureSection/:structureId` and optional `?matrixCell=` focus. A missing Structure ID means “show the list”. Invalid IDs repair back to the list.

**Inference:** Single mode needs one canonical URL rule. Otherwise the runtime will briefly render the list, push unnecessary history, or lose deep-link/back semantics.

**Recommended routing:**

-   `/a/:applicationId/:structureSection` is the canonical user-facing single-mode route;
-   runtime resolves/ensures the hidden Structure without exposing its ID in the URL;
-   optional `?matrixCell=` remains valid for cell focus;
-   automatic repairs and initial resolution use history replacement;
-   explicit user navigation between sections uses normal push navigation;
-   old `/:structureId` URLs in single mode should replace to the canonical ID-free route if the ID is the system Structure, and fail closed/not-found if it targets another Structure;
-   multi mode retains the current list/detail URL contract.

This follows the current React Router version's replace/push semantics and avoids a raw hidden identity in normal URLs.

### 6. The template workflow has two copy boundaries, not one

**Fact:** `TableTemplate.TemplateMatrix` repeats the same 23 Matrix child fields, including `CellId`, `ParentCellId`, row/column keys, styling, ordering, and `MaterialRef`.

**Fact:** Materials are separate Object rows with localized Title/Description, Editor.js Body JSON, and hidden `CellId`. Runtime attachment is represented redundantly by Matrix `MaterialRef` and Material `CellId`.

**Inference:** Copying raw child rows would preserve source Cell IDs and Material IDs. Correct behavior requires two independent remaps:

1. **Structure → TableTemplate** when saving the template.
2. **TableTemplate → new Structure/Interpretation** when instantiating it.

At each boundary:

-   generate new child-row identities and UUID v7 `CellId` values;
-   remap every `ParentCellId` through the cell map;
-   preserve `_tp_sort_order`;
-   preserve localized labels, descriptions, values, styles, and matrix presentation;
-   remap row/column keys by equivalence class so cells that shared an axis still share a newly generated axis key;
-   never carry a raw source `MaterialRef` forward;
-   when Materials are included, create fresh Material rows, map Material `CellId` to the destination CellId, then set destination `MaterialRef` to the new Material row ID;
-   when Materials are excluded, clear every `MaterialRef` and create no template/destination Material row.

Tests must assert both remap boundaries, not only the final Structure.

### 7. Existing generic row copy is a useful reference but not the final command

**Fact:** `copyRow` in `runtimeRowsController.ts` already:

-   checks `createContent`;
-   requires edit access to the source row;
-   checks optimistic version;
-   locks the source with `FOR UPDATE`;
-   creates parent and TABLE child rows inside `DbExecutor.transaction()`;
-   supports metadata-declared related-row copy;
-   rolls back on errors.

**Fact:** It copies TABLE child values verbatim and does not understand Matrix identity graphs or Material attachment remapping.

**Inference:** PLAN should extract/reuse its safe primitives rather than add another large branch to the already monolithic controller. A dedicated service/store boundary is warranted for the Interpretation Network aggregate command, with routes/controllers kept thin.

### 8. Template ownership should remain workspace-local in phase 1

**Fact:** Structure, Interpretation, Material, and TableTemplate are ordinary workspace-scoped runtime Objects governed by the active workspace and RLS.

**Inference:** Workspace-local templates match the current architecture and avoid cross-workspace content disclosure. Application-wide or cross-application templates would require a new sharing/distribution model, ACL, provenance, conflict, import/export, and deletion contract.

**Recommended phase-1 ownership:**

-   TableTemplate and any cloned template Materials live in the same workspace as the source;
-   templates are visible to users who can read that workspace content;
-   saving requires create permission plus edit access to the source aggregate;
-   instantiating requires create/edit permissions for the new aggregate plus read access to the template;
-   RLS rejects cross-workspace template/material IDs even if the caller guesses them;
-   application sync never overwrites or deletes workspace-authored templates.

### 9. Existing permissions are sufficient unless product semantics require a read-only instantiator

**Fact:** The current base permission vocabulary is `manageMembers`, `manageApplication`, `createContent`, `editContent`, `deleteContent`, and `readReports`. Owner/admin/editor can create/edit by default; member cannot.

**Fact:** Role-policy capability aliases already support fine-grained effective capability resolution without changing every base role interface.

**Recommended phase-1 decision:**

-   save template: `createContent` + `editContent` on the source aggregate;
-   instantiate template: `createContent` + `editContent` for the destination and read access to the template;
-   delete template: `deleteContent` plus normal record access;
-   UI visibility mirrors the effective server decision, but direct API denial remains the security oracle.

Do not expand `RolePermission` unless the product explicitly needs a user who cannot otherwise create/edit content to save or instantiate templates. A new permission would be a cross-cutting change to role policies, response schemas, runtime contexts, i18n, documentation, and tests.

### 10. Single mode and “create a new Structure from template” conflict by definition

**Fact:** Single mode requires exactly one Structure and hides list/create UI.

**Fact:** Instantiating a template creates a new Structure.

**Conflict:** Both actions cannot occur in the same workspace without breaking the single-mode invariant.

**Safe options:**

1. Multi mode supports save and instantiate; single mode supports save only and keeps templates for later use after mode is disabled.
2. Single mode replaces “instantiate” with a separately specified destructive/merge action, “Apply template to the system Matrix”.
3. Templates become shareable outside the workspace/application, which is materially larger and not recommended for phase 1.

**Recommendation:** Choose option 1 for this slice. Keep template save available in both modes if product value justifies it, but expose “Create Structure from template” only in multi mode. Do not silently replace the system Matrix. If the stakeholder expects template application inside single mode, PLAN must stop and define option 2's overwrite/merge/rollback UX first.

### 11. Relations and external assets should be excluded from phase-1 template copy

**Fact:** The TZ explicitly names structure data and optionally cell Materials. It does not explicitly require Relation rows or binary/resource duplication.

**Fact:** Relation endpoints may point outside the Matrix. Blind copy can disclose or corrupt references. Material Body may include Editor.js image/embed URLs, while the current Material Object owns no separate binary asset store.

**Recommended allowlist:**

-   include Structure Name/Description only when creating a normal multi-mode destination;
-   include the selected canonical Interpretation Matrix child graph;
-   include Material Title, Description, Body, and destination CellId only when requested;
-   preserve ordinary external URLs embedded in validated Editor.js Body as content references, but do not clone external blobs/files or authorization tokens;
-   exclude Relation rows and all other linked records in phase 1;
-   reject unknown structured fields instead of copying them opportunistically.

If Relations or managed files are required, they need a separate explicit copy graph and authorization model before PLAN can safely include them.

### 12. The current widget does not load or render templates

**Fact:** Runtime configuration already contains TableTemplate codenames/field names and component tests have metadata fixtures, but the production widget query loads only Structures, Interpretations, and Materials.

**PLAN implication:** Add typed API hooks/query keys for:

-   template list metadata;
-   selected template Matrix rows;
-   save-template aggregate command;
-   instantiate-template aggregate command;
-   idempotent system-aggregate ensure/resolve command.

Do not load every 5000-row TemplateMatrix eagerly with the workspace shell. Load a selected template on demand and show bounded progress/error states.

### 13. The MUI UX contract needs explicit long-running-command behavior

The save-template dialog should reuse local `apps-template-mui` FormDialog/dialog primitives and provide:

-   required localized template Name;
-   optional multiline Description;
-   one explicit radio choice: Structure only / Structure and cell Materials;
-   clear explanation that Relations and external files are excluded;
-   initial focus, focus trap, Escape/Cancel, and focus restoration to the trigger;
-   mobile `fullScreen` behavior through the existing responsive dialog contract;
-   disabled duplicate submit while the server command is pending;
-   visible progress for large matrices and localized success/error feedback;
-   no raw UUID, JSON, field codename, or technical system name.

The create-from-template dialog in multi mode needs a template picker by localized Name, destination Structure Name/Description, and the same duplicate-submit/focus/error guarantees.

### 14. The fixture must not seed runtime content

**Fact:** The strict fixture contract currently asserts zero Structure, Interpretation, Relation, Material, and TableTemplate runtime rows.

**Inference:** This should remain true. The system aggregate is workspace runtime content and must be created by the server ensure command after import/workspace access.

**Recommended canary strategy:**

-   keep the built-in widget schema default `multiple`;
-   make the product generator explicitly configure `singleSystem` in the canonical Interpretation Network metahub before publication so the generated fixture proves the new metahub setting;
-   verify inherited single mode in one application;
-   create a separate application override or dedicated test setup with `multiple` for the existing list/header/Back regression;
-   do not try to make one browser state prove contradictory modes;
-   do not hand-edit the JSON fixture.

The strict contract should assert the enum value, unchanged schema/template versions, no runtime rows, and the exact seven registered built-in template codenames.

### 15. Full browser instantiation of all seven templates is unnecessary

**Fact:** Only configurations with a compatible `interpretationNetworkWorkspace` widget and Structure/Interpretation/Matrix model can expose this feature.

**Recommended coverage:**

-   registry/unit tests enumerate `basic`, `basic-demo`, `empty`, `lms`, `1c-compatible`, `playcanvas`, and `interpretation-network`;
-   settings component tests prove the control appears only for compatible active materialized widgets;
-   Interpretation Network receives full generator/import/runtime coverage;
-   one unrelated-template browser canary proves the setting/action is absent;
-   do not create seven expensive full browser applications solely to prove absence.

### 16. The existing imported-snapshot test must not absorb all new proof

**Fact:** The current imported-snapshot flow is a single long owner scenario. It already covers EN/RU, Matrix views, CRUD, Materials, technical leakage, responsive viewports, and overflow.

**Recommended split:**

-   focused single-structure flow: settings propagation, aggregate ensure, direct Matrix, canonical route, refresh/back/forward, responsive proof;
-   focused template flow: both material choices, both remap boundaries, source immutability, create-from-template in multi mode;
-   focused permission flow tagged `@permission`: separate editor/member BrowserContexts, hidden actions, direct API `403`, cross-workspace/RLS denial;
-   service/integration failure injection for rollback and concurrent ensure;
-   retain the existing imported flow as multi-mode regression instead of making it longer.

## Conflicts And Uncertainty

### Public documentation conflicts

-   `docs/{en,ru}/guides/interpretation-network.md` says existing workspace roles are sufficient and describes table-template behavior as if available. The runtime UI/API is currently metadata-only.
-   `packages/universo-react-apps-template-mui/README{,-RU}.md` describes structure-first list behavior, which becomes conditional.
-   Architecture skill references still describe only four built-in metahub templates, while code registers seven. Code is authoritative for the current registry.

PLAN must synchronize affected EN/RU docs and README mirrors with the implemented contract.

### Context7 uncertainty

Context7 could not be queried in the original research run because OAuth refresh failed, and no Context7 query tool was callable during the resumed QA pass. Current upstream primary documentation was refreshed through GitHub MCP and then rechecked through the built-in web tool where available. This affects tool provenance, not the underlying stable conclusions.

### Product uncertainties that materially affect PLAN

1. Does the stakeholder expect a template to be applied inside single mode? If yes, “Apply/replace system Matrix from template” needs its own product contract; ordinary instantiation is incompatible.
2. Should Material Body copy retain ordinary external image/embed URLs, or must all external references be cleared? The current data model has no owned binary-copy mechanism.
3. Is preserving/copying Relations required despite their omission from the explicit TZ? This research recommends no.
4. Should the canonical product fixture be generated with inherited metahub `singleSystem` or with an Application override? This research recommends inherited metahub mode plus a separate multi-mode application override test.

## Project Implications

### Shared contracts

-   Extend `interpretationNetworkWorkspaceWidgetConfigSchema` with a strict enum and shared normalizer.
-   Thread the new field through runtime `InterpretationNetworkWorkspaceConfig`, `DEFAULT_CONFIG`, and `toConfig`.
-   Keep it application-only; do not add it to `WORKSPACE_OVERRIDABLE_SETTING_KEYS`.
-   Update application parser/equality/normalizer/whitelist/cache behavior and metahub typed widget editor.

### Template metadata

-   Add hidden server-owned system identity metadata to Structure and any provenance fields required for safe template Material lifecycle.
-   Preserve template/schema version numbers per explicit constraint; the database and fixture are regenerated.
-   Keep TableTemplate and Material as Object-backed workspace records; no new entity kind or preset.

### Backend

-   Add thin routes/controllers over modular aggregate command services/stores.
-   Resolve Object/component/table identifiers from validated metadata codenames; never trust physical table/column names from the browser.
-   Use request-scoped `DbExecutor`, schema-qualified parameterized SQL, workspace RLS context, UUID v7, `RETURNING`, optimistic source versions, row/advisory locking, and one transaction per aggregate command.
-   Fail closed on zero/multiple system aggregates, source access failure, malformed Matrix hierarchy, stale versions, unknown fields, or unavailable Material references.
-   Dispatch lifecycle events only after commit, following existing runtime copy behavior.

### Runtime MUI

-   Branch existing `WorkspaceShell`/`StructurePane` composition by the effective enum rather than fork the Interpretation Network page shell.
-   Reuse local dialogs, table/card primitives, i18n, query invalidation, and runtime UX helpers inside `apps-template-mui`.
-   Keep the package isolated from legacy frontend packages.

### Tests and fixture

-   Extend strict type/schema/template/component tests before browser work.
-   Add direct service/store/route tests for authorization, two-stage remapping, concurrency, and rollback.
-   Extend the product generator, semantic fixture contract, drift gate, imported snapshot flow, visual semantics, and local verification wrapper together.
-   Keep generated JSON generated and keep runtime-authored rows out of the fixture.

### Documentation

-   Update EN/RU data model, user guide, and affected package README mirrors.
-   Document single versus multi mode, template ownership, copy allowlist, role requirements, excluded Relations/files, and fixture generation.

## Recommended Decision

Proceed to PLAN with the following baseline:

1. Add `structureMode: 'multiple' | 'singleSystem'` to the strict Interpretation Network widget config; default `multiple`.
2. Store the canonical value in the metahub widget and materialize it into Applications; allow Application override/reset; disallow Workspace override.
3. Model the system Matrix as a server-owned workspace aggregate: hidden `SystemKey`, friendly localized internal Name/Title, one Structure, one canonical Interpretation, and root cell.
4. Resolve/create that aggregate through an explicit idempotent server command using workspace RLS and transaction serialization; use an ID-free canonical single-mode route.
5. Keep TableTemplates workspace-local. Save and instantiate only through server aggregate commands, with fresh UUID v7 identities and two-stage cell/material remapping.
6. Use existing `createContent`/`editContent`/`deleteContent` permissions for phase 1; add a new capability only if the product requires a read-only template instantiator.
7. Copy Matrix data and optionally Material Title/Description/Body; exclude Relations and binary-resource cloning.
8. In single mode, do not expose “Create Structure from template”. Ordinary instantiation remains a multi-mode action. A future “Apply template to system Matrix” requires separate approval and semantics.
9. Make the generator configure single mode explicitly, keep the fixture free of runtime rows, and retain a separate multi-mode regression.
10. Split focused browser flows and keep all-table/template identity, authorization, atomicity, and failure proof primarily in service/integration tests.

This path satisfies the TZ without adding legacy compatibility code, a new entity kind, a new runtime UI shell, a workspace preference, or a schema/template version increment.

## Acceptance Matrix For PLAN

| Area               | Required PLAN acceptance                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setting            | Strict enum; default multiple; metahub round trip; snapshot/widget materialization; Application true/false/reset; no Workspace override; unsupported templates absent.          |
| System aggregate   | Zero creates exactly one Structure + Interpretation + root; concurrent ensure remains one; duplicates fail closed; technical names hidden; delete/rename denied in single mode. |
| Routing            | Structures opens Matrix directly; ID-free canonical route; refresh and `matrixCell` focus work; repairs replace history; browser back/forward coherent.                         |
| Multi regression   | List/filter/create, named header, and Back remain unchanged when mode is multiple.                                                                                              |
| Save template      | Required Name, multiline Description, explicit material choice, source unchanged, no source IDs in template.                                                                    |
| Instantiate        | Multi mode only; new Structure/Interpretation/Matrix; all agreed fields copied; fresh identity graph; source/template unchanged.                                                |
| Materials excluded | No cloned Material rows; all destination MaterialRef values null; legitimate empty-material UI.                                                                                 |
| Materials included | New template Materials on save and new destination Materials on instantiate; Body validated; CellId and MaterialRef remapped at both boundaries.                                |
| Authorization      | Editor positive; member/read-only action absent; direct API 403; cross-workspace IDs denied by access checks/RLS.                                                               |
| Atomicity          | Injected failure leaves no partial Structure, Interpretation, template, Matrix child, or Material rows.                                                                         |
| UX                 | Existing MUI style; localized EN/RU validation/status; semantic controls; focus restoration; duplicate-submit protection; no raw IDs/JSON; no page overflow.                    |
| Responsive         | `1920×1080`, `768×1024`, `390×844`; mobile full-screen dialog where appropriate; constrained component-local table scroll.                                                      |
| Fixture            | Generator-only update; strict semantic assertions; no runtime rows; unchanged version fields; normalized drift clean.                                                           |
| Template registry  | Unit/registry coverage for all seven; full browser canary only for compatible Interpretation Network plus one unrelated absence canary.                                         |
| Documentation      | EN/RU guide, data model, and package README mirrors reflect actual implementation and permissions.                                                                              |

## Open Questions Before PLAN

1. Confirm the recommended single-mode rule: template saving may exist, but creating a new Structure from a template is hidden; no implicit replacement of the system Matrix.
2. Confirm Material scope: copy stored Title, Description, and Editor.js Body including ordinary embedded URLs, but do not duplicate external files/blobs or authorization-bearing resources.
3. Confirm Relations are excluded from this implementation slice.
4. Confirm the canonical generator should set inherited metahub `singleSystem`, while a separate Application override supplies the multi-mode regression.

If these recommendations are accepted, none of the questions blocks creation of a detailed PLAN; PLAN can record them as locked decisions.

## Sources

-   Local stakeholder TZ and technical brief dated 2026-07-19.
-   `memory-bank/research/unified-settings-and-workspace-overrides-research-2026-07-16.md`
-   `memory-bank/tasks.md`
-   `memory-bank/progress.md`
-   `.agents/skills/universo-platform-architecture/SKILL.md`
-   `.agents/skills/mui-runtime-ux-patterns/SKILL.md`
-   `.agents/skills/runtime-ux-qa/SKILL.md`
-   `.agents/skills/playwright-best-practices/SKILL.md`
-   `packages/universo-react-types/src/common/{interpretationNetworkLayout,unifiedSettings,roles}.ts`
-   `packages/universo-react-metahubs-backend/src/domains/templates/data/{index,interpretation-network.template,interpretation-network.stage2}.ts`
-   `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/settings/ui/SettingsPage.tsx`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/InterpretationNetworkWorkspaceWidgetEditorDialog.tsx`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationSettings.tsx`
-   `packages/universo-react-applications-frontend/src/pages/application-settings/MatrixSettingsPanel.tsx`
-   `packages/universo-react-applications-backend/src/controllers/runtimeRowsController.ts`
-   `packages/universo-react-applications-backend/src/routes/guards.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/{syncHelpers,syncLayoutPersistence}.ts`
-   `packages/universo-react-applications-backend/src/services/applicationWorkspaces.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/**`
-   `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`
-   `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`
-   `tools/testing/e2e/support/checkInterpretationNetworkFixtureDrift.ts`
-   `tools/testing/e2e/specs/flows/interpretation-network-app-imported-snapshot.spec.ts`
-   `tools/testing/e2e/specs/visual/interpretation-network-workspace.spec.ts`
-   `https://react.dev/learn/sharing-state-between-components`
-   `https://react.dev/learn/choosing-the-state-structure`
-   `https://mui.com/material-ui/react-dialog/`
-   `https://mui.com/material-ui/react-use-media-query/`
-   `https://reactrouter.com/6.30.4/hooks/use-navigate`
-   `https://playwright.dev/docs/best-practices`
-   `https://playwright.dev/docs/browser-contexts`
-   `https://www.postgresql.org/docs/current/sql-insert.html`
-   `https://www.postgresql.org/docs/current/ddl-rowsecurity.html`
-   `https://github.com/movefasta/elm-suz-dal`
