# E2E Coverage Gaps Hardening Plan

Date: 2026-04-02
Status: Draft for discussion
Owner: Codex
Complexity: Level 2 — Moderate (infrastructure is ready, gaps are extensions of existing patterns)

---

## 1. Purpose

Close the remaining browser E2E coverage gaps identified during the post-implementation review of the two previous plans:

- `agent-browser-testing-playwright-plan-2026-03-31`
- `full-business-scenario-playwright-coverage-plan-2026-04-01`

This plan addresses **4 concrete gaps** plus **1 recommended improvement**:

| Gap | Summary | Priority |
|-----|---------|----------|
| **A** | Locale/theme matrix covers only unauthenticated `/auth` page | High |
| **B** | Successful combined publication + application + schema flow is not tested | High |
| **C** | Application without workspaces (shared rows between users) is not tested | High |
| **D** | Entity edit/copy/delete operations for Hub, Catalog, Set, Enumeration are not tested beyond create | Medium |
| **E** | `applyBrowserPreferences` does not set `mui-mode` for MUI v6 dark theme | Medium |

This follow-up is intentionally constrained to **test-layer hardening and helper-layer reuse**. It must not introduce new product-facing UI, new ad-hoc CRUD surfaces, or test-only visual components. Every new assertion should run through the same routes, dialogs, menus, and backend contracts already used by the current application:

- `EntityFormDialog`, `ConfirmDeleteDialog`, `BaseEntityMenu`, `ToolbarControls`, and `useListDialogs`
- Existing list/detail pages such as `MetahubList`, `PublicationList`, `ApplicationList`, and the current settings/runtime pages
- Existing backend/browser helpers in `tools/testing/e2e/support/*`

When a gap can be closed by extending an existing spec or helper, prefer that over creating a parallel test surface.

---

## 1.1 Requirements Traceability

The original technical request included 11 checks. This plan must explicitly distinguish between items that are already covered and only need **regression validation**, and items that still need **new implementation**.

| Requirement | Current state | Plan action |
|-------------|---------------|-------------|
| 1. RU locale + dark theme after English checks | Partially covered | Extend matrix coverage to authenticated pages and fix MUI dark-mode preference handling |
| 2. Fresh-db first start vs second start | Already covered | Keep `test:e2e:restart-safe` in validation scope; no new implementation unless regression is found |
| 3. Codename auto-fill / manual override / reset | Already covered | Re-run targeted validation; no new implementation |
| 4. Metahub create options with and without optional entities | Already covered | Re-run targeted validation; no new implementation |
| 5. Applications with and without workspaces | Partially covered | Add non-workspace shared-rows scenario |
| 6. Publication create variants incl. immediate schema | Partially covered | Add successful combined create+app+schema scenario |
| 7. Constant editing and broader edit coverage | Partially covered | Keep constant-edit regression and extend entity edit coverage where still missing |
| 8. Limits page before schema shows info state | Already covered | Keep targeted validation; no new implementation |
| 9. Long-lived dialog resource churn | Already covered | Keep diagnostics command in validation scope and document when to use it |
| 10. Enumeration value description field in edit/copy and field completeness | Partially covered | Preserve current enum-value regression and extend field-presence coverage for additional entity dialogs |
| 11. VLC attribute copy codename gets copy suffix | Already covered | Re-run targeted validation; no new implementation |

This means the plan must include both:

- **Implementation work** for gaps 1, 5, 6, and part of 7/10
- **Validation-only work** for gaps 2, 3, 4, 8, 9, and 11 so the final acceptance report covers the whole original request

---

## 2. Current Baseline

| Metric | Value |
|--------|-------|
| `@flow` inventory | 28 tests in 25 files |
| `test:e2e:full` | 36/36 passed |
| `test:e2e:restart-safe` | passing |
| `test:e2e:diagnostics` | passing |
| Matrix projects | `ru-light`, `ru-dark` (auth page only) |

All existing infrastructure (fixtures, helpers, selectors, cleanup, provisioning) is fully operational and follows established patterns.

---

## 2.1 Implementation Guardrails For This Repository

The follow-up must stay aligned with the repository’s current architectural direction and must not create side paths that will later need cleanup.

### Shared UI and Interaction Rules

- Reuse `@universo/template-mui` building blocks first
- Reuse existing `EntityFormDialog`, `DynamicEntityFormDialog`, `ConfirmDeleteDialog`, `BaseEntityMenu`, `ToolbarControls`, `FlowListTable`, and `useListDialogs`
- Do not add new product-facing dialogs or alternate admin/runtime CRUD pages just to make tests easier
- Do not add test-only widgets, counters, banners, or hidden routes when the same assertion can be made through an existing page and backend helper

### Shared Code Placement Rules

- If a new helper is needed only for Playwright, place it under `tools/testing/e2e/support/*`
- If a new type becomes reusable beyond E2E, place it in `packages/universo-types`
- If a new pure utility becomes reusable beyond E2E, place it in `packages/universo-utils`
- If a new shared UI helper or selector becomes broadly reusable, prefer `packages/universo-template-mui` over feature-local duplication
- For published-application runtime surfaces, continue to treat `packages/apps-template-mui` as the source of truth for runtime CRUD interaction patterns

