# Interpretation Network Public Runtime And Advanced Workspace — Implementation Plan

-   **Date:** 2026-10-22
-   **Mode:** PLAN
-   **Status:** Approved for implementation by the user's `IMPLEMENT` instruction
-   **Research:** [interpretation-network-public-runtime-advanced-workspace-research-2026-10-22.md](../research/interpretation-network-public-runtime-advanced-workspace-research-2026-10-22.md)
-   **Stakeholder input:** Original project brief, an external source not distributed with this repository.
-   **QA-refined specification:** Reviewed product requirements, an external source not distributed with this repository.

## Overview

Complete the Interpretation Network feature set around six stakeholder requirements:

1. anonymous read-only access to a published Interpretation Network application;
2. working human-readable application aliases such as `/a/suzdal`;
3. policy-controlled cell styling with metahub defaults, Application overrides, and explicitly delegated Workspace overrides;
4. saving either a complete Structure or a selected hierarchical branch as a template;
5. multiple Materials per cell with zero or one explicit Primary Material;
6. personal authenticated Favorites for Matrix cells.

The implementation should use the platform's existing public application resolver, public-entry Workspace selection, RLS transaction, alias service, materialized layout system, entity-backed runtime data, unified settings concepts, TanStack Query, isolated `@universo-react/apps-template-mui` runtime, UUID v7 identities, generator-first fixture pipeline, and minimal-Supabase Playwright verification.

This is a clean-break implementation for a recreated test database. Do not add compatibility readers, migration shims for disposable data, a second alias system, a parallel settings subsystem, or a second Interpretation Network runtime. Do not increment the platform schema version or the Interpretation Network metahub-template version.

## Post-QA Implementation Clarification (2026-10-24)

The latest hands-on browser QA adds four concrete acceptance details to the approved plan:

-   Keep the anonymous transport/controller separate so it can use the bounded, credential-free public DTO, but render it through the canonical Dashboard shell and the same Interpretation Network workspace, Structure pane, Matrix bridge, and Matrix views used by authenticated applications. Read-only access is enforced by the public adapter and by omitting authoring affordances; do not build a parallel public-only screen or reuse authenticated mutation transports. The no-shared-Workspace message remains inside the application runtime shell without a login redirect.
-   Make saved templates usable inside an existing hierarchy: a selected cell's actions open the Templates section, where a user reviews a saved template and inserts its root as a child of the selected cell. The backend resolves and checks Workspace, Structure/Interpretation, role, hierarchical mode, expected versions, source/template ownership, and the complete subtree within one transaction. It generates fresh UUID v7 identities and remaps parent, row, coordinate, and Material references without modifying the source or saved template.
-   Preserve TableTemplate aggregate semantics during Workspace copy. If a copied TableTemplate owns Materials that its workspace-copy policy excludes, capture the ownership references in the same source snapshot and fail before creating the target Workspace. When both sides are copied, remap string `Material.TemplateOwnerId` provenance to the copied TableTemplate ID inside the same transaction. Verify both branches against real PostgreSQL, including unchanged source records.
-   The custom HEX color picker remains an existing MUI adornment inside the new-color field. Browser geometry assertions must prove the button stays within the field at desktop, tablet, and mobile widths; the color picker defaults to HEX.

The canonical minimal-Supabase verification gate is the acceptance source for these follow-ups. Inspect its fresh screenshots at the actual rendered viewport sizes; a passing DOM assertion alone is insufficient for public presentation or color-field geometry.

Settings remain on the published `/api/v1` routes. Global settings may omit a target and resolve to `{ kind: 'global' }`; target-aware policy uses only canonical `workspaceOverrides.allowedAddresses/lockedAddresses`. Do not accept or emit the retired `allowedKeys/lockedKeys` aliases, and do not add database or metahub compatibility code.

## Planning Evidence And Current Baseline

The same-day RESEARCH artifact was QA-reviewed before this plan. Additional PLAN analysis rechecked current source, project Skills, existing Interpretation Network plans and test harnesses, and relevant current library contracts.

Current technical baseline relevant to this plan:

-   React 18.3.1.
-   Material UI 9.2.0.
-   MUI X 9.8.0.
-   React Router 7.18.2.
-   Zod 3.25.76.
-   TanStack Query is centrally cataloged in `pnpm-workspace.yaml` as `^5.62.13` and is already used by both `applications-frontend` and `apps-template-mui`.
-   Backend persistence uses PostgreSQL through `DbExecutor`, request-scoped/RLS executors, schema-qualified SQL, bind parameters, optimistic versions and UUID v7.
-   The current public runtime already resolves application UUIDs and aliases, selects the public-entry Workspace on the server, establishes anonymous RLS context, and resolves effective layout inside the public transaction.
-   The current public DTO/renderer is marketing-page-specific; authenticated Dashboard runtime is coupled to authenticated adapters, persistence IDs and mutation hooks.
-   `_app_workspace_settings` is currently a key-only store with one active `(workspace_id, key)` row. The shared settings model knows `global`, `layout`, `widget`, and `entity` target kinds, but current Workspace overrides are global-key settings.
-   The current Interpretation Network Material command effectively enforces one Material per cell and makes every newly created Material the `MaterialRef`.
-   The current Structure-template copy path already provides the right transaction/remapping foundations, but assumes full-Matrix copy and one Material per cell.
-   The current docs/fixture/browser pipeline is already generator-first and should be extended rather than replaced.

Context7 was refreshed during PLAN:

-   MUI 9.2 Tabs require an accessible tablist label and tab/tabpanel `id` / `aria-controls` / `aria-labelledby` linkage; keyboard activation mode must be deliberate.
-   MUI Select controls require an associated accessible label.
-   TanStack Query v5 guidance requires every changing query dependency to be represented in the query key; scoped invalidation should target the same key family. `skipToken` is appropriate when a query cannot execute until a required target is available.

OntoIndex was used for semantic navigation and selected impact checks. Its index reports degraded coverage for two oversized files, so current source remains authoritative where graph coverage is incomplete. Initial impact checks for the public controller, Workspace effective-settings resolver and `StructurePane` were LOW; implementation must still run exact symbol impact checks before every indexed edit and `gn_verify_diff` before closeout.

## Resolved Architecture Decisions

### 1. Public runtime uses a strict template-aware DTO and the canonical shared Dashboard/workspace presentation

Keep the existing public application resolver and route. Extend the public runtime contract into a strict discriminated union instead of serializing authenticated effective-layout structures.

The public Dashboard projection contains only renderer-safe fields:

-   `instanceKey` as semantic placement identity;
-   `widgetKey`;
-   zone and ordering;
-   parent/slot composition keys;
-   explicitly allowlisted renderer configuration;
-   an explicit public data state for specialized widgets.

Do not expose:

-   persistence widget UUIDs;
-   layout UUIDs;
-   source widget/layout lineage;
-   source hashes or versions;
-   entity binding internals;
-   mutation targets;
-   authenticated permissions or action metadata.

The current Dashboard renderer contract should be refactored so rendering identity is `instanceKey`; authenticated mutation scope is carried separately by authenticated adapters. Public runtime must never invent fake UUIDs just to satisfy a renderer type.

Public projection must happen before generic widget runtime-data reads. Add a public-specific placement/runtime-data resolver that classifies every active placement before any datasource access:

-   audited renderer-only widgets project only widget-specific strict config;
-   audited data-backed widgets have separate strict config and runtimeData projectors;
-   `interpretationNetworkWorkspace` is marked deferred/specialized and is never eagerly loaded through the generic runtime-data resolver;
-   explicitly supported hidden placements such as the anonymous-inapplicable `workspaceSwitcher` may be omitted only when dependency-closure checks prove no projected placement depends on them;
-   any other active unsupported placement fails public readiness with the existing non-enumerating unavailable response.

After projection/omission, validate the public placement graph again. Do not prune an arbitrary unsupported subtree and do not call the authenticated `resolveEffectiveWidgetRuntimeData` over the full active layout first.

### 2. Interpretation Network public data is a specialized bounded projector

Do not make authenticated Interpretation Network APIs anonymous and do not branch an authenticated mutation-heavy controller with `permissions=false`.

Add a bounded public read endpoint under the existing public application route, conceptually:

```text
GET /api/v1/public/applications/:applicationRef/runtime/widgets/:instanceKey/interpretation-network
    ?locale=en&targetKind=...&entityTypeId=...&entityTypeCodename=...
```

The client supplies only the public application reference, the same normalized public target accepted by the bootstrap (`targetKind` plus the currently supported `entityTypeId` / `entityTypeCodename` selectors when applicable), semantic placement `instanceKey`, locale and bounded read-navigation inputs. It never supplies a Workspace ID, layout ID, widget UUID, schema name, table name, column name or physical entity identifier.

The backend repeats the authoritative public boundary for every request:

```text
resolve public application
  -> resolve server-owned public-entry Workspace
  -> establish anonymous Workspace/RLS context
  -> normalize/revalidate the same public target as bootstrap
  -> resolve public-safe effective layout
  -> locate active placement by instanceKey
  -> verify widgetKey === interpretationNetworkWorkspace
  -> project strictly public Interpretation Network data
```

Keep the specialized payload outside the bootstrap Dashboard envelope so a large Interpretation Network does not inflate every public application bootstrap. The projector should support bounded/lazy detail reads where current runtime data size requires them and must impose explicit server-side response limits instead of trusting client page-size values. Mount these reads under the existing public-runtime limiter or a stricter dedicated limiter and test the route wiring.

Interpretation Network public navigation must not expose physical TABLE-child row IDs or authenticated mutation handles. Keep the identity model minimal: the authenticated runtime already has a server-generated UUID v7 Interpretation row ID and Matrix already has semantic `CellId`, so Favorites can target the internal pair `{ interpretationId, cellId }` after same-Workspace validation without adding `InterpretationKey`, `StructureKey` or `MaterialKey` fields. These internal identifiers remain hidden from normal UI and anonymous DTOs. Public Structure/Interpretation/Material lazy navigation uses parent-context selectors or server-issued opaque public-local handles scoped to the resolved public application/Workspace/widget; those handles are accepted only by the bounded public read projector and can never be reused against authenticated mutation APIs. Add a new persistent semantic key only if implementation-time source evidence proves an existing identity cannot satisfy a concrete invariant.

### 3. Alias behavior remains platform-generic

No Interpretation Network alias subsystem is added.

Acceptance must prove the existing routing contract with the new Dashboard public runtime:

-   UUID entry stays on the UUID route;
-   direct alias preserves the requested alias;
-   canonical secondary alias resolves to the primary alias;
-   unavailable/private/archived/deleted content remains non-enumerating.

### 4. Widget-scoped Workspace settings get one target-aware address model

Refactor the current key-only Workspace override contract into a typed semantic address that can represent existing global settings and new widget-scoped settings without a parallel store. The client-facing address may use `instanceKey`, but persistence must also include the authoritative layout scope in which that `instanceKey` is unique.

Recommended shared shape:

```ts
const workspaceSettingTargetSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('global') }).strict(),
    z
        .object({
            kind: z.literal('widget'),
            instanceKey: layoutInstanceKeySchema
        })
        .strict()
])

const workspaceSettingAddressSchema = z
    .object({
        key: z.string().min(1).max(160),
        target: workspaceSettingTargetSchema
    })
    .strict()
```

For every widget read/write, the server resolves the current materialized Application layout first and converts the semantic address into a persistence target `{ targetKind: 'widget', targetOwnerId: layoutId, targetKey: instanceKey }`. The request never supplies `targetOwnerId`/layout UUID. This prevents an override created for one layout from silently applying to a later layout that happens to reuse the same `instanceKey`.

The fresh-database `_app_workspace_settings` row should store the normalized authoritative target explicitly, for example:

