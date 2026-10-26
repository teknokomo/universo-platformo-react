# Research: Interpretation Network Public Runtime and Advanced Workspace

> Created: 2026-10-22
> Status: Reviewed
> Trigger: RESEARCH request based on the stakeholder input and QA-refined technical brief dated 2026-10-22
> Follow-up plan: TBD in PLAN mode
> QA review: 2026-10-22; three independent read-only reviews plus direct current-source, Context7, OntoIndex and web revalidation

## Research Question

What architecture best fits the current Universo codebase for completing the Interpretation Network with:

1. anonymous read-only access to a published public application;
2. working human-readable application aliases such as /a/suzdal;
3. a policy-driven cell-style editor whose allowed colors and editable style capabilities can be controlled from metahub defaults, Application overrides, and explicitly delegated Workspace overrides;
4. saving either a complete Structure or a selected hierarchical Matrix branch as a reusable template;
5. multiple Materials per cell with zero or one explicitly selected Primary Material;
6. personal, entity-backed Favorites for Matrix cells?

The research supports a later PLAN session. It does not authorize product-code implementation.

Cross-cutting delivery constraints are separate from the six stakeholder capabilities: keep configuration ownership aligned with metahub -> Application -> explicitly delegated Workspace layers, regenerate the canonical Interpretation Network fixture through the product generator, preserve no disposable legacy data shape, and do not bump the database schema or metahub-template version for this clean-database change.

## QA Verdict And Requirement Traceability

**Verdict after QA: PASS WITH CORRECTIONS INCORPORATED.** No CRITICAL blocker was found. The original direction remains valid, but the QA pass found material precision gaps around the public Dashboard host, target-aware Workspace settings, multiple-Material copy/delete lifecycle, branch-mode semantics, Favorites identity, source traceability and runtime UX primitives. The corrections are incorporated below.

| Requirement | Stakeholder capability                                                                                                                      | Research decision / location                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1          | Anonymous users can open a public Interpretation Network application read-only                                                              | Findings 1-4: reuse the authoritative public resolver/public-entry Workspace transaction, add a strict public Dashboard host/DTO and specialized Interpretation Network read projector, omit mutation/admin surfaces from the DOM.      |
| R2          | Human-readable /a/:alias works, including /a/suzdal                                                                                         | Finding 1: reuse the existing application alias resolver and direct/canonical routing; no Interpretation-specific short-link subsystem.                                                                                                 |
| R3          | Administrators can constrain style colors/capabilities and free-form palette behavior across metahub/Application/delegated Workspace layers | Findings 5-6: extend typed widget policy and add target-aware delegated Workspace overrides; enforce touched style mutations server-side.                                                                                               |
| R4          | Save a whole Structure or only a selected branch as a template                                                                              | Finding 7: branch scope is server-computed from a selected root and is available only for hierarchicalCells; rebase the copied root before validation/remap.                                                                            |
| R5          | Attach multiple Materials and optionally choose one Primary Material that opens first                                                       | Finding 8: Material.CellId is 1:N attachment ownership; Matrix.MaterialRef is the optional Primary pointer; create, set/replace/clear, delete and template-copy lifecycle are separated.                                                |
| R6          | Personal Favorites for Matrix cells with add/remove and a Favorites tab                                                                     | Finding 9: personal entity-backed records with server-owned user/Workspace context; exact child-row reference representation remains a PLAN design choice because current generic REF semantics do not prove a safe TABLE-child target. |

Delivery constraints such as generator-first fixture regeneration, clean-break data shape and no schema/template version bump are acceptance constraints, not a replacement for R1-R6.

## Scope And Decision Inputs

-   Stakeholder input: original project brief, an external source not distributed with this repository.
-   QA-refined technical brief: reviewed product specification, an external source not distributed with this repository.
-   Current repository source, including public runtime, aliases, effective layout, Workspace settings, Interpretation Network runtime, template copy, Material and fixture pipelines.
-   Prior Interpretation Network research:
    -   memory-bank/research/interpretation-network-configuration-runtime-ux-research-2026-07-13.md;
    -   memory-bank/research/unified-settings-and-workspace-overrides-research-2026-07-16.md;
    -   memory-bank/research/interpretation-network-single-structure-and-templates-research-2026-07-19.md;
    -   memory-bank/research/interpretation-network-matrix-table-view-research-2026-07-07.md.
-   Public-runtime precedent: memory-bank/research/consortium-marketing-public-runtime-aliases-research-2026-09-15.md.
-   Current project Skills for architecture, runtime MUI UX, research discipline and OntoIndex-backed navigation.
-   Exact dependency baseline from pnpm-workspace.yaml.
-   Current MUI 9.2.0 documentation through Context7, WAI-ARIA Authoring Practices, OWASP authorization guidance and PostgreSQL row-security documentation.
-   Independent read-only subagent reviews covering public runtime/security, settings/data model and runtime UX.

The user explicitly permits substantial refactoring and a clean break because the test database will be recreated. The work must not retain compatibility code solely for the old disposable data shape and must not increment the database schema version or metahub-template version.

## Skills And Code Intelligence Used

-   research-before-plan for source quality, uncertainty tracking and PLAN handoff.
-   universo-platform-architecture for metahub -> Application -> Workspace ownership, entity-backed widgets and configuration placement.
-   mui-runtime-ux-patterns and runtime-ux-qa for public/read-only UI behavior, localization, accessible controls, primitive reuse and browser acceptance.
-   ontoindex-code-intelligence plus repository OntoIndex guidance for semantic exploration and impact awareness.
-   Context7 for MUI 9.2.0 Tabs/Select/FormControl accessibility contracts and React conditional rendering guidance.
-   Read-only subagents independently checked public runtime/RLS, Material/template/Favorites semantics, source-managed settings and runtime UX.

OntoIndex was indexed at the current commit but reported a dirty worktree, missing semantic embeddings and degraded coverage for two large files. It was used for navigation and relationship discovery only; all material claims were rechecked directly against the current working-tree source. Direct current source is authoritative for the findings below.

## Current Technology Baseline

The current workspace catalog is newer than some July research and is the implementation baseline:

