import { withE2eDatabaseClient } from './backend/e2eDatabase.mjs'
import { readLocalizedText, type RuntimeRecord } from './lmsMarathonGuestShortLinkAssertions'
import { parseGuestAssessmentResponseRecord, type GuestAssessmentResponseRecord } from './lmsMarathonGuestShortLinkResponseParser'

function quoteDatabaseIdentifier(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]*$/u.test(value)) {
        throw new Error(`E2E could not safely resolve the ${label} database identifier`)
    }
    return `"${value}"`
}

export async function readApplicationTabularChildFieldMetadata(
    applicationId: string,
    objectCodename: string,
    tableFieldCodename: string,
    childFieldCodename: string
): Promise<{ tableComponentId: string; childColumnName: string }> {
    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
             FROM applications.obj_applications
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, codename
             FROM ${schemaSql}."_app_objects"
             WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const object = objectsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === objectCodename)
        if (!object) throw new Error(`E2E could not resolve the ${objectCodename} object`)

        const tableFieldsResult = await client.query(
            `SELECT id, codename
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL
               AND _upl_deleted = false AND _app_deleted = false`,
            [object.id]
        )
        const tableField = tableFieldsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === tableFieldCodename)
        if (!tableField) throw new Error(`E2E could not resolve the ${tableFieldCodename} tabular field`)

        const childFieldsResult = await client.query(
            `SELECT column_name AS "columnName", codename
             FROM ${schemaSql}."_app_components"
             WHERE parent_component_id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [tableField.id]
        )
        const childField = childFieldsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === childFieldCodename)
        if (!childField) throw new Error(`E2E could not resolve the ${childFieldCodename} child field`)

        return {
            tableComponentId: String(tableField.id),
            childColumnName: String(childField.columnName)
        }
    })
}

export async function setGuestAssessmentAttemptDeadline(applicationId: string, attemptId: string, secondsFromNow: number): Promise<void> {
    if (!Number.isSafeInteger(secondsFromNow) || secondsFromNow < 1 || secondsFromNow > 300) {
        throw new Error('E2E attempt deadline must be between 1 and 300 seconds from now')
    }

    await withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
         FROM applications.obj_applications
         WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaName = applicationResult.rows[0]?.schemaName
        const schemaSql = quoteDatabaseIdentifier(schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
         FROM ${schemaSql}."_app_objects"
         WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const attemptsObject = objectsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'QuizAttempts')
        if (!attemptsObject) throw new Error('E2E could not resolve the QuizAttempts object')
        const tableSql = quoteDatabaseIdentifier(attemptsObject.tableName, 'QuizAttempts table')
        const componentsResult = await client.query(
            `SELECT codename, column_name AS "columnName"
         FROM ${schemaSql}."_app_components"
         WHERE object_id = $1 AND parent_component_id IS NULL
           AND _upl_deleted = false AND _app_deleted = false`,
            [attemptsObject.id]
        )
        const deadlineColumn = componentsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'DeadlineAt')
        const statusColumn = componentsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'Status')
        const deadlineSql = quoteDatabaseIdentifier(deadlineColumn?.columnName, 'attempt deadline column')
        const statusSql = quoteDatabaseIdentifier(statusColumn?.columnName, 'attempt status column')
        const result = await client.query(
            `UPDATE ${schemaSql}.${tableSql}
         SET ${deadlineSql} = NOW() + ($1::int * INTERVAL '1 second')
         WHERE id = $2 AND ${statusSql} = 'Started'
         RETURNING id`,
            [secondsFromNow, attemptId]
        )
        if (result.rowCount !== 1) throw new Error('E2E could not update the still-started guest attempt deadline')
    })
}

export async function readGuestLegalConsent(applicationId: string, participantId: string): Promise<RuntimeRecord> {
    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
         FROM applications.obj_applications
         WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
         FROM ${schemaSql}."_app_objects"
         WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const studentsObject = objectsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'Students')
        if (!studentsObject) throw new Error('E2E could not resolve the Students object')

        const componentsResult = await client.query(
            `SELECT codename, column_name AS "columnName"
         FROM ${schemaSql}."_app_components"
         WHERE object_id = $1 AND parent_component_id IS NULL
           AND _upl_deleted = false AND _app_deleted = false`,
            [studentsObject.id]
        )
        const fields = [
            ['termsVersion', 'TermsVersion'],
            ['termsAcceptedAt', 'TermsAcceptedAt'],
            ['privacyVersion', 'PrivacyVersion'],
            ['privacyAcceptedAt', 'PrivacyAcceptedAt']
        ] as const
        const selectedColumns = fields.map(([alias, codename]) => {
            const component = componentsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === codename)
            return `${quoteDatabaseIdentifier(component?.columnName, `${codename} column`)} AS "${alias}"`
        })
        const tableSql = quoteDatabaseIdentifier(studentsObject.tableName, 'Students table')
        const result = await client.query(
            `SELECT ${selectedColumns.join(', ')}
         FROM ${schemaSql}.${tableSql}
         WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [participantId]
        )
        if (result.rowCount !== 1) throw new Error('E2E could not resolve the persisted guest participant consent')
        return result.rows[0] as RuntimeRecord
    })
}