-   `workspace_id UUID NOT NULL`;
-   `target_kind TEXT NOT NULL`;
-   `target_owner_id UUID NOT NULL` where global uses the current Workspace identity and widget uses the server-resolved materialized Application layout ID;
-   `target_key TEXT NOT NULL` where global uses `''` and widget uses validated `instanceKey`;
-   `key TEXT NOT NULL`;
-   `value JSONB NOT NULL`;
-   existing audit/version/delete metadata.

Replace active uniqueness with `(workspace_id, target_kind, target_owner_id, target_key, key)`. The advisory-lock key, optimistic-version checks, list/reset/batch operations and backend cache identity must include the complete resolved address. Frontend TanStack keys include the semantic address plus current layout/effective-target token returned by the server; they never accept a raw layout UUID from user input.

Batch mutation must resolve every semantic address to its authoritative persistence target first, sort the complete set by one canonical tuple `(targetKind, targetOwnerId, targetKey, key)`, and only then acquire advisory locks and apply mixed set/reset operations. Client order must not influence lock order. This extends the current key-only sort and prevents two batches with the same targets in opposite order from deadlocking.

Because the test database is recreated, change the canonical support-table definition directly. Do not add old-shape read fallbacks or migration compatibility branches.

Application delegation should use the same typed semantic addresses instead of ambiguous key-only delegation and be resolved against the same current materialized layout. The default delegated set may continue to contain the existing safe global settings, but no `interpretationNetwork.*` widget address is delegated automatically.

The materialized layout owns the lifecycle of widget-scoped override rows. When that authoritative layout is replaced or deleted, delete its target rows server-side as part of the layout lifecycle where transaction boundaries permit. A stale row must always fail closed before cleanup and must never attach to a new layout merely because the new layout reuses an `instanceKey`. Do not expose old layout IDs to the browser to make stale rows client-addressable.

Workspace copy must normalize target identity instead of copying persistence addresses verbatim. A copied global row is rewritten to `{ targetKind: 'global', targetOwnerId: targetWorkspaceId, targetKey: '' }`. A widget-scoped row is copied only after the server re-resolves its semantic `instanceKey` against the active Application layout scope and confirms that the address is still delegated/allowed; otherwise that row is skipped fail-closed. Layouts are Application-scoped and shared across that application's Workspaces, so the authoritative target owner may legitimately equal the source row's layout owner. The copy path must validate the owner against the current layout resolver rather than trust or blindly carry the source value; only the global target owner changes to the new Workspace ID.

### 5. Cell-style policy is one strict widget contract with granular delegable subkeys

The canonical metahub widget config owns the complete style policy. Application layout/widget presentation overrides may replace it. Workspace overrides may change only explicitly delegated policy subkeys for the targeted `interpretationNetworkWorkspace` instance.

Recommended normalized policy:

```ts
const interpretationNetworkCellStylePolicySchema = z
    .object({
        allowedColors: z.array(hexColorSchema),
        allowCustomColors: z.boolean(),
        editable: z
            .object({
                fillColor: z.boolean(),
                textColor: z.boolean(),
                borderColor: z.boolean(),
                borderWidth: z.boolean(),
                borderStyle: z.boolean()
            })
            .strict()
    })
    .strict()
```

`allowedColors` is an ordered allowlist, not a fixed-size palette. Normalize/deduplicate colors while preserving order, but do not invent an Interpretation-Network-specific minimum or maximum item count unless an existing generic platform/request bound already applies. An empty preset list is valid; the effective UI simply has no preset choices, and free-form color authoring still depends on `allowCustomColors` plus the corresponding `editable.*` capability.

Use typed setting subkeys for Workspace delegation, such as:

-   `interpretationNetwork.cellStylePolicy.allowedColors`;
-   `interpretationNetwork.cellStylePolicy.allowCustomColors`;
-   `interpretationNetwork.cellStylePolicy.editable.fillColor`;
-   `interpretationNetwork.cellStylePolicy.editable.textColor`;
-   `interpretationNetwork.cellStylePolicy.editable.borderColor`;
-   `interpretationNetwork.cellStylePolicy.editable.borderWidth`;
-   `interpretationNetwork.cellStylePolicy.editable.borderStyle`.

Add one server-owned target-aware effective-widget-config resolver used by both Settings reads and Matrix mutation enforcement:

```text
application + runtime target + instanceKey
  -> current materialized Application layout
  -> active widget placement + base widget config
  -> Application allowed/locked delegation policy
  -> Workspace rows matching (layoutId, instanceKey, delegated subkey)
  -> reconstructed strict widget config
  -> validated effective cellStylePolicy
```

No settings UI or mutation route may reimplement this merge independently. Stale rows bound to an old layout never apply to a new layout; the authoritative layout lifecycle removes them server-side rather than inventing a browser-visible stale-target address.

Backend style enforcement checks only style fields touched by a mutation. An older persisted style that is no longer authorable remains renderable and does not make an unrelated text edit fail.

Interpretation Network Matrix writes must not bypass policy through generic TABLE-child create/update/batch/delete routes. Reuse the existing `recordPolicy.runtimeMutation: 'deny'` contract so generic child mutation routes reject Matrix writes. The current source is transitional: create and drag/move already use dedicated Interpretation Network commands, while `useCellMutations.ts` still edits through `batchUpdateTabularRows()` and deletes through `deleteTabularRow()`. Therefore `runtimeMutation='deny'` must not be enabled in the canonical Matrix metadata until those remaining write paths have moved to the trusted aggregate surface.

The dedicated Matrix surface must cover the complete supported authoring lifecycle: create, semantic edit (including the existing row/column-label fan-out), delete, move/reparent and reorder. Commands accept the selected Interpretation plus semantic `CellId` selectors and expected versions; physical TABLE-child row IDs are resolved by the server and are not mutation authority supplied by the browser. Edit resolves the affected axis peers server-side rather than trusting a client-provided batch of child-row IDs. Delete enforces root/child constraints server-side and atomically applies the chosen aggregate lifecycle for attached Materials and Favorites so no orphan Material, dangling Primary pointer or stale personal reference is created. Membership-changing commands share the per-Interpretation Matrix advisory-lock domain; ordinary text/style edits use optimistic row versions and row locks but do not need the membership lock unless they also change placement/membership.

Every dedicated Matrix command validates the persisted record-policy shape with `resolveValidatedRuntimeEntityRecordPolicy()` (the existing non-granting service helper), runs normal authorization/RLS checks, resolves the effective widget policy, validates only touched style fields and performs the write transactionally. Replace current dedicated-command calls to `assertInterpretationNetworkEntityMutationAllowed()` where they would turn `deny` into a hard block; do not add a new shared enum value or a client-supplied "trusted" flag.

Contrast remains advisory in this slice, matching the current product contract. Do not silently convert the existing warning into a write blocker.

### 6. Selected-branch templates are server-derived hierarchical subtrees

Extend the save-template request with explicit scope:

```ts
type SaveTemplateScope = { kind: 'wholeStructure' } | { kind: 'selectedBranch'; rootCellId: string }
```

For `selectedBranch`:

1. require effective `matrixMode === 'hierarchicalCells'`;
2. acquire the shared per-Interpretation Matrix membership advisory lock used by all membership-changing Matrix commands, then lock/read the source rows inside the transaction;
3. verify the selected root belongs to the source Structure/Interpretation;
4. compute descendants on the server from the locked Matrix snapshot;
5. exclude ancestors, siblings and unrelated branches;
6. rebase the selected copied root to `ParentCellId = null`;
7. validate the rebased one-root hierarchy;
8. generate fresh UUID v7 identities and remap parents;
9. copy Materials only for copied cells when requested;
10. remap Primary Material only when its source Material was copied.

Reject `selectedBranch` in `independentRows`. Never accept a client-supplied descendant list.

### 7. Materials become true 1:N attachments with an explicit Primary pointer

Canonical semantics:

-   `Material.CellId` owns attachment to a Matrix cell and permits many Material rows for one cell;
-   `Matrix.MaterialRef` is nullable and means only Primary Material;
-   ordinary Material creation does not change Primary;
-   set/replace/clear Primary is an explicit aggregate command;
-   deleting the current Primary atomically clears `MaterialRef`;
-   deleting a secondary Material does not change Primary;
-   generic paths must not be able to leave a dangling `MaterialRef`.

Material runtime mutation uses the same existing deny-generic/trusted-command pattern as Matrix mutation: canonical Material metadata keeps `recordPolicy.runtimeMutation = 'deny'`, generic Material record create/update/delete routes reject external runtime mutation, and dedicated Interpretation Network Material commands cover create, metadata/body edit, set/replace/clear Primary and delete. Each command calls `resolveValidatedRuntimeEntityRecordPolicy()` before permission/RLS checks plus Material/Primary invariants inside the aggregate boundary. The authenticated browser targets a Material through the selected Interpretation + semantic CellId + Material identity needed by the aggregate API; it does not provide a physical Matrix TABLE-child row ID as write authority. Do not add a new runtime-mutation enum value and do not bypass `deny` through request-controlled flags; the internal aggregate service is the only write path.

The dedicated Material edit command resolves the Material -> Cell -> Interpretation chain server-side in the current Workspace, applies an expected-version predicate, permits only authored Material fields such as Title/Description/Body, rejects `CellId`, `TemplateOwnerId`, Primary-relation/system-owned fields and any cross-cell reassignment, runs lifecycle hooks consistently, and returns the updated row with `RETURNING`. Both current frontend Material edit paths that call generic `updateAppRow()` must switch to this command before Material metadata is changed to `runtimeMutation='deny'`.

All Material/Primary commands for one cell share one concurrency domain, for example `interpretation-network-material-cell:${workspaceId}:${interpretationId}:${cellId}`. Inside that lock/transaction, lock the Matrix row with `FOR UPDATE` and use expected-version predicates where user-visible concurrent edits matter. `create material`, `edit material`, `set/replace/clear primary` and `delete material` therefore serialize against each other for the same cell.

Copy semantics must be deterministic:

```ts
// One unambiguous map only.
const materialIdMap = new Map<SourceMaterialId, DestinationMaterialId>()

// Cell ownership uses the separate cell map.
const destinationCellId = cellIdMap.get(sourceMaterial.cellId)

// Primary remaps only from source Matrix.MaterialRef.
const destinationPrimary = sourcePrimaryId ? materialIdMap.get(sourcePrimaryId) ?? null : null
```

Remove the current `CellId -> one material` fallback. Template deletion and instantiation must enumerate the full template-owned Material set by `TemplateOwnerId`/copied-cell scope and use `MaterialRef` only for Primary validation/remapping.

### 8. Favorites use an entity-backed personal Object with existing Interpretation + Cell targeting

Resolve the research open question with the existing authenticated aggregate identity: target the pair of server-generated UUID v7 Interpretation row ID + Matrix `CellId`. `CellId` alone is not assumed globally unique across every Interpretation. This does not persist a Matrix TABLE-child row ID and does not require a parallel Interpretation identity field. Add/navigation require both values to resolve to one active target in the current Workspace. Removal is different: a stale Favorite must still be removable after its target cell disappears, so remove is authorized from the Favorite row's server-owned owner/Workspace scope and stored target tuple (or an owner-scoped opaque Favorite handle returned by the list), without requiring the target cell to remain active.

Add an Interpretation Network `Favorite` Object/entity with its normal server-generated UUID v7 row ID plus hidden server-owned fields conceptually equivalent to:

-   `OwnerUserId` — STRING containing the authenticated actor UUID, server-owned from auth context;
-   `TargetInterpretationId` — STRING containing the validated server-generated UUID v7 Interpretation row ID after same-Workspace resolution;
-   `TargetCellId` — STRING containing a validated UUID v7 `CellId` after same-Workspace target validation;
-   optional created/sort metadata using existing platform fields.

