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

        const learningResourcesObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Learning Resources')
        const accessLinksObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Access Links')
        const contentTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Content Type')
        const resourceTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Resource Type')
        const publicationStatusEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Publication Status')
        const textValueId = await waitForOptionValueId(api, lms.metahub.id, contentTypeEnumerationId, 'Text')
        const pageResourceTypeValueId = await waitForOptionValueId(api, lms.metahub.id, resourceTypeEnumerationId, 'Page')
        const publishedPublicationStatusValueId = await waitForOptionValueId(
            api,
            lms.metahub.id,
            publicationStatusEnumerationId,
            'Published'
        )

        const accessSlug = `access-${runManifest.runId}`
        const contentRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: learningResourcesObjectId,
            data: {
                Title: `Access Link Learning Resource ${runManifest.runId}`,
                Description: 'Learning resource opened through contextual access link',
                ResourceType: pageResourceTypeValueId,
                Source: { type: 'page', pageCodename: 'LearnerHome' },
                PublicationStatus: publishedPublicationStatusValueId,
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
        await waitForApplicationRuntimeRow(api, lms.applicationId, learningResourcesObjectId, contentRow.id)

        const accessLinkRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: accessLinksObjectId,
            data: {
                Slug: accessSlug,
                TargetType: 'content',
                TargetId: contentRow.id,
                ContentNodeIdRef: contentRow.id,
                IsActive: true,
                MaxUses: 20,
                UseCount: 0,
                LinkTitle: 'Access link content test'
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

        await expect(page.getByText(`Access Link Learning Resource ${runManifest.runId}`)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('This lesson was reached from a contextual access link.')).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
