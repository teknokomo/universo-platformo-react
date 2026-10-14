import { expect } from '../fixtures/test'
import { expectNoPageHorizontalOverflow } from './browser/runtimeUx'
import { expectNoAccessibilityViolations, readLocalizedText } from './lmsMarathonGuestShortLinkAssertions'
import { LMS_LYCEUM_MARATHON_ACCESS_LINKS, LMS_LYCEUM_MARATHON_QUIZZES } from './lmsMarathonFixtureContract'
import { readPublishedQuizAccessLinkTargets } from './lmsMarathonGuestShortLinkDatabase'
import type { LmsMarathonApplicationContext, LmsMarathonAuthoredQuizLink, LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

export async function createLmsMarathonGlobalShortLinks(
    application: LmsMarathonApplicationContext,
    authoredQuiz: LmsMarathonAuthoredQuizLink
): Promise<LmsMarathonPreparedFlow> {
    const { page, testInfo, runManifest, resources, applicationId, publicWorkspaceId } = application
    const runSuffix = runManifest.runId.slice(0, 16).toLowerCase()
    const publicWorkspaceLabel = `E2E ${runManifest.runId} LMS Marathon Guest Workspace`
    const createdShortLinks: NonNullable<LmsMarathonPreparedFlow['gradeShortLinks']> = []

    await page.goto(`/a/${applicationId}/admin`)
    const manageShortLinks = page.getByRole('button', { name: 'Guest and short links' })
    await expect(manageShortLinks).toBeVisible({ timeout: 30_000 })
    await manageShortLinks.click()
    await expect(page).toHaveURL(new RegExp(`/a/${applicationId}/admin/short-links$`))
    const guestLinksTable = page.getByRole('table', { name: 'Full guest quiz links' })
    await expect(guestLinksTable).toBeVisible({ timeout: 60_000 })
    const gradeFiveQuiz = LMS_LYCEUM_MARATHON_QUIZZES.find(({ grade }) => grade === 5)
    const gradeFiveAccessLink = LMS_LYCEUM_MARATHON_ACCESS_LINKS.find(({ quizKey }) => quizKey === gradeFiveQuiz?.key)
    if (!gradeFiveAccessLink) throw new Error('The LMS Marathon fixture has no grade 5 guest access link')
    const origin = new URL(page.url()).origin
    const gradeFiveGuestUrl = new URL(`/public/a/${applicationId}/links/${gradeFiveAccessLink.slug}`, origin).toString()
    const gradeFiveGuestRow = guestLinksTable.getByRole('row').filter({ hasText: gradeFiveGuestUrl })
    await expect(gradeFiveGuestRow).toHaveCount(1)
    await expect(gradeFiveGuestRow.getByRole('button', { name: 'Copy link' })).toBeVisible()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
    await gradeFiveGuestRow.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('alert')).toContainText('Full guest link copied.')
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(gradeFiveGuestUrl)

    await page.getByRole('combobox', { name: 'Destination type' }).click()
    await page.getByRole('option', { name: 'Quiz access link', exact: true }).click()
    const shortLinkName = page.getByRole('textbox', { name: 'Short link name' })
    const publishedQuiz = page.getByRole('combobox', { name: 'Published quiz' })
    await expect(shortLinkName).toBeVisible({ timeout: 30_000 })
    const seededQuizAccessLinks = await readPublishedQuizAccessLinkTargets(applicationId, publicWorkspaceId)

    for (const quiz of LMS_LYCEUM_MARATHON_QUIZZES) {
        const accessLink = LMS_LYCEUM_MARATHON_ACCESS_LINKS.find(({ quizKey }) => quizKey === quiz.key)
        if (!accessLink) throw new Error(`The LMS Marathon fixture has no access link for grade ${quiz.grade}`)
        const matchingAccessLinks = seededQuizAccessLinks.filter(({ slug }) => slug === accessLink.slug)
        expect(matchingAccessLinks, `Grade ${quiz.grade} must have one access link in its public workspace`).toHaveLength(1)
        const persistedAccessLink = matchingAccessLinks[0]
        if (!persistedAccessLink) throw new Error(`The grade ${quiz.grade} access link must be persisted before short-link creation`)
        const slug = `e2e-${runSuffix}-lyceum-grade-${quiz.grade}`
        await shortLinkName.fill(slug)
        await publishedQuiz.click()
        const quizOption = page
            .getByRole('option')
            .filter({ hasText: `Grade ${quiz.grade}` })
            .filter({ hasText: publicWorkspaceLabel })
        await expect(quizOption).toHaveCount(1, { timeout: 30_000 })
        await expect(quizOption).toBeVisible()
        await quizOption.click()

        const createRequestPromise = page.waitForRequest((request) => {
            const requestUrl = new URL(request.url())
            return request.method() === 'POST' && requestUrl.pathname === '/api/v1/global-short-links'
        })
        const createResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return response.request().method() === 'POST' && responseUrl.pathname === '/api/v1/global-short-links'
        })
        await page.getByRole('button', { name: 'Create link' }).click()
        const [createRequest, createResponse] = await Promise.all([createRequestPromise, createResponsePromise])
        expect(createResponse.ok(), `Creating the grade ${quiz.grade} short link returned ${createResponse.status()}`).toBe(true)
        const createdRecord = await createResponse.json()
        if (typeof createdRecord.id !== 'string') {
            throw new Error(`Creating the grade ${quiz.grade} global short link did not return its record id`)
        }
        const requestBody = JSON.parse(createRequest.postData() ?? '{}') as {
            slug?: unknown
            target?: { kind?: unknown; applicationId?: unknown; accessLinkId?: unknown; accessLinkSlug?: unknown; workspaceId?: unknown }
        }
        expect(requestBody).toEqual({
            slug,
            target: {
                kind: 'lms-access-link',
                applicationId,
                accessLinkId: persistedAccessLink.id,
                accessLinkSlug: accessLink.slug,
                workspaceId: publicWorkspaceId
            }
        })
        createdShortLinks.push({
            grade: quiz.grade,
            slug,
            id: createdRecord.id,
            accessLinkId: persistedAccessLink.id,
            accessLinkSlug: accessLink.slug,
            workspaceId: publicWorkspaceId
        })
        resources.createdGlobalShortLinkIds ??= []
        resources.createdGlobalShortLinkIds.push(createdRecord.id)
        await expect(page.getByText(`/l/${slug}`, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(shortLinkName).toHaveValue('')
    }

    const authoredShortLinkSlug = `e2e-${runSuffix}-authored-quiz`
    await shortLinkName.fill(authoredShortLinkSlug)
    await publishedQuiz.click()
    const authoredQuizOption = page.getByRole('option').filter({ hasText: authoredQuiz.title }).filter({ hasText: publicWorkspaceLabel })
    await expect(authoredQuizOption, 'The authored quiz access link must be selectable for a global short link').toHaveCount(1, {
        timeout: 30_000
    })
    await authoredQuizOption.click()
    const authoredCreateRequestPromise = page.waitForRequest((request) => {
        const requestUrl = new URL(request.url())
        return request.method() === 'POST' && requestUrl.pathname === '/api/v1/global-short-links'
    })
    const authoredCreateResponsePromise = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'POST' && responseUrl.pathname === '/api/v1/global-short-links'
    })
    await page.getByRole('button', { name: 'Create link' }).click()
    const [authoredCreateRequest, authoredCreateResponse] = await Promise.all([authoredCreateRequestPromise, authoredCreateResponsePromise])
    expect(authoredCreateResponse.ok(), `Creating the authored quiz short link returned ${authoredCreateResponse.status()}`).toBe(true)
    const authoredCreatedRecord = await authoredCreateResponse.json()
    expect(typeof authoredCreatedRecord.id).toBe('string')
    expect(JSON.parse(authoredCreateRequest.postData() ?? '{}')).toEqual({
        slug: authoredShortLinkSlug,
        target: {
            kind: 'lms-access-link',
            applicationId,
            accessLinkId: authoredQuiz.accessLinkId,
            accessLinkSlug: authoredQuiz.accessLinkSlug,
            workspaceId: publicWorkspaceId
        }
    })
    resources.createdGlobalShortLinkIds ??= []
    resources.createdGlobalShortLinkIds.push(authoredCreatedRecord.id as string)
    await expect(page.getByText(`/l/${authoredShortLinkSlug}`, { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(shortLinkName).toHaveValue('')

    const persistedQuizAccessLinks = await readPublishedQuizAccessLinkTargets(applicationId, publicWorkspaceId)
    for (const shortLink of createdShortLinks) {
        const quiz = LMS_LYCEUM_MARATHON_QUIZZES.find(({ grade }) => grade === shortLink.grade)
        if (!quiz) throw new Error(`The LMS Marathon fixture has no quiz for grade ${shortLink.grade}`)
        const accessLink = LMS_LYCEUM_MARATHON_ACCESS_LINKS.find(({ slug }) => slug === shortLink.accessLinkSlug)
        if (!accessLink) throw new Error(`The LMS Marathon fixture has no access-link contract for grade ${shortLink.grade}`)
        const persistedAccessLinks = persistedQuizAccessLinks.filter(({ slug }) => slug === shortLink.accessLinkSlug)
        expect(persistedAccessLinks, `Grade ${shortLink.grade} must have one access link in its public workspace`).toHaveLength(1)
        const [persistedAccessLink] = persistedAccessLinks
        expect(persistedAccessLink, `Grade ${shortLink.grade} access link must be persisted`).toBeTruthy()
        expect(persistedAccessLink?.id).toBe(shortLink.accessLinkId)
        expect(persistedAccessLink?.targetType).toBe('quiz')
        expect(readLocalizedText(persistedAccessLink?.quizTitle, 'en')).toBe(quiz.title.en)
        expect(readLocalizedText(persistedAccessLink?.linkTitle, 'en')).toBe(accessLink.title.en)
        const resolverResponse = await page.request.get(new URL(`/api/v1/public/l/${shortLink.slug}`, origin).toString())
        expect(resolverResponse.status(), `Grade ${shortLink.grade} short link must resolve`).toBe(200)
        expect(await resolverResponse.json()).toEqual({
            target: {
                kind: 'lms-access-link',
                applicationId,
                accessLinkId: shortLink.accessLinkId,
                accessLinkSlug: shortLink.accessLinkSlug,
                workspaceId: shortLink.workspaceId
            }
        })

        const accessResponse = await page.request.get(
            new URL(
                `/api/v1/public/a/${applicationId}/links/${shortLink.accessLinkSlug}?locale=en&workspaceId=${encodeURIComponent(
                    shortLink.workspaceId
                )}`,
                origin
            ).toString()
        )
        expect(accessResponse.status(), `Grade ${shortLink.grade} quiz target must be available`).toBe(200)
        const accessPayload = await accessResponse.json()
        expect(accessPayload).toMatchObject({
            slug: shortLink.accessLinkSlug,
            targetType: 'quiz',
            targetId: persistedAccessLink?.targetId,
            title: readLocalizedText(accessLink.title, 'en')
        })
    }
    const authoredAccessLink = persistedQuizAccessLinks.filter(({ slug }) => slug === authoredQuiz.accessLinkSlug)
    expect(authoredAccessLink, 'The browser-authored quiz must have one active quiz access link').toHaveLength(1)
    expect(readLocalizedText(authoredAccessLink[0]?.quizTitle, 'en')).toBe(authoredQuiz.title)
    const authoredResolverResponse = await page.request.get(new URL(`/api/v1/public/l/${authoredShortLinkSlug}`, origin).toString())
    expect(authoredResolverResponse.status(), 'The authored quiz short link must resolve publicly').toBe(200)
    expect(await authoredResolverResponse.json()).toEqual({
        target: {
            kind: 'lms-access-link',
            applicationId,
            accessLinkId: authoredQuiz.accessLinkId,
            accessLinkSlug: authoredQuiz.accessLinkSlug,
            workspaceId: publicWorkspaceId
        }
    })

    await page.setViewportSize({ width: 1920, height: 1080 })
    await expectNoPageHorizontalOverflow(page, 'LMS Marathon short links management at 1920px')
    await expect(guestLinksTable, 'Full guest quiz links must remain visible on wide desktop screens').toBeVisible()
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-short-links-management-wide.png'),
        fullPage: true,
        animations: 'disabled'
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await expectNoPageHorizontalOverflow(page, 'LMS Marathon short links management')
    await expectNoAccessibilityViolations(page, 'LMS Marathon short links management')
    const shortLinksPageText = await page.locator('body').innerText()
    const shortLinksPageTextWithoutFunctionalUrls = shortLinksPageText.replace(/https?:\/\/\S+/gu, '')
    expect(shortLinksPageTextWithoutFunctionalUrls).not.toContain(applicationId)
    expect(shortLinksPageTextWithoutFunctionalUrls).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu)
    expect(shortLinksPageText).not.toMatch(/\[object Object\]|application-resource|lms-access-link/iu)
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-short-links-management.png'),
        fullPage: true,
        animations: 'disabled'
    })
    for (const viewport of [
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await page.setViewportSize(viewport)
        await expectNoPageHorizontalOverflow(page, `LMS Marathon short links management at ${viewport.width}px`)
        for (const shortLink of createdShortLinks) {
            await expect(page.getByText(`/l/${shortLink.slug}`, { exact: true })).toBeVisible()
        }
        if (viewport.width === 390) {
            await page.screenshot({
                path: testInfo.outputPath('lms-marathon-short-links-management-mobile.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
    }
    await page.setViewportSize({ width: 1440, height: 900 })

    const gradeFiveShortLink = createdShortLinks.find(({ grade }) => grade === 5)
    const gradeTenShortLink = createdShortLinks.find(({ grade }) => grade === 10)
    if (!gradeFiveShortLink || !gradeTenShortLink) throw new Error('The LMS Marathon needs grade 5 and grade 10 short links for its flows')

    return {
        ...application,
        shortLinkSlug: gradeFiveShortLink.slug,
        gradeTenShortLinkSlug: gradeTenShortLink.slug,
        gradeShortLinks: createdShortLinks,
        authoredQuizShortLink: { ...authoredQuiz, slug: authoredShortLinkSlug, id: authoredCreatedRecord.id as string },
        origin
    }
}
