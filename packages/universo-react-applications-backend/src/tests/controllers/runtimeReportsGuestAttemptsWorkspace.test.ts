import type { Request, Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockCreateQueryHelper = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => {
    const actual = jest.requireActual('../../shared/runtimeHelpers')
    return {
        ...actual,
        createQueryHelper: (...args: unknown[]) => mockCreateQueryHelper(...args),
        resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
    }
})
jest.mock('../../persistence/savedRuntimeReportSourceStore', () => {
    const actual = jest.requireActual('../../persistence/savedRuntimeReportSourceStore')
    return {
        ...actual,
        loadSavedRuntimeReportSource: jest.fn(),
        loadSavedRuntimeReportSourceById: jest.fn()
    }
})
jest.mock('../../services/publicGuestRuntimeConfig', () => ({
    ...jest.requireActual('../../services/publicGuestRuntimeConfig'),
    resolvePublicGuestRuntimeConfig: jest.fn()
}))
jest.mock('../../services/guestAssessmentRuntimeTables', () => ({
    ...jest.requireActual('../../services/guestAssessmentRuntimeTables'),
    resolveGuestAssessmentRuntimeTables: jest.fn()
}))
jest.mock('../../services/guestAssessmentAttemptLifecycleService', () => ({
    ...jest.requireActual('../../services/guestAssessmentAttemptLifecycleService'),
    reconcileExpiredGuestAssessmentAttempts: jest.fn()
}))
jest.mock('../../services/runtimeWorkspaceContext', () => ({
    ...jest.requireActual('../../services/runtimeWorkspaceContext'),
    lockActiveRuntimeWorkspaceContext: jest.fn()
}))
jest.mock('../../services/runtimeRowSupport/access', () => ({
    ...jest.requireActual('../../services/runtimeRowSupport/access'),
    buildRuntimeRecordAccessClause: jest.fn()
}))
jest.mock('../../controllers/runtimeRowSupport/objects', () => ({
    ...jest.requireActual('../../controllers/runtimeRowSupport/objects'),
    loadRuntimeObjectAttrs: jest.fn()
}))