-   React 18.3.1;
-   React DOM 18.3.1;
-   Material UI 9.2.0;
-   MUI X 9.8.0;
-   React Router 7.18.2;
-   Zod 3.25.76.

The MUI 9.2 Context7 guidance is therefore exact-version guidance for this checkout. No MUI upgrade is implied by this feature.

## Source Inventory

| Source                                                                                                                                                                                                               | Type                                            | Date / freshness                            | Current finding / relevance                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original stakeholder brief (external source; not distributed with this repository)                                                                                                                                   | Primary project input                           | 2026-10-22                                  | Defines R1-R6, three-layer configuration intent and clean-break constraints.                                                                                                                                      |
| QA-reviewed product specification (external source; not distributed with this repository)                                                                                                                            | Reviewed project requirements                   | 2026-10-22                                  | Defines public-read-only UX, server-side policy validation, branch UX, Primary Material, Favorites and generator-first acceptance.                                                                                |
| packages/universo-react-applications-backend/src/services/publicApplicationRuntime.ts                                                                                                                                | Local code                                      | Current working tree, 2026-10-22            | Generic public resolution already supports UUID v7 and application aliases, readiness and direct/canonical behavior.                                                                                              |
| packages/universo-react-applications-backend/src/controllers/publicApplicationRuntimeController.ts                                                                                                                   | Local code                                      | Current working tree, 2026-10-22            | Authoritative public path selects the public-entry Workspace and resolves effective layout in one server-owned transaction, but materializes marketing public runtime only.                                       |
| packages/universo-react-applications-backend/src/shared/publicRuntimeAccess.ts                                                                                                                                       | Local code                                      | Current working tree, 2026-10-22            | Older generic helper can accept a Workspace option; it must not become the authority for the new public Dashboard/Interpretation Network path.                                                                    |
| packages/universo-react-types/src/common/applicationAliases.ts                                                                                                                                                       | Local code                                      | Current working tree, 2026-10-22            | Strict public application DTO is still marketing-page-only.                                                                                                                                                       |
| packages/universo-react-types/src/common/marketingPagePublicRuntime.ts                                                                                                                                               | Local code                                      | Current working tree, 2026-10-22            | Generic runtime-schema factory is useful discriminated-union precedent, but the supplied Dashboard schema is caller-defined; it is not an existing strict public Dashboard contract.                              |
| packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx                                                                                                                                       | Local code                                      | Current working tree, 2026-10-22            | PublicApplicationRuntime always renders MarketingRuntimeContent; the authenticated/general runtime has a separate DashboardApplicationRuntime branch.                                                             |
| packages/universo-react-applications-frontend/src/pages/application-runtime/DashboardApplicationRuntime.tsx                                                                                                          | Local code                                      | Current working tree, 2026-10-22            | Current Dashboard host creates authenticated adapters/mutation hooks and is not itself a safe anonymous public host.                                                                                              |
| packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.template.ts                                                                                                               | Local code                                      | Current working tree, 2026-10-22            | Canonical dashboard has workspaceSwitcher, menuWidget, appNavbar, header, languageSwitcher, colorModeSwitcher and interpretationNetworkWorkspace; every public placement must be explicitly projected or omitted. |
| packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx                                                                                                          | Local code                                      | Current working tree, 2026-10-22            | Interpretation Network is specialized runtime behavior and currently consumes authenticated runtime data adapters.                                                                                                |
| packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/InterpretationNetworkCellStyleEditor.tsx                                                                                   | Local code                                      | Current working tree, 2026-10-22            | Presets, border options and free-form color controls are hard-coded; contrast below 4.5 is advisory and still saveable.                                                                                           |
| packages/universo-react-types/src/common/interpretationNetworkLayout.ts                                                                                                                                              | Local code                                      | Current working tree, 2026-10-22            | Strict widget config has no style-policy contract and supports hierarchicalCells plus independentRows; selected-branch semantics are only well-defined for hierarchicalCells.                                     |
| packages/universo-react-types/src/common/unifiedSettings.ts                                                                                                                                                          | Local code                                      | Current working tree, 2026-10-22            | Layer/target abstractions and allow/lock policy exist, but registered Workspace overrides are currently global-key settings and several keys are delegated by default when no explicit allowlist exists.          |
| packages/universo-react-applications-backend/src/ddl/applicationWorkspacesSchema.ts; packages/universo-react-applications-backend/src/services/workspaceSettingsService.ts                                           | Local code                                      | Current working tree, 2026-10-22            | \_app_workspace_settings persists workspace_id + key + value; target-aware widget-instance persistence/API does not yet exist.                                                                                    |
| packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkService.ts                                                                                               | Local code                                      | Current working tree, 2026-10-22            | Save-as-template currently loads the complete Matrix and template deletion assumes Matrix MaterialRef enumerates all template Materials.                                                                          |
| packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkMatrixCopy.ts                                                                                            | Local code                                      | Current working tree, 2026-10-22            | Hierarchy validation/remapping is the right base for subtree copy, but the selected root must be rebased and MaterialRef remapping must stop falling back through CellId.                                         |
| packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkMaterials.ts; runtimeInterpretationNetworkMaterialCommands.ts; runtimeInterpretationNetworkValidation.ts | Local code                                      | Current working tree, 2026-10-22            | Backend enforces one Material in create/validation paths; cloneMaterials also overloads one map with both material-id and cell-id keys, which is unsafe for 1:N Materials.                                        |
| packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/InterpretationNetworkDetailsPane.tsx                                                                                       | Local code                                      | Current working tree, 2026-10-22            | Frontend already supports a Material list, selected Material detail and Back-to-materials navigation.                                                                                                             |
| packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/StructurePane.tsx                                                                                                | Local code                                      | Current working tree, 2026-10-22            | Detail tabs are matrix/templates and already use linked tab/panel semantics; Favorites belongs in this detail-tab set. The file also contains raw MUI Dialog usage that should not be copied into new flows.      |
| packages/universo-react-apps-template-mui/src/components/dialogs/{StandardDialog,ConfirmDeleteDialog}.tsx                                                                                                            | Local UI primitives                             | Current working tree, 2026-10-22            | Canonical dialog primitives for new/touched Interpretation Network CRUD and confirmation flows; avoid duplicating raw MUI dialog composition.                                                                     |
| packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/interpretationNetwork.json                                                                                                                        | Local i18n                                      | Current working tree, 2026-10-22            | Existing EN/RU namespace to extend for Primary Material, Favorites, branch-save and policy validation UX.                                                                                                         |
| packages/universo-react-metahubs-backend/src/domains/templates/data/lms.seed-entities.operations.ts                                                                                                                  | Local precedent                                 | Current working tree, 2026-10-22            | KnowledgeBookmarks supports entity-backed bookmark direction, but does not itself prove server-owned authenticated identity, TABLE-child references or race-safe uniqueness.                                      |
| tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts; tools/testing/e2e/support/interpretationNetworkFixtureContract.ts; fixture drift scripts                                      | Test infrastructure                             | Current working tree, 2026-10-22            | Canonical product proof is generator-first and should remain so.                                                                                                                                                  |
| pnpm-workspace.yaml                                                                                                                                                                                                  | Dependency authority                            | Current working tree, 2026-10-22            | Pins React 18.3.1, MUI 9.2.0, MUI X 9.8.0, React Router 7.18.2 and Zod 3.25.76.                                                                                                                                   |
| Context7 /mui/material-ui/v9.2.0                                                                                                                                                                                     | Current official library docs                   | Retrieved 2026-10-22                        | Confirms accessible Select and Tabs labeling/linkage and deliberate keyboard activation behavior.                                                                                                                 |
| Context7 /react/react/v18.3.1                                                                                                                                                                                        | Current library/source docs                     | Retrieved 2026-10-22                        | Confirms conditional omission of component subtrees, matching the requirement to remove unauthorized mutation controls from rendered output.                                                                      |
| WAI-ARIA Tabs Pattern                                                                                                                                                                                                | Primary accessibility guidance                  | Retrieved 2026-10-22                        | Confirms tab roles, relationships and arrow-key behavior.                                                                                                                                                         |
| OWASP Authorization Cheat Sheet                                                                                                                                                                                      | Primary security guidance                       | Retrieved 2026-10-22                        | Supports deny-by-default and server-side authorization on every request.                                                                                                                                          |
| PostgreSQL row security docs                                                                                                                                                                                         | Primary database guidance                       | Retrieved 2026-10-22                        | Confirms default-deny behavior under RLS without a permitting policy.                                                                                                                                             |
| https://github.com/movefasta/elm-suz-dal                                                                                                                                                                             | Historical/product context                      | Current web fetch unavailable on 2026-10-22 | Domain/navigation reference only; no implementation decision depends on it.                                                                                                                                       |
| https://lmn.rs/                                                                                                                                                                                                      | Historical concept reference                    | Current web fetch unavailable on 2026-10-22 | Non-authoritative for storage/API decisions.                                                                                                                                                                      |
| https://universo.pro/a/suzdal                                                                                                                                                                                        | Live-route example from stakeholder requirement | Current web fetch unavailable on 2026-10-22 | Production behavior was not independently verified by web fetch; repository/runtime architecture is the evidence basis for this research.                                                                         |

