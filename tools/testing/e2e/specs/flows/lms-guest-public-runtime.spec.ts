import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    getApplicationRuntime,
    createRuntimeRow,
    disposeApiContext,
    listLinkedCollections,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const readRuntimeLabel = (value) => {
    if (typeof value === 'string') {
        return value
    }
    if (!value || typeof value !== 'object') {
        return ''
    }
    const directTitle = value.title
    if (typeof directTitle === 'string') {
        return directTitle
    }
    const directName = value.name
    if (typeof directName === 'string') {
        return directName
    }
    const locales = value.locales
    if (!locales || typeof locales !== 'object') {
        return ''
    }
    return locales.en?.content ?? locales.ru?.content ?? ''
}

const normalizeEntityLookup = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '')

async function waitForMetahubCatalogId(api: ApiContext, metahubId: string, expectedName: string) {
    let catalogId = null

    await expect
        .poll(
            async () => {
                const catalogsResponse = await listLinkedCollections(api, metahubId, { limit: 100, offset: 0 })
                const catalogs = catalogsResponse.items ?? []
                const normalizedExpectedName = normalizeEntityLookup(expectedName)
                const match = catalogs.find((item) => {
                    const candidates = [item.codename, item.name, item.title]
                        .map((candidate) => readRuntimeLabel(candidate))
                        .filter((candidate) => candidate.length > 0)
                    return candidates.some((candidate) => normalizeEntityLookup(candidate) === normalizedExpectedName)
                })
                catalogId = match?.id ?? null
                return catalogId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return catalogId
}

async function waitForApplicationCatalogId(api: ApiContext, applicationId: string, expectedName: string) {
    let catalogId = null

    await expect
        .poll(
            async () => {
                const runtime = await getApplicationRuntime(api, applicationId)
                const catalogs = runtime.catalogs ?? []
                const normalizedExpectedName = normalizeEntityLookup(expectedName)
                const match = catalogs.find((item) => {
                    const candidates = [item.codename, item.name, item.title]
                        .map((candidate) => readRuntimeLabel(candidate))
                        .filter((candidate) => candidate.length > 0)
                    return candidates.some((candidate) => normalizeEntityLookup(candidate) === normalizedExpectedName)
                })
                catalogId = match?.id ?? null
                return catalogId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return catalogId
}

async function waitForApplicationRuntimeRow(api: ApiContext, applicationId: string, catalogId: string, rowId: string) {
    let row = null

    await expect
        .poll(
            async () => {
                const runtime = await getApplicationRuntime(api, applicationId, { catalogId })
                row = (runtime.rows ?? []).find((item) => item?.id === rowId) ?? null
                return row?.id ?? null
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBe(rowId)

    return row
}

test('@flow public lms guest links enforce the guest journey through the browser', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahub = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} LMS Guest` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-lms-guest`),
            templateCodename: 'lms'
        })

        if (!metahub?.id) {
            throw new Error('LMS guest flow metahub creation did not return an id')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: `E2E ${runManifest.runId} LMS Guest`,
            codename: `${runManifest.runId}-lms-guest`
        })

        const publication = await createPublication(api, metahub.id, {
            name: { en: `E2E ${runManifest.runId} LMS Guest Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('LMS guest flow publication creation did not return an id')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} LMS Guest Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        await waitForMetahubCatalogId(api, metahub.id, 'Quizzes')
        await waitForMetahubCatalogId(api, metahub.id, 'AccessLinks')

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} LMS Guest App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: true
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Public LMS application creation did not return an id')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })

        const quizzesCatalogId = await waitForApplicationCatalogId(api, applicationId, 'Quizzes')
        const accessLinksCatalogId = await waitForApplicationCatalogId(api, applicationId, 'AccessLinks')

        const quizRow = await createRuntimeRow(api, applicationId, {
            linkedCollectionId: quizzesCatalogId,
            data: {
                Title: 'Guest quiz',
                Description: 'Public guest quiz'
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, quizzesCatalogId, quizRow.id)

        const accessLinkRow = await createRuntimeRow(api, applicationId, {
            linkedCollectionId: accessLinksCatalogId,
            data: {
                Slug: 'guest-lms-demo',
                TargetType: 'quiz',
                TargetId: quizRow.id,
                IsActive: true,
                MaxUses: 3,
                UseCount: 0,
                LinkTitle: 'Guest LMS demo'
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, accessLinksCatalogId, accessLinkRow.id)

        await expect
            .poll(
                async () => {
                    const response = await page.request.get(`/api/v1/public/a/${applicationId}/links/guest-lms-demo`)
                    if (response.status() !== 200) {
                        return `${response.status()}:${await response.text()}`
                    }

                    const payload = await response.json()
                    return typeof payload?.id === 'string' ? payload.id : 'missing-link-id'
                },
                { timeout: 30_000, intervals: [500, 1_000, 2_000] }
            )
            .toBe(accessLinkRow.id)

        const guestSessionResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/public/a/${applicationId}/guest-session`)
        )

        await page.goto(`/public/a/${applicationId}/links/guest-lms-demo`)
        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Your name').fill('Guest learner')
        await expect(page.getByRole('button', { name: 'Start learning' })).toBeEnabled({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Start learning' }).click()

        const guestSessionResponse = await guestSessionResponsePromise
        expect(guestSessionResponse.status()).toBe(201)

        await expect(page.getByText('Guest quiz')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Submit quiz' }).click()
        await expect(page.getByText('Score 0 / 0')).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
