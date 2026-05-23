import { RuntimeReportsService, serializeRuntimeReportCsv } from '../../services/runtimeReportsService'
import { UpdateFailure } from '../../shared/runtimeHelpers'
import { createMockDbExecutor } from '../utils/dbMocks'

const fields = [
    { codename: 'Learner', columnName: 'learner', dataType: 'STRING' as const },
    { codename: 'ProgressPercent', columnName: 'progress_percent', dataType: 'NUMBER' as const },
    { codename: 'CompletedAt', columnName: 'completed_at', dataType: 'DATE' as const },
    { codename: 'Payload', columnName: 'payload', dataType: 'JSON' as const }
]

const definition = {
    codename: 'LearnerProgress',
    title: { en: 'Learner progress' },
    datasource: {
        kind: 'records.list',
        sectionCodename: 'ContentProgress',
        query: {
            sort: [{ field: 'CompletedAt', direction: 'desc' }],
            filters: [{ field: 'ProgressPercent', operator: 'greaterThanOrEqual', value: 50 }]
        }
    },
    columns: [
        { field: 'Learner', label: 'Learner', type: 'text' },
        { field: 'ProgressPercent', label: 'Progress', type: 'number' }
    ],
    filters: [{ field: 'Learner', operator: 'contains', value: 'Ava' }],
    aggregations: []
}
const schemaName = 'app_019e0000000070008000000000000001'