## Key Findings

### 1. Application aliases and anonymous public-entry infrastructure already exist

**Fact.** The /a/:applicationRef problem is not a missing Interpretation Network alias system.

Current source already resolves a public application by UUID v7 or configured alias, applies alias/canonical behavior, checks publication/readiness, selects the server-owned public entry Workspace and resolves effective layout without accepting a client-selected Workspace as authority. The anonymous frontend request uses credential-free transport.

The authoritative current path is resolvePublicApplication -> server-owned resolvePublicEntryWorkspace -> effective-layout resolution inside the public transaction. The older generic publicRuntimeAccess helper can accept a Workspace option and therefore must not be reused as the authority for new public Dashboard/Interpretation Network endpoints.

**Inference.** /a/suzdal is blocked by the missing public Dashboard runtime path rather than by alias resolution.

**Recommended decision.** Preserve the existing generic alias resolver and authoritative public-entry transaction. Every new public Interpretation Network read endpoint must enter through the same server-selected public Workspace/RLS boundary. A client must never select the anonymous Workspace. A separate Interpretation-specific alias table, route, short-link system or public Workspace selector would duplicate platform behavior.

### 2. The real public-runtime gap is a marketing-only DTO/renderer boundary

**Fact.** The anonymous controller currently returns a marketing-specific public application DTO, and PublicApplicationRuntime always renders MarketingRuntimeContent. The authenticated/general runtime has a separate DashboardApplicationRuntime branch.

marketingPagePublicRuntime.ts contains a generic runtime-schema factory that can discriminate a caller-supplied Dashboard payload from marketing-page. That factory is type-composition precedent only: the strict public DTO currently exists for marketing-page, while the Dashboard payload schema remains caller-defined.

Current DashboardApplicationRuntime is also coupled to authenticated runtime adapters, current application/Workspace identity and mutation hooks. Current placement/rendering paths carry persistence widget/layout UUIDs. Reusing that host with a permissions flag would therefore retain authenticated transport and internal identity assumptions.

The canonical Interpretation Network dashboard contains workspaceSwitcher, menuWidget, appNavbar, header, languageSwitcher, colorModeSwitcher and interpretationNetworkWorkspace. Public rendering cannot silently serialize all of them.

**Recommended decision.** Add a template-aware public application union:

-   templateKey marketing-page keeps the existing bounded marketing projection;
-   templateKey dashboard carries a dedicated PublicDashboardRuntime projection.

PublicDashboardRuntime must use its own PublicDashboardPlacement/public adapter/read-only host contract rather than expose raw authenticated EffectiveLayoutSuccess or reuse DashboardApplicationRuntime unchanged. Public placement identity should be semantic/renderer-safe, such as bounded instanceKey or another public-local identity, instead of persistence widget/layout UUIDs.

The public Dashboard serializer should:

