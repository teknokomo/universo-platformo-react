import { RuntimeReportsService } from '../../services/runtimeReportsService'
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
        sectionCodename: 'ModuleProgress',
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
            .mockResolvedValueOnce([{ learner: 'Ava', progress_percent: 100 }])
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([{ average_progress: '100' }])

        const result = await service.runRecordsListReport({
            executor,
            schemaName,
            tableName: 'cat_module_progress',
            fields,
            definition: {
                ...definition,
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
        expect(listSql).toContain(`"${schemaName}"."cat_module_progress"`)
        expect(listSql).toContain('SELECT "learner", "progress_percent"')
        expect(listSql).toContain('"completed_at" DESC NULLS LAST')
        expect(listSql).not.toContain('ModuleProgress')
        expect(executor.query.mock.calls[0][1]).toEqual([50, '%Ava%', 25, 0])

        const countSql = String(executor.query.mock.calls[1][0])
        expect(countSql).toContain('SELECT count(*) AS total')
        expect(executor.query.mock.calls[1][1]).toEqual([50, '%Ava%'])

        const aggregationSql = String(executor.query.mock.calls[2][0])
        expect(aggregationSql).toContain('SELECT AVG("progress_percent") AS "average_progress"')
        expect(executor.query.mock.calls[2][1]).toEqual([50, '%Ava%'])
    })

    it('fails closed when a report references fields outside validated metadata', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeReportsService()

        await expect(
            service.runRecordsListReport({
                executor,
                schemaName,
                tableName: 'cat_module_progress',
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
                tableName: 'cat_module_progress',
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
                tableName: 'cat_module_progress',
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
                tableName: 'cat_module_progress',
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
                tableName: 'cat_module_progress',
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
                tableName: 'cat_module_progress',
                fields,
                definition,
                permissions: { readReports: false }
            })
        ).rejects.toThrow(UpdateFailure)

        expect(executor.query).not.toHaveBeenCalled()
    })
})