### i18n and Text Rules

- Every new user-visible string must be internationalized immediately
- Shared language keys should go into `packages/universo-i18n` when they are cross-package concepts
- Feature-specific strings should follow the current namespace structure of the owning package
- Browser tests should prefer asserting existing translated labels/headings already present in the UI rather than introducing new text just for testability

### Data, IDs, and Safety Rules

- Preserve UUID v7 usage and existing server-generated identifier flows; do not introduce ad-hoc client-generated IDs for this work
- Preserve manifest-driven cleanup as the only supported lifecycle for disposable E2E resources
- Prefer fail-closed assertions and backend verification over optimistic DOM-only assumptions
- Prefer extending existing API helpers over one-off inline fetch logic when a scenario will be reused more than once

### State Management Rules

- If any product code needs to change while closing these gaps, prefer existing TanStack Query query-key and invalidation patterns already used by the relevant screen
- Do not add new state containers or side stores for this follow-up unless a product bug proves they are necessary

### Package and Build Rules

- Respect centralized dependency/version management through `pnpm-workspace.yaml`
- Do not add new dependencies unless the repository lacks an equivalent already in use
- Keep validation on the existing root/targeted PNPM commands already established by the previous Playwright work

---

## 3. Analysis of Each Gap

### 3.1 Gap A — Authenticated Locale/Theme Matrix

**Current state:**
The Playwright config defines `ru-light` and `ru-dark` projects that only run `specs/matrix/*.spec.ts`. The single matrix test (`auth-locale-theme.spec.ts`) uses empty `storageState` and only checks `/auth`.

**Root cause:**
- Matrix projects use `storageState: { cookies: [], origins: [] }` — unauthenticated
- No matrix spec exists for authenticated pages
- The `applyBrowserPreferences` helper sets `i18nextLng` and `isDarkMode` in localStorage but does NOT set `mui-mode` for MUI v6 `useColorScheme()`

**How the app applies locale:**
- `i18next-browser-languagedetector` reads `localStorage.i18nextLng`; normalizes `ru-RU` → `ru`
- `document.documentElement.setAttribute('lang', lang)` is set in `App.tsx`
- Supported locales: `en`, `ru`

**How the app applies theme:**
- Legacy: `localStorage.isDarkMode` → Redux `customizationReducer` → MUI palette
- MUI v6 (new pages): `localStorage.mui-mode` → `useColorScheme()` → `data-mui-color-scheme` attribute
- Both systems coexist; tests must set both keys

**Design decision:**
Do NOT duplicate the full CRUD suite across locale/theme combinations. Instead, add 1–2 **targeted** authenticated matrix specs that exercise real authenticated surfaces (metahubs workspace, admin panel) in Russian and dark theme. The goal is to catch i18n rendering regressions and theme contrast issues, not re-verify business logic.

**QA correction:**
The follow-up should reuse the existing `setup` provisioning output instead of logging in from scratch in every matrix test. The repository already provisions a disposable test user and persists `storage-state.json` in `specs/setup/auth.setup.ts`. The better pattern is:

1. Reuse `storageStatePath` from the setup project for authenticated matrix pages
2. Reuse `readRunManifest()` when test code needs the disposable-user credentials or IDs
3. Apply locale/theme preferences with `page.addInitScript()` **before** the first authenticated navigation in the fresh page/context

This stays aligned with Playwright auth best practices and avoids slower, more failure-prone repeated UI logins.

**Code example — enhanced `applyBrowserPreferences`:**

```typescript
// tools/testing/e2e/support/browser/preferences.ts
export interface BrowserPreferenceOptions {
    language?: string
    isDarkMode?: boolean
}

export async function applyBrowserPreferences(
    page: import('@playwright/test').Page,
    options: BrowserPreferenceOptions = {}
): Promise<void> {
    const language = options.language ?? 'en'
    const isDarkMode = options.isDarkMode ?? false

    await page.addInitScript(
        ({ nextLanguage, nextIsDarkMode }) => {
            window.localStorage.setItem('i18nextLng', nextLanguage)
            window.localStorage.setItem('isDarkMode', String(nextIsDarkMode))
            // MUI v6 useColorScheme() reads this key
            window.localStorage.setItem('mui-mode', nextIsDarkMode ? 'dark' : 'light')
        },
        { nextLanguage: language, nextIsDarkMode: isDarkMode }
    )
}
```

**Code example — authenticated matrix spec:**