export async function readGuestAssessmentResponseRecords(
    applicationId: string,
    attemptId: string,
    includeArchived = false
): Promise<GuestAssessmentResponseRecord[]> {
    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
         FROM applications.obj_applications
         WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
         FROM ${schemaSql}."_app_objects"
         WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const responseObject = objectsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'QuizResponses')
        if (!responseObject) throw new Error('E2E could not resolve the QuizResponses object')

        const componentsResult = await client.query(
            `SELECT codename, column_name AS "columnName"
         FROM ${schemaSql}."_app_components"
         WHERE object_id = $1 AND parent_component_id IS NULL
           AND _upl_deleted = false AND _app_deleted = false`,
            [responseObject.id]
        )
        const resolveColumn = (codename: string) => {
            const component = componentsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === codename)
            return quoteDatabaseIdentifier(component?.columnName, `QuizResponses ${codename} column`)
        }
        const responseTableSql = quoteDatabaseIdentifier(responseObject.tableName, 'QuizResponses table')
        const responseResult = await client.query(
            `SELECT id AS "id",
                ${resolveColumn('AttemptId')} AS "attemptId",
                ${resolveColumn('StudentId')} AS "studentId",
                ${resolveColumn('QuizId')} AS "quizId",
                ${resolveColumn('QuestionId')} AS "questionId",
                ${resolveColumn('SelectedOptionIds')} AS "selectedOptionIds",
                ${resolveColumn('IsCorrect')} AS "isCorrect",
                ${resolveColumn('AttemptNumber')} AS "attemptNumber",
                ${resolveColumn('SubmittedAt')} AS "submittedAt"
         FROM ${schemaSql}.${responseTableSql}
         WHERE ${resolveColumn('AttemptId')} = $1
           ${includeArchived ? '' : 'AND _upl_deleted = false AND _app_deleted = false'}
         ORDER BY _upl_created_at ASC, id ASC`,
            [attemptId]
        )
        return responseResult.rows.map((row: RuntimeRecord) => parseGuestAssessmentResponseRecord(row))
    })
}

export async function readGuestAssessmentResponses(
    applicationId: string,
    attemptId: string,
    includeArchived = false
): Promise<Array<{ questionId: string; selectedOptionIds: string[]; isCorrect: boolean }>> {
    const records = await readGuestAssessmentResponseRecords(applicationId, attemptId, includeArchived)
    return records.map(({ questionId, selectedOptionIds, isCorrect }) => ({ questionId, selectedOptionIds, isCorrect }))
}

