import type { Response } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { applicationSelectors, entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'

type EntityTypeRecord = {
    id?: string
    kindKey?: string
}

type EntityRecord = {
    id?: string
    kind?: string
}

type RuntimeSectionRecord = {
    id?: string
    name?: string
}

type RuntimeState = {
    sections?: RuntimeSectionRecord[]
    activeSectionId?: string | null
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

function buildSuffix(runId: string): string {
    const normalized = runId.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return normalized.slice(-8) || 'e2e'
}

test('@flow @combined published custom entities survive publication sync and open as runtime sections', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const suffix = buildSuffix(runManifest.runId)
    const metahubName = `E2E ${runManifest.runId} entities publication runtime`
    const metahubCodename = `${runManifest.runId}-entities-publication-runtime`
    const publicationName = `E2E ${runManifest.runId} Entities Publication`
    const applicationName = `E2E ${runManifest.runId} Entities Runtime`
    const customKindKey = `custom.object-${suffix}`
    const customTypeName = `Objects ${suffix}`
    const customEntityName = `Published Object ${suffix}`
    const customEntityCodename = `published-object-${suffix}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for entities publication/runtime coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/entities`)
        await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible()

        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const createTypeDialog = page.getByRole('dialog', { name: /Create Entity(?: Type)?/ })
        await expect(createTypeDialog).toBeVisible()
        await createTypeDialog.getByLabel('Select template').click()
        await page.getByRole('option', { name: /^Objects\b/i }).click()

        await expect.poll(async () => createTypeDialog.getByLabel('Kind key').inputValue()).toBe('object')
        await createTypeDialog.getByLabel('Kind key').fill(customKindKey)
        await createTypeDialog.getByLabel('Name').first().fill(customTypeName)

        const createTypeRequest = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entity-types`),
            { label: 'Creating published custom entity type' }
        )

        await createTypeDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdType = await parseJsonResponse<EntityTypeRecord>(await createTypeRequest, 'Creating published custom entity type')
        if (!createdType.id) {
            throw new Error('Create entity type response did not contain an id')
        }

        const dynamicMenuLink = page.getByRole('link', { name: customTypeName, exact: true })
        await expect(dynamicMenuLink).toBeVisible()
        await dynamicMenuLink.click()

        await expect(page).toHaveURL(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await expect(page.getByRole('heading', { name: new RegExp(customTypeName) })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Create entity')

        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const createEntityDialog = page.getByRole('dialog', { name: /Create (Entity|Object)/ })
        await expect(createEntityDialog).toBeVisible()
        await createEntityDialog.getByLabel('Name').first().fill(customEntityName)
        await createEntityDialog.getByLabel('Codename').first().fill(customEntityCodename)

        const createEntityRequest = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities`),
            { label: 'Creating published custom entity instance' }
        )

        await createEntityDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdEntity = await parseJsonResponse<EntityRecord>(await createEntityRequest, 'Creating published custom entity instance')
        if (!createdEntity.id) {
            throw new Error('Create entity instance response did not contain an id')
        }

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for entities publication/runtime coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Entities Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for entities publication/runtime coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        let runtimeState: RuntimeState | null = null
        let runtimeSection: RuntimeSectionRecord | undefined
        await expect
            .poll(
                async () => {
                    runtimeState = (await getApplicationRuntime(api, applicationId)) as RuntimeState
                    runtimeSection = runtimeState.sections?.find((section) => section.name === customEntityName)
                    return typeof runtimeSection?.id === 'string'
                },
                {
                    timeout: 60_000,
                    message: 'Waiting for the published custom entity to appear in application runtime sections'
                }
            )
            .toBe(true)

        if (!runtimeSection?.id) {
            throw new Error('Published custom entity did not appear in application runtime sections')
        }

        const runtimeSectionId = runtimeSection.id

        const sectionState = (await getApplicationRuntime(api, applicationId, { objectCollectionId: runtimeSectionId })) as RuntimeState
        expect(sectionState.activeSectionId).toBe(runtimeSectionId)

        await page.goto(`/a/${applicationId}?objectCollectionId=${runtimeSectionId}`)
        await expect(page).toHaveURL(new RegExp(`/a/${applicationId}\\?objectCollectionId=${runtimeSectionId}$`))
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
