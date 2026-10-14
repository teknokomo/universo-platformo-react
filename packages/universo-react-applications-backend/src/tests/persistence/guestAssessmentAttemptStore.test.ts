import type { DbExecutor } from '@universo-react/utils'
import {
    findGuestAssessmentResponse,
    findGuestAssessmentAttemptIdentity,
    insertGuestAssessmentRecord,
    listGuestAssessmentAttemptIdentities,
    listExpiredGuestAssessmentAttemptIdentities,
    listStartedGuestAssessmentAttemptIdentities,
    listStartedGuestAssessmentAttemptIdentitiesForAccessLink,
    listGuestAssessmentAttempts,
    updateGuestAssessmentAttempt,
    type GuestAssessmentAttemptTable,
    type GuestAssessmentResponseTable
} from '../../persistence/guestAssessmentAttemptStore'

const makeExecutor = (result: unknown[] = []) =>
    ({
        query: jest.fn().mockResolvedValue(result)
    } as unknown as DbExecutor & { query: jest.Mock })

const attemptTable: GuestAssessmentAttemptTable = {
    schemaName: 'app_018f8a787b8f7c1da111222233334442',
    tableName: 'quiz_attempts',
    workspaceId: '018f8a78-7b8f-7c1d-a111-222233334441',
    columns: {
        studentId: 'student_id',
        quizId: 'quiz_id',
        attemptNumber: 'attempt_number',
        startedAt: 'started_at',
        submittedAt: 'submitted_at',
        deadlineAt: 'deadline_at',
        effectiveTimeLimitSeconds: 'effective_time_limit_seconds',
        passingScorePercentSnapshot: 'passing_score_percent_snapshot',
        finishedReason: 'finished_reason',
        questionsSnapshot: 'questions_snapshot',
        questionSetDigest: 'question_set_digest',
        accessLinkId: 'access_link_id',
        score: 'score',
        totalQuestions: 'total_questions',
        passed: 'passed',
        status: 'status'
    }
}

const responseTable: GuestAssessmentResponseTable = {
    schemaName: attemptTable.schemaName,
    tableName: 'quiz_responses',
    workspaceId: attemptTable.workspaceId,
    columns: {
        studentId: 'student_id',
        quizId: 'quiz_id',
        attemptId: 'attempt_id',
        questionId: 'question_id',
        selectedOptionIds: 'selected_option_ids',
        isCorrect: 'is_correct',
        attemptNumber: 'attempt_number',
        submittedAt: 'submitted_at'
    }
}