Workspace ownership comes from the runtime/RLS context, never from request JSON. The authenticated client sends only the already-selected runtime intent `{ interpretationId, cellId }`; the server treats both as untrusted selectors until they resolve to one active Interpretation/Matrix cell in the current Workspace.

Favorites are owner-only data, while the current generic `runtimeRecordAccess` contract is `ownerOrShared` and requires sharing-relation metadata. Do not bolt a fake sharing model onto Favorites. Extend that existing generic access contract with a strict `mode: 'ownerOnly'` variant that reuses the same owner-field resolution and current-user parameterization but emits only `ownerColumn = currentUserId`. Unlike existing `ownerOrShared`, `ownerOnly` must not silently bypass the owner predicate merely because the actor has `manageApplication`; any future administrative inspection of personal Favorites requires an explicit separate administrative contract. Configure Favorite with `OwnerUserId` as the owner field. Generic runtime list/get therefore sees only the current user's rows, and the dedicated Favorite API applies the same owner predicate explicitly. Keep existing `ownerOrShared` behavior unchanged for current entities.

Dedicated aggregate routes/services should provide:

-   list current user's Favorites;
-   idempotent add by Interpretation ID + CellId;
-   idempotent remove by owner-scoped Favorite identity/handle, with tuple-based compatibility only when the target still resolves safely.

The add path takes a per-target advisory lock over the logical `(workspace, user, interpretationId, cellId)` tuple and checks for an existing active row under that lock so concurrent adds produce one active Favorite. No extra Favorite identity component is needed solely to emulate a composite key. The server resolves the Interpretation ID and CellId to one active Matrix cell in the current Workspace before add and before navigation projection. Remove instead resolves the Favorite row under strict owner-only + Workspace scope first, so deletion of the target cell cannot strand a Favorite that the owner can no longer remove.

Deletion lifecycle:

-   Matrix/Structure aggregate deletion should clean up matching Favorites in the same transaction where practical;
-   the Favorite list must still fail safely if a stale/inaccessible target exists because concurrent deletion or historical data may race;
-   unresolved targets return a localized unavailable item that exposes no raw target ID and offers removal through the owner-scoped Favorite action; repeated removal is idempotent and a non-owner cannot remove the stale row.

Favorites are personal runtime data. Their canonical entity metadata must set `recordPolicy.workspaceCopy = 'exclude'` (or the current exact equivalent), they are never copied into Structure templates, and they are not exposed in anonymous public runtime.

### 9. TanStack Query keys are fully scoped by authority and target

Use stable query-key factories and include every variable that changes the result.

Examples:

```ts
const publicRuntimeKeys = {
    root: ['public-application-runtime'] as const,
    bootstrap: (applicationRef: string, locale: string, target: PublicTarget) =>
        [...publicRuntimeKeys.root, applicationRef, locale, target] as const,
    interpretationNetwork: (applicationRef: string, locale: string, target: PublicTarget, instanceKey: string) =>
        [...publicRuntimeKeys.root, applicationRef, locale, target, 'widget', instanceKey, 'interpretation-network'] as const
}

const workspaceSettingKeys = {
    target: (applicationId: string, workspaceId: string, address: WorkspaceSettingAddress) =>
        ['workspace-settings', applicationId, workspaceId, address.target, address.key] as const
}
```

Use `skipToken` or the package's established equivalent for queries that cannot run before `instanceKey`, selected Structure or Workspace exists. Mutations invalidate only the affected target family plus any effective-config view that derives from it.

Do not optimistically invent server-owned Favorite ownership, Primary Material relationships, branch copies or effective settings. Small reversible presentation changes may use optimistic UI only when rollback semantics are explicit; aggregate state remains server-authoritative.

## Runtime UI Contract

Every touched user surface must be implementation-ready before code starts. The following contract is normative for implementation and browser QA.

| Surface / role                                 | Controls and defaults                                                                                                                                                                                                                                                                                                                                                                                                                         | Human-readable display / hidden system data                                                                                                                                                                                                  | Validation, error and empty states                                                                                                                                                                                                                                   | Focus, keyboard and responsive oracle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous public Interpretation Network viewer | Read-only Structure/Matrix navigation, cell selection, Material list/detail, Back to materials; Primary opens automatically when present. No mutation controls are rendered.                                                                                                                                                                                                                                                                  | Show labels, paths, descriptions and public Material content. Hide all UUIDs, semantic keys, `CellId`, `ParentCellId`, `MaterialRef`, widget/layout IDs, target internals, JSON and permission metadata.                                     | Localized loading skeleton/state, empty Structures/Materials, bounded-projector error and generic unavailable state. Raw Zod/SQL/backend text never reaches the surface.                                                                                             | Tabs/navigation must be keyboard reachable; focus remains on meaningful navigation after Back. At 390 px panels stack/reflow; page-level horizontal overflow is forbidden.                                                                                                                                                                                                                                                                                                                                                       |
| Cell style editor for authorized users         | Ordered preset-color controls; optional custom color picker + HEX field only when `allowCustomColors=true`; controls for fill/text/border color, width and style only when the corresponding `editable.*` flag is true. Reset restores the inherited/effective value for the edited field.                                                                                                                                                    | Presets render in configured order with accessible names. Existing persisted out-of-policy values remain visible as the current style but are not offered as new authoring choices unless permitted. No policy JSON or internal field names. | Localized invalid HEX/value errors; localized advisory contrast warning; capability-disabled controls are absent rather than disabled. Direct API bypass is rejected server-side with localized-safe UI feedback.                                                    | Color options and Selects are keyboard-operable and labelled. Closing/cancelling returns focus to the invoking cell action. Narrow view wraps controls into rows/stack without page overflow.                                                                                                                                                                                                                                                                                                                                    |
| Full Cell Edit dialog                          | Preserve the existing Basic and Style editing workflow while migrating the touched dialog to `StandardDialog`. Basic includes semantic cell fields with `CellDescription` rendered multiline; Style contains the policy-driven controls above.                                                                                                                                                                                                | Show human labels/values only. `CellId`, `ParentCellId`, placement/system fields, raw policy data and persistence IDs remain hidden.                                                                                                         | Real EN/RU required/format/conflict validation; policy errors are localized. Invalid Basic or Style input cannot silently discard the other tab's draft.                                                                                                             | Tabs have `aria-label`/`aria-labelledby`, Tab-to-tabpanel `id`/`aria-controls`/`aria-labelledby` linkage and deliberate keyboard activation. Open focuses the first meaningful field/current tab, Escape/cancel/close restore focus to the invoking cell action, and mobile content scrolls inside the dialog without widening the page.                                                                                                                                                                                         |
| Metahub/Application style-policy editor        | Extend the existing Interpretation Network settings composition (`MatrixSettingsPanel`, `MatrixSettingsRows`, `SaveSettingsButton`) with ordered `allowedColors` add/remove/reorder, `allowCustomColors`, each `editable.*` switch, reset-to-metahub/default, and per-subkey Workspace delegation at Application level. Default is canonical template policy; reset removes the local override/delegation rather than copying a hidden value. | Show inherited / overridden / delegated / locked states as localized labels. Widget target is shown by readable widget label/location, never widget UUID, target JSON or persistence IDs.                                                    | Reject invalid/duplicate normalized colors and invalid delegation addresses. Empty preset lists are valid. Locked values explain why they cannot be changed.                                                                                                         | Reorder has keyboard-accessible move up/down controls in addition to pointer affordance. All switches/selects have accessible labels. Controls stack at tablet/mobile widths.                                                                                                                                                                                                                                                                                                                                                    |
| Workspace style settings                       | Only explicitly delegated subkeys for the current semantic `instanceKey`; override toggle/value editor; Reset removes the Workspace override and reveals Application value.                                                                                                                                                                                                                                                                   | Show inherited Application value and resulting effective value; no layout/widget UUIDs. Non-delegated and locked addresses do not render as editable controls.                                                                               | Localized optimistic-conflict feedback with reload/retry action. Overrides bound to replaced/deleted materialized layouts are server-cleaned by layout lifecycle and never rebound by matching `instanceKey`; they are not exposed through raw stale-layout handles. | Initial focus stays on the selected widget settings section; reset/save return focus predictably. Responsive form is single-column on mobile.                                                                                                                                                                                                                                                                                                                                                                                    |
| Save Structure as Template dialog              | `Whole Structure` default; `Selected branch` option only for hierarchical mode; existing include-Materials choice; name and semantic multiline description fields; selected branch shown as readable cell path. Submit is unavailable until required fields/root are valid.                                                                                                                                                                   | Never expose root UUID/`CellId`. Display selected cell label/path and copy summary such as branch + materials policy.                                                                                                                        | Localized required-name/root/mode/conflict errors. `selectedBranch` is unavailable in independent rows. Long path wraps.                                                                                                                                             | Implement with `StandardDialog`; tab order follows fields then actions; Escape/cancel/close restore focus to invoker; mobile dialog content scrolls internally without page overflow.                                                                                                                                                                                                                                                                                                                                            |
| Structure template-detail dialog               | Preserve the current template-detail content/actions while replacing the raw MUI dialog composition with `StandardDialog`; destructive delete remains a separate `ConfirmDeleteDialog`.                                                                                                                                                                                                                                                       | Show template name, description, material-copy/scope semantics and other readable metadata only; never surface template/row UUIDs, raw JSON or internal field codenames.                                                                     | Localized unavailable/stale-template state and action errors. Semantic description is multiline/readable and long paths/text wrap.                                                                                                                                   | Initial focus lands on the dialog heading/first meaningful action, keyboard order is deterministic, Escape/close restores focus to the originating template row/card, and narrow layouts scroll inside the dialog without page overflow.                                                                                                                                                                                                                                                                                         |
| Materials list/detail for authorized users     | Existing list/table/cards view remains, now allowing 0..N Materials. Explicit `Set as Primary`, `Replace Primary` and `Clear Primary`; delete uses `ConfirmDeleteDialog`. Selecting a cell opens Primary when set, otherwise list.                                                                                                                                                                                                            | Primary badge uses the single UI term `Primary Material` / localized equivalent. Do not show `MaterialRef`, `CellId`, table-row IDs or relation internals. Semantic long-text fields remain multiline.                                       | Localized empty Materials state, stale/unavailable Material state and aggregate conflict errors. Deleting Primary returns to list and clears marker atomically.                                                                                                      | Back returns focus to the corresponding Material/list context. Actions are keyboard accessible; cards/grid reflow without page overflow.                                                                                                                                                                                                                                                                                                                                                                                         |
| Favorites tab for authenticated users          | Reuse `CustomizedDataGrid` directly. Columns: `#`, Structure, Cell path/label, Status, Actions. The Cell/Location value is an accessible Link/Button rendered in the existing grid cell and is the primary navigation control; whole-row click may only be supplementary. Remove remains an explicit row action. Cell mini-menu toggles Add/Remove Favorite.                                                                                  | No raw Favorite/Cell/row IDs. Status is localized `Available` / `Unavailable`; unavailable rows keep readable last-known context only when safely stored/projected and always offer Remove.                                                  | Localized empty Favorites state, unavailable target state and idempotent mutation feedback. Anonymous users have no Favorites tab/menu item in the DOM.                                                                                                              | The Location Link/Button has a meaningful accessible name and works with Enter/Space using native control semantics. Tabs use labelled tablist + tab/tabpanel ARIA linkage. After menu close/remove/navigation, focus moves to a meaningful row/cell/tab target. At 390 px `CustomizedDataGrid` keeps Structure+Cell as a combined location column, hides nonessential `#`, keeps Actions, and may scroll inside the grid only; the page itself must not overflow horizontally. Do not create a Favorites-specific grid wrapper. |

Touched dialog debt is resolved in this scope rather than deferred:

