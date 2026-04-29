import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplication,
    listApplications,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { buildEntityMenuItemSelector, buildEntityMenuTriggerSelector } from '../../support/selectors/contracts'

test('@flow application list shows linked applications and navigates through existing list actions', async ({ page, runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} applications list metahub`
    const metahubCodename = `${runManifest.runId}-applications-list-metahub`
    const publicationName = `E2E ${runManifest.runId} applications list publication`
    const applicationName = `E2E ${runManifest.runId} applications list app`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for application list coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for application list coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} applications list version` },
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
            throw new Error('Linked application creation did not return an application id for application list coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await expect
            .poll(async () => {
                const response = await listApplications(api, { limit: 100, offset: 0, search: applicationName })
                const items = Array.isArray(response?.items) ? response.items : []
                return items.some((item) => item.id === applicationId)
            })
            .toBe(true)

        await page.goto('/applications')
        await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
        await expect(page.getByText(applicationName, { exact: true })).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('application', applicationId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('application', 'edit', applicationId)).click()
        const editDialog = page.getByRole('dialog', { name: 'Edit Application' })
        await expect(editDialog).toBeVisible({ timeout: 30_000 })
        await editDialog.getByRole('tab', { name: 'Parameters' }).click()
        await editDialog.getByLabel('Public').check()
        await editDialog.getByRole('button', { name: 'Save' }).click()
        await expect
            .poll(async () => {
                const saved = await getApplication(api, applicationId)
                return saved?.isPublic === true && saved?.workspacesEnabled === false
            })
            .toBe(true)

        await page.getByTestId(buildEntityMenuTriggerSelector('application', applicationId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('application', 'control-panel', applicationId)).click()
        await page.waitForURL(`**/a/${applicationId}/admin`)

        await page.goto('/applications')
        await page.locator(`a[href="/a/${applicationId}"]`).click()
        await page.waitForURL(`**/a/${applicationId}`)
    } finally {
        await disposeApiContext(api)
    }
})
