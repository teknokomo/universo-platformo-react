# Plan: Application Workspaces, Public Access, And Per-Workspace Limits

> **Date**: 2026-03-19
> **Mode**: PLAN
> **Status**: DRAFT FOR DISCUSSION
> **Complexity**: Level 4 (Major / cross-cutting)
> **Scope**: applications system schema, runtime schema generation, runtime CRUD, access model, public join/leave UX, per-workspace limits, tests, and documentation

---

## Overview

This plan introduces a first-class **application workspace** model for dynamic application runtime schemas.
The goal is to isolate user data safely inside each application, support future workspace sharing, preserve publication-driven schema sync, and add a clean public-application onboarding flow.

The plan intentionally treats workspaces as a **runtime subsystem**, not as a UI-only convention.
When enabled for an application, workspaces become part of the generated application schema and remain stable across all future schema syncs.

The target behavior is:

1. An application may be **closed** or **public** at creation time.
2. An application may have **workspaces enabled** at creation time.
3. These options become **immutable after creation**.
4. If workspaces are enabled, each member gets a default personal workspace named `Main`.
5. Runtime business rows are scoped to a workspace and are invisible outside the allowed workspace set.
6. Public applications expose a controlled **join** and **leave** flow.
7. Per-catalog row limits are enforced **per workspace**.
8. Future sharing is supported by a proper workspace role system from day one.
9. Workspace-aware behavior must be correct for create, copy, first sync, member add, member remove, join, and leave flows.

Fresh database recreation is allowed.
No legacy preservation is required.
No template version bump is required.

---

## Additional Findings From The Extra Analysis

### Verified Current Repository / Database Risks

1. **Public apps are exposed without real membership state.**
   - `applications-backend` list mapping currently synthesizes role `member` for visible public apps even when the user has no membership row.
   - This will conflict with an explicit public join flow and will produce incorrect UI states.

2. **The current list SQL still filters out non-member public apps.**
   - `listApplications(...)` currently uses `membership.user_id IS NOT NULL` unless `showAll=true`.
   - This means true public discovery is not implemented yet even though RLS and response mapping already hint at it.

3. **Application access guards are membership-only for non-admins.**
   - `ensureApplicationAccess(...)` denies non-members outright.
   - Public preview/join flows therefore need a guard split instead of trying to stretch the current member-only guard.

4. **Application member RLS is currently too narrow for real member administration.**
   - In `UP-test`, `applications.rel_application_users` has an `ALL` policy that only allows `user_id = auth.uid()` or superuser.
   - Application owners/admins are therefore not properly represented in DB-level access rules for member management.

5. **Application policies are too coarse-grained.**
   - `cat_applications`, `cat_connectors`, and `rel_application_users` currently use broad `ALL` policies.
   - This makes future public join/leave and member/workspace management harder to reason about than separate `SELECT` / `INSERT` / `UPDATE` / `DELETE` policies.

6. **Member invitation currently accepts `owner` on create.**
   - The route schema for `POST /applications/:applicationId/members` allows `owner`.
   - That can create multiple owners and does not match a controlled ownership-transfer model.

7. **Runtime CRUD has no workspace predicate.**
   - The runtime active-row filter only checks `_upl_deleted` and `_app_deleted`.
   - No tenant/workspace boundary exists in list, read, create, update, delete, copy, or tabular child CRUD.

8. **Runtime query keys are not future-ready for workspace state.**
   - Current query keys mostly vary by `applicationId`, `catalogId`, `rowId`, and pagination.
   - Public join state, default workspace identity, and workspace-limited quota metadata are not represented.

9. **Current row limits only cover TABLE child cardinality.**
   - Existing validation handles `minRows` / `maxRows` inside TABLE attributes.
   - There is no top-level per-catalog per-workspace quota model.

10. **Current application create/edit/copy UI does not reflect the required immutable options.**
   - Create dialog has no tabs.
   - `isPublic` is currently updateable after creation.
   - There is no `workspacesEnabled` option.

11. **There is no application settings area for runtime limits yet.**
   - The list view has a “Control Panel” navigation path, but there is no dedicated application settings contract covering limits.

12. **Leave/unsubscribe must not soft-delete millions of rows one by one.**
    - A workspace-level tombstone model will be much safer and more performant than cascading updates across all business tables.

13. **Admin member removal and self-leave must converge to the same workspace lifecycle rule.**
    - If a member loses access to a workspace-enabled app, their personal workspace must not remain active and orphaned.

14. **Copy flow needs explicit workspace bootstrap rules.**
    - If an application is copied with access rights and later receives its first schema sync, all copied members must receive their default personal workspaces.
    - If schema creation is triggered as part of the copy workflow, the same bootstrap must happen in that first sync transaction.

15. **Current release-bundle schema lineage does not know about workspace runtime infrastructure yet.**
    - `applicationReleaseBundle.ts` builds schema snapshots only from publication-derived entities.
    - `applicationSyncRoutes.ts` compares stored `schema_snapshot` against bundle base snapshots during incremental apply.
    - If workspace-enabled runtime columns/tables are added outside the canonical snapshot contract, release install and incremental sync will drift semantically even when DDL succeeds.