-   migrate the Save-as-Template dialog in `WorkspaceDialogs` to `StandardDialog`;
-   migrate the touched template-detail dialog in `StructurePane` to `StandardDialog`;
-   migrate `CellEditDialog` to the canonical dialog path while integrating policy-driven style editing;
-   keep destructive confirmations on `ConfirmDeleteDialog`;
-   do not add any new raw MUI `Dialog` / `DialogActions` usage on touched Interpretation Network surfaces.

### Responsive and localization contract

-   Real EN and RU resources are required from the first implementation pass.
-   New feature-specific published-runtime strings live in the isolated `apps-template-mui` Interpretation Network locale resources.
-   Truly cross-product strings may move to `@universo-react/i18n`; do not move feature strings merely to centralize them.
-   `@universo-react/apps-template-mui` must remain isolated from `@universo-react/template-mui`. Shared UI primitives in the latter may be reused only by packages whose existing dependency boundary permits it; published runtime uses its own canonical local runtime primitives.
-   Browser proof uses 1920x1080, 768x1024 and 390x844 with no page-level horizontal overflow.

## Affected Areas

Expected implementation touches include the following areas. Exact filenames may be split during implementation to keep modules focused.

### Shared contracts

-   `packages/universo-react-types/src/common/applicationAliases.ts`
-   `packages/universo-react-types/src/common/marketingPagePublicRuntime.ts`
-   new `packages/universo-react-types/src/common/publicApplicationRuntime.ts`
-   `packages/universo-react-types/src/common/interpretationNetworkLayout.ts`
-   `packages/universo-react-types/src/common/unifiedSettings.ts`
-   shared type exports/tests

### Public application backend

-   `packages/universo-react-applications-backend/src/controllers/publicApplicationRuntimeController.ts`
-   `packages/universo-react-applications-backend/src/routes/publicApplicationRuntimeRoutes.ts`
-   `packages/universo-react-applications-backend/src/services/publicApplicationRuntime.ts`
-   new strict Dashboard projector beside `publicMarketingRuntime.ts`
-   new specialized public Interpretation Network projector/service
-   effective-layout projection helpers only where needed to separate render identity from persistence identity

### Workspace settings backend

-   `packages/universo-react-applications-backend/src/ddl/applicationWorkspacesSchema.ts`
-   `packages/universo-react-applications-backend/src/services/workspaceSettingsService.ts`
-   Workspace settings controllers/routes/store tests
-   application settings policy normalization and effective widget-config resolution

### Interpretation Network backend

-   `runtimeInterpretationNetworkCore.ts`
-   `runtimeInterpretationNetworkService.ts`
-   `runtimeInterpretationNetworkMatrixCopy.ts`
-   `runtimeInterpretationNetworkMaterials.ts`
-   `runtimeInterpretationNetworkMaterialCommands.ts`
-   `runtimeInterpretationNetworkValidation.ts`
-   existing `packages/universo-react-applications-backend/src/shared/entityMutationPolicy.ts` non-granting policy-validation helper reused by trusted aggregate commands
-   `packages/universo-react-applications-backend/src/services/runtimeRowSupport/contracts.ts` and `access.ts` for the reusable owner-only record-access mode
-   generic runtime row read/access tests that prove Favorite owner isolation
-   Matrix/Structure aggregate delete paths
-   new focused Favorite service/commands if separation improves maintainability

### Canonical metahub/template metadata

-   `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.template.ts`
-   `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.stage2.ts`
-   template validators/tests
-   metahub widget editor/settings surface for policy defaults

### Application control panel

-   existing `packages/universo-react-applications-frontend/src/pages/application-settings/MatrixSettingsPanel.tsx`
-   existing `packages/universo-react-applications-frontend/src/pages/application-settings/MatrixSettingsRows.tsx`
-   existing `SaveSettingsButton` composition in `application-settings/SettingsPanels.tsx`
-   existing Application layout widget editor path that already embeds `MatrixSettingsPanel`
-   Workspace delegation policy editor
-   query-key/mutation helpers using target-aware setting addresses
-   real EN/RU resources for control-panel text

### Published application runtime

-   `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`
-   new `PublicDashboardApplicationRuntime.tsx`
-   public-runtime API/query-key modules and tests
-   `packages/universo-react-apps-template-mui/src/dashboard/runtime/widgetPlacementGraph.ts`
-   Dashboard contracts/renderer affected by semantic renderer identity
-   Interpretation Network workspace/view/state/dialog components
-   `StructurePane.tsx`
-   Material list/detail components
-   `StandardDialog` / `ConfirmDeleteDialog` reuse
-   `src/i18n/locales/{en,ru}/interpretationNetwork.json`

### Fixture, E2E and documentation

-   `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`
-   `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`
-   `tools/testing/e2e/support/interpretationNetworkFocused.ts`
-   focused Interpretation Network Playwright specs
-   `tools/testing/e2e/support/runInterpretationNetworkVerificationLocalSupabase.mjs`
-   GitBook screenshot generator/provenance/drift tooling
-   `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` regenerated only by the product generator
-   package READMEs and EN/RU GitBook pages listed in the documentation phase below

## Step-by-Step Implementation Plan

### Phase 0 — Baseline, impact and invariant lock

-   [x] Record the current dirty-worktree boundary and protect unrelated changes.
-   [x] Re-read the approved brief, research and this plan before editing.
-   [x] Run exact OntoIndex `inspect` + `impact` on the first set of edited symbols. Continue exact per-symbol impact before each subsequent existing symbol edit; stop and redesign if an unexpected HIGH/CRITICAL blast radius is discovered.
-   [x] Capture current schema/template version values and fixture checksum so closeout can prove no version bump and generator-only fixture changes.
-   [x] Pin R1-R6 acceptance IDs in implementation tests and checklist.
-   [x] Confirm no `pnpm dev` use. Browser work uses the existing Playwright/minimal-Supabase harness.

### Phase 1 — Refactor shared contracts and renderer identity

-   [x] Add strict public application runtime union and Dashboard placement schemas in `@universo-react/types`.
-   [x] Reuse the existing bounded marketing-page schemas inside the union.
-   [x] Define public Dashboard placement without persistence IDs and with widget-specific strict config schemas; do not use a generic `z.record(z.unknown())` as the final public contract.
-   [x] Refactor `apps-template-mui` rendering contracts so `instanceKey` is sufficient for React/composition identity.
-   [x] Move authenticated widget/layout UUIDs into authenticated adapter/mutation scope rather than the pure renderer placement.
-   [x] Preserve the existing server-generated UUID v7 Interpretation row ID + semantic `CellId` pair as the authenticated Favorite target; do not add parallel `InterpretationKey`, `StructureKey` or `MaterialKey` fields without a demonstrated invariant that existing identity cannot satisfy.
-   [x] For public lazy navigation, use existing semantic parent context or server-issued opaque public-local handles that are scoped to the resolved public target/placement and cannot be reused as authenticated mutation handles.
-   [x] Keep parent/slot graph validation, unique `instanceKey`, widget-config validation and composition recursion guards intact.
-   [x] Add Vitest contract tests proving public schemas reject internal IDs, unknown keys and unsupported widget payloads.
-   [x] Add contract tests proving public-local opaque handles are read-only/scoped and cannot be used against authenticated mutation transports; keep existing UUID v7 generation/remapping tests for Interpretation rows and `CellId` rather than inventing duplicate identity tests.
-   [x] Add regression tests proving authenticated Dashboard behavior still receives the persistence scope it needs without leaking that scope into public DTOs.

### Phase 2 — Public Dashboard bootstrap and projector registry

-   [x] Extend `publicApplicationRuntimeController` to dispatch by resolved effective `templateKey`.
-   [x] Preserve marketing-page behavior unchanged through the new union.
-   [x] Add a strict public Dashboard projector registry and a public-specific effective-layout/runtime-data resolver. Classify placements before any generic datasource read; no Dashboard widget becomes public merely because it exists in the authenticated runtime registry.
-   [x] Classify the canonical Interpretation Network placements explicitly:
    -   [x] `interpretationNetworkWorkspace`: specialized public projector;
    -   [x] `languageSwitcher`: bounded renderer-only config;
    -   [x] `colorModeSwitcher`: bounded renderer-only config;
-   [x] `menuWidget`, `appNavbar`, `header`: define separate strict config and runtimeData projectors where the renderer actually requires runtime data; never assume config-only rendering.
-   [x] `workspaceSwitcher`: register as an explicitly supported hidden anonymous placement and omit only after dependency-closure validation proves no projected child/slot depends on it.
-   [x] any other active unsupported placement: fail public readiness with the existing non-enumerating unavailable response; never serialize or arbitrarily prune it.
-   [x] Revalidate the projected placement graph after supported hidden placements are removed.
-   [x] Preserve server-selected public-entry Workspace, anonymous RLS context and non-enumerating unavailable responses.
-   [x] Preserve the existing normalized public target contract (`targetKind`, supported `entityTypeId` / `entityTypeCodename`) and reject only authority/internal selectors such as `workspaceId`, layout/widget UUID, schema/table/column identifiers or physical row IDs.
-   [x] Add Jest tests for every canonical placement classification and DTO redaction.
-   [x] Add tests proving unsupported placements fail before datasource reads and `interpretationNetworkWorkspace` never reaches the generic eager runtime-data resolver.

### Phase 3 — Specialized public Interpretation Network read surface

-   [x] Add the bounded `instanceKey`-scoped public endpoint/service and mount it under the existing public-runtime rate limiter or a stricter dedicated limiter.
-   [x] Require and normalize the same public target used by bootstrap on every request; re-resolve application/public Workspace/public-safe effective layout rather than trusting bootstrap-derived private state.
-   [x] Verify placement is active and is the allowlisted `interpretationNetworkWorkspace` instance.
-   [x] Resolve Interpretation Network metadata and rows through the anonymous request-scoped/RLS executor.
-   [x] Project only readable Structure/Interpretation/Matrix/Material/Primary-Material information needed by the UI.
-   [x] For public lazy navigation emit bounded server-owned public-local opaque handles or sufficient parent context; never expose/accept authenticated Interpretation/Structure/Material row IDs, Matrix TABLE-child row IDs or persistence placement IDs in the anonymous DTO/API.
-   [x] Apply bounded result limits and lazy secondary reads where payload size can grow. Reject excessive client limits and define deterministic ordering.
-   [x] Return localized/safe unavailable states rather than raw SQL/Zod/internal errors.
-   [x] Add route/service Jest tests for public/private/archived/deleted applications, missing public Workspace, target mismatch, wrong/inactive `instanceKey`, RLS cross-Workspace isolation, malformed query, semantic/public-local lookup scope, response caps, limiter wiring and DTO privacy.

### Phase 4 — Public Dashboard frontend host

-   [x] Add a dedicated `PublicDashboardApplicationRuntime` in `applications-frontend`.
-   [x] Dispatch `PublicApplicationRuntime` by union template type instead of always rendering marketing content.
-   [x] Add public specialized-widget query functions with `credentials: 'omit'` and `cache: 'no-store'` consistent with existing public transport.
-   [x] Use TanStack Query keys scoped by application reference, locale, normalized public target, `instanceKey` and any semantic lazy-read key; use `skipToken` when a required target/key is absent.
-   [x] Create a read-only Interpretation Network presentation controller that accepts projected data and reuses pure Matrix/Material view primitives without importing authenticated mutation hooks.
-   [x] Ensure the public branch does not import/call authenticated `createRuntimeAdapter`, runtime-row mutation clients, template APIs, Favorite APIs or Workspace settings mutation APIs.
-   [x] Physically omit mutation/admin UI subtrees.
-   [x] Add applications-frontend and apps-template-mui Vitest tests for union dispatch, query-key isolation, credential-free fetches, zero authenticated requests and mutation DOM absence.

### Phase 5 — Target-aware Workspace settings foundation

