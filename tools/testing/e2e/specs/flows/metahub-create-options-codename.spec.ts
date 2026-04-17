import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    disposeApiContext,
    listLayouts,
    listMetahubBranches,
    listLinkedCollections,
    listOptionLists,
    listTreeEntities,
    listMetahubs,
    listValueGroups
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'

type MetahubSummary = {
    id?: string
    name?: { locales?: Record<string, { content?: string }> }
}

const METAHUB_MIGRATION_GUARD_LOADING_TEXT = 'Checking metahub migration status...'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForMetahubWorkspaceHeading(page: import('@playwright/test').Page, headingName: string) {
    const heading = page.getByRole('heading', { name: headingName })
    const guardLoading = page.getByText(METAHUB_MIGRATION_GUARD_LOADING_TEXT)

    await Promise.race([
        heading.waitFor({ state: 'visible', timeout: 15_000 }),
        guardLoading.waitFor({ state: 'visible', timeout: 15_000 })
    ])

    if (await guardLoading.isVisible()) {
        await expect(guardLoading).toHaveCount(0, { timeout: 30_000 })
    }

    await expect(heading).toBeVisible()
}

async function openCreateDialog(page: import('@playwright/test').Page) {
    await page.goto('/metahubs')
    await waitForMetahubWorkspaceHeading(page, 'Metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    return dialog
}

async function waitForCreatedMetahub(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, expectedName: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        const payload = await listMetahubs(api, { limit: 100, offset: 0 })
        const matched = (payload.items as MetahubSummary[] | undefined)?.find((item) =>
            Object.values(item.name?.locales ?? {}).some((localeValue) => localeValue?.content === expectedName)
        )

        if (matched?.id) {
            return matched
        }

        await sleep(500)
    }

    throw new Error(`Metahub ${expectedName} did not appear in backend list within ${timeoutMs}ms`)
}

async function createMetahubViaDialog(
    page: import('@playwright/test').Page,
    values: {
        name: string
        optionalDefaultsDisabled?: boolean
    }
) {
    const dialog = await openCreateDialog(page)
    const nameInput = dialog.getByLabel('Name').first()
    const codenameInput = dialog.getByLabel('Codename').first()

    await nameInput.fill(values.name)

    await expect.poll(async () => (await codenameInput.inputValue()).trim()).not.toBe('')
    const initialAutoCodename = await codenameInput.inputValue()

    await nameInput.fill(`${values.name} Updated`)
    await expect.poll(async () => await codenameInput.inputValue()).not.toBe(initialAutoCodename)

    const requestedManualCodename = `${values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-manual`
    await codenameInput.fill(requestedManualCodename)
    await codenameInput.blur()
    const manualCodename = await codenameInput.inputValue()
    await nameInput.fill(`${values.name} Manual Stop`)
    await expect(codenameInput).toHaveValue(manualCodename)

    await nameInput.fill('')
    await expect.poll(async () => (await codenameInput.inputValue()).trim()).toBe('')

    const resetName = `${values.name} Reset`
    await nameInput.fill(resetName)
    await expect.poll(async () => (await codenameInput.inputValue()).trim()).not.toBe('')
    const resetCodename = await codenameInput.inputValue()

    expect(resetCodename).not.toBe(manualCodename)

    if (values.optionalDefaultsDisabled) {
        await dialog.getByRole('tab', { name: 'Options' }).click()
        const branchCheckbox = dialog.getByLabel('Branch')
        const layoutCheckbox = dialog.getByLabel('Layout')
        const hubCheckbox = dialog.getByLabel('Hub')
        const catalogCheckbox = dialog.getByLabel('Catalog')
        const setCheckbox = dialog.getByLabel('Set')
        const enumerationCheckbox = dialog.getByLabel('Enumeration')

        await expect(branchCheckbox).toBeDisabled()
        await expect(layoutCheckbox).toBeDisabled()
        await expect(branchCheckbox).toBeChecked()
        await expect(layoutCheckbox).toBeChecked()

        await hubCheckbox.uncheck()
        await catalogCheckbox.uncheck()
        await setCheckbox.uncheck()
        await enumerationCheckbox.uncheck()

        await dialog.getByRole('tab', { name: 'General' }).click()
    }

    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(dialog).toHaveCount(0)

    return {
        name: resetName,
        codename: resetCodename
    }
}

