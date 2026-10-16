# Plan: In-Place Personal-to-Shared Workspace Conversion and Two-Tier Application/Workspace Access Model

> Created: 2026-10-15
> Status: Proposed (PLAN mode; awaiting user approval before IMPLEMENT)
> Research input: `../research/personal-to-shared-workspace-conversion-two-tier-access-research-2026-10-15.md` (same-day, Reviewed)
> Brief: MANAGER brief v2 "In-Place Personal-to-Shared Workspace Conversion and Two-Tier Application/Workspace Access Model"
> Hard constraints: no legacy/compat layer; disposable test DB (no historical migration); no database-schema or metahub-template version bump; `pnpm dev` is not run by agents; UUID v7 everywhere; all new user-facing strings localized EN+RU; worktree may carry unrelated dirty files — change only what phases below touch.

## Overview

Implement the two-tier access model for workspace-enabled applications and an in-place `personal` → `shared` workspace conversion:

1. **Two-tier access**: application membership (`applications.rel_application_users`) is the primary admission tier; every active `shared` runtime workspace becomes visible and accessible with baseline `member` rights to all active application members (materialized rows in `_app_workspace_user_roles`), while `personal` workspaces stay owner-isolated with owner-initiated selective invitations (already the current behavior — kept, not changed).
2. **Conversion**: a workspace owner converts their active `personal` workspace (including the default seeded `Main` workspace) to `shared` in place via a new server-verified API + UI action, preserving the workspace `id`, all records, references, settings, and memberships, without creating a second workspace and without copying data. A `converted_from_user_id` marker prevents auto-re-creation of a duplicate `Main` personal workspace afterwards, and one audit row records the irreversible scope change.

Design decisions **D1–D4** (Recommended Decision) and **Q1–Q5** (Open Questions with proposed resolutions) from the research artifact are adopted by this plan; the race-safety analysis is carried over verbatim.

## Affected Areas

| Area                                     | Files                                                                                                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace runtime DDL                    | `packages/universo-react-applications-backend/src/ddl/applicationWorkspacesSchema.ts`                                                                                                                                        |
| Workspace lifecycle services             | `packages/universo-react-applications-backend/src/services/applicationWorkspaces.ts`, `packages/universo-react-applications-backend/src/services/runtimeWorkspaceService.ts`                                                 |
| Runtime API                              | `packages/universo-react-applications-backend/src/controllers/runtimeWorkspaceController.ts`, `packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts`                                                |
| Application member lifecycle hooks       | `packages/universo-react-applications-backend/src/controllers/applicationsController.ts` (join/addMember/leave/removeMember calls only)                                                                                      |
| Published app runtime UI                 | `packages/universo-react-apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx`, `src/api/workspaces.ts` (`@universo-react/applications-frontend` consumes via `apps-template-mui`; no component change expected there) |
| i18n                                     | `packages/universo-react-apps-template-mui/src/i18n/locales/en/apps.json`, `…/ru/apps.json`                                                                                                                                  |
| Tests (Jest)                             | `packages/universo-react-applications-backend/src/tests/…` (new + updated specs, listed per phase)                                                                                                                           |
| Tests (Vitest)                           | `packages/universo-react-apps-template-mui/src/workspaces/__tests__`, `src/api/__tests__`, `src/components/dialogs/__tests__`                                                                                                |
| E2E (Playwright, minimal local Supabase) | `tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts` (extend), new flow spec for conversion + guest-link eligibility                                                                                             |
| Docs                                     | `docs/en/`+`docs/ru/` GitBook pages (workspace guides + platform workspaces page), `packages/universo-react-applications-backend/README.md`+`README-RU.md`, `packages/universo-react-apps-template-mui/README.md`            |
| Memory Bank                              | `memory-bank/tasks.md`, `memory-bank/progress.md` at phase completion                                                                                                                                                        |

No new workspace package is created; no `@universo-react/types` contract change is required (runtime DTO unchanged); `@universo-react/utils` already provides `acquireAdvisoryXactLock` and `withTransactionSavepoint`.

## Plan Steps

### Phase 0 — Guardrails and impact checks (before any edit)

-   [ ] **0.1** Snapshot the baseline: `pnpm ontoindex:status`, then run OntoIndex impact for each symbol list to be edited (`ensurePersonalWorkspaceForUser`, `createSharedWorkspace`, `updateWorkspace` area, controller factory, `RuntimeWorkspacesPage`). Warn and re-scope on any HIGH/CRITICAL result before editing (repo hard rule).
-   [ ] **0.2** Confirm the worktree still contains unrelated user edits (AGENTS.md, READMEs, memory-bank) and touch nothing outside the Affected Areas table.
-   [ ] **0.3** Record the "no version bump" invariant in the working notes: no `schema_ddl` platform migration, no metahub template version change, no fixture changes (`tools/fixtures/*` untouched; LMS fixture content is not part of this feature).

### Phase 1 — Workspace runtime DDL additions (idempotent, applications-backend DDL boundary)

-   [ ] **1.1** In `ensureWorkspaceSupportTables` (`applicationWorkspacesSchema.ts`), extend the existing idempotent ALTER batch:

```sql
ALTER TABLE app_["schema"]._app_workspaces
ADD COLUMN IF NOT EXISTS converted_from_user_id UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspaces_converted_user_active_uidx"
    ON app_["schema"]._app_workspaces(converted_from_user_id)
    WHERE converted_from_user_id IS NOT NULL
      AND _upl_deleted = false AND _app_deleted = false;

ALTER TABLE app_["schema"]._app_workspace_operation_audit
    DROP CONSTRAINT IF EXISTS "_app_workspace_operation_audit_kind_ck";
ALTER TABLE app_["schema"]._app_workspace_operation_audit
    ADD CONSTRAINT "_app_workspace_operation_audit_kind_ck"
    CHECK (operation_kind IN ('seed_reset', 'personal_to_shared_conversion'));
```

