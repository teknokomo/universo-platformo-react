import type { Request, Response } from 'express'
import { reportDefinitionSchema, type ReportDefinition } from '@universo-react/types'

const mockResolveRuntimeSchema = jest.fn()
const mockRuntimeQuery = jest.fn()
const mockCreateQueryHelper = jest.fn(() => mockRuntimeQuery)
const mockExecuteRuntimeRecordsUnionDatasource = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => {
    const actual = jest.requireActual('../../shared/runtimeHelpers')
    return {
        __esModule: true,
        ...actual,
        createQueryHelper: (...args: unknown[]) => mockCreateQueryHelper(...args),
        resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
    }
})

jest.mock('../../services/runtimeRowSupport/union/index', () => ({
    __esModule: true,
    executeRuntimeRecordsUnionDatasource: (...args: unknown[]) => mockExecuteRuntimeRecordsUnionDatasource(...args)
}))

import { createRuntimeReportsController } from '../../controllers/runtimeReportsController'
import { RuntimeReportsService } from '../../services/runtimeReportsService'
import { createMockDbExecutor } from '../utils/dbMocks'

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312200'
const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312200'
const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312277'
const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312290'
const reportRecordId = '019ccefc-2f7b-7b36-82f4-85cdb1312210'
const reportsObjectId = '019ccefc-2f7b-7b36-82f4-85cdb1312211'
const reportDefinitionComponentId = '019ccefc-2f7b-7b36-82f4-85cdb1312212'
const ownerComponentId = '019ccefc-2f7b-7b36-82f4-85cdb1312213'
const sharesObjectId = '019ccefc-2f7b-7b36-82f4-85cdb1312214'
const targetObjectId = '019ccefc-2f7b-7b36-82f4-85cdb1312215'

const reportsAccessConfig = {
    runtimeRecordAccess: { mode: 'ownerOrShared', ownerFieldCodename: 'OwnerId' },
    runtimeLibrary: {
        shared: {
            objectCodename: 'RecordShares',
            targetObjectFieldCodename: 'TargetObject',
            targetRecordFieldCodename: 'TargetRecord',
            principalTypeFieldCodename: 'PrincipalType',
            principalIdFieldCodename: 'PrincipalId',
            allowedPrincipalTypes: ['user']
        }
    }
}

const reportsObject = {
    id: reportsObjectId,
    codename: 'Reports',
    kind: 'object',
    table_name: 'obj_reports',
    config: reportsAccessConfig
}

const reportComponents = [
    {
        id: reportDefinitionComponentId,
        object_id: reportsObjectId,
        codename: 'Definition',
        column_name: 'report_definition',
        data_type: 'JSON',
        is_required: true
    },
    {
        id: ownerComponentId,
        object_id: reportsObjectId,
        codename: 'OwnerId',
        column_name: 'owner_id',
        data_type: 'UUID',
        is_required: false
    }
]

const sharesObject = {
    id: sharesObjectId,
    codename: 'RecordShares',
    kind: 'object',
    table_name: 'record_shares',
    config: {}
}

const sharesComponents = [
    ['TargetObject', 'target_object'],
    ['TargetRecord', 'target_record'],
    ['PrincipalType', 'principal_type'],
    ['PrincipalId', 'principal_id']
].map(([codename, column_name]) => ({ codename, column_name, data_type: 'STRING', is_required: false }))

const createResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn()
    }
    response.status.mockReturnValue(response)
    return response as unknown as Response & {
        status: jest.Mock
        json: jest.Mock
        setHeader: jest.Mock
        send: jest.Mock
    }
}

const queueInaccessibleReportSource = (executor: ReturnType<typeof createMockDbExecutor>['executor']) => {
    executor.query
        .mockResolvedValueOnce([reportsObject])
        .mockResolvedValueOnce(reportComponents)
        .mockResolvedValueOnce([sharesObject])
        .mockResolvedValueOnce(sharesComponents)
        .mockResolvedValueOnce([])
}

