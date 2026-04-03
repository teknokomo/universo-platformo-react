import { createLocalizedContent } from '@universo/utils'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createMetahubAttribute,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getLayout,
    listLayouts,
    listMetahubCatalogs,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { applicationSelectors, entityDialogSelectors } from '../../support/selectors/contracts'

async function waitForLayoutId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

async function waitForCatalogId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let catalogId: string | undefined

    await expect
        .poll(async () => {
            const response = await listMetahubCatalogs(api, metahubId, { limit: 100, offset: 0 })
            catalogId = response?.items?.[0]?.id
            return typeof catalogId === 'string'
        })
        .toBe(true)

    if (!catalogId) {
        throw new Error(`No catalog was returned for metahub ${metahubId}`)
    }

    return catalogId
}

async function configureEnhancedLayout(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    const layoutId = await waitForLayoutId(api, metahubId)
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}

    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
        config: {
            ...currentConfig,
            showOverviewTitle: false,
            showOverviewCards: false,
            showSessionsChart: false,
            showPageViewsChart: false,
            showDetailsTitle: true,
            showDetailsTable: true,
            showFooter: false,
            showViewToggle: true,
            defaultViewMode: 'card',
            showFilterBar: true,
            enableRowReordering: true,
            cardColumns: 2,
            rowHeight: 'auto'
        }
    })

    expect(response.ok).toBe(true)
    return layoutId
}

test.describe('Application Runtime View Settings', () => {
    test('@flow layout details page shows view settings panel', async ({ page, runManifest }) => {
        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} runtime views`
        const metahubCodename = `${runManifest.runId}-runtime-views`

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })

            if (!metahub?.id) {
                throw new Error('Metahub creation did not return an id for runtime view settings coverage')
            }

            await recordCreatedMetahub({
                id: metahub.id,
                name: metahubName,
                codename: metahubCodename
            })

            const layoutId = await waitForLayoutId(api, metahub.id)

            await page.goto(`/metahub/${metahub.id}/layouts/${layoutId}`)
            await page.waitForURL(`**/metahub/${metahub.id}/layouts/${layoutId}`)

            const viewSettingsHeading = page.getByText(/view settings|настройки отображения/i).first()
            await expect(viewSettingsHeading).toBeVisible({ timeout: 10_000 })

            const viewToggleSwitch = page.locator('label').filter({ hasText: /view toggle|переключатель/i }).first()
            if (await viewToggleSwitch.isVisible().catch(() => false)) {
                await expect(viewToggleSwitch).toBeVisible()
            }
        } finally {
            await disposeApiContext(api)
        }
    })

    test('@flow dashboard renders enhanced details section through the real /a runtime route', async ({ page, runManifest }) => {
        test.setTimeout(180_000)

        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} runtime layout app`
        const metahubCodename = `${runManifest.runId}-runtime-layout-app`
        const publicationName = `E2E ${runManifest.runId} Runtime Layout Publication`
        const applicationName = `E2E ${runManifest.runId} Runtime Layout Application`
        const alphaTitle = `Alpha Runtime ${runManifest.runId}`
        const betaTitle = `Beta Runtime ${runManifest.runId}`

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })

            if (!metahub?.id) {
                throw new Error('Metahub creation did not return an id for runtime view coverage')
            }

            await recordCreatedMetahub({
                id: metahub.id,
                name: metahubName,
                codename: metahubCodename
            })

            const catalogId = await waitForCatalogId(api, metahub.id)
            await createMetahubAttribute(api, metahub.id, catalogId, {
                name: { en: 'Title' },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', 'title'),
                dataType: 'STRING',
                isRequired: false
            })

            await configureEnhancedLayout(api, metahub.id)

            const publication = await createPublication(api, metahub.id, {
                name: { en: publicationName },
                namePrimaryLocale: 'en',
                autoCreateApplication: false
            })

            if (!publication?.id) {
                throw new Error('Publication creation did not return an id for runtime view coverage')
            }

            await recordCreatedPublication({
                id: publication.id,
                metahubId: metahub.id,
                schemaName: publication.schemaName
            })

            await createPublicationVersion(api, metahub.id, publication.id, {
                name: { en: `E2E ${runManifest.runId} Runtime Layout Version` },
                namePrimaryLocale: 'en'
            })
            await syncPublication(api, metahub.id, publication.id)
            await waitForPublicationReady(api, metahub.id, publication.id)

            const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
                name: { en: applicationName },
                namePrimaryLocale: 'en',
                createApplicationSchema: false,
                workspacesEnabled: false
            })

            const applicationId = linkedApplication?.application?.id
            if (typeof applicationId !== 'string') {
                throw new Error('Linked application creation did not return an id for runtime view coverage')
            }

            await recordCreatedApplication({
                id: applicationId,
                slug: linkedApplication.application.slug
            })

            await syncApplicationSchema(api, applicationId)

            await page.goto(`/a/${applicationId}`)

            const cardViewButton = page.getByTitle('Card View')
            const listViewButton = page.getByTitle('List View')
            const searchInput = page.locator('input[type="search"]').first()

            await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
            await expect(cardViewButton).toBeVisible({ timeout: 30_000 })
            await expect(listViewButton).toBeVisible()
            await expect(searchInput).toBeVisible()
            await expect(cardViewButton).toHaveAttribute('aria-pressed', 'true')

            const createAlphaRequest = page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`)
            )
            await page.getByTestId(applicationSelectors.runtimeCreateButton).click()
            const createAlphaDialog = page.getByRole('dialog', { name: 'Create element' })
            await expect(createAlphaDialog).toBeVisible()
            await createAlphaDialog.getByLabel('Title').first().fill(alphaTitle)
            await createAlphaDialog.getByTestId(entityDialogSelectors.submitButton).click()
            expect((await createAlphaRequest).ok()).toBe(true)
            await expect(page.getByText(alphaTitle)).toBeVisible({ timeout: 30_000 })

            const createBetaRequest = page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`)
            )
            await page.getByTestId(applicationSelectors.runtimeCreateButton).click()
            const createBetaDialog = page.getByRole('dialog', { name: 'Create element' })
            await expect(createBetaDialog).toBeVisible()
            await createBetaDialog.getByLabel('Title').first().fill(betaTitle)
            await createBetaDialog.getByTestId(entityDialogSelectors.submitButton).click()
            expect((await createBetaRequest).ok()).toBe(true)
            await expect(page.getByText(alphaTitle)).toBeVisible({ timeout: 30_000 })
            await expect(page.getByText(betaTitle)).toBeVisible({ timeout: 30_000 })

            await searchInput.fill(alphaTitle)
            await expect(page.getByText(alphaTitle)).toBeVisible()
            await expect(page.getByText(betaTitle)).toHaveCount(0)

            await listViewButton.click()
            await expect(listViewButton).toHaveAttribute('aria-pressed', 'true')
            await expect(page.locator('table[aria-label="a dense table"]')).toBeVisible()
            await expect(page.locator('.MuiDataGrid-root')).toHaveCount(0)
            await expect(page.getByText(alphaTitle)).toBeVisible()
            await expect(page.getByText(betaTitle)).toHaveCount(0)
        } finally {
            await disposeApiContext(api)
        }
    })
})
