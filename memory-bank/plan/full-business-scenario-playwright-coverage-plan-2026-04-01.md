# Full Business Scenario Playwright Coverage Plan

Date: 2026-04-01
Status: Draft for discussion
Owner: Codex

## 1. Purpose

Expand the current browser E2E foundation into a complete business-scenario verification system for the entire existing platform:

- Auth and onboarding
- Global admin roles and permissions
- Global user creation and role assignment
- Metahub creation, membership, settings, branches, migrations, and inner entities
- Publications, publication versions, schema sync, and linked applications
- Applications, connectors, runtime data, migrations, and access control
- Role-based negative cases and permission boundaries
- Visual and interaction regressions that are invisible from code review alone

The goal is not only to validate expected flows, but also to reveal existing latent defects, race conditions, compensation failures, permission leaks, and broken cross-module integrations.

## 2. Current Baseline

The repository already has a valid browser-testing foundation:

- Playwright Test is the primary browser regression runner.
- Playwright MCP is treated as an interactive debugging companion.
- Auth setup provisions a disposable user and persists `storageState`.
- Current coverage is limited to:
  - Auth setup
  - Anonymous/authenticated smoke
  - Metahub create
  - Metahub copy/delete
  - Profile update
  - Two visual checks

This is a good technical base, but it is still only an initial slice of the real business surface.

## 3. Why Playwright Is the Correct Primary Tool

Playwright remains the correct primary framework for the project because it provides all required capabilities in one stack:

- Real browser automation, not DOM-only simulation
- Stable locator model with accessibility-first selectors
- Project dependencies and auth setup reuse via `storageState`
- Retry, trace, video, screenshots, and HTML reports
- Multiple browser contexts in one test for role-to-role interaction scenarios
- Visual comparisons for layout regressions
- Precise actionability checks for disabled buttons, overlays, and modal behaviors

Playwright MCP should remain secondary:

- It is excellent for interactive inspection and debugging.
- It is not the best primary regression engine for large repeatable suites.
- The main CI/local agent loop should stay on Playwright Test CLI to minimize token cost and maximize determinism.

## 4. External Guidance Incorporated

This plan follows current guidance from:

- Playwright auth setup and `storageState`
- Playwright multi-role testing with multiple authenticated contexts
- Playwright locator and isolation best practices
- Playwright retries, traces, screenshots, and failure diagnostics
- Supabase guidance on isolated test data, separate environments, and admin-driven setup/cleanup

References:

- https://playwright.dev/docs/auth
- https://playwright.dev/docs/best-practices
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/test-snapshots
- https://supabase.com/docs/guides/local-development/testing/overview
- https://supabase.com/docs/guides/deployment/managing-environments
- https://supabase.com/docs/reference/javascript/admin-api

## 5. Key Local Risk Areas Found During Codebase Analysis

### 5.1 Admin and Global Access

The platform already exposes route surfaces for:

- instance listing, detail pages, status updates, and stats
- global roles CRUD
- role permission replacement
- role copy
- global user creation
- user role reassignment
- locales CRUD
- admin settings CRUD
- admin dashboard and instance sub-pages
- admin panel access guards

This means browser tests must validate both:

- UI behavior in the admin panel
- Real backend permission enforcement

### 5.2 Metahub Domain Surface Is Much Larger Than Current Coverage

The metahub service already exposes business routes for:

- metahubs
- members
- branches
- publications
- publication versions
- publication-linked applications
- schema diff and sync
- hubs
- catalogs
- sets
- enumerations
- enumeration values
- attributes
- constants
- elements
- layouts
- settings
- migrations

Current Playwright coverage touches only a tiny subset of this.

### 5.3 Applications Domain Has Its Own Full Lifecycle

The applications backend already exposes:

- application CRUD
- membership CRUD
- settings and limits
- runtime rows CRUD
- child tabular rows CRUD
- connectors CRUD
- publication link management
- migrations and rollback surface

These flows must be tested in both isolated and chained scenarios.

### 5.4 Known High-Risk Combined Flow

There is a historically risky combined flow:

