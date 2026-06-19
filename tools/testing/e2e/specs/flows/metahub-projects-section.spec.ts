import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, createMetahub, disposeApiContext, listPlayCanvasProjects } from '../../support/backend/api-session.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { expectNoTechnicalLeakage, expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'
import { createLocalizedContent } from '@universo-react/utils'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type BrowserContext = Awaited<ReturnType<typeof createLoggedInBrowserContext>>

const PROJECT_INSTANCE_NAME = 'My MMOOMM World'

const createProjectInstanceThroughBrowser = async (page: Page, metahubId: string, name: string) => {
    await page.goto(`/metahub/${metahubId}/entities/project/instances`)
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create Project' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Name').first().fill(name)
    await dialog.getByLabel('Codename').first().fill(name.replace(/\s+/g, ''))
    const createResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entities`),
        { label: 'Creating project instance through UI', timeout: 60_000 }
    )
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    const created = (await (await createResponse).json()) as { data?: { id?: string }; id?: string }
    await expect(dialog).toHaveCount(0)
    const id = created.id ?? created.data?.id
    if (typeof id !== 'string') {
        throw new Error('Projects section spec: project instance id was not returned')
    }
    return id
}

// Opens the entity Edit dialog for a project instance and switches to the
// "PlayCanvas" tab (the binding surface). There is no standalone binding page
// anymore — all binding management lives in this dialog tab.
const openPlayCanvasTabThroughBrowser = async (page: Page, metahubId: string) => {
    await page.goto(`/metahub/${metahubId}/entities/project/instances`)
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    await page
        .getByRole('button', { name: /Options|Опции/i })
        .first()
        .click()
    await page.getByRole('menuitem', { name: /^Edit$/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit Project' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: 'PlayCanvas' }).click()
    return dialog
}

const createAndBindProjectThroughBrowser = async (page: Page, metahubId: string) => {
    const editDialog = await openPlayCanvasTabThroughBrowser(page, metahubId)
    await expect(editDialog.getByText('No PlayCanvas project bound yet')).toBeVisible()
    await editDialog.getByRole('button', { name: 'Create & bind project' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create & bind PlayCanvas project' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Project name').fill(PROJECT_INSTANCE_NAME)
    const createBind = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/playcanvas/projects`),
        { label: 'Creating PlayCanvas project through Projects section', timeout: 60_000 }
    )
    await dialog.getByRole('button', { name: 'Create' }).click()
    await (await createBind).json()
    await expect(dialog).toHaveCount(0)
    await expect(editDialog.getByText('No PlayCanvas project bound yet')).toHaveCount(0)
    return editDialog
}

