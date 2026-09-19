import { buildVLC, createLocalizedContent } from '@universo-react/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createMetahubEntityType,
    disposeApiContext,
    listMetahubEntityTypes
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { buildEntityMenuItemSelector, buildEntityMenuTriggerSelector, entityDialogSelectors } from '../../support/selectors/contracts'

function buildKindSuffix(runId: string): string {
    const normalized = runId.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return normalized.slice(-8) || 'e2e'
}

test('@flow entity resource labels are data-driven in the browser', async ({ page, runManifest }, testInfo) => {
    test.setTimeout(240_000)

    const metahubName = `E2E ${runManifest.runId} entity resources`
    const metahubCodename = `${runManifest.runId}-entity-resources`
    const kindSuffix = buildKindSuffix(runManifest.runId)
    const customKindKey = `custom.resources-${kindSuffix}`
    const customTypeName = `Resources ${kindSuffix}`

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'empty'
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for entity resource coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const createdType = await createMetahubEntityType(api, metahub.id, {
            kindKey: customKindKey,
            codename: createLocalizedContent('en', `Resource${kindSuffix}`),
            presentation: { name: { en: customTypeName } },
            capabilities: { dataSchema: { enabled: true } },
            ui: {
                iconName: 'IconBox',
                tabs: ['general'],
                sidebarSection: 'objects',
                nameKey: customTypeName,
                resourceSurfaces: [
                    {
                        key: 'components',
                        capability: 'dataSchema',
                        routeSegment: 'components',
                        title: buildVLC('Components', 'Компоненты'),
                        fallbackTitle: 'Components',
                        sharedTitle: buildVLC('Components', 'Компоненты'),
                        fallbackSharedTitle: 'Components'
                    }
                ]
            },
            published: true
        })

        if (!createdType?.id) {
            throw new Error('Custom entity type creation did not return an id for entity resource coverage')
        }

        let catalogType: { id?: string; kindKey?: string; ui?: { resourceSurfaces?: Array<Record<string, unknown>> } } | undefined
        await expect
            .poll(async () => {
                const payload = await listMetahubEntityTypes(api, metahub.id, { limit: 100, offset: 0 })
                catalogType = (payload.items ?? []).find((entry: { kindKey?: string }) => entry.kindKey === customKindKey)
                return typeof catalogType?.id === 'string'
            })
            .toBe(true)

        if (!catalogType?.id || !catalogType.ui) {
            throw new Error('Custom entity type was not persisted for entity resource coverage')
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
        await expect(editTypeDialog.getByLabel(/System type key/i)).toBeEnabled()
        await expect(editTypeDialog.getByLabel(/Resource tab key/i)).toBeEnabled()
        await expect(editTypeDialog.getByRole('checkbox', { name: 'Publish to dynamic menu' })).toBeEnabled()

        const resourceTitleFields = editTypeDialog.getByLabel(/Resource tab title/i)
        await resourceTitleFields.first().fill('Properties')
        await resourceTitleFields.nth(1).fill('Свойства')
        await expect(resourceTitleFields.first()).toHaveValue('Properties')
        await expect(resourceTitleFields.nth(1)).toHaveValue('Свойства')

        // The shared Resources workspace resolves its tab labels from the
        // shared-title fields, so both localized surfaces must be authored.
        const sharedResourceTitleFields = editTypeDialog.getByLabel(/Shared resources tab title/i)
        await sharedResourceTitleFields.first().fill('Properties')
        await sharedResourceTitleFields.nth(1).fill('Свойства')
        await expect(sharedResourceTitleFields.first()).toHaveValue('Properties')
        await expect(sharedResourceTitleFields.nth(1)).toHaveValue('Свойства')

        const updateResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entity-type/${catalogType.id}`),
            { label: 'Updating a custom entity type resource title through the browser' }
        )
        await editTypeDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const updateNetworkResponse = await updateResponse
        const updateResponseBody = await updateNetworkResponse.json().catch(() => null)
        expect(updateNetworkResponse.ok(), JSON.stringify(updateResponseBody)).toBe(true)
        await expect(editTypeDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const payload = await listMetahubEntityTypes(api, metahub.id, { limit: 100, offset: 0 })
                const refreshedCatalogType = (payload.items ?? []).find((entry: { kindKey?: string }) => entry.kindKey === customKindKey)
                const resourceSurface = refreshedCatalogType?.ui?.resourceSurfaces?.[0]
                return {
                    fallbackTitle: resourceSurface?.fallbackTitle,
                    ruTitle: resourceSurface?.title?.locales?.ru?.content,
                    fallbackSharedTitle: resourceSurface?.fallbackSharedTitle,
                    ruSharedTitle: resourceSurface?.sharedTitle?.locales?.ru?.content
                }
            })
            .toEqual({
                fallbackTitle: 'Properties',
                ruTitle: 'Свойства',
                fallbackSharedTitle: 'Properties',
                ruSharedTitle: 'Свойства'
            })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('tab', { name: 'Properties' })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('resources-renamed-custom-en.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('tab', { name: 'Свойства' })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('resources-renamed-custom-ru.png'), fullPage: true })
    } finally {
        await disposeApiContext(api)
    }
})