- create publication
- immediately create linked application
- immediately generate application schema

The split flow reportedly worked:

- create publication
- create linked application later
- create connector later
- sync schema later

The backend test suite already contains compensation-oriented unit tests around publication/application failures. This is a strong signal that browser-level regression coverage must include both:

- combined happy path
- combined failure/rollback path
- split flow

### 5.5 Permission Bugs Are Likely to Be Latent

The codebase contains several permission systems that must be validated together:

- global admin permissions
- metahub membership permissions
- application membership permissions
- frontend route guards
- backend enforcement
- RLS-backed request-scoped behavior

This is exactly the kind of integration surface where browser E2E catches bugs that unit tests miss.

### 5.6 Existing UI Patterns Must Be Reused, Not Replaced

The frontend already standardizes many of the interaction surfaces that the test plan should target:

- `EntityFormDialog`
- `DynamicEntityFormDialog`
- `ConfirmDeleteDialog` and `ConfirmDialog`
- `RoleFormDialog`
- `PermissionMatrix`
- `ToolbarControls`
- `BaseEntityMenu`
- `useListDialogs`
- existing domain action factories such as `MetahubActions` and `ApplicationActions`

The implementation plan must not invent new test-only UI components or alternate CRUD surfaces unless the product itself requires them. Browser tests should exercise the current user-facing components and shared patterns so that the behavior remains uniform across domains.

## 6. Coverage Model

We should not treat the full suite as one flat set of tests. It must be split into layers.

### 6.1 Layer A: Smoke Contract

Purpose:

- detect that the app starts
- detect auth shell failures
- detect catastrophic routing regressions

Examples:

- `/auth` loads for anonymous user
- authenticated user lands in workspace shell
- admin user can open `/admin`
- non-admin user is denied `/admin`

### 6.2 Layer B: Core Business Flows

Purpose:

- verify the most frequent, highest-value user workflows

Examples:

- metahub create/edit/copy/delete
- publication create/version/sync
- application create/member management/runtime create row

### 6.3 Layer C: RBAC and Negative Flows

Purpose:

- prove that forbidden actions are actually forbidden
- prove that different roles see different UI states and backend outcomes

Examples:

- role without `users.create` cannot create global users
- metahub member without `manageMembers` cannot add/remove members
- application member without delete permission cannot delete runtime rows

### 6.4 Layer D: Combined Regression Flows

Purpose:

- exercise chained multi-module workflows where integration bugs hide

Examples:

- publication with auto-create application
- publication -> linked application -> connector -> publication link -> sync
- metahub migration followed by publication version creation

### 6.5 Layer E: Visual and Interaction Regression

Purpose:

- catch broken layouts, overlays, spacing, disabled states, and modal behavior

Examples:

- primary create dialogs
- admin role form and permission matrix
- publication create dialog
- application connector dialogs

### 6.6 Layer F: Operational Reliability

Purpose:

- keep the suite deterministic
- prevent flaky test debt
- ensure failures are diagnosable by the agent without repeated manual reruns

Examples:

- explicit waiting on business events instead of arbitrary sleeps
- stable runtime defaults for viewport and browser context
- structured traces, screenshots, and videos on failure
- fast-gate vs extended-regression split

## 7. Required Test Personas

The suite must use explicit personas instead of one shared privileged user.

### 7.1 Global Personas

- `bootstrap_superuser`
- `global_roles_admin`
- `global_users_admin`
- `global_readonly_admin`
- `registered_non_admin_user`

### 7.2 Workspace Personas

Per metahub/application, create members with realistic roles:

- owner
- admin or manager
- editor
- contributor/member
- readonly/viewer when supported by the product

### 7.3 Persona Rules

- Use least privilege by default.
- Only use superuser for bootstrap, emergency setup, or explicit superuser tests.
- Every permission-sensitive browser test must declare its persona.
- Avoid validating access with UI-only assumptions; always confirm backend effect or denial.

## 8. Test Data Strategy

### 8.1 Environment Isolation

Keep the existing dedicated E2E environment model:

- `packages/universo-core-backend/base/.env.e2e.local`
- `packages/universo-core-frontend/base/.env.e2e.local`