Note: reorder so the audit-table constraint swap happens after the CREATE TABLE/first-creation batches; one constraint name constant `WORKSPACE_OPERATIONS_TABLE + '_kind_ck'` (already quoted via `qTable`). All identifiers through `qSchemaTable`/`qTable`.

-   [ ] **1.2** Keep the existing `_app_workspaces_personal_user_active_uidx` untouched: it keeps protecting the un-converted majority (users whose marker is absent still cannot hold two personal workspaces).
-   [ ] **1.3** Add Jest spec `src/tests/ddl/applicationWorkspacesSchema.conversion.test.ts` (mock executor, pattern of the existing `applicationWorkspaces.test.ts` 'adds workspace foreign keys…' spec): the DDL statements include `ADD COLUMN IF NOT EXISTS converted_from_user_id`, the partial unique index DDL, constraint re-creation accepting exactly the two operation kinds, and re-running `ensureWorkspaceSupportTables` twice produces no duplicate index/constraint statements that would fail (idempotent ORDER of operations).
-   [ ] **1.4** Run: `pnpm --filter @universo-react/applications-backend exec node ../../tools/testing/backend/run-jest.cjs --config ./jest.config.js src/tests/ddl/applicationWorkspacesSchema.conversion.test.ts src/tests/services/applicationWorkspaces.test.ts`

### Phase 2 — Backend core: baseline membership, conversion service, non-duplication invariant

-   [ ] **2.1** New exported helper in `applicationWorkspaces.ts` — **`ensureSharedWorkspaceBaselineMembership(executor, { schemaName, applicationId, actorUserId })`**: one set-based statement that materializes baseline `member` rows in `_app_workspace_user_roles` for every active application member × every active non-personal workspace; returns inserted-row count for audit reuse.

