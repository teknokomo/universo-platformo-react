import type { APIRequestContext, Locator, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    createLoggedInApiContext,
    createMetahub,
    createComponent,
    disposeApiContext,
    getApplication,
    getPublication,
    listObjectCollections,
    listPublicationApplications,
    listPublications
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'

type PublicationRecord = {
    id?: string
    schemaName?: string | null
    name?: {
        locales?: Record<string, { content?: string }>
    }
}

async function openCreateDialog(page: import('@playwright/test').Page) {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create Publication' })
    await expect(dialog).toBeVisible()
    return dialog
}

async function fillLocalizedField(dialog: Locator, label: string, value: string) {
    await dialog.getByLabel(label).first().fill(value)
}

function buildExecutionRunId(runId: string, testInfo: TestInfo) {
    const normalizedProject =
        testInfo.project.name
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase()
            .slice(-6) || 'proj'
    return `${runId}-${normalizedProject}-r${testInfo.retry}-p${testInfo.repeatEachIndex}-w${testInfo.workerIndex}`
}

async function enableSwitch(dialog: Locator, name: string) {
    const toggle = dialog.getByLabel(name, { exact: true })

    await expect(toggle).toBeEnabled()

    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await toggle.isChecked()) {
            break
        }

        try {
            await toggle.evaluate((element) => {
                ;(element as HTMLInputElement).click()
            })
        } catch {
            await toggle.setChecked(true, { force: true })
        }

        if (await toggle.isChecked()) {
            break
        }

        await toggle.click({ force: true })
    }

    await expect(toggle).toBeChecked()
}

async function ensurePublicationApplicationsPageVisible(page: import('@playwright/test').Page) {
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Applications', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()
}