describe('RuntimeReportsService', () => {
    it('runs records.list reports using only resolved metadata identifiers', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()
        executor.query
            .mockResolvedValueOnce([{ report_field_1: 'Ava', report_field_2: 100 }])
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([{ average_progress: '100' }])

        const result = await service.runRecordsListReport({
            executor,
            schemaName,
            tableName: 'obj_content_progress',
            fields,
            definition: {
                ...definition,
                datasource: {
                    ...definition.datasource,
                    query: {
                        sort: [{ field: 'CompletedAt', direction: 'desc' }],
                        filters: [{ field: 'ProgressPercent', operator: 'greaterThanOrEqual', value: 50 }]
                    }
                },
                aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
            },
            permissions: { readReports: true },
            limit: 25,
            offset: 0
        })

        expect(result.rows).toEqual([{ Learner: 'Ava', ProgressPercent: 100 }])
        expect(result.total).toBe(1)
        expect(result.aggregations).toEqual({ AverageProgress: 100 })

        const listSql = String(executor.query.mock.calls[0][0])
        expect(listSql).toContain(`"${schemaName}"."obj_content_progress"`)
        expect(listSql).toContain('SELECT "learner" AS "report_field_1", "progress_percent" AS "report_field_2"')
        expect(listSql).toContain('"completed_at" DESC NULLS LAST')
        expect(listSql).not.toContain('ContentProgress')
        expect(executor.query.mock.calls[0][1]).toEqual([50, '%Ava%', 25, 0])

        const countSql = String(executor.query.mock.calls[1][0])
        expect(countSql).toContain('SELECT count(*) AS total')
        expect(executor.query.mock.calls[1][1]).toEqual([50, '%Ava%'])

        const aggregationSql = String(executor.query.mock.calls[2][0])
        expect(aggregationSql).toContain('SELECT AVG("progress_percent") AS "average_progress"')
        expect(executor.query.mock.calls[2][1]).toEqual([50, '%Ava%'])
    })

    it('merges ad hoc report filters with saved report filters before SQL execution', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()
        executor.query.mockResolvedValueOnce([{ report_field_1: 'Ava', report_field_2: 75 }])
        executor.query.mockResolvedValueOnce([{ total: '1' }])

        const result = await service.runRecordsListReport({
            executor,
            schemaName,
            tableName: 'obj_content_progress',
            fields,
            definition,
            permissions: { readReports: true },
            filters: [{ field: 'ProgressPercent', operator: 'lessThanOrEqual', value: 90 }],
            limit: 25,
            offset: 0
        })

        expect(result.rows).toEqual([{ Learner: 'Ava', ProgressPercent: 75 }])
        expect(result.total).toBe(1)

        const listSql = String(executor.query.mock.calls[0][0])
        expect(listSql).toContain('"progress_percent" >= $1')
        expect(listSql).toContain('"learner"::text ILIKE $2')
        expect(listSql).toContain('"progress_percent" <= $3')
        expect(executor.query.mock.calls[0][1]).toEqual([50, '%Ava%', 90, 25, 0])

        const countSql = String(executor.query.mock.calls[1][0])
        expect(countSql).toContain('"progress_percent" <= $3')
        expect(executor.query.mock.calls[1][1]).toEqual([50, '%Ava%', 90])
    })

    it('applies supplied row-level access conditions to list, count, and aggregation queries', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()
        executor.query
            .mockResolvedValueOnce([{ report_field_1: 'Ava', report_field_2: 75 }])
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([{ average_progress: '75' }])

        await service.runRecordsListReport({
            executor,
            schemaName,
            tableName: 'obj_content_progress',
            fields,
            definition: {
                ...definition,
                datasource: {
                    ...definition.datasource,
                    query: {}
                },
                aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
            },
            permissions: { readReports: true },
            accessCondition:
                '("_upl_created_by" = $1 OR EXISTS (SELECT 1 FROM "app"."content_access_entries" rel WHERE rel."target_record_id"::text = "app"."obj_content_progress".id::text))',
            accessConditionValues: ['test-user-id'],
            limit: 25,
            offset: 0
        })

        const listSql = String(executor.query.mock.calls[0][0])
        expect(listSql).toContain('"_upl_created_by" = $1')
        expect(listSql).toContain('rel."target_record_id"::text = "app"."obj_content_progress".id::text')
        expect(executor.query.mock.calls[0][1]).toEqual(['test-user-id', '%Ava%', 25, 0])

        const countSql = String(executor.query.mock.calls[1][0])
        expect(countSql).toContain('"_upl_created_by" = $1')
        expect(executor.query.mock.calls[1][1]).toEqual(['test-user-id', '%Ava%'])

        const aggregationSql = String(executor.query.mock.calls[2][0])
        expect(aggregationSql).toContain('"_upl_created_by" = $1')
        expect(executor.query.mock.calls[2][1]).toEqual(['test-user-id', '%Ava%'])
    })

    it('projects REF report fields as resolved label objects when reference metadata is available', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()
        executor.query.mockResolvedValueOnce([
            {
                report_field_1: {
                    id: '018f8a78-7b8f-7c1d-a111-2222333346ff',
                    label: { en: 'Ava Learner', ru: 'Ава Учащаяся' }
                },
                report_field_2: 75
            }
        ])
        executor.query.mockResolvedValueOnce([{ total: '1' }])

        const result = await service.runRecordsListReport({
            executor,
            schemaName,
            tableName: 'obj_content_progress',
            fields: [
                {
                    codename: 'ProgressStudentId',
                    columnName: 'progress_student_id',
                    dataType: 'REF',
                    refTargetObjectId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
                    refTargetObjectKind: 'object',
                    referenceLabel: {
                        tableName: 'obj_students',
                        columnName: 'display_name',
                        dataType: 'STRING',
                        activeCondition: '_upl_deleted = false AND _app_deleted = false',
                        accessCondition: `_upl_created_by = $1 AND '$1 literal' = '$1 literal'`,
                        accessConditionValues: ['viewer-user-id']
                    }
                },
                { codename: 'ProgressPercent', columnName: 'progress_percent', dataType: 'NUMBER' }
            ],
            definition: {
                ...definition,
                datasource: {
                    ...definition.datasource,
                    query: {}
                },
                columns: [
                    { field: 'ProgressStudentId', label: 'Learner', type: 'text' },
                    { field: 'ProgressPercent', label: 'Progress', type: 'number' }
                ],
                filters: [],
                aggregations: []
            },
            permissions: { readReports: true },
            limit: 10,
            offset: 0
        })

        expect(result.rows).toEqual([
            {
                ProgressStudentId: {
                    id: '018f8a78-7b8f-7c1d-a111-2222333346ff',
                    label: { en: 'Ava Learner', ru: 'Ава Учащаяся' }
                },
                ProgressPercent: 75
            }
        ])

        const listSql = String(executor.query.mock.calls[0][0])
        expect(listSql).toContain(`LEFT JOIN (\n                SELECT id AS ref_id, "display_name" AS label_value`)
        expect(listSql).toContain(`FROM "${schemaName}"."obj_students"`)
        expect(listSql).toContain(`_upl_created_by = $1`)
        expect(listSql).toContain(`) "report_ref_label_1" ON "progress_student_id" = "report_ref_label_1".ref_id`)
        expect(listSql).toContain(`jsonb_build_object(`)
        expect(listSql).toContain(`WHEN "progress_student_id" IS NULL THEN NULL::jsonb`)
        expect(listSql).toContain(`ELSE jsonb_build_object(`)
        expect(listSql).not.toContain(`ELSE "progress_student_id"`)
        expect(listSql).toContain(`END AS "report_field_1"`)
        expect(executor.query.mock.calls[0][1]).toEqual(['viewer-user-id', 10, 0])

        const csv = serializeRuntimeReportCsv(result, 'en')
        expect(csv).toBe('Learner,Progress\r\nAva Learner,75\r\n')
        expect(csv).not.toContain('018f8a78-7b8f-7c1d-a111-2222333346')
    })

    it('filters REF report fields by resolved labels in list, count, and aggregation queries', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()
        executor.query
            .mockResolvedValueOnce([
                {
                    report_field_1: {
                        id: '018f8a78-7b8f-7c1d-a111-2222333346ff',
                        label: { en: 'Ava Learner', ru: 'Ава Учащаяся' }
                    },
                    report_field_2: 75
                }
            ])
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([{ average_progress: '75' }])

        const result = await service.runRecordsListReport({
            executor,
            schemaName,
            tableName: 'obj_content_progress',
            fields: [
                {
                    codename: 'ProgressStudentId',
                    columnName: 'progress_student_id',
                    dataType: 'REF',
                    refTargetObjectId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
                    refTargetObjectKind: 'object',
                    referenceLabel: {
                        tableName: 'obj_students',
                        columnName: 'display_name',
                        dataType: 'STRING',
                        activeCondition: '_upl_deleted = false AND _app_deleted = false',
                        accessCondition: `_upl_created_by = $1 AND '$1 literal' = '$1 literal'`,
                        accessConditionValues: ['viewer-user-id']
                    }
                },
                { codename: 'ProgressPercent', columnName: 'progress_percent', dataType: 'NUMBER' }
            ],
            definition: {
                ...definition,
                datasource: {
                    ...definition.datasource,
                    query: {
                        filters: [{ field: 'ProgressStudentId', operator: 'contains', value: 'Ava' }]
                    }
                },
                columns: [
                    { field: 'ProgressStudentId', label: 'Learner', type: 'text' },
                    { field: 'ProgressPercent', label: 'Progress', type: 'number' }
                ],
                filters: [],
                aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
            },
            permissions: { readReports: true },
            limit: 10,
            offset: 0
        })

        expect(result.total).toBe(1)
        expect(result.aggregations).toEqual({ AverageProgress: 75 })

        const listSql = String(executor.query.mock.calls[0][0])
        expect(listSql).toContain(`FROM "${schemaName}"."obj_students"`)
        expect(listSql).toContain(`_upl_created_by = $2`)
        expect(listSql).toContain(`'$1 literal' = '$1 literal'`)
        expect(listSql).toContain(`COALESCE("report_ref_label_1".label_value::text, "progress_student_id"::text) ILIKE $1 ESCAPE '\\'`)
        expect(executor.query.mock.calls[0][1]).toEqual(['%Ava%', 'viewer-user-id', 10, 0])

        const countSql = String(executor.query.mock.calls[1][0])
        expect(countSql).toContain(`FROM "${schemaName}"."obj_students"`)
        expect(countSql).toContain(`_upl_created_by = $2`)
        expect(countSql).toContain(`'$1 literal' = '$1 literal'`)
        expect(countSql).toContain(`COALESCE("report_ref_label_1".label_value::text, "progress_student_id"::text) ILIKE $1 ESCAPE '\\'`)
        expect(executor.query.mock.calls[1][1]).toEqual(['%Ava%', 'viewer-user-id'])

        const aggregationSql = String(executor.query.mock.calls[2][0])
        expect(aggregationSql).toContain(`FROM "${schemaName}"."obj_students"`)
        expect(aggregationSql).toContain(`_upl_created_by = $2`)
        expect(aggregationSql).toContain(`'$1 literal' = '$1 literal'`)
        expect(aggregationSql).toContain(
            `COALESCE("report_ref_label_1".label_value::text, "progress_student_id"::text) ILIKE $1 ESCAPE '\\'`
        )
        expect(executor.query.mock.calls[2][1]).toEqual(['%Ava%', 'viewer-user-id'])
    })

    it('fails closed when a report references fields outside validated metadata', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()

        await expect(
            service.runRecordsListReport({
                executor,
                schemaName,
                tableName: 'obj_content_progress',
                fields,
                permissions: { readReports: true },
                definition: {
                    ...definition,
                    columns: [{ field: 'MissingField', label: 'Missing', type: 'text' }]
                }
            })
        ).rejects.toThrow(UpdateFailure)

        expect(executor.query).not.toHaveBeenCalled()
    })

    it('rejects non-numeric sum and average aggregations before SQL is built', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()

        await expect(
            service.runRecordsListReport({
                executor,
                schemaName,
                tableName: 'obj_content_progress',
                fields,
                permissions: { readReports: true },
                definition: {
                    ...definition,
                    aggregations: [{ field: 'Learner', function: 'avg', alias: 'AverageLearner' }]
                }
            })
        ).rejects.toThrow(UpdateFailure)

        expect(executor.query).not.toHaveBeenCalled()
    })

    it('rejects duplicate aggregation output aliases before SQL is built', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()

        await expect(
            service.runRecordsListReport({
                executor,
                schemaName,
                tableName: 'obj_content_progress',
                fields,
                permissions: { readReports: true },
                definition: {
                    ...definition,
                    aggregations: [
                        { field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' },
                        { field: 'ProgressPercent', function: 'max', alias: 'AverageProgress' }
                    ]
                }
            })
        ).rejects.toMatchObject({
            body: expect.objectContaining({
                code: 'REPORT_AGGREGATION_ALIAS_DUPLICATE',
                alias: 'AverageProgress'
            })
        })

        expect(executor.query).not.toHaveBeenCalled()
    })

    it('rejects aggregation aliases that normalize to the same SQL alias before SQL is built', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()

        await expect(
            service.runRecordsListReport({
                executor,
                schemaName,
                tableName: 'obj_content_progress',
                fields,
                permissions: { readReports: true },
                definition: {
                    ...definition,
                    aggregations: [
                        { field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' },
                        { field: 'ProgressPercent', function: 'max', alias: 'average_progress' }
                    ]
                }
            })
        ).rejects.toMatchObject({
            body: expect.objectContaining({
                code: 'REPORT_AGGREGATION_SQL_ALIAS_DUPLICATE',
                alias: 'average_progress'
            })
        })

        expect(executor.query).not.toHaveBeenCalled()
    })

    it('rejects JSON/TABLE fields before SQL is built', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()

        await expect(
            service.runRecordsListReport({
                executor,
                schemaName,
                tableName: 'obj_content_progress',
                fields,
                permissions: { readReports: true },
                definition: {
                    ...definition,
                    columns: [{ field: 'Payload', label: 'Payload', type: 'text' }]
                }
            })
        ).rejects.toThrow(UpdateFailure)

        expect(executor.query).not.toHaveBeenCalled()
    })

    it('fails closed before SQL when the runtime role cannot read reports', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()

        await expect(
            service.runRecordsListReport({
                executor,
                schemaName,
                tableName: 'obj_content_progress',
                fields,
                definition,
                permissions: { readReports: false }
            })
        ).rejects.toThrow(UpdateFailure)

        expect(executor.query).not.toHaveBeenCalled()
    })

    it('serializes report rows to CSV using configured columns and escaping', () => {
        const csv = serializeRuntimeReportCsv({
            rows: [{ Learner: 'Ava, "One"', ProgressPercent: 100, Ignored: 'not exported' }],
            total: 1,
            aggregations: {},
            definition: {
                ...definition,
                columns: [
                    { field: 'Learner', label: 'Learner, Name', type: 'text' },
                    { field: 'ProgressPercent', label: 'Progress', type: 'number' }
                ]
            }
        })

        expect(csv).toBe('"Learner, Name",Progress\r\n"Ava, ""One""",100\r\n')
    })

    it('serializes localized report labels and values without leaking raw object JSON', () => {
        const localizedTitle = {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: { content: 'Title' },
                ru: { content: 'Заголовок' }
            }
        }

        const csv = serializeRuntimeReportCsv(
            {
                rows: [
                    {
                        Title: localizedTitle,
                        Payload: { id: '018f8a78-7b8f-7c1d-a111-2222333346ff', name: 'Readable payload' },
                        RawOnly: { id: '018f8a78-7b8f-7c1d-a111-2222333346aa', storageKey: 'private/source.json' },
                        Labels: [{ title: localizedTitle }, { id: 'ignored-id' }, 'Manual note']
                    }
                ],
                total: 1,
                aggregations: {},
                definition: {
                    ...definition,
                    columns: [
                        { field: 'Title', label: localizedTitle, type: 'text' },
                        { field: 'Payload', label: 'Payload', type: 'json' },
                        { field: 'RawOnly', label: 'Raw only', type: 'json' },
                        { field: 'Labels', label: 'Labels', type: 'json' }
                    ]
                }
            },
            'ru'
        )

        expect(csv).toBe('Заголовок,Payload,Raw only,Labels\r\nЗаголовок,Readable payload,,Заголовок; Manual note\r\n')
        expect(csv).not.toContain('{')
        expect(csv).not.toContain('}')
        expect(csv).not.toContain('018f8a78-7b8f-7c1d-a111-2222333346')
        expect(csv).not.toContain('storageKey')
    })

    it('suppresses primitive report ID values while preserving resolved object labels', () => {
        const csv = serializeRuntimeReportCsv({
            rows: [
                {
                    LearnerId: '018f8a78-7b8f-7c1d-a111-2222333346ff',
                    StableLearnerId: 'student-ava',
                    ResolvedLearnerId: { id: '018f8a78-7b8f-7c1d-a111-2222333346aa', displayName: 'Ava Learner' },
                    Note: 'Visible note',
                    Mixed: 'Ticket 018f8a78-7b8f-7c1d-a111-2222333346bb'
                }
            ],
            total: 1,
            aggregations: {},
            definition: {
                ...definition,
                columns: [
                    { field: 'LearnerId', label: 'Learner', type: 'text' },
                    { field: 'StableLearnerId', label: 'Stable learner', type: 'text' },
                    { field: 'ResolvedLearnerId', label: 'Resolved learner', type: 'text' },
                    { field: 'Note', label: 'Note', type: 'text' },
                    { field: 'Mixed', label: 'Mixed', type: 'text' }
                ]
            }
        })

        expect(csv).toBe(
            'Learner,Stable learner,Resolved learner,Note,Mixed\r\n,,Ava Learner,Visible note,Ticket 018f8a78-7b8f-7c1d-a111-2222333346bb\r\n'
        )
        expect(csv).not.toContain('018f8a78-7b8f-7c1d-a111-2222333346ff')
        expect(csv).not.toContain('018f8a78-7b8f-7c1d-a111-2222333346aa')
        expect(csv).not.toContain('student-ava')
    })
})