export async function readGuestAssessmentAttemptSnapshot(
    applicationId: string,
    attemptId: string
): Promise<{
    studentId: string
    status: string
    finishedReason: string | null
    score: number
    totalQuestions: number
    uplDeleted: boolean
    appDeleted: boolean
}> {
    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
             FROM applications.obj_applications
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
             FROM ${schemaSql}."_app_objects"
             WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const attemptsObject = objectsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'QuizAttempts')
        if (!attemptsObject) throw new Error('E2E could not resolve the QuizAttempts object')

        const componentsResult = await client.query(
            `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL
               AND _upl_deleted = false AND _app_deleted = false`,
            [attemptsObject.id]
        )
        const resolveColumn = (codename: string) => {
            const component = componentsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === codename)
            return quoteDatabaseIdentifier(component?.columnName, `QuizAttempts ${codename} column`)
        }
        const attemptsTableSql = quoteDatabaseIdentifier(attemptsObject.tableName, 'QuizAttempts table')
        const attemptResult = await client.query(
            `SELECT ${resolveColumn('StudentId')} AS "studentId",
                    ${resolveColumn('Status')} AS "status",
                    ${resolveColumn('FinishedReason')} AS "finishedReason",
                    ${resolveColumn('Score')} AS "score",
                    ${resolveColumn('TotalQuestions')} AS "totalQuestions",
                    _upl_deleted AS "uplDeleted",
                    _app_deleted AS "appDeleted"
             FROM ${schemaSql}.${attemptsTableSql}
             WHERE id = $1`,
            [attemptId]
        )
        const attempt = attemptResult.rows[0] as RuntimeRecord | undefined
        if (!attempt) throw new Error('E2E could not resolve the archived QuizAttempts row')
        if (typeof attempt.studentId !== 'string' || attempt.studentId.length === 0) {
            throw new Error('E2E QuizAttempts row is missing its required StudentId value')
        }
        return {
            studentId: attempt.studentId,
            status: String(attempt.status),
            finishedReason: typeof attempt.finishedReason === 'string' ? attempt.finishedReason : null,
            score: Number(attempt.score),
            totalQuestions: Number(attempt.totalQuestions),
            uplDeleted: attempt.uplDeleted === true,
            appDeleted: attempt.appDeleted === true
        }
    })
}

export async function readPublishedQuizAccessLinkTargets(
    applicationId: string,
    workspaceId: string,
    accessLinkSlug?: string
): Promise<
    Array<{ id: string; slug: string; targetType: string; targetId: string; linkTitle: unknown; quizTitle: unknown; useCount: number }>
> {
    if (!/^[0-9a-f-]{36}$/iu.test(workspaceId)) {
        throw new Error('E2E could not safely resolve the public workspace id')
    }

    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
         FROM applications.obj_applications
         WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const objectResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
         FROM ${schemaSql}."_app_objects"
         WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const quizObject = objectResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'Quizzes')
        const accessLinkObject = objectResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'AccessLinks')
        if (!quizObject || !accessLinkObject) throw new Error('E2E could not resolve published quiz and access-link objects')

        const [quizComponentsResult, accessLinkComponentsResult] = await Promise.all([
            client.query(
                `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL
               AND _upl_deleted = false AND _app_deleted = false`,
                [quizObject.id]
            ),
            client.query(
                `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL
               AND _upl_deleted = false AND _app_deleted = false`,
                [accessLinkObject.id]
            )
        ])
        const componentColumn = (components: RuntimeRecord[], codename: string, label: string) => {
            const component = components.find((row) => readLocalizedText(row.codename, 'en') === codename)
            return quoteDatabaseIdentifier(component?.columnName, label)
        }
        const quizTitleColumn = componentColumn(quizComponentsResult.rows, 'Title', 'quiz title column')
        const accessSlugColumn = componentColumn(accessLinkComponentsResult.rows, 'Slug', 'access-link slug column')
        const accessTypeColumn = componentColumn(accessLinkComponentsResult.rows, 'TargetType', 'access-link target-type column')
        const accessTargetColumn = componentColumn(accessLinkComponentsResult.rows, 'TargetId', 'access-link target-id column')
        const accessTitleColumn = componentColumn(accessLinkComponentsResult.rows, 'LinkTitle', 'access-link title column')
        const accessUseCountColumn = componentColumn(accessLinkComponentsResult.rows, 'UseCount', 'access-link use-count column')
        const quizTableSql = quoteDatabaseIdentifier(quizObject.tableName, 'quiz table')
        const accessLinkTableSql = quoteDatabaseIdentifier(accessLinkObject.tableName, 'access-link table')
        const accessLinkSlugPredicate = accessLinkSlug === undefined ? '' : `AND ${accessSlugColumn} = $3`
        const accessLinkParams = accessLinkSlug === undefined ? [workspaceId, 'quiz'] : [workspaceId, 'quiz', accessLinkSlug]

        const [quizRowsResult, accessLinkRowsResult] = await Promise.all([
            client.query(
                `SELECT id, ${quizTitleColumn} AS "quizTitle"
             FROM ${schemaSql}.${quizTableSql}
             WHERE workspace_id = $1
               AND _upl_deleted = false AND _app_deleted = false`,
                [workspaceId]
            ),
            client.query(
                `SELECT id,
                    ${accessSlugColumn} AS slug,
                    ${accessTypeColumn} AS "targetType",
                    ${accessTargetColumn} AS "targetId",
                    ${accessTitleColumn} AS "linkTitle",
                    ${accessUseCountColumn} AS "useCount"
             FROM ${schemaSql}.${accessLinkTableSql}
             WHERE workspace_id = $1
               AND ${accessTypeColumn} = $2
               ${accessLinkSlugPredicate}
               AND _upl_deleted = false AND _app_deleted = false`,
                accessLinkParams
            )
        ])
        const quizTitlesById = new Map(quizRowsResult.rows.map((row: RuntimeRecord) => [String(row.id), row.quizTitle] as const))

        return accessLinkRowsResult.rows.map((row: RuntimeRecord) => {
            const targetId = String(row.targetId)
            const quizTitle = quizTitlesById.get(targetId)
            if (quizTitle === undefined) {
                throw new Error(
                    `E2E found quiz access link ${String(row.slug)} (${String(row.id)}) with no published quiz target ${targetId}`
                )
            }
            return {
                id: String(row.id),
                slug: String(row.slug),
                targetType: String(row.targetType),
                targetId,
                linkTitle: row.linkTitle,
                quizTitle,
                useCount: Number(row.useCount)
            }
        })
    })
}

