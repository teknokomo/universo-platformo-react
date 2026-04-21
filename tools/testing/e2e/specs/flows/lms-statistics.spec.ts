import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createPublicationVersion,
    disposeApiContext,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { setupPublishedLmsApplication } from '../../support/lmsRuntime'
import { LMS_STATS_SCRIPT_CODENAME, LMS_STATS_WIDGET_SOURCE } from '../../support/lmsFixtureContract'

test('@flow lms statistics widget renders chart data from the configured metahub script', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const lms = await setupPublishedLmsApplication(api, {
            runId: runManifest.runId,
            label: 'Stats',
            workspacesEnabled: true
        })

        await recordCreatedMetahub({
            id: lms.metahub.id,
            name: `E2E ${runManifest.runId} Stats LMS`,
            codename: `${runManifest.runId}-stats-lms`
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

        const createScriptResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${lms.metahub.id}/scripts`, {
            codename: LMS_STATS_SCRIPT_CODENAME,
            name: 'LMS stats viewer',
            description: 'Runtime stats widget for LMS browser coverage',
            attachedToKind: 'metahub',
            attachedToId: null,
            moduleRole: 'widget',
            sourceKind: 'embedded',
            capabilities: ['rpc.client'],
            sourceCode: LMS_STATS_WIDGET_SOURCE,
            isActive: true
        })
        expect(createScriptResponse.ok).toBe(true)

        await createPublicationVersion(api, lms.metahub.id, lms.publication.id, {
            name: { en: `E2E ${runManifest.runId} Stats Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, lms.metahub.id, lms.publication.id)
        await waitForPublicationReady(api, lms.metahub.id, lms.publication.id)
        await syncApplicationSchema(api, lms.applicationId)

        await page.goto(`/a/${lms.applicationId}`)
        await expect(page.getByText('Learning progress')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Snapshot fixture statistics')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Students')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Completed modules')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Quiz attempts')).toBeVisible({ timeout: 30_000 })
        await expect(page.locator('svg')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Stats viewer is not configured')).toHaveCount(0)
    } finally {
        await disposeApiContext(api)
    }
})