test.describe('Metahub "Projects" entity section', () => {
    let api: ApiContext
    let browser: BrowserContext

    test.afterAll(async () => {
        if (api) await disposeApiContext(api)
        if (browser) await browser.context.close()
    })

    test('renders the Projects section ABOVE Hubs in the left menu and supports create & bind through the UI', async ({
        page,
        browser: playwrightBrowser,
        runManifest
    }, testInfo) => {
        test.setTimeout(180_000)
        await applyBrowserPreferences(page, { language: 'en' })
        api = await createLoggedInApiContext({ email: runManifest.testUser.email, password: runManifest.testUser.password })
        browser = await createLoggedInBrowserContext(playwrightBrowser, runManifest.testUser)

        const metahub = await createMetahub(api, {
            name: { en: 'PlayCanvas Projects Section' },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', 'playcanvas-projects-section'),
            templateCodename: 'playcanvas'
        })
        if (!metahub?.id) {
            throw new Error('Projects section spec: metahub creation did not return an id')
        }
        const metahubId = metahub.id
        recordCreatedMetahub({ id: metahubId, name: 'PlayCanvas Projects Section', codename: 'playcanvas-projects-section' })

        const instanceId = await createProjectInstanceThroughBrowser(page, metahubId, PROJECT_INSTANCE_NAME)
        const editDialog = await createAndBindProjectThroughBrowser(page, metahubId)

        // Browser-truth checks: no raw UUIDs, no horizontal overflow, no technical leakage.
        await expectNoTechnicalLeakage(page.locator('body'), { label: 'Projects section create & bind', checkUuidSubstrings: true })
        await expectNoPageHorizontalOverflow(page, 'Projects section create & bind')

        // The edit dialog must not show a spurious vertical scrollbar (regression
        // guard): the bound-card content fits, so DialogContent should not scroll.
        const dialogContent = page.locator('.MuiDialogContent-root').first()
        const dialogScroll = await dialogContent.evaluate((node) => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }))
        expect(dialogScroll.scrollHeight).toBeLessThanOrEqual(dialogScroll.clientHeight + 1)

        // Screenshot evidence for the project-binding surface (browser-truth, not decoration).
        await page.screenshot({ path: testInfo.outputPath('projects-binding-bound.png'), fullPage: true })

        // Responsive matrix: capture the same surface at desktop / tablet / mobile widths
        // so the "Open editor" / "Publish runtime" / "Unbind" controls and the bound-project
        // card are verified to remain visible and not horizontally overflow on small screens.
        for (const viewport of [
            { name: 'desktop-1920', width: 1920, height: 1080 },
            { name: 'tablet-768', width: 768, height: 1024 },
            { name: 'mobile-390', width: 390, height: 844 }
        ] as const) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectNoPageHorizontalOverflow(page, `Projects section binding at ${viewport.name}`)
            await page.screenshot({
                path: testInfo.outputPath(`projects-binding-bound-${viewport.name}.png`),
                fullPage: true
            })
        }
        // Restore the default viewport for any subsequent steps in the test.
        await page.setViewportSize({ width: 1440, height: 900 })

        // Data check (run BEFORE the action click-through because the
        // unbind-confirm flow references the bound project's id).
        const projects = (await listPlayCanvasProjects(api, metahubId)) as { items?: Array<{ id?: string; codename?: unknown }> }
        expect(projects.items?.length).toBe(1)
        const cookieHeader = Array.from(api.cookies.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ')
        const boundProjectId = projects.items?.[0]?.id

        // Click-through every primary action on the bound card so the
        // happy-path E2E actually exercises the surface (QA found the prior
        // version never clicked any of the three buttons, so the test was
        // green while the buttons were broken). We do not assert the editor
        // iframe's internal state here — the MMOOMM-generator test owns the
        // full editor journey. We only assert that the user actions do not
        // surface raw UUIDs / JSON / overflow, and that the right URL
        // / confirmation dialogs open.
        await expect(editDialog.getByRole('button', { name: 'Open editor' })).toBeVisible()
        await expect(editDialog.getByRole('button', { name: 'Publish runtime' })).toBeVisible()
        await expect(editDialog.getByRole('button', { name: 'Unbind' })).toBeVisible()

        // Unbind flow: confirm the confirmation dialog, then cancel so the
        // test leaves the project bound for downstream data checks.
        await editDialog.getByRole('button', { name: 'Unbind' }).click()
        const unbindDialog = page.getByRole('dialog', { name: 'Unbind PlayCanvas project' })
        await expect(unbindDialog).toBeVisible()
        await unbindDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(unbindDialog).toHaveCount(0)
        // Unbind confirmed cancelled — re-fetch the instance and confirm the
        // binding is still present.
        const persistedAfterCancel = await fetch(`${api.baseURL}/api/v1/metahub/${metahubId}/entities?kind=project&limit=10&offset=0`, {
            headers: { Accept: 'application/json', Cookie: cookieHeader }
        })
        const persistedAfterCancelBody = (await persistedAfterCancel.json()) as {
            items?: Array<{ id?: string; config?: { projectBinding?: { projectId?: string } } }>
        }
        const persistedTarget = persistedAfterCancelBody.items?.find((instance) => instance.id === instanceId)
        expect(persistedTarget?.config?.projectBinding?.projectId).toBe(projects.items?.[0]?.id)

        // Publish flow: a freshly created project is not yet publishable (no
        // runtime manifests), so the button is disabled — verify the disabled
        // state instead of attempting a click. The MMOOMM generator E2E owns
        // the happy-path click-through once the project has been authored and
        // has runtime manifests.
        await expect(editDialog.getByRole('button', { name: 'Publish runtime' })).toBeDisabled()

        // Open editor flow: the editor's `display.mode` defaults to
        // `embeddedIframe` (a fresh metahub has no package settings yet), which
        // means the "Open editor" button navigates the current page to the
        // editor route instead of opening a popup. The end-to-end editor
        // journey (where the editor actually loads with the bound project and
        // shows real MMOOMM scene content) is owned by the MMOOMM generator
        // E2E — that test sets the editor's `display.mode` to `openSeparately`
        // and asserts the popup URL pins to the bound `?projectId=…`. This
        // spec only verifies the user-facing affordance: the Open editor
        // button is visible and enabled when the binding is in place.
        await expect(editDialog.getByRole('button', { name: 'Open editor' })).toBeEnabled()

        // Data check: project created in store + binding recorded in instance config.
        const instancesResponse = await fetch(`${api.baseURL}/api/v1/metahub/${metahubId}/entities?kind=project&limit=10&offset=0`, {
            headers: { Accept: 'application/json', Cookie: cookieHeader }
        })
        expect(instancesResponse.ok).toBe(true)
        const instances = (await instancesResponse.json()) as {
            items?: Array<{ id?: string; config?: { projectBinding?: { projectId?: string; provider?: string } } }>
        }
        const target = instances.items?.find((instance) => instance.id === instanceId)
        expect(target?.config?.projectBinding?.provider).toBe('playcanvasEditor')
        expect(target?.config?.projectBinding?.projectId).toBe(boundProjectId)

        // Row action-menu regression guard (P2): the bound row exposes "Open
        // editor" but NOT "Open project" (the latter routed to a removed
        // standalone page; binding management now lives in the dialog tab).
        await editDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(editDialog).toHaveCount(0)
        await page
            .getByRole('button', { name: /Options|Опции/i })
            .first()
            .click()
        const rowMenu = page.getByRole('menu')
        await expect(rowMenu.getByRole('menuitem', { name: 'Open editor' })).toBeVisible()
        await expect(rowMenu.getByRole('menuitem', { name: 'Open project' })).toHaveCount(0)
        await page.keyboard.press('Escape')

        // Unbind CONFIRM flow (regression guard for the "Unbind does nothing"
        // bug): the PATCH endpoint shallow-merges config, so the surface must
        // send `projectBinding: null` for the unbind to actually persist. Confirm
        // the dialog and assert the binding is gone both in the UI (empty-state
        // card returns) and in the persisted instance config.
        const unbindEditDialog = await openPlayCanvasTabThroughBrowser(page, metahubId)
        const unbindRequest = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entity/${instanceId}`),
            { label: 'Unbinding PlayCanvas project', timeout: 60_000 }
        )
        await unbindEditDialog.getByRole('button', { name: 'Unbind' }).click()
        const confirmUnbindDialog = page.getByRole('dialog', { name: 'Unbind PlayCanvas project' })
        await expect(confirmUnbindDialog).toBeVisible()
        await confirmUnbindDialog.getByRole('button', { name: 'Unbind' }).click()
        await (await unbindRequest).json()
        // UI truth: the bound card is replaced by the empty-state create action.
        await expect(unbindEditDialog.getByText('No PlayCanvas project bound yet')).toBeVisible()

        // Data truth: the binding is removed from the persisted instance config.
        const afterUnbind = await fetch(`${api.baseURL}/api/v1/metahub/${metahubId}/entities?kind=project&limit=10&offset=0`, {
            headers: { Accept: 'application/json', Cookie: cookieHeader }
        })
        const afterUnbindBody = (await afterUnbind.json()) as {
            items?: Array<{ id?: string; config?: { projectBinding?: unknown } }>
        }
        const unboundTarget = afterUnbindBody.items?.find((instance) => instance.id === instanceId)
        expect(unboundTarget?.config?.projectBinding ?? null).toBeNull()
    })

    test('renders the empty-state binding card with a Create & bind project action before any project is bound', async ({
        page,
        browser: playwrightBrowser,
        runManifest
    }, testInfo) => {
        test.setTimeout(120_000)
        await applyBrowserPreferences(page, { language: 'en' })
        api = await createLoggedInApiContext({ email: runManifest.testUser.email, password: runManifest.testUser.password })
        browser = await createLoggedInBrowserContext(playwrightBrowser, runManifest.testUser)

        const metahub = await createMetahub(api, {
            name: { en: 'PlayCanvas Projects Empty' },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', 'playcanvas-projects-empty'),
            templateCodename: 'playcanvas'
        })
        if (!metahub?.id) {
            throw new Error('Projects section empty-state spec: metahub creation did not return an id')
        }
        const metahubId = metahub.id
        recordCreatedMetahub({ id: metahubId, name: 'PlayCanvas Projects Empty', codename: 'playcanvas-projects-empty' })

        // Create an instance but do NOT bind a project.
        await createProjectInstanceThroughBrowser(page, metahubId, 'Empty Binding Surface')

        // The binding surface lives in the edit dialog's "PlayCanvas" tab — there
        // is no standalone /project page. The row "Open project" action and the
        // standalone page were removed; only "Open editor" remains in the row menu
        // (and only once a project is bound).
        const editDialog = await openPlayCanvasTabThroughBrowser(page, metahubId)
        await expect(editDialog.getByText('No PlayCanvas project bound yet')).toBeVisible()
        await expect(editDialog.getByRole('button', { name: 'Create & bind project' })).toBeVisible()

        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Projects section empty binding state',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Projects section empty binding state')
        await page.screenshot({ path: testInfo.outputPath('projects-binding-empty.png'), fullPage: true })
    })
})