-   [x] Replace key-only Workspace setting input/reset/batch contracts with `WorkspaceSettingAddress` plus value/version.
-   [x] Extend `_app_workspace_settings` fresh-DB DDL with `target_kind`, server-resolved `target_owner_id`, `target_key` and active unique index `(workspace_id, target_kind, target_owner_id, target_key, key)`.
-   [x] Resolve widget addresses against the current materialized Application layout before every read/write/reset/batch; never trust a client-supplied layout/widget UUID and never match a widget override by `instanceKey` alone.
-   [x] Update advisory-lock key construction to include the full resolved persistence address.
-   [x] For multi-setting batches, resolve every target first, then sort all set/reset operations by one canonical persistence tuple `(targetKind, targetOwnerId, targetKey, key)` before acquiring advisory locks. Use the same ordering for mixed set/reset batches and test reversed client order to prevent lock-order deadlocks.
-   [x] Keep SQL schema-qualified and parameterized; use `RETURNING` and fail closed on zero-row updates/resets.
-   [x] Refactor Application Workspace override policy into typed allowed/locked addresses. Do not add interpretationNetwork widget settings to default delegation.
-   [x] Add one target-aware effective-widget-config resolver that resolves materialized layout -> placement/base config -> allowed/locked delegation -> matching Workspace rows -> strict effective config. Reuse it in Settings UI reads and Matrix mutation enforcement.
-   [x] Reject unsupported target kinds until their physical semantics are implemented; stale old-layout widget rows never apply to a new layout with the same `instanceKey`.
-   [x] Preserve optimistic `expectedVersion` behavior and atomic batch semantics.
-   [x] Define copy/delete behavior: Workspace settings copy with the Workspace only where current product copy policy permits. Normalize copied targets server-side: global rows rewrite `targetOwnerId` to the new Workspace and `targetKey=''`; widget rows are copied only after re-resolving the semantic `instanceKey` against the active Application-scoped layout and rechecking delegation/allow rules, otherwise skip them fail-closed. The current layout owner may match the source owner because Workspaces share Application layouts; never trust an old owner without resolving it. When an Application layout is replaced/deleted, clean up its widget-target override rows server-side in the same authoritative lifecycle/transaction where feasible; until cleanup, stale rows remain fail-closed and never bind to a new layout that reuses the same `instanceKey`. Do not expose raw old layout IDs or invent a client stale-row deletion address.
-   [x] Add backend Jest coverage for DDL/index shape, global regression, widget target isolation, explicit allow/lock, first-write races, update/reset races, expected-version conflicts, batch atomicity, reversed-order deadlock resistance, global target remap on Workspace copy, current Application-layout owner re-resolution/stale-owner skip behavior and layout-target cleanup.
-   [x] Add shared-types Vitest tests for strict target parsing and policy normalization.

### Phase 6 — Metahub/Application/Workspace cell-style policy

-   [x] Extend the canonical Interpretation Network widget config with normalized `cellStylePolicy`.
-   [x] Set a canonical metahub default matching current product behavior unless the brief explicitly narrows it: current preset list, custom colors allowed, current editable capabilities enabled.
-   [x] Replace README/source fixed-count assumptions with the policy contract.
-   [x] Add typed policy editor controls to the existing metahub widget/settings surface; no raw JSON editor.
-   [x] Extend the existing Application Interpretation Network settings composition (`MatrixSettingsPanel` + `MatrixSettingsRows` + existing `SaveSettingsButton`/Application layout widget editor) with the new policy rows and reset behavior; do not introduce a parallel one-off settings panel.
-   [x] Add explicit per-subkey Workspace delegation controls at Application level.
-   [x] Add Workspace Settings controls only for delegated widget subkeys and the current semantic widget target.
-   [x] Implement ordered allowed-color add/remove/reorder with accessible keyboard move controls, normalized duplicate rejection, explicit reset-to-inherited behavior and localized inherited/overridden/delegated/locked state labels. Empty preset lists are valid; do not add an arbitrary feature-specific 1..N limit unless a shared platform/request bound already exists.
-   [x] Resolve one effective policy for runtime: canonical metahub source -> materialized Application config -> sparse delegated Workspace values.
-   [x] Update `InterpretationNetworkCellStyleEditor` to render only effective capabilities and allowed colors.
-   [x] Keep Matrix metadata on the existing `recordPolicy.runtimeMutation = 'deny'` contract so generic create/update/batch/delete child routes reject Matrix writes; do not extend the shared enum with an `aggregate-only` value. Sequence the rollout so this metadata switch lands only after every supported Matrix authoring path below uses the dedicated aggregate transport.
-   [x] Complete the dedicated Matrix command/API/controller surface for create, edit, delete and move/reparent/reorder. Refactor the current move request away from physical `matrixRowId` authority toward semantic `CellId` under the selected Interpretation; the server resolves child-row persistence IDs from runtime metadata/current Workspace.
-   [x] Replace `useCellMutations.ts` generic `batchUpdateTabularRows()` edit and `deleteTabularRow()` delete calls with the dedicated Interpretation Network APIs. Preserve the existing user-visible edit behavior, but move row/column-label peer discovery/fan-out to the server so the browser sends business intent rather than an arbitrary child-row batch.
-   [x] Dedicated Matrix edit/delete commands call `resolveValidatedRuntimeEntityRecordPolicy()` to validate persisted policy metadata without treating `deny` as permission, then run normal auth/RLS checks, resolve the shared target-aware effective-widget policy, enforce optimistic versions, validate only touched style properties and mutate atomically. Delete must re-check hierarchical root/children constraints server-side and atomically prevent orphaned attached Materials/dangling `MaterialRef` plus clean matching Favorites according to the aggregate lifecycle.
-   [x] Use the shared per-Interpretation Matrix membership lock for create/delete/move/reparent/reorder and every copy/instantiate path that changes Matrix membership. Plain text/style edit does not take that lock unless placement/membership changes; it still uses transactional row locks/expected-version predicates. Reuse the established trusted-workflow pattern instead of adding request-controlled bypass flags.
-   [x] Preserve persisted out-of-policy style values as renderable data and keep contrast advisory.
-   [x] Add Vitest for policy normalization/editor rendering and Jest for direct API bypass, touched-field semantics, disallowed colors/capabilities and inheritance precedence.

### Phase 7 — Multiple Materials and Primary Material aggregate

-   [x] Remove the one-Material-per-Cell invariant from validators and creation logic.
-   [x] Keep Material metadata on `recordPolicy.runtimeMutation = 'deny'`; generic Material record create/update/delete routes reject external runtime writes, while dedicated server-owned aggregate commands use `resolveValidatedRuntimeEntityRecordPolicy()` and then perform the normal permission/RLS checks and invariants.
-   [x] Complete the dedicated Material command/controller/client surface for create, metadata/body edit, set/replace/clear Primary and delete before enabling `runtimeMutation='deny'`. Refactor create/edit calls so the client sends semantic `interpretationId` + `cellId` context instead of a physical Matrix child-row ID; the server resolves the Matrix row and Material ownership from runtime metadata/current Workspace.
-   [x] Make ordinary Material create attach by server-owned `CellId` without changing `Matrix.MaterialRef`.
-   [x] Add a dedicated Material edit command for Title/Description/Body (and only other explicitly authored fields): resolve Material -> Cell -> Interpretation server-side, enforce current Workspace + permissions + expectedVersion, reject `CellId`, `TemplateOwnerId`, Primary/system-owned fields and cross-cell reassignment, execute lifecycle hooks, update with parameterized SQL + `RETURNING`, and fail closed on zero rows.
-   [x] Replace both current `InterpretationNetworkWorkspaceWidget.tsx` Material edit paths that call generic `updateAppRow()` with the dedicated edit API; generic Material update remains denied.
-   [x] Add explicit set/replace/clear Primary command(s), validating same-Cell ownership under the current Workspace.
-   [x] Route Material deletion through aggregate-safe logic so deleting Primary clears the Matrix pointer atomically.
-   [x] Use one cell-scoped concurrency key for create/edit/set/replace/clear/delete, including Workspace + existing Interpretation ID + CellId; lock the Matrix row with `FOR UPDATE` and use expected versions where concurrent visible edits can conflict.
-   [x] Prevent every generic path from bypassing the Primary invariant for Interpretation Network Material relationships; no request flag may elevate a generic route into the trusted aggregate path.
-   [x] Refactor `cloneMaterials` to return only sourceMaterialId -> clonedMaterialId.
-   [x] Keep Cell ownership remapping exclusively in `cellIdMap`.
-   [x] Remap Primary only from source `MaterialRef`; remove CellId fallback.
-   [x] Refactor template save/instantiate/delete to enumerate all attached/template-owned Materials rather than only Primary references.
-   [x] Update runtime UI with explicit Primary badge/action, set/replace/clear flows, direct-open behavior and Back-to-materials.
-   [x] Add Jest coverage for 0/1/N Materials, ordinary create, Primary and secondary Material edit, forbidden ownership/system-field edits, generic-update denial with durable state unchanged, set/replace/clear, delete primary/secondary, concurrent create/edit/primary updates, template copy/delete with secondary Materials and transaction rollback.
-   [x] Add apps-template-mui Vitest for list/detail navigation, Primary marker, focus return and localized states.

### Phase 8 — Selected-branch template save

-   [x] Extend the strict request schema as a discriminated union: `{ kind: 'wholeStructure' }` has no root, while `{ kind: 'selectedBranch', rootCellId: uuidV7 }` requires the root.
-   [x] Keep `includeMaterials` and optimistic source/template version inputs explicit.
-   [x] Unify all Matrix membership-changing commands for one Interpretation (create/delete/move/reparent/copy where applicable) and save-as-template snapshot reads on one advisory-lock domain such as `interpretation-network:matrix:${workspaceId}:${interpretationId}`. Acquire it before reading the source Matrix, then compute descendants from that serialized snapshot on the server. `FOR UPDATE` on existing rows alone is insufficient because it does not block a concurrent child insert.
-   [x] Rebase the selected root before hierarchy validation.
-   [x] Reuse UUID v7 remapping for copied Matrix rows.
-   [x] Reject root not in source Structure, cross-Workspace root, missing root, cycle/damaged hierarchy and `selectedBranch` under `independentRows`.
-   [x] Update save-template UI to use the canonical dialog, show readable selected branch path and prevent invalid branch submission.
-   [x] Migrate the touched `WorkspaceDialogs` save-template surface and `StructurePane` template-detail surface to `StandardDialog`; preserve `ConfirmDeleteDialog` for destructive confirmation.
-   [x] Add Jest service/route tests for no ancestor/sibling leakage, root rebase, deep descendants, materials included/excluded, rollback and optimistic conflicts, plus races where concurrent create/delete/move/reparent during selected-branch save either serialize behind the shared Matrix lock or return the defined conflict without producing a mixed snapshot.
-   [x] Add Vitest for dialog semantics, keyboard path, long-label wrapping and branch availability rules.

### Phase 9 — Entity-backed personal Favorites

