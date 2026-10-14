import { expect } from '../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'
import {
    acceptGuestLegalConsents,
    assertPublicAssessmentAttemptState,
    expectNoAccessibilityViolations,
    expectCurrentAttemptQuestion,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import { readGuestLegalConsent, readPublishedQuizAccessLinkTargetBySlug } from './lmsMarathonGuestShortLinkDatabase'
import { LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE, LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS } from './lmsMarathonFixtureContract'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

export async function runLmsMarathonEnglishGuestQuiz(flow: LmsMarathonPreparedFlow): Promise<{
    participantName: string
    participantId: string
    attemptId: string
    submittedResponses: Array<{ questionId: string; selectedOptionId: string; isCorrect: boolean }>
}> {
    const {
        browser,
        testInfo,
        applicationId,
        publicWorkspaceId,
        accessLink,
        gradeQuiz,
        gradeQuestionCount,
        shortLinkSlug,
        origin,
        resources
    } = flow
    const persistedAccessLink = await readPublishedQuizAccessLinkTargetBySlug(applicationId, publicWorkspaceId, accessLink.slug)
    const guestContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 1920, height: 1080 }
    })
    resources.guestContext = guestContext
    await guestContext.clearCookies()
    expect(await guestContext.cookies(origin), 'The guest flow must start without authenticated cookies').toHaveLength(0)
    const guestPage = await guestContext.newPage()
    const globalShortLinkResolutionPromise = guestPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'GET' && responseUrl.pathname === `/api/v1/public/l/${shortLinkSlug}`
    })
    const accessLinkResponsePromise = guestPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return (
            response.request().method() === 'GET' &&
            responseUrl.pathname === `/api/v1/public/a/${applicationId}/links/${accessLink.slug}` &&
            responseUrl.searchParams.get('workspaceId') === publicWorkspaceId
        )
    })

    await guestPage.goto(new URL(`/l/${shortLinkSlug}?locale=en`, origin).toString())
    const globalShortLinkResolutionResponse = await globalShortLinkResolutionPromise
    const globalShortLinkResolutionBody = await globalShortLinkResolutionResponse.text()
    expect(
        globalShortLinkResolutionResponse.status(),
        `The anonymous global-link resolver returned ${globalShortLinkResolutionResponse.status()}: ${globalShortLinkResolutionBody}`
    ).toBe(200)
    expect(JSON.parse(globalShortLinkResolutionBody)).toEqual({
        target: {
            kind: 'lms-access-link',
            applicationId,
            accessLinkId: persistedAccessLink.id,
            accessLinkSlug: accessLink.slug,
            workspaceId: publicWorkspaceId
        }
    })
    expect(new URL(guestPage.url()).searchParams.has('workspaceId')).toBe(false)
    const accessLinkResponse = await accessLinkResponsePromise
    const accessLinkResponseBody = await accessLinkResponse.text()
    expect(
        accessLinkResponse.status(),
        `The anonymous quiz-access endpoint returned ${accessLinkResponse.status()}: ${accessLinkResponseBody}`
    ).toBe(200)
    const accessLinkPayload = JSON.parse(accessLinkResponseBody)
    expect(accessLinkPayload.intake).toMatchObject({
        showFirstName: true,
        requireFirstName: true,
        showLastName: true,
        requireLastName: true,
        showEmail: false,
        requireEmail: false,
        showPhone: false,
        requirePhone: false,
        captchaEnabled: false
    })
    const preConsentRuntimeResponse = await guestContext.request.get(
        new URL(`/api/v1/public/a/${applicationId}/runtime?slug=${encodeURIComponent(accessLink.slug)}&locale=en`, origin).toString()
    )
    expect(preConsentRuntimeResponse.status()).toBe(403)
    expect(preConsentRuntimeResponse.headers()['cache-control']).toBe('no-store')
    expect(await preConsentRuntimeResponse.json()).toEqual({ error: 'Guest session is required to access quiz questions' })
    const russianGuestPage = await guestContext.newPage()
    await russianGuestPage.goto(new URL(`/l/${shortLinkSlug}?locale=ru`, origin).toString())
    await expect(russianGuestPage.getByLabel('Имя')).toBeVisible({ timeout: 30_000 })
    await expect(russianGuestPage.getByLabel('Фамилия')).toBeVisible()
    await expect(russianGuestPage.getByRole('button', { name: 'Начать обучение' })).toBeVisible()
    await russianGuestPage.close()
    await expect(guestPage.getByLabel('First name')).toBeVisible({ timeout: 30_000 })
    await expect(guestPage.getByLabel('Last name')).toBeVisible()
    await expect(guestPage.getByRole('group', { name: 'Security verification' })).toHaveCount(0)
    await expect(guestPage.getByRole('link', { name: 'Terms of Service', exact: true })).toHaveAttribute('href', '/terms')
    await expect(guestPage.getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute('href', '/privacy')
    await expectNoPageHorizontalOverflow(guestPage, 'LMS Marathon guest introduction')

    const participantFirstName = 'Alexandra'
    const participantLastName = 'Smirnova'
    const participantName = `${participantFirstName} ${participantLastName}`
    await guestPage.getByLabel('First name').fill(participantFirstName)
    await guestPage.getByLabel('Last name').fill(participantLastName)
    const consentCheckboxes = guestPage.getByRole('checkbox')
    await expect(consentCheckboxes).toHaveCount(2)
    await expectNoAccessibilityViolations(guestPage, 'English guest intake')
    await guestPage.setViewportSize({ width: 390, height: 844 })
    await expectNoPageHorizontalOverflow(guestPage, 'LMS Marathon guest introduction at 390px')
    const intakeTitleText = readLocalizedText(accessLink.title, 'en')
    if (!intakeTitleText) throw new Error('The English guest intake title must be configured')
    const intakeTitle = guestPage.getByText(intakeTitleText, { exact: true })
    const firstNameLabel = guestPage.getByText('First name', { exact: false }).first()
    const [intakeTitleBounds, firstNameLabelBounds] = await Promise.all([intakeTitle.boundingBox(), firstNameLabel.boundingBox()])
    if (!intakeTitleBounds || !firstNameLabelBounds) {
        throw new Error('The guest intake title and first-name label must be visible on mobile')
    }
    expect(firstNameLabelBounds.y).toBeGreaterThanOrEqual(intakeTitleBounds.y + intakeTitleBounds.height + 6)
    await guestPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-intro-mobile.png'),
        fullPage: true,
        animations: 'disabled'
    })
    await guestPage.setViewportSize({ width: 768, height: 1024 })
    await expectNoPageHorizontalOverflow(guestPage, 'LMS Marathon guest introduction at 768px')
    await guestPage.setViewportSize({ width: 1920, height: 1080 })
    await expectNoPageHorizontalOverflow(guestPage, 'LMS Marathon guest introduction at 1920px')
    await guestPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-intro.png'),
        fullPage: true,
        animations: 'disabled'
    })

    let guestSessionRequestCount = 0
    guestPage.on('request', (request) => {
        const requestUrl = new URL(request.url())
        if (request.method() === 'POST' && requestUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`) {
            guestSessionRequestCount += 1
        }
    })
    const startLearningButton = guestPage.getByRole('button', { name: 'Start learning' })
    await startLearningButton.click()
    await expect(guestPage.getByText('Accept the Terms of Service to continue.', { exact: true })).toBeVisible()
    await expect(guestPage.getByText('Accept the Privacy Policy to continue.', { exact: true })).toBeVisible()
    expect(guestSessionRequestCount, 'Required legal consent must be checked before a guest session is created').toBe(0)

    await acceptGuestLegalConsents(guestPage, 'en')
    await guestPage.getByLabel('First name').fill('')
    await guestPage.getByLabel('Last name').fill('')
    await startLearningButton.click()
    await expect(guestPage.getByText('Enter your first name.', { exact: true })).toBeVisible()
    await expect(guestPage.getByText('Enter your last name.', { exact: true })).toBeVisible()
    expect(guestSessionRequestCount, 'Required names must be validated before creating a guest session').toBe(0)

    await guestPage.getByLabel('First name').fill(participantFirstName)
    await guestPage.getByLabel('Last name').fill(participantLastName)
    const guestSessionRequestPromise = guestPage.waitForRequest((request) => {
        const requestUrl = new URL(request.url())
        return request.method() === 'POST' && requestUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
    })
    const guestSessionResponsePromise = guestPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
    })
    const attemptStartResponsePromise = guestPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
    })
    await startLearningButton.click()
    const guestSessionRequest = await guestSessionRequestPromise
    const guestSessionResponse = await guestSessionResponsePromise
    const guestSessionResponseBody = await guestSessionResponse.text()
    expect(guestSessionResponse.headers()['cache-control']).toBe('no-store')
    expect(
        guestSessionResponse.status(),
        `The anonymous guest-session endpoint returned ${guestSessionResponse.status()}: ${guestSessionResponseBody}`
    ).toBe(201)
    const guestSessionBody = JSON.parse(guestSessionRequest.postData() ?? '{}')
    expect(guestSessionBody).toMatchObject({
        workspaceId: publicWorkspaceId,
        firstName: participantFirstName,
        lastName: participantLastName,
        termsAccepted: true,
        privacyAccepted: true
    })
    expect(guestSessionBody).not.toHaveProperty('captchaToken')
    const guestSessionPayload = JSON.parse(guestSessionResponseBody)
    expect(guestSessionPayload.participantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    const persistedConsent = await readGuestLegalConsent(applicationId, guestSessionPayload.participantId)
    expect(typeof persistedConsent.termsVersion).toBe('string')
    expect(String(persistedConsent.termsVersion).trim().length).toBeGreaterThan(0)
    expect(typeof persistedConsent.privacyVersion).toBe('string')
    expect(String(persistedConsent.privacyVersion).trim().length).toBeGreaterThan(0)
    if (process.env.LEGAL_TERMS_VERSION) expect(persistedConsent.termsVersion).toBe(process.env.LEGAL_TERMS_VERSION)
    if (process.env.LEGAL_PRIVACY_VERSION) expect(persistedConsent.privacyVersion).toBe(process.env.LEGAL_PRIVACY_VERSION)
    for (const field of ['termsAcceptedAt', 'privacyAcceptedAt']) {
        expect(Number.isFinite(Date.parse(String(persistedConsent[field]))), `${field} must be persisted as a valid timestamp`).toBe(true)
    }
    const attemptStartResponse = await attemptStartResponsePromise
    expect(attemptStartResponse.ok()).toBe(true)
    expect(attemptStartResponse.headers()['cache-control']).toBe('no-store')
    const startedAttempt = await attemptStartResponse.json()
    assertPublicAssessmentAttemptState(startedAttempt, 'attempt start response')
    expect(startedAttempt.attemptNumber).toBe(1)
    expect(LMS_LYCEUM_MARATHON_SOURCE_LANGUAGE).toBe('ru')
    expect(gradeQuiz.questions, 'The canonical fixture must supply every expected question').toHaveLength(gradeQuestionCount)
    let currentAttempt = startedAttempt
    const firstQuestion = expectCurrentAttemptQuestion(
        currentAttempt,
        gradeQuiz.questions[0]!,
        0,
        gradeQuestionCount,
        'en',
        'attempt start'
    )
    expect(Math.ceil((Date.parse(startedAttempt.deadlineAt) - Date.parse(startedAttempt.serverNow)) / 1000)).toBe(
        LMS_LYCEUM_MARATHON_TIME_LIMIT_SECONDS
    )
    await expect(guestPage.getByText(`Question 1 of ${gradeQuestionCount}`, { exact: true })).toBeVisible({ timeout: 30_000 })
    const timer = guestPage.getByRole('timer')
    await expect(timer).toHaveText(/^(?:44|45):[0-5]\d$/)
    await expect(timer).toHaveAttribute('aria-label', /^Time remaining: (?:44|45):[0-5]\d$/)
    const attemptResumeResponsePromise = guestPage.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return (
            response.request().method() === 'GET' &&
            responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/${startedAttempt.attemptId}`
        )
    })
    await guestPage.reload()
    const attemptResumeResponse = await attemptResumeResponsePromise
    expect(attemptResumeResponse.status()).toBe(200)
    expect(attemptResumeResponse.headers()['cache-control']).toBe('no-store')
    const attemptResumeRequest = attemptResumeResponse.request()
    expect(new URL(attemptResumeResponse.url()).searchParams.has('participantId')).toBe(false)
    expect(attemptResumeRequest.headers()['x-guest-participant-id']).toBe(guestSessionPayload.participantId)
    const resumedAttempt = await attemptResumeResponse.json()
    assertPublicAssessmentAttemptState(resumedAttempt, 'attempt resume response')
    expect(resumedAttempt).toMatchObject({ attemptId: startedAttempt.attemptId, deadlineAt: startedAttempt.deadlineAt })
    expectCurrentAttemptQuestion(resumedAttempt, gradeQuiz.questions[0]!, 0, gradeQuestionCount, 'en', 'initial attempt resume')
    currentAttempt = resumedAttempt
    await expect(guestPage.getByText(`Question 1 of ${gradeQuestionCount}`, { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(timer).toBeVisible()
    const parseTimerSeconds = (value: string): number => {
        const match = value.match(/^(\d+):(\d{2})$/u)
        if (!match) throw new Error(`Unexpected countdown text: ${value}`)
        return Number(match[1]) * 60 + Number(match[2])
    }
    const deadlineSecondsRemaining = Math.ceil((Date.parse(resumedAttempt.deadlineAt) - Date.now()) / 1000)
    expect(Math.abs(parseTimerSeconds(await timer.innerText()) - deadlineSecondsRemaining)).toBeLessThanOrEqual(2)
    await expectNoAccessibilityViolations(guestPage, 'English guest quiz question')
    await expectNoPageHorizontalOverflow(guestPage, 'LMS Marathon guest quiz question')
    await guestPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-question.png'),
        fullPage: true,
        animations: 'disabled'
    })
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await guestPage.setViewportSize(viewport)
        await expectNoPageHorizontalOverflow(guestPage, `LMS Marathon guest question at ${viewport.width}px`)
        await expect(guestPage.getByRole('timer')).toBeVisible()
        await expect(
            guestPage.getByRole('heading', {
                name: readLocalizedText(getRuntimeField(firstQuestion, 'Prompt')) ?? '',
                exact: true
            })
        ).toBeVisible()
        const questionBounds = await guestPage
            .getByRole('heading', { name: readLocalizedText(getRuntimeField(firstQuestion, 'Prompt')) ?? '', exact: true })
            .boundingBox()
        expect(questionBounds?.x ?? -1).toBeGreaterThanOrEqual(0)
        expect((questionBounds?.x ?? 0) + (questionBounds?.width ?? viewport.width)).toBeLessThanOrEqual(viewport.width)
        if (viewport.width === 390) {
            await expect(guestPage.getByRole('radio')).toHaveCount(4)
            await expect(guestPage.getByRole('radio').first()).toBeVisible()
            await expect(guestPage.getByRole('radio').last()).toBeVisible()
            await expect(guestPage.getByRole('button', { name: /save answer|finish quiz/iu })).toHaveCount(0)
            await guestPage.screenshot({
                path: testInfo.outputPath('lms-marathon-guest-question-mobile.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
    }
    await guestPage.setViewportSize({ width: 1440, height: 900 })

    const submittedResponses: Array<{ questionId: string; selectedOptionId: string; isCorrect: boolean }> = []
    for (let index = 0; index < gradeQuestionCount; index += 1) {
        const canonicalQuestion = gradeQuiz.questions[index]
        if (!canonicalQuestion) throw new Error(`The canonical grade quiz is missing question ${index + 1}`)
        const question = expectCurrentAttemptQuestion(
            currentAttempt,
            canonicalQuestion,
            index,
            gradeQuestionCount,
            'en',
            `question ${index + 1}`
        )
        const runtimeQuestionId = getRuntimeField(question, 'Id')
        const promptField = getRuntimeField(question, 'Prompt')
        const prompt = readLocalizedText(promptField)
        const options = runtimeRecords(getRuntimeField(question, 'Options'))
        const canonicalPrompt = readLocalizedText(canonicalQuestion?.prompt, 'ru')
        const russianPrompt = readLocalizedText(promptField, 'ru')
        const englishFallbackPrompt = readLocalizedText(promptField, 'en')
        const canonicalCorrectOption = canonicalQuestion?.options.find((option) => option.isCorrect)
        if (
            typeof runtimeQuestionId !== 'string' ||
            !prompt ||
            !canonicalQuestion ||
            !canonicalPrompt ||
            !canonicalCorrectOption ||
            options.length !== 4
        ) {
            throw new Error(`The server question ${index + 1} is missing its prompt, options, or source answer`)
        }
        expect(prompt).toBe(canonicalPrompt)
        expect(russianPrompt).toBe(canonicalPrompt)
        expect(englishFallbackPrompt).toBe(canonicalPrompt)
        expect(Object.keys(question).some((key) => /correct|explanation/iu.test(key))).toBe(false)
        expect(options.every((option) => !Object.keys(option).some((key) => /correct/iu.test(key)))).toBe(true)
        const runtimeOptionIds = options.map((option) => getRuntimeField(option, 'Id'))
        expect(runtimeOptionIds.filter((id): id is string => typeof id === 'string').sort()).toEqual(
            canonicalQuestion.options.map((option) => option.id).sort()
        )
        for (const option of options) {
            const optionId = getRuntimeField(option, 'Id')
            const canonicalOption = canonicalQuestion.options.find((candidate) => candidate.id === optionId)
            const optionLabel = getRuntimeField(option, 'Label') ?? getRuntimeField(option, 'Text')
            if (!canonicalOption || !optionLabel) {
                throw new Error(`The server question ${index + 1} has an option without a matching source label`)
            }
            expect(readLocalizedText(optionLabel, 'ru')).toBe(canonicalOption.text)
            expect(readLocalizedText(optionLabel, 'en')).toBe(canonicalOption.text)
        }
        const displayedCorrectOption = options.find((option) => getRuntimeField(option, 'Id') === canonicalCorrectOption.id)
        if (!displayedCorrectOption) throw new Error(`The server omitted the correct choice for question ${index + 1}`)
        const correctLabel = readLocalizedText(
            getRuntimeField(displayedCorrectOption, 'Label') ?? getRuntimeField(displayedCorrectOption, 'Text')
        )
        if (!correctLabel) throw new Error(`The imported LMS question ${index + 1} has no localized correct answer`)
        const selectedOption =
            index === 0 ? options.find((option) => getRuntimeField(option, 'Id') !== canonicalCorrectOption.id) : displayedCorrectOption
        const selectedOptionId = getRuntimeField(selectedOption ?? {}, 'Id')
        const selectedLabel = selectedOption
            ? readLocalizedText(getRuntimeField(selectedOption, 'Label') ?? getRuntimeField(selectedOption, 'Text'))
            : undefined
        if (typeof selectedOptionId !== 'string' || !selectedLabel) {
            throw new Error(`The imported LMS question ${index + 1} has no usable answer option`)
        }
        submittedResponses.push({
            questionId: runtimeQuestionId,
            selectedOptionId,
            isCorrect: selectedOptionId === canonicalCorrectOption.id
        })

        await expect(guestPage.getByRole('heading', { name: prompt, exact: true })).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
            label: `English LMS Marathon question ${index + 1}`,
            checkUuidSubstrings: true
        })
        await expect(guestPage.getByText(`Question ${index + 1} of ${gradeQuestionCount}`, { exact: true })).toBeVisible()
        await expect(guestPage.getByRole('radio')).toHaveCount(4)
        for (const option of canonicalQuestion.options) {
            await expect(guestPage.getByRole('radiogroup').getByRole('radio', { name: option.text, exact: true })).toBeVisible()
        }
        const selectedAnswer = guestPage.getByRole('radiogroup').getByRole('radio', { name: selectedLabel, exact: true })
        if (index === 0) {
            await guestPage.setViewportSize({ width: 390, height: 844 })
            await expectNoPageHorizontalOverflow(guestPage, 'LMS Marathon answer interaction at 390px')
        }
        const nextAttempt = await selectGuestQuizAnswer({
            page: guestPage,
            applicationId,
            attemptId: startedAttempt.attemptId,
            option: selectedAnswer,
            label: `grade quiz answer ${index + 1}`,
            ...(index === 1
                ? {
                      activate: async () => {
                          await selectedAnswer.focus()
                          await guestPage.keyboard.press('Space')
                      },
                      confirm: async (submitButton) => {
                          await submitButton.focus()
                          await guestPage.keyboard.press('Enter')
                      }
                  }
                : {})
        })
        expect(nextAttempt.currentQuestionIndex).toBe(index + 1)
        expect(nextAttempt.totalQuestions).toBe(gradeQuestionCount)
        expect(nextAttempt.answeredCount).toBe(index + 1)
        expect(nextAttempt.questions).toHaveLength(index + 1 < gradeQuestionCount ? 1 : 0)
        if (index + 1 < gradeQuestionCount) {
            const nextCanonicalQuestion = gradeQuiz.questions[index + 1]
            if (!nextCanonicalQuestion) throw new Error(`The canonical grade quiz is missing question ${index + 2}`)
            expectCurrentAttemptQuestion(
                nextAttempt,
                nextCanonicalQuestion,
                index + 1,
                gradeQuestionCount,
                'en',
                `question ${index + 2} after answer`
            )
        }

        if (index === 0) {
            const answeredAttemptResumePromise = guestPage.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/${startedAttempt.attemptId}`
                )
            })
            await guestPage.reload()
            const answeredAttemptResume = await answeredAttemptResumePromise
            expect(answeredAttemptResume.status()).toBe(200)
            const resumedAnsweredAttempt = await answeredAttemptResume.json()
            assertPublicAssessmentAttemptState(resumedAnsweredAttempt, 'answered attempt resume response')
            expectCurrentAttemptQuestion(
                resumedAnsweredAttempt,
                gradeQuiz.questions[1]!,
                1,
                gradeQuestionCount,
                'en',
                'resumed attempt after first answer'
            )
            await expect(guestPage.getByText(`Question 2 of ${gradeQuestionCount}`, { exact: true })).toBeVisible()
            await guestPage.setViewportSize({ width: 1440, height: 900 })
            currentAttempt = resumedAnsweredAttempt
            continue
        }
        currentAttempt = nextAttempt
    }

    await expect(guestPage.getByRole('heading', { name: 'Quiz completed', exact: true })).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
        label: 'English LMS Marathon quiz result',
        checkUuidSubstrings: true
    })
    await guestPage.setViewportSize({ width: 1920, height: 1080 })
    await guestPage.screenshot({
        path: testInfo.outputPath('lms-marathon-guest-result.png'),
        fullPage: true,
        animations: 'disabled'
    })
    await expectNoAccessibilityViolations(guestPage, 'English guest quiz result')
    await expect(guestPage.getByRole('status').last()).toContainText(`Correct answers: ${gradeQuestionCount - 1} of ${gradeQuestionCount}`)
    const completionText = readLocalizedText(startedAttempt.completionText)
    if (!completionText) throw new Error('The seeded LMS quiz is missing the localized completion text')
    await expect(guestPage.getByText(completionText, { exact: true })).toBeVisible()
    await expectNoPageHorizontalOverflow(guestPage, 'LMS Marathon guest quiz result')
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await guestPage.setViewportSize(viewport)
        await expectNoPageHorizontalOverflow(guestPage, `LMS Marathon guest result at ${viewport.width}px`)
        await expect(guestPage.getByRole('status').last()).toContainText(
            `Correct answers: ${gradeQuestionCount - 1} of ${gradeQuestionCount}`
        )
        if (viewport.width === 390) {
            await guestPage.screenshot({
                path: testInfo.outputPath('lms-marathon-guest-result-mobile.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
    }

    return { participantName, participantId: guestSessionPayload.participantId, attemptId: startedAttempt.attemptId, submittedResponses }
}