16. **Workspace session context must respect the repository executor tier model.**
    - Request-scoped RLS executors use one pinned connection and can safely carry transaction-local `set_config(...)` context.
    - Pool executors acquire connections per query, so workspace GUC-based enforcement must never rely on pool executors outside an explicit transaction.
    - The plan must therefore treat explicit SQL predicates as mandatory and transaction-local workspace context as an optional DB-enforcement amplifier, not the only guard.

---

## Architecture Decisions

### 1. Workspaces Are A Runtime Subsystem

When `workspacesEnabled = true`, the generated runtime schema must include dedicated workspace metadata tables and policies.
This is not optional UI metadata.
It is structural runtime infrastructure.

### 2. Two Access Layers Are Required

The design must keep two separate layers:

1. **Application membership**
   - Stored in `applications.rel_application_users`
   - Governs who can enter an application at all
   - Roles like `owner`, `admin`, `editor`, `member`

2. **Workspace membership / role**
   - Stored inside each application runtime schema
   - Governs which workspaces and rows the user may access
   - Supports future sharing safely

### 3. Public Applications Default To Workspaces In V1

For V1, public applications should still guide owners toward isolated data by default.
The final product decision is:

- selecting `Public` auto-enables `workspacesEnabled` in the create UI
- the owner may still disable workspace mode explicitly
- the UI must show a warning when `Public` is selected while workspace mode is off
- the backend must persist the explicit choice without silently forcing the flag back on

### 4. Workspace Deletion Must Be Tombstone-Based

When a user leaves a public app, their workspace should be soft-deleted at the workspace level.
Rows remain in business tables with their `workspace_id`, but they become inaccessible because the workspace is archived/deleted.

This avoids:

- full-table mass updates
- long locks
- expensive cascades
- partial deletion failures

### 5. Workspace Scope Applies To Mutable Business Data

The first release should attach `workspace_id` to:

1. Top-level runtime **catalog tables**
2. Runtime **TABLE child tables**

Do not attach it to:

1. `_app_*` metadata tables
2. layouts / widgets / settings metadata
3. enumeration and set value-definition tables
4. connector metadata in the platform schema

If writable runtime relation entities are introduced later, they should also become workspace-scoped.

### 6. Visibility And Workspace Flags Must Be Immutable

After creation:

- `is_public` must not change
- `workspaces_enabled` must not change

The update API should reject changes explicitly instead of silently ignoring them.

### 7. Sync Must Preserve Workspace Infrastructure

Workspace support is not derived only from the publication snapshot.
It is also derived from the application’s immutable creation parameters.

Therefore the runtime sync engine must:

1. always re-create / preserve workspace infrastructure when enabled
2. add workspace-aware columns/policies to newly introduced business tables
3. never remove workspace infrastructure on subsequent publication updates

### 8. Canonical Schema Lineage Must Include Workspace Mode

If workspaces affect generated runtime DDL, the canonical application schema lineage must also reflect that fact.
Otherwise:

- `schema_snapshot`
- release bundle baseline snapshots
- incremental bundle base snapshots
- migration audit metadata

will describe a different schema contract than the one actually installed.

The safer target is:

1. the canonical application schema snapshot includes reserved workspace infrastructure when `workspaces_enabled = true`
2. generated business-table snapshots include workspace-aware columns where applicable
3. release bundle validation and sync comparisons use the same canonical contract

If full snapshot extension proves too invasive, the fallback must still add an explicit auxiliary runtime-contract fingerprint for workspace mode and validate it during sync.

### 9. Workspace Context Must Follow The Executor Boundary Rules

Workspace filtering should be enforced in layers:

1. explicit SQL predicates in routes/stores
2. transaction-local workspace context for DB policies where useful
3. RLS / policy checks on runtime business tables

Do not rely on connection-local workspace state on pool executors outside an explicit transaction.
This repository already distinguishes pinned request executors from per-query pool executors, and the workspace design must stay compatible with that rule.

---

## Target Data Model

### A. System Schema: `applications`

Extend `applications.cat_applications` with:

- `workspaces_enabled boolean not null default false`
- optional future-safe state field only if needed later:
  - `public_join_mode` is not required in V1

Keep existing:

- `is_public`
- `schema_name`
- `schema_snapshot`
- `installed_release_metadata`

Do not create a parallel visibility enum unless there is a strong technical reason.
The existing `is_public` field is sufficient for V1.

### B. Runtime Schema: New Internal Workspace Tables

For workspace-enabled applications, create these runtime tables:

1. `_app_workspaces`
   - `id uuid primary key`
   - `codename varchar(...) not null`
   - `name jsonb not null`
   - `workspace_type varchar(...) not null default 'personal'`
   - `personal_user_id uuid null`
   - `status varchar(...) not null default 'active'`
   - standard `_upl_*` and `_app_*` columns

2. `_app_workspace_roles`
   - role definitions for the application runtime
   - seed at least codename `owner` with VLC name `Owner / Владелец`
   - seed at least codename `member` with VLC name `Member / Участник`
   - optionally also `manager` / `editor` if future sharing needs it soon

3. `_app_workspace_user_roles`
   - `workspace_id`
   - `user_id`
   - `role_id`
   - `is_default_workspace boolean not null default false`
   - standard lifecycle columns

