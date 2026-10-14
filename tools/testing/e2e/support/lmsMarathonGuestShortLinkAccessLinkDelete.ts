import { randomBytes } from 'node:crypto'
import { expect } from '../fixtures/test'
import { sendWithCsrf } from './backend/api-session.mjs'
import { confirmDeleteSelectors } from './selectors/contracts'
import {
    assertPublicAssessmentAttemptState,
    getRuntimeReferenceId,
    expectNoAccessibilityViolations,
    expectCurrentAttemptQuestion,
    getRuntimeField,
    readLocalizedText,
    runtimeRecords,
    selectGuestQuizAnswer
} from './lmsMarathonGuestShortLinkAssertions'
import {
    readAccessLinkDeletionLifecycle,
    readActiveAccessLinkSlugMatchCounts,
    readGuestAssessmentResponses,
    readPublishedQuizAccessLinkTargetBySlug
} from './lmsMarathonGuestShortLinkDatabase'
import { expectDataGridCellTextByColumn, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from './browser/runtimeUx'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

const deleteAccessLinkFromOwnerPage = async (flow: LmsMarathonPreparedFlow): Promise<void> => {
    const { page, applicationId, publicWorkspaceId, gradeTenAccessLink, gradeTenQuiz } = flow
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    await page.getByRole('link', { name: 'Content Projects', exact: true }).click()
    await page.getByRole('tab', { name: 'Guest links', exact: true }).click()

    const relationBuilder = page.getByTestId('runtime-relation-builder')
    await expect(relationBuilder, 'The owner must manage the grade 10 AccessLink').toBeVisible({ timeout: 30_000 })
    await relationBuilder.getByRole('tab', { name: gradeTenQuiz.title.en, exact: true }).click()
    const accessLinkRow = relationBuilder.getByRole('row').filter({ hasText: gradeTenAccessLink.title.en })
    await expect(accessLinkRow, 'The grade 10 quiz must list its own guest AccessLink').toBeVisible()
    await accessLinkRow.getByRole('button', { name: `Actions for ${gradeTenAccessLink.title.en}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()

    const deleteDialog = page.getByRole('dialog')
    await expect(deleteDialog, 'Deleting an AccessLink must require an explicit confirmation').toBeVisible()
    await expect(deleteDialog.getByTestId(confirmDeleteSelectors.cancelButton)).toBeVisible()
    await expect(deleteDialog.getByTestId(confirmDeleteSelectors.confirmButton)).toBeVisible()
    await expectNoTechnicalLeakage(deleteDialog, { label: 'AccessLink deletion confirmation', checkUuidSubstrings: true })
    await expectNoAccessibilityViolations(page, 'AccessLink deletion confirmation')
    const deleteResponsePromise = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url())
        return (
            response.request().method() === 'DELETE' &&
            responseUrl.pathname.startsWith(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            responseUrl.searchParams.get('workspaceId') === publicWorkspaceId
        )
    })
    await deleteDialog.getByTestId(confirmDeleteSelectors.confirmButton).click()
    const deleteResponse = await deleteResponsePromise
    expect(deleteResponse.status(), 'The authorized owner must be able to delete the grade 10 AccessLink').toBe(200)
    await expect(deleteDialog).toHaveCount(0)
    await expect(accessLinkRow).toHaveCount(0)
}

/** Proves deleting an AccessLink atomically revokes an active attempt and its bearer session. */
export async function runLmsMarathonAccessLinkDeleteScenario(flow: LmsMarathonPreparedFlow): Promise<void> {
    const {
        browser,
        applicationId,
        origin,
        publicWorkspaceId,
        gradeTenAccessLink,
        gradeTenQuiz,
        gradeTenShortLinkSlug,
        gradeQuestionCount,
        api,
        page,
        testInfo
    } = flow
    const persistedAccessLink = await readPublishedQuizAccessLinkTargetBySlug(applicationId, publicWorkspaceId, gradeTenAccessLink.slug)
    const workspaceMatchesBefore = await readActiveAccessLinkSlugMatchCounts(applicationId, gradeTenAccessLink.slug, publicWorkspaceId)
    expect(workspaceMatchesBefore.selectedWorkspaceRows).toBe(1)
    const siblingWorkspaceId = workspaceMatchesBefore.matchingWorkspaceIds.find((workspaceId) => workspaceId !== publicWorkspaceId)
    if (!siblingWorkspaceId) throw new Error('The grade 10 AccessLink has no duplicate in a sibling workspace')
    const siblingAccessLink = await readPublishedQuizAccessLinkTargetBySlug(applicationId, siblingWorkspaceId, gradeTenAccessLink.slug)
    const participantName = `E2E-Delete-Grade-10-${randomBytes(4).toString('hex')}`
    const siblingPublicLinkUrl = new URL(
        `/api/v1/public/a/${applicationId}/links/${gradeTenAccessLink.slug}?locale=en&workspaceId=${encodeURIComponent(
            siblingWorkspaceId
        )}`,
        origin
    ).toString()
    const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        viewport: { width: 390, height: 844 }
    })

    try {
        const siblingAccessLinkBeforeDelete = await context.request.get(siblingPublicLinkUrl)
        expect([200, 404]).toContain(siblingAccessLinkBeforeDelete.status())
        const siblingAccessLinkBeforeDeletePayload = siblingAccessLinkBeforeDelete.ok() ? await siblingAccessLinkBeforeDelete.json() : null
        const guestPage = await context.newPage()
        await guestPage.goto(new URL(`/l/${gradeTenShortLinkSlug}?locale=en`, origin).toString())
        await expect(guestPage.getByLabel('First name')).toBeVisible({ timeout: 30_000 })
        await guestPage.getByLabel('First name').fill('E2E')
        await guestPage.getByLabel('Last name').fill(participantName)
        await guestPage.getByRole('checkbox', { name: /Terms of Service/u }).check()
        await guestPage.getByRole('checkbox', { name: /Privacy Policy/u }).check()

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
        expect(guestSessionResponse.status(), 'A guest must receive a session for the grade 10 quiz').toBe(201)
        const guestSession = await guestSessionResponse.json()
        const participantId = guestSession.participantId
        if (typeof participantId !== 'string') throw new Error('The grade 10 guest session omitted its participant identity')
        const attemptStartResponse = await attemptStartResponsePromise
        expect(attemptStartResponse.status(), 'The grade 10 guest session must start an attempt').toBe(200)
        const attempt = await attemptStartResponse.json()
        assertPublicAssessmentAttemptState(attempt, 'grade 10 AccessLink delete attempt')
        expect(attempt).toMatchObject({ status: 'in_progress', attemptNumber: 1 })
        const approvedQuestion = gradeTenQuiz.questions[0]
        const firstQuestion = expectCurrentAttemptQuestion(
            attempt,
            approvedQuestion!,
            0,
            gradeQuestionCount,
            'en',
            'grade 10 AccessLink delete attempt start'
        )
        const approvedOption = approvedQuestion?.options.find((option) => option.isCorrect)
        const runtimeOptions = runtimeRecords(getRuntimeField(firstQuestion ?? {}, 'Options'))
        const correctOption = runtimeOptions.find((option) => getRuntimeField(option, 'Id') === approvedOption?.id)
        const questionId = getRuntimeField(firstQuestion ?? {}, 'Id')
        const correctOptionId = getRuntimeField(correctOption ?? {}, 'Id')
        const prompt = readLocalizedText(getRuntimeField(firstQuestion ?? {}, 'Prompt'), 'en')
        const correctLabel = readLocalizedText(
            getRuntimeField(correctOption ?? {}, 'Label') ?? getRuntimeField(correctOption ?? {}, 'Text'),
            'en'
        )
        if (
            typeof questionId !== 'string' ||
            typeof correctOptionId !== 'string' ||
            correctOptionId !== approvedOption?.id ||
            !prompt ||
            !correctLabel
        ) {
            throw new Error('Could not resolve the approved first answer before deleting the AccessLink')
        }

        await expect(guestPage.getByRole('heading', { name: prompt, exact: true })).toBeVisible()
        const correctAnswer = guestPage.getByRole('radiogroup').getByRole('radio', { name: correctLabel, exact: true })
        const savedAttempt = await selectGuestQuizAnswer({
            page: guestPage,
            applicationId,
            attemptId: attempt.attemptId,
            option: correctAnswer,
            label: 'grade 10 answer before AccessLink deletion'
        })
        expectCurrentAttemptQuestion(savedAttempt, gradeTenQuiz.questions[1]!, 1, gradeQuestionCount, 'en', 'grade 10 next question')

        await deleteAccessLinkFromOwnerPage(flow)

        const removedShortLinkResponse = await context.request.get(new URL(`/api/v1/public/l/${gradeTenShortLinkSlug}`, origin).toString())
        expect(removedShortLinkResponse.status(), 'Deleting an AccessLink must release its global short link').toBe(404)
        const removedAccessLinkResponse = await context.request.get(
            new URL(
                `/api/v1/public/a/${applicationId}/links/${gradeTenAccessLink.slug}?locale=en&workspaceId=${encodeURIComponent(
                    publicWorkspaceId
                )}`,
                origin
            ).toString()
        )
        expect(removedAccessLinkResponse.status(), 'A deleted AccessLink must be hidden from guests').toBe(404)
        await expect(readAccessLinkDeletionLifecycle(applicationId, persistedAccessLink.id)).resolves.toMatchObject({
            physicalRows: 1,
            activeRows: 0,
            appDeleted: true
        })

        const workspaceMatchesAfter = await readActiveAccessLinkSlugMatchCounts(applicationId, gradeTenAccessLink.slug, publicWorkspaceId)
        expect(workspaceMatchesAfter.selectedWorkspaceRows).toBe(0)
        expect(workspaceMatchesAfter.activeRows).toBe(workspaceMatchesBefore.activeRows - 1)
        expect(workspaceMatchesAfter.matchingWorkspaceIds).toContain(siblingWorkspaceId)
        const siblingAccessLinkResponse = await context.request.get(siblingPublicLinkUrl)
        expect(siblingAccessLinkResponse.status(), 'Deleting one scoped AccessLink must not change its sibling workspace link').toBe(
            siblingAccessLinkBeforeDelete.status()
        )
        if (siblingAccessLinkBeforeDeletePayload) {
            expect(siblingAccessLinkBeforeDeletePayload).toMatchObject({
                id: siblingAccessLink.id,
                slug: gradeTenAccessLink.slug,
                targetType: 'quiz',
                targetId: siblingAccessLink.targetId
            })
            await expect(siblingAccessLinkResponse.json()).resolves.toMatchObject(siblingAccessLinkBeforeDeletePayload)
        }

        const csrfResponse = await context.request.get(new URL('/api/v1/auth/csrf', origin).toString())
        expect(csrfResponse.status()).toBe(200)
        const csrfPayload = await csrfResponse.json()
        const staleAttemptResponse = await context.request.get(
            new URL(`/api/v1/public/a/${applicationId}/runtime/attempts/${attempt.attemptId}`, origin).toString(),
            {
                headers: {
                    'x-guest-participant-id': guestSession.participantId,
                    'x-guest-session-token': guestSession.sessionToken,
                    'x-csrf-token': csrfPayload.csrfToken
                }
            }
        )
        expect(staleAttemptResponse.status(), 'A deleted AccessLink must revoke its active guest session').toBe(403)

        await guestPage.reload()
        await expect(guestPage.getByRole('alert')).toContainText('This short link is unavailable or its destination is no longer public.')
        await expectRuntimeUxViewportMatrix(guestPage, 'Deleted LMS Marathon short-link state', {
            beforeEachViewport: async (viewport) => {
                await expect(guestPage.getByRole('alert')).toContainText(
                    'This short link is unavailable or its destination is no longer public.'
                )
                await expectNoTechnicalLeakage(guestPage.locator('body'), {
                    label: `Deleted LMS short-link guest page at ${viewport.width}px`,
                    checkUuidSubstrings: true
                })
                await expectNoAccessibilityViolations(guestPage, `Deleted LMS short-link guest page at ${viewport.width}px`)
                if (viewport.width === 390) {
                    await guestPage.screenshot({
                        path: testInfo.outputPath('lms-marathon-deleted-short-link-mobile.png'),
                        fullPage: true,
                        animations: 'disabled'
                    })
                }
            }
        })

        const reportResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
            { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
        )
        expect(reportResponse.status, 'Deleting a link must preserve its finalized attempt in the report').toBe(200)
        const reportPayload = await reportResponse.json()
        const reportRow = runtimeRecords(reportPayload.rows).find(
            (row) => getRuntimeReferenceId(getRuntimeField(row, 'StudentId')) === participantId
        )
        expect(reportRow).toBeTruthy()
        expect(readLocalizedText(getRuntimeField(reportRow ?? {}, 'Status'))).toBe('Revoked')
        expect(Number(getRuntimeField(reportRow ?? {}, 'Score'))).toBe(1)
        expect(Number(getRuntimeField(reportRow ?? {}, 'TotalQuestions'))).toBe(gradeQuestionCount)

        await page.setViewportSize({ width: 1920, height: 1080 })
        await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
        const reportsNavigationItem = page
            .getByRole('link', { name: 'Reports', exact: true })
            .or(page.getByRole('button', { name: 'Reports', exact: true }))
            .first()
        await expect(reportsNavigationItem, 'The authorized owner must see the Reports navigation item').toBeVisible({ timeout: 30_000 })
        await reportsNavigationItem.click()
        const reportTable = page
            .getByTestId('runtime-report-details-table')
            .filter({ has: page.getByRole('gridcell', { name: `E2E ${participantName}`, exact: true }) })
        await expect(reportTable, 'The owner report UI must show the revoked guest result').toBeVisible({ timeout: 60_000 })
        await expect(reportTable).toHaveCount(1)
        const reportStudentCell = reportTable.getByRole('gridcell', { name: `E2E ${participantName}`, exact: true })
        await expect(reportStudentCell, 'The report must match the exact deleted-link guest name').toBeVisible()
        const reportUiRow = reportStudentCell.locator('..')
        await expect(reportUiRow).toHaveRole('row')
        await expect(reportUiRow).toBeVisible()
        await expect(reportUiRow).toContainText('Access revoked')
        await expect(reportUiRow).toContainText(String(gradeQuestionCount))
        await expectDataGridCellTextByColumn(reportTable, reportUiRow, 'Score', '1')
        await expect(reportUiRow.getByRole('gridcell', { name: 'No', exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(reportTable, { label: 'Revoked LMS result report', checkUuidSubstrings: true })
        await expectRuntimeUxViewportMatrix(page, 'Owner report after deleting an AccessLink', {
            beforeEachViewport: async (viewport) => {
                await expect(reportUiRow).toBeVisible()
                await expectNoTechnicalLeakage(reportTable, {
                    label: `Revoked LMS result report at ${viewport.width}px`,
                    checkUuidSubstrings: true
                })
                await expectNoAccessibilityViolations(page, `Owner report after deleting an AccessLink at ${viewport.width}px`)
                if (viewport.width === 1920) {
                    await page.screenshot({
                        path: testInfo.outputPath('lms-marathon-access-link-deletion-preserves-revoked-result.png'),
                        fullPage: true,
                        animations: 'disabled'
                    })
                }
            }
        })

        await expect(readGuestAssessmentResponses(applicationId, attempt.attemptId)).resolves.toEqual([
            { questionId, selectedOptionIds: [correctOptionId], isCorrect: true }
        ])
    } finally {
        await context.close()
    }
}
