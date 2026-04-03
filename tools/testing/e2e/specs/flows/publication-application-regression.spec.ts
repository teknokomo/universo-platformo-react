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
    listConnectors,
    listPublicationApplications,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'

async function waitForPublicationApplication(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    publicationId: string,
    minimumCount = 1
) {
    let application: Record<string, unknown> | null = null

    await expect
        .poll(async () => {
            const response = await listPublicationApplications(api, metahubId, publicationId)
            application = (response?.items ?? [])[minimumCount - 1] ?? null
            return typeof application?.id === 'string'
        })
        .toBe(true)

    return application
}

async function ensurePublicationApplicationsPageVisible(page: import('@playwright/test').Page) {
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Applications', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()
}

async function waitForConnectors(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string, minimumCount = 1) {
    await expect
        .poll(async () => {
            const response = await listConnectors(api, applicationId)
            return (response?.items ?? []).length >= minimumCount
        })
        .toBe(true)
}

async function waitForApplicationReady(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string) {
    let application: Record<string, unknown> | null = null

    await expect
        .poll(async () => {
            application = await getApplication(api, applicationId)
            return typeof application?.id === 'string'
        })
        .toBe(true)

    return application
}

test('@flow @combined @slow combined and split publication setup both create usable linked applications', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const combinedMetahubName = `E2E ${runManifest.runId} combined publication metahub`
    const combinedMetahubCodename = `${runManifest.runId}-combined-publication-metahub`
    const splitMetahubName = `E2E ${runManifest.runId} split publication metahub`
    const splitMetahubCodename = `${runManifest.runId}-split-publication-metahub`

    try {
        const combinedMetahub = await createMetahub(api, {
            name: { en: combinedMetahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', combinedMetahubCodename)
        })
        const splitMetahub = await createMetahub(api, {
            name: { en: splitMetahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', splitMetahubCodename)
        })

        if (!combinedMetahub?.id || !splitMetahub?.id) {
            throw new Error('Metahub creation did not return ids for publication/application regression coverage')
        }

        await recordCreatedMetahub({
            id: combinedMetahub.id,
            name: combinedMetahubName,
            codename: combinedMetahubCodename
        })
        await recordCreatedMetahub({
            id: splitMetahub.id,
            name: splitMetahubName,
            codename: splitMetahubCodename
        })

        const combinedPublicationName = `E2E ${runManifest.runId} Combined Publication`
        const combinedPublication = await createPublication(api, combinedMetahub.id, {
            name: { en: combinedPublicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            createApplicationSchema: true,
            applicationName: { en: `E2E ${runManifest.runId} Combined App` },
            applicationNamePrimaryLocale: 'en',
            applicationWorkspacesEnabled: true
        })

        if (!combinedPublication?.id) {
            throw new Error('Combined publication creation did not return an id')
        }

        await recordCreatedPublication({
            id: combinedPublication.id,
            metahubId: combinedMetahub.id,
            schemaName: combinedPublication.schemaName
        })

        const combinedLinkedApplication = await waitForPublicationApplication(api, combinedMetahub.id, combinedPublication.id)
        if (!combinedLinkedApplication?.id) {
            throw new Error('Combined publication flow did not create a linked application')
        }

        await recordCreatedApplication({
            id: String(combinedLinkedApplication.id),
            slug: typeof combinedLinkedApplication.slug === 'string' ? combinedLinkedApplication.slug : undefined
        })

        const combinedPersistedApplication = await waitForApplicationReady(api, String(combinedLinkedApplication.id))
        expect(combinedPersistedApplication?.schemaStatus).toBe('synced')
        await waitForConnectors(api, String(combinedLinkedApplication.id))

        await page.goto(`/metahub/${combinedMetahub.id}/publication/${combinedPublication.id}/applications`)
        await ensurePublicationApplicationsPageVisible(page)

        await page.goto(`/a/${combinedLinkedApplication.id}/admin/connectors`)
        await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()

        const splitPublication = await createPublication(api, splitMetahub.id, {
            name: { en: `E2E ${runManifest.runId} Split Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!splitPublication?.id) {
            throw new Error('Split publication creation did not return an id')
        }

        await recordCreatedPublication({
            id: splitPublication.id,
            metahubId: splitMetahub.id,
            schemaName: splitPublication.schemaName
        })

        const splitVersionName = `E2E ${runManifest.runId} Split Version`
        await createPublicationVersion(api, splitMetahub.id, splitPublication.id, {
            name: { en: splitVersionName },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, splitMetahub.id, splitPublication.id)
        await waitForPublicationReady(api, splitMetahub.id, splitPublication.id)

        const splitLinkedResult = await createPublicationLinkedApplication(api, splitMetahub.id, splitPublication.id, {
            name: { en: `E2E ${runManifest.runId} Split App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: true
        })

        if (!splitLinkedResult?.application?.id) {
            throw new Error('Split flow did not return a linked application id')
        }

        await recordCreatedApplication({
            id: splitLinkedResult.application.id,
            slug: splitLinkedResult.application.slug
        })

        await syncApplicationSchema(api, splitLinkedResult.application.id)
        await waitForApplicationReady(api, splitLinkedResult.application.id)
        await waitForConnectors(api, splitLinkedResult.application.id)

        await page.goto(`/metahub/${splitMetahub.id}/publication/${splitPublication.id}/versions`)
        await expect(page.getByText(splitVersionName)).toBeVisible()

        await page.goto(`/metahub/${splitMetahub.id}/publication/${splitPublication.id}/applications`)
        await ensurePublicationApplicationsPageVisible(page)

        await page.goto(`/a/${splitLinkedResult.application.id}/admin/connectors`)
        await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()

        await page.goto(`/a/${splitLinkedResult.application.id}`)
        await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()
    } finally {
        await disposeApiContext(api)
    }
})
