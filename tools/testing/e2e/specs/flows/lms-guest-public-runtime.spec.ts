import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    createRuntimeRow,
    disposeApiContext,
    getApplicationRuntime,
    listObjectCollections,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { waitForMetahubEnumerationId, waitForOptionValueId } from '../../support/lmsRuntime'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

test.setTimeout(900_000)

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

async function waitForApplicationRuntimeRow(
    api: ApiContext,
    applicationId: string,
    objectCollectionId: string,
    rowId: string,
    workspaceId?: string
) {
    let row = null

    await expect
        .poll(
            async () => {
                const runtime = await getApplicationRuntime(api, applicationId, { objectCollectionId, workspaceId })
                row = (runtime.rows ?? []).find((item) => item?.id === rowId) ?? null
                return row?.id ?? null
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBe(rowId)

    return row
}

const expectGuestProgressIntentRequest = (request, expected: Record<string, unknown>) => {
    const body = JSON.parse(request.postData() ?? '{}')

    expect(body).toMatchObject(expected)
    expect(body).not.toHaveProperty('progressPercent')
    expect(body).not.toHaveProperty('status')
    expect(body).not.toHaveProperty('lastAccessedItemIndex')

    return body
}

test('@flow public lms guest links enforce the guest journey through the browser', async ({ page, runManifest }, testInfo) => {
    test.setTimeout(900_000)

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

        const quizzesCatalogId = await waitForMetahubCatalogId(api, metahub.id, 'Quizzes')
        const learningResourcesCatalogId = await waitForMetahubCatalogId(api, metahub.id, 'LearningResources')
        const accessLinksCatalogId = await waitForMetahubCatalogId(api, metahub.id, 'AccessLinks')
        const contentProgressCatalogId = await waitForMetahubCatalogId(api, metahub.id, 'ContentProgress')

        const contentTypeEnumerationId = await waitForMetahubEnumerationId(api, metahub.id, 'Content Type')
        const resourceTypeEnumerationId = await waitForMetahubEnumerationId(api, metahub.id, 'Resource Type')
        const publicationStatusEnumerationId = await waitForMetahubEnumerationId(api, metahub.id, 'Publication Status')
        const questionTypeEnumerationId = await waitForMetahubEnumerationId(api, metahub.id, 'Question Type')
        const textValueId = await waitForOptionValueId(api, metahub.id, contentTypeEnumerationId, 'Text')
        const quizRefValueId = await waitForOptionValueId(api, metahub.id, contentTypeEnumerationId, 'QuizRef')
        const pageResourceTypeValueId = await waitForOptionValueId(api, metahub.id, resourceTypeEnumerationId, 'Page')
        const publishedPublicationStatusValueId = await waitForOptionValueId(api, metahub.id, publicationStatusEnumerationId, 'Published')
        const singleChoiceValueId = await waitForOptionValueId(api, metahub.id, questionTypeEnumerationId, 'SingleChoice')

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

        const workspaceResponse = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/runtime/workspaces`, {
            name: createLocalizedContent('en', `E2E ${runManifest.runId} LMS Guest Public Workspace`)
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
                Title: 'Guest quiz',
                Description: 'Public guest quiz',
                PassingScorePercent: 50,
                MaxAttempts: 3,
                Questions: [
                    {
                        Prompt: 'Which organelle is primarily responsible for photosynthesis?',
                        QuestionDescription: 'Choose one answer.',
                        QuestionType: singleChoiceValueId,
                        Difficulty: 1,
                        Explanation: 'Photosynthesis occurs in chloroplasts.',
                        Options: [
                            { id: 'q1-opt-a', label: 'Chloroplast', isCorrect: true },
                            { id: 'q1-opt-b', label: 'Mitochondrion', isCorrect: false }
                        ],
                        SortOrder: 1
                    },
                    {
                        Prompt: 'Plants need sunlight, water, and which gas to complete photosynthesis?',
                        QuestionDescription: 'Choose one answer.',
                        QuestionType: singleChoiceValueId,
                        Difficulty: 1,
                        Explanation: 'Carbon dioxide is consumed during photosynthesis.',
                        Options: [
                            { id: 'q2-opt-a', label: 'Carbon dioxide', isCorrect: true },
                            { id: 'q2-opt-b', label: 'Nitrogen', isCorrect: false }
                        ],
                        SortOrder: 2
                    }
                ]
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, quizzesCatalogId, quizRow.id, workspaceId)

        const contentRow = await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: learningResourcesCatalogId,
            data: {
                Title: 'Guest photosynthesis lesson',
                Description: 'Public LMS lesson with embedded quiz',
                ResourceType: pageResourceTypeValueId,
                Source: { type: 'page', pageCodename: 'LearnerHome' },
                PublicationStatus: publishedPublicationStatusValueId,
                EstimatedTimeMinutes: 10,
                ContentItems: [
                    {
                        ItemType: textValueId,
                        ItemTitle: 'Lesson overview',
                        ItemContent: 'Plants use sunlight to convert water and carbon dioxide into glucose and oxygen.',
                        SortOrder: 1
                    },
                    {
                        ItemType: quizRefValueId,
                        ItemTitle: 'Knowledge check',
                        QuizId: quizRow.id,
                        SortOrder: 2
                    },
                    {
                        ItemType: textValueId,
                        ItemTitle: 'Summary',
                        ItemContent: 'Chloroplasts are the key organelles for photosynthesis.',
                        SortOrder: 3
                    }
                ]
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, learningResourcesCatalogId, contentRow.id, workspaceId)

        const accessLinkRow = await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: accessLinksCatalogId,
            data: {
                Slug: 'guest-lms-demo',
                TargetType: 'content',
                TargetId: contentRow.id,
                ContentNodeIdRef: contentRow.id,
                IsActive: true,
                MaxUses: 3,
                UseCount: 0,
                LinkTitle: 'Guest LMS demo'
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, accessLinksCatalogId, accessLinkRow.id, workspaceId)

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
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Public LMS guest start page',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Public LMS guest start page')
        await expectRuntimeUxViewportMatrix(page, 'Public LMS guest start page', {
            beforeEachViewport: async (viewport) => {
                await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `Public LMS guest start page ${viewport.name}`,
                    checkUuidSubstrings: true
                })
                await page.screenshot({ path: testInfo.outputPath(`lms-guest-start-${viewport.name}.png`), fullPage: true })
            }
        })
        await page.getByLabel('Your name').fill('Guest learner')
        await expect(page.getByRole('button', { name: 'Start learning' })).toBeEnabled({ timeout: 30_000 })
        await page.getByLabel('Your name').press('Tab')
        const startLearningButton = page.getByRole('button', { name: 'Start learning' })
        await expect(startLearningButton, 'Public guest start action must be reachable by keyboard').toBeFocused()
        await page.keyboard.press('Enter')

        const guestSessionResponse = await guestSessionResponsePromise
        expect(guestSessionResponse.status()).toBe(201)

        await expect(page.getByText('Guest photosynthesis lesson', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Plants use sunlight to convert water and carbon dioxide into glucose and oxygen.')).toBeVisible()
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Public LMS guest content page',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Public LMS guest content page')
        await expectRuntimeUxViewportMatrix(page, 'Public LMS guest content page', {
            beforeEachViewport: async (viewport) => {
                await expect(page.getByText('Guest photosynthesis lesson', { exact: true })).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `Public LMS guest content page ${viewport.name}`,
                    checkUuidSubstrings: true
                })
                await page.screenshot({ path: testInfo.outputPath(`lms-guest-content-${viewport.name}.png`), fullPage: true })
            }
        })
        const viewProgressRequestPromise = page.waitForRequest(
            (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/public/a/${applicationId}/runtime/guest-progress`)
        )
        await page.getByRole('button', { name: 'Next' }).click()
        const viewProgressRequest = await viewProgressRequestPromise
        const viewProgressBody = expectGuestProgressIntentRequest(viewProgressRequest, {
            contentNodeId: contentRow.id,
            action: 'view'
        })
        expect(typeof viewProgressBody.contentItemId).toBe('string')

        await expect(page.getByText('Knowledge check')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Open quiz' }).click()
        await expect(page.getByText('Which organelle is primarily responsible for photosynthesis?')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Plants need sunlight, water, and which gas to complete photosynthesis?')).toBeVisible()
        await page.getByLabel('Chloroplast').check()
        await page.getByLabel('Carbon dioxide').check()

        const submitQuizButton = page.getByRole('button', { name: 'Submit quiz' })
        await submitQuizButton.focus()
        await expect(submitQuizButton, 'Public guest submit action must support keyboard activation').toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByText('Score 2 / 2')).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Public LMS guest quiz result page',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Public LMS guest quiz result page')
        await expectRuntimeUxViewportMatrix(page, 'Public LMS guest quiz result page', {
            beforeEachViewport: async (viewport) => {
                await expect(page.getByText('Score 2 / 2')).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `Public LMS guest quiz result page ${viewport.name}`,
                    checkUuidSubstrings: true
                })
                await page.screenshot({ path: testInfo.outputPath(`lms-guest-result-${viewport.name}.png`), fullPage: true })
            }
        })
        await page.getByRole('button', { name: 'Back to content' }).click()

        const summaryProgressRequestPromise = page.waitForRequest(
            (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/public/a/${applicationId}/runtime/guest-progress`)
        )
        await page.getByRole('button', { name: 'Next' }).click()
        const summaryProgressRequest = await summaryProgressRequestPromise
        expectGuestProgressIntentRequest(summaryProgressRequest, {
            contentNodeId: contentRow.id,
            action: 'view'
        })
        await expect(page.getByText('Chloroplasts are the key organelles for photosynthesis.')).toBeVisible({ timeout: 30_000 })

        const completeProgressResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/public/a/${applicationId}/runtime/guest-progress`) &&
                JSON.parse(response.request().postData() ?? '{}').action === 'complete'
        )
        await page.getByRole('button', { name: 'Complete content' }).click()
        const completeProgressResponse = await completeProgressResponsePromise
        expect(completeProgressResponse.status()).toBe(200)
        expectGuestProgressIntentRequest(completeProgressResponse.request(), {
            contentNodeId: contentRow.id,
            action: 'complete'
        })
        await expect(page.getByText('Content complete. Progress has been recorded for this session.')).toBeVisible({ timeout: 30_000 })

        await expect
            .poll(
                async () => {
                    const runtime = await getApplicationRuntime(api, applicationId, {
                        objectCollectionId: contentProgressCatalogId,
                        workspaceId
                    })
                    return (runtime.rows ?? []).length
                },
                { timeout: 30_000, intervals: [500, 1_000, 2_000] }
            )
            .toBe(1)
    } finally {
        await disposeApiContext(api)
    }
})