```typescript
// tools/testing/e2e/specs/matrix/workspace-locale-theme.spec.ts
import { expect, test } from '@playwright/test'
import {
    applyBrowserPreferences,
    calculateRelativeBrightness
} from '../../support/browser/preferences'
import { storageStatePath } from '../../support/env/load-e2e-env.mjs'
import { readRunManifest } from '../../support/backend/run-manifest.mjs'

test('@smoke authenticated workspace renders in Russian and respects dark/light theme', async ({
    browser
}, testInfo) => {
    const isDarkProject = testInfo.project.name === 'ru-dark'
    await readRunManifest() // asserts setup/provisioning already happened

    const context = await browser.newContext({ storageState: storageStatePath })
    const page = await context.newPage()

    try {
        await applyBrowserPreferences(page, {
            language: 'ru',
            isDarkMode: isDarkProject
        })

        await page.goto('/metahubs')

        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

        const createButton = page.getByTestId('toolbar-primary-action')
        await expect(createButton).toBeVisible()

        const buttonText = await createButton.textContent()
        expect(buttonText).not.toMatch(/^[A-Za-z\s]+$/)

        const backgroundColor = await page.evaluate(
            () => window.getComputedStyle(document.body).backgroundColor
        )
        const brightness = calculateRelativeBrightness(backgroundColor)

        expect(brightness).not.toBeNull()
        if (typeof brightness !== 'number') {
            throw new Error(`Unable to derive page brightness from ${backgroundColor}`)
        }

        if (isDarkProject) {
            expect(brightness).toBeLessThan(140)
        } else {
            expect(brightness).toBeGreaterThan(180)
        }
    } finally {
        await context.close()
    }
})

test('@smoke admin panel renders in Russian and respects dark/light theme', async ({
    browser
}, testInfo) => {
    const isDarkProject = testInfo.project.name === 'ru-dark'
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    try {
        await applyBrowserPreferences(page, {
            language: 'ru',
            isDarkMode: isDarkProject
        })

        // Bootstrap-admin login remains explicit because the setup project stores the disposable user state, not admin state
        await loginThroughUi(page, {
            email: env.bootstrapAdminEmail,
            password: env.bootstrapAdminPassword
        })

        await page.goto('/admin')

        // Verify Russian locale on admin page
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

        // Check that a known heading appears in Russian
        await expect(page.getByRole('heading', { name: 'Экземпляры' })).toBeVisible()

        // Verify theme brightness
        const backgroundColor = await page.evaluate(
            () => window.getComputedStyle(document.body).backgroundColor
        )
        const brightness = calculateRelativeBrightness(backgroundColor)

        expect(brightness).not.toBeNull()
        if (typeof brightness !== 'number') {
            throw new Error(`Unable to derive page brightness from ${backgroundColor}`)
        }

        if (isDarkProject) {
            expect(brightness).toBeLessThan(140)
        } else {
            expect(brightness).toBeGreaterThan(180)
        }
    } finally {
        await context.close()
    }
})
```

**Key architectural note:**
The matrix test file MUST live in `specs/matrix/` to be matched by the `matrixPattern` in `playwright.config.mjs`. The `ru-light` and `ru-dark` projects both set `testMatch: matrixPattern` so they will pick up this file automatically.

The `storageState` for matrix projects is currently empty `{ cookies: [], origins: [] }` because the existing matrix slice only targets `/auth`. For authenticated pages, prefer a **fresh context created inside the test** using `storageStatePath` from setup, then apply browser preferences before the first navigation in that context. That preserves determinism without paying the cost of repeated UI logins for the disposable test user.

---

### 3.2 Gap B — Successful Combined Publication + Application + Schema Flow

**Current state:**
- `publication-create-variants.spec.ts` tests: pub-only ✅, pub+app (no schema) ✅
- `publication-application-regression.spec.ts` tests: combined flow → expects ROLLBACK ✅, split flow → success ✅
- No test for combined flow that SUCCEEDS (pub + app + schema = green)

**Root cause:**
The existing regression test intentionally expects `SCHEMA_SYNC_FAILED` because schema generation in the combined flow requires a fully initialized publication version + snapshot. The test was written to verify compensation/rollback behavior.

**Analysis of combined flow success conditions:**
From the backend controller analysis:
1. Transaction creates Publication → LinkedApplication → PublicationVersion → sets active_version_id
2. Post-transaction: if `createApplicationSchema = true` → `generateFullSchema()` runs
3. Success requires: valid snapshot with catalog definitions, DDL generator succeeds, runtime sync succeeds

The combined flow is designed to work when the metahub has at least one catalog with attributes — the snapshot serialization captures catalogs/attributes, and DDL generates tables from them.

**Why the test expects failure:**
The existing regression test creates a metahub with default entities but does NOT add any custom attributes to catalogs. The schema generation MAY succeed (creating empty-ish tables from system attributes alone) or MAY fail depending on the exact snapshot state. The test was conservative and expected failure.

**Design decision:**
Add a new variant test that:
1. Creates a metahub with a catalog + at least one user attribute
2. Creates publication via the dialog with all three switches ON (version + application + schema)
3. Verifies that the publication, application, AND schema are all created successfully
4. Verifies `schemaStatus === 'synced'` via backend API

**QA correction:**
Prefer extending `publication-create-variants.spec.ts` with the third create variant before introducing a separate spec file. The existing file already owns the create-dialog contract and its helper `createPublicationThroughBrowser(...)` already accepts `createApplicationSchema`. Keeping all three variants together preserves the current test taxonomy and avoids scattering one dialog across multiple specs without a strong reason.

**Code example — successful combined flow test:**

