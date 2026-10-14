import { expect, test } from '../../fixtures/test'
import { requestApi } from '../../support/backend/api-session.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import { createLmsMarathonApplication } from '../../support/lmsMarathonGuestShortLinkApplication'
import { cleanupLmsMarathonGuestFlow } from '../../support/lmsMarathonGuestShortLinkCleanup'
import type { LmsMarathonFlowResources } from '../../support/lmsMarathonGuestShortLinkTypes'

const WELCOME_PAGE_NAME = 'Welcome'
const WELCOME_PAGE_CODENAME = 'LearnerHome'
const WELCOME_PAGE_TITLE = 'Welcome to your learning portal'
const WELCOME_PAGE_SECTION_TITLE = 'How to start'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

test('@flow @short-links application-resource short link opens its published LMS page for an authenticated owner', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(900_000)

    const resources: LmsMarathonFlowResources = { cleanupErrors: [] }
    let createdLinkId: string | null = null
    let applicationIdForCleanup: string | null = null
    let shortLinkSlugForCleanup: string | null = null
    let scenarioError: unknown
    let scenarioFailed = false

    try {
        const application = await createLmsMarathonApplication({ browser, page, testInfo, runManifest, resources })
        applicationIdForCleanup = application.applicationId
        const runSlug = runManifest.runId
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40)
            .replace(/-+$/g, '')
        const shortLinkSlug = `e2e-resource-${runSlug || 'run'}`
        shortLinkSlugForCleanup = shortLinkSlug

        await page.goto(`/a/${application.applicationId}/admin/short-links`)
        await expect(page.getByRole('heading', { name: 'Guest and short links' })).toBeVisible({ timeout: 30_000 })
        await expectNoPageHorizontalOverflow(page, 'Application resource short-link manager')

        await page.getByRole('textbox', { name: 'Short link name' }).fill(shortLinkSlug)
        await page.getByRole('combobox', { name: 'Destination type' }).click()
        await page.getByRole('option', { name: 'Published resource', exact: true }).click()

        const publishedResource = page.getByRole('combobox', { name: 'Published resource' })
        await expect(publishedResource).toBeEnabled({ timeout: 60_000 })
        await publishedResource.click()
        await page.getByRole('option', { name: WELCOME_PAGE_NAME, exact: true }).click()

        const createRequestPromise = page.waitForRequest((request) => {
            const requestUrl = new URL(request.url())
            return request.method() === 'POST' && requestUrl.pathname === '/api/v1/global-short-links'
        })
        const createResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return response.request().method() === 'POST' && responseUrl.pathname === '/api/v1/global-short-links'
        })
        await page.getByRole('button', { name: 'Create link', exact: true }).click()
        const [createRequest, createResponse] = await Promise.all([createRequestPromise, createResponsePromise])

        const responsePayload: unknown = await createResponse.json().catch(() => null)
        if (isRecord(responsePayload) && typeof responsePayload.id === 'string') {
            createdLinkId = responsePayload.id
            resources.createdGlobalShortLinkIds = [createdLinkId]
        }

        expect(createResponse.ok(), `Creating the application resource short link returned ${createResponse.status()}`).toBe(true)
        expect(createRequest.postDataJSON()).toMatchObject({
            slug: shortLinkSlug,
            target: {
                kind: 'application-resource',
                applicationId: application.applicationId,
                targetKind: 'page',
                entityTypeCodename: WELCOME_PAGE_CODENAME
            }
        })
        if (!createdLinkId) {
            throw new Error('Creating the application resource short link did not return its record id')
        }

        await expect(page.getByRole('alert')).toContainText('Short link created.')
        const linksTable = page.getByRole('table', { name: 'Application short links' })
        const createdRow = linksTable.getByRole('row').filter({ hasText: `/l/${shortLinkSlug}` })
        await expect(createdRow).toHaveCount(1)
        await expect(createdRow).toContainText(WELCOME_PAGE_NAME)
        await expect(createdRow).toContainText('Published resource')
        await expectNoTechnicalLeakage(page.getByRole('main'), { label: 'Application resource short-link manager' })
        await testInfo.attach('authenticated-application-short-link-manager', {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png'
        })

        const origin = new URL(page.url()).origin
        const resolveResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return response.request().method() === 'GET' && responseUrl.pathname === `/api/v1/public/l/${shortLinkSlug}`
        })
        await page.goto(new URL(`/l/${shortLinkSlug}`, origin).toString())
        const resolveResponse = await resolveResponsePromise

        expect(resolveResponse.status(), 'The public short-link resolver should return the published target').toBe(200)
        expect(await resolveResponse.json()).toMatchObject({
            target: {
                kind: 'application-resource',
                applicationId: application.applicationId,
                targetKind: 'page',
                entityTypeCodename: WELCOME_PAGE_CODENAME
            }
        })

        await expect(page.getByRole('heading', { name: WELCOME_PAGE_TITLE, exact: true })).toBeVisible({ timeout: 60_000 })
        await expect(page.getByRole('heading', { name: WELCOME_PAGE_SECTION_TITLE, exact: true })).toBeVisible()

        const runtimeUrl = new URL(page.url())
        expect(runtimeUrl.pathname).toBe(`/a/${application.applicationId}`)
        expect(runtimeUrl.searchParams.get('targetKind')).toBe('page')
        expect(runtimeUrl.searchParams.get('entityTypeCodename')).toBe(WELCOME_PAGE_CODENAME)
        await expectNoPageHorizontalOverflow(page, 'Authenticated published LMS resource')
        await expectNoTechnicalLeakage(page.getByRole('main'), { label: 'Authenticated published LMS resource' })
        await testInfo.attach('authenticated-published-lms-resource', {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png'
        })
    } catch (error) {
        scenarioFailed = true
        scenarioError = error
    }

    if (!createdLinkId && resources.api && applicationIdForCleanup && shortLinkSlugForCleanup) {
        try {
            const params = new URLSearchParams({
                applicationId: applicationIdForCleanup,
                includeReleased: 'false',
                limit: '100',
                offset: '0'
            })
            const response = await requestApi(resources.api, `/api/v1/global-short-links?${params.toString()}`)
            if (!response.ok) {
                throw new Error(`Discovering the temporary short link for cleanup failed with ${response.status}`)
            }
            const payload: unknown = await response.json()
            const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items : []
            const createdRecord = items.find(
                (item): item is Record<string, unknown> =>
                    isRecord(item) &&
                    item.slug === shortLinkSlugForCleanup &&
                    isRecord(item.target) &&
                    item.target.kind === 'application-resource' &&
                    item.target.applicationId === applicationIdForCleanup
            )
            if (createdRecord && typeof createdRecord.id === 'string') {
                createdLinkId = createdRecord.id
                resources.createdGlobalShortLinkIds = [createdLinkId]
            }
        } catch (error) {
            resources.cleanupErrors.push(error)
        }
    }

    try {
        await cleanupLmsMarathonGuestFlow(resources)
    } catch (error) {
        resources.cleanupErrors.push(error)
    }

    if (scenarioFailed && resources.cleanupErrors.length > 0) {
        throw new Error(
            `Application-resource short-link flow failed: ${String(scenarioError)}. Cleanup also failed: ${resources.cleanupErrors
                .map(String)
                .join('; ')}`,
            { cause: scenarioError }
        )
    }
    if (scenarioFailed) throw scenarioError
    if (resources.cleanupErrors.length > 0) {
        throw new Error(
            `Cleaning up the application resource short-link E2E flow failed: ${resources.cleanupErrors.map(String).join('; ')}`
        )
    }
})