Prefer a dedicated Supabase test project or branch for E2E. Never reuse a production-like project.

### 8.2 Data Creation Strategy

Use run-scoped unique identifiers:

- `e2e-<suite>-<timestamp>-<hex>`

Apply them consistently to:

- user emails
- metahub names/codenames
- publication names/schema names
- application names
- connector names

### 8.3 Cleanup Strategy

Cleanup must remain server-side and fail-safe:

- record every created resource in a manifest
- delete in reverse dependency order
- keep recovery state if teardown is incomplete
- never delete by broad pattern when exact IDs are available

### 8.4 Factory Strategy

Use hybrid provisioning:

- UI for behavior validation
- API/admin helper for setup acceleration when UI setup is not the subject under test

This keeps the suite fast without losing behavioral confidence.

### 8.5 Deterministic Runtime Strategy

The suite should standardize execution defaults to reduce flaky failures:

- fixed viewport for baseline suites
- explicit browser locale and timezone policy whenever date/time formatting matters
- no `waitForTimeout()` except temporary debugging that is removed before merge
- prefer waiting on:
  - response completion
  - URL change
  - visible UI state
  - persisted API result

If date-sensitive or locale-sensitive features become part of the covered flows, dedicated fixtures should pin:

- browser locale
- timezone
- relevant feature-flag state

## 9. Full Scenario Matrix

### 9.1 Auth and Session

Must cover:

- login with valid credentials
- invalid credentials
- logout
- persisted authenticated session
- expired or invalid session fallback
- `/auth/permissions` load for different personas

Important assertions:

- redirects are correct
- protected routes are guarded
- UI navigation matches permission state

### 9.2 Start and Onboarding

Must cover:

- guest landing page
- legal pages
- registered user access resolution
- start page behavior for incomplete onboarding

### 9.3 Admin Panel Access

Must cover:

- superuser can enter admin panel
- user with admin-related permissions can enter
- regular registered user cannot enter
- deep links to admin routes are blocked for non-admins
- admin board loads for eligible personas
- instance-scoped deep links behave consistently

### 9.3.1 Admin Instances

Must cover:

- instance list loads
- instance board loads
- instance stats load
- allowed instance update flow
- forbidden instance update flow

### 9.3.2 Admin Locales

Must cover:

- locale list loads
- create locale
- edit locale
- delete locale
- refusal to delete system locale
- refusal to delete default locale without replacement
- duplicate locale code rejection

### 9.3.3 Admin Settings

Must cover:

- list all settings
- list by category
- get by key
- single setting update
- bulk category update
- delete/reset setting
- category/key validation errors
- metahubs-specific setting validation

### 9.4 Global Roles Management

Must cover:

- create role
- edit role metadata
- copy role with and without copying permissions
- replace permissions
- delete role with zero users
- refusal to delete role with assigned users if applicable
- duplicate codename rejection
- system role restrictions if applicable

Must include negative tests:

- role without `roles.create` cannot create
- role without `roles.update` cannot edit
- role without `roles.delete` cannot delete

### 9.5 Global Users and Role Assignment

Must cover:

- create new auth user from admin panel
- assign one or multiple roles
- update assigned roles
- revoke roles
- prevent self-role modification where disallowed
- duplicate email rejection

Must include permission validation:

- roles admin without user-create rights cannot create user
- users admin without role-update rights cannot change another user’s roles

### 9.6 Metahub Root Lifecycle

Must cover:

- create metahub with default seed
- create metahub with custom `createOptions`
- edit metahub settings
- copy metahub with and without access copy
- delete metahub
- add/remove/update members

Must include assertions for:

- optimistic UI visibility if present
- persistence through API confirmation
- owner permission defaults
- copied object uniqueness

### 9.6.1 Templates Catalog

Must cover:

- templates catalog loads
- default templates are visible
- template-driven metahub create flow works
- create options interact correctly with the selected template

### 9.7 Branches

Must cover:

- create branch
- activate branch
- set default branch
- delete branch
- blocking users dialog when relevant

### 9.8 Hubs