```typescript
// Extend publication-create-variants.spec.ts with a third variant
// or create a new spec: specs/flows/publication-combined-schema-success.spec.ts

test('@flow @combined @slow successful combined publication with application and schema creation', async ({
    page,
    runManifest
}) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} combined schema metahub`
    const metahubCodename = `${runManifest.runId}-combined-schema-mh`

    try {
        // 1. Create metahub with default entities (includes catalog)
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) throw new Error('metahub creation failed')
        recordCreatedMetahub(runManifest, metahub.id)

        // 2. Get the default catalog and add a TEXT attribute
        const catalogs = await listMetahubCatalogs(api, metahub.id)
        const catalog = catalogs?.items?.[0]
        if (!catalog?.id) throw new Error('no default catalog found')

        await createMetahubAttribute(api, metahub.id, catalog.id, {
            name: { en: `Test Attr ${runManifest.runId}` },
            codename: createLocalizedContent('en', `test_attr_${runManifest.runId}`),
            dataType: 'TEXT'
        })

        // 3. Navigate to publications and open create dialog
        await page.goto(`/metahubs/${metahub.id}/publications`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()

        // 4. Fill publication name
        const nameInput = dialog.getByLabel(/name/i).first()
        await nameInput.fill(`E2E ${runManifest.runId} combined pub`)

        // 5. Enable "Create application" switch
        const createAppSwitch = dialog.getByLabel(/create application/i)
        if (!(await createAppSwitch.isChecked())) {
            await createAppSwitch.click()
        }

        // 6. Enable "Create application schema" switch
        const createSchemaSwitch = dialog.getByLabel(/create application schema/i)
        if (!(await createSchemaSwitch.isChecked())) {
            await createSchemaSwitch.click()
        }

        // 7. Submit
        await dialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(dialog).not.toBeVisible({ timeout: 30_000 })

        // 8. Verify via backend API
        const publications = await listPublications(api, metahub.id)
        const pub = publications?.items?.[0]
        expect(pub).toBeDefined()
        expect(pub?.id).toBeTruthy()
        recordCreatedPublication(runManifest, pub!.id)

        // 9. Verify linked application exists
        const apps = await listPublicationApplications(api, metahub.id, pub!.id)
        expect(apps?.items?.length).toBeGreaterThanOrEqual(1)
        const app = apps!.items![0]
        recordCreatedApplication(runManifest, app.id)

        // 10. Verify schema is synced
        const appDetail = await getApplication(api, app.id)
        expect(appDetail?.schemaStatus).toBe('synced')
    } finally {
        await disposeApiContext(api)
    }
})
```

**Performance note:**
This test is tagged `@slow` because DDL schema generation takes real time (5–15 seconds). Timeout should be generous (30s for dialog dismissal).

---

### 3.3 Gap C — Application Without Workspaces (Shared Rows)

**Current state:**
- `application-workspace-regressions.spec.ts` tests workspace-enabled applications where each user sees isolated rows ✅
- No test for the non-workspace case where all members share the same rows

**How non-workspace mode works (from code analysis):**
- `workspacesEnabled: false` is the **default** when creating an application
- Backend: `resolveRuntimeSchemaContext` skips `resolveRuntimeWorkspaceAccess` → `currentWorkspaceId = null`
- Backend: `buildRuntimeActiveRowCondition` does not add `workspace_id` filter
- Backend: `runtimeRowsController.create` does NOT insert `workspace_id` column
- Result: all application members share the same row set

**Design decision:**
Add a companion test in the same regressions spec (or a new file) that:
1. Creates an application with `workspacesEnabled: false` (just omit the field — default)
2. Completes schema sync
3. User A (owner) creates a runtime row
4. User B (invited member) navigates to the same application and sees User A's row
5. User B creates a row
6. User A refreshes and sees both rows

**QA correction:**
The earlier draft referenced a non-existent `createDisposableUser(...)` helper. The real helper surface already supports this scenario through existing primitives:

- `createBootstrapApiContext()` for bootstrap-admin API access
- `createAdminUser(...)` to create the second user
- `recordCreatedGlobalUser(...)` so cleanup removes the extra user automatically
- `createLoggedInApiContext(...)` for a second authenticated API session

Prefer extending `application-workspace-regressions.spec.ts` with the symmetric non-workspace case instead of creating a disconnected parallel spec unless the existing file becomes too large.

**Code example:**

```typescript
// specs/flows/application-shared-rows.spec.ts

