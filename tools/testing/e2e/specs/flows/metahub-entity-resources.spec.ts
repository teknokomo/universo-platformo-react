import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    listMetahubEntityTypes
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { buildEntityMenuItemSelector, buildEntityMenuTriggerSelector, entityDialogSelectors } from '../../support/selectors/contracts'

test('@flow entity resource labels are data-driven in the browser', async ({ page, runManifest }, testInfo) => {
    test.setTimeout(240_000)

    const metahubName = `E2E ${runManifest.runId} entity resources`
    const metahubCodename = `${runManifest.runId}-entity-resources`

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for entity resource coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        let catalogType: { id?: string; ui?: { resourceSurfaces?: Array<Record<string, unknown>> } } | undefined
        await expect
            .poll(async () => {
                const payload = await listMetahubEntityTypes(api, metahub.id, { limit: 100, offset: 0 })
                catalogType = (payload.items ?? []).find((entry: { kindKey?: string }) => entry.kindKey === 'objectCollection')
                return typeof catalogType?.id === 'string'
            })
            .toBe(true)

        if (!catalogType?.id || !catalogType.ui) {
            throw new Error('Object entity type was not persisted for entity resource coverage')
        }

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Components' })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('resources-basic-en.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Ресурсы' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Компоненты' })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('resources-basic-ru.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/entities`)
        await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible()
        await page.getByTestId(buildEntityMenuTriggerSelector('entity-type', catalogType.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('entity-type', 'edit', catalogType.id)).click()

        const editTypeDialog = page.getByRole('dialog', { name: /Edit Entity/i })
        await expect(editTypeDialog).toBeVisible()
        await expect(editTypeDialog.getByLabel(/Kind key/i)).toBeDisabled()
        await expect(editTypeDialog.getByLabel(/Resource tab key/i)).toBeDisabled()
        await expect(editTypeDialog.getByRole('checkbox', { name: 'Publish to dynamic menu' })).toBeDisabled()

        const resourceTitleFields = editTypeDialog.getByLabel(/Resource tab title/i)
        await resourceTitleFields.first().fill('Properties')
        await resourceTitleFields.nth(1).fill('Свойства')
        await expect(resourceTitleFields.first()).toHaveValue('Properties')
        await expect(resourceTitleFields.nth(1)).toHaveValue('Свойства')

        const updateResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entity-type/${catalogType.id}`),
            { label: 'Updating a standard entity type resource title through the browser' }
        )
        await editTypeDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const updateNetworkResponse = await updateResponse
        const updateResponseBody = await updateNetworkResponse.json().catch(() => null)
        expect(updateNetworkResponse.ok(), JSON.stringify(updateResponseBody)).toBe(true)
        await expect(editTypeDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const payload = await listMetahubEntityTypes(api, metahub.id, { limit: 100, offset: 0 })
                const refreshedCatalogType = (payload.items ?? []).find((entry: { kindKey?: string }) => entry.kindKey === 'objectCollection')
                const resourceSurface = refreshedCatalogType?.ui?.resourceSurfaces?.[0]
                return {
                    fallbackTitle: resourceSurface?.fallbackTitle,
                    ruTitle: resourceSurface?.title?.locales?.ru?.content
                }
            })
            .toEqual({ fallbackTitle: 'Properties', ruTitle: 'Свойства' })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('tab', { name: 'Properties' })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('resources-renamed-standard-en.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('tab', { name: 'Свойства' })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('resources-renamed-standard-ru.png'), fullPage: true })
    } finally {
        await disposeApiContext(api)
    }
})
