import { expect, test } from '../../fixtures/test'
import type { Locator, Page, Request, TestInfo } from '@playwright/test'
import { isUuidV7 } from '@universo-react/utils'
import {
    assertPublicGuestAnswerResponse,
    assertPublicAssessmentAttemptState,
    expectNoAccessibilityViolations,
    getRuntimeField,
    getRuntimeReferenceId,
    readLocalizedText,
    runtimeRecords
} from '../../support/lmsMarathonGuestShortLinkAssertions'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import { getApplicationRuntime, sendWithCsrf } from '../../support/backend/api-session.mjs'
import { createLmsMarathonApplication } from '../../support/lmsMarathonGuestShortLinkApplication'
import { cleanupLmsMarathonGuestFlow } from '../../support/lmsMarathonGuestShortLinkCleanup'
import { waitForApplicationRuntimeRow } from '../../support/lmsRuntime'
import {
    readGuestAssessmentAttemptSnapshot,
    readGuestAssessmentResponses,
    readPublishedQuizAccessLinkTargetBySlug,
    setGuestAssessmentAttemptDeadline
} from '../../support/lmsMarathonGuestShortLinkDatabase'
import { LMS_SIXTH_MUSE_ACCESS_LINK, LMS_SIXTH_MUSE_SOURCE } from '../../support/lmsSixthMuseFixtureContract'
import type { LmsMarathonApiContext, LmsMarathonFlowResources } from '../../support/lmsMarathonGuestShortLinkTypes'

type JsonRecord = Record<string, unknown>
type GuestSessionState = { participantId: string; sessionToken: string }

const asRecord = (value: unknown, label: string): JsonRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
    return value as JsonRecord
}

const currentBlockTitle = (attempt: JsonRecord): string | null => {
    const block = getRuntimeField(attempt, 'CurrentBlock')
    if (block === null) return null
    const currentBlock = asRecord(block, 'Current block')
    return typeof currentBlock.title === 'string' ? currentBlock.title : null
}

const currentQuestion = (attempt: JsonRecord, label: string): JsonRecord => {
    const questions = runtimeRecords(getRuntimeField(attempt, 'Questions'))
    expect(questions, `${label} must expose only its current question`).toHaveLength(1)
    const question = questions[0]
    if (!question) throw new Error(`${label} has no current question`)
    return question
}

async function tabToControl(page: Page, locator: Locator, label: string, maxTabs = 40): Promise<void> {
    for (let index = 0; index < maxTabs; index += 1) {
        if (await locator.evaluate((element) => element === document.activeElement)) return
        await page.keyboard.press('Tab')
    }
    throw new Error(`Keyboard Tab navigation could not reach ${label}`)
}

async function assertGuestSessionHeaders(request: Request, session: GuestSessionState, label: string): Promise<void> {
    const headers = await request.allHeaders()
    expect(headers['x-guest-participant-id'], `${label} must use the issued anonymous participant`).toBe(session.participantId)
    expect(headers['x-guest-session-token'], `${label} must use the issued guest-session token`).toBe(session.sessionToken)
}

async function fillByKeyboard(page: Page, locator: Locator, value: string, label: string): Promise<void> {
    await tabToControl(page, locator, label)
    await locator.pressSequentially(value)
}

async function acceptGuestLegalConsentsByKeyboard(page: Page): Promise<void> {
    const labels = [/Пользовательское соглашение/u, /Политику конфиденциальности/u]
    const checkboxes = page.getByRole('checkbox')
    await expect(checkboxes, 'Guest intake must show exactly two required legal consents').toHaveCount(2)

    for (const label of labels) {
        const checkbox = page.getByRole('checkbox', { name: label })
        await expect(checkbox, `Guest consent labelled ${label.source} must be unique`).toHaveCount(1)
        await tabToControl(page, checkbox, `guest consent ${label.source}`)
        await page.keyboard.press('Space')
        await expect(checkbox).toBeChecked()
    }
}

async function answerGuestQuestionByKeyboard(options: {
    page: Page
    applicationId: string
    attemptId: string
    option: Locator
    expectedQuestionId: string
    expectedOptionId: string
    label: string
    session: GuestSessionState
}): Promise<JsonRecord> {
    const answerUrl = `/api/v1/public/a/${options.applicationId}/runtime/attempts/${options.attemptId}/answers`
    const requestPromise = options.page.waitForRequest(
        (request) => request.method() === 'PUT' && new URL(request.url()).pathname === answerUrl
    )
    const responsePromise = options.page.waitForResponse(
        (response) => response.request().method() === 'PUT' && new URL(response.url()).pathname === answerUrl
    )
    const radioGroup = options.page.getByRole('radiogroup')
    const radios = radioGroup.getByRole('radio')
    const targetIndex = await options.option.evaluate((element) => {
        const group = element.closest('[role="radiogroup"]')
        return group ? Array.from(group.querySelectorAll<HTMLInputElement>('input[type="radio"]')).indexOf(element as HTMLInputElement) : -1
    })
    const radioCount = await radios.count()
    expect(targetIndex, `${options.label} target must belong to the visible radio group`).toBeGreaterThanOrEqual(0)
    expect(targetIndex, `${options.label} target radio must be within the group`).toBeLessThan(radioCount)
    await tabToControl(options.page, radios.first(), `${options.label} first answer option`)
    for (let index = 0; index < targetIndex; index += 1) {
        await options.page.keyboard.press('ArrowDown')
        await expect(radios.nth(index + 1), `${options.label} arrow navigation must move focus to the next option`).toBeFocused()
    }
    await expect(options.option, `${options.label} keyboard navigation must focus the intended answer`).toBeFocused()
    const [request] = await Promise.all([requestPromise, options.page.keyboard.press('Space')])
    await assertGuestSessionHeaders(request, options.session, `${options.label} answer request`)
    expect(request.postDataJSON(), `${options.label} must submit the keyboard-selected answer`).toMatchObject({
        questionId: options.expectedQuestionId,
        optionId: options.expectedOptionId
    })
    const response = await responsePromise
    expect(response.status(), `${options.label} must be durably saved`).toBe(200)
    const payload = await response.json()
    assertPublicGuestAnswerResponse(payload, `${options.label} response`)
    return asRecord(payload.attempt, `${options.label} saved attempt`)
}