async function createPublicationThroughBrowser(
    api: APIRequestContext,
    page: import('@playwright/test').Page,
    metahubId: string,
    options: {
        publicationName: string
        autoCreateApplication?: boolean
        createApplicationSchema?: boolean
    }
) {
    await page.goto(`/metahub/${metahubId}/publications`)
    await expect(page.getByRole('heading', { name: 'Publications' })).toBeVisible()

    const createPublicationResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/publications`),
        {
            timeout: options.createApplicationSchema ? 90_000 : 30_000,
            label: 'Creating publication'
        }
    )

    const dialog = await openCreateDialog(page)
    await fillLocalizedField(dialog, 'Name', options.publicationName)

    if (options.autoCreateApplication) {
        await enableSwitch(dialog, 'Create application')
        if (options.createApplicationSchema) {
            const createSchemaSwitch = dialog.getByLabel('Create application schema', { exact: true })

            await expect(createSchemaSwitch).toBeEnabled()
            await enableSwitch(dialog, 'Create application schema')
        }
    }

    await dialog.getByTestId(entityDialogSelectors.submitButton).click()

    await expect(dialog).toHaveCount(0)

    const response = await createPublicationResponse
    if (!response.ok()) {
        const bodyText = await response.text()
        throw new Error(
            `Creating publication in metahub ${metahubId} failed with ${response.status()} ${response.statusText()}: ${bodyText}`
        )
    }

    const createdPublication = (await response.json()) as PublicationRecord

    if (!createdPublication?.id) {
        throw new Error(`Creating publication in metahub ${metahubId} did not return a publication id`)
    }

    let publication: PublicationRecord | null = null
    await expect
        .poll(
            async () => {
                publication = await getPublication(api, metahubId, createdPublication.id!)
                return publication?.id ?? null
            },
            {
                timeout: 30_000,
                message: `Waiting for publication ${options.publicationName} (${createdPublication.id}) to persist after browser creation`
            }
        )
        .not.toBeNull()

    if (!publication?.id) {
        throw new Error(`Publication ${options.publicationName} was not found after browser creation`)
    }

    return publication
}

test('@flow publication create dialog supports publication-only and publication-plus-application-without-schema variants', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const executionRunId = buildExecutionRunId(runManifest.runId, testInfo)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const publicationOnlyMetahub = await createMetahub(api, {
            name: { en: `E2E ${executionRunId} publication-only metahub` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${executionRunId}-publication-only`)
        })
        const appVariantMetahub = await createMetahub(api, {
            name: { en: `E2E ${executionRunId} publication-app metahub` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${executionRunId}-publication-app`)
        })

        if (!publicationOnlyMetahub?.id || !appVariantMetahub?.id) {
            throw new Error('Metahub creation failed for publication variant coverage')
        }

        await recordCreatedMetahub({
            id: publicationOnlyMetahub.id,
            name: `E2E ${executionRunId} publication-only metahub`,
            codename: `${executionRunId}-publication-only`
        })
        await recordCreatedMetahub({
            id: appVariantMetahub.id,
            name: `E2E ${executionRunId} publication-app metahub`,
            codename: `${executionRunId}-publication-app`
        })

        const publicationOnlyName = `E2E ${executionRunId} Browser Publication Only`
        const publicationOnly = await createPublicationThroughBrowser(api, page, publicationOnlyMetahub.id, {
            publicationName: publicationOnlyName
        })

        await recordCreatedPublication({
            id: publicationOnly.id,
            metahubId: publicationOnlyMetahub.id,
            schemaName: publicationOnly.schemaName
        })

        const publicationOnlyList = await listPublications(api, publicationOnlyMetahub.id)
        expect((publicationOnlyList.items ?? []).some((entry: { id?: string }) => entry.id === publicationOnly.id)).toBe(true)

        const publicationOnlyApplications = await listPublicationApplications(api, publicationOnlyMetahub.id, publicationOnly.id)
        expect((publicationOnlyApplications.items ?? []).length).toBe(0)

        const linkedPublicationName = `E2E ${executionRunId} Browser Publication App`
        const linkedPublication = await createPublicationThroughBrowser(api, page, appVariantMetahub.id, {
            publicationName: linkedPublicationName,
            autoCreateApplication: true,
            createApplicationSchema: false
        })

        await recordCreatedPublication({
            id: linkedPublication.id,
            metahubId: appVariantMetahub.id,
            schemaName: linkedPublication.schemaName
        })

        let linkedApplication: { id?: string; slug?: string; schemaName?: string | null } | null = null
        await expect
            .poll(async () => {
                const payload = await listPublicationApplications(api, appVariantMetahub.id, linkedPublication.id)
                linkedApplication = (payload.items ?? [])[0] ?? null
                return typeof linkedApplication?.id === 'string'
            })
            .toBe(true)

        if (!linkedApplication?.id) {
            throw new Error('Linked application was not created for the publication-with-application variant')
        }

        await recordCreatedApplication({
            id: linkedApplication.id,
            slug: linkedApplication.slug
        })

        const persistedApplication = await getApplication(api, linkedApplication.id)
        expect(persistedApplication.id).toBe(linkedApplication.id)
        expect(typeof persistedApplication.schemaName).toBe('string')
        expect(persistedApplication.schemaStatus).not.toBe('synced')

        await page.goto(`/metahub/${appVariantMetahub.id}/publication/${linkedPublication.id}/applications`)
        await ensurePublicationApplicationsPageVisible(page)
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @combined @slow publication create dialog supports immediate application-schema creation when the metahub has runtime fields', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const executionRunId = buildExecutionRunId(runManifest.runId, testInfo)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahubName = `E2E ${executionRunId} publication-schema metahub`
        const metahubCodename = `${executionRunId}-publication-schema`
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation failed for publication create-with-schema coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const catalogsPayload = await listObjectCollections(api, metahub.id)
        const objectCollection = (catalogsPayload.items ?? [])[0]

        if (!objectCollection?.id) {
            throw new Error('Default objectCollection is missing for publication create-with-schema coverage')
        }

        await createComponent(api, metahub.id, objectCollection.id, {
            name: { en: `Title ${executionRunId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `title_${executionRunId}`),
            dataType: 'STRING',
            isRequired: false
        })

        const publicationName = `E2E ${executionRunId} Browser Publication Schema`
        const publication = await createPublicationThroughBrowser(api, page, metahub.id, {
            publicationName,
            autoCreateApplication: true,
            createApplicationSchema: true
        })

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        let linkedApplication: { id?: string; slug?: string; schemaName?: string | null; schemaStatus?: string | null } | null = null
        await expect
            .poll(async () => {
                const payload = await listPublicationApplications(api, metahub.id, publication.id!)
                linkedApplication = (payload.items ?? [])[0] ?? null
                return typeof linkedApplication?.id === 'string'
            })
            .toBe(true)

        if (!linkedApplication?.id) {
            throw new Error('Linked application was not created for the publication-with-schema variant')
        }

        await recordCreatedApplication({
            id: linkedApplication.id,
            slug: linkedApplication.slug
        })

        let persistedApplication: { id?: string; schemaName?: string | null; schemaStatus?: string | null } | null = null
        await expect
            .poll(async () => {
                persistedApplication = await getApplication(api, linkedApplication!.id!)
                return persistedApplication?.schemaStatus ?? null
            })
            .toBe('synced')

        expect(persistedApplication?.id).toBe(linkedApplication.id)
        expect(typeof persistedApplication?.schemaName).toBe('string')
        expect(persistedApplication?.schemaName).toBeTruthy()

        await page.goto(`/metahub/${metahub.id}/publication/${publication.id}/applications`)
        await ensurePublicationApplicationsPageVisible(page)
    } finally {
        await disposeApiContext(api)
    }
})
