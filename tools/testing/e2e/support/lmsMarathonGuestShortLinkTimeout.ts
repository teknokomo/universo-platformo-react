import { expect } from '../fixtures/test'
import {
    acceptGuestLegalConsents,
    assertNoPrivateAnswerMaterial,
    assertPublicAssessmentAttemptState,
    expectCurrentAttemptQuestion,
    expectNoAccessibilityViolations,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from './browser/runtimeUx'
import { setGuestAssessmentAttemptDeadline } from './lmsMarathonGuestShortLinkDatabase'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

export async function runLmsMarathonTimeoutScenario(
    flow: LmsMarathonPreparedFlow
): Promise<{ participantName: string; participantId: string; attemptId: string; firstQuestionId: string; firstSelectedOptionId: string }> {
    const { browser, testInfo, applicationId, gradeQuiz, gradeQuestionCount, shortLinkSlug, origin, resources } = flow
    const timeoutContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 390, height: 844 }
    })
    resources.timeoutContext = timeoutContext
    await timeoutContext.clearCookies()
    const timeoutPage = await timeoutContext.newPage()
    await timeoutPage.goto(new URL(`/l/${shortLinkSlug}?locale=ru`, origin).toString())
    await expect(timeoutPage.getByLabel('Имя')).toBeVisible({ timeout: 30_000 })
    const timeoutFirstName = 'Dmitry'
    const timeoutLastName = 'Sokolov'
    const timeoutParticipantName = `${timeoutFirstName} ${timeoutLastName}`
    await expectNoPageHorizontalOverflow(timeoutPage, 'Russian LMS Marathon timed-quiz introduction at 390px')
    await timeoutPage.getByLabel('Имя').fill(timeoutFirstName)
    await timeoutPage.getByLabel('Фамилия').fill(timeoutLastName)
    await acceptGuestLegalConsents(timeoutPage, 'ru')
    const timeoutGuestSessionResponsePromise = timeoutPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
    })
    const timeoutAttemptStartPromise = timeoutPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
    })
    await timeoutPage.getByRole('button', { name: 'Начать обучение' }).click()
    const [timeoutGuestSessionResponse, timeoutAttemptStartResponse] = await Promise.all([
        timeoutGuestSessionResponsePromise,
        timeoutAttemptStartPromise
    ])
    expect(timeoutGuestSessionResponse.status(), 'The timeout guest must receive a session before starting an attempt').toBe(201)
    const timeoutGuestSessionPayload = await timeoutGuestSessionResponse.json()
    expect(timeoutGuestSessionPayload.participantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    expect(timeoutAttemptStartResponse.ok()).toBe(true)
    const timeoutAttempt = await timeoutAttemptStartResponse.json()
    assertPublicAssessmentAttemptState(timeoutAttempt, 'timeout attempt start response')
    expect(timeoutAttempt).toMatchObject({ attemptNumber: 1, status: 'in_progress' })
    expect(Date.parse(timeoutAttempt.deadlineAt) - Date.parse(timeoutAttempt.startedAt)).toBe(45 * 60 * 1000)

    const canonicalFirstQuestion = gradeQuiz.questions[0]
    const firstQuestion = expectCurrentAttemptQuestion(
        timeoutAttempt,
        canonicalFirstQuestion!,
        0,
        gradeQuestionCount,
        'ru',
        'timeout attempt start'
    )
    const firstQuestionId = getRuntimeField(firstQuestion ?? {}, 'Id')
    const canonicalCorrectOption = canonicalFirstQuestion?.options.find((option) => option.isCorrect)
    const firstQuestionOptions = runtimeRecords(getRuntimeField(firstQuestion ?? {}, 'Options'))
    const firstWrongOption = firstQuestionOptions.find((option) => getRuntimeField(option, 'Id') !== canonicalCorrectOption?.id)
    const firstSelectedOptionId = getRuntimeField(firstWrongOption ?? {}, 'Id')
    const firstQuestionPrompt = readLocalizedText(getRuntimeField(firstQuestion ?? {}, 'Prompt'), 'ru')
    const firstWrongLabel = readLocalizedText(
        getRuntimeField(firstWrongOption ?? {}, 'Label') ?? getRuntimeField(firstWrongOption ?? {}, 'Text'),
        'ru'
    )
    if (
        typeof firstQuestionId !== 'string' ||
        typeof firstSelectedOptionId !== 'string' ||
        !canonicalCorrectOption ||
        firstQuestionOptions.length !== 4 ||
        !firstQuestionPrompt ||
        !firstWrongLabel
    ) {
        throw new Error('The timeout attempt is missing its first question or a known incorrect answer')
    }

    await expect(timeoutPage.getByText(`Вопрос 1 из ${gradeQuestionCount}`, { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(timeoutPage.getByRole('heading', { name: firstQuestionPrompt, exact: true })).toBeVisible()
    const timeoutTimer = timeoutPage.getByRole('timer')
    const readTimeoutCountdownSeconds = async (): Promise<number> => {
        const timerText = await timeoutTimer.innerText()
        const timerMatch = timerText.match(/^(\d+):([0-5]\d)$/u)
        if (!timerMatch) throw new Error(`Unexpected timeout countdown: ${timerText}`)
        return Number(timerMatch[1]) * 60 + Number(timerMatch[2])
    }
    const assertTimeoutTimerHasTimeRemaining = async () => {
        await expect(timeoutTimer).toHaveText(/^\d+:[0-5]\d$/)
        await expect(timeoutTimer).toHaveAttribute('aria-label', /^Осталось времени: \d+:[0-5]\d$/)
        expect(await readTimeoutCountdownSeconds()).toBeGreaterThan(0)
    }
    await assertTimeoutTimerHasTimeRemaining()
    const firstWrongAnswer = timeoutPage.getByRole('radiogroup').getByRole('radio', { name: firstWrongLabel, exact: true })
    const savedAttempt = await selectGuestQuizAnswer({
        page: timeoutPage,
        applicationId,
        attemptId: timeoutAttempt.attemptId,
        option: firstWrongAnswer,
        label: 'saved timeout answer'
    })
    expectCurrentAttemptQuestion(savedAttempt, gradeQuiz.questions[1]!, 1, gradeQuestionCount, 'ru', 'timeout second question')
    await expect(timeoutPage.getByText(`Вопрос 2 из ${gradeQuestionCount}`, { exact: true })).toBeVisible()

    const timeoutFinalizeResponsePromise = timeoutPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return (
            response.request().method() === 'POST' &&
            responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/${timeoutAttempt.attemptId}/finalize`
        )
    })
    await setGuestAssessmentAttemptDeadline(applicationId, timeoutAttempt.attemptId, 12)
    const resumedAttemptResponsePromise = timeoutPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return (
            response.request().method() === 'GET' &&
            responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/${timeoutAttempt.attemptId}`
        )
    })
    await timeoutPage.reload()
    const resumedAttemptResponse = await resumedAttemptResponsePromise
    expect(resumedAttemptResponse.status()).toBe(200)
    const resumedTimeoutAttempt = await resumedAttemptResponse.json()
    assertPublicAssessmentAttemptState(resumedTimeoutAttempt, 'resumed timeout attempt response')
    expect(resumedTimeoutAttempt).toMatchObject({ attemptId: timeoutAttempt.attemptId, status: 'in_progress' })
    const resumedSecondsRemaining = Math.ceil((Date.parse(resumedTimeoutAttempt.deadlineAt) - Date.now()) / 1000)
    expect(resumedSecondsRemaining).toBeGreaterThan(0)
    expect(resumedSecondsRemaining).toBeLessThanOrEqual(12)
    await assertTimeoutTimerHasTimeRemaining()
    const visibleCountdownAtResume = await readTimeoutCountdownSeconds()
    await expect
        .poll(readTimeoutCountdownSeconds, {
            message: 'The visible countdown must decrease against the persisted server deadline',
            timeout: 4_000
        })
        .toBeLessThan(visibleCountdownAtResume)

    const resumedQuestions = runtimeRecords(resumedTimeoutAttempt.questions)
    expect(resumedQuestions).toHaveLength(1)
    const secondQuestionPrompt = readLocalizedText(getRuntimeField(resumedQuestions[0] ?? {}, 'Prompt'), 'ru')
    if (!secondQuestionPrompt) {
        throw new Error('The timeout attempt is missing its second question')
    }

    await expect(timeoutPage.getByRole('heading', { name: secondQuestionPrompt, exact: true })).toBeVisible()
    const timeoutFinalizeResponse = await timeoutFinalizeResponsePromise
    expect(timeoutFinalizeResponse.status(), 'The client countdown must finalize the attempt when its deadline elapses').toBe(200)
    const timedOutAttemptState = await timeoutFinalizeResponse.json()
    assertNoPrivateAnswerMaterial(timedOutAttemptState, 'timed-out attempt finalize response')
    assertPublicAssessmentAttemptState(timedOutAttemptState, 'timed-out attempt answer rejection response')
    expect(timedOutAttemptState.status).toBe('timed_out')
    expect(timedOutAttemptState.result).toMatchObject({
        score: 0,
        total: gradeQuestionCount,
        passed: false,
        finishedReason: 'timed_out'
    })
    expect(timedOutAttemptState).toMatchObject({
        currentQuestionIndex: gradeQuestionCount,
        totalQuestions: gradeQuestionCount,
        answeredCount: 1,
        questions: []
    })
    const timeoutResultHeading = timeoutPage.getByRole('heading', { name: 'Тест завершён', exact: true })
    const timeoutResultStatus = timeoutPage.getByRole('status').filter({ hasText: `Правильных ответов: 0 из ${gradeQuestionCount}` })
    const timeoutResultMessage = timeoutPage.getByText('Время вышло. Сохранённые ответы учтены при подсчёте результата.', {
        exact: true
    })
    await expect(timeoutResultHeading).toBeVisible({ timeout: 30_000 })
    await expect(timeoutResultStatus).toBeVisible()
    await expect(timeoutResultMessage).toBeVisible()
    await expectNoTechnicalLeakage(timeoutPage.getByRole('main'), {
        label: 'Russian LMS Marathon timed-quiz result',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })
    await expectNoAccessibilityViolations(timeoutPage, 'Russian timed-out guest quiz result')
    await expectRuntimeUxViewportMatrix(timeoutPage, 'Russian LMS Marathon timed-quiz result', {
        beforeEachViewport: async (viewport) => {
            await expect(timeoutResultHeading).toBeVisible()
            await expect(timeoutResultStatus).toBeVisible()
            await expect(timeoutResultMessage).toBeVisible()
            await expectNoTechnicalLeakage(timeoutPage.getByRole('main'), {
                label: `Russian LMS Marathon timed-quiz result ${viewport.name}`,
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            await expectNoAccessibilityViolations(timeoutPage, `Russian timed-out guest quiz result ${viewport.name}`)
            const screenshotName = viewport.name === 'mobile-390' ? 'mobile' : viewport.name
            await timeoutPage.screenshot({
                path: testInfo.outputPath(`lms-marathon-guest-timeout-result-${screenshotName}-ru.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }
    })

    return {
        participantName: timeoutParticipantName,
        participantId: timeoutGuestSessionPayload.participantId,
        attemptId: timeoutAttempt.attemptId,
        firstQuestionId,
        firstSelectedOptionId
    }
}