export async function readPublishedQuizAccessLinkTargetBySlug(
    applicationId: string,
    workspaceId: string,
    slug: string
): Promise<Awaited<ReturnType<typeof readPublishedQuizAccessLinkTargets>>[number]> {
    const matchingTargets = await readPublishedQuizAccessLinkTargets(applicationId, workspaceId, slug)
    if (matchingTargets.length !== 1) {
        throw new Error('E2E expected exactly one persisted quiz access-link row for the selected slug')
    }
    const [target] = matchingTargets
    if (!target) throw new Error('E2E could not resolve the persisted quiz access-link row')
    return target
}

export async function seedAccessLinkUseCountForTest(
    applicationId: string,
    workspaceId: string,
    accessLinkId: string,
    useCount: number
): Promise<void> {
    if (!/^[0-9a-f-]{36}$/iu.test(applicationId) || !/^[0-9a-f-]{36}$/iu.test(workspaceId) || !/^[0-9a-f-]{36}$/iu.test(accessLinkId)) {
        throw new Error('E2E requires UUID identities to seed an AccessLinks quota fixture')
    }
    if (!Number.isSafeInteger(useCount) || useCount < 0) {
        throw new Error('E2E requires a nonnegative integer AccessLinks use count')
    }

    await withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
             FROM applications.obj_applications
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
             FROM ${schemaSql}."_app_objects"
             WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const accessLinkObject = objectsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'AccessLinks')
        if (!accessLinkObject) throw new Error('E2E could not resolve the AccessLinks object for quota setup')

        const componentsResult = await client.query(
            `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL
               AND _upl_deleted = false AND _app_deleted = false`,
            [accessLinkObject.id]
        )
        const useCountComponent = componentsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'UseCount')
        const useCountColumn = quoteDatabaseIdentifier(useCountComponent?.columnName, 'AccessLinks UseCount column')
        const accessLinksTable = quoteDatabaseIdentifier(accessLinkObject.tableName, 'AccessLinks table')
        const updated = await client.query(
            `UPDATE ${schemaSql}.${accessLinksTable}
             SET ${useCountColumn} = $1
             WHERE id = $2 AND workspace_id = $3
               AND _upl_deleted = false AND _app_deleted = false
             RETURNING id`,
            [useCount, accessLinkId, workspaceId]
        )
        if (updated.rowCount !== 1) throw new Error('E2E could not seed exactly one active AccessLinks quota row')
    })
}