describe('guest assessment attempt store', () => {
    it('lists only expired started attempts inside the configured workspace', async () => {
        const deadlineAt = '2026-10-11T11:00:00.000Z'
        const executor = makeExecutor([{ id: 'attempt-id', studentId: 'participant-id', deadlineAt }])

        const identities = await listExpiredGuestAssessmentAttemptIdentities(executor, attemptTable, '2026-10-11T12:00:00.000Z', 25)

        expect(identities).toEqual([{ id: 'attempt-id', studentId: 'participant-id', deadlineAt }])
        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain(`"${attemptTable.schemaName}"."${attemptTable.tableName}"`)
        expect(sql).toContain('"status" = \'Started\'')
        expect(sql).toContain('"deadline_at" <= $1')
        expect(sql).toContain('ORDER BY "deadline_at" ASC, "id" ASC')
        expect(sql).toContain('"workspace_id" = $3')
        expect(sql).toContain('LIMIT $2')
        expect(sql).toContain('_upl_deleted = false AND _app_deleted = false')
        expect(params).toEqual(['2026-10-11T12:00:00.000Z', 25, attemptTable.workspaceId])
    })

    it('uses a parameterized deadline and UUID cursor for the next reconciliation page', async () => {
        const deadlineAt = '2026-10-11T11:00:00.000Z'
        const after = { deadlineAt, id: '018f8a78-7b8f-7c1d-a111-222233334443' }
        const executor = makeExecutor([{ id: 'attempt-next', studentId: 'participant-next', deadlineAt }])

        const identities = await listExpiredGuestAssessmentAttemptIdentities(executor, attemptTable, '2026-10-11T12:00:00.000Z', 25, after)

        expect(identities).toEqual([{ id: 'attempt-next', studentId: 'participant-next', deadlineAt }])
        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('("deadline_at", "id") > ($3::timestamptz, $4::uuid)')
        expect(sql).toContain('"workspace_id" = $5')
        expect(sql).not.toContain(after.id)
        expect(params).toEqual(['2026-10-11T12:00:00.000Z', 25, deadlineAt, after.id, attemptTable.workspaceId])
    })

    it('lists every active Started attempt, including attempts without a deadline, in bounded UUID pages', async () => {
        const executor = makeExecutor([{ id: '018f8a78-7b8f-7c1d-a111-222233334443', studentId: 'participant-id' }])

        const identities = await listStartedGuestAssessmentAttemptIdentities(executor, attemptTable, 40)

        expect(identities).toEqual([{ id: '018f8a78-7b8f-7c1d-a111-222233334443', studentId: 'participant-id' }])
        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain(`FROM "${attemptTable.schemaName}"."${attemptTable.tableName}"`)
        expect(sql).toContain('"status" = \'Started\'')
        expect(sql).not.toContain('deadline_at')
        expect(sql).toContain('ORDER BY "id" ASC')
        expect(sql).toContain('LIMIT $1')
        expect(sql).toContain('"workspace_id" = $2')
        expect(params).toEqual([40, attemptTable.workspaceId])
    })

    it('uses a UUID cursor for later revocation batches without interpolating caller input', async () => {
        const cursor = '018f8a78-7b8f-7c1d-a111-222233334443'
        const executor = makeExecutor([])

        await listStartedGuestAssessmentAttemptIdentities(executor, attemptTable, 40, cursor)

        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('"id" > $1::uuid')
        expect(sql).toContain('LIMIT $2')
        expect(sql).toContain('"workspace_id" = $3')
        expect(sql).not.toContain(cursor)
        expect(params).toEqual([cursor, 40, attemptTable.workspaceId])
    })

    it('lists only started attempts for one link in its workspace with keyset pagination', async () => {
        const accessLinkId = '018f8a78-7b8f-7c1d-a111-222233334445'
        const cursor = '018f8a78-7b8f-7c1d-a111-222233334446'
        const executor = makeExecutor([])

        await listStartedGuestAssessmentAttemptIdentitiesForAccessLink(executor, attemptTable, accessLinkId, 40, cursor)

        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('"status" = \'Started\'')
        expect(sql).toContain('"access_link_id" = $1')
        expect(sql).toContain('"id" > $2::uuid')
        expect(sql).toContain('"workspace_id" = $4')
        expect(sql).toContain('LIMIT $3')
        expect(sql).not.toContain(accessLinkId)
        expect(sql).not.toContain(cursor)
        expect(params).toEqual([accessLinkId, cursor, 40, attemptTable.workspaceId])
    })

    it('scopes attempt reads by participant, quiz, workspace and active row state', async () => {
        const executor = makeExecutor()

        await listGuestAssessmentAttempts(executor, attemptTable, 'participant-id', 'quiz-id')

        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('"student_id" = $1')
        expect(sql).toContain('"quiz_id" = $2')
        expect(sql).toContain('"workspace_id" = $3')
        expect(sql).toContain('_upl_deleted = false AND _app_deleted = false')
        expect(params).toEqual(['participant-id', 'quiz-id', attemptTable.workspaceId])
    })

    it('reads only attempt identity fields when checking resumability', async () => {
        const executor = makeExecutor([{ id: 'attempt-id', status: 'Started', accessLinkId: 'link-id' }])

        const identities = await listGuestAssessmentAttemptIdentities(executor, attemptTable, 'participant-id', 'quiz-id')

        expect(identities).toEqual([{ id: 'attempt-id', status: 'Started', accessLinkId: 'link-id' }])
        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('"student_id" = $1')
        expect(sql).toContain('"quiz_id" = $2')
        expect(sql).toContain('"workspace_id" = $3')
        expect(sql).toContain('"status" AS status')
        expect(sql).toContain('"access_link_id" AS "accessLinkId"')
        expect(sql).not.toContain('"questions_snapshot"')
        expect(params).toEqual(['participant-id', 'quiz-id', attemptTable.workspaceId])
    })

    it('finds one participant-owned attempt identity without loading its question snapshot', async () => {
        const executor = makeExecutor([{ id: 'attempt-id', status: 'Started', accessLinkId: 'link-id' }])

        const identity = await findGuestAssessmentAttemptIdentity(executor, attemptTable, 'attempt-id', 'participant-id', true)

        expect(identity).toEqual({ id: 'attempt-id', status: 'Started', accessLinkId: 'link-id' })
        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain('WHERE id = $1')
        expect(sql).toContain('"student_id" = $2')
        expect(sql).toContain('FOR UPDATE')
        expect(sql).not.toContain('"questions_snapshot"')
        expect(params).toEqual(['attempt-id', 'participant-id', attemptTable.workspaceId])
    })

    it('inserts runtime data using bound values and qualified table names', async () => {
        const id = '018f8a78-7b8f-7c1d-a111-222233334443'
        const executor = makeExecutor([{ id }])

        await insertGuestAssessmentRecord(
            executor,
            { schemaName: attemptTable.schemaName, tableName: 'quiz_attempts', workspaceId: attemptTable.workspaceId },
            { score: 0, status: 'Started' },
            id,
            '018f8a78-7b8f-7c1d-a111-222233334444'
        )

        const [sql, params] = executor.query.mock.calls[0]
        expect(sql).toContain(`"${attemptTable.schemaName}"."quiz_attempts"`)
        expect(sql).toContain('"score", "status"')
        expect(sql).toContain('RETURNING id')
        expect(sql).not.toContain("'Started'")
        expect(params).toEqual([
            id,
            0,
            'Started',
            attemptTable.workspaceId,
            '018f8a78-7b8f-7c1d-a111-222233334444',
            '018f8a78-7b8f-7c1d-a111-222233334444'
        ])
    })

    it('rejects reserved runtime record columns before issuing SQL', async () => {
        const executor = makeExecutor()

        await expect(
            insertGuestAssessmentRecord(
                executor,
                { schemaName: attemptTable.schemaName, tableName: 'quiz_attempts', workspaceId: null },
                { id: 'spoofed-id' },
                '018f8a78-7b8f-7c1d-a111-222233334443',
                '018f8a78-7b8f-7c1d-a111-222233334444'
            )
        ).rejects.toThrow('duplicate or reserved fields')
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('returns an existing answer only within the owned attempt and workspace', async () => {
        const executor = makeExecutor([{ questionId: 'question-id', selectedOptionIds: ['option-id'] }])

        const row = await findGuestAssessmentResponse(executor, responseTable, 'attempt-id', 'question-id')

        expect(row).toEqual({ questionId: 'question-id', selectedOptionIds: ['option-id'] })
        expect(executor.query.mock.calls[0][1]).toEqual(['attempt-id', 'question-id', responseTable.workspaceId])
    })

    it('fails closed when an attempt update matches no owned active row', async () => {
        const executor = makeExecutor()

        await expect(
            updateGuestAssessmentAttempt(executor, attemptTable, 'attempt-id', 'participant-id', { score: 1 }, 'participant-id')
        ).rejects.toThrow('Guest assessment attempt was not updated')
    })

    it('increments the optimistic version for every terminal attempt update', async () => {
        const executor = makeExecutor([{ id: 'attempt-id' }])

        await updateGuestAssessmentAttempt(executor, attemptTable, 'attempt-id', 'participant-id', { score: 1 }, 'participant-id')

        const [sql] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('"_upl_version" = COALESCE("_upl_version", 1) + 1')
        expect(sql).toContain('RETURNING id')
    })
})
