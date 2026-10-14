import { expect } from '../fixtures/test'
import {
    assertPublicAssessmentAttemptState,
    expectNoAccessibilityViolations,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import { expectDataGridCellTextByColumn, expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'
import { readGuestLegalConsent } from './lmsMarathonGuestShortLinkDatabase'
import { sendWithCsrf } from './backend/api-session.mjs'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

function assertAuthoredCurrentQuestion(
    attempt: Record<string, unknown>,
    expectedPrompt: string,
    expectedAnswer: string,
    index: number,
    label: string
): Record<string, unknown> {
    expect(attempt.currentQuestionIndex, `${label} current question index`).toBe(index)
    expect(attempt.totalQuestions, `${label} total question count`).toBe(2)
    expect(attempt.answeredCount, `${label} answered count`).toBe(index)
    const questions = runtimeRecords(attempt.questions)
    expect(questions, `${label} must expose only the current question`).toHaveLength(1)
    const question = questions[0]
    if (!question) throw new Error(`${label} has no current question`)
    const prompt = readLocalizedText(getRuntimeField(question, 'Prompt'), 'en')
    expect(prompt, `${label} prompt`).toBe(expectedPrompt)
    const options = runtimeRecords(getRuntimeField(question, 'Options'))
    expect(options, `${label} must have four options`).toHaveLength(4)
    expect(
        options.some((option) => readLocalizedText(getRuntimeField(option, 'Label'), 'en') === expectedAnswer),
        `${label} must include its configured correct answer`
    ).toBe(true)
    expect(options.every((option) => !Object.keys(option).some((key) => /correct|answerkey|explanation/iu.test(key)))).toBe(true)
    return question
}

export async function runLmsMarathonAuthoredQuizGuestFlow(flow: LmsMarathonPreparedFlow): Promise<void> {
    const { browser, applicationId, publicWorkspaceId, origin, authoredQuizShortLink, testInfo, api } = flow
    const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 1440, height: 900 }
    })

    try {
        await context.clearCookies()
        expect(await context.cookies(origin), 'The authored quiz guest flow must start unauthenticated').toHaveLength(0)
        const page = await context.newPage()
        const resolverResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return response.request().method() === 'GET' && responseUrl.pathname === `/api/v1/public/l/${authoredQuizShortLink.slug}`
        })
        const accessLinkResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                responseUrl.pathname === `/api/v1/public/a/${applicationId}/links/${authoredQuizShortLink.accessLinkSlug}`
            )
        })
        await page.goto(new URL(`/l/${authoredQuizShortLink.slug}?locale=en`, origin).toString())

        const resolverResponse = await resolverResponsePromise
        expect(resolverResponse.status(), 'The authored global short link must resolve without authentication').toBe(200)
        expect(await resolverResponse.json()).toEqual({
            target: {
                kind: 'lms-access-link',
                applicationId,
                accessLinkId: authoredQuizShortLink.accessLinkId,
                accessLinkSlug: authoredQuizShortLink.accessLinkSlug,
                workspaceId: publicWorkspaceId
            }
        })
        const accessLinkResponse = await accessLinkResponsePromise
        expect(accessLinkResponse.status(), 'The authored quiz guest-intake policy must be publicly readable').toBe(200)
        expect(accessLinkResponse.headers()['cache-control']).toBe('no-store')
        expect(await accessLinkResponse.json()).toMatchObject({
            targetType: 'quiz',
            intake: {
                showFirstName: true,
                requireFirstName: true,
                showLastName: true,
                requireLastName: true,
                showEmail: true,
                requireEmail: false,
                showPhone: false,
                requirePhone: false,
                captchaEnabled: false
            }
        })

        const firstName = page.getByLabel('First name')
        const lastName = page.getByLabel('Last name')
        const email = page.getByLabel('Email address')
        await expect(firstName).toBeVisible({ timeout: 30_000 })
        await expect(lastName).toBeVisible()
        await expect(email).toBeVisible()
        await expect(page.getByLabel('Phone number')).toHaveCount(0)
        await expect(page.getByRole('group', { name: 'Security verification' })).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'Terms of Service', exact: true })).toHaveAttribute('href', '/terms')
        await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute('href', '/privacy')
        const termsConsent = page.getByRole('checkbox', { name: /Terms of Service/u })
        const privacyConsent = page.getByRole('checkbox', { name: /Privacy Policy/u })
        await expect(termsConsent, 'Terms consent must remain mandatory and labelled').toHaveCount(1)
        await expect(privacyConsent, 'Privacy consent must remain mandatory and labelled').toHaveCount(1)
        await firstName.fill(`E2E ${flow.runManifest.runId.slice(0, 8)}`)
        await lastName.fill('Authored guest')
        await expectNoPageHorizontalOverflow(page, 'Authored quiz guest intake')
        await expectNoTechnicalLeakage(page.locator('body'), { label: 'Authored quiz guest intake', checkUuidSubstrings: true })
        await expectNoAccessibilityViolations(page, 'Authored quiz guest intake')
        await page.screenshot({
            path: testInfo.outputPath('lms-marathon-authored-quiz-guest-intake.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const startButton = page.getByRole('button', { name: 'Start learning', exact: true })
        await expect(startButton, 'Required consent must disable the guest start action').toBeDisabled()
        await termsConsent.check()
        await expect(startButton, 'Both required consent checkboxes must be accepted').toBeDisabled()
        await privacyConsent.check()
        await expect(startButton).toBeEnabled()

        const sessionRequestPromise = page.waitForRequest((request) => {
            const requestUrl = new URL(request.url())
            return request.method() === 'POST' && requestUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
        })
        const sessionResponsePromise = page.waitForResponse((response) => {
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
        const [sessionRequest, sessionResponse, attemptStartResponse] = await Promise.all([
            sessionRequestPromise,
            sessionResponsePromise,
            attemptStartResponsePromise
        ])
        expect(sessionResponse.status(), 'An optional email must not block guest-session creation').toBe(201)
        expect(sessionResponse.headers()['cache-control']).toBe('no-store')
        const sessionBody = JSON.parse(sessionRequest.postData() ?? '{}') as Record<string, unknown>
        expect(sessionBody).toMatchObject({
            workspaceId: publicWorkspaceId,
            firstName: `E2E ${flow.runManifest.runId.slice(0, 8)}`,
            lastName: 'Authored guest',
            termsAccepted: true,
            privacyAccepted: true
        })
        expect(sessionBody).not.toHaveProperty('phone')
        expect(sessionBody).not.toHaveProperty('captchaToken')
        expect(sessionBody).not.toHaveProperty('email')
        const guestSession = (await sessionResponse.json()) as { participantId?: string }
        expect(guestSession.participantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
        const legalConsent = await readGuestLegalConsent(applicationId, guestSession.participantId as string)
        expect(String(legalConsent.termsVersion ?? '').trim()).not.toBe('')
        expect(String(legalConsent.privacyVersion ?? '').trim()).not.toBe('')
        expect(Number.isFinite(Date.parse(String(legalConsent.termsAcceptedAt)))).toBe(true)
        expect(Number.isFinite(Date.parse(String(legalConsent.privacyAcceptedAt)))).toBe(true)

        expect(attemptStartResponse.status(), 'The authorized guest session must start the authored quiz').toBe(200)
        const attempt = await attemptStartResponse.json()
        assertPublicAssessmentAttemptState(attempt, 'authored quiz attempt start response')
        expect(Date.parse(attempt.deadlineAt) - Date.parse(attempt.startedAt)).toBe(45 * 60 * 1000)
        expect(authoredQuizShortLink.correctAnswers).toHaveLength(2)
        const firstExpected = authoredQuizShortLink.correctAnswers[0]
        if (!firstExpected) throw new Error('The authored quiz fixture is missing its first expected answer')
        const firstQuestion = assertAuthoredCurrentQuestion(
            attempt,
            firstExpected.prompt,
            firstExpected.label,
            0,
            'authored first question'
        )
        const firstPrompt = readLocalizedText(getRuntimeField(firstQuestion, 'Prompt'), 'en')
        const firstCorrectAnswer = authoredQuizShortLink.correctAnswers[0]?.label
        if (!firstPrompt || !firstCorrectAnswer) throw new Error('The authored first quiz question is missing its expected answer')

        await expect(page.getByText('Question 1 of 2', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: firstPrompt, exact: true })).toBeVisible()
        await expect(page.getByRole('timer')).toHaveText(/^(?:44|45):[0-5]\d$/)
        const firstCorrectChoice = page.getByRole('radio', { name: firstCorrectAnswer, exact: true })
        await expect(page.getByRole('radio'), 'The first question screen must show four answer options').toHaveCount(4)
        await expect(page.getByRole('button', { name: /save answer|finish quiz/iu })).toHaveCount(0)
        await page.setViewportSize({ width: 390, height: 844 })
        await expectNoPageHorizontalOverflow(page, 'Authored quiz question on mobile')
        await expectNoAccessibilityViolations(page, 'Authored quiz question')
        await page.screenshot({
            path: testInfo.outputPath('lms-marathon-authored-quiz-question-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const firstSavedAttempt = await selectGuestQuizAnswer({
            page,
            applicationId,
            attemptId: attempt.attemptId,
            option: firstCorrectChoice,
            label: 'authored quiz first answer'
        })
        const secondExpected = authoredQuizShortLink.correctAnswers[1]
        if (!secondExpected) throw new Error('The authored quiz fixture is missing its second expected answer')
        const secondQuestion = assertAuthoredCurrentQuestion(
            firstSavedAttempt,
            secondExpected.prompt,
            secondExpected.label,
            1,
            'authored second question after first save'
        )
        const secondPrompt = readLocalizedText(getRuntimeField(secondQuestion, 'Prompt'), 'en')
        const secondCorrectAnswer = authoredQuizShortLink.correctAnswers[1]?.label
        if (!secondPrompt || !secondCorrectAnswer) throw new Error('The authored second quiz question is missing its expected answer')

        await expect(page.getByText('Question 2 of 2', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: secondPrompt, exact: true })).toBeVisible()
        await expect(page.getByRole('radio'), 'The second question screen must also show four answer options').toHaveCount(4)
        const secondCorrectChoice = page.getByRole('radio', { name: secondCorrectAnswer, exact: true })
        await expect(secondCorrectChoice).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Authored quiz second question on mobile')
        await expectNoAccessibilityViolations(page, 'Authored quiz second question')
        await page.screenshot({
            path: testInfo.outputPath('lms-marathon-authored-quiz-second-question-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const completedAttempt = await selectGuestQuizAnswer({
            page,
            applicationId,
            attemptId: attempt.attemptId,
            option: secondCorrectChoice,
            label: 'authored quiz second answer'
        })
        expect(completedAttempt.currentQuestionIndex).toBe(2)
        expect(completedAttempt.totalQuestions).toBe(2)
        expect(completedAttempt.answeredCount).toBe(2)
        expect(completedAttempt.questions).toHaveLength(0)
        await expect(page.getByRole('heading', { name: 'Quiz completed', exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('status').last()).toContainText('Correct answers: 2 of 2')
        await expect(page.getByText(authoredQuizShortLink.completionText, { exact: true })).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Authored quiz result on mobile')
        await page.screenshot({
            path: testInfo.outputPath('lms-marathon-authored-quiz-result-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await page.setViewportSize({ width: 1440, height: 900 })
        await expectNoAccessibilityViolations(page, 'Authored quiz result')
        await page.screenshot({
            path: testInfo.outputPath('lms-marathon-authored-quiz-result.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const reportResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect(reportResponse.status, 'The completed guest score must be available in the authorized report').toBe(200)
        const reportPayload = await reportResponse.json()
        const participantName = sessionBody.firstName + ' ' + sessionBody.lastName
        const authoredReportRows = runtimeRecords(reportPayload.rows).filter((row) =>
            JSON.stringify(row).includes(guestSession.participantId)
        )
        expect(authoredReportRows, 'The authorized report must persist the authored guest attempt').toHaveLength(1)
        expect(Number(getRuntimeField(authoredReportRows[0] ?? {}, 'Score'))).toBe(2)
        expect(Number(getRuntimeField(authoredReportRows[0] ?? {}, 'TotalQuestions'))).toBe(2)

        const authenticatedPage = flow.page
        await authenticatedPage.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
        const reportsNavigationItem = authenticatedPage
            .getByRole('link', { name: 'Reports' })
            .or(authenticatedPage.getByRole('button', { name: 'Reports' }))
            .first()
        await expect(reportsNavigationItem, 'The authenticated app must expose its report view').toBeVisible({ timeout: 30_000 })
        await reportsNavigationItem.click()
        const authoredReportTable = authenticatedPage.getByTestId('runtime-report-details-table').filter({ hasText: participantName })
        await expect(authoredReportTable, 'The completed authored guest attempt must appear in the visible report').toBeVisible({
            timeout: 60_000
        })
        const authoredReportRow = authoredReportTable.getByRole('row').filter({ hasText: participantName })
        await expect(authoredReportRow).toBeVisible()
        await expectDataGridCellTextByColumn(authoredReportTable, authoredReportRow, 'Score', '2')
        await expectDataGridCellTextByColumn(authoredReportTable, authoredReportRow, 'Total questions', '2')
        await expectNoPageHorizontalOverflow(authenticatedPage, 'Authored quiz results report')
        await expectNoAccessibilityViolations(authenticatedPage, 'Authored quiz results report')
        await authenticatedPage.screenshot({
            path: testInfo.outputPath('lms-marathon-authored-quiz-results-report.png'),
            fullPage: true,
            animations: 'disabled'
        })
    } finally {
        await context.close()
    }
}