Must cover:

- root hub create/edit/copy/delete
- nested hub create/edit/delete
- reorder
- blocking catalog behavior on delete

### 9.9 Catalogs

Must cover:

- create/edit/copy/delete catalog at root
- create/edit/copy/delete catalog in hub
- soft-delete -> trash -> restore -> permanent delete
- reorder and move where supported

### 9.10 Sets and Constants

Must cover:

- create/edit/copy/delete set
- create/edit/copy/delete constant
- blocking reference behavior on delete

### 9.11 Enumerations and Values

Must cover:

- create/edit/copy/delete enumeration
- create/edit/copy/delete enumeration value
- reorder values
- restore and permanent delete

### 9.12 Attributes and Elements

Must cover:

- create/edit/move/delete attributes
- create/edit/copy/delete elements
- reorder/move behavior
- system attributes view if exposed in UI

### 9.13 Layouts

Must cover:

- create/edit/copy/delete layout
- assign widgets to zones
- move widgets
- toggle active state
- update widget config

### 9.14 Metahub Settings and Migrations

Must cover:

- load settings page
- update bulk settings
- reset setting by key
- create migration plan
- apply migration
- verify migration guard behavior when unsynced

### 9.15 Publications

Must cover:

- create publication without auto-create application
- create publication with auto-create application
- edit publication
- delete publication
- list linked applications
- verify schema status transitions

High-risk regression block:

- combined flow: publication + auto-create application + schema generation
- split flow: publication first, linked application later, schema sync later
- failure compensation path: partial creation must not leave inconsistent visible state

### 9.16 Publication Versions

Must cover:

- create version
- activate version
- update version metadata
- delete version
- update-available propagation to linked applications

### 9.17 Publication Schema Diff and Sync

Must cover:

- diff view
- initial sync
- repeated sync with no changes
- sync with destructive changes confirmation flow if exposed
- schema error state and recovery

### 9.18 Linked Applications from Publications

Must cover:

- create linked application from publication
- duplicate prevention if applicable
- verify publication link visibility
- verify initial migration payload
- verify linked app reaches usable state

### 9.19 Applications

Must cover:

- create application
- copy application
- edit application
- delete application
- join/leave when applicable
- settings/limits update
- member add/update/remove

### 9.20 Connectors

Must cover:

- create connector
- edit connector
- delete connector
- create publication link
- remove publication link

### 9.21 Application Runtime

Must cover:

- load runtime
- create runtime row
- edit row
- copy row
- delete row
- create/edit/copy/delete child tabular row

Permission block:

- editor can do allowed content writes
- member without delete permission cannot delete row
- readonly user cannot mutate runtime

### 9.22 Application Migrations

Must cover:

- open migrations screen
- inspect status
- inspect single migration
- analyze migration
- rollback flow if available in UI

### 9.23 Public Metahub Runtime

Must cover if exposed in the product:

- public metahub slug route
- public hub/catalog/attribute/element reads
- no auth required
- protected non-public routes still denied

## 10. Browser And Reliability Strategy

### 10.1 Shared UI and Interaction Consistency Rules

The implementation of the test suite must follow the current UI architecture instead of introducing parallel interaction models.

Required constraints:

- Prefer existing dialogs and menus over new test-oriented UI wrappers.
- Prefer existing shared buttons, toolbars, and entity menus over domain-specific one-offs.
- Add `data-testid` only where accessibility-first locators are genuinely insufficient.
- Reuse existing action entry points such as toolbar primary actions and entity menus.
- Do not create alternative CRUD flows only for testability.
- If a surface is inconsistent today, capture it as a product issue first; do not silently normalize it inside the tests.

### 10.2 Browser Matrix Strategy

To keep the loop fast while staying aligned with good cross-browser practice:

- Chromium remains the default gate for local agent-driven development.
- Extended regression should later add Firefox coverage after the core Chromium suite is stable.
- WebKit should be added only after the suite is stable on Chromium and Firefox.

This preserves velocity while creating a controlled path to wider engine coverage.

### 10.3 Failure Artifact Contract

