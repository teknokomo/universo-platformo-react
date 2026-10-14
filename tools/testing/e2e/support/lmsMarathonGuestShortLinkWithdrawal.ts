import { randomBytes } from 'node:crypto'
import { expect } from '../fixtures/test'
import { requestApi, sendWithCsrf } from './backend/api-session.mjs'
import { readActiveAccessLinkSlugMatchCounts, readPublishedQuizAccessLinkTargetBySlug } from './lmsMarathonGuestShortLinkDatabase'
import {
    acceptGuestLegalConsents,
    assertPublicAssessmentAttemptState,
    getRuntimeReferenceId,
    expectCurrentAttemptQuestion,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

/** Proves that unpublishing revokes an active anonymous attempt and it cannot resume after republishing. */
export async function runLmsMarathonWithdrawalScenario(flow: LmsMarathonPreparedFlow): Promise<void> {
    const { browser, applicationId, gradeQuiz, gradeQuestionCount, shortLinkSlug, origin, publicWorkspaceId, api } = flow
    const persistedAccessLink = await readPublishedQuizAccessLinkTargetBySlug(applicationId, publicWorkspaceId, flow.accessLink.slug)
    const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'ru-RU',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 390, height: 844 }
    })

    try {
        const page = await context.newPage()
        const publicResolverResponse = await context.request.get(new URL(`/api/v1/public/l/${shortLinkSlug}`, origin).toString())
        const publicAccessLinkResponse = await context.request.get(
            new URL(
                `/api/v1/public/a/${applicationId}/links/${flow.accessLink.slug}?locale=ru&workspaceId=${encodeURIComponent(
                    flow.publicWorkspaceId
                )}`,
                origin
            ).toString()
        )
        const managedLinksResponse = await requestApi(
            api,
            `/api/v1/global-short-links?applicationId=${encodeURIComponent(applicationId)}&includeReleased=true`
        )
        const applicationResponse = await requestApi(api, `/api/v1/applications/${applicationId}`)
        const managedLinksPayload = managedLinksResponse.ok ? await managedLinksResponse.json() : null
        const managedLink = Array.isArray(managedLinksPayload?.items)
            ? managedLinksPayload.items.find((item: { slug?: unknown }) => item.slug === shortLinkSlug)
            : undefined
        const applicationPayload = applicationResponse.ok ? await applicationResponse.json() : null
        const accessLinkMatches = await readActiveAccessLinkSlugMatchCounts(applicationId, flow.accessLink.slug, flow.publicWorkspaceId)
        const initialAvailability = {
            publicResolverStatus: publicResolverResponse.status(),
            publicAccessLinkStatus: publicAccessLinkResponse.status(),
            accessLinkActiveRows: accessLinkMatches.activeRows,
            accessLinkMatchingWorkspaces: accessLinkMatches.matchingWorkspaces,
            accessLinkSelectedWorkspaceRows: accessLinkMatches.selectedWorkspaceRows,
            managedLinksStatus: managedLinksResponse.status,
            managedLinkFound: Boolean(managedLink),
            managedLinkReleased: managedLink?.releasedAt !== null,
            applicationStatus: applicationResponse.status,
            applicationIsPublic: applicationPayload?.isPublic === true
        }
        expect(
            initialAvailability,
            `The withdrawal scenario requires an active public quiz link before revocation: ${JSON.stringify(initialAvailability)}`
        ).toMatchObject({
            publicResolverStatus: 200,
            publicAccessLinkStatus: 200,
            accessLinkSelectedWorkspaceRows: 1,
            managedLinksStatus: 200,
            managedLinkFound: true,
            managedLinkReleased: false,
            applicationStatus: 200,
            applicationIsPublic: true
        })
        expect(initialAvailability.accessLinkActiveRows).toBeGreaterThan(1)
        expect(initialAvailability.accessLinkMatchingWorkspaces).toBeGreaterThan(1)

        await page.goto(new URL(`/l/${shortLinkSlug}?locale=ru`, origin).toString())
        await expect(page.getByLabel('Имя')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Имя').fill('Irina')
        const participantLastName = `Withdrawal-${randomBytes(4).toString('hex')}`
        await page.getByLabel('Фамилия').fill(participantLastName)
        await acceptGuestLegalConsents(page, 'ru')

        const guestSessionResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return response.request().method() === 'POST' && responseUrl.pathname === `/api/v1/public/a/${applicationId}/guest-session`
        })
        const startResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return (
                response.request().method() === 'POST' &&
                responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
            )
        })
        await page.getByRole('button', { name: 'Начать обучение' }).click()
        const guestSessionResponse = await guestSessionResponsePromise
        expect(guestSessionResponse.status()).toBe(201)
        const guestSession = await guestSessionResponse.json()
        expect(guestSession).toMatchObject({ participantId: expect.any(String), sessionToken: expect.any(String) })
        const startResponse = await startResponsePromise
        expect(startResponse.status()).toBe(200)
        const attempt = await startResponse.json()
        assertPublicAssessmentAttemptState(attempt, 'withdrawal test attempt start response')
        expect(attempt).toMatchObject({ attemptNumber: 1, status: 'in_progress' })
        expect(Date.parse(attempt.deadlineAt) - Date.parse(attempt.startedAt)).toBe(45 * 60 * 1000)
        const question = expectCurrentAttemptQuestion(
            attempt,
            gradeQuiz.questions[0]!,
            0,
            gradeQuestionCount,
            'ru',
            'withdrawal attempt start'
        )
        const correctOption = gradeQuiz.questions[0]?.options.find((option) => option.isCorrect)
        const correctRuntimeOption = runtimeRecords(getRuntimeField(question ?? {}, 'Options')).find(
            (option) => getRuntimeField(option, 'Id') === correctOption?.id
        )
        const questionId = getRuntimeField(question ?? {}, 'Id')
        const correctOptionId = getRuntimeField(correctRuntimeOption ?? {}, 'Id')
        const questionPrompt = readLocalizedText(getRuntimeField(question ?? {}, 'Prompt'), 'ru')
        const correctLabel = readLocalizedText(
            getRuntimeField(correctRuntimeOption ?? {}, 'Label') ?? getRuntimeField(correctRuntimeOption ?? {}, 'Text'),
            'ru'
        )
        if (
            typeof questionId !== 'string' ||
            typeof correctOptionId !== 'string' ||
            !questionPrompt ||
            !correctLabel ||
            correctOptionId !== correctOption?.id
        ) {
            throw new Error('The withdrawal test could not resolve the first question and its approved answer')
        }

        await expect(page.getByRole('heading', { name: questionPrompt, exact: true })).toBeVisible()
        const correctAnswer = page.getByRole('radiogroup').getByRole('radio', { name: correctLabel, exact: true })
        const savedAttempt = await selectGuestQuizAnswer({
            page,
            applicationId,
            attemptId: attempt.attemptId,
            option: correctAnswer,
            label: 'withdrawal test saved answer'
        })
        expectCurrentAttemptQuestion(savedAttempt, gradeQuiz.questions[1]!, 1, gradeQuestionCount, 'ru', 'withdrawal next question')
        await expect(page.getByText(`Вопрос 2 из ${gradeQuestionCount}`, { exact: true })).toBeVisible()

        const withdrawalResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, { isPublic: false })
        expect(withdrawalResponse.status, 'The owner must be able to withdraw public access').toBe(200)
        expect(await withdrawalResponse.json()).toMatchObject({ id: applicationId, isPublic: false })

        const unavailableAccessLink = await context.request.get(
            new URL(
                `/api/v1/public/a/${applicationId}/links/${flow.accessLink.slug}?locale=ru&workspaceId=${encodeURIComponent(
                    flow.publicWorkspaceId
                )}`,
                origin
            ).toString()
        )
        expect(unavailableAccessLink.status(), 'Unpublished applications must reject anonymous access').toBe(404)
        const unavailableShortLink = await context.request.get(new URL(`/api/v1/public/l/${shortLinkSlug}`, origin).toString())
        expect(unavailableShortLink.status(), 'Unpublishing must disable the global short-link resolver').toBe(404)

        const unavailableQuizRuntime = await context.request.get(
            new URL(
                `/api/v1/public/a/${applicationId}/runtime?slug=${encodeURIComponent(
                    shortLinkSlug
                )}&targetType=quiz&targetId=${encodeURIComponent(persistedAccessLink.targetId)}&locale=ru`,
                origin
            ).toString()
        )
        expect(unavailableQuizRuntime.status(), 'Unpublished applications must reject anonymous quiz runtime reads').toBe(404)

        const publicCsrfResponse = await context.request.get(new URL('/api/v1/auth/csrf', origin).toString())
        expect(publicCsrfResponse.status(), 'Anonymous session creation must use the public CSRF flow').toBe(200)
        const publicCsrfPayload = await publicCsrfResponse.json()
        expect(publicCsrfPayload.csrfToken).toEqual(expect.any(String))
        const unavailableGuestIntake = await context.request.post(
            new URL(`/api/v1/public/a/${applicationId}/guest-session`, origin).toString(),
            {
                headers: { 'x-csrf-token': publicCsrfPayload.csrfToken },
                data: {
                    accessLinkId: persistedAccessLink.id,
                    workspaceId: flow.publicWorkspaceId,
                    firstName: 'Late',
                    lastName: 'Guest',
                    termsAccepted: true,
                    privacyAccepted: true
                }
            }
        )
        expect(unavailableGuestIntake.status(), 'Unpublished applications must reject new guest sessions').toBe(404)

        const republishResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, { isPublic: true })
        expect(republishResponse.status, 'The owner must be able to republish the application').toBe(200)
        expect(await republishResponse.json()).toMatchObject({ id: applicationId, isPublic: true })
        const availableShortLink = await context.request.get(new URL(`/api/v1/public/l/${shortLinkSlug}`, origin).toString())
        expect(availableShortLink.status(), 'Republishing must restore the global short-link resolver').toBe(200)
        expect(await availableShortLink.json()).toEqual({
            target: {
                kind: 'lms-access-link',
                applicationId,
                accessLinkId: persistedAccessLink.id,
                accessLinkSlug: flow.accessLink.slug,
                workspaceId: publicWorkspaceId
            }
        })

        const revokedSessionHeaders = {
            'x-guest-participant-id': guestSession.participantId,
            'x-guest-session-token': guestSession.sessionToken,
            'x-csrf-token': publicCsrfPayload.csrfToken
        }
        const resumedAttemptResponse = await context.request.get(
            new URL(`/api/v1/public/a/${applicationId}/runtime/attempts/${attempt.attemptId}`, origin).toString(),
            { headers: revokedSessionHeaders }
        )
        expect(resumedAttemptResponse.status(), 'A guest session revoked by withdrawal must not resume after republishing').toBe(403)

        const staleSessionStartResponse = await context.request.post(
            new URL(`/api/v1/public/a/${applicationId}/runtime/attempts/start`, origin).toString(),
            {
                headers: revokedSessionHeaders,
                data: {
                    participantId: guestSession.participantId,
                    sessionToken: guestSession.sessionToken,
                    assessmentId: persistedAccessLink.targetId
                }
            }
        )
        expect(staleSessionStartResponse.status(), 'A revoked guest token must not create another attempt after republishing').toBe(403)

        const reportResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect(reportResponse.status, 'Revoked attempt results must remain visible to authorized report readers').toBe(200)
        const reportPayload = await reportResponse.json()
        const reportRow = runtimeRecords(reportPayload.rows).find(
            (row) => getRuntimeReferenceId(getRuntimeField(row, 'StudentId')) === guestSession.participantId
        )
        expect(reportRow).toBeTruthy()
        expect(Number(getRuntimeField(reportRow ?? {}, 'Score'))).toBe(1)
        expect(Number(getRuntimeField(reportRow ?? {}, 'TotalQuestions'))).toBe(gradeQuestionCount)
        expect(readLocalizedText(getRuntimeField(reportRow ?? {}, 'Status'))).toBe('Revoked')
    } finally {
        await context.close()
    }
}
