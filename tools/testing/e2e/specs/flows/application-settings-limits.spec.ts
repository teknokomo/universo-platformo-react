import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { expectHorizontalEdgesAligned } from '../../support/browser/spacing'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    createRuntimeRow,
    disposeApiContext,
    getApplicationRuntime,
    getApplicationWorkspaceLimits,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { applicationSelectors, buildApplicationLimitInputSelector, pageSpacingSelectors } from '../../support/selectors/contracts'

type RuntimeState = {
    catalog?: {
        id?: string
        name?: string
        codename?: string
    }
    workspaceLimit?: {
        maxRows: number | null
        currentRows: number
        canCreate: boolean
    }
}

async function waitForRuntimeState(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string, catalogId?: string) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = await getApplicationRuntime(api, applicationId, catalogId ? { catalogId } : {})
            return typeof runtimeState?.catalog?.id === 'string'
        })
        .toBe(true)

    if (!runtimeState?.catalog?.id) {
        throw new Error(`Runtime catalog did not become available for application ${applicationId}`)
    }

    return runtimeState
}

test('@flow @combined application settings persist workspace limits and runtime create becomes blocked at the limit', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} limits metahub`
    const metahubCodename = `${runManifest.runId}-limits-metahub`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for application settings coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const publication = await createPublication(api, metahub.id, {
            name: { en: `E2E ${runManifest.runId} Limits Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for application settings coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Limits Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Limits App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: true
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an application id for settings coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        const initialRuntime = await waitForRuntimeState(api, applicationId)
        const catalogId = initialRuntime.catalog?.id

        if (typeof catalogId !== 'string') {
            throw new Error(`Runtime catalog id is missing for application ${applicationId}`)
        }

        await page.goto(`/a/${applicationId}`)
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })

        const createdRow = await createRuntimeRow(api, applicationId, {
            catalogId,
            data: {}
        })

        if (!createdRow?.id) {
            throw new Error(`Runtime row creation did not return an id for application ${applicationId}`)
        }

        await page.goto(`/a/${applicationId}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible()
        await expectHorizontalEdgesAligned(
            page.getByTestId(pageSpacingSelectors.applicationSettingsTabs),
            page.getByTestId(pageSpacingSelectors.applicationSettingsContent)
        )
        await page.getByRole('tab', { name: 'Limits' }).click()

        const limitInput = page.getByTestId(buildApplicationLimitInputSelector(catalogId))
        await expect(limitInput).toBeVisible()
        await limitInput.fill('1')

        const saveRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'PUT' && response.url().endsWith(`/api/v1/applications/${applicationId}/settings/limits`)
        )
        await page.getByTestId(applicationSelectors.limitsSaveButton).click()
        const saveResponse = await saveRequest
        expect(saveResponse.ok()).toBe(true)

        await expect
            .poll(async () => {
                const limits = await getApplicationWorkspaceLimits(api, applicationId)
                return limits.find((limit) => limit.objectId === catalogId)?.maxRows ?? null
            })
            .toBe(1)

        await expect
            .poll(async () => {
                const runtime = await getApplicationRuntime(api, applicationId, { catalogId })
                return runtime?.workspaceLimit ?? null
            })
            .toMatchObject({
                maxRows: 1,
                currentRows: 1,
                canCreate: false
            })

        await page.goto(`/a/${applicationId}`)
        await expect(page.getByTestId(applicationSelectors.runtimeWorkspaceLimitBanner)).toContainText('1 / 1', { timeout: 30_000 })
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeDisabled({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