Each failing test should produce enough evidence for agent triage before opening MCP:

- Playwright trace
- failure screenshot
- retained video for failure or retry
- stable HTML report output
- relevant setup/cleanup diagnostics for persona and resource provisioning

The suite should prefer artifact-driven debugging before interactive inspection.

## 11. Permission and Access Matrix

This matrix must be explicit in the implementation backlog.

### 11.1 Admin RBAC

For each admin subject:

- roles
- users
- instances
- locales
- settings

Verify:

- visible navigation
- visible action buttons
- enabled/disabled action state
- API success for allowed actions
- API denial for forbidden actions

### 11.2 Metahub RBAC

For each metahub role:

- access metahub
- edit content
- create content
- delete content
- manage members
- manage metahub

Verify both:

- frontend affordances
- backend denial if UI is bypassed

### 11.3 Application RBAC

For each application role:

- access application
- manage application
- manage members
- create content
- update content
- delete content

## 12. Interaction and Visual Rules

The suite must explicitly test UI state transitions, not only final persisted state.

Required interaction patterns:

- primary action disabled until required fields are valid
- primary action enabled after valid input
- submit loading state
- optimistic row/card appearance if the UI uses optimistic updates
- modal close by close button
- modal close by `Escape`
- modal close or non-close on backdrop click, depending on intended UX
- dirty form confirmation behavior when applicable

Required visual coverage:

- auth page
- admin role form and permission matrix
- metahub create/edit dialogs
- publication create dialog
- linked application create dialog
- connector dialogs
- at least one board/list page for metahubs and applications

## 13. Recommended Test Architecture

### 13.1 Projects

Keep and expand the current project model:

- `setup`
- `smoke`
- `flows`
- `permissions`
- `combined`
- `visual`

Optional future split:

- `admin`
- `metahubs`
- `applications`

### 13.2 Fixtures

Introduce layered fixtures:

- auth state fixtures per persona
- admin API fixture for controlled provisioning
- metahub fixture
- publication fixture
- application fixture
- cleanup manifest fixture

### 13.3 Page Objects

Use page objects only for repeated, high-value surfaces:

- auth page
- metahub list/board
- admin roles
- admin global users
- publication list/dialog
- application list/board/runtime

Avoid over-abstracting one-off flows.

### 13.4 Selector Contract

Selector priority:

1. `getByRole`
2. `getByLabel`
3. `getByText` for stable visible copy
4. targeted `data-testid` only for ambiguous or dynamic widgets

Do not build the suite around brittle CSS selectors.

### 13.5 No-Unnecessary-Abstraction Rule

The suite should not introduce large new abstraction layers unless the codebase already has a matching pattern.

Allowed:

- small page objects for repeated high-value surfaces
- shared persona fixtures
- shared API helpers for setup and cleanup

Avoid:

- giant page-object hierarchies
- custom UI test harnesses that bypass real components
- bespoke dialog wrappers that duplicate `EntityFormDialog` or `RoleFormDialog`
- test-only route branches or hidden dev-only controls

### 13.6 Tagging And Execution Modes

The suite should define explicit tags and execution groups:

- `@smoke`
- `@flow`
- `@permission`
- `@combined`
- `@visual`
- `@slow` for extended-only scenarios

This is necessary to keep the agent workflow efficient and predictable.

## 14. Recommended Code Patterns

### 14.1 Persona-Aware Auth Setup

```ts
import { test as setup, expect } from '@playwright/test'

setup('authenticate roles-admin', async ({ page }) => {
  await page.goto('/auth')
  await page.getByLabel('Email').fill(process.env.E2E_ROLES_ADMIN_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_ROLES_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/metahubs')
  await expect(page.getByRole('navigation')).toBeVisible()
  await page.context().storageState({ path: 'tools/testing/e2e/.auth/roles-admin.json' })
})
```

Why this is safe and performant:

- one real login per persona
- reusable authenticated state
- no secrets exposed to frontend code

### 14.2 API-Assisted Setup with UI Verification