import { createRuntimeReportsController } from '../../controllers/runtimeReportsController'
import { loadSavedRuntimeReportSource } from '../../persistence/savedRuntimeReportSourceStore'
import { reconcileExpiredGuestAssessmentAttempts } from '../../services/guestAssessmentAttemptLifecycleService'
import { resolveGuestAssessmentRuntimeTables } from '../../services/guestAssessmentRuntimeTables'
import { resolvePublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import { lockActiveRuntimeWorkspaceContext } from '../../services/runtimeWorkspaceContext'
import { buildRuntimeRecordAccessClause } from '../../services/runtimeRowSupport/access'
import { loadRuntimeObjectAttrs } from '../../controllers/runtimeRowSupport/objects'
import { RuntimeReportsService } from '../../services/runtimeReportsService'
import { createMockDbExecutor } from '../utils/dbMocks'

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312200'
const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312200'
const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312277'
const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312290'
const attemptsObjectId = '019ccefc-2f7b-7b36-82f4-85cdb1312291'
const config = {
    assessment: {
        objects: {
            assessmentAttempts: 'QuizAttempts',
            assessmentResponses: 'QuizResponses'
        }
    }
} as never
const reportDefinition = {
    codename: 'GuestQuizAttempts',
    title: { en: 'Guest quiz attempts' },
    datasource: { kind: 'records.list', sectionCodename: 'QuizAttempts' },
    columns: [{ field: 'Status', label: 'Status', type: 'text' }],
    filters: [],
    aggregations: []
} as const
const attemptTable = { schemaName, tableName: 'obj_quiz_attempts', workspaceId, columns: {} }
const responseTable = { schemaName, tableName: 'obj_quiz_responses', workspaceId, columns: {} }
const tables = { attemptTable, responseTable } as never
const successfulResult = { rows: [], total: 0, aggregations: {}, definition: reportDefinition }

const createResponse = () => {
    const response = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn(), send: jest.fn() }
    response.status.mockReturnValue(response)
    response.json.mockReturnValue(response)
    return response as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

describe('runtime guest-attempt reports and workspace lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockCreateQueryHelper.mockReturnValue(jest.fn())
        mockResolveRuntimeSchema.mockImplementation(async () => {
            const { executor } = createMockDbExecutor()
            return {
                schemaName,
                schemaIdent: `"${schemaName}"`,
                manager: executor,
                userId,
                role: 'owner',
                permissions: {
                    manageMembers: true,
                    manageApplication: true,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: true
                },
                workflowCapabilities: {},
                currentWorkspaceId: workspaceId,
                workspacesEnabled: true,
                baseApplicationSettings: {},
                applicationSettings: { publicRuntime: { guest: {} } }
            }
        })
        jest.mocked(loadSavedRuntimeReportSource).mockResolvedValue(reportDefinition as never)
        jest.mocked(resolvePublicGuestRuntimeConfig).mockReturnValue(config)
        jest.mocked(resolveGuestAssessmentRuntimeTables).mockResolvedValue(tables)
        jest.mocked(reconcileExpiredGuestAssessmentAttempts).mockResolvedValue({ finalized: 0 } as never)
        jest.mocked(lockActiveRuntimeWorkspaceContext).mockResolvedValue(true)
        jest.mocked(buildRuntimeRecordAccessClause).mockResolvedValue(null)
        jest.mocked(loadRuntimeObjectAttrs).mockResolvedValue([{ codename: 'Status', column_name: 'status', data_type: 'STRING' }] as never)
        jest.spyOn(RuntimeReportsService.prototype, 'runRecordsListReport').mockResolvedValue(successfulResult as never)
    })

    const invokeReport = async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName,
            schemaIdent: `"${schemaName}"`,
            manager: executor,
            userId,
            role: 'owner',
            permissions: {
                manageMembers: true,
                manageApplication: true,
                createContent: true,
                editContent: true,
                deleteContent: true,
                readReports: true
            },
            workflowCapabilities: {},
            currentWorkspaceId: workspaceId,
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: { publicRuntime: { guest: {} } }
        } as never)
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('._app_objects')) {
                return [{ id: attemptsObjectId, codename: 'QuizAttempts', table_name: 'obj_quiz_attempts', config: {} }]
            }
            if (sql.includes('._app_components')) return [{ codename: 'Status', column_name: 'status', data_type: 'STRING' }]
            return []
        })
        const controller = createRuntimeReportsController(() => executor)
        const req = { params: { applicationId }, body: { reportCodename: 'GuestQuizAttempts' } } as unknown as Request
        const res = createResponse()

        await controller.runReport(req, res)

        return { executor, txExecutor, res }
    }

    it('locks the active report workspace and reconciles expired attempts before returning rows', async () => {
        const { txExecutor, res } = await invokeReport()

        expect(lockActiveRuntimeWorkspaceContext).toHaveBeenCalledWith(txExecutor, schemaName, workspaceId)
        expect(resolveGuestAssessmentRuntimeTables).toHaveBeenCalledWith(txExecutor, schemaName, config, workspaceId)
        expect(reconcileExpiredGuestAssessmentAttempts).toHaveBeenCalledWith(txExecutor, attemptTable, responseTable)
        expect(RuntimeReportsService.prototype.runRecordsListReport).toHaveBeenCalled()
        expect(res.json).toHaveBeenCalledWith(successfulResult)
    })

    it('fails closed for a workspace archived before the report lock and skips attempt reconciliation', async () => {
        jest.mocked(lockActiveRuntimeWorkspaceContext).mockResolvedValueOnce(false)

        const { txExecutor, res } = await invokeReport()

        expect(lockActiveRuntimeWorkspaceContext).toHaveBeenCalledWith(txExecutor, schemaName, workspaceId)
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'Report workspace is unavailable', code: 'REPORT_WORKSPACE_UNAVAILABLE' })
        expect(reconcileExpiredGuestAssessmentAttempts).not.toHaveBeenCalled()
        expect(RuntimeReportsService.prototype.runRecordsListReport).not.toHaveBeenCalled()
    })
})