test('@flow application without workspaces shows shared rows across users', async ({
    page,
    browser,
    runManifest
}) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        // 1. Create metahub → catalog → attribute → publication → sync → app
        const metahub = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} shared-rows mh` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-shared-rows-mh`)
        })
        if (!metahub?.id) throw new Error('metahub creation failed')
        recordCreatedMetahub(runManifest, metahub.id)

        const catalogs = await listMetahubCatalogs(api, metahub.id)
        const catalog = catalogs?.items?.[0]
        if (!catalog?.id) throw new Error('no default catalog')

        await createMetahubAttribute(api, metahub.id, catalog.id, {
            name: { en: 'Title' },
            codename: createLocalizedContent('en', 'title'),
            dataType: 'TEXT'
        })

        const pub = await createPublication(api, metahub.id, {
            name: { en: `E2E ${runManifest.runId} shared-pub` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            createApplicationSchema: false
            // NOTE: workspacesEnabled defaults to false
        })
        recordCreatedPublication(runManifest, pub.id)
        await waitForPublicationReady(api, metahub.id, pub.id)

        const apps = await listPublicationApplications(api, metahub.id, pub.id)
        const app = apps?.items?.[0]
        if (!app?.id) throw new Error('no linked application')
        recordCreatedApplication(runManifest, app.id)

        // Sync schema
        await createPublicationVersion(api, metahub.id, pub.id, {})
        await syncPublication(api, metahub.id, pub.id)
        await syncApplicationSchema(api, app.id)

        // Verify workspacesEnabled is false
        const appDetail = await getApplication(api, app.id)
        expect(appDetail?.workspacesEnabled).toBe(false)

        // 2. Create a second user via bootstrap admin
        const bootstrapApi = await createBootstrapApiContext()
        const secondUser = await createAdminUser(bootstrapApi, {
            email: `e2e+${runManifest.runId}-shared@example.test`,
            password: runManifest.testUser.password,
            roleIds: []
        })
        await recordCreatedGlobalUser({
            userId: secondUser.userId,
            email: secondUser.email
        })
        await addApplicationMember(api, app.id, {
            email: secondUser.email,
            role: 'editor'
        })

        // 3. User A (test user / owner) creates a row via API
        const rowA = await createRuntimeRow(api, app.id, {
            catalogCodename: catalog.codename,
            values: { title: 'Row from User A' }
        })

        // 4. User B logs in and navigates to the app runtime
        const secondApi = await createLoggedInApiContext(secondUser)
        const runtimeB = await getApplicationRuntime(secondApi, app.id)

        // User B should see User A's row
        const rowsB = runtimeB?.rows ?? []
        const userARow = rowsB.find(r => r.title === 'Row from User A')
        expect(userARow).toBeDefined()

        // 5. User B creates a row
        const rowB = await createRuntimeRow(secondApi, app.id, {
            catalogCodename: catalog.codename,
            values: { title: 'Row from User B' }
        })

        // 6. User A refreshes and sees both rows
        const runtimeA = await getApplicationRuntime(api, app.id)
        const allRows = runtimeA?.rows ?? []
        expect(allRows.length).toBeGreaterThanOrEqual(2)
        expect(allRows.some(r => r.title === 'Row from User A')).toBe(true)
        expect(allRows.some(r => r.title === 'Row from User B')).toBe(true)

        // Cleanup
        await disposeApiContext(secondApi)
        await disposeBootstrapApiContext(bootstrapApi)
    } finally {
        await disposeApiContext(api)
    }
})
```

**Key difference from workspace-enabled test:**
- The workspace test creates the application with `workspacesEnabled: true` and verifies each user sees ONLY their own rows
- The non-workspace test creates with `workspacesEnabled: false` (default) and verifies BOTH users see ALL rows

---

### 3.4 Gap D — Entity Edit/Copy/Delete CRUD Breadth

**Current state:**
- `metahub-domain-entities.spec.ts`: Create for all 4 types (hub, catalog, enumeration, set), Copy+Delete only for Hub
- `metahub-entity-dialog-regressions.spec.ts`: Edit for constant, edit/copy for enum value, copy for attribute
- **No Edit test for:** Hub, Catalog, Set, Enumeration (as entities, not their children)

**What edit dialogs contain (from code analysis):**

| Entity | Edit fields | Additional tabs |
|--------|------------|-----------------|
| Hub | Name (localized), Description (localized, multiline), Codename | Parent Hub selection (if nesting enabled) |
| Catalog | Name (localized), Description (localized, multiline), Codename | Hub selection (N:M) |
| Set | Name (localized), Description (localized, multiline), Codename | Hub selection (N:M) |
| Enumeration | Name (localized), Description (localized, multiline), Codename | Hub selection (N:M) |

**Design decision:**
Add targeted edit tests for Hub and Catalog plus explicit field-presence checks for Set and Enumeration edit/copy dialogs. Hub/Catalog are the best end-to-end persistence representatives, but the original requirement asks for confidence across the broader family of entity dialogs, especially around field completeness. The plan should therefore cover:

- **Hub + Catalog**: full edit persistence through the browser plus API verification
- **Set + Enumeration**: field-presence and submit-path verification in edit/copy dialogs
- Existing constant / enum-value / attribute-copy regressions remain in place and are revalidated

Prefer extending `metahub-entity-dialog-regressions.spec.ts` and `metahub-domain-entities.spec.ts` instead of inventing a new product-facing interaction path.

**Code example — entity edit test:**

```typescript
// Extend metahub-domain-entities.spec.ts or create new file