4. `_app_workspace_limits`
   - `object_id uuid not null` referencing `_app_objects.id`
   - `max_rows integer null`
   - standard lifecycle columns
   - one active row per catalog object

5. Optional helper view or function for enforcement
   - only if it reduces repeated policy SQL safely

All new identifiers in these tables must use UUID v7.

### B1. Required Unique Active Constraints

Add partial uniqueness so idempotent bootstrap and join flows stay safe:

1. one active default workspace relation per user:
   - unique on `_app_workspace_user_roles(user_id)` where `is_default_workspace = true` and row is active
2. one active role assignment per `(workspace_id, user_id, role_id)`
3. one active personal workspace per `(workspace_type, personal_user_id)` when `workspace_type = 'personal'`
4. one active limit row per `object_id`

### C. Runtime Business Tables

For each generated catalog table:

- add `workspace_id uuid not null`
- add FK to `_app_workspaces(id)`
- add index optimized for active-row workspace reads

For each generated TABLE child table:

- add `workspace_id uuid not null`
- add FK to `_app_workspaces(id)`
- enforce parent row workspace consistency during writes

### D. Recommended Index Pattern

For every workspace-scoped top-level catalog table:

```sql
create index if not exists cat_products_workspace_active_idx
    on app_xxxxx.cat_products (workspace_id, _upl_deleted, _app_deleted, _upl_created_at desc);
```

For every TABLE child table:

```sql
create index if not exists tbl_order_items_workspace_parent_active_idx
    on app_xxxxx.tbl_order_items (workspace_id, source_row_id, _upl_deleted, _app_deleted);
```

Reasoning:

- fast list reads by current workspace
- fast per-parent child reads
- predictable limit checks

### E. Tombstone Semantics

Workspace unsubscribe should update the workspace row:

- `status = 'archived'`
- `_upl_deleted = true`
- `_upl_deleted_at = now()`
- `_upl_deleted_by = <user>`

Business rows are not mass-updated.
Visibility relies on:

1. `workspace_id` predicate or policy
2. active workspace membership/policy
3. active workspace row

The same tombstone rule should be used for:

1. self-leave from a public app
2. admin removal of a member from a workspace-enabled app

This keeps workspace lifecycle consistent and avoids orphaned active personal workspaces.

---

## Security Model

### Application Layer

Application membership remains the gateway to the app.

Recommended role constraints:

- `owner`
  - immutable by normal member edit
  - only ownership transfer flow may create a new owner role
- `admin`
  - can manage app members and app settings
- `editor`
  - optional runtime management permissions if already used
- `member`
  - runtime usage only

### Workspace Layer

Recommended initial workspace roles:

- `owner`
  - automatically granted to the workspace creator
- `member`
  - future sharing baseline

If the team wants finer granularity early, add `manager`.
Do not over-model permissions in V1 if there is no UI yet.

### RLS Strategy

The recommended target is **DB-enforced workspace isolation** for runtime business tables.

Use:

1. request-scoped executor
2. explicit workspace resolution in the route/service layer
3. `SET LOCAL` / request-local context for the current user and workspace where needed
4. per-table RLS policies in runtime schemas

Recommended policy shape:

