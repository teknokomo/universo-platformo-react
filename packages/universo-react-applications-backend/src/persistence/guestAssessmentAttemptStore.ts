import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export type GuestAssessmentAttemptColumns = {
    studentId: string
    quizId: string
    attemptNumber: string
    startedAt: string
    submittedAt: string
    deadlineAt: string
    effectiveTimeLimitSeconds: string
    passingScorePercentSnapshot: string
    finishedReason: string
    questionsSnapshot: string
    questionSetDigest: string
    flowSnapshot: string
    phase: string
    phaseRevision: string
    timerState: string
    frozenRemainingMs: string
    accessLinkId: string
    classIdSnapshot: string
    score: string
    scorePercent: string
    totalQuestions: string
    passed: string
    status: string
}

export type GuestAssessmentResponseColumns = {
    studentId: string
    quizId: string
    attemptId: string
    questionId: string
    selectedOptionIds: string
    isCorrect: string
    attemptNumber: string
    submittedAt: string
}

export interface GuestAssessmentRuntimeTable {
    schemaName: string
    tableName: string
    workspaceId: string | null
}

export interface GuestAssessmentAttemptIdentity {
    id: string
    status: unknown
    accessLinkId: unknown
}

export interface ExpiredGuestAssessmentAttemptIdentity {
    id: string
    studentId: string
    deadlineAt: string | Date
}

export interface StartedGuestAssessmentAttemptIdentity {
    id: string
    studentId: string
}

export interface ExpiredGuestAssessmentAttemptCursor {
    id: string
    deadlineAt: string | Date
}

export interface GuestAssessmentAttemptTable extends GuestAssessmentRuntimeTable {
    columns: GuestAssessmentAttemptColumns
}

export interface GuestAssessmentResponseTable extends GuestAssessmentRuntimeTable {
    columns: GuestAssessmentResponseColumns
}

const quoteColumn = (column: string): string => {
    if (!IDENTIFIER_PATTERN.test(column)) throw new Error('Runtime metadata contains an invalid column identifier')
    return qColumn(column)
}

const whereWorkspace = (workspaceId: string | null, parameterIndex: number): { clause: string; params: string[] } =>
    workspaceId ? { clause: `AND ${qColumn('workspace_id')} = $${parameterIndex}`, params: [workspaceId] } : { clause: '', params: [] }

const attemptSelect = (table: GuestAssessmentAttemptTable) => {
    const { columns } = table
    return [
        `id`,
        `${quoteColumn(columns.studentId)} AS "studentId"`,
        `${quoteColumn(columns.quizId)} AS "quizId"`,
        `${quoteColumn(columns.attemptNumber)} AS "attemptNumber"`,
        `${quoteColumn(columns.startedAt)} AS "startedAt"`,
        `${quoteColumn(columns.submittedAt)} AS "submittedAt"`,
        `${quoteColumn(columns.deadlineAt)} AS "deadlineAt"`,
        `${quoteColumn(columns.effectiveTimeLimitSeconds)} AS "effectiveTimeLimitSeconds"`,
        `${quoteColumn(columns.passingScorePercentSnapshot)} AS "passingScorePercentSnapshot"`,
        `${quoteColumn(columns.finishedReason)} AS "finishedReason"`,
        `${quoteColumn(columns.questionsSnapshot)} AS "questionsSnapshot"`,
        `${quoteColumn(columns.questionSetDigest)} AS "questionSetDigest"`,
        `${quoteColumn(columns.flowSnapshot)} AS "flowSnapshot"`,
        `${quoteColumn(columns.phase)} AS "phase"`,
        `${quoteColumn(columns.phaseRevision)} AS "phaseRevision"`,
        `${quoteColumn(columns.timerState)} AS "timerState"`,
        `${quoteColumn(columns.frozenRemainingMs)} AS "frozenRemainingMs"`,
        `${quoteColumn(columns.accessLinkId)} AS "accessLinkId"`,
        `${quoteColumn(columns.score)} AS "score"`,
        `${quoteColumn(columns.totalQuestions)} AS "totalQuestions"`,
        `${quoteColumn(columns.passed)} AS "passed"`,
        `${quoteColumn(columns.status)} AS "status"`
    ].join(',\n')
}

export const listGuestAssessmentAttempts = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    studentId: string,
    quizId: string,
    lockRows = false
): Promise<Array<Record<string, unknown> & { id: string }>> => {
    const workspace = whereWorkspace(table.workspaceId, 3)
    return executor.query<Record<string, unknown> & { id: string }>(
        `SELECT ${attemptSelect(table)}
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE ${quoteColumn(table.columns.studentId)} = $1
           AND ${quoteColumn(table.columns.quizId)} = $2
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         ORDER BY ${quoteColumn(table.columns.attemptNumber)} ASC, id ASC${lockRows ? ' FOR UPDATE' : ''}`,
        [studentId, quizId, ...workspace.params]
    )
}