async function captureResponsiveState(page: Page, state: string, testInfo: TestInfo): Promise<void> {
    for (const viewport of [
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectNoPageHorizontalOverflow(page, `Sixth Muse ${state} at ${viewport.width}px`)
        await page.screenshot({
            path: testInfo.outputPath(`lms-sixth-muse-${state}-ru-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 390, height: 844 })
}

async function enablePausedIntroAndBlockNumbering(options: {
    applicationId: string
    workspaceId: string
    api: LmsMarathonApiContext
    quizId: string
}): Promise<void> {
    const runtime = await getApplicationRuntime(options.api, options.applicationId, { workspaceId: options.workspaceId })
    const quizzesObject = (runtime.objects ?? []).find(
        (candidate: JsonRecord) => readLocalizedText(candidate.codename, 'en') === 'Quizzes'
    ) as JsonRecord | undefined
    if (typeof quizzesObject?.id !== 'string') throw new Error('The authorized runtime must resolve the Quizzes object')

    const quizRow = await waitForApplicationRuntimeRow(options.api, options.applicationId, quizzesObject.id, options.quizId, {
        workspaceId: options.workspaceId
    })
    const version = Number(quizRow?._upl_version ?? quizRow?.version)
    if (!Number.isSafeInteger(version) || version < 1) throw new Error('The Sixth Muse quiz row must expose its optimistic version')

    const response = await sendWithCsrf(
        options.api,
        'PATCH',
        `/api/v1/applications/${options.applicationId}/runtime/rows/${encodeURIComponent(options.quizId)}?workspaceId=${encodeURIComponent(
            options.workspaceId
        )}`,
        {
            objectCollectionId: quizzesObject.id,
            expectedVersion: version,
            data: { MaxAttempts: 2, PauseTimerOnBlockIntro: true, BlockRelativeNumbering: true }
        }
    )
    if (!response.ok) throw new Error(`Updating the isolated paused-intro browser scenario failed with ${response.status}`)
}

async function replayContinueRequest(options: {
    page: Page
    url: string
    body: JsonRecord
    headers: Record<string, string>
    session: GuestSessionState
}): Promise<{ status: number; payload: JsonRecord }> {
    expect(options.headers['x-csrf-token'], 'Continue replay must preserve the browser CSRF token').toBeTruthy()
    expect(options.headers['x-guest-participant-id'], 'Continue replay must preserve the guest participant').toBe(
        options.session.participantId
    )
    expect(options.headers['x-guest-session-token'], 'Continue replay must preserve the guest session').toBe(options.session.sessionToken)
    const result = await options.page.evaluate(
        async ({ url, body, csrfToken, participantId, sessionToken }) => {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'X-Guest-Participant-Id': participantId,
                    'X-Guest-Session-Token': sessionToken
                },
                body: JSON.stringify(body)
            })
            return { status: response.status, payload: await response.json() }
        },
        {
            url: options.url,
            body: options.body,
            csrfToken: options.headers['x-csrf-token'] ?? '',
            participantId: options.headers['x-guest-participant-id'] ?? '',
            sessionToken: options.headers['x-guest-session-token'] ?? ''
        }
    )
    return { status: result.status, payload: asRecord(result.payload, 'Replayed Continue response') }
}

async function expectGuestAttemptRequestRejectedWithoutValidSession(options: {
    page: Page
    path: string
    participantId: string
}): Promise<void> {
    const status = await options.page.evaluate(
        async ({ path, participantId }) => {
            const response = await fetch(path, {
                credentials: 'same-origin',
                headers: {
                    'X-Guest-Participant-Id': participantId,
                    'X-Guest-Session-Token': 'invalid-e2e-session-token'
                }
            })
            return response.status
        },
        { path: options.path, participantId: options.participantId }
    )
    expect([401, 403, 404]).toContain(status)
}

async function readTimerRemainingSeconds(timer: Locator): Promise<number> {
    const value = (await timer.innerText()).trim()
    const match = /^(\d+):([0-5]\d)$/u.exec(value)
    if (!match) throw new Error(`Timer must use the localized MM:SS format, received ${JSON.stringify(value)}`)
    return Number(match[1]) * 60 + Number(match[2])
}

async function expectTimerAdvances(page: Page, timer: Locator, label: string): Promise<void> {
    const currentTime = await page.evaluate(() => Date.now())
    // Keep the target safely ahead of the running clock while preserving an exact controlled tick below.
    await page.clock.pauseAt(new Date(currentTime + 250))
    try {
        const before = await readTimerRemainingSeconds(timer)
        await page.clock.runFor(1000)
        await expect
            .poll(async () => readTimerRemainingSeconds(timer), {
                message: `${label} must decrease by one second after a controlled 1000ms clock tick`,
                timeout: 1000
            })
            .toBe(before - 1)
    } finally {
        await page.clock.resume()
    }
}

test('@flow LMS Sixth Muse runs anonymously through all block introductions, questions, and the authorized result report', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(900_000)
    const resources: LmsMarathonFlowResources = { cleanupErrors: [] }

    try {
        const application = await createLmsMarathonApplication({ browser, page, testInfo, runManifest, resources })
        const persistedLink = await readPublishedQuizAccessLinkTargetBySlug(
            application.applicationId,
            application.publicWorkspaceId,
            LMS_SIXTH_MUSE_ACCESS_LINK.slug
        )
        const runSuffix = runManifest.runId
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-|-$/gu, '')
            .slice(0, 28)
        const shortLinkSlug = `e2e-${runSuffix || 'run'}-sixth-muse`
        const shortLinkResponse = await sendWithCsrf(application.api, 'POST', '/api/v1/global-short-links', {
            slug: shortLinkSlug,
            target: {
                kind: 'lms-access-link',
                applicationId: application.applicationId,
                accessLinkId: persistedLink.id,
                accessLinkSlug: LMS_SIXTH_MUSE_ACCESS_LINK.slug,
                workspaceId: application.publicWorkspaceId
            }
        })
        expect(shortLinkResponse.ok, 'The reviewed quiz must produce a resolvable anonymous short link').toBe(true)
        const shortLink = await shortLinkResponse.json()
        if (typeof shortLink.id !== 'string') throw new Error('The Sixth Muse short link has no persistent identity')
        resources.createdGlobalShortLinkIds = [shortLink.id]

        const origin = new URL(page.url()).origin
        const guestContext = await browser.newContext({
            storageState: { cookies: [], origins: [] },
            locale: 'ru-RU',
            timezoneId: 'UTC',
            colorScheme: 'light',
            reducedMotion: 'reduce',
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true
        })
        resources.guestContext = guestContext
        await guestContext.clearCookies()
        expect(await guestContext.cookies(origin), 'The learner must begin without authenticated cookies').toHaveLength(0)

        const guestPage = await guestContext.newPage()
        await guestPage.clock.install({ time: new Date('2026-10-18T12:00:00.000Z') })
        const guestSessionPromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'POST' && url.pathname === `/api/v1/public/a/${application.applicationId}/guest-session`
        })
        const attemptStartPromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'POST' &&
                url.pathname === `/api/v1/public/a/${application.applicationId}/runtime/attempts/start`
            )
        })
        await guestPage.goto(new URL(`/l/${shortLinkSlug}?locale=ru`, origin).toString())
        await expect(guestPage.getByLabel('Имя')).toBeVisible({ timeout: 30_000 })
        await expect(guestPage.getByLabel('Фамилия')).toBeVisible()
        const startButton = guestPage.getByRole('button', { name: 'Начать обучение', exact: true })
        await expect(startButton, 'The guest form must not allow an incomplete anonymous intake').toBeDisabled()
        await fillByKeyboard(guestPage, guestPage.getByLabel('Имя'), 'Мария', 'first-name field')
        await fillByKeyboard(guestPage, guestPage.getByLabel('Фамилия'), 'Лицей', 'last-name field')
        await acceptGuestLegalConsentsByKeyboard(guestPage)
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-guest-intake-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await expectNoPageHorizontalOverflow(guestPage, 'Sixth Muse guest intake at 390px')
        await expectNoAccessibilityViolations(guestPage, 'Sixth Muse guest intake at 390px')

        await expect(startButton).toBeEnabled()
        await tabToControl(guestPage, startButton, 'guest start button')
        await guestPage.keyboard.press('Enter')
        const guestSessionResponse = await guestSessionPromise
        expect(guestSessionResponse.status()).toBe(201)
        const guestSessionRecord = asRecord(await guestSessionResponse.json(), 'Issued guest session')
        const participantId = getRuntimeField(guestSessionRecord, 'ParticipantId')
        const sessionToken = getRuntimeField(guestSessionRecord, 'SessionToken')
        if (typeof participantId !== 'string' || !participantId || typeof sessionToken !== 'string' || !sessionToken) {
            throw new Error('Guest intake must issue a participant and opaque guest-session token')
        }
        const guestSession: GuestSessionState = { participantId, sessionToken }
        const attemptStartResponse = await attemptStartPromise
        expect(attemptStartResponse.ok()).toBe(true)
        const initialAttemptStartRequest = attemptStartResponse.request()
        await assertGuestSessionHeaders(initialAttemptStartRequest, guestSession, 'Attempt start request')
        const initialAttemptStartHeaders = await initialAttemptStartRequest.allHeaders()
        const initialAttemptStartBody = initialAttemptStartRequest.postDataJSON() as JsonRecord
        expect(initialAttemptStartHeaders['x-csrf-token']).toBeTruthy()
        let attempt = asRecord(await attemptStartResponse.json(), 'Sixth Muse attempt start')
        assertPublicAssessmentAttemptState(attempt, 'Sixth Muse attempt start')

        const attemptId = getRuntimeField(attempt, 'AttemptId')
        if (typeof attemptId !== 'string' || !isUuidV7(attemptId)) throw new Error('The anonymous attempt must use a UUID v7 identity')
        const attemptPath = `/api/v1/public/a/${application.applicationId}/runtime/attempts/${attemptId}`
        expect(getRuntimeField(attempt, 'Phase')).toBe('block_intro')
        expect(currentBlockTitle(attempt)).toBe(LMS_SIXTH_MUSE_SOURCE.blocks[0]?.title)
        await expect(guestPage.getByRole('heading', { name: LMS_SIXTH_MUSE_SOURCE.blocks[0]!.title, exact: true })).toBeVisible()
        const timer = guestPage.getByRole('timer')
        await expect(timer).toBeVisible()
        const initialTimerSeconds = await readTimerRemainingSeconds(timer)
        expect(initialTimerSeconds).toBeLessThanOrEqual(LMS_SIXTH_MUSE_SOURCE.quizPolicies.timeLimitSeconds)
        expect(initialTimerSeconds).toBeGreaterThan(LMS_SIXTH_MUSE_SOURCE.quizPolicies.timeLimitSeconds - 10)
        await expectTimerAdvances(guestPage, timer, 'Initial block introduction')
        await expectNoPageHorizontalOverflow(guestPage, 'Sixth Muse first block introduction at 390px')
        await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
            label: 'Sixth Muse first block introduction',
            checkUuidSubstrings: true
        })
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-block-1-intro-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await captureResponsiveState(guestPage, 'block-1-intro', testInfo)

        let globalQuestionIndex = 0
        for (const [blockIndex, block] of LMS_SIXTH_MUSE_SOURCE.blocks.entries()) {
            expect(getRuntimeField(attempt, 'Phase'), `Block ${blockIndex + 1} must be shown before its questions`).toBe('block_intro')
            expect(currentBlockTitle(attempt), `Block ${blockIndex + 1} title`).toBe(block.title)
            await expect(guestPage.getByRole('heading', { name: block.title, exact: true })).toBeVisible()
            if (block.introduction) {
                await expect(guestPage.getByText(block.introduction, { exact: true })).toBeVisible()
            }
            if (blockIndex > 0) {
                await expectTimerAdvances(guestPage, timer, `Block ${blockIndex + 1} introduction`)
                await expectNoPageHorizontalOverflow(guestPage, `Sixth Muse block ${blockIndex + 1} introduction at 390px`)
                await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
                    label: `Sixth Muse block ${blockIndex + 1} introduction`,
                    checkUuidSubstrings: true
                })
                await guestPage.screenshot({
                    path: testInfo.outputPath(`lms-sixth-muse-block-${blockIndex + 1}-intro-ru-mobile.png`),
                    fullPage: true,
                    animations: 'disabled'
                })
            }

            const continueResponsePromise = guestPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'POST' && url.pathname === `${attemptPath}/continue`
            })
            const continueRequestPromise = guestPage.waitForRequest((request) => {
                const url = new URL(request.url())
                return request.method() === 'POST' && url.pathname === `${attemptPath}/continue`
            })
            const continueButton = guestPage.getByRole('button', { name: 'Продолжить', exact: true })
            await expect(continueButton).toBeVisible()
            const remainingBeforeContinueMs = Number(getRuntimeField(attempt, 'RemainingMs'))
            expect(Number.isFinite(remainingBeforeContinueMs), 'The server must provide the active timer budget').toBe(true)
            await tabToControl(guestPage, continueButton, `Continue button for block ${blockIndex + 1}`)
            await guestPage.keyboard.press('Enter')
            const [continueRequest, continueResponse] = await Promise.all([continueRequestPromise, continueResponsePromise])
            await assertGuestSessionHeaders(continueRequest, guestSession, `Block ${blockIndex + 1} Continue request`)
            expect(continueResponse.status(), `Block ${blockIndex + 1} must continue to its questions`).toBe(200)
            attempt = asRecord(await continueResponse.json(), `Block ${blockIndex + 1} continue response`)
            assertPublicAssessmentAttemptState(attempt, `Block ${blockIndex + 1} continue response`)
            expect(getRuntimeField(attempt, 'Phase')).toBe('question')
            expect(getRuntimeField(attempt, 'CurrentBlock')).toBeNull()
            const remainingAfterContinueMs = Number(getRuntimeField(attempt, 'RemainingMs'))
            expect(
                remainingAfterContinueMs,
                `Block ${blockIndex + 1} Continue must not reset the server-owned running timer`
            ).toBeLessThanOrEqual(remainingBeforeContinueMs)
            await expect.poll(() => readTimerRemainingSeconds(timer)).toBe(Math.ceil(remainingAfterContinueMs / 1000))

            for (const [questionIndex, sourceQuestion] of block.questions.entries()) {
                const expectedPrompt = sourceQuestion.runtimePrompt
                const question = currentQuestion(attempt, `Sixth Muse question ${globalQuestionIndex + 1}`)
                expect(readLocalizedText(getRuntimeField(question, 'Prompt'), 'ru')).toBe(expectedPrompt)
                const displayNumber = getRuntimeField(question, 'DisplayNumber')
                expect(displayNumber).toBe(String(globalQuestionIndex + 1))
                expect(typeof displayNumber).toBe('string')
                const runtimeOptions = runtimeRecords(getRuntimeField(question, 'Options'))
                expect(runtimeOptions).toHaveLength(4)
                expect(runtimeOptions.map((option) => readLocalizedText(getRuntimeField(option, 'Label'), 'ru')).sort()).toEqual(
                    sourceQuestion.options.map((option) => option.text).sort()
                )
                expect(Object.keys(question)).not.toContain('correctOptionId')
                expect(runtimeOptions.every((option) => !Object.hasOwn(option, 'isCorrect'))).toBe(true)
                await expect(guestPage.getByText(`Вопрос ${displayNumber}`, { exact: true })).toBeVisible()
                await expect(guestPage.getByRole('heading', { name: expectedPrompt, exact: true })).toBeVisible()
                await expect(guestPage.getByRole('radiogroup').getByRole('radio')).toHaveCount(4)
                await expectNoPageHorizontalOverflow(guestPage, `Sixth Muse question ${globalQuestionIndex + 1} at 390px`)
                if (globalQuestionIndex === 0) {
                    await expect(guestPage.getByText('Дано ответов: 0 из 30', { exact: true })).toBeVisible()
                    await expectNoPageHorizontalOverflow(guestPage, 'Sixth Muse first question at 390px')
                    await expectNoAccessibilityViolations(guestPage, 'Sixth Muse first question at 390px')
                    await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
                        label: 'Sixth Muse first question',
                        checkUuidSubstrings: true
                    })
                    await guestPage.screenshot({
                        path: testInfo.outputPath('lms-sixth-muse-question-ru-mobile.png'),
                        fullPage: true,
                        animations: 'disabled'
                    })
                    await captureResponsiveState(guestPage, 'question', testInfo)
                }

                const correctOption = sourceQuestion.options.find((option) => option.isCorrect)
                if (!correctOption) throw new Error(`Sixth Muse source question ${sourceQuestion.id} has no reviewed answer`)
                const currentQuestionId = getRuntimeField(question, 'Id')
                const correctRuntimeOption = runtimeOptions.find(
                    (option) => readLocalizedText(getRuntimeField(option, 'Label'), 'ru') === correctOption.text
                )
                const correctRuntimeOptionId = correctRuntimeOption ? getRuntimeField(correctRuntimeOption, 'Id') : undefined
                if (typeof currentQuestionId !== 'string' || typeof correctRuntimeOptionId !== 'string') {
                    throw new Error(`Sixth Muse question ${globalQuestionIndex + 1} must expose its public question and option IDs`)
                }
                for (const option of sourceQuestion.options) {
                    await expect(
                        guestPage.getByRole('radiogroup').getByRole('radio', { name: option.text, exact: true }),
                        `Question ${globalQuestionIndex + 1} must visibly render every reviewed answer option`
                    ).toBeVisible()
                }
                await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
                    label: `Sixth Muse question ${globalQuestionIndex + 1}`,
                    checkUuidSubstrings: true
                })
                const selectedRadio = guestPage.getByRole('radiogroup').getByRole('radio', { name: correctOption.text, exact: true })
                attempt = await answerGuestQuestionByKeyboard({
                    page: guestPage,
                    applicationId: application.applicationId,
                    attemptId,
                    option: selectedRadio,
                    expectedQuestionId: currentQuestionId,
                    expectedOptionId: correctRuntimeOptionId,
                    label: `Sixth Muse question ${globalQuestionIndex + 1}`,
                    session: guestSession
                })
                globalQuestionIndex += 1

                if (globalQuestionIndex === LMS_SIXTH_MUSE_SOURCE.blocks.reduce((count, item) => count + item.questions.length, 0)) {
                    break
                }
                if (questionIndex === block.questions.length - 1) {
                    expect(getRuntimeField(attempt, 'Phase')).toBe('block_intro')
                    expect(currentBlockTitle(attempt)).toBe(LMS_SIXTH_MUSE_SOURCE.blocks[blockIndex + 1]?.title)
                } else {
                    expect(getRuntimeField(attempt, 'Phase')).toBe('question')
                    expect(getRuntimeField(attempt, 'CurrentQuestionIndex')).toBe(globalQuestionIndex)
                }
            }

            if (blockIndex < LMS_SIXTH_MUSE_SOURCE.blocks.length - 1) {
                expect(getRuntimeField(attempt, 'Phase')).toBe('block_intro')
                expect(getRuntimeField(attempt, 'TimerState')).toBe('running')
            }
        }

        expect(globalQuestionIndex).toBe(30)
        expect(getRuntimeField(attempt, 'Status')).toBe('completed')
        expect(getRuntimeField(attempt, 'AnsweredCount')).toBe(30)
        expect(getRuntimeField(attempt, 'TotalQuestions')).toBe(30)
        expect(getRuntimeField(attempt, 'Result')).toMatchObject({ score: 30, total: 30, passed: true, finishedReason: 'submitted' })
        await expect(guestPage.getByRole('heading', { name: 'Тест завершён', exact: true })).toBeVisible()
        await expect(guestPage.getByRole('status').last()).toContainText('Правильных ответов: 30 из 30')
        await expectNoTechnicalLeakage(guestPage.getByRole('main'), { label: 'Sixth Muse final result', checkUuidSubstrings: true })
        await expectNoPageHorizontalOverflow(guestPage, 'Sixth Muse final result at 390px')
        await expectNoAccessibilityViolations(guestPage, 'Sixth Muse final result at 390px')
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-result-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await captureResponsiveState(guestPage, 'result', testInfo)

        const [attemptSnapshot, responses] = await Promise.all([
            readGuestAssessmentAttemptSnapshot(application.applicationId, attemptId),
            readGuestAssessmentResponses(application.applicationId, attemptId)
        ])
        expect(isUuidV7(attemptSnapshot.studentId)).toBe(true)
        expect(attemptSnapshot.status.toLowerCase()).toBe('passed')
        expect(attemptSnapshot.score).toBe(30)
        expect(attemptSnapshot.totalQuestions).toBe(30)
        expect(responses).toHaveLength(30)
        expect(responses.every((response) => response.isCorrect)).toBe(true)

        const reportResponse = await sendWithCsrf(
            application.api,
            'POST',
            `/api/v1/applications/${application.applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(
                application.publicWorkspaceId
            )}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect(reportResponse.status, 'The authenticated owner must see the saved quiz result in the report').toBe(200)
        const reportPayload = await reportResponse.json()
        const reportRows = runtimeRecords(reportPayload.rows)
        const submittedRow = reportRows.find(
            (row) => getRuntimeReferenceId(getRuntimeField(row, 'StudentId')) === attemptSnapshot.studentId
        )
        expect(submittedRow).toBeTruthy()
        expect(Number(getRuntimeField(submittedRow as JsonRecord, 'Score'))).toBe(30)
        expect(Number(getRuntimeField(submittedRow as JsonRecord, 'TotalQuestions'))).toBe(30)
        expect(getRuntimeField(submittedRow as JsonRecord, 'Passed')).toBe(true)

        await page.goto(`/a/${application.applicationId}?locale=en&workspaceId=${encodeURIComponent(application.publicWorkspaceId)}`)
        const reportsLink = page
            .getByRole('link', { name: 'Reports' })
            .or(page.getByRole('button', { name: 'Reports' }))
            .first()
        await expect(reportsLink).toBeVisible({ timeout: 30_000 })
        await reportsLink.click()
        const reportTable = page.getByTestId('runtime-report-details-table').filter({
            has: page.getByRole('gridcell', { name: 'Мария Лицей', exact: true })
        })
        await expect(reportTable).toBeVisible({ timeout: 60_000 })
        await expect(reportTable).toHaveCount(1)
        await expect(reportTable.getByRole('columnheader', { name: 'Score', exact: true })).toBeVisible()
        await expect(reportTable.getByRole('columnheader', { name: 'Total questions', exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(reportTable, { label: 'Authorized Sixth Muse quiz report', checkUuidSubstrings: true })
        const reportRow = page.getByRole('row').filter({ has: page.getByRole('gridcell', { name: 'Мария Лицей', exact: true }) })
        await expect(reportRow.locator('[data-field="Score"]')).toHaveText('30')
        await expect(reportRow.locator('[data-field="TotalQuestions"]')).toHaveText('30')
        await expect(reportRow.locator('[data-field="Passed"]')).toContainText('Yes')
        await page.setViewportSize({ width: 1920, height: 1080 })
        await expectNoPageHorizontalOverflow(page, 'Authorized Sixth Muse report at desktop width')
        await expectNoAccessibilityViolations(page, 'Authorized Sixth Muse report')
        await page.screenshot({ path: testInfo.outputPath('lms-sixth-muse-authorized-report.png'), fullPage: true, animations: 'disabled' })
        await captureResponsiveState(page, 'authorized-report', testInfo)
        await page.setViewportSize({ width: 390, height: 844 })
        await expectNoPageHorizontalOverflow(page, 'Authorized Sixth Muse report at 390px')
        await expect(reportRow).toBeVisible()
        await page.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-authorized-report-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const retryButton = guestPage.getByRole('button', { name: 'Попробовать ещё раз', exact: true })
        await expect(retryButton, 'MaxAttempts=1 must prevent another attempt for the same participant').toHaveCount(0)
        const rejectedRetry = await guestPage.evaluate(
            async ({ path, body, csrfToken, participantId, sessionToken }) => {
                const response = await fetch(path, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                        'X-Guest-Participant-Id': participantId,
                        'X-Guest-Session-Token': sessionToken
                    },
                    body: JSON.stringify(body)
                })
                return { status: response.status }
            },
            {
                path: `/api/v1/public/a/${application.applicationId}/runtime/attempts/start?locale=ru`,
                body: initialAttemptStartBody,
                csrfToken: initialAttemptStartHeaders['x-csrf-token'],
                participantId,
                sessionToken
            }
        )
        expect(rejectedRetry.status, 'The server must enforce MaxAttempts=1 for the same participant').toBe(409)

        await enablePausedIntroAndBlockNumbering({
            applicationId: application.applicationId,
            workspaceId: application.publicWorkspaceId,
            api: application.api,
            quizId: persistedLink.targetId
        })
        await guestPage.reload()
        await expect(retryButton, 'The isolated runtime configuration must enable the authored retry').toBeVisible({ timeout: 30_000 })
        const pausedStartPromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'POST' && url.pathname.endsWith('/runtime/attempts/start')
        })
        await tabToControl(guestPage, retryButton, 'retry quiz button')
        await guestPage.keyboard.press('Enter')
        const pausedStartResponse = await pausedStartPromise
        expect(pausedStartResponse.status()).toBe(200)
        await assertGuestSessionHeaders(pausedStartResponse.request(), guestSession, 'Paused retry start request')
        attempt = asRecord(await pausedStartResponse.json(), 'Paused-intro retry start')
        assertPublicAssessmentAttemptState(attempt, 'Paused-intro retry start')
        expect(getRuntimeField(attempt, 'AttemptNumber')).toBe(2)
        expect(getRuntimeField(attempt, 'Phase')).toBe('block_intro')
        expect(getRuntimeField(attempt, 'TimerState')).toBe('paused')
        expect(getRuntimeField(attempt, 'NumberingMode')).toBe('block')
        expect(getRuntimeField(attempt, 'RemainingMs')).toBe(LMS_SIXTH_MUSE_SOURCE.quizPolicies.timeLimitSeconds * 1000)
        expect(getRuntimeField(attempt, 'DeadlineAt')).toBeNull()
        const pausedAttemptId = getRuntimeField(attempt, 'AttemptId')
        if (typeof pausedAttemptId !== 'string' || !isUuidV7(pausedAttemptId)) {
            throw new Error('The paused retry must keep a UUID v7 attempt identity')
        }
        const pausedAttemptPath = `/api/v1/public/a/${application.applicationId}/runtime/attempts/${pausedAttemptId}`
        await expectGuestAttemptRequestRejectedWithoutValidSession({
            page: guestPage,
            path: `${pausedAttemptPath}?locale=ru`,
            participantId
        })
        const pausedTimer = guestPage.getByRole('timer')
        const pausedTimerLabel = `${String(Math.floor(LMS_SIXTH_MUSE_SOURCE.quizPolicies.timeLimitSeconds / 60)).padStart(2, '0')}:00`
        await expect(pausedTimer).toHaveText(pausedTimerLabel)
        await expect(guestPage.getByRole('status').filter({ hasText: 'Таймер приостановлен' })).toBeVisible()
        await expectNoPageHorizontalOverflow(guestPage, 'Paused Sixth Muse introduction at 390px')
        await expectNoAccessibilityViolations(guestPage, 'Paused Sixth Muse introduction at 390px')
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-paused-intro-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await captureResponsiveState(guestPage, 'paused-intro', testInfo)
        // Advance only browser presentation; reload below independently verifies the server-owned frozen budget.
        await guestPage.clock.runFor(2200)
        await expect(pausedTimer, 'A paused intro must not consume its frozen timer budget').toHaveText(pausedTimerLabel)

        const resumedReadPromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'GET' && url.pathname === pausedAttemptPath
        })
        await guestPage.reload()
        const resumedReadResponse = await resumedReadPromise
        expect(resumedReadResponse.status()).toBe(200)
        await assertGuestSessionHeaders(resumedReadResponse.request(), guestSession, 'Paused-intro reload request')
        attempt = asRecord(await resumedReadResponse.json(), 'Paused-intro reload')
        assertPublicAssessmentAttemptState(attempt, 'Paused-intro reload')
        expect(getRuntimeField(attempt, 'AttemptId')).toBe(pausedAttemptId)
        expect(getRuntimeField(attempt, 'TimerState')).toBe('paused')
        expect(getRuntimeField(attempt, 'RemainingMs')).toBe(LMS_SIXTH_MUSE_SOURCE.quizPolicies.timeLimitSeconds * 1000)
        expect(currentBlockTitle(attempt)).toBe(LMS_SIXTH_MUSE_SOURCE.blocks[0]?.title)
        await expect(guestPage.getByRole('heading', { name: LMS_SIXTH_MUSE_SOURCE.blocks[0]!.title, exact: true })).toBeVisible()
        await expect(guestPage.getByRole('button', { name: 'Продолжить', exact: true })).toBeVisible()
        await expect(guestPage.getByRole('radiogroup')).toHaveCount(0)
        await expect(pausedTimer).toHaveText(pausedTimerLabel)
        await expect(guestPage.getByRole('status').filter({ hasText: 'Таймер приостановлен' })).toBeVisible()

        const continueUrl = `${pausedAttemptPath}/continue?locale=ru`
        const continueRequestPromise = guestPage.waitForRequest(
            (request) => request.method() === 'POST' && new URL(request.url()).pathname === `${pausedAttemptPath}/continue`
        )
        const continueResponsePromise = guestPage.waitForResponse(
            (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === `${pausedAttemptPath}/continue`
        )
        const pausedContinueButton = guestPage.getByRole('button', { name: 'Продолжить', exact: true })
        await tabToControl(guestPage, pausedContinueButton, 'paused-intro Continue button after reload')
        await guestPage.keyboard.press('Enter')
        const [continueRequest, continueResponse] = await Promise.all([continueRequestPromise, continueResponsePromise])
        expect(continueResponse.status()).toBe(200)
        await assertGuestSessionHeaders(continueRequest, guestSession, 'Paused-intro Continue request')
        const continueBody = continueRequest.postDataJSON() as JsonRecord
        const continueHeaders = await continueRequest.allHeaders()
        const resumedAttempt = asRecord(await continueResponse.json(), 'Paused-intro Continue response')
        assertPublicAssessmentAttemptState(resumedAttempt, 'Paused-intro Continue response')
        expect(getRuntimeField(resumedAttempt, 'Phase')).toBe('question')
        expect(getRuntimeField(resumedAttempt, 'TimerState')).toBe('running')
        expect(getRuntimeField(resumedAttempt, 'CurrentQuestionIndex')).toBe(0)
        const firstBlockedQuestion = currentQuestion(resumedAttempt, 'First block-relative question')
        expect(getRuntimeField(firstBlockedQuestion, 'DisplayNumber')).toBe('1.1')
        const resumedDeadline = getRuntimeField(resumedAttempt, 'DeadlineAt')
        expect(typeof resumedDeadline).toBe('string')

        const duplicateContinue = await replayContinueRequest({
            page: guestPage,
            url: continueUrl,
            body: continueBody,
            headers: continueHeaders,
            session: guestSession
        })
        expect(duplicateContinue.status, 'A replayed Continue must be idempotent').toBe(200)
        assertPublicAssessmentAttemptState(duplicateContinue.payload, 'Replayed Continue response')
        expect(getRuntimeField(duplicateContinue.payload, 'Phase')).toBe('question')
        expect(getRuntimeField(duplicateContinue.payload, 'PhaseRevision')).toBe(getRuntimeField(resumedAttempt, 'PhaseRevision'))
        expect(getRuntimeField(duplicateContinue.payload, 'CurrentQuestionIndex')).toBe(0)
        expect(getRuntimeField(duplicateContinue.payload, 'DeadlineAt')).toBe(resumedDeadline)
        await expect(guestPage.getByText('Вопрос 1.1', { exact: true })).toBeVisible()
        await expectTimerAdvances(guestPage, pausedTimer, 'Timer after the paused intro resumes')
        await expectNoPageHorizontalOverflow(guestPage, 'Resumed block-relative question at 390px')
        await expectNoAccessibilityViolations(guestPage, 'Resumed block-relative question at 390px')
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-block-1-relative-question-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const firstBlock = LMS_SIXTH_MUSE_SOURCE.blocks[0]
        const secondBlock = LMS_SIXTH_MUSE_SOURCE.blocks[1]
        if (!firstBlock || !secondBlock) throw new Error('The paused timer regression requires at least two authored blocks')
        attempt = resumedAttempt
        for (const [questionIndex] of firstBlock.questions.entries()) {
            const question = currentQuestion(attempt, `Paused retry block 1 question ${questionIndex + 1}`)
            const questionId = getRuntimeField(question, 'Id')
            const firstOption = runtimeRecords(getRuntimeField(question, 'Options'))[0]
            const optionId = firstOption ? getRuntimeField(firstOption, 'Id') : undefined
            if (typeof questionId !== 'string' || typeof optionId !== 'string') {
                throw new Error(`Paused retry block 1 question ${questionIndex + 1} must expose public answer identifiers`)
            }
            expect(getRuntimeField(question, 'DisplayNumber')).toBe(`1.${questionIndex + 1}`)
            attempt = await answerGuestQuestionByKeyboard({
                page: guestPage,
                applicationId: application.applicationId,
                attemptId: pausedAttemptId,
                option: guestPage.getByRole('radiogroup').getByRole('radio').first(),
                expectedQuestionId: questionId,
                expectedOptionId: optionId,
                label: `Paused retry block 1 question ${questionIndex + 1}`,
                session: guestSession
            })
        }

        expect(getRuntimeField(attempt, 'Phase')).toBe('block_intro')
        expect(getRuntimeField(attempt, 'TimerState')).toBe('paused')
        expect(getRuntimeField(attempt, 'DeadlineAt')).toBeNull()
        expect(currentBlockTitle(attempt)).toBe(secondBlock.title)
        const frozenSecondBlockRemainingMs = Number(getRuntimeField(attempt, 'RemainingMs'))
        expect(frozenSecondBlockRemainingMs).toBeGreaterThan(0)
        expect(frozenSecondBlockRemainingMs).toBeLessThan(45 * 60 * 1000)
        await expect(guestPage.getByRole('heading', { name: secondBlock.title, exact: true })).toBeVisible()
        await expect(guestPage.getByRole('status').filter({ hasText: 'Таймер приостановлен' })).toBeVisible()
        await expectNoPageHorizontalOverflow(guestPage, 'Paused Sixth Muse second block introduction at 390px')
        const frozenSecondBlockTimerText = await pausedTimer.innerText()
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-block-2-paused-intro-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await guestPage.clock.runFor(2200)
        await expect(pausedTimer, 'A later block intro must preserve the previously earned remaining time').toHaveText(
            frozenSecondBlockTimerText
        )

        const secondIntroReloadPromise = guestPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'GET' && url.pathname === pausedAttemptPath
        })
        await guestPage.reload()
        const secondIntroReloadResponse = await secondIntroReloadPromise
        expect(secondIntroReloadResponse.status()).toBe(200)
        await assertGuestSessionHeaders(secondIntroReloadResponse.request(), guestSession, 'Second-block paused intro reload request')
        attempt = asRecord(await secondIntroReloadResponse.json(), 'Second-block paused intro reload')
        assertPublicAssessmentAttemptState(attempt, 'Second-block paused intro reload')
        expect(getRuntimeField(attempt, 'Phase')).toBe('block_intro')
        expect(getRuntimeField(attempt, 'TimerState')).toBe('paused')
        expect(getRuntimeField(attempt, 'RemainingMs')).toBe(frozenSecondBlockRemainingMs)
        expect(getRuntimeField(attempt, 'AnsweredCount')).toBe(firstBlock.questions.length)
        expect(getRuntimeField(attempt, 'CurrentQuestionIndex')).toBe(firstBlock.questions.length)
        expect(currentBlockTitle(attempt)).toBe(secondBlock.title)
        await expect(pausedTimer).toHaveText(frozenSecondBlockTimerText)

        const secondIntroContinueRequestPromise = guestPage.waitForRequest(
            (request) => request.method() === 'POST' && new URL(request.url()).pathname === `${pausedAttemptPath}/continue`
        )
        const secondIntroContinueResponsePromise = guestPage.waitForResponse(
            (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === `${pausedAttemptPath}/continue`
        )
        await tabToControl(guestPage, guestPage.getByRole('button', { name: 'Продолжить', exact: true }), 'second-block Continue button')
        await guestPage.keyboard.press('Enter')
        const [secondIntroContinueRequest, secondIntroContinueResponse] = await Promise.all([
            secondIntroContinueRequestPromise,
            secondIntroContinueResponsePromise
        ])
        expect(secondIntroContinueResponse.status()).toBe(200)
        await assertGuestSessionHeaders(secondIntroContinueRequest, guestSession, 'Second-block Continue request')
        attempt = asRecord(await secondIntroContinueResponse.json(), 'Second-block Continue response')
        assertPublicAssessmentAttemptState(attempt, 'Second-block Continue response')
        expect(getRuntimeField(attempt, 'Phase')).toBe('question')
        expect(getRuntimeField(attempt, 'TimerState')).toBe('running')
        expect(Number(getRuntimeField(attempt, 'RemainingMs'))).toBeLessThanOrEqual(frozenSecondBlockRemainingMs)
        expect(Number(getRuntimeField(attempt, 'RemainingMs'))).toBeGreaterThan(frozenSecondBlockRemainingMs - 30_000)
        expect(getRuntimeField(attempt, 'AnsweredCount')).toBe(firstBlock.questions.length)
        expect(getRuntimeField(attempt, 'CurrentQuestionIndex')).toBe(firstBlock.questions.length)
        const secondBlockQuestion = currentQuestion(attempt, 'First question in the second block')
        expect(getRuntimeField(secondBlockQuestion, 'DisplayNumber')).toBe('2.1')
        await expect(guestPage.getByText('Вопрос 2.1', { exact: true })).toBeVisible()
        await expectTimerAdvances(guestPage, pausedTimer, 'Timer after the second paused block intro resumes')
        await expectNoPageHorizontalOverflow(guestPage, 'Resumed Sixth Muse second-block question at 390px')
        await expectNoAccessibilityViolations(guestPage, 'Resumed Sixth Muse second-block question at 390px')
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-block-2-relative-question-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const blockedTimeoutFinalizeResponsePromise = guestPage.waitForResponse(
            (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === `${pausedAttemptPath}/finalize`,
            { timeout: 30_000 }
        )
        await setGuestAssessmentAttemptDeadline(application.applicationId, pausedAttemptId, 12)
        const blockedTimeoutReloadResponsePromise = guestPage.waitForResponse(
            (response) => response.request().method() === 'GET' && new URL(response.url()).pathname === pausedAttemptPath
        )
        await guestPage.reload()
        const blockedTimeoutReloadResponse = await blockedTimeoutReloadResponsePromise
        expect(blockedTimeoutReloadResponse.status()).toBe(200)
        attempt = asRecord(await blockedTimeoutReloadResponse.json(), 'Resumed block-flow timeout attempt')
        assertPublicAssessmentAttemptState(attempt, 'Resumed block-flow timeout attempt')
        expect(getRuntimeField(attempt, 'Phase')).toBe('question')
        expect(getRuntimeField(attempt, 'TimerState')).toBe('running')
        expect(getRuntimeField(attempt, 'AnsweredCount')).toBe(firstBlock.questions.length)
        expect(getRuntimeField(attempt, 'CurrentQuestionIndex')).toBe(firstBlock.questions.length)
        const resumedBlockDeadlineAt = getRuntimeField(attempt, 'DeadlineAt')
        expect(typeof resumedBlockDeadlineAt).toBe('string')
        const resumedBlockDeadlineRemainingMs = Date.parse(String(resumedBlockDeadlineAt)) - Date.now()
        expect(resumedBlockDeadlineRemainingMs).toBeGreaterThan(0)
        expect(resumedBlockDeadlineRemainingMs).toBeLessThanOrEqual(12_000)

        const blockedTimeoutFinalizeResponse = await blockedTimeoutFinalizeResponsePromise
        expect(blockedTimeoutFinalizeResponse.status(), 'A resumed blocked attempt must finalize when its active deadline expires').toBe(
            200
        )
        const timedOutBlockAttempt = asRecord(await blockedTimeoutFinalizeResponse.json(), 'Timed-out block-flow attempt')
        assertPublicAssessmentAttemptState(timedOutBlockAttempt, 'Timed-out block-flow attempt')
        expect(getRuntimeField(timedOutBlockAttempt, 'Status')).toBe('timed_out')
        expect(getRuntimeField(timedOutBlockAttempt, 'AnsweredCount')).toBe(firstBlock.questions.length)
        expect(getRuntimeField(timedOutBlockAttempt, 'Questions')).toEqual([])
        const [timedOutBlockSnapshot, persistedBlockResponses] = await Promise.all([
            readGuestAssessmentAttemptSnapshot(application.applicationId, pausedAttemptId),
            readGuestAssessmentResponses(application.applicationId, pausedAttemptId)
        ])
        expect(persistedBlockResponses).toHaveLength(firstBlock.questions.length)
        const persistedCorrectAnswerCount = persistedBlockResponses.filter((response) => response.isCorrect).length
        expect(timedOutBlockSnapshot.status.toLowerCase()).toBe('timedout')
        expect(timedOutBlockSnapshot.finishedReason).toBe('timed_out')
        expect(timedOutBlockSnapshot.score).toBe(persistedCorrectAnswerCount)
        expect(timedOutBlockSnapshot.totalQuestions).toBe(30)
        expect(getRuntimeField(timedOutBlockAttempt, 'Result')).toMatchObject({
            score: persistedCorrectAnswerCount,
            total: 30,
            passed: false,
            finishedReason: 'timed_out'
        })
        await expect(guestPage.getByRole('heading', { name: 'Тест завершён', exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(
            guestPage.getByRole('status').filter({ hasText: `Правильных ответов: ${persistedCorrectAnswerCount} из 30` })
        ).toBeVisible()
        await expect(guestPage.getByText('Время вышло. Сохранённые ответы учтены при подсчёте результата.', { exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(guestPage.getByRole('main'), {
            label: 'Timed-out Sixth Muse block flow result',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await expectNoPageHorizontalOverflow(guestPage, 'Timed-out Sixth Muse block flow result at 390px')
        await expectNoAccessibilityViolations(guestPage, 'Timed-out Sixth Muse block flow result')
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-sixth-muse-block-2-timeout-result-ru-mobile.png'),
            fullPage: true,
            animations: 'disabled'
        })
    } finally {
        await cleanupLmsMarathonGuestFlow(resources)
    }

    if (resources.cleanupErrors.length > 0) {
        throw new AggregateError(resources.cleanupErrors, 'Cleaning up the Sixth Muse guest quiz flow failed')
    }
})
