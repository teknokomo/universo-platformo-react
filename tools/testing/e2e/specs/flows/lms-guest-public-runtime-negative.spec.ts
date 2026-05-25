import { createLocalizedContent } from '@universo-react/utils'
import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    createRuntimeRow,
    disposeApiContext,
    listObjectCollections,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

test.setTimeout(900_000)

const assertPublicLinkErrorPage = async (
    page: Page,
    label: string,
    screenshotPath: string,
    expectedText = 'Access link was not found or is no longer active.'
) => {
    await expect(page.getByText(expectedText)).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(page.locator('body'), {
        label,
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, label)
    await expectRuntimeUxViewportMatrix(page, label, {
        beforeEachViewport: async (viewport) => {
            await expect(page.getByText(expectedText)).toBeVisible({ timeout: 30_000 })
            await page.screenshot({ path: screenshotPath.replace(/\.png$/i, `-${viewport.name}.png`), fullPage: true })
        }
    })
}

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

const findObjectCollectionByCodenameOrLabel = (objectCollections, expectedName: string) => {
    const normalizedExpectedName = normalizeEntityLookup(expectedName)
    const codenameMatch = objectCollections.find((item) => {
        const codename = readRuntimeLabel(item.codename)
        return codename.length > 0 && normalizeEntityLookup(codename) === normalizedExpectedName
    })

    if (codenameMatch) {
        return codenameMatch
    }

    return objectCollections.find((item) => {
        const candidates = [item.name, item.title]
            .map((candidate) => readRuntimeLabel(candidate))
            .filter((candidate) => candidate.length > 0)
        return candidates.some((candidate) => normalizeEntityLookup(candidate) === normalizedExpectedName)
    })
}

async function waitForMetahubCatalogId(api: ApiContext, metahubId: string, expectedName: string) {
    let objectCollectionId = null

    await expect
        .poll(
            async () => {
                const catalogsResponse = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
                const objectCollections = catalogsResponse.items ?? []
                const match = findObjectCollectionByCodenameOrLabel(objectCollections, expectedName)
                objectCollectionId = match?.id ?? null
                return objectCollectionId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return objectCollectionId
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

    const quizzesCatalogId = await waitForMetahubCatalogId(api, metahub.id, 'Quizzes')
    const accessLinksCatalogId = await waitForMetahubCatalogId(api, metahub.id, 'AccessLinks')

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

    const workspaceResponse = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/runtime/workspaces`, {
        name: createLocalizedContent('en', `E2E ${runManifest.runId} LMS Guest ${suffix} Public Workspace`)
    })
    if (!workspaceResponse.ok) {
        throw new Error(`Creating public LMS guest shared workspace failed with ${workspaceResponse.status}`)
    }
    const workspace = await workspaceResponse.json()
    const workspaceId = workspace?.id
    if (typeof workspaceId !== 'string') {
        throw new Error('Public LMS guest shared workspace creation did not return an id')
    }

    const quizRow = await createRuntimeRow(api, applicationId, {
        workspaceId,
        objectCollectionId: quizzesCatalogId,
        data: {
            Title: 'Negative flow guest quiz',
            Description: 'Public guest quiz'
        }
    })

    return {
        applicationId,
        accessLinksCatalogId,
        workspaceId,
        quizId: quizRow.id
    }
}

test('@flow public lms guest links reject wrong slug, expired links, and exhausted max-uses', async ({ page, runManifest }, testInfo) => {
    test.setTimeout(900_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const { applicationId, accessLinksCatalogId, workspaceId, quizId } = await setupPublicGuestApplication(api, runManifest, 'Negative')

        await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: accessLinksCatalogId,
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
            workspaceId,
            objectCollectionId: accessLinksCatalogId,
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
        await assertPublicLinkErrorPage(
            page,
            'Public LMS guest wrong-slug error page',
            testInfo.outputPath('lms-guest-wrong-slug-error.png')
        )

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/public/a/${applicationId}/links/wrong-slug?locale=ru`)
        await assertPublicLinkErrorPage(
            page,
            'Public LMS guest wrong-slug RU error page',
            testInfo.outputPath('lms-guest-wrong-slug-ru-error.png'),
            'Ссылка доступа не найдена или больше не активна.'
        )
        await applyBrowserPreferences(page, { language: 'en' })

        const expiredResponse = await page.request.get(`/api/v1/public/a/${applicationId}/links/expired-link`)
        expect(expiredResponse.status()).toBe(403)

        await page.goto(`/public/a/${applicationId}/links/expired-link`)
        await assertPublicLinkErrorPage(
            page,
            'Public LMS guest expired-link error page',
            testInfo.outputPath('lms-guest-expired-link-error.png')
        )

        const maxedResponse = await page.request.get(`/api/v1/public/a/${applicationId}/links/maxed-link`)
        expect(maxedResponse.status()).toBe(403)

        await page.goto(`/public/a/${applicationId}/links/maxed-link`)
        await assertPublicLinkErrorPage(
            page,
            'Public LMS guest maxed-link error page',
            testInfo.outputPath('lms-guest-maxed-link-error.png')
        )
    } finally {
        await disposeApiContext(api)
    }
})