export async function readActiveAccessLinkSlugMatchCounts(
    applicationId: string,
    slug: string,
    workspaceId: string
): Promise<{ activeRows: number; matchingWorkspaces: number; selectedWorkspaceRows: number; matchingWorkspaceIds: string[] }> {
    if (!/^[0-9a-f-]{36}$/iu.test(workspaceId)) {
        throw new Error('E2E could not safely resolve the selected public workspace id')
    }

    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
             FROM applications.obj_applications
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const accessLinkObjectResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
             FROM ${schemaSql}."_app_objects"
             WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const accessLinkObject = accessLinkObjectResult.rows.find(
            (row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'AccessLinks'
        )
        if (!accessLinkObject) throw new Error('E2E could not resolve the AccessLinks object')

        const slugComponentResult = await client.query(
            `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1 AND parent_component_id IS NULL
               AND _upl_deleted = false AND _app_deleted = false`,
            [accessLinkObject.id]
        )
        const slugComponent = slugComponentResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'Slug')
        const slugColumn = quoteDatabaseIdentifier(slugComponent?.columnName, 'access-link slug column')
        const tableSql = quoteDatabaseIdentifier(accessLinkObject.tableName, 'access-link table')
        const counts = await client.query<{
            activeRows: string
            matchingWorkspaces: string
            selectedWorkspaceRows: string
            matchingWorkspaceIds: string[]
        }>(
            `SELECT COUNT(*)::text AS "activeRows",
                    COUNT(DISTINCT workspace_id)::text AS "matchingWorkspaces",
                    COUNT(*) FILTER (WHERE workspace_id = $2)::text AS "selectedWorkspaceRows",
                    array_agg(DISTINCT workspace_id::text) FILTER (WHERE workspace_id IS NOT NULL) AS "matchingWorkspaceIds"
             FROM ${schemaSql}.${tableSql}
             WHERE ${slugColumn} = $1
               AND _upl_deleted = false AND _app_deleted = false`,
            [slug, workspaceId]
        )

        return {
            activeRows: Number(counts.rows[0]?.activeRows ?? 0),
            matchingWorkspaces: Number(counts.rows[0]?.matchingWorkspaces ?? 0),
            selectedWorkspaceRows: Number(counts.rows[0]?.selectedWorkspaceRows ?? 0),
            matchingWorkspaceIds: (counts.rows[0]?.matchingWorkspaceIds ?? []).map(String)
        }
    })
}

export async function readAccessLinkDeletionLifecycle(
    applicationId: string,
    accessLinkId: string
): Promise<{ physicalRows: number; activeRows: number; appDeleted: boolean }> {
    return withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
             FROM applications.obj_applications
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaSql = quoteDatabaseIdentifier(applicationResult.rows[0]?.schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, codename, table_name AS "tableName"
             FROM ${schemaSql}."_app_objects"
             WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const accessLinkObject = objectsResult.rows.find((row: RuntimeRecord) => readLocalizedText(row.codename, 'en') === 'AccessLinks')
        if (!accessLinkObject) throw new Error('E2E could not resolve the AccessLinks object')

        const tableSql = quoteDatabaseIdentifier(accessLinkObject.tableName, 'AccessLinks table')
        const result = await client.query<{ physicalRows: string; activeRows: string; appDeleted: boolean }>(
            `SELECT COUNT(*)::text AS "physicalRows",
                    COUNT(*) FILTER (WHERE _upl_deleted = false AND _app_deleted = false)::text AS "activeRows",
                    COALESCE(BOOL_AND(_app_deleted), false) AS "appDeleted"
             FROM ${schemaSql}.${tableSql}
             WHERE id = $1`,
            [accessLinkId]
        )
        const lifecycle = result.rows[0]
        return {
            physicalRows: Number(lifecycle?.physicalRows ?? 0),
            activeRows: Number(lifecycle?.activeRows ?? 0),
            appDeleted: lifecycle?.appDeleted === true
        }
    })
}