test('@flow metahub create dialog preserves codename auto-fill UX and supports default-entity create options', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const defaultsOn = await createMetahubViaDialog(page, {
            name: `E2E ${runManifest.runId} Defaults On`
        })

        const persistedDefaultsOn = await waitForCreatedMetahub(api, defaultsOn.name)
        const defaultsOnMetahub = {
            id: persistedDefaultsOn.id,
            name: defaultsOn.name,
            codename: defaultsOn.codename
        }
        await recordCreatedMetahub(defaultsOnMetahub)

        const [defaultBranches, defaultLayouts, defaultHubs, defaultCatalogs, defaultSets, defaultEnumerations] = await Promise.all([
            listMetahubBranches(api, defaultsOnMetahub.id, { limit: 100, offset: 0 }),
            listLayouts(api, defaultsOnMetahub.id, { limit: 100, offset: 0 }),
            listTreeEntities(api, defaultsOnMetahub.id, { limit: 100, offset: 0 }),
            listLinkedCollections(api, defaultsOnMetahub.id, { limit: 100, offset: 0 }),
            listValueGroups(api, defaultsOnMetahub.id, { limit: 100, offset: 0 }),
            listOptionLists(api, defaultsOnMetahub.id, { limit: 100, offset: 0 })
        ])

        expect((defaultBranches.items ?? []).length).toBeGreaterThan(0)
        expect((defaultLayouts.items ?? []).length).toBeGreaterThan(0)
        expect((defaultHubs.items ?? []).length).toBeGreaterThan(0)
        expect((defaultCatalogs.items ?? []).length).toBeGreaterThan(0)
        expect((defaultSets.items ?? []).length).toBeGreaterThan(0)
        expect((defaultEnumerations.items ?? []).length).toBeGreaterThan(0)

        const defaultsOff = await createMetahubViaDialog(page, {
            name: `E2E ${runManifest.runId} Defaults Off`,
            optionalDefaultsDisabled: true
        })

        const persistedDefaultsOff = await waitForCreatedMetahub(api, defaultsOff.name)
        const defaultsOffMetahub = {
            id: persistedDefaultsOff.id,
            name: defaultsOff.name,
            codename: defaultsOff.codename
        }
        await recordCreatedMetahub(defaultsOffMetahub)

        const [disabledBranches, disabledLayouts, disabledHubs, disabledCatalogs, disabledSets, disabledEnumerations] = await Promise.all([
            listMetahubBranches(api, defaultsOffMetahub.id, { limit: 100, offset: 0 }),
            listLayouts(api, defaultsOffMetahub.id, { limit: 100, offset: 0 }),
            listTreeEntities(api, defaultsOffMetahub.id, { limit: 100, offset: 0 }),
            listLinkedCollections(api, defaultsOffMetahub.id, { limit: 100, offset: 0 }),
            listValueGroups(api, defaultsOffMetahub.id, { limit: 100, offset: 0 }),
            listOptionLists(api, defaultsOffMetahub.id, { limit: 100, offset: 0 })
        ])

        expect((disabledBranches.items ?? []).length).toBeGreaterThan(0)
        expect((disabledLayouts.items ?? []).length).toBeGreaterThan(0)
        expect((disabledHubs.items ?? []).length).toBe(0)
        expect((disabledCatalogs.items ?? []).length).toBe(0)
        expect((disabledSets.items ?? []).length).toBe(0)
        expect((disabledEnumerations.items ?? []).length).toBe(0)
    } finally {
        await disposeApiContext(api)
    }
})
