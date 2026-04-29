# Plan: Mutable Application Visibility And Runtime Workspace Management UI

> Date: 2026-04-27
> Mode: PLAN / IMPLEMENTATION TRACK
> Status: IMPLEMENTED AND VERIFIED
> Complexity: Level 4 (Major / cross-cutting)
> Scope: application visibility settings, public runtime access boundary, runtime workspace APIs, isolated `apps-template-mui` workspace management UI, tests, screenshots, and GitBook documentation

---

## Overview

This plan improves the existing application/runtime workspace feature in three connected areas:

1. Allow application owners/admins to change application visibility between closed and public after creation.
2. Expose real workspace management inside published applications: users can see their workspaces, create shared workspaces, switch defaults, view workspace members, and owners can add/remove workspace members.
3. Replace the current compact workspace dialog in `packages/apps-template-mui` with a first-class isolated workspace management section that follows the card/list, search, pagination, and member-management patterns used by metahub and application access pages.

The implementation may refactor existing code aggressively because the test database will be recreated. No legacy compatibility layer, metahub schema version bump, or template version bump is required.

---

## Implementation Status

This plan has been implemented and QA-remediated. The final verification pass fixed two late browser findings:

- Runtime CRUD routes now initialize the selected linked collection from the URL `linkedCollectionId` query parameter, so generated LMS applications can open `Modules` deterministically.
- The published-app workspace switcher now renders workspace type chips and browser coverage selects workspaces by UUID, avoiding ambiguity between the built-in shared `Main` workspace and per-user personal `Main` workspaces.

Final browser proof: `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts --project chromium` passed (`2/2`) on 2026-04-27. The flow captures the workspace and member-management screenshots, creates a shared workspace, invites a member, creates a `Modules` runtime row in the shared workspace, switches owner/member workspaces, and verifies shared-vs-personal isolation.

---

## Current Findings

### Backend

- `packages/applications-backend/base/src/controllers/applicationsController.ts` currently rejects `isPublic` and `workspacesEnabled` changes with an "Immutable application parameters" response.
- `packages/applications-backend/base/src/persistence/applicationsStore.ts` already returns `isPublic` and `workspacesEnabled`, but `updateApplication(...)` cannot update `is_public`.
- `packages/applications-backend/base/src/platform/migrations/1800000000000-CreateApplicationsSchema.sql.ts` already has RLS policies that distinguish public app reads and owner/admin updates. This should be rechecked during implementation, but the shape is compatible with mutable visibility.
- `packages/applications-backend/base/src/shared/publicRuntimeAccess.ts` rejects public runtime access when `is_public` is false. This means changing an application from public to closed will also close `/public/a/:applicationId/...` access links unless a new product exception is introduced.
- Runtime workspace APIs already exist under `/applications/:applicationId/runtime/workspaces`, but list endpoints are currently unpaginated and return minimal member data. `listWorkspaceMembers(...)` returns only `{ userId, roleCodename }`, so the UI cannot show email/nickname like access pages do.
- Workspace member invitation currently accepts `userId`, not email. This is hard to use in a published application UI and diverges from `ApplicationMembers` / `MetahubMembers`.
- `runtimeWorkspaceService.ts` already blocks personal workspace member management and last-owner removal. Those guards should be preserved and expanded with tests around paginated/member-profile responses.

### Published App Template