- separate `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies
- avoid one broad permissive `ALL` policy where semantics differ
- treat public app visibility separately from mutating membership logic

Illustrative policy sketch:

```sql
create policy cat_products_workspace_select
on app_xxxxx.cat_products
for select
using (
    _upl_deleted = false
    and _app_deleted = false
    and workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid
    and exists (
        select 1
        from app_xxxxx._app_workspaces w
        join app_xxxxx._app_workspace_user_roles wur on wur.workspace_id = w.id
        join app_xxxxx._app_workspace_roles wr on wr.id = wur.role_id
        where w.id = cat_products.workspace_id
          and w._upl_deleted = false
          and w._app_deleted = false
          and wur._upl_deleted = false
          and wur._app_deleted = false
          and wur.user_id = (select auth.uid())
    )
);
```

This should be paired with explicit SQL predicates in route/store code as a fail-closed application-level guard.
The RLS layer is the database boundary, not a replacement for careful SQL.

### Important RLS Refactor In `applications`

Before public join/leave is implemented, refactor `applications` policies into command-specific policies.

At minimum:

1. `cat_applications`
   - `SELECT`: public OR membership OR superuser
   - `UPDATE`: owner/admin membership OR superuser
   - `DELETE`: owner OR superuser
   - `INSERT`: authenticated creator path

2. `rel_application_users`
   - self-leave policy
   - owner/admin manage-member policy
   - superuser fallback

3. `cat_connectors`
   - public `SELECT` if app is public
   - mutate only by owner/admin or superuser

This avoids the current mismatch between route-level expectations and DB-level truth.

### Guard Split Requirement

Do not overload the current `ensureApplicationAccess(...)` contract.
Introduce separate access checks for:

1. public application discovery / preview
2. public join
3. joined-member runtime access
4. admin / owner management access

This is safer than teaching a single guard to mean several different things.

---

## Runtime Context Resolution

### Required Resolution Contract

For every runtime request:

1. resolve authenticated user
2. resolve application membership
3. resolve the user’s active/default workspace
4. fail closed if workspaces are enabled and no active workspace is found

V1 runtime behavior must stay bound to the user’s **default workspace only**.
Even though the schema supports future sharing, users should not see or operate across multiple workspaces until a dedicated workspace UI exists.

The workspace resolution result should become a reusable typed contract, for example:

```ts
interface ResolvedRuntimeAccessContext {
    applicationId: string
    schemaName: string
    workspacesEnabled: boolean
    applicationRole: 'owner' | 'admin' | 'editor' | 'member'
    defaultWorkspaceId: string | null
    allowedWorkspaceIds: string[]
}
```

This contract should live in a reusable backend domain boundary and be reused by:

- runtime list route
- row read route
- row create/update/delete/copy routes
- tabular child routes
- future application settings routes

---

## Public Join / Leave Model

### Join

Introduce explicit public join APIs:

1. `POST /applications/:applicationId/join`
2. optional `GET /applications/:applicationId/join-preview`

Join transaction must be idempotent:

1. validate app exists and is public
2. create application membership with role `member` if not already present
3. ensure exactly one default personal workspace for the user
4. ensure exactly one workspace-role assignment with role `owner` on that workspace
5. ensure the user-workspace relation is marked as the default relation

### Leave

Introduce explicit self-leave API:

1. `POST /applications/:applicationId/leave`

Leave transaction:

1. reject for application owner
2. soft-delete application membership row
3. tombstone the user’s default personal workspace
4. leave business rows untouched physically

### Admin Member Removal Rule

If an admin/owner removes a member from a workspace-enabled app, the backend must:

1. soft-delete the application membership row
2. archive the removed user’s default personal workspace
3. revoke active workspace-role assignments for that personal workspace if needed

This should use the same domain service as self-leave where possible, not a second divergent implementation.

### Important UI Contract

The applications list response must stop pretending that a visible public app is already a real member app.
Return explicit membership state instead, for example:

- `membershipState: 'joined' | 'not_joined'`
- `role: null | 'member' | ...`
- `canJoin`
- `canLeave`

This produces correct UI for:

- `Join`
- `Use`
- `Leave`
- admin menu
- member menu

---

## Per-Workspace Limits

### Storage Model

Store limits in `_app_workspace_limits` keyed by runtime catalog object id.

Why not JSON in `_app_settings`:

- harder to query safely
- harder to validate and migrate
- weaker future extensibility
- worse fit for object-level admin forms

Why not a full generic application-settings registry in V1:

- only one real mutable settings family exists yet: workspace row limits
- cloning the full metahub settings backend now would create premature generic infrastructure
- the UI shell can reuse the metahub settings page pattern without forcing the same backend abstraction yet

### Enforcement Model

Limit checks must happen in two places:

1. **Read path**
   - runtime payload returns quota metadata
   - frontend disables create button and shows info banner

2. **Write path**
   - backend enforces limit again inside a transaction
   - never trust the client-side disabled state

### Safe Write Pattern

Use a transaction and an advisory lock keyed by `(applicationId, catalogId, workspaceId)` before count-and-insert.

Illustrative sketch:

```ts
await withTransaction(executor, async (tx) => {
    await withAdvisoryLock(tx, buildWorkspaceCatalogLockKey(applicationId, catalogId, workspaceId), async () => {
        const currentCount = await queryOne<{ count: number }>(
            tx,
            `
            select count(*)::int as count
            from ${tableIdent}
            where workspace_id = $1
              and _upl_deleted = false
              and _app_deleted = false
            `,
            [workspaceId],
        )

        if (limit !== null && currentCount.count >= limit) {
            throw new WorkspaceLimitExceededError({ applicationId, catalogId, workspaceId, limit })
        }

        await tx.query(insertSql, insertParams)
    })
})
```

This is the preferred V1 approach because it is:

- correct under concurrent creates
- simple enough to audit
- consistent with repository DB helper standards

### Read Contract For UI

Extend runtime response with catalog quota metadata:

```ts
interface RuntimeCatalogQuota {
    workspaceId: string | null
    currentCount: number
    maxRows: number | null
    canCreate: boolean
}
```

Then include it in the active catalog payload so runtime UI can disable actions deterministically.

---

## Publication Snapshot And Sync Strategy

### Source Of Truth Split

The publication snapshot remains the source of truth for:

- runtime business objects
- runtime business attributes
- UI layout metadata

The application record remains the source of truth for:

- `is_public`
- `workspaces_enabled`

### Canonical Snapshot Rule

The plan must not treat workspace infrastructure as “out-of-band DDL” forever.
If `workspaces_enabled` changes the installed runtime schema shape, canonical schema tracking must capture it.

Required rule:

1. baseline schema creation stores a canonical snapshot that already includes workspace subsystem artifacts when enabled
2. incremental sync compares against the same canonical model
3. release bundle generation/validation uses the same canonical snapshot contract

This avoids hidden drift between:

- actual runtime DDL
- stored `applications.cat_applications.schema_snapshot`
- installed release metadata
- future bundle incremental apply

### Sync Rules

1. The first runtime sync creates:
   - reserved workspace subsystem tables when enabled
   - reserved workspace policies/indexes when enabled
   - workspace-aware business tables
   - default personal workspaces for **all existing application members**
   - workspace-role assignments for **all existing application members**
   - workspace-role definitions
   - limit rows for each catalog
   - localized VLC names for seeded default workspace and workspace roles

2. Subsequent syncs:
   - preserve all reserved workspace subsystem tables
   - add `workspace_id` only to newly introduced workspace-scoped tables
   - preserve existing workspace indexes/policies
   - create missing limit rows for newly introduced catalogs
   - never drop workspace subsystem because the snapshot does not describe it

3. Copy-driven first sync must follow the same bootstrap rule:
   - if the copied application already has copied members, create personal workspaces for all active copied members in that first schema creation

3. Snapshot diff logic should explicitly recognize reserved tables:
   - `_app_workspaces`
   - `_app_workspace_roles`
   - `_app_workspace_user_roles`
   - `_app_workspace_limits`

4. Canonical snapshot generation and bundle metadata must stay workspace-aware:
   - reserved workspace tables must be part of the tracked runtime contract when enabled
   - workspace-aware business columns such as `workspace_id` must participate in snapshot generation/diffing
   - migration metadata must not claim a schema state that omits active workspace infrastructure

### Reserved Runtime Metadata Flag

Mark workspace-scoped objects in runtime metadata explicitly.
Recommended `config` additions on `_app_objects` and/or `_app_attributes`:

```json
{
  "workspaceScoped": true
}
```

This reduces route-level guesswork and prevents future regressions.

---

## Affected Areas

### Backend: Applications Platform Schema

- `packages/applications-backend/base/src/platform/systemAppDefinition.ts`
- `packages/applications-backend/base/src/platform/migrations/...`
- related migration registration in `universo-migrations-platform`

### Backend: Persistence / Stores

- `packages/applications-backend/base/src/persistence/applicationsStore.ts`
- new runtime workspace-aware stores/helpers
- new immutable-flag and join/leave persistence helpers

### Backend: Routes

- `packages/applications-backend/base/src/routes/applicationsRoutes.ts`
- `packages/applications-backend/base/src/routes/applicationSyncRoutes.ts`
- potentially dedicated settings routes if split improves clarity
- shared member-removal / leave domain service if route duplication appears

### Frontend: Applications Admin

- `packages/applications-frontend/base/src/pages/ApplicationList.tsx`
- `packages/applications-frontend/base/src/pages/ApplicationActions.tsx`
- `packages/applications-frontend/base/src/menu-items/applicationDashboard.ts`
- new settings screens and join/leave flows
- member pages if workspace creation is triggered on member add

### Frontend: Runtime UI

- `packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx`
- `packages/applications-frontend/base/src/api/runtimeAdapter.ts`
- `packages/applications-frontend/base/src/api/queryKeys.ts`
- `packages/apps-template-mui/...`

### Shared Packages

- `packages/universo-types`
  - shared enums and DTOs for runtime access / quotas / membership state if reused
- `packages/universo-utils`
  - workspace-aware SQL helpers, lock-key helpers, reusable validation
- `packages/universo-i18n`
  - only if a string truly belongs to a shared base namespace

### Documentation

- package READMEs
- `docs/en/...`
- `docs/ru/...`
- GitBook platform / guides / architecture / API reference sections

---

## Detailed Plan Steps

### Phase 0: Freeze The Product Contract

- [x] Final product decision: public applications **default to workspaces**, but owners may explicitly disable the option with warning-level guidance in the UI.
- [x] Confirm immutable behavior for `is_public` and `workspaces_enabled`.
- [x] Confirm that leaving a public app means soft-deleting the user’s personal workspace, not hard-deleting rows.
- [x] Confirm initial workspace role set (`owner`, `member`, optional `manager`).
- [x] Confirm that only top-level catalogs and TABLE child tables are workspace-scoped in V1.
- [x] Confirm that application owner cannot use the public leave flow.
- [x] Confirm that app member invitation must not allow direct `owner` creation.
- [x] Confirm that V1 runtime remains bound to the user’s default workspace only and does not expose a workspace selector or sharing UI.
- [x] Confirm that admin member removal must archive the removed member’s personal workspace using the same lifecycle rule as self-leave.
- [x] Confirm that the default workspace and workspace role seed names must be stored as VLC values immediately (`Main / Основное`, `Owner / Владелец`, `Member / Участник`).

Deliverable:

- Approved domain vocabulary and invariants before schema changes start.

### Phase 1: Extend The Applications System Schema

- [x] Add `workspaces_enabled` to `applications.cat_applications`.
- [x] Keep using `is_public`; do not introduce a second duplicate visibility field.
- [x] Update create/copy persistence contracts and DTOs.
- [x] Extend shared application DTOs/types so create/copy/list/detail contracts can represent `isPublic`, `workspacesEnabled`, and explicit membership state without frontend-only inference.
- [x] Remove `isPublic` mutability from update flows.
- [x] Update system-app migration SQL and runtime metadata typing.
- [x] Ensure create/copy DTOs keep parameter ordering and naming aligned with the final UI tabs.

Quality rules:

- use one clear source of truth
- no hidden migration side effects
- fail closed on invalid creation option combinations

### Phase 2: Refactor Application-Level Policies And Membership Semantics

- [x] Replace coarse `ALL` RLS policies with command-specific policies.
- [x] Refactor application list SQL so public apps are discoverable without membership.
- [x] Split application guards into preview/join/member/admin semantics.
- [x] Fix `rel_application_users` so owner/admin management is representable at DB level.
- [x] Add explicit self-leave-safe policy shape.
- [x] Prevent direct insertion of `owner` via invite flow.
- [x] Add a controlled ownership-transfer design note, even if implementation is deferred.
- [x] Keep synthetic global-admin ownership separate from ordinary public-user visibility semantics.

Safety example:

```sql
create policy rel_application_users_owner_admin_manage
on applications.rel_application_users
for update
using (
    exists (
        select 1
        from applications.rel_application_users self
        where self.application_id = rel_application_users.application_id
          and self.user_id = (select auth.uid())
          and self.role in ('owner', 'admin')
          and self._upl_deleted = false
          and self._app_deleted = false
    )
)
with check (
    exists (
        select 1
        from applications.rel_application_users self
        where self.application_id = rel_application_users.application_id
          and self.user_id = (select auth.uid())
          and self.role in ('owner', 'admin')
          and self._upl_deleted = false
          and self._app_deleted = false
    )
);
```

### Phase 3: Introduce Runtime Workspace Infrastructure Generation

- [x] Add DDL builders for reserved workspace tables.
- [x] Add DDL builders for workspace indexes and policies.
- [x] Add seed logic for workspace role definitions.
- [x] Add bootstrap logic for all existing application members at first schema creation, not only the owner.
- [x] Add creation of default limit rows for each catalog.
- [x] Register reserved workspace tables as protected runtime infrastructure.
- [x] Seed the default personal workspace name as VLC `Main / Основное`.
- [x] Seed workspace role names as VLC values, not plain strings.
- [x] Use UUID v7 for all seeded runtime workspace entities.
- [x] Keep workspace DDL entirely inside the approved Tier 3 runtime-DDL boundary; do not leak Knex usage into route/store code.

Implementation rule:

- keep raw Knex only inside the approved DDL boundary
- route/store code remains SQL-first through executors

### Phase 4: Make Runtime Schema Generation Workspace-Aware

- [x] Add conditional `workspace_id` generation for top-level catalog tables.
- [x] Add conditional `workspace_id` generation for TABLE child tables.
- [x] Add indexes optimized for workspace reads and counts.
- [x] Ensure child rows inherit the parent workspace id.
- [x] Update sync diffing so new business tables get workspace columns automatically.
- [x] Ensure reserved workspace tables survive all future syncs.
- [x] Extend canonical schema snapshot generation so workspace-enabled applications persist a truthful runtime schema contract.
- [x] Extend release-bundle generation/validation so baseline and incremental lineage stay compatible with workspace-enabled runtime schemas.

### Phase 5: Build Runtime Access Resolution Layer

- [x] Add reusable application runtime access resolver.
- [x] Resolve current default workspace and allowed workspace set per user.
- [x] Reuse that resolver across all runtime routes.
- [x] Add typed error cases:
  - no application membership
  - public app not joined
  - no default workspace
  - workspace archived
- [x] Keep workspace context setting transaction-local and executor-aware: pinned request executor or explicit transaction only.

Performance rule:

- resolve access context once per request
- do not re-query workspace membership per row operation unless the transaction changes it

### Phase 6: Refactor Runtime CRUD To Enforce Workspace Scope

- [x] Add workspace predicate to runtime list reads.
- [x] Add workspace validation to single-row reads.
- [x] Add automatic `workspace_id` injection on create.
- [x] Prevent updates/deletes/copies across foreign workspaces.
- [x] Apply same rules to TABLE child CRUD.
- [x] Return quota metadata with runtime payload.

Safe read pattern:

```sql
select *
from ${tableIdent}
where workspace_id = $1
  and _upl_deleted = false
  and _app_deleted = false