test('@flow metahub hub and catalog edit dialogs persist name and description changes', async ({
    page,
    runManifest
}) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahub = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} edit-entities mh` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-edit-ent-mh`)
        })
        if (!metahub?.id) throw new Error('metahub creation failed')
        recordCreatedMetahub(runManifest, metahub.id)

        // Get the default hub and catalog
        const hubs = await listMetahubHubs(api, metahub.id)
        const hub = hubs?.items?.[0]
        if (!hub?.id) throw new Error('no default hub')

        const catalogs = await listMetahubCatalogs(api, metahub.id)
        const catalog = catalogs?.items?.[0]
        if (!catalog?.id) throw new Error('no default catalog')

        // --- Test Hub Edit ---
        await page.goto(`/metahubs/${metahub.id}/hubs`)
        await page.getByTestId(
            buildEntityMenuTriggerSelector('hub', hub.id)
        ).click()
        await page.getByTestId(
            buildEntityMenuItemSelector('hub', 'edit', hub.id)
        ).click()

        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()

        // Verify fields are present
        const nameInput = dialog.getByLabel(/name/i).first()
        const descInput = dialog.getByLabel(/description/i).first()
        const codenameInput = dialog.getByLabel(/codename/i).first()
        await expect(nameInput).toBeVisible()
        await expect(descInput).toBeVisible()
        await expect(codenameInput).toBeVisible()

        // Update description
        const newDescription = `Updated hub desc ${runManifest.runId}`
        await descInput.fill(newDescription)

        // Submit
        await dialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(dialog).not.toBeVisible()

        // Verify via API
        const updatedHub = await getMetahubHub(api, metahub.id, hub.id)
        const hubDesc = resolveLocalizedContent(updatedHub?.description)
        expect(hubDesc).toBe(newDescription)

        // --- Test Catalog Edit ---
        await page.goto(`/metahubs/${metahub.id}/catalogs`)
        await page.getByTestId(
            buildEntityMenuTriggerSelector('catalog', catalog.id)
        ).click()
        await page.getByTestId(
            buildEntityMenuItemSelector('catalog', 'edit', catalog.id)
        ).click()

        const catalogDialog = page.getByRole('dialog')
        await expect(catalogDialog).toBeVisible()

        // Verify all fields
        await expect(catalogDialog.getByLabel(/name/i).first()).toBeVisible()
        await expect(catalogDialog.getByLabel(/description/i).first()).toBeVisible()
        await expect(catalogDialog.getByLabel(/codename/i).first()).toBeVisible()

        // Update description
        const newCatalogDesc = `Updated catalog desc ${runManifest.runId}`
        await catalogDialog.getByLabel(/description/i).first().fill(newCatalogDesc)

        await catalogDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(catalogDialog).not.toBeVisible()

        // Verify via API
        // Note: may need a getCatalog helper or use listMetahubCatalogs with filtering
        const updatedCatalogs = await listMetahubCatalogs(api, metahub.id)
        const updatedCatalog = updatedCatalogs?.items?.find(c => c.id === catalog.id)
        const catalogDesc = resolveLocalizedContent(updatedCatalog?.description)
        expect(catalogDesc).toBe(newCatalogDesc)
    } finally {
        await disposeApiContext(api)
    }
})
```

---

### 3.5 Gap E — MUI v6 Dark Theme localStorage Key

**Current state:**
`applyBrowserPreferences` sets `isDarkMode` (legacy Redux) but NOT `mui-mode` (MUI v6 `useColorScheme()`). New MUI v6 pages (from `universo-template-mui/AppTheme`) won't respond to dark mode in tests.

**Fix:**
Add `mui-mode` to the `addInitScript` payload. This is a one-line change in `preferences.ts`.

**Code (shown in Gap A section above).**

---

## 4. Implementation Steps

### Phase 1: Infrastructure Fixes

- [ ] **Step 1.1** — Update `tools/testing/e2e/support/browser/preferences.ts` to set `mui-mode` localStorage key alongside `isDarkMode`
  - One-line add: `window.localStorage.setItem('mui-mode', nextIsDarkMode ? 'dark' : 'light')`
  - This unblocks all dark-theme tests for MUI v6 pages

- [ ] **Step 1.2** — Add a tiny matrix-auth helper only if the existing helpers are not enough
    - Preferred path: reuse `storageStatePath` + `readRunManifest()` directly in the matrix spec
    - Only extract a helper if the same context-bootstrap logic is repeated across multiple matrix tests

- [ ] **Step 1.3** — Add or adjust helper contracts only under a minimal-change rule
    - No speculative helper expansion in `api-session.mjs`
    - Add new helper functions only when they remove verified duplication across at least two tests or materially improve cleanup/safety
    - Reuse existing bootstrap/admin/user provisioning and manifest helpers before introducing new abstractions

### Phase 2: Locale/Theme Matrix Coverage (Gap A)

- [ ] **Step 2.1** — Extend the matrix slice with authenticated-page coverage
  - Authenticated metahubs workspace test in RU + dark/light
  - Authenticated admin panel test in RU + dark/light
    - Disposable-user path should reuse `storageStatePath` from setup in a fresh context; bootstrap-admin path may still log in explicitly
  - Verify: `lang="ru"` attribute, Russian label text on buttons/headings, brightness threshold dark < 140 / light > 180

- [ ] **Step 2.2** — Keep the matrix slice targeted
    - Do not clone CRUD specs into locale/theme projects
    - Keep all locale/theme assertions on existing auth, metahub, and admin surfaces only

### Phase 3: Combined Publication Flow (Gap B)

- [ ] **Step 3.1** — Add successful combined publication + application + schema test
    - Prefer as the third variant in `publication-create-variants.spec.ts`
  - Setup: metahub with catalog + user attribute (needed for meaningful schema)
  - Dialog: all three switches ON
  - Verify via API: publication exists, linked application exists, `schemaStatus === 'synced'`
  - Tag: `@flow @combined @slow`

- [ ] **Step 3.2** — Verify the combined flow actually succeeds on current codebase
  - Before writing the test, manually confirm via Playwright CLI that the dialog completes without error
  - If the combined flow has a genuine bug, document it and plan the fix as a sub-task

- [ ] **Step 3.3** — If product code changes are required, keep them inside the existing publication/application chain only
    - Reuse `PublicationList` dialog options and the current backend create/sync path
    - Do not add separate “special create” actions, debug toggles, or alternate combined-flow endpoints
    - If the bug is in readiness/order-of-operations, fix it in the existing controller/helper seam and extend the relevant backend tests in addition to Playwright coverage

### Phase 4: Non-Workspace Application (Gap C)

- [ ] **Step 4.1** — Extend `tools/testing/e2e/specs/flows/application-workspace-regressions.spec.ts`
  - Setup: metahub → catalog → attribute → publication → linked application (workspaces OFF) → schema sync
  - Two users: test user (owner) + disposable second user (member)
  - User A creates row → User B sees it → User B creates row → User A sees both
  - Backend API verification of row visibility
  - Tag: `@flow`

- [ ] **Step 4.2** — Add missing API helpers to `api-session.mjs` if needed
    - Prefer existing helpers first: `createAdminUser`, `recordCreatedGlobalUser`, `createLoggedInApiContext`, `list*`/`get*`
    - Only add helpers that eliminate real duplication in the new tests
  - Only add what's actually needed by the new tests

### Phase 5: Entity Edit CRUD Breadth (Gap D)

- [ ] **Step 5.1** — Extend existing metahub entity specs instead of creating a parallel test surface
    - `metahub-domain-entities.spec.ts`: add Hub/Catalog edit persistence and any missing create/copy/delete continuity checks
    - `metahub-entity-dialog-regressions.spec.ts`: add Set/Enumeration edit/copy field-presence assertions where still missing
    - Tag: `@flow @combined`

- [ ] **Step 5.2** — Add any missing backend API helpers
  - `getCatalog(api, metahubId, catalogId)` — if not available via existing list endpoint
  - `updateHub(api, metahubId, hubId, payload)` — if needed for API verification

- [ ] **Step 5.3** — Preserve dialog uniformity with the existing entity-action pattern
    - Reuse the already defined edit/copy/delete actions and `BaseEntityMenu` selectors
    - Do not add entity-specific test buttons or custom test-only form variants
    - If a field is missing in one dialog but present in peer entities, fix the real dialog configuration rather than weakening the test expectation

### Phase 6: End-to-End Validation

- [ ] **Step 6.0** — Re-run targeted validation for requirements already considered complete
    - `metahub-create-options-codename.spec.ts` for requirements 3 and 4
    - `application-workspace-regressions.spec.ts` for requirement 8 and workspace-enabled half of requirement 5
    - `metahub-entity-dialog-regressions.spec.ts` for requirements 7, 10, and 11
    - `test:e2e:restart-safe` and `test:e2e:diagnostics` for requirements 2 and 9

- [ ] **Step 6.1** — Run targeted lint/build
  - `pnpm exec eslint` on all new/changed files
  - `pnpm run build:e2e` to verify TypeScript compilation

- [ ] **Step 6.2** — Run individual new specs
  - `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/matrix/workspace-locale-theme.spec.ts`
  - `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/publication-combined-schema-success.spec.ts`
  - `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-shared-rows.spec.ts`
  - `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entity-edit-crud.spec.ts`

- [ ] **Step 6.3** — Run full suite validation
  - `pnpm run test:e2e:full` — all specs including new ones
  - `pnpm exec playwright test -c tools/testing/e2e/playwright.config.mjs --grep @flow --list` — for updated inventory

- [ ] **Step 6.4** — Run restart-safe and diagnostics
  - `pnpm run test:e2e:restart-safe`
  - `pnpm run test:e2e:diagnostics`

- [ ] **Step 6.5** — Produce a final acceptance checklist mapped to the original 11 requirements
    - For each requirement, record one of: `already covered and revalidated`, `newly implemented`, or `fixed during follow-up`
    - For each requirement, record the exact spec(s) and/or command(s) that prove closure
    - Do not close the effort until every original requirement has an explicit proof artifact

### Phase 7: Documentation

- [ ] **Step 7.1** — Update `tools/testing/e2e/README.md`
  - Add section about authenticated locale/theme matrix coverage
  - Update test inventory counts
  - Document the new combined publication schema test

- [ ] **Step 7.2** — Update `tools/testing/e2e/README-RU.md`
  - Mirror all changes from README.md in Russian (i18n-docs instruction compliance)

- [ ] **Step 7.3** — Update `docs/en/guides/browser-e2e-testing.md`
  - Add note about locale/theme testing strategy
  - Add note about shared-rows vs workspace-isolation testing pattern
  - Update test counts and flow inventory

- [ ] **Step 7.4** — Update `docs/ru/guides/browser-e2e-testing.md`
  - Mirror changes from EN version

- [ ] **Step 7.5** — Update memory-bank:
  - `memory-bank/tasks.md` — add new tasks
  - `memory-bank/activeContext.md` — update current focus
  - `memory-bank/progress.md` — add entry after completion

- [ ] **Step 7.6** — Keep documentation aligned with the real implementation boundaries
    - Document which requirements were already covered and are now revalidated
    - Document which new tests were added in the follow-up
    - Do not describe speculative helper APIs or test files that were not actually introduced

---

## 5. Files to Create

| File | Purpose |
|------|---------|
| `tools/testing/e2e/specs/matrix/workspace-locale-theme.spec.ts` | Optional companion matrix file if the existing matrix spec becomes too dense |

## 6. Files to Modify

| File | Change |
|------|--------|
| `tools/testing/e2e/support/browser/preferences.ts` | Add `mui-mode` localStorage key |
| `tools/testing/e2e/support/backend/api-session.mjs` | Add missing API helpers as needed |
| `tools/testing/e2e/specs/matrix/auth-locale-theme.spec.ts` or a companion matrix spec | Add authenticated locale/theme assertions |
| `tools/testing/e2e/specs/flows/publication-create-variants.spec.ts` | Add successful create+app+schema variant |
| `tools/testing/e2e/specs/flows/application-workspace-regressions.spec.ts` | Add non-workspace shared-rows case |
| `tools/testing/e2e/specs/flows/metahub-domain-entities.spec.ts` | Add Hub/Catalog edit persistence coverage |
| `tools/testing/e2e/specs/flows/metahub-entity-dialog-regressions.spec.ts` | Add remaining Set/Enumeration field-presence coverage |
| `tools/testing/e2e/README.md` | Update test inventory and coverage sections |
| `tools/testing/e2e/README-RU.md` | Mirror EN updates |
| `docs/en/guides/browser-e2e-testing.md` | Add locale/theme + shared-rows notes |
| `docs/ru/guides/browser-e2e-testing.md` | Mirror EN updates |
| `memory-bank/tasks.md` | Add new task group |
| `memory-bank/activeContext.md` | Update current focus |
| `memory-bank/progress.md` | Add completion entry |

---

## 7. Potential Challenges and Mitigations

### Challenge 1: Combined publication + schema flow might fail
**Risk:** The combined flow may have a genuine bug where schema creation fails after application creation.
**Mitigation:** Step 3.2 explicitly calls for manual verification via Playwright CLI before writing the test. If the flow has a real bug, we document it and fix it as part of this plan.

### Challenge 2: Authenticated matrix tests increase suite time
**Risk:** Naively logging in inside every matrix test adds avoidable runtime and auth flakiness.
**Mitigation:** Reuse the setup-generated `storageStatePath` for the disposable-user path and keep explicit UI login only where a separate admin session is required.

### Challenge 3: Non-workspace test data isolation
**Risk:** Creating a second user and adding them as an application member requires bootstrap admin API access.
**Mitigation:** Use the existing `createBootstrapApiContext` + `createAdminUser` + `recordCreatedGlobalUser` helpers so cleanup remains manifest-driven and no new persona helper is invented unless duplication appears.

### Challenge 4: Entity menu selectors may differ across entity types
**Risk:** The `buildEntityMenuTriggerSelector` and `buildEntityMenuItemSelector` may use different entity kinds for different surfaces.
**Mitigation:** Read the existing `metahub-domain-entities.spec.ts` to confirm the exact selector patterns used.

### Challenge 5: Follow-up scope may drift into product refactoring
**Risk:** While closing test gaps, it is easy to start “cleaning up” adjacent product code, dialog shapes, or helper APIs that are not required by the original acceptance criteria.
**Mitigation:** Keep each product change directly tied to one of the 11 requirements, and reject opportunistic refactors unless they are necessary to safely fix a discovered defect.

### Challenge 6: Documentation drift between EN and RU
**Risk:** The follow-up touches README and GitBook docs again, which can easily desynchronize EN/RU descriptions or overstate what the suite really covers.
**Mitigation:** Update EN first, mirror RU second, and ensure docs only describe tests and commands that were actually implemented and validated.

---

## 8. Expected Final Metrics

| Metric | Before | After (est.) |
|--------|--------|-------------|
| `@flow` inventory | 28 tests / 25 files | 32+ tests / 29+ files |
| Matrix tests | 1 spec / 2 test runs | 2 specs / 4 test runs |
| `test:e2e:full` total | 36 | ~44+ |
| Coverage gaps closed | — | A, B, C, D, E |

---

## 9. Definition of Done

The follow-up is complete only when all of the conditions below are true:

1. Every original requirement from the 11-point request has an explicit proof path
2. No new product-facing UI surface was introduced solely for testing
3. No speculative helper abstraction was added without real reuse value
4. New user-visible text, if any, is internationalized and documented in EN/RU docs
5. The final browser suite, restart-safe command, and diagnostics command all pass on the validated environment
6. Documentation and memory-bank state match the actual implemented scope, not the draft scope

---

## 10. References

- [Playwright multi-user testing with isolated browser contexts](https://playwright.dev/docs/next/browser-contexts)
- [Playwright locale/timezone emulation](https://playwright.dev/docs/next/test-use-options)
- [Playwright auth and storageState management](https://playwright.dev/docs/next/auth)
- [Playwright CDP performance metrics](https://playwright.dev/docs/next/api/class-cdpsession)
- [MUI v6 useColorScheme documentation](https://mui.com/material-ui/customization/dark-mode/)
- [i18next-browser-languagedetector localStorage key](https://github.com/i18next/i18next-browser-languageDetector)
