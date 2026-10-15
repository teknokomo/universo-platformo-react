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
    expect(reportPayload.definition.columns.map((column: { field: string }) => column.field)).toEqual(
        expect.arrayContaining(['ClassIdSnapshot', 'ScorePercent'])
    )
    const submittedReportRow = matchingReportRows.find(
        (row) => getRuntimeReferenceId(getRuntimeField(row, 'StudentId')) === submittedStudentId
    )
    expect(submittedReportRow, 'The saved report must keep the one intentionally incorrect answer').toBeTruthy()
    const submittedQuizId = getRuntimeReferenceId(getRuntimeField(submittedReportRow as RuntimeRecord, 'QuizId'))
    const submittedClassSnapshot = getRuntimeField(submittedReportRow as RuntimeRecord, 'ClassIdSnapshot')
    const submittedClassId = getRuntimeReferenceId(submittedClassSnapshot)
    const submittedClassLabel = readLocalizedText(getRuntimeField(submittedClassSnapshot as RuntimeRecord, 'Label'))
    const submittedScorePercent = Number(getRuntimeField(submittedReportRow as RuntimeRecord, 'ScorePercent'))
    expect(submittedQuizId, 'The report must resolve the quiz reference').toBeTruthy()
    expect(submittedClassId, 'The attempt must retain its class snapshot reference').toBeTruthy()
    expect(submittedClassLabel, 'The class snapshot must have a human-readable label').toBeTruthy()
    expect(submittedScorePercent, 'The report must expose the percentage score').toBeCloseTo(
        ((gradeQuestionCount - 1) / gradeQuestionCount) * 100,
        2
    )
    expect(Number(getRuntimeField(submittedReportRow as RuntimeRecord, 'TotalQuestions'))).toBe(gradeQuestionCount)
    expect(getRuntimeField(submittedReportRow as RuntimeRecord, 'Passed')).toBe(true)
    expect(readLocalizedText(getRuntimeField(submittedReportRow as RuntimeRecord, 'Status'))).toBe('Passed')
    const submittedAt =
        readLocalizedText(getRuntimeField(submittedReportRow as RuntimeRecord, 'SubmittedAt')) ??
        String(getRuntimeField(submittedReportRow as RuntimeRecord, 'SubmittedAt') ?? '')
    expect(Number.isFinite(Date.parse(submittedAt)), 'The submitted attempt must have a completion timestamp').toBe(true)

    const sortPayload = {
        reportCodename: 'QuizAttemptResults',
        limit: 100,
        offset: 0,
        sort: [{ field: 'ScorePercent', direction: 'desc' }]
    }
    const [sortedReportResponse, repeatedSortedReportResponse] = await Promise.all([
        sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
            sortPayload
        ),
        sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
            sortPayload
        )
    ])
    expect(sortedReportResponse.status, 'The report API must accept validated server sorting').toBe(200)
    expect(repeatedSortedReportResponse.status).toBe(200)
    const sortedRows = runtimeRecords((await sortedReportResponse.json()).rows)
    const repeatedSortedRows = runtimeRecords((await repeatedSortedReportResponse.json()).rows)
    const sortedPercentages = sortedRows.map((row) => Number(getRuntimeField(row, 'ScorePercent')))
    expect(sortedPercentages).toEqual([...sortedPercentages].sort((left, right) => right - left))
    expect(repeatedSortedRows).toEqual(sortedRows)

    const submittedAtMillis = Date.parse(submittedAt)
    const filterResponse = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(publicWorkspaceId)}`,
        {
            reportCodename: 'QuizAttemptResults',
            limit: 100,
            offset: 0,
            filters: [
                { field: 'QuizId', operator: 'equals', value: submittedQuizId },
                { field: 'ClassIdSnapshot', operator: 'equals', value: submittedClassId },
                { field: 'SubmittedAt', operator: 'greaterThanOrEqual', value: new Date(submittedAtMillis - 100).toISOString() },
                { field: 'SubmittedAt', operator: 'lessThanOrEqual', value: new Date(submittedAtMillis + 100).toISOString() }
            ]
        }
    )
    expect(filterResponse.status, 'Quiz, class, and date-range filters must be supported server-side').toBe(200)
    const filteredRows = runtimeRecords((await filterResponse.json()).rows)
    expect(filteredRows).toHaveLength(1)
    expect(getRuntimeReferenceId(getRuntimeField(filteredRows[0] as RuntimeRecord, 'StudentId'))).toBe(submittedStudentId)

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
    await expect(participantReportTable.getByRole('columnheader', { name: 'Class', exact: true })).toBeVisible()
    await expect(participantReportTable.getByRole('columnheader', { name: 'Score (%)', exact: true })).toBeVisible()
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
    await expect(participantReportRow.locator('[data-field="SubmittedAt"]')).not.toHaveText(submittedAt)
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Score', String(gradeQuestionCount - 1))
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Score (%)', String(submittedScorePercent))
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Class', submittedClassLabel as string)
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Passed', 'Yes')
    await expectDataGridCellTextByColumn(participantReportTable, timeoutReportRow, 'Score', '0')
    await expectDataGridCellTextByColumn(participantReportTable, timeoutReportRow, 'Passed', 'No')
    await expectDataGridCellTextByColumn(participantReportTable, participantReportRow, 'Total questions', String(gradeQuestionCount))

    const sortedRun = page.waitForResponse((response) => {
        if (!response.url().includes('/runtime/reports/run') || response.request().method() !== 'POST') return false
        const requestBody = response.request().postDataJSON() as { sort?: Array<{ field?: string }> } | null
        return requestBody?.sort?.[0]?.field === 'ScorePercent'
    })
    await participantReportTable.getByRole('columnheader', { name: 'Score (%)', exact: true }).click()
    const sortedBrowserResponse = await sortedRun
    expect(sortedBrowserResponse.status(), 'The score percentage header must request server sorting').toBe(200)
    const sortedBrowserRows = runtimeRecords((await sortedBrowserResponse.json()).rows)
    const browserPercentages = sortedBrowserRows.map((row) => Number(getRuntimeField(row, 'ScorePercent')))
    expect(browserPercentages).toEqual([...browserPercentages].sort((left, right) => left - right))
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await page.setViewportSize(viewport)
        await page.mouse.move(0, 0)
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
    await expect(russianParticipantReportTable.getByRole('columnheader', { name: 'Класс', exact: true })).toBeVisible()
    await expect(russianParticipantReportTable.getByRole('columnheader', { name: 'Результат (%)', exact: true })).toBeVisible()
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