- `packages/apps-template-mui/src/dashboard/components/WorkspaceSwitcher.tsx` already lets authenticated users switch their default workspace.
- `WorkspaceSwitcher` is already rendered in both the desktop `Header` and mobile `AppNavbar`, so it should remain the quick workspace switch entry point across viewport sizes.
- `WorkspaceManagerDialog.tsx` contains create/invite/remove flows, but it is a small dialog, uses ad hoc query keys, lacks pagination/search, and asks for raw user UUIDs.
- `apps-template-mui` already imports shared UI from `@universo/template-mui` in `MainGrid.tsx`, including `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, and `PaginationControls`. These can be used without coupling to `applications-frontend`.
- `MainGrid.tsx` already supports `DashboardDetailsSlot.content` and suppresses the normal table/details rendering through the existing custom-content branch. The workspace page should use this content slot inside the existing dashboard shell instead of introducing a second runtime shell or layout primitive.
- The package should remain isolated: do not import `applications-frontend` page components. Shared types can move to `@universo/types`; shared generic helpers can move to `@universo/utils` only if they are truly reusable.
- The authenticated published runtime is already rendered through `ApplicationRuntime` with route pattern `a/:applicationId/*`, while standalone local rendering is handled by `DashboardApp`. The workspace management section should therefore be integrated as a runtime sub-route/view inside the existing shell instead of introducing a parallel navigation system.
- The existing dashboard menu model already supports `kind: 'link'`. Prefer adding a `link` menu item to `/a/:applicationId/workspaces` over adding a new `DashboardMenuItem.kind`, unless implementation proves the current link path cannot support active state.

### Application Management UI

- `packages/applications-frontend/base/src/pages/ApplicationSettings.tsx` is the right place to expose mutable visibility after creation.
- `ApplicationMembers.tsx` and `MetahubMembers.tsx` are the current UX references for card/list view, pagination, search, member dialogs, role chips, and action menus.
- Application settings currently focus on dialog settings and workspace limits. Visibility belongs in a "General" settings block with optimistic-lock protection.
- `applicationsQueryKeys.lists()` and `runtimeAll(applicationId)` already exist and should be reused for invalidation. The plan must avoid introducing duplicate application-list/runtime key factories in `applications-frontend`.

### Documentation And Testing

- GitBook docs already have application and workspace pages:
  - `docs/en/guides/creating-application.md`
  - `docs/en/guides/workspace-management.md`
  - `docs/en/platform/applications.md`
  - mirrored `docs/ru/**` pages
- Existing test stack:
  - backend Jest in `@universo/applications-backend`
  - frontend Vitest in `@universo/applications-frontend` and `@universo/apps-template-mui`
  - Playwright wrappers under `tools/testing/e2e`
- TanStack Query v5 documentation confirms the target cache pattern: use stable query key factories and invalidate all related list/detail queries from mutation `onSuccess`, preferably returning/awaiting invalidation promises for mutation pending-state accuracy.

---

## Product Decisions To Use In Implementation

1. `isPublic` becomes mutable.
   - Owner/admin can change it after creation.
   - Public to closed blocks new direct joins and public runtime link resolution.
   - Existing application members remain members.

2. `workspacesEnabled` stays structurally immutable after runtime schema creation.
   - It affects runtime DDL, workspace columns, RLS context, seed templates, and schema lineage.
   - The settings UI should show it as read-only with a clear state.
   - Optional pre-sync toggling can be considered later, but this plan keeps the implementation focused on requested visibility mutability and workspace management.

3. Published application workspace management is authenticated runtime UI, not guest LMS UI.
   - Guest/public access links keep their current link-scoped shared workspace behavior.
   - Authenticated users inside `/a/:applicationId` get workspace management if `workspacesEnabled = true`.

4. Workspace member invitation should use email in the UI and API.
   - Backend resolves email through `auth.users`.
   - API may keep `userId` support for internal tests, but the product UI should not ask users for UUIDs.

5. Workspace list and workspace member list must be paginated.
   - Card/list views in the published app use server-backed pagination where possible.
   - Search is server-backed for large lists.

6. The published app workspace UI should be a feature composition, not a new design system.
   - Reuse existing low-level and shared components (`ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls`, local `FormDialog`, local `ConfirmDeleteDialog`, and existing MUI primitives).
   - New files under `src/workspaces/**` should be feature-level orchestration components, not replacement table/card/dialog primitives.

---

## Affected Areas

### Backend

- `packages/applications-backend/base/src/controllers/applicationsController.ts`
- `packages/applications-backend/base/src/persistence/applicationsStore.ts`
- `packages/applications-backend/base/src/controllers/runtimeWorkspaceController.ts`
- `packages/applications-backend/base/src/services/runtimeWorkspaceService.ts`
- `packages/applications-backend/base/src/routes/applicationsRoutes.ts`
- `packages/applications-backend/base/src/routes/publicApplicationsRoutes.ts`
- `packages/applications-backend/base/src/shared/publicRuntimeAccess.ts`
- `packages/applications-backend/base/src/platform/migrations/1800000000000-CreateApplicationsSchema.sql.ts`
- `packages/applications-backend/base/src/tests/**`

### Application Management Frontend

- `packages/applications-frontend/base/src/pages/ApplicationSettings.tsx`
- `packages/applications-frontend/base/src/api/applications.ts`
- `packages/applications-frontend/base/src/api/queryKeys.ts`
- `packages/applications-frontend/base/src/api/mutations.ts`
- `packages/applications-frontend/base/src/types.ts`
- `packages/applications-frontend/base/src/pages/__tests__/ApplicationSettings.test.tsx`

### Published App Template

- `packages/apps-template-mui/src/api/api.ts`
- `packages/apps-template-mui/src/api/mutations.ts`
- `packages/apps-template-mui/src/api/types.ts`
- `packages/apps-template-mui/src/dashboard/Dashboard.tsx`
- `packages/apps-template-mui/src/dashboard/DashboardDetailsContext.tsx`
- `packages/apps-template-mui/src/dashboard/components/WorkspaceSwitcher.tsx`
- `packages/apps-template-mui/src/dashboard/components/WorkspaceManagerDialog.tsx`
- new `packages/apps-template-mui/src/workspaces/**`
- `packages/apps-template-mui/src/i18n/locales/en/apps.json`
- `packages/apps-template-mui/src/i18n/locales/ru/apps.json`
- `packages/apps-template-mui/src/**/__tests__/**`

### Shared Packages

- `packages/universo-types/base/src/common/**` for shared workspace DTOs and role enums if useful.
- `packages/universo-i18n/base/**` only for text shared across product shells. Template-only text should remain in `apps-template-mui`.
- `packages/universo-template-mui/base/**` only if a truly generic reusable surface is needed. Do not move app-specific workspace pages there.

### E2E And Docs

- `tools/testing/e2e/specs/flows/**`
- `tools/testing/e2e/screenshots/**` or existing screenshot fixture locations
- `docs/en/guides/workspace-management.md`
- `docs/ru/guides/workspace-management.md`
- `docs/en/guides/creating-application.md`
- `docs/ru/guides/creating-application.md`
- `docs/en/platform/applications.md`
- `docs/ru/platform/applications.md`
- `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` only if new pages are added
- package READMEs for `applications-backend`, `applications-frontend`, and `apps-template-mui`

---

## Implementation Plan

### Phase 1: Backend Visibility Mutation

- [ ] Update `updateApplication(...)` in `applicationsStore.ts` to accept `isPublic?: boolean`.
- [ ] Remove the blanket immutable rejection for `isPublic` in `applicationsController.ts`.
- [ ] Keep `workspacesEnabled` rejected after creation with a specific response.
- [ ] Preserve optimistic locking with `expectedVersion`.
- [ ] Return the updated `isPublic` value in all list/detail/update responses.
- [ ] Recheck RLS policies in `1800000000000-CreateApplicationsSchema.sql.ts` so owner/admin update can modify `is_public`, while non-members cannot.
- [ ] Add backend Jest coverage:
  - owner/admin can update `isPublic`.
  - member/editor cannot update `isPublic`.
  - stale `expectedVersion` returns the existing optimistic-lock behavior.
  - public to closed removes non-member list visibility and direct join.
  - closed public runtime route returns `403`.

Example store shape:

```ts
export async function updateApplication(
    executor: SqlQueryable,
    input: {
        applicationId: string
        name?: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        settings?: Record<string, unknown> | null
        slug?: string | null
        isPublic?: boolean
        userId: string
        expectedVersion?: number
    }
): Promise<ApplicationRecord | null> {
    const assignments: string[] = []
    const parameters: unknown[] = []

    if (input.isPublic !== undefined) {
        parameters.push(input.isPublic)
        assignments.push(`is_public = $${parameters.length}`)
    }

    // Keep the existing name / description / settings / slug assignments.

    parameters.push(input.userId)
    assignments.push(`_upl_updated_by = $${parameters.length}`)
    assignments.push(`_upl_updated_at = NOW()`)
    assignments.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

    parameters.push(input.applicationId)
    let whereSql = `WHERE id = $${parameters.length} AND ${activeRowPredicate()}`

    if (input.expectedVersion !== undefined) {
        parameters.push(input.expectedVersion)
        whereSql += ` AND COALESCE(_upl_version, 1) = $${parameters.length}`
    }

    const rows = await executor.query<ApplicationRecord>(
        `
        UPDATE applications.cat_applications
        SET ${assignments.join(', ')}
        ${whereSql}
        RETURNING ${APPLICATION_RETURNING}
        `,
        parameters
    )

    return rows[0] ?? null
}
```

Controller validation target:

```ts
const schema = z.object({
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    settings: applicationDialogSettingsSchema.optional(),
    slug: slugSchema.nullable().optional(),
    isPublic: z.boolean().optional(),
    workspacesEnabled: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional()
})

if (parsed.data.workspacesEnabled !== undefined) {
    return res.status(400).json({
        error: 'Immutable application workspace mode',
        details: {
            workspacesEnabled: ['Workspace mode cannot be changed after creation']
        }
    })
}
```

### Phase 2: Runtime Workspace API Contract

- [ ] Introduce shared workspace DTOs, either in `apps-template-mui/src/api/types.ts` or `@universo/types` if reused by backend/frontend:
  - `RuntimeWorkspaceSummary`
  - `RuntimeWorkspaceMember`
  - `RuntimeWorkspaceRole`
  - `RuntimeWorkspaceListResponse`
  - `RuntimeWorkspaceMembersResponse`
- [ ] Extend `listUserWorkspaces(...)` with pagination, search, sort, and member counts.
- [ ] Extend `listWorkspaceMembers(...)` with pagination, search, email, nickname, createdAt, and role.
- [ ] Add `findAuthUserByEmail(...)` reuse or a runtime-workspace-specific resolver for member invitation by email.
- [ ] Reuse the existing application-member email resolution pattern from `applicationsController.ts` where possible, including `findAuthUserByEmail(...)` and active application membership checks.
- [ ] Keep `userId` invitation as an internal-compatible input only if needed, but prefer `{ email, roleCodename }` in the public template API.
- [ ] Add `PATCH /applications/:applicationId/runtime/workspaces/:workspaceId` for shared workspace rename edits if the UI needs settings.
- [ ] Add optional `DELETE /applications/:applicationId/runtime/workspaces/:workspaceId` or archive flow only for shared workspaces if product wants workspace removal now. If not, explicitly leave deletion out of V1.
- [ ] Add controller-level validation:
  - localized or string name input
  - role enum `owner | member`
  - email format for invitation
  - pagination query limits
- [ ] Add fail-closed guards:
  - personal workspace member management remains blocked.
  - non-owner shared workspace members cannot invite/remove.
  - last owner cannot be removed.
  - cannot add a workspace member who is not an application member unless the API explicitly adds them to the application in the same transaction. Prefer fail-closed V1: require application membership first.
- [ ] Keep all runtime workspace SQL under the repository DB access standard:
  - route handlers use request-scoped executors.
  - stores/services accept `DbExecutor` / `SqlQueryable`.
  - all dynamic runtime identifiers go through `qSchemaTable`, `qColumn`, `qTable`, or existing identifier validators.
  - mutations use `RETURNING` or explicit zero-row failure checks when row confirmation matters.

Example safe paginated query shape:

```ts
export async function listWorkspaceMembers(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        limit: number
        offset: number
        search?: string
    }
): Promise<{ items: RuntimeWorkspaceMember[]; total: number }> {
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, '_app_workspace_user_roles')
    const workspaceRolesQt = qSchemaTable(input.schemaName, '_app_workspace_roles')
    const search = input.search ? `%${escapeLikeWildcards(input.search)}%` : null

    const rows = await executor.query<RuntimeWorkspaceMemberRow>(
        `
        WITH filtered AS (
            SELECT
                wur.id,
                wur.user_id,
                r.codename AS role_codename,
                wur._upl_created_at,
                u.email,
                p.nickname
            FROM ${workspaceUserRolesQt} wur
            INNER JOIN ${workspaceRolesQt} r ON r.id = wur.role_id
            LEFT JOIN auth.users u ON u.id = wur.user_id
            LEFT JOIN profiles.cat_profiles p ON p.user_id = wur.user_id
            WHERE wur.workspace_id = $1
              AND wur._upl_deleted = false
              AND wur._app_deleted = false
              AND ($4::text IS NULL OR u.email ILIKE $4 OR p.nickname ILIKE $4)
        )
        SELECT *, COUNT(*) OVER()::int AS total
        FROM filtered
        ORDER BY _upl_created_at ASC, user_id ASC
        LIMIT $2 OFFSET $3
        `,
        [input.workspaceId, input.limit, input.offset, search]
    )

    return {
        items: rows.map(mapWorkspaceMemberRow),
        total: rows[0]?.total ?? 0
    }
}
```

### Phase 3: Application Settings UI For Visibility

- [ ] Add a visibility settings block to `ApplicationSettings.tsx`.
- [ ] Use a `Switch` or segmented control for closed/public state.
- [ ] Show current workspace mode as read-only.
- [ ] Save via `updateApplication(applicationId, { isPublic, expectedVersion })`.
- [ ] Invalidate:
  - `applicationsQueryKeys.detail(applicationId)`
  - application list queries
  - public runtime/public link query effects where applicable.
- [ ] Add EN/RU i18n keys in `applications-frontend`.
- [ ] Add Vitest coverage:
  - shows current visibility.
  - saves public to closed and closed to public.
  - sends `expectedVersion`.
  - shows workspace mode read-only.
  - handles optimistic-lock error.

Example UI mutation target:

```ts
const saveVisibilityMutation = useMutation({
    mutationKey: ['applications', applicationId, 'visibility', 'update'],
    mutationFn: (isPublic: boolean) =>
        updateApplication(applicationId!, {
            isPublic,
            expectedVersion: applicationQuery.data?.version ?? 1
        }),
    onSuccess: async ({ data }) => {
        queryClient.setQueryData(applicationsQueryKeys.detail(applicationId!), data)
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(applicationId!) }),
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
        ])
    }
})
```

### Phase 4: `apps-template-mui` Workspace API Layer

- [ ] Replace ad hoc fetches in `WorkspaceSwitcher.tsx` and `WorkspaceManagerDialog.tsx` with typed API helpers:
  - `fetchRuntimeWorkspaces`
  - `createRuntimeWorkspace`
  - `updateDefaultRuntimeWorkspace`
  - `fetchRuntimeWorkspaceMembers`
  - `inviteRuntimeWorkspaceMember`
  - `removeRuntimeWorkspaceMember`
- [ ] Add a query key factory in `apps-template-mui/src/api/mutations.ts` or a new `workspaceQueries.ts`.
- [ ] Include pagination/search params in query keys.
- [ ] Invalidate all affected workspace and runtime data after mutations.
- [ ] Validate API responses with Zod.
- [ ] Keep CSRF through `fetchWithCsrf`.
- [ ] Preserve the two current runtime host modes:
  - `DashboardApp` standalone mode uses direct `fetch` helpers from `apps-template-mui`.
  - `ApplicationRuntime` production mode may call the same `apps-template-mui` helpers with `/api/v1` and credentials, or wrap them from `applications-frontend` only when the existing authenticated `apiClient` behavior is required.
- [ ] Avoid adding a second runtime query-key convention. Workspace query keys should live alongside `appQueryKeys` in `apps-template-mui`, while `applications-frontend` should keep using `applicationsQueryKeys.runtimeAll(applicationId)` for authenticated runtime invalidation.

Example query key factory:

```ts
export const workspaceQueryKeys = {
    all: (applicationId: string) => ['runtime-workspaces', applicationId] as const,
    list: (applicationId: string, params: RuntimeWorkspaceListParams) =>
        [...workspaceQueryKeys.all(applicationId), 'list', normalizePaginationParams(params)] as const,
    detail: (applicationId: string, workspaceId: string) =>
        [...workspaceQueryKeys.all(applicationId), 'detail', workspaceId] as const,
    members: (applicationId: string, workspaceId: string, params: RuntimeWorkspaceMemberListParams) =>
        [...workspaceQueryKeys.detail(applicationId, workspaceId), 'members', normalizePaginationParams(params)] as const
}
```

Mutation invalidation target:

```ts
onSuccess: async (_data, variables) => {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all(applicationId) }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.list(applicationId) }),
        queryClient.invalidateQueries({ queryKey: ['runtime', applicationId] })
    ])
}
```

### Phase 5: First-Class Published App Workspace Section

- [ ] Create an isolated workspace feature folder:

```text
packages/apps-template-mui/src/workspaces/
├── RuntimeWorkspacesPage.tsx
├── RuntimeWorkspaceMembersPanel.tsx
├── RuntimeWorkspaceCard.tsx
├── RuntimeWorkspaceActions.tsx
├── RuntimeWorkspaceFormDialog.tsx
├── RuntimeWorkspaceMemberFormDialog.tsx
├── hooks.ts
├── types.ts
└── __tests__/
```

- [ ] Use `@universo/template-mui` components already consumed by `apps-template-mui`:
  - `ViewHeaderMUI`
  - `ToolbarControls`
  - `ItemCard`
  - `FlowListTable`
  - `PaginationControls`
  - `EmptyListState`
  - `SkeletonGrid`
  - existing MUI `Chip` for workspace roles unless `RoleChip` can be reused without role-label drift.
- [ ] Use local `apps-template-mui` dialogs where possible:
  - `packages/apps-template-mui/src/components/dialogs/FormDialog.tsx`
  - `packages/apps-template-mui/src/components/dialogs/ConfirmDeleteDialog.tsx`
  This keeps the published template isolated and avoids importing application/metahub access dialogs.
- [ ] Render the workspace section through the existing dashboard details content override:
  - pass `RuntimeWorkspacesPage` through `DashboardDetailsSlot.content` when the `/workspaces` sub-route is active.
  - rely on the existing `MainGrid` custom-content branch to hide the normal runtime table/details view.
  - keep `Dashboard`, `Header`, `AppNavbar`, `SideMenu`, and `AppMainLayout` as the only runtime shell.
  - do not create a second workspace-specific shell, nested page card, or parallel layout system.
- [ ] Build a two-pane responsive page:
  - top toolbar with search, view toggle, create shared workspace action.
  - left/main workspace collection in card/list view.
  - selected workspace member panel below or side-by-side on desktop.
  - member panel has its own search, pagination, card/list option if needed.
- [ ] Do not nest cards inside cards. Use unframed sections and individual cards only for repeated workspace/member items.
- [ ] Keep mobile ergonomics:
  - selected workspace expands inline.
  - member actions are icon buttons with tooltips.
  - no text overlap in compact widths.
- [ ] Keep `WorkspaceSwitcher` for quick switching in both desktop and mobile headers, but change the manage icon to navigate/open the full workspace section instead of only opening the old dialog.
- [ ] Either delete `WorkspaceManagerDialog.tsx` or turn it into a thin compatibility wrapper that opens the new section/dialogs. Since no legacy is required, prefer removal after tests are migrated.
- [ ] Add a menu entry in published app navigation when `workspacesEnabled = true`.
  - Use isolated `apps-template-mui` menu/rendering code, not `applications-frontend`.
  - Prefer the existing `kind: 'link'` menu item and `href: /a/:applicationId/workspaces`.
  - Add a new menu item kind only if the existing link path cannot represent selected/active state after a small local enhancement.
- [ ] Add route/view state to switch between runtime data and workspace management inside the published app:
  - canonical target: `/a/:applicationId/workspaces` for authenticated dashboard routes.
  - standalone `DashboardApp` should parse the same path/hash form for local testing.
  - the normal runtime data view remains the default `/a/:applicationId`.

Example component boundary:

```tsx
export function RuntimeWorkspacesPage({ applicationId, apiBaseUrl }: RuntimeWorkspacesPageProps) {
    const { t, i18n } = useTranslation('apps')
    const [view, setView] = useViewPreference('runtime-workspaces-view', 'card')
    const workspaces = useRuntimeWorkspaces({ applicationId, apiBaseUrl })

    return (
        <Box sx={{ width: '100%', minWidth: 0 }}>
            <ViewHeader
                search
                title={t('workspace.page.title')}
                searchPlaceholder={t('workspace.page.searchPlaceholder')}
                onSearchChange={workspaces.setSearch}
            >
                <ToolbarControls
                    viewToggleEnabled
                    viewMode={view}
                    onViewModeChange={setView}
                    primaryAction={{
                        label: t('workspace.actions.create'),
                        startIcon: <AddRoundedIcon />,
                        onClick: workspaces.openCreateDialog
                    }}
                />
            </ViewHeader>

            {view === 'card' ? (
                <RuntimeWorkspaceCardGrid items={workspaces.items} />
            ) : (
                <RuntimeWorkspaceTable items={workspaces.items} />
            )}

            <PaginationControls
                pagination={workspaces.pagination}
                actions={workspaces.actions}
                isLoading={workspaces.isLoading}
                namespace='apps'
            />
        </Box>
    )
}
```

### Phase 6: Internationalization

- [ ] Add all `apps-template-mui` workspace keys to:
  - `packages/apps-template-mui/src/i18n/locales/en/apps.json`
  - `packages/apps-template-mui/src/i18n/locales/ru/apps.json`
- [ ] Avoid hardcoded fallback strings in new UI except test-only labels.
- [ ] Add application settings visibility keys to application frontend locales.
- [ ] Check whether common member labels should move to `packages/universo-i18n`; do this only for text shared by multiple packages.
- [ ] Add locale tests for missing EN/RU workspace keys if the package has existing i18n validation utilities.

Suggested key groups:

```json
{
  "workspace": {
    "page": {
      "title": "Workspaces",
      "searchPlaceholder": "Search workspaces"
    },
    "actions": {
      "create": "Create workspace",
      "inviteMember": "Add member",
      "setDefault": "Set as default",
      "removeMember": "Remove member"
    },
    "fields": {
      "name": "Name",
      "codename": "Codename",
      "email": "Email",
      "role": "Role"
    }
  }
}
```

### Phase 7: Tests

#### Backend Jest

- [ ] `applicationsRoutes.test.ts`
  - visibility update success and failures.
  - public/closed join behavior after update.
  - optimistic lock on visibility updates.
- [ ] `publicApplicationsRoutes.test.ts`
  - closed app rejects public link resolution after visibility update.
  - public app still resolves active shared workspace links.
- [ ] `runtimeWorkspaceController.test.ts`
  - paginated workspace list.
  - paginated member list with profile fields.
  - invite by email.
  - non-owner invite/remove denied.
  - personal workspace invite/remove denied.
- [ ] `runtimeWorkspaceService.test.ts`
  - SQL predicates include active rows and workspace type constraints.
  - duplicate membership normalization remains intact.
  - last owner removal remains blocked.

#### Frontend Vitest

- [ ] `applications-frontend`:
  - `ApplicationSettings.test.tsx` for visibility UI.
  - API wrapper tests for `isPublic` update payloads.
  - query key invalidation tests.
- [ ] `apps-template-mui`:
  - API helper response validation.
  - workspace query key factory.
  - `RuntimeWorkspacesPage` card/list/search/pagination.
  - `RuntimeWorkspaceMembersPanel` owner vs member permissions.
  - `WorkspaceSwitcher` invalidates runtime data after default switch.
  - `MainGrid` renders `DashboardDetailsSlot.content` for the workspace section and suppresses the normal runtime table/details content.
  - desktop `Header` and mobile `AppNavbar` keep `WorkspaceSwitcher` visible on the workspace section.
  - runtime sub-route selection between default data view and `/workspaces`.
  - menu link rendering/active state for the workspace section.
  - i18n rendering in EN/RU.

#### Playwright

- [ ] Add a focused Playwright flow, for example:
  - create metahub and publication.
  - create workspace-enabled closed app.
  - sync application runtime.
  - open app settings and switch to public.
  - verify public join/link behavior.
  - open published app as owner.
  - create shared workspace.
  - add another application member to shared workspace.
  - sign in as that member and verify workspace appears.
  - switch app back to closed and verify new public join/public link is rejected.
- [ ] Capture screenshots for:
  - application settings visibility block.
  - published app workspace card view.
  - published app workspace list view.
  - workspace members panel.
  - permission-restricted member view.
  - mobile viewport.
- [ ] Use the Playwright wrapper/CLI on port 3100 as requested. Do not run `pnpm dev`.
- [ ] Store/update screenshots according to the existing docs and E2E screenshot conventions.

### Phase 8: Documentation And READMEs

- [ ] Update package READMEs:
  - `packages/applications-backend/base/README.md`: visibility is mutable; workspace mode remains structural; runtime workspace management endpoints.
  - `packages/applications-frontend/base/README.md`: settings page visibility controls.
  - `packages/apps-template-mui/README.md`: workspace management section and API helpers.
- [ ] Update GitBook docs in EN/RU:
  - creating application: public/closed can be changed after creation.
  - workspace management: published app workspace section, roles, personal vs shared workspaces.
  - applications platform page: visibility lifecycle and public access effects.
- [ ] Add or refresh screenshots generated by Playwright.
- [ ] Run docs validation scripts if available after implementation.

### Phase 9: Validation Commands

Use focused commands first:

```bash
pnpm --filter @universo/applications-backend test
pnpm --filter @universo/applications-frontend test
pnpm --filter @universo/apps-template-mui test
pnpm --filter @universo/applications-backend build
pnpm --filter @universo/applications-frontend build
pnpm --filter @universo/apps-template-mui build
```

Then run integration validation:

```bash
pnpm --filter @universo/types build
pnpm --filter @universo/utils build
pnpm --filter @universo/core-frontend build
pnpm build
```

Playwright:

```bash
node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-runtime-workspaces.spec.ts --project chromium
```

Do not start `pnpm dev`; the browser proof should use the existing Playwright CLI/wrapper flow.

---

## Risks And Mitigations

1. **Visibility controls public runtime links.**
   - Existing `resolvePublicRuntimeSchema(...)` blocks non-public apps.
   - Mitigation: document this explicitly and add tests for public to closed.

2. **Workspace mode is DDL-backed.**
   - Making `workspacesEnabled` mutable would require runtime schema migration/removal rules.
   - Mitigation: keep it read-only after creation in this plan.

3. **Member invitation by email can cross application/workspace boundaries.**
   - Mitigation: reuse existing application-member lookup semantics and require active application membership for V1 shared-workspace invitation. If product later wants cross-workspace invitation to also add application membership, implement that as a single explicit transaction with dedicated tests.

4. **Published app template must remain isolated.**
   - Mitigation: use shared primitives from `@universo/template-mui`, but keep runtime workspace pages and hooks inside `apps-template-mui`.

5. **Query invalidation can miss runtime data after default workspace switch.**
   - Mitigation: centralize query keys and invalidate workspace lists, member lists, and runtime app data in mutation `onSuccess`.

6. **Large workspace/member lists need server pagination.**
   - Mitigation: add backend pagination before building UI pagination.

7. **Screenshots can pass while UX is cramped on mobile.**
   - Mitigation: require desktop and mobile Playwright screenshots for card/list/member views.

8. **A new workspace section could accidentally diverge from the existing access-page UX.**
   - Mitigation: mirror the `ApplicationMembers` / `MetahubMembers` structure: `ViewHeaderMUI`, `ToolbarControls`, card/list toggle, `ItemCard`, `FlowListTable`, and `PaginationControls`.

9. **A custom runtime navigation model would duplicate existing menu behavior.**
   - Mitigation: use the current dashboard `link` menu item support and route detection first. Only add menu-model fields when the current model cannot express active state safely.

10. **A new workspace page could duplicate the dashboard shell.**
   - Mitigation: render the page through `DashboardDetailsSlot.content` and the existing `MainGrid` custom-content branch, keeping `Header`, `AppNavbar`, `SideMenu`, and `AppMainLayout` unchanged.

---

## QA Review Addendum — 2026-04-27

The QA review found that the core architecture is correct but needed tighter implementation guidance:

- The original requirements are covered: mutable closed/public setting, visible/manageable runtime workspaces in published apps, and an isolated `apps-template-mui` UI with card/list/pagination parity.
- UI unification is now explicit: the workspace section should reuse the same primitives and layout pattern as `ApplicationMembers` and `MetahubMembers`, while keeping feature code inside `apps-template-mui`.
- The route architecture is clarified: use the existing `a/:applicationId/*` runtime route and add `/a/:applicationId/workspaces` as a sub-route/view.
- The navigation architecture is clarified: prefer existing `kind: 'link'` menu items instead of inventing a new menu item kind.
- The dashboard composition architecture is clarified: use `DashboardDetailsSlot.content` and the existing `MainGrid` custom-content branch for the workspace page, while keeping `WorkspaceSwitcher` in the existing desktop and mobile headers.
- The backend security model is clarified: use request-scoped executors, schema-qualified SQL, safe identifier helpers, fail-closed membership checks, and existing email/member lookup patterns.
- MUI X Data Grid documentation confirms that server-side pagination should be paired with server-side filtering/sorting for large datasets. The plan therefore keeps server-backed pagination/search for workspace and member lists instead of relying on client-only filtering.

## Implementation QA Remediation Addendum — 2026-04-27

The implementation QA pass found several defects that were fixed before closeout:

- The published runtime workspace route no longer depends on the normal CRUD runtime adapter. `/workspaces` now renders through the existing dashboard shell even if the application has no linked data sections.
- `DashboardDetailsSlot` now receives `currentWorkspaceId` and `workspacesEnabled` from runtime data on normal runtime routes, so the workspace switcher can render correctly.
- The standalone `apps-template-mui` dashboard uses the same route bypass for `/a/:applicationId/workspaces`.
- `setDefaultWorkspace` now runs in a transaction and confirms the target membership with `RETURNING` before succeeding.
- `removeWorkspaceMember` now runs in a transaction, locks the target membership and remaining owner rows, prevents concurrent last-owner removal, and confirms the soft delete with `RETURNING`.
- Shared workspace create/edit/copy mutations are name-only; runtime workspace identity is the generated UUID, so there is no separate workspace machine-name uniqueness contract.
- Runtime member-list SQL now safely casts UUIDs in text sorting, and workspace invitation membership checks qualify active-row columns in joined queries.
- The runtime invite dialog uses the existing accessible MUI `TextField select` pattern and trims email input before submit.
- Backend service/controller tests now cover paginated list contracts, name-only workspace mutations, transactional default switching, and member removal guards.
- `RuntimeWorkspacesPage.test.tsx` now directly covers the isolated published-app workspace UI for workspace cards, member rows, and email invite submission.
- `ApplicationRuntime.test.tsx` now verifies that `/workspaces` does not create the runtime CRUD adapter and does not render CRUD dialogs.
- Playwright now reaches the real workspace-management UI, creates a shared workspace, invites a member, and captures desktop screenshots. The remaining failure is after that proof, in the LMS runtime row-isolation phase, because the generated LMS application runtime schema has no linked collections.

---

## Discussion Checklist

- [ ] Confirm that switching public to closed should disable public runtime access links.
- [ ] Confirm that workspace member invitation should require existing application membership.
- [ ] Confirm that `workspacesEnabled` should remain immutable after creation/runtime schema sync.
- [ ] Confirm whether V1 needs shared workspace archive/delete, or only create/manage members/switch default.
- [ ] Confirm the clarified route shape for the published app workspace section: canonical `/a/:applicationId/workspaces`, with standalone `DashboardApp` parsing the same path/hash form for local testing.
