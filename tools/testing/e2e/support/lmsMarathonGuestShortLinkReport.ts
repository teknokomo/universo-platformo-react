import { expect } from '../fixtures/test'
import { expectDataGridCellTextByColumn, expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'
import {
    expectNoAccessibilityViolations,
    getRuntimeField,
    getRuntimeReferenceId,
    readLocalizedText,
    runtimeRecords,
    type RuntimeRecord
} from './lmsMarathonGuestShortLinkAssertions'
import { sendWithCsrf } from './backend/api-session.mjs'
import {
    readGuestAssessmentAttemptSnapshot,
    readGuestAssessmentResponseRecords,
    readGuestAssessmentResponses
} from './lmsMarathonGuestShortLinkDatabase'
import type { LmsMarathonPreparedFlow } from './lmsMarathonGuestShortLinkTypes'

export async function verifyLmsMarathonAuthorizedReport(
    flow: LmsMarathonPreparedFlow,
    submittedParticipant: {
        participantName: string
        participantId: string
        attemptId: string
        submittedResponses: Array<{ questionId: string; selectedOptionId: string; isCorrect: boolean }>
    },
    timedOutParticipant: {
        participantName: string
        participantId: string
        attemptId: string
        firstQuestionId: string
        firstSelectedOptionId: string
    }
): Promise<void> {
    const { api, applicationId, publicWorkspaceId, page, testInfo, gradeQuestionCount } = flow
    const reportResponse = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
        { reportCodename: 'QuizAttemptResults', limit: 100, offset: 0 }
    )
    expect(reportResponse.status, 'The authenticated owner must be authorized to run QuizAttemptResults').toBe(200)
    const reportPayload = await reportResponse.json()
    expect(reportPayload.definition?.codename).toBe('QuizAttemptResults')
    const [submittedResponseRecords, timedOutResponseRecords, submittedAttemptRecord, timedOutAttemptRecord] = await Promise.all([
        readGuestAssessmentResponseRecords(applicationId, submittedParticipant.attemptId),
        readGuestAssessmentResponseRecords(applicationId, timedOutParticipant.attemptId),
        readGuestAssessmentAttemptSnapshot(applicationId, submittedParticipant.attemptId),
        readGuestAssessmentAttemptSnapshot(applicationId, timedOutParticipant.attemptId)
    ])
    const submittedStudentId = submittedParticipant.participantId
    const timedOutStudentId = timedOutParticipant.participantId
    expect(submittedStudentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    expect(timedOutStudentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    expect(submittedStudentId).not.toBe(timedOutStudentId)
    expect(submittedAttemptRecord.studentId, 'The submitted attempt must retain its initiating guest identity').toBe(submittedStudentId)
    expect(timedOutAttemptRecord.studentId, 'The timed-out attempt must retain its initiating guest identity').toBe(timedOutStudentId)
    expect(submittedResponseRecords.map(({ studentId }) => studentId)).toEqual(
        Array.from({ length: gradeQuestionCount }, () => submittedStudentId)
    )
    expect(timedOutResponseRecords.map(({ studentId }) => studentId)).toEqual([timedOutStudentId])
    const matchingReportRows = runtimeRecords(reportPayload.rows).filter((row) => {
        const studentId = getRuntimeReferenceId(getRuntimeField(row, 'StudentId'))
        return studentId === submittedStudentId || studentId === timedOutStudentId
    })
    expect(matchingReportRows, 'The saved authorized report must include the submitted and timed-out guests').toHaveLength(2)
    const submittedReportRow = matchingReportRows.find(
        (row) => getRuntimeReferenceId(getRuntimeField(row, 'StudentId')) === submittedStudentId
    )
    expect(submittedReportRow, 'The saved report must keep the one intentionally incorrect answer').toBeTruthy()
    expect(Number(getRuntimeField(submittedReportRow as RuntimeRecord, 'TotalQuestions'))).toBe(gradeQuestionCount)
    expect(getRuntimeField(submittedReportRow as RuntimeRecord, 'Passed')).toBe(true)
    expect(readLocalizedText(getRuntimeField(submittedReportRow as RuntimeRecord, 'Status'))).toBe('Passed')
    const submittedAt =
        readLocalizedText(getRuntimeField(submittedReportRow as RuntimeRecord, 'SubmittedAt')) ??
        String(getRuntimeField(submittedReportRow as RuntimeRecord, 'SubmittedAt') ?? '')
    expect(Number.isFinite(Date.parse(submittedAt)), 'The submitted attempt must have a completion timestamp').toBe(true)

    const timedOutReportRow = matchingReportRows.find(
        (row) => getRuntimeReferenceId(getRuntimeField(row, 'StudentId')) === timedOutStudentId
    )
    expect(timedOutReportRow, 'The authorized report must include the timed-out guest').toBeTruthy()
    expect(Number(getRuntimeField(timedOutReportRow as RuntimeRecord, 'Score'))).toBe(0)
    expect(Number(getRuntimeField(timedOutReportRow as RuntimeRecord, 'TotalQuestions'))).toBe(gradeQuestionCount)
    expect(getRuntimeField(timedOutReportRow as RuntimeRecord, 'Passed')).toBe(false)
    expect(readLocalizedText(getRuntimeField(timedOutReportRow as RuntimeRecord, 'Status'))).toBe('TimedOut')
    const timedOutSubmittedAt =
        readLocalizedText(getRuntimeField(timedOutReportRow as RuntimeRecord, 'SubmittedAt')) ??
        String(getRuntimeField(timedOutReportRow as RuntimeRecord, 'SubmittedAt') ?? '')
    expect(Number.isFinite(Date.parse(timedOutSubmittedAt)), 'The timed-out attempt must have a completion timestamp').toBe(true)

    const persistedResponses = submittedResponseRecords.map(({ questionId, selectedOptionIds, isCorrect }) => ({
        questionId,
        selectedOptionIds,
        isCorrect
    }))
    const responseIds = submittedResponseRecords.map(({ id }) => id)
    expect(new Set(responseIds).size, 'Each persisted response must have a unique identity').toBe(gradeQuestionCount)
    expect(responseIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id))).toBe(true)
    expect(persistedResponses, 'Every answered question must have one persisted QuizResponses row').toHaveLength(gradeQuestionCount)
    expect(new Set(persistedResponses.map(({ questionId }) => questionId)).size).toBe(gradeQuestionCount)
    expect(persistedResponses.filter(({ isCorrect }) => isCorrect)).toHaveLength(gradeQuestionCount - 1)
    expect(persistedResponses.filter(({ isCorrect }) => !isCorrect)).toHaveLength(1)
    expect(persistedResponses, 'Each response must preserve the exact question-to-selected-option mapping').toEqual(
        submittedParticipant.submittedResponses.map(({ questionId, selectedOptionId, isCorrect }) => ({
            questionId,
            selectedOptionIds: [selectedOptionId],
            isCorrect
        }))
    )
    await expect
        .poll(() => readGuestAssessmentResponses(applicationId, timedOutParticipant.attemptId))
        .toEqual([
            {
                questionId: timedOutParticipant.firstQuestionId,
                selectedOptionIds: [timedOutParticipant.firstSelectedOptionId],
                isCorrect: false
            }
        ])

    await page.goto(`/a/${applicationId}?locale=en&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    const reportsNavigationItem = page
        .getByRole('link', { name: 'Reports' })
        .or(page.getByRole('button', { name: 'Reports' }))
        .first()
    await expect(reportsNavigationItem).toBeVisible({ timeout: 30_000 })
    await reportsNavigationItem.click()
    const participantReportTable = page.getByTestId('runtime-report-details-table').filter({
        has: page.getByRole('gridcell', { name: submittedParticipant.participantName, exact: true })
    })
    await expect(participantReportTable).toBeVisible({ timeout: 60_000 })
    await expect(participantReportTable).toHaveCount(1)
    const submittedParticipantCell = participantReportTable.getByRole('gridcell', {
        name: submittedParticipant.participantName,
        exact: true
    })
    const timedOutParticipantCell = participantReportTable.getByRole('gridcell', { name: timedOutParticipant.participantName, exact: true })
    await expect(submittedParticipantCell, 'The report must show the exact submitted guest name').toBeVisible()
    await expect(timedOutParticipantCell, 'The report must show the exact timed-out guest name').toBeVisible()
    await expectNoTechnicalLeakage(participantReportTable, { label: 'Authorized LMS Marathon result report', checkUuidSubstrings: true })
    const reportPageText = await page.locator('body').innerText()
    expect(reportPageText).not.toContain(applicationId)
    expect(reportPageText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu)
    expect(reportPageText).not.toMatch(/\[object Object\]/iu)
    const participantReportRow = submittedParticipantCell.locator('..')
    const timeoutReportRow = timedOutParticipantCell.locator('..')
    await expect(participantReportRow).toHaveRole('row')
    await expect(timeoutReportRow).toHaveRole('row')
    await expect(participantReportRow).toBeVisible()
    await expect(timeoutReportRow).toBeVisible()
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Score', String(gradeQuestionCount - 1))
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Passed', 'Yes')
    await expectDataGridCellTextByColumn(participantReportTable, timeoutReportRow, 'Score', '0')
    await expectDataGridCellTextByColumn(participantReportTable, timeoutReportRow, 'Passed', 'No')
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Total questions', String(gradeQuestionCount))
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await page.setViewportSize(viewport)
        await expectNoPageHorizontalOverflow(page, `Authorized LMS Marathon quiz results report at ${viewport.width}px`)
        await expect(participantReportRow).toBeVisible()
        await expect(timeoutReportRow).toBeVisible()
        if (viewport.width === 1920) {
            await expectNoAccessibilityViolations(page, 'Authorized LMS Marathon quiz results report')
            await page.screenshot({
                path: testInfo.outputPath('lms-marathon-authorized-results.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
        if (viewport.width === 390) {
            const scoreHeader = participantReportTable.locator('.MuiDataGrid-columnHeader[data-field="Score"]')
            await scoreHeader.scrollIntoViewIfNeeded()
            await expect(scoreHeader).toBeInViewport()
            await expect(participantReportRow.getByRole('gridcell', { name: String(gradeQuestionCount - 1), exact: true })).toBeInViewport()
            await expectNoPageHorizontalOverflow(page, 'Authorized LMS Marathon quiz score on mobile')
            await page.screenshot({
                path: testInfo.outputPath('lms-marathon-authorized-results-mobile-score.png'),
                fullPage: true,
                animations: 'disabled'
            })
        }
    }

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/a/${applicationId}?locale=ru&workspaceId=${encodeURIComponent(publicWorkspaceId)}`)
    const russianReportsNavigationItem = page
        .getByRole('link', { name: 'Отчёты' })
        .or(page.getByRole('button', { name: 'Отчёты' }))
        .first()
    await expect(russianReportsNavigationItem).toBeVisible({ timeout: 30_000 })
    await russianReportsNavigationItem.click()
    const russianParticipantReportTable = page.getByTestId('runtime-report-details-table').filter({
        has: page.getByRole('gridcell', { name: submittedParticipant.participantName, exact: true })
    })
    await expect(russianParticipantReportTable).toBeVisible({ timeout: 60_000 })
    await expect(russianParticipantReportTable).toHaveCount(1)
    const russianParticipantCell = russianParticipantReportTable.getByRole('gridcell', {
        name: submittedParticipant.participantName,
        exact: true
    })
    await expect(russianParticipantCell, 'The Russian report must show the exact participant name').toBeVisible()
    await expect(russianParticipantReportTable.getByRole('columnheader', { name: 'Балл', exact: true })).toBeVisible()
    await expectNoTechnicalLeakage(russianParticipantReportTable, {
        label: 'Authorized Russian LMS Marathon result report',
        checkUuidSubstrings: true
    })
    const russianParticipantRow = russianParticipantCell.locator('..')
    await expect(russianParticipantRow).toHaveRole('row')
    await expectDataGridCellTextByColumn(russianParticipantReportTable, russianParticipantRow, 'Балл', String(gradeQuestionCount - 1))
    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoPageHorizontalOverflow(page, 'Russian LMS Marathon quiz results report on mobile')
    const quizHeader = russianParticipantReportTable.getByRole('columnheader', { name: 'Тест', exact: true })
    await quizHeader.scrollIntoViewIfNeeded()
    const resultsScroller = russianParticipantReportTable.locator('.MuiDataGrid-virtualScroller')
    await resultsScroller.evaluate((element: HTMLElement) => element.scrollTo({ left: 0, top: 0 }))
    await expect(quizHeader).toBeInViewport()
    await expect(russianParticipantRow).toBeVisible()
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-authorized-results-mobile-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })
    const russianScoreHeader = russianParticipantReportTable.locator('.MuiDataGrid-columnHeader[data-field="Score"]')
    await russianScoreHeader.scrollIntoViewIfNeeded()
    await expect(russianScoreHeader).toBeInViewport()
    await expect(russianParticipantRow.getByRole('gridcell', { name: String(gradeQuestionCount - 1), exact: true })).toBeInViewport()
    await expectNoPageHorizontalOverflow(page, 'Russian LMS Marathon quiz score on mobile')
    await page.screenshot({
        path: testInfo.outputPath('lms-marathon-authorized-results-mobile-score-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })
}
