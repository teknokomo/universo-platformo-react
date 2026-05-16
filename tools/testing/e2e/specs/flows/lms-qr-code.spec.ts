import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, createRuntimeRow, disposeApiContext, listLayoutZoneWidgets } from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    setupPublishedLmsApplication,
    waitForApplicationObjectId,
    waitForApplicationRuntimeRow,
    waitForMetahubEnumerationId,
    waitForOptionValueId
} from '../../support/lmsRuntime'

test('@flow lms contextual access link enables guest journey without legacy QR widget', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const lms = await setupPublishedLmsApplication(api, {
            runId: runManifest.runId,
            label: 'Access',
            isPublic: true,
            workspacesEnabled: true
        })

        await recordCreatedMetahub({
            id: lms.metahub.id,
            name: `E2E ${runManifest.runId} Access LMS`,
            codename: `${runManifest.runId}-access-lms`
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

        const modulesObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Modules')
        const accessLinksObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Access Links')
        const contentTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Content Type')
        const moduleStatusEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Module Status')
        const textValueId = await waitForOptionValueId(api, lms.metahub.id, contentTypeEnumerationId, 'Text')
        const publishedModuleStatusValueId = await waitForOptionValueId(api, lms.metahub.id, moduleStatusEnumerationId, 'Published')

        const accessSlug = `access-${runManifest.runId}`
        const moduleRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: modulesObjectId,
            data: {
                Title: `Access Link Module ${runManifest.runId}`,
                Slug: accessSlug,
                Description: 'Module opened through contextual access link',
                Status: publishedModuleStatusValueId,
                AccessLinkSlug: accessSlug,
                ContentItems: [
                    {
                        ItemType: textValueId,
                        ItemTitle: 'Access link lesson',
                        ItemContent: 'This lesson was reached from a contextual access link.',
                        SortOrder: 1
                    }
                ]
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, modulesObjectId, moduleRow.id)

        const accessLinkRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: accessLinksObjectId,
            data: {
                Slug: accessSlug,
                TargetType: 'module',
                TargetId: moduleRow.id,
                IsActive: true,
                MaxUses: 20,
                UseCount: 0,
                LinkTitle: 'Access link module test'
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, accessLinksObjectId, accessLinkRow.id)

        const widgetPayload = await listLayoutZoneWidgets(api, lms.metahub.id, lms.layoutId)
        const widgetKeys = (widgetPayload.items ?? []).map((item: { widgetKey?: string }) => item.widgetKey)
        expect(widgetKeys).not.toContain('qrCodeWidget')
        expect(widgetKeys).not.toContain('moduleViewerWidget')
        expect(widgetKeys).not.toContain('statsViewerWidget')

        await page.goto(`/public/a/${lms.applicationId}/links/${accessSlug}`)
        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Your name').fill('Access link learner')
        await page.getByRole('button', { name: 'Start learning' }).click()

        await expect(page.getByText(`Access Link Module ${runManifest.runId}`)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('This lesson was reached from a contextual access link.')).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