```ts
test('creates a publication and verifies it in the UI', async ({ page, adminApi, metahubFactory }) => {
  const metahub = await metahubFactory.create()
  const publication = await adminApi.createPublication(metahub.id, {
    name: { en: 'E2E Publication' },
    autoCreateApplication: false
  })

  await page.goto(`/metahub/${metahub.id}/publications`)
  await expect(page.getByRole('cell', { name: /e2e publication/i })).toBeVisible()
  await expect.poll(() => adminApi.getPublication(metahub.id, publication.id)).toMatchObject({
    id: publication.id
  })
})
```

Why this is safe and performant:

- setup is fast
- the UI is still validated
- backend persistence is confirmed explicitly

### 14.3 Multi-Role Access Test

```ts
test('readonly metahub member cannot delete a catalog', async ({ browser }) => {
  const owner = await browser.newContext({ storageState: 'tools/testing/e2e/.auth/metahub-owner.json' })
  const readonly = await browser.newContext({ storageState: 'tools/testing/e2e/.auth/metahub-readonly.json' })

  const ownerPage = await owner.newPage()
  const readonlyPage = await readonly.newPage()

  await ownerPage.goto('/metahubs')
  await readonlyPage.goto('/metahubs')

  await readonlyPage.goto('/metahub/test-id/catalogs')
  await expect(readonlyPage.getByRole('button', { name: /delete/i })).toBeHidden()

  const response = await readonlyPage.request.delete('/api/v1/metahub/test-id/catalog/catalog-id')
  expect(response.status()).toBe(403)

  await owner.close()
  await readonly.close()
})
```

Why this is important:

- validates frontend and backend together
- catches permission leaks even when the UI hides the action

### 14.4 Disabled/Enabled Button State

```ts
test('save stays disabled until required fields are valid', async ({ page }) => {
  await page.goto('/admin/instance/test/roles')
  await page.getByRole('button', { name: /create role/i }).click()

  const saveButton = page.getByRole('button', { name: /save/i })
  await expect(saveButton).toBeDisabled()

  await page.getByLabel(/codename/i).fill('e2e_role')
  await page.getByLabel(/name/i).fill('E2E Role')

  await expect(saveButton).toBeEnabled()
})
```

### 14.5 Backdrop Click Behavior

```ts
test('create dialog closes on backdrop click', async ({ page }) => {
  await page.goto('/metahubs')
  await page.getByRole('button', { name: /create metahub/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.locator('[data-testid=\"dialog-backdrop\"]').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('dialog')).toBeHidden()
})
```

This pattern should be used only where the intended UX explicitly allows backdrop-close.

## 15. Phase Plan

### Phase 1: Suite Topology and Personas

- add persona-specific setup projects
- add fixtures for admin/global users/metahubs/applications
- codify role matrix and cleanup helpers

Exit criteria:

- reusable auth states exist for all required personas
- cleanup remains deterministic

### Phase 2: Admin RBAC Coverage

- roles CRUD and permission matrix
- global users creation and role assignment
- admin route-guard negative tests

Exit criteria:

- every admin permission subject has at least one allow and one deny browser test

### Phase 3: Metahub Core CRUD and Membership

- metahub create/edit/copy/delete
- settings
- members
- create options

Exit criteria:

- owner and non-owner paths are covered

### Phase 4: Inner Metahub Entities

- branches
- hubs
- catalogs
- sets
- enumerations
- values
- attributes
- constants
- elements
- layouts

Exit criteria:

- every major entity type has CRUD coverage
- at least one copy flow per entity family is covered where supported

### Phase 5: Publications and Versions

- publication CRUD
- versions CRUD
- diff/sync flows
- auto-create-application combined flow
- split flow regression

Exit criteria:

- known risky publication/application chain is covered by dedicated regression specs

### Phase 6: Applications and Connectors

- application CRUD
- member access
- connector CRUD
- publication links
- settings/limits

Exit criteria:

- application and connector lifecycle is covered end-to-end

### Phase 7: Runtime and Migrations

- runtime row CRUD
- child row CRUD
- application migrations and rollback surface
- metahub migration surface

Exit criteria:

- runtime write permissions are validated for at least three roles