-   [x] Extend the existing generic `runtimeRecordAccess` contract with strict `mode: 'ownerOnly'`: reuse owner-field resolution/current-user parameterization, enforce the owner predicate even for `manageApplication`, and leave current `ownerOrShared` behavior unchanged. Cover anonymous, malformed-config, owner, non-owner and manager list/get behavior directly.
-   [x] Add the canonical Favorite Object/entity to the Interpretation Network template with its normal UUID v7 row ID, hidden server-owned `OwnerUserId`, `TargetInterpretationId` and `TargetCellId`, `runtimeRecordAccess.mode = 'ownerOnly'` through `OwnerUserId`, `recordPolicy.runtimeMutation = 'deny'`, and `recordPolicy.workspaceCopy = 'exclude'` (or exact current equivalents).
-   [x] Resolve Favorite table/components from runtime metadata; never accept table/column/object IDs from the client.
-   [x] Add dedicated list/add/remove service and routes under the authenticated Interpretation Network aggregate surface. Dedicated commands validate Favorite policy metadata through the same trusted server-owned workflow pattern used for Matrix/Material commands; generic runtime writes remain denied.
-   [x] Derive user from auth context and Workspace from current runtime/RLS context.
-   [x] Validate existing Interpretation ID + `CellId` resolve to one active Matrix cell in the current Workspace before add/navigation; never use a Matrix TABLE-child row ID as the target. Remove instead resolves the Favorite row under owner-only + current-Workspace authority first so stale/deleted targets remain removable.
-   [x] Serialize duplicate adds by the logical `(workspace, user, interpretationId, cellId)` identity and query for an existing row under that advisory lock. Make add and owner-scoped remove idempotent. Do not add a second Favorite identity component solely to simulate composite uniqueness.
-   [x] Ensure both generic runtime list/get and the dedicated Favorite list resolve owner-only access. Add negative tests proving user A cannot list/get/remove user B's Favorite in the same Workspace, including direct generic runtime-row requests.
-   [x] On cell/Structure aggregate deletion, clean up matching Favorites where the aggregate owns the lifecycle; keep list-time unavailable-target handling as a race/failure backstop.
-   [x] Exclude Favorites from template copy and anonymous projector.
-   [x] Add `Favorites` to the existing authenticated `StructureDetailTab` contract and tab panel, not a separate tab system.
-   [x] Add cell-menu Add/Remove actions and reuse `CustomizedDataGrid` directly for Favorites with `#`, Structure, Cell path/label, Status and Actions columns. Render the Cell/Location value as an accessible Link/Button in `renderCell` and make that the primary keyboard/navigation path; whole-row activation may be supplementary only. Remove is an explicit row action. Do not add a Favorites-specific grid wrapper.
-   [x] Define responsive column visibility for 390 px: combine Structure + Cell into one Location display, hide nonessential `#`, retain Actions, and permit only grid-internal horizontal scrolling if unavoidable.
-   [x] Add Jest tests for user isolation, manager-is-still-not-owner behavior, generic list/get isolation, Workspace isolation, duplicate race, same CellId in different Interpretations, wrong-workspace target, `runtimeMutation='deny'`, `workspaceCopy='exclude'`, stale/deleted targets, stale-target remove success + repeated-remove idempotence, cross-user stale-remove denial, cleanup rollback and no client user/workspace authority.
-   [x] Add Vitest for tab/menu/list behavior, TanStack invalidation, unavailable state and anonymous absence.

### Phase 10 — Generator-first canonical fixture

-   [x] Update Interpretation Network template/entity/widget source first.
-   [x] Update the product generator to create the revised canonical metahub/application configuration through supported authoring APIs.
-   [x] Extend fixture contract to require style-policy metadata, target-aware Workspace-setting behavior where represented, Favorite entity metadata, multiple-Material/Primary semantics and unchanged schema/template versions.
-   [x] Generate `tools/testing/e2e/.artifacts/generated-metahubs-interpretation-network-app-snapshot.json` through Playwright.
-   [x] Run contract and normalized drift checks against the generated artifact.
-   [x] Only after the generated artifact passes, replace the tracked `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` through the supported regeneration workflow.
-   [x] Never hand-edit the tracked snapshot.

### Phase 11 — Deep automated test system

-   [x] **Shared/type Vitest:** strict public DTOs, target-aware setting addresses, style policy, UUID v7 rules, public redaction and query-key factories.
-   [x] **Backend Jest:** public runtime resolver/projectors/routes, Workspace settings DDL/store/service, style policy enforcement, subtree copy, multi-Material aggregate, Favorite aggregate, RLS/isolation, concurrency and rollback.
-   [x] **Frontend Vitest:** public runtime dispatch, public query transport, cell-style controls, settings/delegation controls, template dialog, Primary Materials, Favorites tabs/menus/lists and real EN/RU resource coverage.
-   [x] **Fixture tests:** generator contract, fixture shape, drift, imported-snapshot parity and unchanged version assertions.
-   [x] **Primitive-reuse structural/component contract:** add an executable guard for the touched Interpretation Network surfaces so non-destructive dialogs import/use `StandardDialog`, destructive confirmations use `ConfirmDeleteDialog`, Favorites/list surfaces reuse `CustomizedDataGrid`, and new raw MUI `Dialog`/`DialogActions` or one-off DataGrid implementations fail the gate. Keep type-only `GridColDef`/locale imports allowed.
-   [x] **Negative security tests:** no client Workspace selection in public APIs; no public authenticated endpoint dependency; no raw persistence IDs/mutation metadata in public DTOs; no client-supplied Favorite user/Workspace; no cross-Workspace target; no same-Workspace cross-user Favorite list/get; no direct style-policy bypass. Every denied mutation test must assert durable state before === state after, not only status/error text: direct generic Matrix create/update/batch/delete attempts leave the Matrix unchanged, cross-user/cross-Workspace Favorite add/remove leaves lists unchanged, generic Favorite/Material writes leave records/attachments/Primary unchanged, and denied settings/style writes leave effective configuration unchanged.
-   [x] **Matrix aggregate positive tests:** create/edit/delete/move through the dedicated IN commands remain functional with Matrix `runtimeMutation='deny'`; edit proves server-computed axis-label fan-out plus touched-style-policy validation, delete proves server-side root/children checks and atomic Material/Primary/Favorite lifecycle cleanup, and the browser/client no longer sends physical Matrix child-row IDs as mutation authority.
-   [x] **Concurrency tests:** Workspace setting first-write/update/reset plus reversed target order; duplicate Favorite add; competing Primary Material updates; selected-branch template save against concurrent Matrix membership edits using the shared per-Interpretation lock.
-   [x] **Real PostgreSQL integration tests:** add focused Interpretation Network integration suites for RLS/Workspace isolation, advisory-lock races, optimistic conflicts, rollback and target-aware settings indexes. These suites may keep the repository's default `DATABASE_TEST_URL` skip behavior for ordinary unit runs, but the dedicated local-Supabase gate below must inject a real loopback `DATABASE_TEST_URL`, select the exact suites and fail if zero tests execute or the suites are skipped.
-   [x] **Performance oracles:** split performance evidence by failure mode instead of one wall-clock gate: query-count regression for N+1 Material/Favorite resolution, DDL/index assertions and real-PostgreSQL `EXPLAIN` where index use must be proved, bounded-row/payload contract tests for public projection, and Vitest for TanStack query-key/cache partitioning. Do not use wall-clock timing as the primary deterministic PASS oracle.

### Phase 12 — Minimal-Supabase Playwright and visual QA

-   [x] Extend `runInterpretationNetworkVerificationLocalSupabase.mjs`; keep one lifecycle: `supabase:e2e:start:minimal` -> env -> doctor -> `build:e2e` -> fixture generation/contract/drift -> focused browser flows -> docs screenshots/checks -> guaranteed Supabase stop.
-   [x] Add a dedicated real-PostgreSQL Interpretation Network test step inside the same minimal-Supabase lifecycle, modeled on the existing `tools/testing/backend/localSupabaseEnv.mjs` / `run-applications-integration-local-supabase.mjs` pattern: derive the loopback `DATABASE_TEST_URL`, ensure platform migrations, run the exact new IN integration-suite paths, and fail on zero selected/executed or skipped DB suites.
-   [x] Make locale execution genuinely executable with the current Playwright project topology. The existing `en-light` / `ru-light` projects match only `specs/matrix/**/*.spec.ts`, so add focused Interpretation Network locale acceptance spec(s) under `specs/matrix/` (reusing existing provisioning/login/runtime helpers) and invoke them explicitly for both projects. The wrapper must fail if either locale project selects zero tests. Do not point `en-light` / `ru-light` at `specs/flows/interpretation-network-*.spec.ts` without changing `testMatch`.
-   [x] Keep dark-mode projects as additional coverage where valuable, but EN and RU light Interpretation Network acceptance are mandatory gates and must exercise real localized UI/error/empty states, not only project metadata.
-   [x] Add a public-runtime focused flow covering anonymous UUID, direct alias, canonical alias, Matrix/Materials reading, Primary direct-open, non-enumerating unavailable states and DOM absence of mutations/Favorites/Settings/Access.
-   [x] Capture/inspect network traffic to prove public UI does not call authenticated runtime row/template/Favorite/settings APIs and does not require authenticated credentials.
-   [x] Add style-policy flow proving metahub default, Application override, explicit Workspace delegation, locked state, control omission and direct-API rejection.
-   [x] Extend template flow for whole Structure and selected branch, no sibling/ancestor leakage, root rebase and Material/Primary copy semantics.
-   [x] Add full Material browser lifecycle: create a secondary Material -> edit it -> set Primary -> replace Primary -> clear Primary -> delete a secondary -> delete the Primary, with Back-to-materials/focus restoration and final persisted attachment/Primary state checks after reload.
-   [x] Add Favorite flow for add/remove/list/navigate, second-user isolation, Workspace isolation and unavailable/deleted target handling. Use separate Playwright browser contexts for distinct authenticated users so cookies/storage/session state cannot leak across the isolation proof.
-   [x] Add keyboard/focus checks for Tabs, menus, dialogs and Back navigation.
-   [x] Run real EN and RU resources through the explicit `en-light` / `ru-light` project gate and assert localized labels/errors/empty states rather than only resource-file existence.
-   [x] Reuse the existing Runtime UX helpers from `tools/testing/e2e/support/browser/runtimeUx.ts`: `expectNoTechnicalLeakage({ checkUuidSubstrings: true })` on normal user surfaces, `expectNoDataGridTechnicalLeakage({ checkUuidSubstrings: true })` on every relevant grid, `expectSemanticFieldControls` on Cell Edit / Save-as-Template and other semantic forms, `expectLocalizedValidation` for EN/RU editable flows, `expectRuntimeUxViewportMatrix` plus `expectNoPageHorizontalOverflow` for canonical responsive surfaces, and `expectDataGridHorizontalScrollConstrained` for Favorites/Material grids. Do not replace these with one-off assertions when the helper already expresses the invariant.
-   [x] Run 1920x1080, 768x1024 and 390x844 browser proofs through the existing viewport helper/oracles; page-level horizontal overflow is a hard failure and grid-internal scrolling is allowed only on the named grid container.
-   [x] Generate screenshots for all key states and visually inspect the actual PNGs; do not accept screenshot generation alone as UX proof.
-   [x] Keep GitBook only the canonical workflow images, while CI assertions cover the complete locale/viewport matrix and provenance tracks the evidence.

Required visual states include:

-   anonymous public Matrix with no mutation UI;
-   restrictive style policy editor;
-   Application/Workspace delegation state;
-   selected-branch save dialog;
-   multiple-Material list with Primary marker;
-   Primary Material detail with Back-to-materials;
-   Favorites list;
-   Favorite unavailable/empty state.

Map new visual evidence into the existing screenshot manifest instead of creating parallel screenshot infrastructure:

-   `overview` / `docs/<locale>/interpretation-network/README.md`: add workflow steps for anonymous public Matrix and Primary read-only navigation, including zero mutation UI;
-   `create-and-publish` / `create-and-publish.md`: add workflow steps proving public enablement and direct/canonical alias entry from the publication/application flow;
-   `application-settings` / `application-settings.md`: add workflow steps for style policy, ordered allowed colors, Application override and Workspace delegation/locked states;
-   `workspace-and-matrix` / `workspace-and-matrix.md`: add workflow steps for Favorites tab, populated grid and responsive Location column behavior;
-   `cells-and-materials` / `cells-and-materials.md`: add workflow steps for restrictive style editor, multiple Materials, Primary badge/detail and Back-to-materials;
-   `templates` / `templates.md`: add workflow steps for Whole Structure versus Selected branch, readable selected path and include-Materials policy;
-   `troubleshooting` / `troubleshooting.md`: add workflow steps for locked/rejected policy edits and unavailable Favorite removal.