```ts
// One statement; no N+1.applications → runtime schema cross-join is precedented
// (listWorkspaceMembers already joins auth.users/profiles).
const rows = await executor.query<{ inserted: number }>(
    `
    WITH activeMembers AS (
        SELECT au.user_id
        FROM applications.rel_application_users au
        WHERE au.application_id = $1
          AND au._upl_deleted = false AND au._app_deleted = false
    ),
    sharedWorkspaces AS (
        SELECT w.id
        FROM ${workspacesQt} w
        WHERE w.workspace_type <> 'personal'
          AND w.personal_user_id IS NULL
          AND COALESCE(w.status, 'active') = 'active'
          AND w._upl_deleted = false AND w._app_deleted = false
    ),
    memberRole AS (
        SELECT r.id FROM ${workspaceRolesQt} r
        WHERE r.codename = 'member'
          AND r._upl_deleted = false AND r._app_deleted = false
        LIMIT 1
    ),
    inserted AS (
        INSERT INTO ${workspaceUserRolesQt} (
            id, workspace_id, user_id, role_id, is_default_workspace,
            _upl_created_by, _upl_updated_by
        )
        SELECT public.uuid_generate_v7(), w.id, m.user_id, mr.id, false, $2, $2
        FROM sharedWorkspaces w
        CROSS JOIN activeMembers m
        CROSS JOIN memberRole mr
        ON CONFLICT (workspace_id, user_id)
            WHERE _upl_deleted = false AND _app_deleted = false
            DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted FROM inserted
    `,
    [input.applicationId, input.actorUserId ?? null]
)
```

CTE-with-data-modifying-INSERT pattern (`inserted AS (INSERT … RETURNING 1)` capped by a final `SELECT COUNT(*)`) is valid PostgreSQL; arbiter inference on the partial unique `(workspace_id, user_id) WHERE …` is documented PostgreSQL 17 behavior (research finding E). Owner rows already present conflict-DO-NOTHING and keep the `owner` role — the upsert never downgrades an owner. The helper returns the inserted-row count so the conversion audit row can record it.

-   [ ] **2.2** Symmetric cleanup helper **`removeSharedWorkspaceBaselineMembership(executor, { schemaName, userId, actorUserId })`**: soft-delete (`_upl_deleted/_app_deleted = true`, version bump, fail-closed via `RETURNING`) role=`'member'` rows of the user across all active non-personal workspaces. Leave `owner` rows of shared workspaces and invitations inside other users' `personal` workspaces untouched (documented D4 minimal-cleanup; stale rows are inert because runtime admission runs `ensureApplicationAccess` first).
-   [ ] **2.3** Wire call sites (each inside the caller's existing transaction, synchronous per research Q2):
    -   **`applicationId` threading (QA-verified, mandatory)**: extend `createSharedWorkspace` input with `applicationId` and pass it from (a) `createWorkspace` handler (`runtimeWorkspaceController.ts:326–332`), (b) `copyWorkspaceDetails` controller (add `applicationId` to the `copyWorkspace` call at `:431–439`), (c) `RuntimeWorkspaceCopyInput` and `WorkspaceCreationInput` types plus the `copyWorkspaceOperation` → `createWorkspace` invocation (`runtimeWorkspaceCopyService.ts:15–32, :332–339`), (d) the direct Jest caller in `runtimeWorkspaceService.test.ts:185`. This makes `createSharedWorkspace` the single transactional point that also enrolls all application members as baseline `member` rows — covering both fresh shared workspaces and personal→shared copies (copies of personal workspaces become shared today, so they need the enrollment too).
    -   `createSharedWorkspace` (service `:279–354`): after owner-row insertion and seed materialization, call `ensureSharedWorkspaceBaselineMembership`. **Placement note**: keep the call after seed materialization to preserve the existing order pins in `runtimeWorkspaceService.test.ts:194–198`.
    -   Conversion (step 2.5, same transaction).
    -   `join` (`applicationsController.ts:846–874`): after `insertApplicationMember`, inside the same `trx`.
    -   admin `addMember` (`applicationsController.ts:1164–1193`): same `trx`, next to `ensurePersonalWorkspaceForUser`.
    -   schema-sync pass `ensureApplicationRuntimeWorkspaceSchema` (`applicationWorkspaces.ts:472–513`): after `ensurePersonalWorkspacesForApplicationMembers(..., seedElements:false)`, append a reconciliation call (idempotent; covers DB-regenerated environments).
    -   Test compile-updates: the direct `createSharedWorkspace` Jest call (`runtimeWorkspaceService.test.ts:185`) now MUST pass `applicationId`; existing SQL-shape mocks may need one more branch for the baseline `CROSS JOIN` INSERT (they would otherwise swallow it under the generic `_app_workspace_user_roles` prefix — add an explicit expectation instead).
-   [ ] **2.4** Cleanup wiring: `leave` (`applicationsController.ts:902–917`) and `removeMember` (`:1310–1325`) call `removeSharedWorkspaceBaselineMembership` inside the same `trx` right after `deleteApplicationMember`.
    -   **Sole-owner app-leave guard (D4 edge, resolved in PLAN per research §I)**: before deleting the application membership, check whether the departing user holds the **only active `owner` row** in any active `shared` workspace of the application; if so, reject with HTTP 409 and a new error code `applicationMemberWorkspaceOwnershipRequired` → `APPLICATION_MEMBER_WORKSPACE_OWNERSHIP_REQUIRED` ("Transfer or delete your shared workspaces before leaving this application"). Rationale: shared workspaces today offer no admin path for member management (`requireWorkspaceMembership(requireOwner)` only), so a workspace whose only owner row belongs to a departed user becomes unmanageable; an exact fail-closed beat this invents no auto-transfer UX. Mirrors the existing workspace-level `LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED` semantics; map the code in the applicationsController error handlers with the same 409 pattern.
-   [ ] **2.5** New conversion service in `runtimeWorkspaceService.ts` — **`convertPersonalWorkspaceToShared(executor, { schemaName, applicationId, workspaceId, userId, actorUserId })`**, following the DDL-first, fail-closed mutation style of `deleteSharedWorkspace`:

```ts
export async function convertPersonalWorkspaceToShared(executor, input) {
    return executor.transaction(async (tx) => {
        // Serialize against ensurePersonalWorkspaceForUser (research Q1).
        await acquireAdvisoryXactLock(tx, `personal-workspace:${input.schemaName}:${input.userId}`)

        const workspaceRows = await tx.query<{ id; workspace_type; personal_user_id }>(
            `SELECT id, workspace_type, personal_user_id
             FROM ${workspacesQt}
             WHERE id = $1 AND ${ACTIVE_ROW_SQL}
             LIMIT 1
             FOR UPDATE`,
            [input.workspaceId]
        )

        const workspace = workspaceRows[0]
        if (!workspace) throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound, 'Workspace not found')
        if (workspace.workspace_type !== 'personal' || workspace.personal_user_id !== input.userId) {
            // Only a personal workspace owned by the caller may be converted (D3).
            throw new RuntimeWorkspaceError(
                RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked,
                'Only the caller-owned personal workspace can be converted to shared'
            )
        }

        const updated = await tx.query<{ id: string }>(
            `UPDATE ${workspacesQt}
             SET workspace_type = 'shared',
                 personal_user_id = NULL,
                 converted_from_user_id = $2,
                 _upl_updated_at = NOW(), _upl_updated_by = $3,
                 _upl_version = COALESCE(_upl_version, 1) + 1
             WHERE id = $1
               AND workspace_type = 'personal'
               AND personal_user_id = $2
               AND ${ACTIVE_ROW_SQL}
             RETURNING id`,
            [input.workspaceId, input.userId, input.actorUserId ?? input.userId]
        )
        if (updated.length === 0)
            throw new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked, 'Workspace conversion raced; retry')

        // One invariant update; preserves id, rows, refs, seeds, settings, memberships.
        const baselineCount = await ensureSharedWorkspaceBaselineMembership(tx, {
            schemaName: input.schemaName,
            applicationId: input.applicationId,
            actorUserId: input.actorUserId ?? input.userId
        })

        await recordWorkspaceOperationAudit(tx, {
            schemaName: input.schemaName,
            workspaceId: input.workspaceId,
            operationKind: 'personal_to_shared_conversion',
            affectedRows: baselineCount,
            actorUserId: input.actorUserId ?? input.userId
        })

        return { id: updated[0].id }
    })
}
```

Notes: the single `UPDATE` keeps `_app_workspaces_public_entry_ck` satisfied (`is_public_entry` untouched/false; constraint only constrains entries that are true). No business-table rows are written — preservation is structural, not a copy. `recordWorkspaceOperationAudit` is a small private helper extracted from the existing `seed_reset` insert (`applicationWorkspaces.ts:1504–1520`) to avoid duplication — the extraction MUST keep the fail-closed `isUuidV7(operationId)` check (`:1521–1527`).

-   [ ] **2.6** Non-duplication guard in `ensurePersonalWorkspaceForUser` (`applicationWorkspaces.ts:1551+`): keep the current cheap personal-row lookup; when the row is absent, wrap creation in `withTransactionSavepoint` + `acquireAdvisoryXactLock(\`personal-workspace:<schemaName>:<userId>\`)`and re-check inside the lock — (a) personal row again, (b)`converted_from_user_id = $user`existence. If the marker exists, **do not create** a personal workspace and **do not touch** default-workspace state (the user's membership row in the converted workspace keeps`is_default_workspace = true`in`\_app_workspace_user_roles`). Marker-only semantics per research Q1 (behavioral preservation for users invited into others' personal workspaces before first access).
    -   Implementation caveat (QA-verified): real `SAVEPOINT` isolation is created by `withTransactionSavepoint` only on RLS request executors; on the sync/pool path (`createKnexExecutor`, e.g. `syncEngine.ts:840`) the nested `transaction()` is a passthrough. The advisory lock still provides the required cross-connection serialization, so never state "savepoint isolation" for the sync path in comments; the lock + re-check design remains valid.

```ts
if (!workspaceId) {
    workspaceId =
        (await withTransactionSavepoint(executor, async (tx) => {
            await acquireAdvisoryXactLock(tx, `personal-workspace:${schemaName}:${userId}`)
            const again = await findPersonalWorkspace(tx) // re-check
            if (again) return again.id
            const converted = await findConvertedWorkspace(tx) // marker re-check
            if (converted) return null // owned shared workspace exists; no personal
            // …existing INSERT … ON CONFLICT (personal_user_id) … DO NOTHING path…
        })) ??
        existingWorkspaceRows[0]?.id ??
        null
}
```

Downstream membership/default-role bookkeeping must handle `workspaceId === null` as a no-op (this branch only fires when the user already owns a converted shared workspace).

-   [ ] **2.7** Error code registration: add `workspaceConversionBlocked: 'WORKSPACE_CONVERSION_BLOCKED'` to `RUNTIME_WORKSPACE_ERROR_CODES` (`runtimeWorkspaceService.ts:44–53`). Controller maps it to HTTP 409 (research Q4; reuses the `personalWorkspaceMutationBlocked` :142–145 mapping precedent).
-   [ ] **2.8** Jest coverage (extend existing suites, do not fork loaders):
    -   `runtimeWorkspaceService.test.ts` (add): conversion happy path (row lock, marker set, baseline insert called, audit row written, `{id}` returned); 404 missing; 409 non-personal/not-owned; zero-row race → 409; conversion never issues UPDATE/DELETE against `obj_*`/`tbl_*` business tables (assert on captured SQL) **plus preservation pins for support state**: `_seed_source_key`/`_seed_source_owned` columns untouched and `_app_workspace_settings` rows untouched by the conversion transaction (assert on captured SQL).
    -   `runtimeWorkspaceService.test.ts` (update): default-workspace semantics after conversion (the membership row's `is_default_workspace = true` in `_app_workspace_user_roles` survives; no second personal row created on subsequent ensure — marker present).
    -   `applicationWorkspaces.test.ts` (update): `resolveRuntimeWorkspaceAccess` allowedWorkspaceIds includes baseline shared rows **and requires no `is_public` condition — pin that baseline/shared visibility is driven purely by `applications.rel_application_users` membership (closed-app Behavior)**; fixture SQL expectations keep the not.toContain no-automatic-shared-workspace pins (`:297–298`) intact, and **update the CHECK pin at `:302`** (`operation_kind IN ('seed_reset')` → the two-kind constraint) so the DDL swap does not break this test.
    -   New `applicationWorkspaces.baselineMembership.test.ts`: set-based insert SQL shape (CROSS JOIN, ON CONFLICT arbiter with partial-index WHERE), owner-row preservation on conflict, count correctness, idempotent re-run, and **no `is_public` coupling**.
    -   `applicationWorkspaces.lifecycle.test.ts` (extend): leave removes role='member' rows in shared workspaces, keeps owner rows, keeps invitations in others' personal workspaces (documented minimal cleanup); **after conversion, `archivePersonalWorkspaceForUser` must NOT archive the converted workspace** (negative pin); **departing owner of a personal workspace with invited members** archives that personal workspace and soft-deletes the invited members' rows in it (documented reconcile case); **sole-owner app-leave guard**: leaving/removing a user who holds the only owner row of any active shared workspace → 409 `APPLICATION_MEMBER_WORKSPACE_OWNERSHIP_REQUIRED`, success path after ownership transfer.
    -   `applicationWorkspaces.test.ts` (extend): `ensurePersonalWorkspaceForUser` returns without INSERT when marker exists; adds advisory-lock call with the shared `personal-workspace:` key family.
    -   **Mock-factory completeness (QA-verified)**: any new test that mocks the whole `@universo-react/utils/database` module (pattern `guestAssessmentAttemptLifecycleService.test.ts:1–9`) must expose BOTH `acquireAdvisoryXactLock` and `withTransactionSavepoint` in the factory — `applicationWorkspaces.ts:10` imports both after Phase 2.6, and a partial mock would throw at import time.
-   [ ] **2.9** Run focused: `pnpm --filter @universo-react/applications-backend exec node ../../tools/testing/backend/run-jest.cjs --config ./jest.config.js src/tests/services/applicationWorkspaces src/tests/services/runtimeWorkspaceService.test.ts src/tests/ddl`

### Phase 3 — API surface (controller + route + permissions)

-   [ ] **3.1** Controller `runtimeWorkspaceController.ts`: add `convertWorkspaceToShared` handler. Zod: no request body (strict passthrough none); params reuse `workspaceParamSchema`; access gate `requireWorkspaceMembership(ctx, workspaceId, { requireOwner: true })` → existing 403 `WORKSPACE_ACCESS_DENIED` / `WORKSPACE_OWNER_REQUIRED`; service errors mapped in `sendWorkspaceMutationError`: `workspaceNotFound` → 404, `workspaceConversionBlocked` → 409; respond `{ id }` (matches create/copy contract shape).
    -   **QA addendum**: an application **admin** (without a membership row or without owner role) reaches the same 403 `WORKSPACE_OWNER_REQUIRED` whose existing message text ("Only workspace owners can manage members") does not fit conversion; add a conversion-specific message override for this handler (localized key, e.g. reusing the conversion dialog error family), not a general change of the shared message.
-   [ ] **3.2** Route registration in `applicationsRoutes.ts` (after copy, before delete):

```ts
router.post('/:applicationId/runtime/workspaces/:workspaceId/convert', writeLimiter, asyncHandler(workspace.convertWorkspaceToShared))
```

-   [ ] **3.3** Controller Jest (`runtimeWorkspaceController.test.ts`): authorization matrix — non-member 403; workspace member (non-owner) 403 WORKSPACE_OWNER_REQUIRED; owner 200 `{id}`; application-admin without membership row → 403 with the conversion-specific message; route with unexpected body → 400 INVALID_REQUEST_BODY; 409 error mapping; workspaces-disabled → 400 WORKSPACES_DISABLED. **Mock-factory addendum**: the module mock (factory at `:34–67`) gains the new `convertWorkspaceToShared` mock beside the others (import-time requirement), and any literal `RUNTIME_WORKSPACE_ERROR_CODES` mock map in tests is extended with the new code. Update the existing membership-denied expectations that remain valid for `personal` workspaces only (see Phase 5 note; membership-only semantics stay for personal workspaces — research finding J/K).
-   [ ] **3.4** API-type parity check: no `@universo-react/types` change (runtime DTO untouched); confirm `zod-error` mapping helper usage matches existing handlers.
-   [ ] **3.5** Run: `pnpm --filter @universo-react/applications-backend exec node ../../tools/testing/backend/run-jest.cjs --config ./jest.config.js src/tests/controllers/runtimeWorkspaceController.test.ts src/tests/routes/applicationsRoutes.test.ts`. Route-list pin update (QA-verified, `applicationsRoutes.test.ts:15389–15412`): add `'/:applicationId/runtime/workspaces/:workspaceId/convert'` to the POST-route array and keep asserting `stack[0].handle === mockRateLimiter` (rate limiter first), since the route must be registered with `writeLimiter` before the handler.

### Phase 4 — Published-app runtime UI (apps-template-mui)

-   [ ] **4.1** API client `src/api/workspaces.ts`: add `convertRuntimeWorkspaceToShared({ apiBaseUrl, applicationId, workspaceId })` → `POST …/runtime/workspaces/:workspaceId/convert`, response parsed with the **existing exported** `runtimeWorkspaceMutationResponseSchema` (`:59–63`, `z.object({ id: workspaceIdSchema }).strict()`) — no new schema; mirror the `copyRuntimeWorkspace` body shape (`:242–259`) with `buildRuntimeUrl` + `fetchWithCsrf` + `throwRuntimeWorkspaceApiError`.
-   [ ] **4.2** `RuntimeWorkspacesPage.tsx`:
    -   Add `convertMutation` (TanStack Query `useMutation`) mirroring `deleteMutation` wiring: on success invalidate `workspaceQueryKeys.all(applicationId)`, `appQueryKeys.list`, `['runtime', applicationId]`; on failure keep the dialog open and show a localized `Alert` inside it (same failure surface pattern as `ConfirmDeleteDialog`'s inline error, `RuntimeWorkspacesPage.tsx:1214`); translate server errors through the existing localized error mapper keyed on `WORKSPACE_CONVERSION_BLOCKED` / `WORKSPACE_OWNER_REQUIRED` codes.
    -   Menu item inside the `canManageWorkspace` group, next to the destructive `Divider`+`Delete` block: label `t('workspace.actions.makeShared', 'Make shared')`, icon `FolderSharedRoundedIcon`; rendered **disabled-in-place** when `workspaceMenuTarget?.workspaceType !== 'personal'` (disabled, mirroring the existing `Delete` disable-in-place convention for the same gate family `:1103`; new for `shared`, enabled for owner-owned `personal`); invokes `setConvertTarget(workspaceMenuTarget)` and closes the menu.
    -   Confirmation dialog built on **`StandardDialog`** (canonical primitive; no resize/fullscreen controls; `aria-labelledby` handled internally; `isBusy` blocks close), `maxWidth="sm" fullWidth`, with destructive framing: **`Cancel` rendered DOM-first and auto-focused** (initial focus on the safe action, matching `ConfirmDeleteDialog`'s cancel-first DOM order), destructive primary button text `t('workspace.convertConfirm')` with `color='error'` when pending-safe, body: four localized consequence bullets (visibility, one-way, guest-links eligibility, data preservation) + `aria-describedby` linkage to the one-way warning. Deviation note (skill `mui-runtime-ux-patterns` blocking rule): the shared destructive-confirmation contract (`ConfirmDeleteDialog`) hardcodes the delete icon (`ConfirmDeleteDialog.tsx:95`) and cannot represent a non-delete destructive action; the deviation is documented in code comments and proven by a focused test asserting the destructive-dialog class affordances (no resize/fullscreen handles, standard footer insets) per skill "documented with a focused test" escape hatch.
    -   The workspace page type column/metric card already renders `Personal/Shared` via existing keys — no change needed beyond post-conversion invalidation.
-   [ ] **4.3** i18n (add BOTH locales before the feature is considered complete; namespaces `apps`):
    -   `workspace.actions.makeShared` (en "Make shared" / ru "Сделать общим");
    -   `workspace.convertTitle`, `workspace.convertVisibilityLine` (en "All application members will see this workspace with member rights." / ru "Это рабочее пространство увидят все участники приложения с правами участника."), `workspace.convertOneWayLine` (en "This change is permanent and cannot be undone." / ru "Это изменение необратимо."), `workspace.convertGuestLinksLine` (en "Existing guest links in this workspace become eligible when configured. Anonymous public access is not enabled automatically." / ru "Существующие гостевые ссылки этого пространства становятся доступными при настройке. Анонимный публичный доступ включается отдельно и не включается автоматически."), `workspace.convertDataLine` (en "The workspace, its records and links are preserved." / ru "Рабочее пространство, записи и связи сохраняются."), `workspace.convertConfirm` (en "Convert to shared" / ru "Перевести в общее"), `workspace.convertBusy` (en "Converting…" / ru "Преобразование…"), error-message keys for `WORKSPACE_CONVERSION_BLOCKED` / `WORKSPACE_OWNER_REQUIRED`.
    -   Run `pnpm check:i18n-coverage` after adding keys.
-   [ ] **4.4** Vitest (`apps-template-mui`):
    -   `src/api/__tests__/workspaces.test.ts` (extend): new helper path/body parsing (schema rejects junk `{id}`).
    -   `src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx` (extend): menu item **disabled** for an owner-owned `shared` workspace (disable-in-place, not hidden) and **hidden** for non-owner roles (group rule); enabled for owner-owned `personal`; dialog opens on click and query-fires on confirm with ids preserved in route payloads; **menu closed** when the dialog is open; initial focus lands on the Cancel action (DOM-first safe action); failure keeps the dialog open and renders the localized `Alert`; invalidation set matches Phase 4.2; localized EN+RU labels asserted from real locale resources (no mock translations).
    -   `src/components/dialogs/__tests__/Dialog.accessibility.test.tsx` (extend pattern): conversion dialog Escape/busy behavior via `StandardDialog` (`isBusy` blocks close), plus the destructive-class evidence required by the deviation note: no resize/fullscreen affordances, standard footer insets.
-   [ ] **4.5** Run: `pnpm --filter @universo-react/apps-template-mui exec vitest run src/workspaces src/api/__tests__/workspaces.test.ts src/components/dialogs`

### Phase 5 — End-to-end acceptance (Playwright vs minimal local Supabase, browser evidence)

-   [ ] **5.1** Environment: `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`, then `pnpm run build:e2e` (agents never run `pnpm dev`; Playwright suite boots the built stack itself).
-   [ ] **5.2** Extend `tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts` (existing assertions stay green; add steps):
    -   Fresh workspace-enabled LMS app: owner list shows exactly one `personal` workspace and zero `shared` (unchanged behavior).
    -   Add application member (existing helper path).
    -   Owner: workspace menu → "Make shared" on the personal `Main` workspace → dialog consequence copy visible in the active locale → confirm → list/switcher now shows it as `Shared` with the **same workspace id** (assert id stability via captured `data-workspace-id` and API payload).
    -   Member session (no invitation!): switcher lists the converted workspace; switching sets member default via existing PATCH flow; `Add member` remains gated/disabled for baseline member; content rows seeded from the template are visible inside the shared workspace and remain isolated from member's own personal workspace.
    -   Negative isolation: a second member (or the member before conversion) cannot see the owner's another `personal` workspace nor the personal of other users.
    -   **Closed application pin (brief G2, QA-added)**: repeat the conversion journey on a variant created with `isPublic: false` (`setupPublishedLmsApplication` accepts the flag, `lmsRuntime.ts:303–311`) and assert the member still sees and switches to the converted shared workspace — application membership remains the admission tier; guest-link routes stay 403 for the closed app and are skipped in this variant.
    -   Guest-link eligibility: create `AccessLinks` record **inside the converted Main workspace**; assert anonymous resolution `/api/v1/public/a/:applicationId/links/:slug` → 200, and the `/l/<slug>` global short link resolves (existing page helper patterns); verify created link works without any second workspace having ever been created.
    -   Public entry: Application Settings `public-entry-workspace` select now offers the converted workspace (predicate `workspaceType !== 'personal' && personalUserId == null && status === 'active'`).
    -   API negatives in the same spec: member `POST …/workspaces/:id/convert` → 403; non-member second app user → 403; after conversion, `POST …/workspaces` (new shared) still requires `manageApplication` (member 403 — unchanged).
    -   DB-level persistence check through the API: rerun owner runtime list and confirm seeded record ids stable pre/post conversion (no duplicates), and a subsequent owner re-login does not spawn a second personal `Main`.
-   [ ] **5.3** New flow spec `tools/testing/e2e/specs/flows/lms-workspace-conversion.spec.ts` (kept narrow; reuses `setupPublishedLmsApplication(api, { runId: runManifest.runId, label, isPublic, workspacesEnabled })` + api-session helpers): the pure conversion journey + screenshots.
-   [ ] **5.4** Browser evidence (skill `runtime-ux-qa` oracles; inspect screenshots — do not trust tool exit codes blindly):
    -   Screenshot matrix `1920×1080`, `768×1024`, `390×844` for: workspace list with the new menu open (EN + RU), conversion dialog (EN + RU), post-conversion switcher row.
    -   Keyboard path: Tab/Enter opens the row actions menu, selects "Make shared", dialog initial focus lands on the **Cancel** (safe) action, Escape closes when not busy.
    -   `expectNoPageHorizontalOverflow` + `expectNoTechnicalLeakage` (with `checkUuidSubstrings: true` for the new surfaces, mirroring `snapshot-import-lms-runtime.spec.ts:1603, 1687`) on all captured surfaces; Axe checks per existing pattern.
    -   Destructive-dialog evidence for the conversion dialog: no resize/fullscreen affordances, standard footer insets (component test per Phase 4.4 plus a dialog screenshot).
    -   Save artifacts under `tools/testing/e2e/.artifacts/<run>/…` and visually inspect them in the IMPLEMENT pass.
-   [ ] **5.5** Run: `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts tools/testing/e2e/specs/flows/lms-workspace-conversion.spec.ts tools/testing/e2e/specs/flows/marketing-page-workspace-management.spec.ts --project chromium`

### Phase 6 — Documentation (GitBook format, EN+RU parity)

-   [ ] **6.1** `docs/en/guides/workspace-management.md` + `docs/ru/guides/workspace-management.md`: new "Two-tier access model" section (application admission → shared open to all members / personal owner-isolated with invitations), "Convert a personal workspace to shared" section with one-way semantics, preserved ids, guest-link eligibility note, and `is_public_entry` non-coupling; replace the affected bullets ("invite active application members by email…" stays true; add shared-visibility sentence). Screenshot references from Phase 5.4 (GitBook asset paths under `docs/en/.gitbook/assets/...` per existing convention).
-   [ ] **6.2** `docs/en/platform/workspaces.md` + ru mirror: rewrite the "Current Implementation" bullets (:25–30) to the two-tier model + conversion; keep the runtime/isolation sentences that remain true.
-   [ ] **6.3** Package READMEs (QA fact-check applied):
    -   `packages/universo-react-applications-backend/README.md` — update the existing "Workspaces, Public Access, and Limits" section (`:45+`): rewrite the bootstrap sentence (personal `Main` per member, now with the conversion marker note), replace "Public workspace-enabled applications do not receive an automatic shared workspace" (`:52`) with the conversion statement, and document the baseline-membership sync plus leave/remove cleanup semantics.
    -   `packages/universo-react-applications-backend/README-RU.md` — the file has **no** workspace section today (verified); add a short mirrored RU section at the same structural level so both languages carry the two-tier model fact. Do not invent content beyond what EN states.
    -   `packages/universo-react-apps-template-mui/README.md` "Runtime Workspaces": add the conversion action + visible-to-all `shared` sentence.
-   [ ] **6.4** Memory bank: `memory-bank/tasks.md` new IMPLEMENT section with this plan's phase checklist; `memory-bank/progress.md` evidence entries appended per phase (commands + observed results).

### Phase 7 — Full verification gates (closeout)

-   [ ] **7.1** Formatting/lint/build for touched packages only: `pnpm --filter @universo-react/applications-backend lint`, `pnpm --filter @universo-react/apps-template-mui lint`, then `pnpm --filter @universo-react/applications-backend build`, `pnpm --filter @universo-react/apps-template-mui build`, and a root `pnpm build` at the end (workspace propagation requirement).
-   [ ] **7.2** Repo checks: `pnpm check:i18n-coverage`, `pnpm check:apps-template-isolation`, `pnpm check:runtime-ux-agents`, `pnpm check:runtime-no-lms-forks`, `pnpm check:mui-v9-policy`, `pnpm check:package-naming`.
-   [ ] **7.3** OntoIndex: `pnpm ontoindex:analyze` (one process only, after coordination) then `pnpm ontoindex:changes` / MCP `gn_verify_diff` — confirm only expected symbols/flows changed; report the delta honestly (dirty-worktree caveat).
-   [ ] **7.4** Thermos review (`autoreview` skill, bounded): correctness/security rubrics — advisory-lock usage, fail-closed `RETURNING` mutations, RLS-safety of the cross-schema CTE, no credential logging, API backward compatibility (new route only; DTO unchanged); fix any CRITICAL/HIGH before declaring done.
-   [ ] **7.5** Closeout summary in `memory-bank/progress.md` with: tests executed (counts), browser evidence artifacts, known limitations (`workspaceOpenBehavior` still unwired — out of scope; switcher fetch limit 100 unchanged), and explicit "no schema/template version bump" confirmation.

## UI Contract (Runtime UI UX Quality Gate)

| Contract item                 | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Surface                       | `RuntimeWorkspacesPage` row actions menu (card + table views) + conversion confirmation dialog; `WorkspaceSwitcher` unchanged                                                                                                                                                                                                                                                                                                                                                  |
| Trigger                       | `MenuItem` "Make shared" rendered **disabled-in-place** when `workspaceMenuTarget.workspaceType !== 'personal'` (mirrors the existing `Delete` disable-in-place convention for the same gate family) inside the owner-gated `canManageWorkspace` group (hidden for non-owners); icon `FolderSharedRoundedIcon`; toggled by keyboard (IconButton has `aria-label={t('workspace.actions.openMenu')}`)                                                                            |
| Field semantics & user role   | Workspace owner converts own personal workspace; no admin path in v1 (research D3)                                                                                                                                                                                                                                                                                                                                                                                             |
| Controls                      | `StandardDialog` (canonical primitive, documented deviation from `ConfirmDeleteDialog` due to its fixed delete icon, proven by a focused destructive-class test): title, four localized consequence bullets, **`Cancel` DOM-first and auto-focused (initial focus on the safe action)**, destructive primary `Convert to shared` (`color='error'`), `isBusy` blocks close, `aria-describedby` links the one-way warning. No form fields, no multiline inputs, no JSON anywhere |
| Display values                | Menu/dialog text only; workspace names resolved via existing `readName` localized reader; no raw IDs, no `[object Object]`                                                                                                                                                                                                                                                                                                                                                     |
| Hidden/system-owned fields    | `converted_from_user_id` never surfaced in API DTO or UI                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Defaults                      | Dialog opens with focus on the safe (Cancel) action; Escape closes unless `isBusy`; menu closes when the dialog opens; on failure the dialog stays open and shows a localized `Alert`                                                                                                                                                                                                                                                                                          |
| Validation & localized errors | Server errors mapped by code (`WORKSPACE_CONVERSION_BLOCKED` → 409 message key; `WORKSPACE_OWNER_REQUIRED` → existing 403 message key), displayed **inside the dialog** as a localized `Alert`; all EN+RU before feature completion; `pnpm check:i18n-coverage` must pass                                                                                                                                                                                                      |
| Responsive behavior           | Dialog `maxWidth="sm" fullWidth`; page-level no horizontal overflow at 1920×1080 / 768×1024 / 390×844 (proven with screenshots + `expectNoPageHorizontalOverflow`)                                                                                                                                                                                                                                                                                                             |
| Accessibility proof           | `StandardDialog` handles `aria-labelledby`; per existing `Dialog.accessibility.test.tsx` contract Escape/busy covered; keyboard path captured in Phase 5.4, initial-focus assertion added in Phase 4.4                                                                                                                                                                                                                                                                         |
| Danger framing                | Body copy explicitly states one-way conversion (`convertOneWayLine`), new member visibility, guest-links eligibility, and data preservation (four bullets; `convertDataLine` without jargon "ID"); no ids listed — reviewed via `plan-ux-reviewer` checklist                                                                                                                                                                                                                   |

## Potential Challenges

1. **Concurrent conversion vs. runtime bootstrap race** — the `ON CONFLICT (personal_user_id)` arbiter stops protecting a converted user once `personal_user_id` is cleared; re-creating `Main` would double the seeded rows. Mitigated by the shared advisory-lock family + marker re-check inside the lock (Phase 2.6); validated by dedicated Jest cases and the re-login E2E assertion.
2. **Materialization cost on member-heavy apps** — O(members × shared workspaces) rows; bounded by admin-curated shared workspace counts; one set-based INSERT; idempotent re-runs via partial unique index. Not expected to matter at MVP scale; documented as a modeling limit.
3. **Existing tests pin membership-only visibility** — `listUserWorkspaces` expectations in `applicationWorkspaces.test.ts` and controller access-denied tests stay correct because the membership-only rule remains exactly for `personal`/uninvited cases; only shared-visibility expectations become additive. Careful MR discipline: update assertions rather than deleting coverage (research findings J/K).
4. **`ensurePersonalWorkspaceForUser` early-return path** — when the marker short-circuits creation, the function must still not reset the user's default-workspace flag and must not fail for callers depending on the returned `workspaceId`; handled by returning `null`-safe contract change internally (callers already tolerate null from `resolveRuntimeWorkspaceAccess`).
5. **README-RU parity** — the applications-backend `README-RU.md` lacks a workspace section today (verified during QA); the plan updates the EN "Workspaces, Public Access, and Limits" section in place and adds a short mirrored RU section (no invented content beyond EN facts).
6. **Conversion inside workspace seed template semantics** — seed-owned rows keep `_seed_source_owned = true` after conversion; template updates on further syncs continue materializing into the (now shared) workspace exactly as into any other workspace; no special-casing (behavior verified by existing seed suites).
7. **Sole-owner departure dead-end** — shared workspaces have no admin path for member management, so a user leaving the application while holding the only owner row of a shared workspace would strand it; resolved by an exact fail-closed guard (409 `APPLICATION_MEMBER_WORKSPACE_OWNERSHIP_REQUIRED`, Phase 2.4) instead of inventing auto-transfer UX; tested in the lifecycle suite.
8. **Compile-breakage pins from QA** — mandatory test updates that must not be forgotten: `applicationWorkspaces.test.ts:302` CHECK assertion (two operation kinds), the direct `createSharedWorkspace` test call now requires `applicationId` (`runtimeWorkspaceService.test.ts:185`), controller mock factory gains `convertWorkspaceToShared` and its error-code map, and any full-module `@universo-react/utils/database` mock exposes both `acquireAdvisoryXactLock` and `withTransactionSavepoint`.

## Design Notes

-   No CREATIVE-mode work expected: the UI delta is one menu item + one confirmation dialog on an existing page using existing primitives (`StandardDialog`, `FormDialog` idioms). Visual design follows the existing workspace page geometry (opaque geometry must remain stable — default density, header styling, footer spacing).
-   The API follows the repo's flat REST conventions (`/:applicationId/runtime/workspaces/:workspaceId/convert`), mirroring `/copy` and `/seed/reset` sibling routes.

## Dependencies

-   Internal: no cross-package dependency beyond `@universo-react/utils` (`acquireAdvisoryXactLock`, `withTransactionSavepoint`) and `@universo-react/database` quoting helpers — both already used in the touched files.
-   Timing: shared minimal-Supabase E2E runner has its own run-lock tooling (existing); phases 5 runs must acquire it as existing specs do.
-   Out of scope, tracked elsewhere: `workspaceOpenBehavior last-used` wiring; `copyWorkspace` feature; direct admin-over-someone-else's-workspace conversion.
