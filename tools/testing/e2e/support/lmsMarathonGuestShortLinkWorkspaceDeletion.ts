import { expect } from '../fixtures/test'
import { sendWithCsrf } from './backend/api-session.mjs'
import { readGuestAssessmentAttemptSnapshot, readGuestAssessmentResponses } from './lmsMarathonGuestShortLinkDatabase'
import {
    acceptGuestLegalConsents,
    assertPublicAssessmentAttemptState,
    expectCurrentAttemptQuestion,
    getRuntimeField,
    readLocalizedText,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

/** Verifies that deleting a public workspace revokes persisted guest work before its rows are archived. */
export async function runLmsMarathonWorkspaceDeletionScenario(flow: LmsMarathonPreparedFlow): Promise<void> {
    const { browser, api, applicationId, publicWorkspaceId, origin, shortLinkSlug, gradeQuiz, gradeQuestionCount, testInfo, resources } =
        flow
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
        await page.goto(new URL(`/l/${shortLinkSlug}?locale=ru`, origin).toString())
        await page.getByLabel('Имя').fill('E2E')
        await page.getByLabel('Фамилия').fill(`Workspace-delete-${Date.now()}`)
        await acceptGuestLegalConsents(page, 'ru')

        const startResponsePromise = page.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return (
                response.request().method() === 'POST' &&
                responseUrl.pathname === `/api/v1/public/a/${applicationId}/runtime/attempts/start`
            )
        })
        await page.getByRole('button', { name: 'Начать обучение' }).click()
        const startResponse = await startResponsePromise
        expect(startResponse.status()).toBe(200)
        const attempt = await startResponse.json()
        assertPublicAssessmentAttemptState(attempt, 'workspace deletion attempt start response')
        expect(attempt).toMatchObject({ attemptNumber: 1, status: 'in_progress' })
        const firstQuestion = gradeQuiz.questions[0]
        const correctOption = firstQuestion?.options.find((option) => option.isCorrect)
        const prompt = readLocalizedText(firstQuestion?.prompt, 'ru')
        const correctLabel = readLocalizedText(correctOption?.text, 'ru')
        const runtimeQuestion = expectCurrentAttemptQuestion(
            attempt,
            firstQuestion!,
            0,
            gradeQuestionCount,
            'ru',
            'workspace deletion attempt start'
        )
        const questionId = getRuntimeField(runtimeQuestion ?? {}, 'Id')
        if (!prompt || !correctLabel || typeof questionId !== 'string' || !correctOption) {
            throw new Error('The workspace deletion scenario could not resolve the approved first question and answer')
        }

        await expect(page.getByRole('heading', { name: prompt, exact: true })).toBeVisible()
        const correctAnswer = page.getByRole('radiogroup').getByRole('radio', { name: correctLabel, exact: true })
        const savedAttempt = await selectGuestQuizAnswer({
            page,
            applicationId,
            attemptId: attempt.attemptId,
            option: correctAnswer,
            label: 'workspace deletion saved answer'
        })
        expectCurrentAttemptQuestion(savedAttempt, gradeQuiz.questions[1]!, 1, gradeQuestionCount, 'ru', 'workspace deletion next question')
        await expect(page.getByText(`Вопрос 2 из ${gradeQuestionCount}`, { exact: true })).toBeVisible()

        const credentials = await page.evaluate(
            ({ applicationId: appId, workspaceId }) => {
                const prefix = `apps-template-mui:guest-session:${appId}:`
                for (let index = 0; index < window.sessionStorage.length; index += 1) {
                    const key = window.sessionStorage.key(index)
                    if (!key?.startsWith(prefix) || !key.endsWith(`:${workspaceId}`)) continue

                    try {
                        const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null') as {
                            participantId?: unknown
                            sessionToken?: unknown
                        } | null
                        if (typeof value?.participantId === 'string' && typeof value.sessionToken === 'string') return value
                    } catch {
                        continue
                    }
                }
                return null
            },
            { applicationId, workspaceId: publicWorkspaceId }
        )
        expect(typeof credentials?.participantId).toBe('string')
        expect(typeof credentials?.sessionToken).toBe('string')

        const deleteResponse = await sendWithCsrf(
            api,
            'DELETE',
            `/api/v1/applications/${applicationId}/runtime/workspaces/${publicWorkspaceId}`
        )
        expect(deleteResponse.status, 'The authorized workspace owner must be able to delete the shared workspace').toBe(200)

        const archivedShortLink = flow.gradeShortLinks.find(({ slug }) => slug === shortLinkSlug)
        if (!archivedShortLink) throw new Error('The archived workspace short link is missing from the prepared E2E fixture')
        const oldAliasResponse = await context.request.get(new URL(`/api/v1/public/l/${shortLinkSlug}`, origin).toString())
        expect(oldAliasResponse.status(), 'Archiving the workspace must disable its old short-link URL').toBe(404)

        await expect(readGuestAssessmentAttemptSnapshot(applicationId, attempt.attemptId)).resolves.toEqual({
            studentId: credentials.participantId,
            status: 'Revoked',
            finishedReason: 'revoked',
            score: 1,
            totalQuestions: gradeQuestionCount,
            uplDeleted: true,
            appDeleted: true
        })
        await expect(readGuestAssessmentResponses(applicationId, attempt.attemptId, true)).resolves.toEqual([
            { questionId, selectedOptionIds: [correctOption.id], isCorrect: true }
        ])

        const resumedAttemptResponse = await context.request.get(
            new URL(`/api/v1/public/a/${applicationId}/runtime/attempts/${attempt.attemptId}?locale=ru`, origin).toString(),
            {
                headers: {
                    'X-Guest-Participant-Id': credentials.participantId,
                    'X-Guest-Session-Token': credentials.sessionToken
                }
            }
        )
        expect(resumedAttemptResponse.status(), 'An archived workspace must not allow a guest session to resume').toBe(403)
        expect(await resumedAttemptResponse.json()).toEqual({ error: 'Guest session is invalid or expired' })

        const reportResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect([403, 404], 'Deleting a workspace must also remove it from active report scope').toContain(reportResponse.status)
        expect(await reportResponse.text()).not.toContain('"rows"')

        await page.reload()
        await expect(page.getByRole('button', { name: /сохранить ответ|завершить тест/i })).toHaveCount(0)
        const unavailableAlert = page.getByRole('alert').filter({ hasText: /не найдена|недоступна|не активна/i })
        await expect(unavailableAlert, 'A revoked quiz link must show a clear localized unavailable state').toBeVisible({ timeout: 30_000 })
        await page.screenshot({
            path: testInfo.outputPath('lms-marathon-deleted-workspace-unavailable-mobile-ru.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const unavailableResourceAliasResponse = await sendWithCsrf(api, 'POST', '/api/v1/global-short-links', {
            slug: shortLinkSlug,
            target: {
                kind: 'application-resource',
                applicationId,
                targetKind: 'page',
                entityTypeCodename: 'LearnerHome'
            }
        })
        expect(unavailableResourceAliasResponse.status, 'An archived public entry workspace must make its page unavailable').toBe(422)
        expect(await unavailableResourceAliasResponse.json()).toEqual({ code: 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE' })

        const replacementAliasResponse = await sendWithCsrf(api, 'POST', '/api/v1/global-short-links', {
            slug: shortLinkSlug,
            target: { kind: 'application-entry', applicationId }
        })
        const replacementAliasPayload = await replacementAliasResponse.json()
        expect(
            replacementAliasResponse.status,
            `The released slug must be available for a new alias; received ${JSON.stringify(replacementAliasPayload)}`
        ).toBe(201)
        const replacementAlias = replacementAliasPayload
        if (typeof replacementAlias.id !== 'string') {
            throw new Error('Recreating the archived slug did not return the new global short-link id')
        }
        expect(replacementAlias.id, 'Recreating the same slug must create a new alias record').not.toBe(archivedShortLink.id)
        resources.createdGlobalShortLinkIds ??= []
        resources.createdGlobalShortLinkIds.push(replacementAlias.id)

        const replacementResolveResponse = await context.request.get(new URL(`/api/v1/public/l/${shortLinkSlug}`, origin).toString())
        expect(replacementResolveResponse.status(), 'The recreated alias must resolve successfully').toBe(200)
        expect(await replacementResolveResponse.json()).toEqual({
            target: {
                kind: 'application-entry',
                applicationId
            }
        })
    } finally {
        await context.close()
    }
}