1. reuse existing public application/readiness/public-entry/effective-layout transaction logic;
2. pass each dashboard placement through a strict public widget allowlist;
3. expose only renderer semantics and explicitly public configuration/data;
4. redact internal application/Workspace/layout/widget IDs, source/binding lineage, versions, record handles, action targets and mutation metadata.

For the canonical Interpretation Network layout, every placement must have an explicit decision:

-   interpretationNetworkWorkspace requires a specialized public data projector;
-   languageSwitcher and colorModeSwitcher can be admitted only through bounded renderer-only public config;
-   menuWidget, appNavbar and header may render only through explicit public projections that cannot expose management/internal navigation;
-   workspaceSwitcher is omitted in this slice because the server selects one public-entry Workspace and anonymous users must not browse arbitrary Workspaces;
-   any unsupported widget is omitted or causes a fail-closed public-readiness outcome according to the final projector contract; it is never serialized generically.

The envelope can be reusable for later public Dashboard widgets, but support remains projector-by-projector.

### 3. Interpretation Network cannot use its current authenticated data transport for anonymous runtime

**Fact.** interpretationNetworkWorkspace is specialized runtime behavior. The current widget can fetch Concepts, Interpretations, Structures, Matrix rows, Materials and templates from authenticated application/runtime endpoints. Generic effective widget runtime-data resolution deliberately does not make this specialized data public automatically.

Passing permissions=false is insufficient for anonymous publication. It can hide or disable UI, but it does not create a safe transport boundary.

**Recommended decision.** The public Interpretation Network gets a dedicated server-side read projector executed inside the existing authoritative public transaction after the public-entry Workspace/RLS context is selected. It returns only what is needed to browse the published network:

-   human-readable Structure/Interpretation/Matrix labels and hierarchy;
-   Matrix cells and allowed presentation values;
-   public attached Materials;
-   Primary Material selection needed for direct-open read behavior;
-   safe navigation/presentation state.

Hierarchy/navigation may require stable client-side identity. If so, the public DTO may use opaque public-local keys that are never displayed and cannot be used as authenticated mutation handles. It must not expose internal application/Workspace/layout/widget persistence identities or raw writable row IDs merely to satisfy client rendering.

It should not return authenticated management endpoints, mutation targets, row actions, template-management commands, Favorites mutation state, Access or Settings surfaces.

The frontend uses a dedicated public Dashboard host/public adapter. A runtimeAccessMode=public discriminator may still be useful inside shared pure renderers, but it is not a substitute for the separate public transport/placement boundary.

### 4. Public read-only UX requires physical omission of mutation surfaces

**Fact.** The stakeholder requirement is stronger than disabled controls. Current React/MUI composition can conditionally omit complete subtrees.

**Recommended decision.** Anonymous public runtime renders only read/navigation interactions and omits:

-   Structure create/edit/delete;
-   save-as-template, template-management actions and the authoring-oriented Templates tab in this slice;
-   cell create/edit/delete/style actions and mutation menus;
-   Material create/edit/delete/set-primary actions and editable Material body controls;
-   Favorites tab and add/remove actions;
-   Access and Settings entry points;
-   mutation columns/action menus whose only purpose is editing.

Server-side authorization remains authoritative even though the UI omits those controls.

StructurePane already has accessible tab linkage. For authenticated runtime, Favorites should extend StructureDetailTab alongside Matrix and Templates rather than create a parallel top-level tab system. Context7 and WAI-ARIA support the existing id + aria-controls + aria-labelledby pattern and arrow-key tab navigation.

The runtime UI quality gate also applies to new or touched flows: use existing StandardDialog/ConfirmDeleteDialog and canonical list/table primitives rather than duplicating raw MUI CRUD dialog patterns. StructurePane currently contains raw Dialog composition; it is existing tech debt and should not become the model for new Favorites/branch/Primary Material flows.

### 5. Generic Workspace settings exist, but source-managed widget policy still needs widget-scoped delegation

**Fact.** An important correction to older research is that a generic global-key Workspace override engine and Application delegation policy are now implemented. unifiedSettings.ts defines metahub/application/workspace layers and global/layout/widget/entity target concepts, but current registered Workspace-overridable definitions are global-key settings. \_app_workspace_settings physically stores workspace_id + key + value with uniqueness by active (workspace_id, key).

Application-level source-linked widget presentation overrides already exist elsewhere in the layout pipeline, but target-aware Workspace layout/widget/entity persistence and APIs do not.

**Inference.** Interpretation Network widget policy needs a target-aware extension rather than another unrelated settings subsystem.

**Recommended decision.** Preserve this ownership chain:

metahub source widget config -> Application materialized presentation override -> explicitly delegated Workspace widget override

The Workspace layer is default-locked for new Interpretation Network keys. Existing unified-settings behavior automatically allows several default global addresses when an Application has no explicit policy; new interpretationNetwork.\* addresses must not be added to that default list. Application Settings must explicitly add each safe semantic address to workspaceOverrides.allowedAddresses before a Workspace can override it.

Security/routing concerns remain Application-owned and must not become Workspace-overridable:

-   public/private publication;
-   aliases/canonical routing;
-   public-entry Workspace selection;
-   authorization/RBAC/RLS rules.

Actual cell styles, Primary Material relations, templates and Favorites are runtime entity data, not settings overrides.

PLAN must choose the physical representation of target-aware widget-scoped Workspace overrides. It should reuse existing allowed/locked/effective-value concepts while preserving widget target identity, inheritance, reset behavior and source-managed synchronization.

### 6. Cell-style policy should be typed widget policy enforced by UI and backend

**Fact.** The current editor hardcodes ten preset colors, border widths and border styles and always exposes native color picker plus HEX input. Shared Interpretation Network widget config has no policy controlling these capabilities. Current contrast handling warns when authored text/fill contrast is below 4.5 but still allows save.

**Recommended decision.** Canonical widget config gains a strict cell-style policy with at least:

-   ordered allowed preset colors;
-   whether arbitrary/free-form color selection is allowed;
-   independently editable capabilities for fill color, text color, border color, border width and border style.

The exact schema is a PLAN detail, but it should remain one coherent validated widget configuration object. If Workspace delegation requires granular locking, the settings registry can expose typed subkeys while the effective resolver reconstructs one validated policy.