### Phase 8: Visual and Interaction Hardening

- high-value dialogs
- board/list layouts
- disabled/enabled state tests
- modal close/dirty-state interactions

Exit criteria:

- UI regression layer covers the most change-prone surfaces

### Phase 9: Reliability and Flake Control

- remove arbitrary sleeps
- add deterministic waits around async chains
- classify specs as fast gate vs extended regression
- define artifact-first failure triage using traces, screenshots, and videos
- stabilize persona setup and cleanup diagnostics

Exit criteria:

- repeated local runs are stable
- failures are diagnosable from artifacts
- flaky tests are treated as a visible defect category

### Phase 10: Documentation and Developer Guidance

- update E2E README and operational runbook
- update package READMEs affected by the browser-testing system
- add or update GitBook docs under `docs/en` and `docs/ru`
- update both `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`
- keep English as the canonical source and Russian fully synchronized

Expected documentation outputs:

- browser E2E testing guide
- local E2E environment setup guide
- agent workflow guidance for smoke, flow, permission, combined, and visual runs
- debugging guidance for Playwright CLI vs Playwright MCP
- safety guidance for Supabase test environments, bootstrap accounts, and cleanup

Recommended documentation targets:

- `tools/testing/e2e/README.md`
- affected package `README.md` / `README-RU.md` files
- `docs/en/guides/...`
- `docs/ru/guides/...`
- `docs/en/SUMMARY.md`
- `docs/ru/SUMMARY.md`

Exit criteria:

- operational docs match the implemented workflow
- GitBook navigation exposes the new testing guidance in both languages

### Phase 11: Stability, Cost Control, and Browser Matrix Expansion

- split slow specs from fast gate
- add tags and selective run commands
- optimize setup reuse
- define agent workflow triggers
- prepare controlled Firefox extension after Chromium-first stability
- postpone WebKit until justified by stable value and acceptable cost

Exit criteria:

- local agent loop remains affordable
- full regression can run overnight or on-demand

## 16. Execution Order for the Agent

The implementation order should be:

1. strengthen fixtures and personas
2. cover admin RBAC
3. cover metahub root lifecycle
4. cover inner entities
5. cover publications and linked applications
6. cover applications/connectors/runtime
7. add negative permission matrix
8. add visual and interaction layer
9. harden reliability and flake control
10. update READMEs and GitBook docs
11. tune cost and browser coverage strategy

This order gives maximum bug-finding value early while keeping the suite maintainable.

## 17. What Should Explicitly Not Be Done

- Do not use one superuser for all tests.
- Do not use CSS selectors as the primary strategy.
- Do not rely on only UI visibility for permission validation.
- Do not put cleanup logic in browser code.
- Do not reset the whole database before every spec.
- Do not merge all business flows into one giant fragile spec.
- Do not auto-accept visual baseline changes without review.
- Do not invent new UI components or parallel CRUD entry points only to make testing easier.
- Do not fork the documentation flow; keep package READMEs and GitBook docs aligned.
- Do not depend on arbitrary sleeps when a real business event can be awaited.
- Do not add Firefox/WebKit to the default fast local loop before Chromium stability is proven.

## 18. Definition of Done for Full Business Coverage

The plan should be considered complete only when:

- every major route group has browser coverage
- every major entity family has CRUD coverage
- admin/global role workflows are covered
- at least one realistic deny case exists for each major permission boundary
- publication/application combined and split regressions are covered
- runtime create/edit/copy/delete is covered
- visual regressions are covered for the most important dialogs and boards
- teardown is deterministic and recoverable
- the suite is split into fast gate and extended regression modes
- documentation is updated in package READMEs and GitBook docs in both English and Russian
- failure artifacts are sufficient for agent-led diagnosis
- Chromium-first stability is achieved before expanding the browser matrix

## 19. Immediate Next Step

If this plan is approved, the next implementation pass should start with a test inventory and a gap checklist that maps:

- existing specs
- missing specs
- required personas
- required fixtures
- route groups
- entity families
- permission boundaries

This checklist should drive execution in small reviewable batches instead of one massive change set.
