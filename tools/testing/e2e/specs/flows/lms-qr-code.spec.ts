import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createRuntimeRow,
    disposeApiContext,
    listLayoutZoneWidgets
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    setupPublishedLmsApplication,
    waitForApplicationCatalogId,
    waitForApplicationRuntimeRow,
    waitForMetahubEnumerationId,
    waitForOptionValueId
} from '../../support/lmsRuntime'

test('@flow lms qr widget exposes the real public link and leads into guest access', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const lms = await setupPublishedLmsApplication(api, {
            runId: runManifest.runId,
            label: 'Qr',
            isPublic: true,
            workspacesEnabled: true
        })

        await recordCreatedMetahub({
            id: lms.metahub.id,
            name: `E2E ${runManifest.runId} Qr LMS`,
            codename: `${runManifest.runId}-qr-lms`
        })
        await recordCreatedPublication({
            id: lms.publication.id,
            metahubId: lms.metahub.id,
            schemaName: lms.publication.schemaName
        })
        await recordCreatedApplication({
            id: lms.applicationId,
            slug: lms.applicationSlug
        })

        const modulesCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Modules')
        const accessLinksCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Access Links')
        const contentTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Content Type')
        const moduleStatusEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Module Status')
        const textValueId = await waitForOptionValueId(api, lms.metahub.id, contentTypeEnumerationId, 'Text')
        const publishedModuleStatusValueId = await waitForOptionValueId(api, lms.metahub.id, moduleStatusEnumerationId, 'Published')

        const moduleSlug = 'demo-module'
        const moduleRow = await createRuntimeRow(api, lms.applicationId, {
            linkedCollectionId: modulesCatalogId,
            data: {
                Title: `QR Module ${runManifest.runId}`,
                Description: 'Module opened from QR widget link',
                Status: publishedModuleStatusValueId,
                AccessLinkSlug: moduleSlug,
                ContentItems: [
                    {
                        ItemType: textValueId,
                        ItemTitle: 'QR Lesson',
                        ItemContent: 'This lesson was reached from the QR widget.',
                        SortOrder: 1
                    }
                ]
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, modulesCatalogId, moduleRow.id)

        const accessLinkRow = await createRuntimeRow(api, lms.applicationId, {
            linkedCollectionId: accessLinksCatalogId,
            data: {
                Slug: moduleSlug,
                TargetType: 'module',
                TargetId: moduleRow.id,
                IsActive: true,
                MaxUses: 20,
                UseCount: 0,
                LinkTitle: 'QR module access'
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, accessLinksCatalogId, accessLinkRow.id)

        const widgetPayload = await listLayoutZoneWidgets(api, lms.metahub.id, lms.layoutId)
        const qrWidget = (widgetPayload.items ?? []).find((item: { id?: string; widgetKey?: string }) => item.widgetKey === 'qrCodeWidget')
        if (!qrWidget?.id) {
            throw new Error('LMS QR widget was not present in the default layout')
        }

        expect(qrWidget.config?.publicLinkSlug).toBe(moduleSlug)

        const publicLinkPath = `http://localhost:3000/public/a/${lms.applicationId}/links/${moduleSlug}`

        await page.goto(`/a/${lms.applicationId}?catalogId=${modulesCatalogId}`)
        await expect(page.getByText('Module access QR')).toBeVisible({ timeout: 30_000 })
        await expect(page.locator('canvas')).toBeVisible()
        await expect(page.getByText(publicLinkPath, { exact: true })).toBeVisible({ timeout: 30_000 })

        await page.goto(`/public/a/${lms.applicationId}/links/${moduleSlug}`)
        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Your name').fill('QR learner')
        await page.getByRole('button', { name: 'Start learning' }).click()

        await expect(page.getByText(`QR Module ${runManifest.runId}`)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('This lesson was reached from the QR widget.')).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})