Effective UI behavior:

-   arbitrary colors disabled -> omit native picker/HEX input, keep configured presets;
-   capability disabled -> omit its editing controls;
-   configured preset order is preserved.

Backend validation is mandatory. Current generic HEX validation proves syntax only; it does not prove that a capability or specific color is allowed.

Both cell-create and cell-edit paths must validate style fields touched by the mutation against the same effective style policy so direct API calls cannot bypass UI restrictions. Existing persisted style values remain renderer data when policy later becomes stricter; an unrelated text/content edit must not fail merely because an old style value is no longer authorable.

Keep the current contrast rule advisory for this slice unless PLAN explicitly introduces a new style-policy field for enforced minimum contrast. Do not silently turn the existing warning into a new validation blocker. The warning, control labels and errors remain localized and keyboard/focus accessible.

README drift is confirmed: documentation describes twelve color chips while current source defines ten presets. Delivery should replace fixed-count wording with policy-driven behavior.

### 7. Selected-branch template saving requires root rebase before validation/remap

**Fact.** Current save-as-template selects a source Structure and includeMaterials, then copies the complete Matrix. The widget can operate in hierarchicalCells or independentRows; only hierarchicalCells has a parent/descendant branch with unambiguous subtree semantics.

**Recommended decision.** Add explicit whole-Structure versus selected-branch scope. selectedBranch is accepted only when the effective matrixMode is hierarchicalCells; independentRows keeps whole-Structure save in this slice. The client submits scope plus one rootCellId, never a precomputed list of descendants. The server computes the subtree from a locked source Matrix snapshot inside the aggregate transaction.

Semantically the operation is:

1. resolve selected source Matrix cell;
2. compute that cell plus all descendants;
3. exclude ancestors, siblings and unrelated branches;
4. clone the selected rows into an in-memory subtree;
5. set the selected copied root ParentCellId to null;
6. validate the rebased subtree hierarchy;
7. generate fresh UUID v7 cell identities and remap parent references;
8. preserve semantic axis/label/style/order values;
9. if Materials are included, copy only Materials attached to copied cells;
10. remap the copied Primary Material reference only when that Material was copied.

Step 5 is mandatory. Current hierarchy validation requires exactly one root and rejects a ParentCellId pointing outside the copied row set. Filtering descendants without rebasing the selected root creates an invalid template.

The save dialog must show the selected branch as a human-readable cell label/path and disable selected-branch scope when no valid root is selected. The backend independently verifies the selected root belongs to the source Structure/Interpretation and rejects branch scope in independentRows.

The prior two-copy-boundary rule remains:

-   Structure -> TableTemplate;
-   TableTemplate -> new Structure.

Both boundaries require fresh identities and must not leak source CellId, parent or Material-row identity.

### 8. Multiple Materials should use Material.CellId for ownership and Matrix.MaterialRef for Primary Material

**Fact.** Backend currently enforces effectively one Material per cell. createMaterialForCell rejects creation when Matrix.MaterialRef is populated and then always writes the newly created Material into MaterialRef. The frontend is already closer to the desired product model: it can list multiple Materials, show one Material detail and navigate Back.

Current copy code also assumes one Material per cell in two ways: cloneMaterials uses one map for both source material IDs and source CellId keys, and planMatrixRowsCopy may infer MaterialRef through a CellId fallback. Template deletion discovers Materials from TemplateMatrix.MaterialRef but deletes by TemplateOwnerId, which becomes inconsistent as soon as secondary Materials exist.

**Recommended decision.** For a fresh database, the canonical model is:

-   Material.CellId is the attachment/ownership relation; multiple Material rows may share one cell.
-   Matrix.MaterialRef is the optional Primary Material pointer for that cell.
-   Matrix.MaterialRef=null means no Primary Material; selecting the cell opens the Material list.
-   A non-null MaterialRef must reference a Material whose CellId matches the Matrix cell's CellId.

This reuses an existing field whose current behavior already approximates the active material and avoids introducing a second competing PrimaryMaterialRef without evidence that it is needed.

The invariant is zero or one Primary Material per cell. Ordinary Material creation attaches a Material and does not implicitly set or replace the Primary Material. Set/replace/clear Primary is an explicit trusted aggregate mutation. If product UX later wants "create and make Primary", it should be one explicit aggregate option, not an implicit side effect of every create.

Deleting a Material attached to an Interpretation Network cell must participate in the same aggregate lifecycle. Deleting the current Primary atomically clears Matrix.MaterialRef; deleting a secondary Material leaves the pointer unchanged. Generic deletion must not leave a dangling Primary reference. The server does not silently choose an arbitrary replacement.

Template behavior is then deterministic:

-   includeMaterials=true queries and copies all attached Materials by copied CellId scope, rather than discovering only Matrix.MaterialRef rows;
-   includeMaterials=false copies no Materials;
-   cloning maintains a pure sourceMaterialId -> clonedMaterialId map; CellId ownership is remapped independently through cellIdMap;
-   copied source Primary remaps only from the source Matrix.MaterialRef through sourceMaterialId -> clonedMaterialId, with no fallback from CellId;
-   otherwise destination MaterialRef is null.

Template deletion/instantiation must load the complete template-owned Material set through TemplateOwnerId plus the copied cell scope and use MaterialRef only to validate/remap the optional Primary. This avoids the current count mismatch when secondary Materials exist.

The old one-Material uniqueness rule and CellId->single-material copy fallback should be removed rather than wrapped in compatibility behavior.

### 9. Favorites should be personal entity-backed references

**Fact.** No Interpretation Network Favorites contract/API exists today. The behavior is personal: one authenticated user can favorite a Matrix cell without mutating the shared Matrix row for everybody.

The LMS KnowledgeBookmarks precedent supports entity-backed bookmark direction rather than localStorage or a shared Favorite flag, but it does not prove that the current generic REF model safely targets a TABLE child Matrix row or that bookmark ownership is server-derived/race-safe.

**Recommended decision.** Use an Interpretation Network Favorite Object/entity with:

