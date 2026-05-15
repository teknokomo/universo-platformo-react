import { test, expect } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext, listMetahubs, listMetahubEntityTypes } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'
import type { Locator } from '@playwright/test'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fillMetahubForm(dialog: Locator, values: { name: string; codename: string }) {
    await dialog.getByLabel('Name').first().fill(values.name)
    await dialog.getByLabel('Codename').first().fill(values.codename)
}

async function waitForMetahubByName(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, expectedName: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        const response = await listMetahubs(api, { limit: 100, offset: 0 })
        const item = (response.items ?? []).find((entry: { id?: string; name?: { locales?: Record<string, { content?: string }> } }) =>
            Object.values(entry.name?.locales ?? {}).some((localeValue) => localeValue?.content === expectedName)
        )

        if (item) {
            return item
        }

        await sleep(500)
    }

    throw new Error(`Metahub ${expectedName} was not found within ${timeoutMs}ms`)
}

async function ensureMetahubVisible(page: import('@playwright/test').Page, expectedName: string) {
    const metahubName = page.getByText(expectedName, { exact: true }).first()

    if ((await metahubName.count()) === 0) {
        await page.reload()
    }

    await expect(metahubName).toBeVisible()
}

test('@flow metahub can be created from the browser', async ({ page, runManifest }) => {
    const metahubName = `E2E ${runManifest.runId} browser metahub`
    const metahubCodename = `${runManifest.runId}-browser-metahub`

    await page.goto('/metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const dialog = page.getByRole('dialog')

    await fillMetahubForm(dialog, {
        name: metahubName,
        codename: metahubCodename
    })
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(dialog).toHaveCount(0)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const persistedMetahub = await waitForMetahubByName(api, metahubName)
        expect(typeof persistedMetahub.id).toBe('string')
        await ensureMetahubVisible(page, metahubName)

        await recordCreatedMetahub({
            id: persistedMetahub.id,
            name: metahubName,
            codename: metahubCodename
        })
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow empty metahub template supports manual entity-type authoring from the browser', async ({ page, runManifest }) => {
    const metahubName = `E2E ${runManifest.runId} empty metahub`
    const metahubCodename = `${runManifest.runId}-empty-metahub`
    const entityTypeKindKey = `custom.manual-${runManifest.runId.slice(-8).toLowerCase()}`
    const entityTypeName = `Manual ${runManifest.runId.slice(-6)}`

    await page.goto('/metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const dialog = page.getByRole('dialog')
    await fillMetahubForm(dialog, {
        name: metahubName,
        codename: metahubCodename
    })

    await dialog.getByLabel('Template').click()
    await page.getByRole('option', { name: /Empty \(v\./i }).click()

    const optionsTab = dialog.getByRole('tab', { name: 'Options' })
    await optionsTab.click()
    await expect(dialog.getByText('This template does not define optional presets.')).toBeVisible()

    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(dialog).toHaveCount(0)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const persistedMetahub = await waitForMetahubByName(api, metahubName)
        if (typeof persistedMetahub.id !== 'string') {
            throw new Error('Persisted empty metahub did not return an id')
        }

        await recordCreatedMetahub({
            id: persistedMetahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await expect
            .poll(async () => {
                const payload = await listMetahubEntityTypes(api, persistedMetahub.id, { limit: 100, offset: 0 })
                return Array.isArray(payload.items) ? payload.items.length : 0
            })
            .toBe(0)

        await page.goto(`/metahub/${persistedMetahub.id}/entities`)
        await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible()
        await expect(page.getByText('No entity types yet')).toBeVisible()

        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const createTypeDialog = page.getByRole('dialog', { name: /Create Entity/i })
        await createTypeDialog.getByLabel('Kind key').fill(entityTypeKindKey)
        await createTypeDialog.getByLabel('Name').first().fill(entityTypeName)
        await createTypeDialog.getByLabel('Codename').first().fill(entityTypeKindKey)

        const resourceSurfaceKeyInput = createTypeDialog.getByLabel('Resource tab key')
        if ((await resourceSurfaceKeyInput.count()) > 0) {
            await resourceSurfaceKeyInput.fill('components')
            await createTypeDialog.getByLabel('Resource tab route segment').fill('components')
            await createTypeDialog.getByLabel('Resource tab title').fill('Components')
        } else {
            await createTypeDialog.getByLabel('Components').fill('Components')
        }

        await createTypeDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(createTypeDialog).toHaveCount(0)

        await expect(page.getByRole('cell', { name: entityTypeName, exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: entityTypeName, exact: true })).toBeVisible()

        await expect
            .poll(async () => {
                const payload = await listMetahubEntityTypes(api, persistedMetahub.id, { limit: 100, offset: 0 })
                const item = (payload.items ?? []).find((entry: { kindKey?: string; ui?: { resourceSurfaces?: unknown[] } }) => entry.kindKey === entityTypeKindKey)
                const resourceSurface = item?.ui?.resourceSurfaces?.[0] as
                    | { key?: string; capability?: string; routeSegment?: string; fallbackTitle?: string }
                    | undefined

                return resourceSurface
                    ? `${resourceSurface.key}|${resourceSurface.capability}|${resourceSurface.routeSegment}|${resourceSurface.fallbackTitle}`
                    : null
            })
            .toBe('components|dataSchema|components|Components')
    } finally {
        await disposeApiContext(api)
    }
})