describe('runtimeReportsController saved report access', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it.each(['LearnerProgress', '019ccefc-2f7b-4b36-82f4-85cdb1312296'])(
        'rejects non-UUID-v7 reportId references before runtime lookup: %s',
        async (reportId) => {
            const { executor } = createMockDbExecutor()
            const controller = createRuntimeReportsController(() => executor)
            const req = { params: { applicationId }, body: { reportId } } as unknown as Request
            const res = createResponse()

            await controller.runReport(req, res)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid report payload' }))
            expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
            expect(executor.query).not.toHaveBeenCalled()
        }
    )

    it.each([
        { sort: [{ field: 'Score', direction: 'DESC' }] },
        { sort: [{ field: 'Score', direction: 'sideways' }] },
        {
            sort: [
                { field: 'Score', direction: 'asc' },
                { field: 'Score', direction: 'desc' }
            ]
        }
    ])('rejects malformed report sorting before runtime lookup: %j', async ({ sort }) => {
        const { executor } = createMockDbExecutor()
        const controller = createRuntimeReportsController(() => executor)
        const req = { params: { applicationId }, body: { reportCodename: 'LearnerProgress', sort } } as unknown as Request
        const res = createResponse()

        await controller.runReport(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid report payload' }))
        expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
        expect(executor.query).not.toHaveBeenCalled()
    })

    it.each([
        ['run', 'codename'],
        ['export', 'codename'],
        ['run', 'id'],
        ['export', 'id']
    ] as const)('does not %s an actor-inaccessible saved report referenced by %s', async (action, referenceKind) => {
        const { executor } = createMockDbExecutor()
        if (referenceKind === 'codename') {
            queueInaccessibleReportSource(executor)
        } else queueInaccessibleReportSource(executor)

        const permissions = {
            manageMembers: false,
            manageApplication: false,
            createContent: false,
            editContent: false,
            deleteContent: false,
            readReports: true
        }
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName,
            schemaIdent: `"${schemaName}"`,
            manager: executor,
            userId,
            role: 'member',
            permissions,
            workflowCapabilities: {},
            currentWorkspaceId: workspaceId,
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })

        const controller = createRuntimeReportsController(() => executor)
        const handler = action === 'run' ? controller.runReport : controller.exportReport
        const req = {
            params: { applicationId },
            body: referenceKind === 'codename' ? { reportCodename: 'LearnerProgress' } : { reportId: reportRecordId }
        } as unknown as Request
        const res = createResponse()

        await handler(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'Saved report was not found', code: 'REPORT_NOT_FOUND' })
        expect(res.setHeader).not.toHaveBeenCalled()
        expect(res.send).not.toHaveBeenCalled()

        const [reportLookupSql, reportLookupParams] = executor.query.mock.calls[executor.query.mock.calls.length - 1]
        expect(String(reportLookupSql)).toContain('"owner_id" = $1 OR EXISTS (')
        expect(String(reportLookupSql)).toContain(
            referenceKind === 'codename' ? '"report_definition"->>\'codename\' = $5' : '"report_record"."id"::text = $5'
        )
        expect(String(reportLookupSql)).not.toContain(
            referenceKind === 'codename' ? '"report_record"."id"::text = $5' : '"report_definition"->>\'codename\' = $5'
        )
        expect(String(reportLookupSql)).toContain("current_setting('app.current_workspace_id', true)")
        expect(reportLookupParams).toEqual([
            userId,
            'Reports',
            userId,
            ['user'],
            referenceKind === 'codename' ? 'LearnerProgress' : reportRecordId
        ])
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('"obj_content_progress"'))).toBe(false)
    })

    it('derives date composition from persisted field metadata before running and returning the report', async () => {
        const { executor } = createMockDbExecutor()
        const reportDefinition = reportDefinitionSchema.parse({
            codename: 'CompletionTimes',
            title: { en: 'Completion times' },
            datasource: { kind: 'records.list', objectCollectionCodename: 'CompletionRecords' },
            columns: [{ field: 'SubmittedAt', label: { en: 'Submitted at' }, type: 'date' }],
            filters: [],
            aggregations: []
        })
        executor.query
            .mockResolvedValueOnce([reportsObject])
            .mockResolvedValueOnce(reportComponents)
            .mockResolvedValueOnce([sharesObject])
            .mockResolvedValueOnce(sharesComponents)
            .mockResolvedValueOnce([{ definition: reportDefinition }])
            .mockResolvedValueOnce([
                { id: targetObjectId, codename: 'CompletionRecords', table_name: 'obj_completion_records', config: {} }
            ])
            .mockResolvedValueOnce([
                {
                    codename: 'SubmittedAt',
                    column_name: 'submitted_at',
                    data_type: 'DATE',
                    validation_rules: { dateComposition: 'date' }
                }
            ])
            .mockResolvedValueOnce([])

        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName,
            schemaIdent: `"${schemaName}"`,
            manager: executor,
            userId,
            role: 'member',
            permissions: {
                manageMembers: false,
                manageApplication: false,
                createContent: false,
                editContent: false,
                deleteContent: false,
                readReports: true
            },
            workflowCapabilities: {},
            currentWorkspaceId: workspaceId,
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })
        const runRecordsListReport = jest
            .spyOn(RuntimeReportsService.prototype, 'runRecordsListReport')
            .mockImplementationOnce(async (params) => ({
                rows: [],
                total: 0,
                aggregations: {},
                definition: params.definition as ReportDefinition
            }))
        const controller = createRuntimeReportsController(() => executor)
        const req = { params: { applicationId }, body: { reportCodename: 'CompletionTimes' } } as unknown as Request
        const res = createResponse()

        await controller.runReport(req, res)

        expect(runRecordsListReport).toHaveBeenCalledWith(
            expect.objectContaining({
                fields: expect.arrayContaining([expect.objectContaining({ codename: 'SubmittedAt', dateComposition: 'date' })]),
                definition: expect.objectContaining({
                    columns: [expect.objectContaining({ field: 'SubmittedAt', dateComposition: 'date' })]
                })
            })
        )
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                definition: expect.objectContaining({
                    columns: [expect.objectContaining({ field: 'SubmittedAt', dateComposition: 'date' })]
                })
            })
        )
        expect(
            executor.query.mock.calls.some(([sql]) => String(sql).includes('SELECT codename, column_name, data_type, validation_rules'))
        ).toBe(true)
    })

    it('derives date composition from records.union component metadata', async () => {
        const { executor } = createMockDbExecutor()
        const reportDefinition = reportDefinitionSchema.parse({
            codename: 'CompletionTimesUnion',
            title: { en: 'Completion times' },
            datasource: { kind: 'records.union', targets: [{ sectionCodename: 'CompletionRecords' }] },
            columns: [
                { field: 'SubmittedOn', label: { en: 'Submitted on' }, type: 'date' },
                { field: 'SubmittedAt', label: { en: 'Submitted at' }, type: 'date' }
            ],
            filters: [],
            aggregations: []
        })
        executor.query
            .mockResolvedValueOnce([reportsObject])
            .mockResolvedValueOnce(reportComponents)
            .mockResolvedValueOnce([sharesObject])
            .mockResolvedValueOnce(sharesComponents)
            .mockResolvedValueOnce([{ definition: reportDefinition }])
        mockExecuteRuntimeRecordsUnionDatasource.mockResolvedValueOnce({
            columns: [
                { field: 'SubmittedOn', dataType: 'DATE', validationRules: { dateComposition: 'date' } },
                { field: 'SubmittedAt', dataType: 'DATE', validationRules: { dateComposition: 'datetime' } }
            ],
            rows: [{ SubmittedOn: '2026-10-14', SubmittedAt: '2026-10-14T08:30:00.000Z' }],
            pagination: { total: 1 }
        })

        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName,
            schemaIdent: `"${schemaName}"`,
            manager: executor,
            userId,
            role: 'member',
            permissions: {
                manageMembers: false,
                manageApplication: false,
                createContent: false,
                editContent: false,
                deleteContent: false,
                readReports: true
            },
            workflowCapabilities: {},
            currentWorkspaceId: workspaceId,
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })

        const controller = createRuntimeReportsController(() => executor)
        const req = { params: { applicationId }, body: { reportCodename: 'CompletionTimesUnion' } } as unknown as Request
        const res = createResponse()

        await controller.runReport(req, res)

        expect(mockExecuteRuntimeRecordsUnionDatasource).toHaveBeenCalledTimes(1)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                definition: expect.objectContaining({
                    columns: [
                        expect.objectContaining({ field: 'SubmittedOn', dateComposition: 'date' }),
                        expect.objectContaining({ field: 'SubmittedAt', dateComposition: 'datetime' })
                    ]
                })
            })
        )
    })
})