-   Workspace-scoped;
-   authenticated-user identity derived from runtime auth context and stored server-owned;
-   Workspace identity derived from runtime context rather than accepted as an arbitrary client owner;
-   a server-resolved target that proves the Matrix cell belongs to the current Workspace and resolves its containing Structure/Interpretation.

Service invariant prevents duplicate favorites for the same logical (Workspace, user, cell) target even under concurrent requests. The physical target-reference representation remains a PLAN decision because current evidence does not prove that a generic Object REF can directly and safely reference a TABLE child row. A dedicated stable target key/compound identity or another existing relation primitive may be appropriate after source-level validation.

Favorites belongs in the authenticated Structure detail tabs beside Matrix and Templates. Cell mini-menu exposes Add to favorites / Remove from favorites when authorized. The Favorites list uses canonical shared list/table/card primitives and shows human-readable Structure/cell labels or paths. Deleted/inaccessible targets must not expose raw IDs; the service/UI can filter them or show a localized unavailable state according to the chosen lifecycle policy.

Anonymous public runtime has no Favorites tab or add/remove controls in this slice. Shared/team Favorites remain out of scope.

### 10. Fixture changes must remain generator-first

**Fact.** The existing canonical delivery chain is already correct:

template/source metadata -> product generator -> exported snapshot -> fixture contract -> drift check -> imported snapshot/runtime E2E

Canonical changes for cell-style policy, widget-scoped Workspace delegation metadata, Favorites entity metadata and revised Material/Primary semantics must begin in template/entity/widget source and the generator.

tools/fixtures/metahubs-interpretation-network-app-snapshot.json is a derived artifact and must be regenerated. No schema-version or metahub-template-version bump is required solely because the clean database uses the new canonical shape. No compatibility reader is needed for the disposable old test data.

## Reconciliation With Earlier Research

### Public runtime and aliases

September public-runtime research remains valid: anonymous publication is a distinct authorization path; server chooses public entry Workspace; unavailable public content fails closed; public DTO is allowlisted; aliases are platform-owned and generic.

New refinement: public application/readiness/RLS substrate is already sufficient for Dashboard, but the current authenticated Dashboard host and placement graph are not a safe anonymous renderer boundary. Missing work is template-aware DTO dispatch plus a dedicated read-only public Dashboard host/placement contract and public-safe specialized-widget projectors.

### Interpretation Network configuration

July configuration research correctly placed canonical defaults in metahub widget config and Application tuning in materialized application widget config. It predates the now-implemented generic Workspace settings service.

Current model:

-   generic global-key Workspace override/delegation infrastructure exists;
-   Interpretation Network source-managed widget policy still needs target-aware Workspace override/delegation;
-   that delegation should reuse existing allowed/locked semantics rather than create a parallel policy system;
-   new Interpretation Network keys must require explicit Application delegation and must not join the default Workspace-allowed key list.

### Structure templates

July template research remains valid about independent identity remapping at Structure->Template and Template->Structure boundaries. This research adds selected-subtree scope, limits it to hierarchicalCells, makes root rebase-before-validation explicit and moves descendant computation to the trusted server transaction.

### Runtime UX

Prior UX research remains valid about no raw IDs/JSON/internal validation, real EN/RU resources, semantic multiline fields, responsive no-page-overflow behavior and shared MUI primitive reuse.

The new public requirement strengthens this: anonymous users should not see disabled mutation/admin controls with no read-only purpose. New/touched CRUD dialogs should use StandardDialog/ConfirmDeleteDialog and new Favorites/resource lists should reuse canonical list/table/card primitives.

## External Evidence

### MUI 9.2.0 via Context7

Current MUI documentation confirms:

-   Select must be properly associated with an accessible label;
-   Tabs need an accessible label;
-   each Tab should link to its tabpanel using id, aria-controls and aria-labelledby;
-   automatic versus manual tab activation is a deliberate keyboard behavior choice.

StructurePane already follows the tab/panel linkage pattern, so Favorites should extend it.

React 18.3.1 documentation/source also confirms ordinary conditional rendering can omit complete subtrees, which is the intended public-mode behavior for mutation/admin affordances.

### WAI-ARIA Authoring Practices

The W3C Tabs Pattern confirms tablist/tab/tabpanel roles, aria-selected, tab-to-panel relationships and arrow-key navigation.

### OWASP authorization guidance

OWASP recommends deny-by-default and authorization checks on every request. UI visibility is presentation only; public/read-only authorization must be enforced server-side.

This supports a dedicated public DTO, server-side style-policy validation and server-side Favorites ownership checks.

### PostgreSQL row security

PostgreSQL documentation confirms default-deny behavior when RLS is enabled without a permitting policy. This matches the existing fail-closed runtime architecture and supports continuing public Entity reads inside the current server-selected public/RLS transaction.

## Conflicts, Corrections And Uncertainty

### Generic Workspace settings are implemented

Older research described Workspace override infrastructure as future work. That is no longer current for global-key settings: the generic service and Application allow/lock policy exist.

Remaining gap is target-aware Workspace persistence/API/resolution for source-managed Interpretation Network widget policy. The current \_app_workspace_settings shape is key-only and cannot distinguish two widget instances by target identity.

### MUI version is 9.2.0

Context7 v9.2 guidance is exact-version guidance for this checkout.

### Public Dashboard DTO shape remains a PLAN decision

Research recommends a generic discriminated Dashboard envelope with strict widget-specific public projectors plus a separate read-only public Dashboard host/placement contract. PLAN still needs exact DTO field names and to decide bootstrap-only versus bounded secondary public read endpoints for large/secondary Interpretation Network data.

The current authenticated DashboardApplicationRuntime, authenticated runtime adapter, mutation hooks and persistence widget/layout IDs are not reusable as the anonymous boundary merely by setting permissions=false.

### Workspace-delegable Interpretation Network settings must be explicit in this slice

The stakeholder request explicitly asks for allowed Workspace overrides. PLAN must define the exact safe allowlist and target identity. Style-policy presentation controls are the strongest initial candidates. Security/routing/publication remains Application-only.

### Multiple-Material copy/delete assumptions are legacy shape, not reusable invariants