order by _upl_created_at desc
limit $2
offset $3
```

Do not allow the client to submit arbitrary `workspace_id` in V1.
Use server-resolved default workspace only.

### Phase 7: Add Per-Workspace Limit Management

- [x] Create application settings backend endpoints for limits.
- [x] Create runtime count helpers keyed by workspace + catalog.
- [x] Enforce limits in create and copy flows.
- [x] Return structured error code for limit violations.
- [x] Return runtime quota metadata for button disabling and info banners.
- [x] Keep the limits backend intentionally narrow in V1 instead of cloning the full metahub generic settings registry before there is a second real application-settings family.

Recommended error contract:

```ts
{
  code: 'WORKSPACE_CATALOG_LIMIT_REACHED',
  applicationId: '...',
  catalogId: '...',
  workspaceId: '...',
  maxRows: 100
}
```

### Phase 8: Add Public Join / Leave Backend Flow

- [x] Add application list/detail membership state fields.
- [x] Add `join` endpoint and idempotent transaction.
- [x] Add `leave` endpoint and tombstone transaction.
- [x] Ensure joining a public app creates:
  - application membership
  - personal workspace
  - workspace role assignment
- [x] Ensure admin-added members also get workspace bootstrap when workspaces are enabled.
- [x] Ensure admin-removed members get workspace archival through the same domain lifecycle as self-leave.
- [x] Ensure copied members get workspace bootstrap on the copied app’s first schema creation.
- [x] Serialize conflicting membership mutations per application/user when needed so double-join, join+leave, or concurrent member edits remain idempotent and auditable.

Idempotent create pattern:

```sql
insert into applications.rel_application_users (...)
values (...)
on conflict do nothing;
```

Prefer unique active indexes so repeated join attempts remain safe.

### Phase 9: Build Applications Admin UI Changes

- [x] Convert application create dialog to tabbed layout:
  - `General`
  - `Parameters`
- [x] Convert application edit dialog to tabbed layout:
  - `General`
  - `Parameters`
- [x] Convert copy dialog to the same tab names:
  - `General`
  - `Parameters`
- [x] Keep parameter order aligned with the brief:
  - visibility
  - workspaces
  - connector copy options
  - access copy options
- [x] Add immutable-option info banners.
- [x] Show a warning-first UX for `Public + no workspaces` combinations instead of silently allowing them without guidance.
- [x] Show application settings entry only when schema exists.
- [x] Reuse `EntityFormDialog` with `tabs` configuration instead of inventing a new application form shell.
- [x] Reuse the existing MUI `Alert severity='info'` pattern already used in metahub/application info panels for immutable-option notices.
- [x] In edit mode, show visibility/workspace controls as read-only state with the same parameter tab and info banners, not as hidden fields.

UI rule:

- all new text must be i18n-ready immediately
- use package-local namespaces unless the strings are truly shared

### Phase 10: Build Public Join / Leave UI

- [x] Show public applications to standard users.
- [x] For non-members:
  - show `Join` action or enter-to-join modal
- [x] For joined non-admin members:
  - show `Use`
  - show overflow menu with `Use` and `Leave`
- [x] Add destructive warning modal for leave:
  - explain that the user’s workspace data will be removed logically

Important:

- do not render admin actions for non-admin public members
- do not reuse the current synthetic role display behavior
- [x] Reuse the existing `BaseEntityMenu` / action-descriptor pattern for member overflow actions instead of building a second custom card/table action menu.
- [x] Reuse the existing confirmation-dialog pattern for join/leave blocking dialogs instead of inventing a bespoke modal framework.
- [x] Replace the role chip with the correct action affordance for public non-members where needed, per the brief.

### Phase 11: Build Application Settings UI

- [x] Add Settings page/section in the application admin area.
- [x] Add two tabs:
  - `General`
  - `Limits`
- [x] `General` initially shows informational placeholder.
- [x] `Limits` renders all runtime catalogs and editable `max rows per workspace`.
- [x] Disable settings navigation when schema does not exist yet.
- [x] Reuse the existing Metahub Settings page structure and tab shell where practical instead of inventing a separate settings-page pattern for applications.
- [x] Add a `/settings` admin menu item in `applicationDashboard.ts` analogous to the metahub dashboard menu.
- [x] Reuse standard `Alert severity='info'` placeholder content for the `General` tab until real settings are added later.

### Phase 12: Shared Types, Helpers, And Query Contracts

- [x] Add shared DTOs/enums only where cross-package reuse is real.
- [x] Use `@universo/types` for shared contracts:
  - membership state
  - workspace quota payload
  - immutable option DTOs if reused
- [x] Use `@universo/utils` for:
  - lock key builders
  - workspace SQL helpers
  - validation helpers
- [x] Update TanStack Query keys to include any new runtime parameters explicitly.
- [x] Add frontend mutation-scope rules for conflicting actions (`join`, `leave`, member lifecycle changes) using TanStack Query v5 scoped mutations where it reduces race windows cleanly.

Recommended query-key principle:

- list/detail keys must encode all data-shaping inputs
- broad invalidation should still work via stable prefixes

### Phase 13: Full Test Strategy

- [x] Add migration tests for the new system-app schema changes.
- [x] Add persistence tests for:
  - create app with immutable options
  - copy app with immutable options
  - member add triggers workspace bootstrap
  - member remove archives the personal workspace
  - join/leave flows
  - limit persistence
- [x] Add route tests for:
  - public list visibility
  - join/leave
  - member remove in workspace-enabled apps archives the personal workspace
  - immutable option rejection on update
  - runtime workspace isolation
  - limit exceeded errors
  - cross-workspace access denial
  - member add/update/remove restrictions
- [x] Add runtime sync tests for:
  - first schema creation with workspaces
  - first schema creation with pre-existing members creates personal workspaces for all of them
  - subsequent sync preserving workspace tables
  - new catalog added after initial sync gets `workspace_id`
  - limit rows created for new catalogs
  - release bundle baseline/incremental validation remains consistent for workspace-enabled applications
- [x] Add frontend tests for:
  - create dialog tabs and validation
  - edit dialog read-only parameters tab
  - copy dialog parameters
  - public join flow
  - leave warning flow
  - runtime disabled create button on quota reached
  - settings limits screen
- [x] Add `apps-template-mui` tests for:
  - quota metadata handling
  - disabled create actions
  - mutation invalidation with updated query keys
  - optimistic flow when create is rejected by quota
  - scoped join/leave mutations do not run in parallel for the same application context

### Phase 14: Documentation And GitBook Updates

- [x] Update relevant package READMEs:
  - `applications-backend`
  - `applications-frontend`
  - `apps-template-mui`
  - shared packages if public contracts change
- [x] Update GitBook docs in both `docs/en` and `docs/ru`:
  - root docs navigation pages if links or IA change
  - `README.md`
  - `en/README.md`
  - `ru/README.md`
  - `platform/applications.md`
  - `platform/workspaces.md`
  - `guides/creating-application.md`
  - architecture docs for runtime schema / DB access / RLS
  - API reference for join/leave/settings/limits
- [x] Add architecture notes about:
  - workspace tombstone model
  - application membership vs workspace membership
  - runtime sync preservation rules
  - limit enforcement concurrency model

---

## Testing Depth Requirements

This feature set must not rely on a shallow route-only test strategy.

### Required Layers

1. **DDL / migration tests**
   - verify generated schema artifacts and reserved workspace infrastructure

2. **Store / SQL tests**
   - verify fail-closed behavior and exact SQL contracts

3. **Route integration tests**
   - verify HTTP status codes, validation, permissions, and returned payload shape

4. **Runtime sync tests**
   - verify first-sync and next-sync correctness

5. **Frontend interaction tests**
   - verify dialogs, tabs, join/leave, limits UX, and disabled controls

6. **Template package tests**
   - verify `apps-template-mui` behavior with quota metadata and updated query contracts

### Critical Scenarios

- user A cannot read user B rows
- user A cannot patch/delete/copy user B rows
- user A cannot reach child rows of user B via tabular endpoints
- public app is visible before join but not usable as a joined member until join completes
- join is idempotent
- leave is idempotent or safely rejected after first completion
- limit check remains correct under concurrent creates
- publication resync does not destroy existing workspace infrastructure
- newly invited member receives workspace automatically
- ownership cannot be duplicated accidentally

---

## Performance Notes

1. Do not soft-delete all workspace rows individually during leave.
2. Index every workspace-scoped table by `workspace_id` plus active-row markers.
3. Resolve runtime access once per request.
4. Use advisory locks for quota-critical write paths.
5. Keep query keys normalized and prefix-based for cheap invalidation.
6. Avoid storing limits only in large JSON blobs.

---

## Design Notes

### Why Not Put Workspace Logic Only In The Platform Schema?

Because runtime business tables live inside application schemas.
The workspace authorization boundary must sit next to the data it protects.

### Why Not Delay Workspace Roles Until Sharing UI Exists?

Because otherwise the first version will hardcode ownership semantics into schema design and create a breaking migration later.
The normalized workspace role layer is cheap to add now and expensive to retrofit later.

### Why Not Hard-Delete Workspace Data On Leave?

Because it is operationally risky, expensive, and unnecessary for the product behavior requested.
A workspace tombstone gives the required user-facing semantics with safer runtime behavior.

---

## Dependencies And Coordination

### Repository Dependencies

- `pnpm-workspace.yaml` remains the source of truth for library versions.
- TanStack Query v5 patterns must remain aligned with current repo usage.
- New shared types belong in `@universo/types` only when reused across packages.
- New reusable helpers belong in `@universo/utils`.
- New application runtime UI behavior must remain compatible with `@universo/apps-template-mui`.
- All text must be internationalized immediately.
- UUID v7 remains mandatory.

### External Guidance Used

- PostgreSQL 17 RLS docs for policy design and command-specific policy behavior.
- Supabase RLS guidance for auth-aware policy design and dedicated role tables.
- TanStack Query v5 guidance for query-key normalization, optimistic mutations, and mutation serialization scopes.
- Multi-tenant shared-schema recommendations based on PostgreSQL/AWS-style row isolation patterns.
- Repository database-access standard for pinned request executors, pool executors, and Tier 3 DDL boundaries.

---

## Recommended Implementation Order

1. Freeze domain invariants.
2. Refactor `applications` schema flags and policies.
3. Add runtime workspace subsystem DDL.
4. Make sync engine workspace-aware.
5. Refactor runtime CRUD for workspace enforcement.
6. Add per-workspace limits and backend settings APIs.
7. Add public join/leave backend flow.
8. Add admin UI changes.
9. Add public join/leave UI.
10. Add settings limits UI.
11. Complete deep tests.
12. Update READMEs and GitBook docs.

---

## Open Questions For Review

1. Should V1 workspace roles be only `owner` + `member`, or do we want `manager` immediately?
2. Should public apps auto-force workspaces in the UI, or only validate at submit time?
3. Should the first personal workspace codename be fixed as `main`, with localized name `Main` / `Основное`?
4. Should leaving a public app always soft-delete the application membership row, or should the membership remain archived with a dedicated status?
5. Do we want limit values stored only at the app-wide catalog level in V1, or do we already need per-workspace overrides?
6. Do we want admin member removal to hard-revoke all workspace-role rows immediately, or is archiving the personal workspace plus membership enough for V1?
7. Do we want to extend the canonical schema snapshot itself for workspace mode, or store a separate validated workspace-contract fingerprint alongside it?

---

## Definition Of Done

The feature is done only when:

1. public and closed applications behave correctly in list/detail/join/leave flows
2. workspace-enabled apps isolate runtime data safely per user
3. runtime sync preserves workspace infrastructure across publication updates
4. per-workspace limits work in both UI and backend enforcement
5. member add and public join bootstrap personal workspaces automatically
6. tests cover migrations, stores, routes, sync, frontend admin flows, and runtime template flows
7. package READMEs and GitBook documentation are updated in EN and RU