export const listExpiredGuestAssessmentAttemptIdentities = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    expiredAtOrBefore: string,
    limit = 1000,
    after?: ExpiredGuestAssessmentAttemptCursor
): Promise<ExpiredGuestAssessmentAttemptIdentity[]> => {
    const workspace = whereWorkspace(table.workspaceId, after ? 5 : 3)
    const cursorClause = after ? `AND (${quoteColumn(table.columns.deadlineAt)}, ${qColumn('id')}) > ($3::timestamptz, $4::uuid)` : ''
    return executor.query<ExpiredGuestAssessmentAttemptIdentity>(
        `SELECT ${qColumn('id')}, ${quoteColumn(table.columns.studentId)} AS "studentId",
                ${quoteColumn(table.columns.deadlineAt)} AS "deadlineAt"
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE ${quoteColumn(table.columns.status)} = 'Started'
           AND ${quoteColumn(table.columns.timerState)} = 'running'
           AND ${quoteColumn(table.columns.deadlineAt)} IS NOT NULL
           AND ${quoteColumn(table.columns.deadlineAt)} <= $1
           ${cursorClause}
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         ORDER BY ${quoteColumn(table.columns.deadlineAt)} ASC, ${qColumn('id')} ASC
         LIMIT $2`,
        [expiredAtOrBefore, limit, ...(after ? [after.deadlineAt, after.id] : []), ...workspace.params]
    )
}

export const listStartedGuestAssessmentAttemptIdentities = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    limit = 1000,
    afterId?: string
): Promise<StartedGuestAssessmentAttemptIdentity[]> => {
    const workspace = whereWorkspace(table.workspaceId, afterId ? 3 : 2)
    const cursorClause = afterId ? `AND ${qColumn('id')} > $1::uuid` : ''
    const limitParameter = afterId ? '$2' : '$1'
    return executor.query<StartedGuestAssessmentAttemptIdentity>(
        `SELECT ${qColumn('id')}, ${quoteColumn(table.columns.studentId)} AS "studentId"
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE ${quoteColumn(table.columns.status)} = 'Started'
           ${cursorClause}
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         ORDER BY ${qColumn('id')} ASC
         LIMIT ${limitParameter}`,
        [...(afterId ? [afterId] : []), limit, ...workspace.params]
    )
}

export const listStartedGuestAssessmentAttemptIdentitiesForAccessLink = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    accessLinkId: string,
    limit = 1000,
    afterId?: string
): Promise<StartedGuestAssessmentAttemptIdentity[]> => {
    if (!isUuidV7(accessLinkId)) throw new TypeError('accessLinkId must be a UUID v7')
    const workspace = whereWorkspace(table.workspaceId, afterId ? 4 : 3)
    const cursorClause = afterId ? `AND ${qColumn('id')} > $2::uuid` : ''
    const limitParameter = afterId ? '$3' : '$2'
    return executor.query<StartedGuestAssessmentAttemptIdentity>(
        `SELECT ${qColumn('id')}, ${quoteColumn(table.columns.studentId)} AS "studentId"
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE ${quoteColumn(table.columns.status)} = 'Started'
           AND ${quoteColumn(table.columns.accessLinkId)} = $1
           ${cursorClause}
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         ORDER BY ${qColumn('id')} ASC
         LIMIT ${limitParameter}`,
        [accessLinkId, ...(afterId ? [afterId] : []), limit, ...workspace.params]
    )
}

export const listGuestAssessmentAttemptIdentities = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    studentId: string,
    quizId: string,
    lockRows = false
): Promise<GuestAssessmentAttemptIdentity[]> => {
    const workspace = whereWorkspace(table.workspaceId, 3)
    return executor.query<GuestAssessmentAttemptIdentity>(
        `SELECT id,
                ${quoteColumn(table.columns.status)} AS status,
                ${quoteColumn(table.columns.accessLinkId)} AS "accessLinkId"
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE ${quoteColumn(table.columns.studentId)} = $1
           AND ${quoteColumn(table.columns.quizId)} = $2
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         ORDER BY ${quoteColumn(table.columns.attemptNumber)} ASC, id ASC${lockRows ? ' FOR UPDATE' : ''}`,
        [studentId, quizId, ...workspace.params]
    )
}

export const findGuestAssessmentAttemptIdentity = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    attemptId: string,
    studentId: string,
    lockRow = false
): Promise<GuestAssessmentAttemptIdentity | null> => {
    const workspace = whereWorkspace(table.workspaceId, 3)
    const rows = await executor.query<GuestAssessmentAttemptIdentity>(
        `SELECT id,
                ${quoteColumn(table.columns.status)} AS status,
                ${quoteColumn(table.columns.accessLinkId)} AS "accessLinkId"
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE id = $1
           AND ${quoteColumn(table.columns.studentId)} = $2
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         LIMIT 1${lockRow ? ' FOR UPDATE' : ''}`,
        [attemptId, studentId, ...workspace.params]
    )
    return rows[0] ?? null
}

export const findGuestAssessmentAttempt = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    attemptId: string,
    studentId: string,
    lockRow = false
): Promise<(Record<string, unknown> & { id: string }) | null> => {
    const workspace = whereWorkspace(table.workspaceId, 3)
    const rows = await executor.query<Record<string, unknown> & { id: string }>(
        `SELECT ${attemptSelect(table)}
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE id = $1
           AND ${quoteColumn(table.columns.studentId)} = $2
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         LIMIT 1${lockRow ? ' FOR UPDATE' : ''}`,
        [attemptId, studentId, ...workspace.params]
    )
    return rows[0] ?? null
}