Current clone/copy/delete code assumes one Material per cell: one map is keyed by both Material id and CellId, Matrix copy can fall back from MaterialRef to CellId, and template deletion discovers Materials from MaterialRef before deleting by TemplateOwnerId. These assumptions must be removed in the clean model. MaterialRef becomes only the optional Primary pointer; complete Material ownership is discovered through CellId/TemplateOwnerId.

### Selected branch has meaning only in hierarchicalCells

The canonical Interpretation Network template currently uses hierarchicalCells, so the requested branch workflow is supported there. independentRows has no parent/descendant subtree; selectedBranch must fail closed in that mode until a separately specified row/selection-set template workflow exists.

### Favorites target identity remains a bounded PLAN design question

Entity-backed personal Favorites are the selected direction, but current evidence does not prove a generic REF from an Object row to a TABLE child Matrix row. PLAN must choose a stable target representation and prove server-owned user/Workspace scope, same-Workspace cell resolution, concurrency-safe uniqueness and deleted/inaccessible target handling.

### Product reference limitations

movefasta/elm-suz-dal is historical/product context only. lmn.rs was not usable as current implementation evidence and should not drive storage/API decisions.

The live example https://universo.pro/a/suzdal also could not be independently fetched by the web tool during this QA pass. The research therefore verifies the repository/runtime architecture and acceptance contract, not current production deployment behavior.

## Recommended Decisions For PLAN

1. Public runtime: keep the existing public resolver, aliases, server-selected public-entry Workspace, effective-layout/RLS transaction and unavailable contract. New public endpoints must not accept a client-selected Workspace.
2. Public Dashboard host: add a strict PublicDashboardRuntime DTO, PublicDashboardPlacement/public adapter and read-only public Dashboard host. Do not reuse authenticated DashboardApplicationRuntime or raw EffectiveLayoutSuccess as the anonymous boundary.
3. Public Dashboard widgets: classify every canonical Interpretation Network placement explicitly. Omit workspaceSwitcher; admit shell widgets only through bounded public projectors; use a specialized public projector for interpretationNetworkWorkspace; never serialize arbitrary Dashboard widgets automatically.
4. Anonymous Interpretation Network data: build dedicated server-side read projection inside the authoritative public transaction. Do not call authenticated Interpretation Network APIs or instantiate mutation hooks from anonymous UI.
5. Anonymous UI: omit mutation/admin/template-management/Favorites affordances entirely from rendered output. Use public-local opaque identity only where read navigation requires it.
6. Style policy: strict typed policy with ordered presets, arbitrary-color toggle and per-capability edit flags. Validate touched style fields on create/edit; keep existing persisted values renderable. Preserve contrast as an advisory warning unless an explicit future policy makes it enforceable.
7. Settings inheritance: metahub source widget config -> Application materialized presentation override -> explicitly delegated target-aware Workspace widget override. New Interpretation Network keys are default-locked and require explicit Application allowedAddresses delegation.
8. Subtree templates: whole versus selected branch scope in hierarchicalCells only. Client sends rootCellId; server computes descendants from a locked snapshot, rebases the copied root to ParentCellId=null and then validates/remaps. UI shows a human-readable selected path.
9. Materials: many Materials per Material.CellId; Matrix.MaterialRef is only the optional Primary reference constrained to the same cell. Ordinary create does not auto-primary. Set/replace/clear/delete are aggregate-safe; clone maps Material id only; all secondary Materials participate in template copy/delete.
10. Favorites: personal Workspace/user-scoped entity-backed records with server-owned auth/Workspace context and concurrency-safe uniqueness. PLAN must choose and prove the physical Matrix child target identity; no localStorage/shared Matrix flag and no anonymous Favorites in this slice.
11. Runtime UX: extend StructureDetailTab with Favorites in authenticated mode; use canonical list/table/card and StandardDialog/ConfirmDeleteDialog primitives; preserve EN/RU, keyboard/focus and no-page-overflow guarantees.
12. Fixture: update canonical source/generator first, regenerate snapshot and update contract/drift/imported/public E2E. No legacy compatibility code and no schema/template version bump.

## Open Questions Before PLAN

### Q1. Exact public Dashboard DTO and endpoint shape

Recommended direction: one generic PublicApplicationRuntime discriminated union with PublicDashboardRuntime, PublicDashboardPlacement and explicit public-safe widget projectors. interpretationNetworkWorkspace is the required specialized data projector; canonical shell placements are individually projected or omitted.

PLAN must decide whether all public Interpretation Network read data is included in bootstrap DTO or large/secondary data uses additional bounded public read endpoints that reuse the same resolver/public-entry/RLS contract.

### Q2. Physical model for widget-scoped Workspace overrides

Recommended direction: reuse existing unified-settings allowed/locked/effective-value concepts, but add target-aware widget-instance/semantic-target storage and resolution for materialized source-managed interpretationNetworkWorkspace.

PLAN must define stable target identity, storage, merge order, reset behavior, source-sync/conflict behavior and Application delegation of individual keys.

### Q3. Workspace delegation granularity for cell-style policy

Recommended direction: keep cell-style policy as one coherent typed widget config object while exposing typed subkeys to Workspace delegation registry when granular allow/lock behavior is required.

PLAN should select the initial safe Workspace-overridable subset, likely presentation-only color/style policy.

### Q4. Physical target identity for Favorites

Recommended direction: keep Favorites as an Object-backed personal resource, but derive user and Workspace from trusted runtime context. The unresolved part is how one Favorite stably references a Matrix TABLE child without exposing or trusting a raw writable row identifier.

PLAN must choose the target representation and prove same-Workspace resolution, concurrency-safe uniqueness and navigation back to Structure/Interpretation/cell.

### Q5. Favorite target lifecycle

Recommended baseline: personal authenticated Favorites only. Deleted/inaccessible targets resolve server-side and are filtered or represented by a localized unavailable item without raw IDs. Shared/team Favorites remain out of scope.

Primary Material semantics, hierarchical subtree-rebase algorithm and public widget allowlist strategy are sufficiently resolved by this research to be planning inputs rather than open product alternatives.

