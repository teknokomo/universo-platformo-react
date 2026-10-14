import { randomBytes } from 'node:crypto'
import { expect } from '../fixtures/test'
import { sendWithCsrf } from './backend/api-session.mjs'
import { entityDialogSelectors } from './selectors/contracts'
import {
    acceptGuestLegalConsents,
    assertPublicAssessmentAttemptState,
    getRuntimeReferenceId,
    getRuntimeField,
    expectCurrentAttemptQuestion,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import { readGuestAssessmentResponses, readPublishedQuizAccessLinkTargetBySlug } from './lmsMarathonGuestShortLinkDatabase'
import { expectNoPageHorizontalOverflow } from './browser/runtimeUx'
import { expectNoAccessibilityViolations } from './lmsMarathonGuestShortLinkAssertions'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

const setAccessLinkActive = async (flow: LmsMarathonPreparedFlow, active: boolean): Promise<void> => {
    const { page, applicationId, publicWorkspaceId, accessLink } = flow
    await readPublishedQuizAccessLinkTargetBySlug(applicationId, publicWorkspaceId, accessLink.slug)

    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    await page.getByRole('link', { name: 'Content Projects', exact: true }).click()
    await page.getByRole('tab', { name: 'Guest links', exact: true }).click()

    const relationBuilder = page.getByTestId('runtime-relation-builder')
    await expect(relationBuilder, 'The owner must manage AccessLinks in the workspace relation builder').toBeVisible({ timeout: 30_000 })
    await relationBuilder.getByRole('tab', { name: flow.gradeQuiz.title.en, exact: true }).click()
    const accessLinkRow = relationBuilder.getByRole('row').filter({ hasText: accessLink.title.en })
    await expect(accessLinkRow, 'The selected quiz must list its own guest access link').toBeVisible()
    await accessLinkRow.getByRole('button', { name: `Actions for ${accessLink.title.en}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()

    const editDialog = page.getByRole('dialog', { name: 'Edit element', exact: true })
    await expect(editDialog, 'The standard AccessLink editor must open from the relation builder').toBeVisible()
    const activeCheckbox = editDialog.getByRole('checkbox', { name: 'Is Active', exact: true })
    await expect(activeCheckbox).toBeChecked({ checked: !active })
    if (active) await activeCheckbox.check()
    else await activeCheckbox.uncheck()

    const updateResponsePromise = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return (
            response.request().method() === 'PATCH' &&
            responseUrl.pathname.startsWith(`/api/v1/applications/${applicationId}/runtime/rows/rh1.`) &&
            responseUrl.searchParams.get('workspaceId') === publicWorkspaceId
        )
    })
    const runtimeRefreshResponsePromise = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return (
            response.request().method() === 'GET' &&
            responseUrl.pathname === `/api/v1/applications/${applicationId}/runtime` &&
            responseUrl.searchParams.get('workspaceId') === publicWorkspaceId
        )
    })
    await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
    const updateResponse = await updateResponsePromise
    expect(updateResponse.ok(), `The owner must be able to set AccessLink IsActive=${active}`).toBe(true)
    const runtimeRefreshResponse = await runtimeRefreshResponsePromise
    expect(runtimeRefreshResponse.status(), 'The owner runtime must refresh after updating a quiz access link').toBe(200)
    await expect(editDialog).toHaveCount(0, { timeout: 30_000 })
}

/** Proves that disabling a quiz AccessLink finalizes active work and stays revoked after re-enabling the link. */
export async function runLmsMarathonAccessLinkRevocationScenario(flow: LmsMarathonPreparedFlow): Promise<void> {
    const {
        browser,
        applicationId,
        origin,
        shortLinkSlug,
        publicWorkspaceId,
        gradeQuiz,
        gradeQuestionCount,
        api,
        accessLink,
        page,
        testInfo
    } = flow
    const persistedAccessLink = await readPublishedQuizAccessLinkTargetBySlug(applicationId, publicWorkspaceId, accessLink.slug)
    const participantName = `AccessLink-Revoke-${randomBytes(4).toString('hex')}`
    const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 390, height: 844 }
    })

    try {
        const guestPage = await context.newPage()
        await guestPage.goto(new URL(`/l/${shortLinkSlug}?locale=en`, origin).toString())
        await expect(guestPage.getByLabel('First name')).toBeVisible({ timeout: 30_000 })
        await guestPage.getByLabel('First name').fill('E2E')
        await guestPage.getByLabel('Last name').fill(participantName)
        await acceptGuestLegalConsents(guestPage, 'en')

        const guestSessionResponsePromise = guestPage.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
        })
        const attemptStartResponsePromise = guestPage.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return (
                response.request().method() === 'POST' &&
                responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
            )
        })
        await guestPage.getByRole('button', { name: 'Start learning', exact: true }).click()
        const guestSessionResponse = await guestSessionResponsePromise
        expect(guestSessionResponse.status(), 'The anonymous guest must receive a link-bound session').toBe(201)
        const guestSession = await guestSessionResponse.json()
        expect(guestSession).toMatchObject({ participantId: expect.any(String), sessionToken: expect.any(String) })

        const attemptStartResponse = await attemptStartResponsePromise
        expect(attemptStartResponse.status(), 'The guest session must start its published quiz').toBe(200)
        const attempt = await attemptStartResponse.json()
        assertPublicAssessmentAttemptState(attempt, 'AccessLink revocation attempt start response')
        expect(attempt).toMatchObject({ attemptNumber: 1, status: 'in_progress' })
        expect(Date.parse(attempt.deadlineAt) - Date.parse(attempt.startedAt)).toBe(45 * 60 * 1000)
        const approvedQuestion = gradeQuiz.questions[0]
        const firstQuestion = expectCurrentAttemptQuestion(
            attempt,
            approvedQuestion!,
            0,
            gradeQuestionCount,
            'en',
            'AccessLink revocation attempt start'
        )
        const approvedOption = approvedQuestion?.options.find((option) => option.isCorrect)
        const runtimeCorrectOption = runtimeRecords(getRuntimeField(firstQuestion ?? {}, 'Options')).find(
            (option) => getRuntimeField(option, 'Id') === approvedOption?.id
        )
        const questionId = getRuntimeField(firstQuestion ?? {}, 'Id')
        const correctOptionId = getRuntimeField(runtimeCorrectOption ?? {}, 'Id')
        const questionPrompt = readLocalizedText(getRuntimeField(firstQuestion ?? {}, 'Prompt'), 'en')
        const correctLabel = readLocalizedText(
            getRuntimeField(runtimeCorrectOption ?? {}, 'Label') ?? getRuntimeField(runtimeCorrectOption ?? {}, 'Text'),
            'en'
        )
        if (
            typeof questionId !== 'string' ||
            typeof correctOptionId !== 'string' ||
            correctOptionId !== approvedOption?.id ||
            !questionPrompt ||
            !correctLabel
        ) {
            throw new Error('The AccessLink revocation test could not resolve the approved first answer')
        }

        await expect(guestPage.getByRole('heading', { name: questionPrompt, exact: true })).toBeVisible()
        const correctAnswer = guestPage.getByRole('radiogroup').getByRole('radio', { name: correctLabel, exact: true })
        const savedAttempt = await selectGuestQuizAnswer({
            page: guestPage,
            applicationId,
            attemptId: attempt.attemptId,
            option: correctAnswer,
            label: 'AccessLink revocation saved answer'
        })
        expectCurrentAttemptQuestion(
            savedAttempt,
            gradeQuiz.questions[1]!,
            1,
            gradeQuestionCount,
            'en',
            'AccessLink revocation next question'
        )
        await expect(guestPage.getByText(`Question 2 of ${gradeQuestionCount}`, { exact: true })).toBeVisible()
        await expectNoPageHorizontalOverflow(guestPage, 'LMS quiz while an anonymous attempt is active')
        await expectNoAccessibilityViolations(guestPage, 'LMS quiz while an anonymous attempt is active')
        await guestPage.screenshot({
            path: testInfo.outputPath('lms-marathon-active-attempt-before-access-link-revocation.png'),
            fullPage: true,
            animations: 'disabled'
        })

        await setAccessLinkActive(flow, false)
        const unavailableLinkResponse = await context.request.get(
            new URL(
                `/api/v1/public/a/${applicationId}/links/${accessLink.slug}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
                origin
            ).toString()
        )
        expect(unavailableLinkResponse.status(), 'A disabled quiz link must reject public access immediately').toBe(403)
        const unavailableShortLinkResponse = await context.request.get(new URL(`/api/v1/public/l/${shortLinkSlug}`, origin).toString())
        expect(unavailableShortLinkResponse.status(), 'A short link to a disabled quiz must stop resolving').toBe(404)

        await setAccessLinkActive(flow, true)
        const availableAgainResponse = await context.request.get(
            new URL(
                `/api/v1/public/a/${applicationId}/links/${accessLink.slug}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
                origin
            ).toString()
        )
        expect(availableAgainResponse.status(), 'The owner must be able to re-enable the public quiz link').toBe(200)
        const availableShortLinkResponse = await context.request.get(new URL(`/api/v1/public/l/${shortLinkSlug}`, origin).toString())
        expect(availableShortLinkResponse.status(), 'A short link must resolve again after quiz access is restored').toBe(200)
        expect(await availableShortLinkResponse.json()).toEqual({
            target: {
                kind: 'lms-access-link',
                applicationId,
                accessLinkId: persistedAccessLink.id,
                accessLinkSlug: accessLink.slug,
                workspaceId: publicWorkspaceId
            }
        })
        await expectNoPageHorizontalOverflow(page, 'LMS access-link management after re-enabling')
        await expectNoAccessibilityViolations(page, 'LMS access-link management after re-enabling')
        await page.screenshot({
            path: testInfo.outputPath('lms-marathon-access-link-reenabled.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const publicCsrfResponse = await context.request.get(new URL('/api/v1/auth/csrf', origin).toString())
        expect(publicCsrfResponse.status()).toBe(200)
        const publicCsrfPayload = await publicCsrfResponse.json()
        const staleSessionHeaders = {
            'x-guest-participant-id': guestSession.participantId,
            'x-guest-session-token': guestSession.sessionToken,
            'x-csrf-token': publicCsrfPayload.csrfToken
        }
        const resumedAttemptResponse = await context.request.get(
            new URL(`/api/v1/public/a/${applicationId}/runtime/attempts/${attempt.attemptId}`, origin).toString(),
            { headers: staleSessionHeaders }
        )
        expect(resumedAttemptResponse.status(), 'Re-enabling a link must not revive a previously issued session token').toBe(403)

        const staleAttemptStartResponse = await context.request.post(
            new URL(`/api/v1/public/a/${applicationId}/runtime/attempts/start`, origin).toString(),
            {
                headers: staleSessionHeaders,
                data: {
                    participantId: guestSession.participantId,
                    sessionToken: guestSession.sessionToken,
                    assessmentId: persistedAccessLink.targetId
                }
            }
        )
        expect(staleAttemptStartResponse.status(), 'A revoked token must not start another attempt after the link is re-enabled').toBe(403)

        const reenabledContext = await browser.newContext({
            storageState: { cookies: [], origins: [] },
            locale: 'en-US',
            timezoneId: 'UTC',
            colorScheme: 'light',
            reducedMotion: 'reduce',
            viewport: { width: 390, height: 844 }
        })
        try {
            const reenabledPage = await reenabledContext.newPage()
            await reenabledPage.goto(new URL(`/l/${shortLinkSlug}?locale=en`, origin).toString())
            await expect(reenabledPage.getByLabel('First name')).toBeVisible({ timeout: 30_000 })
            await reenabledPage.getByLabel('First name').fill('E2E Re-enabled')
            await reenabledPage.getByLabel('Last name').fill(`Fresh-${participantName}`)
            await reenabledPage.getByRole('checkbox', { name: /Terms of Service/u }).check()
            await reenabledPage.getByRole('checkbox', { name: /Privacy Policy/u }).check()
            const freshSessionResponsePromise = reenabledPage.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
            })
            const freshAttemptResponsePromise = reenabledPage.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return (
                    response.request().method() === 'POST' &&
                    responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
                )
            })
            await reenabledPage.getByRole('button', { name: 'Start learning', exact: true }).click()
            const freshSessionResponse = await freshSessionResponsePromise
            expect(freshSessionResponse.status(), 'A new guest must be able to create a session after the owner re-enables the link').toBe(
                201
            )
            const freshSession = await freshSessionResponse.json()
            expect(freshSession.participantId).not.toBe(guestSession.participantId)
            const freshAttemptResponse = await freshAttemptResponsePromise
            expect(freshAttemptResponse.status(), 'A newly issued session must start a fresh attempt after link re-enablement').toBe(200)
            const freshAttempt = await freshAttemptResponse.json()
            assertPublicAssessmentAttemptState(freshAttempt, 'fresh attempt after AccessLink re-enablement')
            expect(freshAttempt).toMatchObject({ attemptNumber: 1, status: 'in_progress' })
            const freshQuestion = expectCurrentAttemptQuestion(
                freshAttempt,
                gradeQuiz.questions[0]!,
                0,
                gradeQuestionCount,
                'en',
                'fresh attempt after AccessLink re-enablement'
            )
            const freshPrompt = readLocalizedText(getRuntimeField(freshQuestion, 'Prompt'), 'en')
            if (!freshPrompt) throw new Error('The re-enabled quiz has no first question prompt')
            await expect(reenabledPage.getByRole('heading', { name: freshPrompt, exact: true })).toBeVisible()
            await expectNoPageHorizontalOverflow(reenabledPage, 'Fresh guest attempt after AccessLink re-enablement')
            await expectNoAccessibilityViolations(reenabledPage, 'Fresh guest attempt after AccessLink re-enablement')
            await reenabledPage.screenshot({
                path: testInfo.outputPath('lms-marathon-reenabled-link-fresh-guest-attempt.png'),
                fullPage: true,
                animations: 'disabled'
            })
        } finally {
            await reenabledContext.close()
        }

        const nextQuestion = runtimeRecords(getRuntimeField(runtimeRecords(savedAttempt.questions)[0] ?? {}, 'Options'))[0]
        const nextOptionId = getRuntimeField(nextQuestion ?? {}, 'Id')
        const nextOptionLabel = readLocalizedText(
            getRuntimeField(nextQuestion ?? {}, 'Label') ?? getRuntimeField(nextQuestion ?? {}, 'Text'),
            'en'
        )
        if (typeof nextOptionId !== 'string' || !nextOptionLabel) throw new Error('The second question has no selectable answer option')
        const staleAnswer = guestPage.getByRole('radio', { name: nextOptionLabel, exact: true })
        const staleAnswerResponsePromise = guestPage.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return (
                response.request().method() === 'PUT' &&
                responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/${attempt.attemptId}/answers`
            )
        })
        await staleAnswer.check()
        const staleAnswerResponse = await staleAnswerResponsePromise
        expect(staleAnswerResponse.status(), 'The original browser must not submit more answers after its session is revoked').toBe(403)
        await expect(
            guestPage.getByRole('status').filter({
                hasText: 'Your access to this quiz has ended. No further answers can be saved.'
            })
        ).toBeVisible()
        await expect(guestPage.getByRole('heading', { name: questionPrompt, exact: true })).toHaveCount(0)
        await expect(guestPage.getByRole('button', { name: 'Retry saving answer', exact: true })).toHaveCount(0)

        const reportResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect(reportResponse.status, 'The authorized report must retain the revoked attempt result').toBe(200)
        const reportPayload = await reportResponse.json()
        const reportRow = runtimeRecords(reportPayload.rows).find(
            (row) => getRuntimeReferenceId(getRuntimeField(row, 'StudentId')) === guestSession.participantId
        )
        expect(reportRow, 'The revoked attempt must remain in the authorized workspace report').toBeTruthy()
        expect(Number(getRuntimeField(reportRow ?? {}, 'Score'))).toBe(1)
        expect(Number(getRuntimeField(reportRow ?? {}, 'TotalQuestions'))).toBe(gradeQuestionCount)
        expect(readLocalizedText(getRuntimeField(reportRow ?? {}, 'Status'))).toBe('Revoked')

        const persistedResponses = await readGuestAssessmentResponses(applicationId, attempt.attemptId)
        expect(persistedResponses, 'Manual link revocation must preserve saved answer records').toEqual([
            { questionId, selectedOptionIds: [correctOptionId], isCorrect: true }
        ])
    } finally {
        await context.close()
    }
}