Extend each existing manifest item's `workflowStepIds` and provenance rather than adding a new manifest item unless a materially different GitBook page/state cannot be represented by one of these canonical pages. Any new item must declare EN/RU pages, required visible text, viewport requirements and provenance before its PNG is accepted.

### Phase 13 — README and GitBook documentation

-   [x] Update `packages/universo-react-apps-template-mui/README.md` and `README-RU.md`: public read-only Interpretation Network runtime, policy-driven colors instead of fixed-count presets, branch templates, multiple/Primary Materials, Favorites and package isolation.
-   [x] Update `packages/universo-react-applications-backend/README.md` / `README-RU.md` where public Dashboard projection, target-aware Workspace settings and aggregate security boundaries are documented.
-   [x] Update `tools/testing/e2e/README.md` / `README-RU.md` for new focused flows and the minimal-Supabase verification gate.
-   [x] Update `docs/en|ru/interpretation-network/README.md` for authenticated editor versus anonymous viewer.
-   [x] Update `create-and-publish.md` for public Dashboard publication and aliases.
-   [x] Update `application-settings.md` for style policy, Application overrides and explicit Workspace delegation.
-   [x] Update `cells-and-materials.md` for policy-driven styling, multiple Materials and Primary Material.
-   [x] Update `templates.md` for whole versus selected branch and copy semantics.
-   [x] Update `workspace-and-matrix.md` for authenticated Favorites.
-   [x] Update `troubleshooting.md` for locked policy, rejected direct edits, unavailable Favorites and public read-only behavior.
-   [x] Update `docs/en|ru/platform/public-applications-and-aliases.md` for public Dashboard support without changing generic alias semantics.
-   [x] Update `docs/en|ru/architecture/entity-backed-widgets.md` and `interpretation-network-data-model.md` for settings/data ownership and Favorites/Primary semantics.
-   [x] Keep EN/RU structure and links in sync; change `SUMMARY.md` only if new pages are added.
-   [x] Regenerate documentation screenshots only through the existing Playwright screenshot generator and update provenance/drift baselines from real rendered UI.

### Phase 14 — Final quality gates and closeout

-   [x] Format touched TS/TSX/Markdown files and run focused package lint.
-   [x] Run focused builds/typechecks for `types`, `applications-backend`, `applications-frontend`, `apps-template-mui`, and metahub packages touched by template/settings work.
-   [x] Run all new/focused Jest and Vitest suites.
-   [x] Run `check:i18n-coverage`, `check:apps-template-isolation`, `check:runtime-ux-agents`, `check:mui-v9-policy`, package-naming and other touched-boundary repository guards.
-   [x] Use `test:e2e:interpretation-network:verify:local-supabase` as the single final end-to-end orchestration gate for the minimal-Supabase lifecycle. It must include fixture generation/contract/drift, required real-PostgreSQL IN suites, focused browser flows, locale projects, documentation screenshots/checks and guaranteed cleanup. Keep individual fixture/docs/browser commands available as focused diagnostics, but do not require a redundant second execution after the wrapper has already passed the same checks.
-   [x] Visually inspect the screenshots produced by that orchestration gate and record the exact evidence/provenance.
-   [x] Run root `build:e2e`/full root build when required after focused checks to prove workspace consistency.
-   [x] Run Thermos/autoreview quality gate for the final implementation diff and fix all CRITICAL/HIGH findings before completion; scoped correctness/security and runtime-UX reviews found no actionable issue. The full local Autoreview ended UNAVAILABLE/BUNDLE_TOO_LARGE, so it is not a PASS.
-   [x] Run OntoIndex `gn_verify_diff`/detect-changes and reconcile the reported blast radius with the planned scope; its dirty graph is stale/degraded, so the result is reported as inventory-only if no graph-backed verdict is available.
-   [x] Verify explicitly that no schema-version or metahub-template-version value changed and no test-database or metahub compatibility shim was added; confirm `/api/v1` accepts canonical target-aware policy addresses and rejects retired `allowedKeys/lockedKeys` aliases.
-   [x] Treat the real production example `https://universo.pro/a/suzdal` as post-deploy evidence: if deployment/live-host access is part of the delivery, smoke the exact URL anonymously after deployment and record route/canonical behavior. If production deployment is outside the implementation scope, record that evidence as external/INCOMPLETE rather than converting local alias E2E into a production PASS. Local canonical/UUID/secondary-alias route tests pass; no deployment or production-host smoke was performed.
-   [x] Record exact PASS/FAIL/INCOMPLETE evidence in Memory Bank progress/tasks without converting unavailable browser/runtime evidence into PASS.

## Illustrative Secure Code Patterns

These snippets demonstrate intended boundaries. Exact names should follow the source discovered during implementation.

### Strict public Dashboard placement

```ts
const publicPlacementBase = {
    instanceKey: layoutInstanceKeySchema,
    zone: applicationLayoutZoneSchema,
    sortOrder: z.number().int(),
    parentInstanceKey: layoutInstanceKeySchema.nullable(),
    slotKey: z.string().trim().min(1).max(64).nullable()
}

export const publicDashboardPlacementSchema = z.discriminatedUnion('widgetKey', [
    z
        .object({
            ...publicPlacementBase,
            widgetKey: z.literal('languageSwitcher'),
            config: publicLanguageSwitcherConfigSchema
        })
        .strict(),
    z
        .object({
            ...publicPlacementBase,
            widgetKey: z.literal('menuWidget'),
            config: publicMenuWidgetConfigSchema,
            runtimeData: publicMenuWidgetRuntimeDataSchema
        })
        .strict(),
    z
        .object({
            ...publicPlacementBase,
            widgetKey: z.literal('interpretationNetworkWorkspace'),
            config: publicInterpretationNetworkPlacementConfigSchema,
            dataState: z.literal('deferred')
        })
        .strict()
    // Add only audited public widget variants.
])
```

Project config/runtimeData by the matching widget-specific schema before constructing this DTO. Never spread an authenticated effective-layout object into the public response and never add a catch-all widget variant.

### Target-aware Workspace setting upsert

```ts
const target = normalizeWorkspaceSettingTarget(input.address.target)
const resolvedTarget = await resolveWorkspaceSettingPersistenceTarget(tx, {
    applicationId,
    workspaceId,
    runtimeTarget,
    target
})
const lockKey = [schemaName, workspaceId, resolvedTarget.kind, resolvedTarget.ownerId, resolvedTarget.key, input.address.key].join(':')
await acquireAdvisoryLock(tx, lockKey)

const rows = await tx.query<WorkspaceSettingRow>(
    `INSERT INTO ${settingsTable}
        (id, workspace_id, target_kind, target_owner_id, target_key, key, value, _upl_version)
     VALUES (public.uuid_generate_v7(), $1, $2, $3, $4, $5, $6::jsonb, 1)
     ON CONFLICT DO NOTHING
     RETURNING id, _upl_version AS "version"`,
    [workspaceId, resolvedTarget.kind, resolvedTarget.ownerId, resolvedTarget.key, input.address.key, JSON.stringify(parsedValue)]
)

if (rows.length === 0) {
    throw new WorkspaceSettingConflictError()
}
```

Actual update/reset paths should use explicit expected-version predicates and `RETURNING`, not a blind upsert that can erase concurrent edits.

### Touched-field style validation

```ts
export function assertCellStylePatchAllowed(patch: Record<string, unknown>, policy: InterpretationNetworkCellStylePolicy): void {
    for (const field of CELL_STYLE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(patch, field.column)) continue
        if (!policy.editable[field.capability]) throw new StylePolicyError(field.capability)

        if (field.kind === 'color') {
            const color = normalizeHexColor(patch[field.column])
            if (!policy.allowCustomColors && !policy.allowedColors.includes(color)) {
                throw new StylePolicyError(field.capability)
            }
        }
    }
}
```

### Server-derived subtree copy

```ts
const rows = await lockSourceMatrix(tx, sourceStructureId)
const sourceRoot = requireCell(rows, input.rootCellId)
const subtree = collectDescendants(rows, sourceRoot.cellId)

const rebased = subtree.map((row) => (row.cellId === sourceRoot.cellId ? { ...row, parentCellId: null } : row))

assertSingleRootHierarchy(rebased)
return copyMatrixRowsWithFreshUuidV7(rebased)
```

The client never supplies `subtree` or a list of descendant IDs.

### Server-owned Favorite command

```ts
const actorUserId = requireAuthenticatedUser(ctx)
const workspaceId = requireCurrentWorkspace(ctx)
const target = await resolveMatrixCellTarget(tx, {
    workspaceId,
    interpretationId: input.interpretationId,
    cellId: input.cellId
})

if (!target) throw new FavoriteTargetUnavailableError()

await acquireFavoriteLock(tx, [workspaceId, actorUserId, target.interpretationId, target.cellId])
await insertFavoriteIfAbsent(tx, {
    workspaceId,
    actorUserId,
    interpretationId: target.interpretationId,
    cellId: target.cellId
})
```

No request body contains `userId`, `workspaceId`, table name or physical Matrix row ID.

## Acceptance Traceability

### R1 — Anonymous public read-only application

-   [x] public Dashboard DTO contains no persistence IDs/mutation metadata;
-   [x] server selects public Workspace; client cannot choose one;
-   [x] the same normalized public target is represented in bootstrap, specialized endpoint validation and TanStack query keys;
-   [x] unsupported active widgets fail public readiness before generic datasource reads; specialized Interpretation Network data is never eagerly resolved through the authenticated generic runtime-data path;
-   [x] specialized IN reads run under anonymous RLS/public transaction;
-   [x] anonymous navigation exposes only scoped opaque public-local handles/semantic context; authenticated Interpretation row IDs, Matrix TABLE-child row IDs and other persistence identifiers are absent from the public DTO and cannot be reused as public mutation handles;
-   [x] specialized reads are covered by the public runtime rate limiter and bounded result caps;
-   [x] no authenticated IN transport is called by public UI;
-   [x] mutation/admin UI is absent from DOM;
-   [x] private/unavailable states remain non-enumerating;
-   [x] EN/RU and responsive/keyboard proof passes.

### R2 — `/a/suzdal` and aliases

-   [x] UUID route remains UUID;
-   [x] direct alias remains requested alias;
-   [x] canonical secondary alias redirects/resolves to primary;
-   [x] all three work for public Dashboard/Interpretation Network, not only marketing-page;
-   [x] local/minimal-Supabase E2E proves the route semantics, while the exact production `https://universo.pro/a/suzdal` smoke is required only after deployment/live-host access is available; until then production-host behavior remains explicitly INCOMPLETE rather than inferred from local proof. Local verification passed on 2026-10-24.

### R3 — Style policy and three-layer settings

-   [x] canonical metahub policy;
-   [x] Application materialized override;
-   [x] explicit target-aware Workspace delegation only;
-   [x] inherited/locked/reset behavior;
-   [x] multi-address set/reset batches resolve targets then acquire locks in canonical tuple order, and materialized-layout replacement/deletion cleans stale widget-target rows server-side;
-   [x] Workspace copy rewrites global target ownership to the target Workspace and re-resolves widget `instanceKey` against the current Application-scoped layout. The validated widget owner may remain the same; stale owners are skipped;
-   [x] generic Matrix child writes are denied while dedicated create/edit/delete/move commands remain functional and enforce effective style policy;
-   [x] older persisted style remains renderable;
-   [x] free-form/preset/capability UI exactly follows effective policy.

### R4 — Selected branch template

