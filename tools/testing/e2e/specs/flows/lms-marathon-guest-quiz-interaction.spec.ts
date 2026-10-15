import type { Page, Response, Route } from '@playwright/test'
import { isUuidV7 } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { sendWithCsrf } from '../../support/backend/api-session.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from '../../support/browser/runtimeUx'
import { navigateGuestQuizOptionWithKeyboard } from '../../support/browser/guestQuizKeyboard'
import { createLmsMarathonApplication } from '../../support/lmsMarathonGuestShortLinkApplication'
import { cleanupLmsMarathonGuestFlow } from '../../support/lmsMarathonGuestShortLinkCleanup'
import {
    assertPublicAssessmentAttemptState,
    assertPublicGuestAnswerResponse,
    expectNoAccessibilityViolations,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords
} from '../../support/lmsMarathonGuestShortLinkAssertions'
import { readPublishedQuizAccessLinkTargetBySlug } from '../../support/lmsMarathonGuestShortLinkDatabase'
import type { LmsMarathonFlowResources } from '../../support/lmsMarathonGuestShortLinkTypes'

type JsonRecord = Record<string, unknown>

type HeldAnswerResponse = {
    status: number
    requestBody: unknown
    body: unknown
}

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })

    return { promise, resolve, reject }
}

function asRecord(value: unknown, label: string): JsonRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} must be an object`)
    }
    return value as JsonRecord
}

function readTimerSeconds(value: string): number {
    const match = value.match(/^(\d+):(\d{2})$/u)
    if (!match) throw new Error(`Unexpected guest quiz timer text: ${value}`)
    return Number(match[1]) * 60 + Number(match[2])
}

function readDeadlineSeconds(attempt: JsonRecord, label: string): number {
    const deadlineAt = Date.parse(String(getRuntimeField(attempt, 'DeadlineAt')))
    const serverNow = Date.parse(String(getRuntimeField(attempt, 'ServerNow')))
    if (!Number.isFinite(deadlineAt) || !Number.isFinite(serverNow)) {
        throw new Error(`${label} must include valid deadline and server timestamps`)
    }
    return Math.ceil((deadlineAt - serverNow) / 1000)
}

function holdAnswerResponse(page: Page, answerPath: string) {
    const captured = deferred<HeldAnswerResponse>()
    const releaseResponse = deferred<void>()
    const matchesAnswer = (url: URL) => url.pathname === answerPath
    let shouldDropResponse = false
    const handler = async (route: Route) => {
        try {
            const response = await route.fetch()
            const responseText = await response.text()
            captured.resolve({
                status: response.status(),
                requestBody: route.request().postDataJSON(),
                body: responseText ? JSON.parse(responseText) : null
            })
            await releaseResponse.promise
            if (shouldDropResponse) {
                await route.abort('connectionfailed')
                return
            }
            await route.fulfill({ response })
        } catch (error) {
            captured.reject(error)
            throw error
        }
    }

    let released = false
    return page.route(matchesAnswer, handler).then(() => ({
        response: captured.promise,
        release: () => {
            if (released) return
            released = true
            releaseResponse.resolve(undefined)
        },
        drop: () => {
            if (released) return
            released = true
            shouldDropResponse = true
            releaseResponse.resolve(undefined)
        },
        remove: () => page.unroute(matchesAnswer, handler)
    }))
}

function getCurrentQuestion(attempt: JsonRecord, label: string, index: number, expectedPrompt: string): JsonRecord {
    const questions = runtimeRecords(getRuntimeField(attempt, 'Questions'))
    expect(questions, `${label} must expose only the current question`).toHaveLength(1)
    const [question] = questions
    if (!question) throw new Error(`${label} has no current question`)
    expect(getRuntimeField(attempt, 'CurrentQuestionIndex')).toBe(index)
    expect(getRuntimeField(attempt, 'AnsweredCount')).toBe(index)
    expect(getRuntimeField(attempt, 'TotalQuestions')).toBeGreaterThan(index)
    expect(attempt).not.toHaveProperty('answeredQuestionIds')
    expect(isUuidV7(getRuntimeField(question, 'Id')), `${label} must expose the physical UUID v7 question identity`).toBe(true)
    expect(readLocalizedText(getRuntimeField(question, 'Prompt'), 'en'), `${label} prompt`).toBe(expectedPrompt)
    return question
}

async function expectNoSeparateAnswerControls(page: Page): Promise<void> {
    await expect(
        page.getByRole('main').getByRole('button', { name: /\b(save|next|continue|finish|submit answer)\b/iu }),
        'A separate answer action must not be shown before an option is selected'
    ).toHaveCount(0)
}

async function expectFocusInCurrentQuestion(page: Page, prompt: string): Promise<void> {
    const heading = page.getByRole('heading', { name: prompt, exact: true })
    const radios = page.getByRole('radiogroup').getByRole('radio')
    await expect
        .poll(async () => {
            if (await heading.evaluate((element) => element === document.activeElement).catch(() => false)) return 'heading'
            if (await radios.evaluateAll((elements) => elements.includes(document.activeElement))) return 'answer'
            return null
        })
        .not.toBeNull()
}

test('@flow LMS guest quiz submits touch and keyboard answers one at a time and resyncs its timer after network resume', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(900_000)

    const resources: LmsMarathonFlowResources = { cleanupErrors: [] }
    try {
        const application = await createLmsMarathonApplication({ browser, page, testInfo, runManifest, resources })
        const persistedAccessLink = await readPublishedQuizAccessLinkTargetBySlug(
            application.applicationId,
            application.publicWorkspaceId,
            application.accessLink.slug
        )
        const runSuffix = runManifest.runId
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-|-$/gu, '')
            .slice(0, 30)
        const shortLinkSlug = `e2e-${runSuffix || 'run'}-guest-quiz-interaction`
        const shortLinkResponse = await sendWithCsrf(application.api, 'POST', '/api/v1/global-short-links', {
            slug: shortLinkSlug,
            target: {
                kind: 'lms-access-link',
                applicationId: application.applicationId,
                accessLinkId: persistedAccessLink.id,
                accessLinkSlug: application.accessLink.slug,
                workspaceId: application.publicWorkspaceId
            }
        })
        expect(shortLinkResponse.ok, 'The focused guest quiz flow must receive a real public short link').toBe(true)
        const shortLink = await shortLinkResponse.json()
        if (typeof shortLink.id !== 'string') throw new Error('The guest quiz short link response has no record id')
        resources.createdGlobalShortLinkIds = [shortLink.id]

        const origin = new URL(page.url()).origin
        const guestContext = await browser.newContext({
            storageState: { cookies: [], origins: [] },
            locale: 'en-US',
            timezoneId: 'UTC',
            colorScheme: 'dark',
            reducedMotion: 'reduce',
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true
        })
        resources.guestContext = guestContext
        await guestContext.clearCookies()
        expect(await guestContext.cookies(origin), 'The quiz browser must be an anonymous guest').toHaveLength(0)

        const guestPage = await guestContext.newPage()
        const guestSessionResponsePromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'POST' && url.pathname === `/api/v1/public/a/${application.applicationId}/guest-session`
        })
        const attemptStartResponsePromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'POST' &&
                url.pathname === `/api/v1/public/a/${application.applicationId}/runtime/attempts/start`
            )
        })
        await guestPage.goto(new URL(`/l/${shortLinkSlug}?locale=en`, origin).toString())
        await expect(guestPage.getByLabel('First name')).toBeVisible({ timeout: 30_000 })
        await expect(guestPage.getByLabel('Last name')).toBeVisible()
        await guestPage.getByLabel('First name').fill('Guest Quiz')
        await guestPage.getByLabel('Last name').fill('Interaction')
        const termsConsent = guestPage.getByRole('checkbox', { name: /Terms of Service/u })
        const privacyConsent = guestPage.getByRole('checkbox', { name: /Privacy Policy/u })
        const startButton = guestPage.getByRole('button', { name: 'Start learning', exact: true })
        const firstNameInput = guestPage.getByLabel('First name')
        const lastNameInput = guestPage.getByLabel('Last name')
        await firstNameInput.focus()
        await expect(firstNameInput).toBeFocused()
        await guestPage.keyboard.press('Tab')
        await expect(lastNameInput, 'Tab order must move from first name to last name').toBeFocused()
        await guestPage.keyboard.press('Tab')
        await expect(termsConsent, 'Tab order must reach the Terms of Service consent').toBeFocused()
        await guestPage.keyboard.press('Space')
        await expect(termsConsent).toBeChecked()
        await guestPage.keyboard.press('Tab')
        await expect(guestPage.getByRole('link', { name: /Terms of Service/u })).toBeFocused()
        await guestPage.keyboard.press('Tab')
        await expect(privacyConsent, 'Tab order must reach the Privacy Policy consent').toBeFocused()
        await guestPage.keyboard.press('Space')
        await expect(privacyConsent).toBeChecked()
        await guestPage.keyboard.press('Tab')
        await expect(guestPage.getByRole('link', { name: /Privacy Policy/u })).toBeFocused()
        await guestPage.keyboard.press('Tab')
        await expect(startButton, 'Tab order must reach the primary start action after both consents').toBeFocused()
        await guestPage.keyboard.press('Enter')

        const guestSessionResponse = await guestSessionResponsePromise
        expect(guestSessionResponse.status(), 'The anonymous participant session must be created before the attempt').toBe(201)
        const attemptStartResponse = await attemptStartResponsePromise
        expect(attemptStartResponse.ok(), 'The guest quiz attempt must start').toBe(true)
        const startedAttempt = asRecord(await attemptStartResponse.json(), 'Attempt start response')
        assertPublicAssessmentAttemptState(startedAttempt, 'guest attempt start')

        const expectedQuestions = application.gradeQuiz.questions
        const firstCanonicalQuestion = expectedQuestions[0]
        const secondCanonicalQuestion = expectedQuestions[1]
        const thirdCanonicalQuestion = expectedQuestions[2]
        if (!firstCanonicalQuestion || !secondCanonicalQuestion || !thirdCanonicalQuestion) {
            throw new Error('The LMS guest quiz needs at least three source questions for the interaction checks')
        }
        const firstPrompt = readLocalizedText(firstCanonicalQuestion.prompt, 'en')
        const secondPrompt = readLocalizedText(secondCanonicalQuestion.prompt, 'en')
        const thirdPrompt = readLocalizedText(thirdCanonicalQuestion.prompt, 'en')
        if (!firstPrompt || !secondPrompt || !thirdPrompt) throw new Error('The guest quiz source questions need localized prompts')
        const firstQuestion = getCurrentQuestion(startedAttempt, 'Attempt start response', 0, firstPrompt)
        const firstQuestionId = getRuntimeField(firstQuestion, 'Id')
        if (typeof firstQuestionId !== 'string') throw new Error('The current question has no runtime identity')

        await expect(guestPage.getByText(`Question 1 of ${application.gradeQuestionCount}`, { exact: true })).toBeVisible()
        await expect(guestPage.getByRole('heading', { name: firstPrompt, exact: true })).toBeVisible()
        await expect(guestPage.getByRole('radiogroup').getByRole('radio')).toHaveCount(firstCanonicalQuestion.options.length)
        await expectNoSeparateAnswerControls(guestPage)
        await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
            label: 'LMS guest quiz current question',
            checkUuidSubstrings: true
        })
        expect(await guestPage.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
        const hasDarkQuestionSurface = await guestPage.getByRole('main').evaluate((main) => {
            const elements = [main, ...main.querySelectorAll('*')]
            return elements.some((element) => {
                const bounds = element.getBoundingClientRect()
                if (bounds.width === 0 || bounds.height === 0) return false
                const match = getComputedStyle(element).backgroundColor.match(/rgba?\(([^)]+)\)/u)
                if (!match?.[1]) return false
                const channels = match[1]
                    .split(/[\s,/]+/u)
                    .filter(Boolean)
                    .map(Number)
                const [red, green, blue, alpha = 1] = channels
                if (red === undefined || green === undefined || blue === undefined || alpha < 0.95) return false
                return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 128
            })
        })
        expect(hasDarkQuestionSurface, 'The question surface must render a dark background under dark color scheme').toBe(true)
        await expectNoPageHorizontalOverflow(guestPage, 'LMS guest quiz question at 390px')
        await testInfo.attach('lms-guest-quiz-dark-question-mobile.png', {
            body: await guestPage.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })

        const timer = guestPage.getByRole('timer')
        await expect(timer).toBeVisible()
        const initialDeadlineSeconds = readDeadlineSeconds(startedAttempt, 'Attempt start response')
        await expect.poll(async () => Math.abs(readTimerSeconds(await timer.innerText()) - initialDeadlineSeconds)).toBeLessThanOrEqual(3)

        const attemptId = getRuntimeField(startedAttempt, 'AttemptId')
        if (typeof attemptId !== 'string') throw new Error('The guest attempt response has no attempt id')
        const attemptPath = `/api/v1/public/a/${application.applicationId}/runtime/attempts/${attemptId}`
        await guestContext.setOffline(true)
        await expect.poll(() => guestPage.evaluate(() => navigator.onLine)).toBe(false)
        const resumeResponsePromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'GET' && url.pathname === attemptPath
        })
        await guestContext.setOffline(false)
        const resumeResponse = await resumeResponsePromise
        expect(resumeResponse.status(), 'Returning online must refresh the authoritative guest attempt').toBe(200)
        const resumedAttempt = asRecord(await resumeResponse.json(), 'Attempt resume response')
        assertPublicAssessmentAttemptState(resumedAttempt, 'guest attempt resume')
        const resumedCurrentQuestion = getCurrentQuestion(resumedAttempt, 'Attempt resume response', 0, firstPrompt)
        expect(getRuntimeField(resumedCurrentQuestion, 'Id')).toBe(firstQuestionId)
        expect(getRuntimeField(resumedAttempt, 'DeadlineAt')).toBe(getRuntimeField(startedAttempt, 'DeadlineAt'))
        const resumedDeadlineSeconds = readDeadlineSeconds(resumedAttempt, 'Attempt resume response')
        await expect.poll(async () => Math.abs(readTimerSeconds(await timer.innerText()) - resumedDeadlineSeconds)).toBeLessThanOrEqual(3)

        const visibilityResponses: string[] = []
        const recordVisibilityResume = (response: { url: () => string; request: () => { method: () => string } }) => {
            const url = new URL(response.url())
            if (response.request().method() === 'GET' && url.pathname === attemptPath) visibilityResponses.push(url.pathname)
        }
        guestPage.on('response', recordVisibilityResume)
        await guestPage.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
            document.dispatchEvent(new Event('visibilitychange'))
        })
        expect(await guestPage.evaluate(() => document.visibilityState)).toBe('hidden')
        const visibilityResumePromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'GET' && url.pathname === attemptPath
        })
        await guestPage.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
            document.dispatchEvent(new Event('visibilitychange'))
        })
        const visibilityResumeResponse = await visibilityResumePromise
        expect(visibilityResumeResponse.status(), 'Returning to the quiz tab must refresh the authoritative attempt').toBe(200)
        expect(visibilityResponses).toEqual([attemptPath])
        guestPage.off('response', recordVisibilityResume)
        await guestPage.evaluate(() => Reflect.deleteProperty(document, 'visibilityState'))

        const firstOption = firstCanonicalQuestion.options[0]
        const secondQuestionOption = secondCanonicalQuestion.options[0]
        if (!firstOption || !secondQuestionOption) throw new Error('The first two guest quiz questions need at least one answer option')
        const firstAnswer = guestPage.getByRole('radiogroup').getByRole('radio', { name: firstOption.text, exact: true })
        const firstAnswerPath = `${attemptPath}/answers`
        let secondQuestionId: string | null = null
        const heldAnswer = await holdAnswerResponse(guestPage, firstAnswerPath)
        const firstAnswerRequestPromise = guestPage.waitForRequest(
            (request) => request.method() === 'PUT' && new URL(request.url()).pathname === firstAnswerPath,
            { timeout: 30_000 }
        )
        const firstAnswerActivation = firstAnswer.tap()
        try {
            const firstAnswerRequest = await firstAnswerRequestPromise
            expect(firstAnswerRequest.method(), 'A touch answer must immediately start the answer request').toBe('PUT')
            await expect(firstAnswer).toBeChecked()
            const serverAnswer = await heldAnswer.response
            expect(serverAnswer.status, 'Touch selection must submit the answer immediately').toBe(200)
            assertPublicGuestAnswerResponse(serverAnswer.body, 'touch answer response')
            const answeredAttempt = asRecord(asRecord(serverAnswer.body, 'Touch answer envelope').attempt, 'Touch answer attempt')
            expect(getRuntimeField(answeredAttempt, 'AnsweredCount')).toBe(1)
            expect(answeredAttempt).not.toHaveProperty('answeredQuestionIds')
            const secondRuntimeQuestion = getCurrentQuestion(answeredAttempt, 'Touch answer response', 1, secondPrompt)
            const secondRuntimeQuestionId = getRuntimeField(secondRuntimeQuestion, 'Id')
            if (typeof secondRuntimeQuestionId !== 'string') throw new Error('The next question has no runtime identity')
            secondQuestionId = secondRuntimeQuestionId
            const requestText = JSON.stringify(serverAnswer.requestBody)
            expect(requestText).toContain(firstQuestionId)
            expect(requestText).toContain(firstOption.id)
            expect(requestText).not.toContain(secondRuntimeQuestionId)
            expect(requestText).not.toContain(secondPrompt)
            expect(secondRuntimeQuestionId).not.toBe(firstQuestionId)

            await expect(guestPage.getByRole('heading', { name: firstPrompt, exact: true })).toBeVisible()
            await expect(guestPage.getByText(`Question 1 of ${application.gradeQuestionCount}`, { exact: true })).toBeVisible()
            await expectNoSeparateAnswerControls(guestPage)

            heldAnswer.release()
            await firstAnswerActivation
            await expect(guestPage.getByRole('heading', { name: secondPrompt, exact: true })).toBeVisible()
            await expect(guestPage.getByText(`Question 2 of ${application.gradeQuestionCount}`, { exact: true })).toBeVisible()
            await expectFocusInCurrentQuestion(guestPage, secondPrompt)
        } finally {
            heldAnswer.release()
            await firstAnswerActivation.catch(() => undefined)
            await heldAnswer.remove()
        }
        await expectNoPageHorizontalOverflow(guestPage, 'LMS guest quiz after touch answer at 390px')
        if (secondQuestionId === null) throw new Error('The touch answer response did not expose the next question identity')

        const secondAnswer = guestPage.getByRole('radiogroup').getByRole('radio', { name: secondQuestionOption.text, exact: true })
        const keyboardAnswerRequests = await navigateGuestQuizOptionWithKeyboard(guestPage, secondAnswer)
        let secondAnswerResponse: Response
        try {
            await expect(secondAnswer, 'Arrow keys must select the requested answer without submitting it').toBeChecked()
            await expect(guestPage.getByRole('button', { name: 'Submit answer', exact: true })).toHaveCount(0)
            await expect(guestPage.getByText('Use Space or Enter to submit the focused answer.')).toBeVisible()
            expect(keyboardAnswerRequests.getCount()).toBe(0)
            const secondAnswerResponsePromise = guestPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'PUT' && url.pathname === firstAnswerPath
            })
            await guestPage.keyboard.press('Space')
            secondAnswerResponse = await secondAnswerResponsePromise
            expect(secondAnswerResponse.status(), 'The default answer action must save and advance immediately').toBe(200)
            expect(keyboardAnswerRequests.getCount()).toBe(1)
        } finally {
            keyboardAnswerRequests.stop()
        }
        const secondAnswerRequestText = JSON.stringify(secondAnswerResponse.request().postDataJSON())
        expect(secondAnswerRequestText).toContain(secondQuestionId)
        expect(secondAnswerRequestText).toContain(secondQuestionOption.id)
        const secondAnswerPayload = await secondAnswerResponse.json()
        assertPublicGuestAnswerResponse(secondAnswerPayload, 'keyboard answer response')
        const secondAnsweredAttempt = asRecord(asRecord(secondAnswerPayload, 'Keyboard answer envelope').attempt, 'Keyboard answer attempt')
        const thirdRuntimeQuestion = getCurrentQuestion(secondAnsweredAttempt, 'Keyboard answer response', 2, thirdPrompt)
        const thirdQuestionId = getRuntimeField(thirdRuntimeQuestion, 'Id')
        if (typeof thirdQuestionId !== 'string') throw new Error('The third question has no runtime identity')
        expect(new Set([firstQuestionId, secondQuestionId, thirdQuestionId]).size).toBe(3)
        expect(secondAnswerRequestText).not.toContain(thirdQuestionId)
        expect(secondAnswerRequestText).not.toContain(thirdPrompt)
        await expect(guestPage.getByRole('heading', { name: thirdPrompt, exact: true })).toBeVisible()
        await expect(guestPage.getByText(`Question 3 of ${application.gradeQuestionCount}`, { exact: true })).toBeVisible()
        await expectFocusInCurrentQuestion(guestPage, thirdPrompt)
        await expectNoSeparateAnswerControls(guestPage)
        await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
            label: 'LMS guest quiz after keyboard answer',
            checkUuidSubstrings: true
        })

        await expectRuntimeUxViewportMatrix(guestPage, 'LMS guest quiz current question', {
            beforeEachViewport: async (viewport) => {
                await expect(guestPage.getByRole('heading', { name: thirdPrompt, exact: true })).toBeVisible()
                await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
                    label: `LMS guest quiz ${viewport.name}`,
                    checkUuidSubstrings: true
                })
                if (viewport.width === 390 || viewport.width === 1920) {
                    await testInfo.attach(`lms-guest-quiz-question-${viewport.width}px.png`, {
                        body: await guestPage.screenshot({ fullPage: true, animations: 'disabled' }),
                        contentType: 'image/png'
                    })
                }
                await expectNoAccessibilityViolations(guestPage, `LMS guest quiz ${viewport.name}`)
            }
        })

        for (let questionIndex = 2; questionIndex < expectedQuestions.length - 1; questionIndex += 1) {
            const currentCanonicalQuestion = expectedQuestions[questionIndex]
            const nextCanonicalQuestion = expectedQuestions[questionIndex + 1]
            const option = currentCanonicalQuestion?.options[0]
            const currentPrompt = currentCanonicalQuestion ? readLocalizedText(currentCanonicalQuestion.prompt, 'en') : undefined
            const nextPrompt = nextCanonicalQuestion ? readLocalizedText(nextCanonicalQuestion.prompt, 'en') : undefined
            if (!option || !currentPrompt || !nextPrompt) {
                throw new Error(`The guest quiz fixture is incomplete at question ${questionIndex + 1}`)
            }

            await expect(guestPage.getByRole('heading', { name: currentPrompt, exact: true })).toBeVisible()
            await expect(
                guestPage.getByText(`Question ${questionIndex + 1} of ${application.gradeQuestionCount}`, { exact: true })
            ).toBeVisible()
            const answerResponsePromise = guestPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'PUT' && url.pathname === firstAnswerPath
            })
            await guestPage.getByRole('radiogroup').getByRole('radio', { name: option.text, exact: true }).tap()
            const answerResponse = await answerResponsePromise
            expect(answerResponse.status(), `Answer ${questionIndex + 1} must be saved before advancing`).toBe(200)
            const answerPayload = await answerResponse.json()
            assertPublicGuestAnswerResponse(answerPayload, `answer ${questionIndex + 1} response`)
            const answeredAttempt = asRecord(
                asRecord(answerPayload, `Answer ${questionIndex + 1} envelope`).attempt,
                `Answer ${questionIndex + 1} attempt`
            )
            expect(getRuntimeField(answeredAttempt, 'AnsweredCount')).toBe(questionIndex + 1)
            getCurrentQuestion(answeredAttempt, `Answer ${questionIndex + 1} response`, questionIndex + 1, nextPrompt)
            await expect(guestPage.getByRole('heading', { name: nextPrompt, exact: true })).toBeVisible()
        }

        const lastQuestionIndex = expectedQuestions.length - 1
        const lastCanonicalQuestion = expectedQuestions[lastQuestionIndex]
        const lastOption = lastCanonicalQuestion?.options[0]
        const lastPrompt = lastCanonicalQuestion ? readLocalizedText(lastCanonicalQuestion.prompt, 'en') : undefined
        if (!lastOption || !lastPrompt) throw new Error('The guest quiz fixture is missing its final question or answer option')
        await expect(guestPage.getByRole('heading', { name: lastPrompt, exact: true })).toBeVisible()
        await expect(
            guestPage.getByText(`Question ${application.gradeQuestionCount} of ${application.gradeQuestionCount}`, { exact: true })
        ).toBeVisible()

        const finalAnswer = guestPage.getByRole('radiogroup').getByRole('radio', { name: lastOption.text, exact: true })
        const heldFinalAnswer = await holdAnswerResponse(guestPage, firstAnswerPath)
        const finalAnswerFailurePromise = guestPage.waitForEvent('requestfailed', {
            predicate: (request) => request.method() === 'PUT' && new URL(request.url()).pathname === firstAnswerPath
        })
        const finalAnswerActivation = finalAnswer.tap()
        try {
            const finalAnswerResponse = await heldFinalAnswer.response
            expect(finalAnswerResponse.status, 'The final answer must be accepted by the server before its response is lost').toBe(200)
            assertPublicGuestAnswerResponse(finalAnswerResponse.body, 'persisted final answer response')
            const finalAnsweredAttempt = asRecord(
                asRecord(finalAnswerResponse.body, 'Persisted final answer envelope').attempt,
                'Persisted final answer attempt'
            )
            expect(getRuntimeField(finalAnsweredAttempt, 'AnsweredCount')).toBe(application.gradeQuestionCount)
            expect(getRuntimeField(finalAnsweredAttempt, 'CurrentQuestionIndex')).toBe(application.gradeQuestionCount)

            heldFinalAnswer.drop()
            await finalAnswerFailurePromise
            await finalAnswerActivation
            await testInfo.attach('lms-guest-quiz-final-answer-save-error.png', {
                body: await guestPage.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })
            await expect(guestPage.getByRole('alert')).toContainText('Failed to save your answer.')

            const finalizeResponsePromise = guestPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'POST' && url.pathname === `${attemptPath}/finalize`
            })
            await guestContext.setOffline(true)
            await expect.poll(() => guestPage.evaluate(() => navigator.onLine)).toBe(false)
            const recoveredAttemptResponsePromise = guestPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'GET' && url.pathname === attemptPath
            })
            await guestContext.setOffline(false)
            const recoveredAttemptResponse = await recoveredAttemptResponsePromise
            expect(recoveredAttemptResponse.status(), 'Returning online must recover the persisted final answer').toBe(200)
            const recoveredAttempt = asRecord(await recoveredAttemptResponse.json(), 'Recovered final answer attempt')
            assertPublicAssessmentAttemptState(recoveredAttempt, 'recovered final answer attempt')
            expect(getRuntimeField(recoveredAttempt, 'AnsweredCount')).toBe(application.gradeQuestionCount)
            expect(getRuntimeField(recoveredAttempt, 'CurrentQuestionIndex')).toBe(application.gradeQuestionCount)

            const finalizeResponse = await finalizeResponsePromise
            expect(finalizeResponse.status(), 'The recovered complete attempt must be finalized').toBe(200)
            await expect(guestPage.getByRole('heading', { name: 'Quiz completed', exact: true })).toBeVisible()
            const resultStatus = guestPage.getByRole('status')
            await expect(resultStatus).toContainText(new RegExp(`Correct answers: \\d+ of ${application.gradeQuestionCount}`, 'u'))
            await expect(guestPage.getByRole('alert')).toHaveCount(0)
            await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
                label: 'LMS guest quiz result after recovering the final answer',
                checkUuidSubstrings: true
            })
            await expectNoPageHorizontalOverflow(guestPage, 'LMS guest quiz recovered result at 390px')
            await expectNoAccessibilityViolations(guestPage, 'LMS guest quiz recovered final result')
            await testInfo.attach('lms-guest-quiz-recovered-final-result.png', {
                body: await guestPage.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })
        } finally {
            heldFinalAnswer.drop()
            await finalAnswerActivation.catch(() => undefined)
            await heldFinalAnswer.remove()
        }
    } finally {
        await cleanupLmsMarathonGuestFlow(resources)
    }

    if (resources.cleanupErrors.length > 0) {
        throw new AggregateError(resources.cleanupErrors, 'Cleaning up the focused LMS guest quiz flow failed')
    }
})
