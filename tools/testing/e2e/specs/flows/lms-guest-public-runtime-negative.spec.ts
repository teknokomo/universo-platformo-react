import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    createRuntimeRow,
    disposeApiContext,
    getApplicationRuntime,
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

async function setupPublicGuestApplication(api: ApiContext, runManifest, suffix: string) {
    const metahub = await createMetahub(api, {
        name: { en: `E2E ${runManifest.runId} LMS Guest ${suffix}` },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', `${runManifest.runId}-lms-guest-${suffix.toLowerCase()}`),
        templateCodename: 'lms'
    })

    if (!metahub?.id) {
        throw new Error('LMS guest negative flow metahub creation did not return an id')
    }

    await recordCreatedMetahub({
        id: metahub.id,
        name: `E2E ${runManifest.runId} LMS Guest ${suffix}`,
        codename: `${runManifest.runId}-lms-guest-${suffix.toLowerCase()}`
    })

    const publication = await createPublication(api, metahub.id, {
        name: { en: `E2E ${runManifest.runId} LMS Guest ${suffix} Publication` },
        namePrimaryLocale: 'en',
        autoCreateApplication: false
    })

    if (!publication?.id) {
        throw new Error('LMS guest negative flow publication creation did not return an id')
    }

    await recordCreatedPublication({
        id: publication.id,
        metahubId: metahub.id,
        schemaName: publication.schemaName
    })

    await createPublicationVersion(api, metahub.id, publication.id, {
        name: { en: `E2E ${runManifest.runId} LMS Guest ${suffix} Version` },
        namePrimaryLocale: 'en'
    })
    await syncPublication(api, metahub.id, publication.id)
    await waitForPublicationReady(api, metahub.id, publication.id)

    await waitForMetahubCatalogId(api, metahub.id, 'Quizzes')
    await waitForMetahubCatalogId(api, metahub.id, 'AccessLinks')

    const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
        name: { en: `E2E ${runManifest.runId} LMS Guest ${suffix} App` },
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
            Title: 'Negative flow guest quiz',
            Description: 'Public guest quiz'
        }
    })

    return {
        applicationId,
        accessLinksCatalogId,
        quizId: quizRow.id
    }
}

test('@flow public lms guest links reject wrong slug, expired links, and exhausted max-uses', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const { applicationId, accessLinksCatalogId, quizId } = await setupPublicGuestApplication(api, runManifest, 'Negative')

        await createRuntimeRow(api, applicationId, {
            linkedCollectionId: accessLinksCatalogId,
            data: {
                Slug: 'expired-link',
                TargetType: 'quiz',
                TargetId: quizId,
                IsActive: true,
                MaxUses: 3,
                UseCount: 0,
                ExpiresAt: new Date(Date.now() - 60_000).toISOString(),
                LinkTitle: 'Expired link'
            }
        })

        await createRuntimeRow(api, applicationId, {
            linkedCollectionId: accessLinksCatalogId,
            data: {
                Slug: 'maxed-link',
                TargetType: 'quiz',
                TargetId: quizId,
                IsActive: true,
                MaxUses: 1,
                UseCount: 1,
                LinkTitle: 'Maxed link'
            }
        })

        const missingResponse = await page.request.get(`/api/v1/public/a/${applicationId}/links/wrong-slug`)
        expect(missingResponse.status()).toBe(404)

        await page.goto(`/public/a/${applicationId}/links/wrong-slug`)
        await expect(page.getByText('Access link was not found or is no longer active.')).toBeVisible({ timeout: 30_000 })

        const expiredResponse = await page.request.get(`/api/v1/public/a/${applicationId}/links/expired-link`)
        expect(expiredResponse.status()).toBe(403)

        await page.goto(`/public/a/${applicationId}/links/expired-link`)
        await expect(page.getByText('Access link was not found or is no longer active.')).toBeVisible({ timeout: 30_000 })

        const maxedResponse = await page.request.get(`/api/v1/public/a/${applicationId}/links/maxed-link`)
        expect(maxedResponse.status()).toBe(403)

        await page.goto(`/public/a/${applicationId}/links/maxed-link`)
        await expect(page.getByText('Access link was not found or is no longer active.')).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
