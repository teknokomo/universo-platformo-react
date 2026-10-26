import { createLocalizedContent, generateUuidV7 } from '@universo-react/utils'
import { request as playwrightRequest } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import {
    expectDataGridHorizontalScrollConstrained,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix
} from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    createRuntimeRow,
    disposeApiContext,
    getApplicationRuntime,
    listApplicationWorkspaces,
    listObjectCollections,
    sendWithCsrf,
    setApplicationPublicEntryWorkspace,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { waitForMetahubEnumerationId, waitForOptionValueId } from '../../support/lmsRuntime'
import { navigateGuestQuizOptionWithKeyboard } from '../../support/browser/guestQuizKeyboard'

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

test('@flow public lms dashboard and guest links enforce anonymous and guest journeys through the browser', async ({
    page,
    browser,
    runManifest
}, testInfo) => {
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
            id: applicationId
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
        await setApplicationPublicEntryWorkspace(api, applicationId, workspaceId)

        const ownerWorkspaces = (await listApplicationWorkspaces(api, applicationId)) as {
            items?: Array<{
                id?: string
                workspaceType?: string
                personalUserId?: string | null
                roleCodename?: string
            }>
        }
        const personalWorkspace = ownerWorkspaces.items?.find(
            (candidate) => candidate.workspaceType === 'personal' && candidate.roleCodename === 'owner'
        )
        if (!personalWorkspace?.id || personalWorkspace.personalUserId !== runManifest.testUser.userId) {
            throw new Error('The LMS public runtime test requires the owner personal workspace')
        }
        const privateUserScopedTitle = `E2E ${runManifest.runId} private user scoped LMS content`
        const privateUserScopedRow = await createRuntimeRow(api, applicationId, {
            workspaceId: personalWorkspace.id,
            objectCollectionId: learningResourcesCatalogId,
            data: {
                SortOrder: 1,
                Title: privateUserScopedTitle,
                Description: 'Personal LMS data that must not enter the public Dashboard projection',
                ResourceType: pageResourceTypeValueId,
                Source: { type: 'page', pageCodename: 'LearnerHome' },
                PublicationStatus: publishedPublicationStatusValueId,
                EstimatedTimeMinutes: 1,
                ContentItems: []
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, learningResourcesCatalogId, privateUserScopedRow.id, personalWorkspace.id)
        const recentRelationResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/rows/${privateUserScopedRow.id}/library/recent?workspaceId=${personalWorkspace.id}`,
            { objectCollectionId: learningResourcesCatalogId, active: true }
        )
        if (!recentRelationResponse.ok) {
            throw new Error(`Registering the personal LMS row in Recent failed with ${recentRelationResponse.status}`)
        }
        expect(await recentRelationResponse.json(), 'The private row is registered in the owner personal Recent library').toMatchObject({
            relationKey: 'recent',
            active: true
        })

        const baseURL = testInfo.project.use.baseURL
        if (typeof baseURL !== 'string') throw new Error('The LMS public runtime test project must define the E2E base URL')
        const publicDashboardPath = `/api/v1/public/applications/${applicationId}/runtime?${new URLSearchParams({
            targetKind: 'page',
            entityTypeCodename: 'LearnerHome',
            locale: 'en'
        })}`
        const readAnonymousDashboardDto = async () => {
            const publicDtoContext = await playwrightRequest.newContext({
                baseURL,
                storageState: { cookies: [], origins: [] }
            })
            try {
                const response = await publicDtoContext.get(publicDashboardPath)
                expect(response.status(), 'The isolated cookie-free API context receives the public Dashboard DTO').toBe(200)
                return await response.json()
            } finally {
                await publicDtoContext.dispose()
            }
        }
        const anonymousContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
        try {
            const anonymousPage = await anonymousContext.newPage()
            const memberRuntimeRequests: string[] = []
            const anonymousMutationRequests: string[] = []
            anonymousContext.on('request', (request) => {
                const url = new URL(request.url())
                if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(url.pathname)) {
                    memberRuntimeRequests.push(`${request.method()} ${url.pathname}`)
                }
                if (url.pathname.startsWith('/api/') && request.method() !== 'GET') {
                    anonymousMutationRequests.push(`${request.method()} ${url.pathname}`)
                }
            })
            const dashboardResponsePromise = anonymousPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'GET' && url.pathname === `/api/v1/public/applications/${applicationId}/runtime`
            })
            await anonymousPage.goto(`/a/${applicationId}?targetKind=page&entityTypeCodename=LearnerHome&locale=en`)
            const dashboardResponse = await dashboardResponsePromise
            expect(dashboardResponse.status(), 'A published LMS Dashboard loads through its anonymous runtime').toBe(200)
            const dashboardPayload = await readAnonymousDashboardDto()
            const menuProjection = dashboardPayload.dashboard?.placements?.find(
                (placement: { widgetKey?: string }) => placement.widgetKey === 'menuWidget'
            )
            expect(menuProjection?.runtimeData?.status, 'The LMS menu projection is resolved').toBe('ready')
            expect(
                menuProjection?.runtimeData?.data,
                'The first configured LMS section exposes the next configured semantic destination'
            ).toMatchObject({
                navigationAction: {
                    label: 'Course Overview',
                    source: { kind: 'page', codename: 'LearnerHome' },
                    target: { kind: 'page', codename: 'CourseOverview' }
                }
            })
            expect(JSON.stringify(dashboardPayload), 'Anonymous responses never include the owner personal-workspace row').not.toContain(
                privateUserScopedTitle
            )
            await expect(anonymousPage).not.toHaveURL(/\/auth(?:\?|$)/u)
            await expect(anonymousPage.getByTestId('runtime-main-content')).toBeVisible()
            const navigation = anonymousPage.getByRole('navigation', { name: 'Application navigation', exact: true })
            const mainContent = anonymousPage.getByRole('main')
            await expect(mainContent.getByRole('heading', { name: 'Welcome to your learning portal', exact: true })).toBeVisible()
            await expect(navigation.getByRole('listitem'), 'Anonymous LMS navigation keeps one configured menu item').toHaveCount(1)
            await expect(navigation.getByRole('listitem')).toContainText('Learning')
            await expect(navigation.getByRole('link')).toHaveCount(0)
            await expect(anonymousPage.getByText(privateUserScopedTitle, { exact: true })).toHaveCount(0)
            await expect(mainContent.getByText('No dashboard content is available yet.')).toHaveCount(0)
            await expect(mainContent.getByRole('heading', { name: /^(?:LMS|Learning Management System)$/iu })).toHaveCount(0)
            await expect(mainContent.getByRole('tab', { name: 'My Courses', exact: true })).toBeVisible()
            const recentTab = mainContent.getByRole('tab', { name: 'Recent', exact: true })
            await expect(recentTab).toBeVisible()
            await recentTab.click()
            await expect(recentTab).toHaveAttribute('aria-selected', 'true')
            await expect(mainContent.getByText(privateUserScopedTitle, { exact: true })).toHaveCount(0)
            await expect(anonymousPage.getByRole('alert').filter({ hasText: 'No matching content was found.' }).first()).toBeVisible()
            await expect(
                anonymousPage.getByRole('button', {
                    name: /^(?:Create|Add|Edit|Delete|Save|Создать|Добавить|Изменить|Удалить|Сохранить)/iu
                })
            ).toHaveCount(0)
            await expectNoTechnicalLeakage(anonymousPage.locator('body'), {
                label: 'Anonymous LMS Dashboard',
                checkUuidSubstrings: true
            })
            for (const viewport of [
                { name: 'desktop', width: 1440, height: 900 },
                { name: 'wide-desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await anonymousPage.setViewportSize({ width: viewport.width, height: viewport.height })
                await expectNoPageHorizontalOverflow(anonymousPage, `Anonymous LMS Dashboard at ${viewport.width}px`)
                if (viewport.width < 900) {
                    const openMenuButton = anonymousPage.getByRole('button', { name: /^(?:Open menu|Открыть меню)$/u })
                    await expect(openMenuButton, `Anonymous LMS navigation opens at ${viewport.width}px`).toBeVisible()
                    await openMenuButton.click()
                }
                await expect(navigation, `The first LMS navigation entry is visible at ${viewport.width}px`).toBeVisible()
                const menuItems = navigation.getByRole('listitem')
                await expect(menuItems, 'Anonymous LMS navigation keeps only its first configured item').toHaveCount(1)
                await expect(menuItems).toBeVisible()
                await expect(menuItems).toContainText('Learning')
                await anonymousPage.screenshot({
                    path: testInfo.outputPath(`lms-public-dashboard-${viewport.name}.png`),
                    fullPage: true,
                    animations: 'disabled'
                })
                if (viewport.width < 900) {
                    await anonymousPage.keyboard.press('Escape')
                    await expect(navigation).toBeHidden()
                }
            }
            await anonymousPage.setViewportSize({ width: 1440, height: 900 })
            const courseOverviewLink = anonymousPage.getByTestId('public-dashboard-next-section')
            await expect(courseOverviewLink, 'The configured second LMS page is available through the Dashboard CTA').toHaveText(
                'Course Overview'
            )
            await expect(courseOverviewLink).toHaveAttribute('href', /targetKind=page.*entityTypeCodename=CourseOverview.*locale=en/u)
            const courseOverviewResponsePromise = anonymousPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname === `/api/v1/public/applications/${applicationId}/runtime` &&
                    url.searchParams.get('targetKind') === 'page' &&
                    url.searchParams.get('entityTypeCodename') === 'CourseOverview'
                )
            })
            await courseOverviewLink.click()
            const courseOverviewResponse = await courseOverviewResponsePromise
            expect(courseOverviewResponse.status(), 'The semantic CTA opens the configured LMS page anonymously').toBe(200)
            const courseOverviewUrl = new URL(anonymousPage.url())
            expect(courseOverviewUrl.searchParams.get('targetKind')).toBe('page')
            expect(courseOverviewUrl.searchParams.get('entityTypeCodename')).toBe('CourseOverview')
            await expect(mainContent.getByRole('heading', { name: 'Course overview', exact: true })).toBeVisible()
            await expect(navigation.getByRole('listitem'), 'The secondary page does not add a second sidebar item').toHaveCount(1)
            expect(
                memberRuntimeRequests,
                'User-scoped LMS rows must never use the authenticated runtime API for an anonymous visitor'
            ).toEqual([])
            expect(anonymousMutationRequests, 'Anonymous LMS Dashboard navigation must not submit API mutations').toEqual([])
        } finally {
            await anonymousContext.close()
        }

        const quizRow = await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: quizzesCatalogId,
            data: {
                Title: 'Guest quiz',
                Description: 'Public guest quiz',
                PassingScorePercent: 50,
                MaxAttempts: 3,
                ConfirmAnswerBeforeNext: true,
                Questions: [
                    {
                        Prompt: 'Which organelle is primarily responsible for photosynthesis?',
                        QuestionDescription: 'Choose one answer.',
                        QuestionType: singleChoiceValueId,
                        Difficulty: 1,
                        Explanation: 'Photosynthesis occurs in chloroplasts.',
                        Options: [
                            { id: generateUuidV7(), label: 'Chloroplast', isCorrect: true },
                            { id: generateUuidV7(), label: 'Mitochondrion', isCorrect: false }
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
                            { id: generateUuidV7(), label: 'Carbon dioxide', isCorrect: true },
                            { id: generateUuidV7(), label: 'Nitrogen', isCorrect: false }
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
                SortOrder: 1,
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

        const populatedDashboardContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
        try {
            const populatedDashboardPage = await populatedDashboardContext.newPage()
            const memberRuntimeRequests: string[] = []
            const anonymousMutationRequests: string[] = []
            populatedDashboardContext.on('request', (request) => {
                const url = new URL(request.url())
                if (/^\/api\/v1\/applications\/[^/]+\/runtime(?:\/|$)/u.test(url.pathname)) {
                    memberRuntimeRequests.push(`${request.method()} ${url.pathname}`)
                }
                if (url.pathname.startsWith('/api/') && request.method() !== 'GET') {
                    anonymousMutationRequests.push(`${request.method()} ${url.pathname}`)
                }
            })
            const populatedRuntimeResponsePromise = populatedDashboardPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'GET' && url.pathname === `/api/v1/public/applications/${applicationId}/runtime`
            })
            await populatedDashboardPage.goto(`/a/${applicationId}?targetKind=page&entityTypeCodename=LearnerHome&locale=en`)
            const populatedRuntimeResponse = await populatedRuntimeResponsePromise
            expect(
                populatedRuntimeResponse.status(),
                'The anonymous Dashboard projects public LMS records through the public endpoint'
            ).toBe(200)
            const populatedRuntimePayload = await readAnonymousDashboardDto()
            expect(
                JSON.stringify(populatedRuntimePayload),
                'The populated anonymous response excludes the owner personal-workspace row'
            ).not.toContain(privateUserScopedTitle)
            const populatedMain = populatedDashboardPage.getByRole('main')
            await expect(populatedMain.getByRole('heading', { name: 'Welcome to your learning portal', exact: true })).toBeVisible()
            const populatedRecentTab = populatedMain.getByRole('tab', { name: 'Recent', exact: true })
            await expect(populatedRecentTab).toBeVisible()
            await populatedRecentTab.click()
            await expect(populatedRecentTab).toHaveAttribute('aria-selected', 'true')
            await expect(
                populatedDashboardPage.getByRole('alert').filter({ hasText: 'No matching content was found.' }).first(),
                'The actor-scoped Recent view renders its explicit empty state for an anonymous visitor'
            ).toBeVisible()
            await expect(populatedDashboardPage.getByText(privateUserScopedTitle, { exact: true })).toHaveCount(0)
            await expect(
                populatedMain.getByText('Guest photosynthesis lesson', { exact: true }),
                'The public Dashboard does not expose a user-scoped Library row to an anonymous visitor'
            ).toHaveCount(0)
            await expect(populatedMain.getByText('Public LMS lesson with embedded quiz', { exact: true })).toHaveCount(0)
            await expect(populatedMain.getByText(/\[object Object\]|\{\s*"(?:ContentItems|Source|Body)"/u)).toHaveCount(0)
            await expect(
                populatedDashboardPage.getByRole('button', {
                    name: /^(?:Create|Add|Edit|Delete|Save|Создать|Добавить|Изменить|Удалить|Сохранить)/iu
                })
            ).toHaveCount(0)
            await expectNoTechnicalLeakage(populatedDashboardPage.locator('body'), {
                label: 'Anonymous LMS Dashboard with published content',
                checkUuidSubstrings: true
            })
            for (const viewport of [
                { name: 'wide-desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await populatedDashboardPage.setViewportSize({ width: viewport.width, height: viewport.height })
                await expectNoPageHorizontalOverflow(populatedDashboardPage, `Populated anonymous LMS at ${viewport.width}px`)
                await expect(populatedMain.getByRole('heading', { name: 'Welcome to your learning portal', exact: true })).toBeVisible()
                if (viewport.width < 900) {
                    const openMenuButton = populatedDashboardPage.getByRole('button', { name: /^(?:Open menu|Открыть меню)$/u })
                    await expect(openMenuButton).toBeVisible()
                    await openMenuButton.click()
                }
                const navigation = populatedDashboardPage.getByRole('navigation', { name: 'Application navigation', exact: true })
                const menuItems = navigation.getByRole('listitem')
                await expect(menuItems, 'Populated anonymous LMS navigation keeps only its first configured item').toHaveCount(1)
                await expect(menuItems).toBeVisible()
                await expect(menuItems).toContainText('Learning')
                if ((await populatedDashboardPage.locator('.MuiDataGrid-root:visible').count()) > 0) {
                    await expectDataGridHorizontalScrollConstrained(
                        populatedDashboardPage,
                        `Populated anonymous LMS DataGrid at ${viewport.width}px`
                    )
                }
                await populatedDashboardPage.screenshot({
                    path: testInfo.outputPath(`lms-public-dashboard-populated-${viewport.name}.png`),
                    fullPage: true,
                    animations: 'disabled'
                })
                if (viewport.width < 900) {
                    await populatedDashboardPage.keyboard.press('Escape')
                    await expect(navigation).toBeHidden()
                }
            }
            expect(memberRuntimeRequests, 'Anonymous populated LMS reads must not use member runtime APIs').toEqual([])
            expect(anonymousMutationRequests, 'Anonymous populated LMS browsing must not submit API mutations').toEqual([])
        } finally {
            await populatedDashboardContext.close()
        }

        const accessLinkRow = await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: accessLinksCatalogId,
            data: {
                Slug: 'guest-lms-demo',
                ContentNodeIdRef: contentRow.id,
                IsActive: true,
                MaxUses: 3,
                LinkTitle: 'Guest LMS demo',
                ShowFirstName: true,
                RequireFirstName: true
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
        await expect(page.getByLabel('First name')).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Public LMS guest start page',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Public LMS guest start page')
        await expectRuntimeUxViewportMatrix(page, 'Public LMS guest start page', {
            beforeEachViewport: async (viewport) => {
                await expect(page.getByLabel('First name')).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `Public LMS guest start page ${viewport.name}`,
                    checkUuidSubstrings: true
                })
                await page.screenshot({ path: testInfo.outputPath(`lms-guest-start-${viewport.name}.png`), fullPage: true })
            }
        })
        await page.getByLabel('First name').fill('Guest learner')
        await page.getByLabel('Last name').fill('Public runtime')
        const termsConsent = page.getByRole('checkbox', { name: 'I agree to the Terms of Service' })
        const privacyConsent = page.getByRole('checkbox', { name: 'I have read and accept the Privacy Policy' })
        const startLearningButton = page.getByRole('button', { name: 'Start learning' })
        await expect(startLearningButton, 'Required consent keeps guest intake disabled').toBeDisabled()
        await page.getByLabel('First name').focus()
        await page.keyboard.press('Tab')
        await expect(page.getByLabel('Last name'), 'Last name must be reachable by keyboard').toBeFocused()
        await page.keyboard.press('Tab')
        await expect(termsConsent, 'Terms acceptance must be reachable by keyboard').toBeFocused()
        await termsConsent.press('Space')
        await expect(termsConsent).toBeChecked()
        await expect(startLearningButton, 'Both required consents are needed before continuing').toBeDisabled()
        await page.keyboard.press('Tab')
        await expect(page.getByRole('link', { name: 'Terms of Service', exact: true })).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(privacyConsent, 'Privacy acceptance must be reachable by keyboard').toBeFocused()
        await privacyConsent.press('Space')
        await expect(privacyConsent).toBeChecked()
        await expect(startLearningButton).toBeEnabled()
        await page.keyboard.press('Tab')
        await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toBeFocused()
        await page.keyboard.press('Tab')
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
        const firstQuestion = page.getByText('Which organelle is primarily responsible for photosynthesis?')
        const secondQuestion = page.getByText('Plants need sunlight, water, and which gas to complete photosynthesis?')
        await expect(firstQuestion).toBeVisible({ timeout: 30_000 })
        await expect(secondQuestion).toBeHidden()
        await expect(firstQuestion, 'Opening a quiz must move keyboard focus to its first question').toBeFocused()
        await expectRuntimeUxViewportMatrix(page, 'Public LMS guest quiz question', {
            beforeEachViewport: async (viewport) => {
                await expect(firstQuestion).toBeVisible({ timeout: 30_000 })
                await expect(page.getByRole('radiogroup')).toBeVisible()
                await expect(page.getByLabel('Chloroplast')).toBeVisible()
                await expect(page.getByLabel('Mitochondrion')).toBeVisible()
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `Public LMS guest quiz question ${viewport.name}`,
                    checkUuidSubstrings: true
                })
                await page.screenshot({ path: testInfo.outputPath(`lms-guest-quiz-${viewport.name}.png`), fullPage: true })
            }
        })

        const chloroplastAnswer = page.getByLabel('Chloroplast')
        const firstKeyboardRequests = await navigateGuestQuizOptionWithKeyboard(page, chloroplastAnswer)
        try {
            const submitFirstAnswer = page.getByRole('button', { name: 'Submit answer', exact: true })
            await expect(submitFirstAnswer).toBeVisible()
            await expect(page.getByText('Answer selected. Confirm to continue.')).toBeVisible()
            expect(firstKeyboardRequests.getCount()).toBe(0)
            const mitochondrionAnswer = page.getByLabel('Mitochondrion')
            await mitochondrionAnswer.click()
            await expect(mitochondrionAnswer).toBeChecked()
            expect(firstKeyboardRequests.getCount(), 'Changing a staged answer must not save it').toBe(0)
            await chloroplastAnswer.click()
            await expect(chloroplastAnswer).toBeChecked()
            expect(firstKeyboardRequests.getCount()).toBe(0)
            await page.keyboard.press('Tab')
            await expect(submitFirstAnswer, 'The selected answer must have a keyboard-accessible confirmation').toBeFocused()
            expect(firstKeyboardRequests.getCount()).toBe(0)
            const firstAnswerResponsePromise = page.waitForResponse((response) => {
                const path = new URL(response.url()).pathname
                return response.request().method() === 'PUT' && /\/runtime\/attempts\/[^/]+\/answers$/u.test(path)
            })
            await page.keyboard.press('Space')
            expect((await firstAnswerResponsePromise).status()).toBe(200)
            expect(firstKeyboardRequests.getCount()).toBe(1)
        } finally {
            firstKeyboardRequests.stop()
        }
        await expect(secondQuestion).toBeVisible({ timeout: 30_000 })
        await expect(firstQuestion).toBeHidden()
        await expect(secondQuestion, 'Advancing a quiz must move keyboard focus to its next question').toBeFocused()

        const carbonDioxideAnswer = page.getByLabel('Carbon dioxide')
        const secondKeyboardRequests = await navigateGuestQuizOptionWithKeyboard(page, carbonDioxideAnswer)
        try {
            const submitSecondAnswer = page.getByRole('button', { name: 'Submit answer', exact: true })
            await expect(submitSecondAnswer).toBeVisible()
            await expect(page.getByText('Answer selected. Confirm to continue.')).toBeVisible()
            expect(secondKeyboardRequests.getCount()).toBe(0)
            await page.keyboard.press('Tab')
            await expect(submitSecondAnswer, 'The selected answer must have a keyboard-accessible confirmation').toBeFocused()
            expect(secondKeyboardRequests.getCount()).toBe(0)
            const secondAnswerResponsePromise = page.waitForResponse((response) => {
                const path = new URL(response.url()).pathname
                return response.request().method() === 'PUT' && /\/runtime\/attempts\/[^/]+\/answers$/u.test(path)
            })
            await page.keyboard.press('Space')
            expect((await secondAnswerResponsePromise).status()).toBe(200)
            expect(secondKeyboardRequests.getCount()).toBe(1)
        } finally {
            secondKeyboardRequests.stop()
        }
        await expect(page.getByRole('heading', { name: 'Quiz completed' })).toBeVisible({ timeout: 30_000 })
        const quizResultStatus = page.getByRole('status')
        await expect(quizResultStatus).toContainText('Correct answers: 2 of 2')
        await expect(quizResultStatus).toContainText('Passed')
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Public LMS guest quiz result page',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Public LMS guest quiz result page')
        await expectRuntimeUxViewportMatrix(page, 'Public LMS guest quiz result page', {
            beforeEachViewport: async (viewport) => {
                await expect(page.getByRole('heading', { name: 'Quiz completed' })).toBeVisible({ timeout: 30_000 })
                await expect(quizResultStatus).toContainText('Correct answers: 2 of 2')
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