-   [x] whole Structure remains supported;
-   [x] selected branch includes root + descendants only;
-   [x] selected root is rebased;
-   [x] no ancestors/siblings leak;
-   [x] save/copy and every Matrix membership-changing command share one per-Interpretation advisory-lock domain so concurrent insert/move/delete cannot produce a mixed subtree snapshot;
-   [x] `independentRows` rejects branch scope;
-   [x] selected path is human-readable in UI;
-   [x] Materials/Primary copy policy is deterministic.

### R5 — Multiple and Primary Materials

-   [x] multiple Materials attach to one CellId;
-   [x] zero or one Primary;
-   [x] ordinary create does not replace Primary;
-   [x] dedicated Material metadata/body edit remains functional with generic Material update denied, uses expectedVersion, and cannot reassign CellId/TemplateOwnerId/Primary/system fields;
-   [x] explicit set/replace/clear;
-   [x] deleting Primary clears pointer atomically;
-   [x] direct-open and Back-to-materials work;
-   [x] template copy/delete handles all secondaries and remaps Primary by Material ID only.

### R6 — Favorites

-   [x] authenticated Add/Remove in cell mini-menu;
-   [x] Favorites peer tab/list/navigation;
-   [x] user and Workspace are server-owned;
-   [x] existing server-generated Interpretation ID + semantic CellId target is validated in current Workspace without storing a Matrix TABLE-child row ID;
-   [x] duplicate add is race-safe/idempotent;
-   [x] second-user and cross-Workspace isolation;
-   [x] generic runtime list/get and dedicated Favorite APIs both enforce owner-only access, so user A cannot read or remove user B's Favorite in the same Workspace;
-   [x] Workspace copy excludes Favorite records;
-   [x] deleted/inaccessible targets are safe/localized and the owner can remove a stale Favorite without the target cell still existing; repeated remove is idempotent and cross-user stale remove is denied;
-   [x] no anonymous Favorites UI/API projection;
-   [x] templates do not copy Favorites.

## Potential Challenges And Mitigations

### Renderer identity refactor has cross-template blast radius

The current `RuntimePlacement` requires persistence UUIDs. Separating renderer identity can affect Dashboard widgets outside Interpretation Network.

Mitigation:

-   impact-check exact mapper/renderer symbols before edits;
-   introduce a pure renderer contract and an authenticated persistence-scope wrapper rather than editing every widget independently;
-   keep cross-template Dashboard Vitest and Playwright canaries in the gate.

### Target-aware settings can accidentally become a second settings system

Mitigation:

-   one `WorkspaceSettingAddress` contract;
-   one `_app_workspace_settings` table;
-   one allow/lock/effective resolver;
-   existing global settings use the same address model;
-   unsupported target kinds reject fail-closed.

### Public Interpretation Network payload can become large

Mitigation:

-   specialized data stays outside public bootstrap;
-   use bounded, deterministic reads and lazy secondary requests where needed;
-   prevent client-selected unbounded limits;
-   batch Materials/Favorite-like relation resolution and add query-count/payload regression tests.

### Multi-Material support changes several old one-to-one assumptions at once

Mitigation:

-   land canonical aggregate invariants before UI;
-   separate Material-ID remap and Cell-ID remap maps;
-   cover save, instantiate, delete, Primary delete, Structure delete and rollback in one backend test matrix.

### Favorite uniqueness is composite while generic component uniqueness is scalar

Mitigation:

-   the normal Favorite entity row ID remains UUID v7; no parallel Favorite identity field is introduced solely for composite uniqueness;
-   service-level advisory serialization over `(workspace, user, interpretationId, cellId)` plus an existence check under that lock makes add idempotent when all writes are forced through the trusted Favorite command;
-   generic runtime writes stay denied and owner-only runtime read access prevents same-Workspace cross-user disclosure;
-   `workspaceCopy='exclude'` at metadata level;
-   idempotent commands and concurrency tests.

### Existing raw Dialog composition is technical debt

Mitigation:

-   do not copy it into new flows;
-   migrate the touched Save-as-Template, template-detail and Cell Edit dialog surfaces to `StandardDialog`;
-   keep destructive confirmations on `ConfirmDeleteDialog`;
-   add focused Vitest/Playwright keyboard, focus-return and narrow-screen coverage for each migrated dialog.

## Dependencies And Coordination

-   Public DTO and renderer-identity refactor must land before public Interpretation Network UI.
-   Target-aware Workspace setting infrastructure must land before Workspace style-policy delegation UI.
-   Multi-Material backend invariants must land before branch-template Material copying and Primary UI.
-   Favorite entity metadata must be in the canonical template/generator before imported-snapshot E2E can prove the feature.
-   Fixture regeneration must happen after canonical template/settings/entity changes and before final public/browser/docs proof.
-   Documentation screenshots must be generated after UI stabilizes and inspected before docs drift baselines are accepted.

## Non-Goals

-   Guest/session Favorites.
-   Shared/team Favorites.
-   Public editing or public template management.
-   A new alias/short-link mechanism for Interpretation Network.
-   Live metahub reads at application runtime.
-   IPFS/IPNS/federation from historical Suz-Dal concepts.
-   A new built-in platform Entity Type solely for Favorites or Interpretation Network settings.
-   Legacy compatibility for the disposable test database.
-   Database schema-version or metahub-template-version increments.

## Plan QA Review Result

The completed PLAN QA passes are **PASS for implementation readiness** after incorporating the traceability, backend/security, concurrency, runtime-UX and final independent-review corrections found during review. The final reviewer additionally caught the Matrix/Material generic-write cutover gap, target-aware Workspace-copy remapping and stale-Favorite removal contradiction; all are now explicit implementation/test requirements. The production-host example remains a post-deploy evidence boundary and must not be reported as verified before it is actually reachable from the delivery environment.

-   R1/R2 public runtime and aliases: PASS for architecture/local acceptance after target propagation, pre-read allowlisting, strict per-widget schemas, deterministic unsupported-placement handling, rate-limiter wiring and a minimal identity model were made explicit. Anonymous navigation uses scoped public-local handles instead of adding persistent Structure/Interpretation/Material identity fields. The exact `https://universo.pro/a/suzdal` host remains post-deploy evidence until directly smoked.
-   R3-R6 backend/data model: PASS after layout-scoped Workspace-setting identity, canonical batch lock ordering, stale-target cleanup and copy-time target remapping; one effective-widget resolver; complete trusted Matrix create/edit/delete/move and Material create/edit/Primary/delete command surfaces behind existing `runtimeMutation='deny'`; shared Matrix snapshot and Material/Primary concurrency domains; strict branch scope; and owner-isolated Interpretation-ID+CellId Favorites with stale-target owner removal were fixed. No new `aggregate-only` enum value is required.
-   runtime UX: PASS after adding full Cell Edit and template-detail dialog contracts, explicit reuse of `MatrixSettingsPanel` / `MatrixSettingsRows` / `SaveSettingsButton`, accessible Favorites navigation inside existing `CustomizedDataGrid`, deterministic EN/RU projects, existing Runtime UX helper oracles and screenshot-manifest mapping.
-   requirements/research traceability: PASS after removing the invented 1..32/non-empty palette restriction, removing unproven persistent semantic-key additions, and preserving the research boundary between repository/local proof and unverified production deployment behavior.

Implementation must preserve all of these gates:

-   no raw IDs/JSON/internal error text on normal surfaces;
-   public mutations/admin affordances have DOM count zero;
-   settings visibly distinguish inherited, delegated and locked values;
-   branch save uses readable path and cannot submit without valid root;
-   Primary Material semantics are explicit and reversible;
-   Favorites extend the existing accessible tab system;
-   new/touched dialogs and lists reuse canonical primitives;
-   Application style/delegation controls extend the existing Matrix settings composition instead of creating a parallel settings UI;
-   Runtime UX E2E reuses `expectNoTechnicalLeakage`, `expectSemanticFieldControls`, `expectLocalizedValidation`, `expectRuntimeUxViewportMatrix` and `expectNoPageHorizontalOverflow` where applicable;
-   EN/RU resources are real and complete;
-   keyboard/focus restoration is tested;
-   desktop/tablet/mobile have no page-level horizontal overflow;
-   screenshots are visually inspected rather than treated as proof by existence alone.

This QA updated only the planning artifact. No product implementation, fixture regeneration, database reset, local Supabase lifecycle or browser execution was performed as part of the plan review itself.

## Approval Boundary

This boundary applied when the plan was drafted. The user subsequently explicitly authorized IMPLEMENT, so execution proceeded; the implementation evidence and remaining external/tool limitations are recorded below.
At PLAN delivery this artifact changed only the planning record; product implementation, fixture regeneration and verification were deferred. The user later authorized IMPLEMENT, and the execution evidence is recorded in the closeout below.

## Implementation Closeout — 2026-10-24

The implementation plan and its local acceptance criteria are complete. The latest `pnpm run test:e2e:interpretation-network:verify:local-supabase` run exited successfully; machine-readable evidence is `tools/testing/e2e/.artifacts/interpretation-network-verification/2026-10-24T00-33-18-777Z/manifest.json` (`status: passed`). The gate passed the root build (36/36 tasks), fixture regeneration/contract/drift checks, PostgreSQL integration (5 suites, 29 passed, 0 skipped), Chromium core flows (21/21), EN and RU locale runs (3/3 each), GitBook screenshot flow (2/2), and the documentation/link/assets/isolation guards (115 EN/RU page pairs).

The focused Applications Backend unit run passed 27 suites / 458 tests, and the apps-template runtime primitive-reuse Vitest passed 15/15. The final test typecheck (`pnpm exec tsc --noEmit -p packages/universo-react-applications-backend/tsconfig.test.json`) passed with no diagnostics; seven focused suites covering the final test-contract fixes passed 53/53. The PostgreSQL plan test captures the exact SQL and parameters emitted by the production workspace-settings lookup, then confirms `_app_workspace_settings_target_active_uidx` is selected after `ANALYZE` with 2,048 representative target addresses. A two-connection Favorite test verifies real PostgreSQL advisory-lock blocking and that concurrent duplicate adds create one row. Workspace-settings integration tests are split into cohesive suites. Deterministic query-count assertions cover one-versus-25 Favorites and a 20-material page.

Actual browser PNGs were inspected from the completed run: anonymous EN/RU Matrix and Primary Material detail, mobile localized validation, Favorites at the initial and scrolled mobile positions, unavailable Favorite removal, selected-branch template dialog at 1920×1080, policy editor at 390×844, Application style-policy settings at 1920×1080, and the multi-Material Primary marker/list. The UI stayed within the viewport, exposed no anonymous edit/admin controls, localized the visible UI errors, and showed the expected Primary and Favorite states.

`CURRENT_SCHEMA_SNAPSHOT_VERSION` remains `2`, the Interpretation Network template seed remains `2.29.0`, and the metahub template remains `0.1.0`; the fresh fixture contract/import checks passed without a compatibility shim. Workspace-settings DDL is validated for clean schema creation and re-run. An in-place migration from an older table shape is explicitly outside the supported target because the test database is reset and the user prohibited legacy compatibility. Autoreview is `UNAVAILABLE/BUNDLE_TOO_LARGE` on the accumulated dirty-worktree bundle and is not reported as PASS. OntoIndex `gn_verify_diff` returned `PASS` for the explicit 14-file closeout inventory and executed-test allowlist, with no unexpected paths/symbols or missing tests; its scan is capped at 200 files and the commit-based graph is stale/degraded, so this is not graph-backed impact proof for the full dirty tree. The full package-wide apps-template Vitest run remains incomplete under worker resource pressure; the focused feature suite and full build passed. The production URL `https://universo.pro/a/suzdal` remains `INCOMPLETE` pending deployment/live-host access; local route behavior passed. The gate stopped the minimal local Supabase profile. No staging or commit changes were made.
