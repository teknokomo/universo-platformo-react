import { expect } from '../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'
import { LMS_LYCEUM_MARATHON_ACCESS_LINKS, LMS_LYCEUM_MARATHON_QUIZZES } from './lmsMarathonFixtureContract'
import { assertPublicAssessmentAttemptState, expectCurrentAttemptQuestion, readLocalizedText } from './lmsMarathonGuestShortLinkAssertions'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

export async function runLmsMarathonAllGradesGuestSmoke(flow: LmsMarathonPreparedFlow): Promise<void> {
    const { browser, applicationId, publicWorkspaceId, origin, gradeShortLinks } = flow
    const expectedGrades = LMS_LYCEUM_MARATHON_QUIZZES.map(({ grade }) => grade).sort((left, right) => left - right)
    const linksByGrade = [...gradeShortLinks].sort((left, right) => left.grade - right.grade)
    expect(
        linksByGrade.map(({ grade }) => grade),
        'Every published grade from 5 through 11 must have a short link'
    ).toEqual(expectedGrades)

    let reportAccessDenialChecked = false
    for (const shortLink of linksByGrade) {
        const quiz = LMS_LYCEUM_MARATHON_QUIZZES.find(({ grade }) => grade === shortLink.grade)
        if (!quiz) throw new Error(`The LMS Marathon fixture has no quiz for grade ${shortLink.grade}`)
        const accessLink = LMS_LYCEUM_MARATHON_ACCESS_LINKS.find(({ quizKey }) => quizKey === quiz.key)
        if (!accessLink) throw new Error(`The LMS Marathon fixture has no access link for grade ${shortLink.grade}`)
        expect(shortLink.accessLinkSlug, `Grade ${shortLink.grade} short link must target its published quiz`).toBe(accessLink.slug)

        const context = await browser.newContext({
            storageState: { cookies: [], origins: [] },
            locale: 'en-US',
            timezoneId: 'UTC',
            colorScheme: 'light',
            reducedMotion: 'reduce',
            viewport: { width: 390, height: 844 }
        })

        try {
            await context.clearCookies()
            expect(await context.cookies(origin), `Grade ${shortLink.grade} must start without authenticated cookies`).toHaveLength(0)

            if (!reportAccessDenialChecked) {
                const reportResponse = await context.request.post(
                    new URL(
                        `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
                        origin
                    ).toString(),
                    { data: { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 } }
                )
                expect(
                    [401, 403, 419],
                    'An anonymous browser request must be rejected by authentication or CSRF protection before report data is returned'
                ).toContain(reportResponse.status())
                expect(await reportResponse.text()).not.toContain('"rows"')
                reportAccessDenialChecked = true
            }

            const page = await context.newPage()
            const resolverResponsePromise = page.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return response.request().method() === 'GET' && responseUrl.pathname === `/api/v1/public/l/${shortLink.slug}`
            })
            const accessResponsePromise = page.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    responseUrl.pathname === `/api/v1/public/a/${applicationId}/links/${accessLink.slug}` &&
                    responseUrl.searchParams.get('workspaceId') === shortLink.workspaceId
                )
            })

            await page.goto(new URL(`/l/${shortLink.slug}?locale=en`, origin).toString())
            const resolverResponse = await resolverResponsePromise
            expect(resolverResponse.status(), `Grade ${shortLink.grade} short link must resolve anonymously`).toBe(200)
            expect(await resolverResponse.json()).toEqual({
                target: {
                    kind: 'lms-access-link',
                    applicationId,
                    accessLinkId: shortLink.accessLinkId,
                    accessLinkSlug: accessLink.slug,
                    workspaceId: shortLink.workspaceId
                }
            })
            expect(new URL(page.url()).searchParams.has('workspaceId')).toBe(false)

            const accessResponse = await accessResponsePromise
            expect(accessResponse.status(), `Grade ${shortLink.grade} published quiz intake must be available anonymously`).toBe(200)
            expect(await accessResponse.json()).toMatchObject({
                slug: accessLink.slug,
                targetType: 'quiz',
                title: readLocalizedText(accessLink.title, 'en'),
                intake: {
                    showFirstName: true,
                    requireFirstName: true,
                    showLastName: true,
                    requireLastName: true,
                    showEmail: false,
                    requireEmail: false,
                    showPhone: false,
                    requirePhone: false,
                    captchaEnabled: false
                }
            })

            const firstName = page.getByLabel('First name')
            const lastName = page.getByLabel('Last name')
            await expect(firstName).toBeVisible({ timeout: 30_000 })
            await expect(lastName).toBeVisible()
            const intakeTitle = readLocalizedText(accessLink.title, 'en')
            if (!intakeTitle) throw new Error(`Grade ${shortLink.grade} intake has no English title`)
            await expect(page.getByText(intakeTitle, { exact: true })).toBeVisible()
            await expect(page.getByRole('link', { name: 'Terms of Service', exact: true })).toHaveAttribute('href', '/terms')
            await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute('href', '/privacy')
            const termsConsent = page.getByRole('checkbox', { name: /Terms of Service/u })
            const privacyConsent = page.getByRole('checkbox', { name: /Privacy Policy/u })
            await expect(termsConsent, 'Terms consent must have an accessible label').toHaveCount(1)
            await expect(privacyConsent, 'Privacy consent must have an accessible label').toHaveCount(1)
            await expectNoTechnicalLeakage(page.locator('body'), {
                label: `Grade ${shortLink.grade} guest intake`,
                checkUuidSubstrings: true
            })
            await expectNoPageHorizontalOverflow(page, `Grade ${shortLink.grade} guest intake at 390x844`)

            await firstName.fill('E2E Marathon')
            await lastName.fill(`Grade ${shortLink.grade}`)
            let guestSessionRequestCount = 0
            page.on('request', (request) => {
                const requestUrl = new URL(request.url())
                if (request.method() === 'POST' && requestUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`) {
                    guestSessionRequestCount += 1
                }
            })

            const startButton = page.getByRole('button', { name: 'Start learning' })
            await startButton.click()
            await expect(page.getByText('Accept the Terms of Service to continue.', { exact: true })).toBeVisible()
            await expect(page.getByText('Accept the Privacy Policy to continue.', { exact: true })).toBeVisible()
            expect(guestSessionRequestCount, 'The guest session must wait for both required consents').toBe(0)

            await termsConsent.check()
            await privacyConsent.check()
            await expect(termsConsent).toBeChecked()
            await expect(privacyConsent).toBeChecked()

            const guestSessionRequestPromise = page.waitForRequest((request) => {
                const requestUrl = new URL(request.url())
                return request.method() === 'POST' && requestUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
            })
            const guestSessionResponsePromise = page.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
            })
            const attemptStartResponsePromise = page.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return (
                    response.request().method() === 'POST' &&
                    responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
                )
            })
            await startButton.click()
            const guestSessionRequest = await guestSessionRequestPromise
            expect(JSON.parse(guestSessionRequest.postData() ?? '{}')).toMatchObject({
                workspaceId: shortLink.workspaceId,
                termsAccepted: true,
                privacyAccepted: true
            })
            const guestSessionResponse = await guestSessionResponsePromise
            expect(guestSessionResponse.status(), `Grade ${shortLink.grade} consent must enable guest session creation`).toBe(201)
            expect(guestSessionRequestCount).toBe(1)

            const attemptStartResponse = await attemptStartResponsePromise
            expect(attemptStartResponse.ok(), `Grade ${shortLink.grade} quiz attempt must start`).toBe(true)
            const attempt = await attemptStartResponse.json()
            assertPublicAssessmentAttemptState(attempt, `grade ${shortLink.grade} attempt start response`)
            expectCurrentAttemptQuestion(attempt, quiz.questions[0]!, 0, quiz.questions.length, 'en', `grade ${shortLink.grade} start`)

            await expect(page.getByText(`Question 1 of ${quiz.questions.length}`, { exact: true })).toBeVisible({ timeout: 30_000 })
            const firstQuestionPrompt = readLocalizedText(quiz.questions[0]?.prompt, 'en')
            if (!firstQuestionPrompt) throw new Error(`Grade ${shortLink.grade} fixture has no first-question prompt`)
            await expect(page.getByRole('heading', { name: firstQuestionPrompt, exact: true })).toBeVisible()
            const choices = page.getByRole('radio')
            await expect(choices, `Grade ${shortLink.grade} first question must render four answer choices`).toHaveCount(4)
            for (let index = 0; index < 4; index += 1) {
                await expect(choices.nth(index)).toBeVisible()
                await expect(choices.nth(index)).toHaveAccessibleName(/\S/u)
            }
            await expectNoTechnicalLeakage(page.locator('body'), {
                label: `Grade ${shortLink.grade} first quiz question`,
                checkUuidSubstrings: true
            })
            await expectNoPageHorizontalOverflow(page, `Grade ${shortLink.grade} first quiz question at 390x844`)
        } finally {
            await context.close()
        }
    }
}