## Acceptance Implications For PLAN

PLAN should convert these decisions into executable evidence covering:

-   R1/R2: anonymous UUID and alias entry, non-enumerating unavailable outcomes, UUID remaining on the UUID route, direct alias preserving the requested alias, and canonical secondary alias resolving to the primary alias;
-   R1: anonymous clients cannot select a Workspace; every public Interpretation Network read runs inside the server-selected public-entry/RLS transaction;
-   no credentialed/authenticated Interpretation Network read dependency in public mode;
-   no authenticated Dashboard adapter/mutation hooks in the public host and no internal persistence IDs/handles/mutation metadata in the public DTO;
-   explicit projector/omit behavior for every canonical Interpretation Network dashboard placement, including omission of workspaceSwitcher;
-   no public mutation/admin controls in DOM;
-   public-entry Workspace isolation;
-   R3: metahub -> Application -> explicitly delegated target-aware Workspace style-policy precedence, reset/inheritance and target isolation;
-   R3: direct API rejection for disallowed touched style values/capabilities while older persisted out-of-policy style remains renderable; localized advisory contrast warning remains saveable under the current contract;
-   R4: whole-Structure and selected-subtree save with server-computed descendants, human-readable selected path, root rebase and no ancestor/sibling leakage; selectedBranch is rejected in independentRows;
-   R5: multiple Materials, zero-or-one Primary, ordinary create without implicit Primary replacement, explicit set/replace/clear, aggregate-safe delete, full secondary-Material template copy/delete and Primary-only MaterialRef remap;
-   R6: Favorites add/remove/list/navigation, server-owned user/Workspace scope, concurrency-safe uniqueness and safe handling of deleted/inaccessible targets;
-   real EN/RU strings, Tabs arrow-key behavior, focus-visible/focus-return flows and localized empty/loading/error states;
-   new/touched dialogs and lists use project canonical MUI primitives;
-   desktop/tablet/mobile proof with no page-level horizontal overflow;
-   generator -> fixture contract -> drift -> imported snapshot -> public runtime acceptance.

Runtime UI UX quality gate remains mandatory: no raw IDs, raw JSON/object cells, internal field names, raw validation/server errors or hidden-knowledge workflows on normal user surfaces.

## Sources

### Local

-   Original stakeholder brief (external source; not distributed with this repository).
-   QA-reviewed product specification (external source; not distributed with this repository).
-   memory-bank/research/consortium-marketing-public-runtime-aliases-research-2026-09-15.md
-   memory-bank/research/interpretation-network-matrix-table-view-research-2026-07-07.md
-   memory-bank/research/interpretation-network-configuration-runtime-ux-research-2026-07-13.md
-   memory-bank/research/unified-settings-and-workspace-overrides-research-2026-07-16.md
-   memory-bank/research/interpretation-network-single-structure-and-templates-research-2026-07-19.md
-   packages/universo-react-types/src/common/applicationAliases.ts
-   packages/universo-react-types/src/common/marketingPagePublicRuntime.ts
-   packages/universo-react-types/src/common/interpretationNetworkLayout.ts
-   packages/universo-react-types/src/common/unifiedSettings.ts
-   packages/universo-react-applications-backend/src/controllers/publicApplicationRuntimeController.ts
-   packages/universo-react-applications-backend/src/services/publicApplicationRuntime.ts
-   packages/universo-react-applications-backend/src/shared/publicRuntimeAccess.ts
-   packages/universo-react-applications-backend/src/ddl/applicationWorkspacesSchema.ts
-   packages/universo-react-applications-backend/src/services/workspaceSettingsService.ts
-   packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkService.ts
-   packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkMatrixCopy.ts
-   packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkMaterials.ts
-   packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkMaterialCommands.ts
-   packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkValidation.ts
-   packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx
-   packages/universo-react-applications-frontend/src/pages/application-runtime/DashboardApplicationRuntime.tsx
-   packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.template.ts
-   packages/universo-react-metahubs-backend/src/domains/templates/data/lms.seed-entities.operations.ts
-   packages/universo-react-apps-template-mui/src/components/dialogs/StandardDialog.tsx
-   packages/universo-react-apps-template-mui/src/components/dialogs/ConfirmDeleteDialog.tsx
-   packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx
-   packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/InterpretationNetworkCellStyleEditor.tsx
-   packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/InterpretationNetworkDetailsPane.tsx
-   packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/StructurePane.tsx
-   packages/universo-react-apps-template-mui/src/i18n/locales/en/interpretationNetwork.json
-   packages/universo-react-apps-template-mui/src/i18n/locales/ru/interpretationNetwork.json
-   tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts
-   tools/testing/e2e/support/interpretationNetworkFixtureContract.ts
-   tools/fixtures/metahubs-interpretation-network-app-snapshot.json
-   pnpm-workspace.yaml

### External / Current Documentation

-   Material UI 9.2.0 Tabs/Select/FormControl documentation via Context7 /mui/material-ui/v9.2.0.
-   React 18.3.1 source/docs via Context7 /react/react/v18.3.1.
-   WAI-ARIA Authoring Practices, Tabs Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/.
-   OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html.
-   PostgreSQL Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html.
-   Historical product context: https://github.com/movefasta/elm-suz-dal.
-   Historical concept reference: https://lmn.rs/ (not treated as current implementation authority).

## Research Closeout

The brief is directionally sound and all six stakeholder capabilities are represented. Current source confirms that platform foundations have improved since the first Interpretation Network slice: aliases, public-entry Workspace/RLS, effective layout and the generic global-key Workspace settings engine already exist. Target-aware widget-scoped Workspace overrides remain new work for this slice.

The remaining work is concentrated at the correct boundaries:

-   public-safe Dashboard/specialized-widget projection;
-   widget-scoped Workspace delegation for source-managed presentation policy;
-   server-enforced cell-style policy;
-   subtree copy with root rebase;
-   many Materials plus optional Primary Material;
-   personal entity-backed Favorites;
-   generator-first canonical fixture regeneration.

No product code, schema/template version, generated fixture or implementation plan was changed in RESEARCH mode.