export const listGuestAssessmentResponses = async (
    executor: DbExecutor,
    table: GuestAssessmentResponseTable,
    attemptId: string
): Promise<Array<{ questionId: string; selectedOptionIds: unknown; isCorrect: boolean }>> => {
    const workspace = whereWorkspace(table.workspaceId, 2)
    return executor.query<{ questionId: string; selectedOptionIds: unknown; isCorrect: boolean }>(
        `SELECT ${quoteColumn(table.columns.questionId)} AS "questionId",
                ${quoteColumn(table.columns.selectedOptionIds)} AS "selectedOptionIds",
                ${quoteColumn(table.columns.isCorrect)} AS "isCorrect"
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE ${quoteColumn(table.columns.attemptId)} = $1
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         ORDER BY ${quoteColumn(table.columns.submittedAt)} ASC, id ASC`,
        [attemptId, ...workspace.params]
    )
}

export const findGuestAssessmentResponse = async (
    executor: DbExecutor,
    table: GuestAssessmentResponseTable,
    attemptId: string,
    questionId: string
): Promise<{ questionId: string; selectedOptionIds: unknown } | null> => {
    const workspace = whereWorkspace(table.workspaceId, 3)
    const rows = await executor.query<{ questionId: string; selectedOptionIds: unknown }>(
        `SELECT ${quoteColumn(table.columns.questionId)} AS "questionId",
                ${quoteColumn(table.columns.selectedOptionIds)} AS "selectedOptionIds"
         FROM ${qSchemaTable(table.schemaName, table.tableName)}
         WHERE ${quoteColumn(table.columns.attemptId)} = $1
           AND ${quoteColumn(table.columns.questionId)} = $2
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         LIMIT 1`,
        [attemptId, questionId, ...workspace.params]
    )
    return rows[0] ?? null
}

export const insertGuestAssessmentRecord = async (
    executor: DbExecutor,
    table: GuestAssessmentRuntimeTable,
    fields: Record<string, unknown>,
    id: string,
    actorId: string
): Promise<void> => {
    const entries = Object.entries(fields)
    if (entries.length === 0) throw new Error('Runtime record insert requires fields')
    const reservedColumns = new Set(['id', 'workspace_id', '_upl_created_by', '_upl_updated_by'])
    const fieldNames = entries.map(([name]) => name)
    if (new Set(fieldNames).size !== fieldNames.length || fieldNames.some((name) => reservedColumns.has(name))) {
        throw new Error('Runtime record insert contains duplicate or reserved fields')
    }
    const names = ['id', ...entries.map(([name]) => quoteColumn(name))]
    const values: unknown[] = [id, ...entries.map(([, value]) => value)]
    const placeholders = values.map((_, index) => `$${index + 1}`)

    if (table.workspaceId) {
        names.push(qColumn('workspace_id'))
        placeholders.push(`$${values.length + 1}`)
        values.push(table.workspaceId)
    }

    names.push(qColumn('_upl_created_by'), qColumn('_upl_updated_by'))
    placeholders.push(`$${values.length + 1}`, `$${values.length + 2}`)
    values.push(actorId, actorId)

    const rows = await executor.query<{ id: string }>(
        `INSERT INTO ${qSchemaTable(table.schemaName, table.tableName)} (${names.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING id`,
        values
    )
    if (rows.length !== 1 || rows[0]?.id !== id) throw new Error('Runtime record was not inserted')
}

export const updateGuestAssessmentAttempt = async (
    executor: DbExecutor,
    table: GuestAssessmentAttemptTable,
    attemptId: string,
    studentId: string,
    fields: Record<string, unknown>,
    actorId: string
): Promise<void> => {
    const entries = Object.entries(fields)
    if (entries.length === 0) throw new Error('Runtime attempt update requires fields')
    const assignments = entries.map(([name], index) => `${quoteColumn(name)} = $${index + 1}`)
    const values: unknown[] = entries.map(([, value]) => value)
    assignments.push(`${qColumn('_upl_updated_at')} = NOW()`)
    assignments.push(`${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1`)
    values.push(attemptId, studentId)
    const workspace = whereWorkspace(table.workspaceId, values.length + 1)
    values.push(...workspace.params, actorId)
    assignments.push(`${qColumn('_upl_updated_by')} = $${values.length}`)
    const idParameter = entries.length + 1
    const studentParameter = entries.length + 2

    const rows = await executor.query<{ id: string }>(
        `UPDATE ${qSchemaTable(table.schemaName, table.tableName)}
         SET ${assignments.join(', ')}
         WHERE id = $${idParameter}
           AND ${quoteColumn(table.columns.studentId)} = $${studentParameter}
           ${workspace.clause}
           AND ${ACTIVE_ROW_SQL}
         RETURNING id`,
        values
    )
    if (rows.length !== 1) throw new Error('Guest assessment attempt was not updated')
}
