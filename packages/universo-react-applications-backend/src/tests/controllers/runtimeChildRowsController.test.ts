import type { Request, Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockResolveTabularContext = jest.fn()
const mockRuntimeQuery = jest.fn()
const mockResolveInterpretationNetworkRuntimeSurface = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => {
    const actual = jest.requireActual('../../shared/runtimeHelpers')
    return {
        __esModule: true,
        ...actual,
        createQueryHelper: () => mockRuntimeQuery,
        resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args),
        resolveTabularContext: (...args: unknown[]) => mockResolveTabularContext(...args)
    }
})

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkSurface', () => ({
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => mockResolveInterpretationNetworkRuntimeSurface(...args)
}))

import { createRuntimeChildRowsController } from '../../controllers/runtimeChildRowsController'
import { buildChildRowUpdate } from '../../controllers/runtimeChildRowsValidation'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { createMockDbExecutor } from '../utils/dbMocks'

const applicationId = '019f2000-0000-7000-8000-000000000001'
const recordId = '019f2000-0000-7000-8000-000000000002'
const componentId = '019f2000-0000-7000-8000-000000000003'
const childRowId = '019f2000-0000-7000-8000-000000000004'
const objectCollectionId = '019f2000-0000-7000-8000-000000000005'

const childAttrs = [
    {
        id: 'cell-id-component',
        codename: 'CellId',
        column_name: 'cell_id',
        data_type: 'STRING',
        is_required: true,
        validation_rules: {},
        ui_config: { serverOwned: true }
    },
    {
        id: 'title-component',
        codename: 'CellValue',
        column_name: 'cell_value',
        data_type: 'STRING',
        is_required: false,
        validation_rules: {},
        ui_config: {}
    }
]

const tabularContext = {
    error: null,
    object: { id: objectCollectionId, codename: 'Interpretation', table_name: 'interpretation', config: {} },
    lifecycleContract: resolveApplicationLifecycleContractFromConfig({}),
    tableAttr: {
        id: componentId,
        codename: 'InterpretationMatrix',
        column_name: 'interpretation_matrix_rows',
        data_type: 'TABLE',
        validation_rules: {}
    },
    tabTableName: 'interpretation_matrix_rows',
    tabTableIdent: 'runtime_schema."interpretation_matrix_rows"',
    parentTableIdent: 'runtime_schema."interpretation"',
    childAttrs
}

const createResponse = () => {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return { status, json } as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

const createRequest = (body: unknown): Request =>
    ({
        params: { applicationId, recordId, componentId, childRowId },
        query: { objectCollectionId },
        body
    } as unknown as Request)

describe('runtime child row seed ownership contract', () => {
    it('only emits seed ownership mutations for workspace-enabled tables', async () => {
        const { executor } = createMockDbExecutor()
        const context = tabularContext as Parameters<typeof buildChildRowUpdate>[2]

        const nonWorkspaceUpdate = await buildChildRowUpdate(executor, 'runtime_schema', context, { CellValue: 'edited' }, 'user-1', false)
        const workspaceUpdate = await buildChildRowUpdate(executor, 'runtime_schema', context, { CellValue: 'edited' }, 'user-1', true)

        expect('error' in nonWorkspaceUpdate).toBe(false)
        expect('error' in workspaceUpdate).toBe(false)
        if ('error' in nonWorkspaceUpdate || 'error' in workspaceUpdate) return
        expect(nonWorkspaceUpdate.setClauses).not.toContain('_seed_source_owned = false')
        expect(workspaceUpdate.setClauses).toContain('_seed_source_owned = false')
    })
})

describe('runtimeChildRowsController server-owned field enforcement', () => {
    let executor: ReturnType<typeof createMockDbExecutor>['executor']

    beforeEach(() => {
        jest.clearAllMocks()
        executor = createMockDbExecutor().executor
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            permissions: { createContent: true, editContent: true, deleteContent: true },
            currentWorkspaceId: null,
            workspacesEnabled: false
        })
        mockResolveTabularContext.mockResolvedValue(tabularContext)
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'multiple',
            resolvedObjects: { Interpretation: objectCollectionId }
        })
    })

    it.each([
        {
            label: 'create by codename',
            run: (controller: ReturnType<typeof createRuntimeChildRowsController>, res: Response) =>
                controller.createChildRow(createRequest({ data: { CellId: childRowId } }), res)
        },
        {
            label: 'update by physical column',
            run: (controller: ReturnType<typeof createRuntimeChildRowsController>, res: Response) =>
                controller.updateChildRow(createRequest({ data: { cell_id: childRowId } }), res)
        },
        {
            label: 'batch update',
            run: (controller: ReturnType<typeof createRuntimeChildRowsController>, res: Response) =>
                controller.batchUpdateChildRows(createRequest({ updates: [{ childRowId, data: { CellId: childRowId } }] }), res)
        },
        {
            label: 'uniform batch update',
            run: (controller: ReturnType<typeof createRuntimeChildRowsController>, res: Response) =>
                controller.batchUpdateChildRows(
                    createRequest({
                        updates: [{ childRowId: '019f2000-0000-7000-8000-000000000006', data: { _tp_sort_order: 1 } }],
                        uniformUpdates: [{ rows: [{ childRowId }], data: { CellId: childRowId } }]
                    }),
                    res
                )
        }
    ])('rejects client-supplied server-owned fields for $label before mutation', async ({ run }) => {
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await run(controller, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Field is server-owned: InterpretationMatrix.CellId'
        })
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('requires both createContent and editContent for generic child creation', async () => {
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            permissions: { createContent: false, editContent: true, deleteContent: true },
            currentWorkspaceId: null,
            workspacesEnabled: false
        })
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await controller.createChildRow(createRequest({ data: {} }), res)

        expect(res.status).toHaveBeenCalledWith(403)
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('rejects legacy unwrapped child create payloads', async () => {
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await controller.createChildRow(createRequest({ CellValue: 'legacy' }), res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid body' }))
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('rejects Matrix sort placement through the generic batch route', async () => {
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            tableAttr: {
                ...tabularContext.tableAttr,
                validation_rules: { matrixUniqueCoordinates: true }
            }
        })
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await controller.batchUpdateChildRows(createRequest({ updates: [{ childRowId, data: { _tp_sort_order: 1 } }] }), res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Matrix placement is server-owned; use the Matrix cell command'
        })
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('rejects Matrix creation through the generic child route', async () => {
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            tableAttr: {
                ...tabularContext.tableAttr,
                validation_rules: { matrixUniqueCoordinates: true }
            }
        })
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await controller.createChildRow(createRequest({ data: { CellValue: 'Cell' } }), res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Matrix cells must be created through the server-owned Matrix cell command'
        })
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it.each([
        [
            'copy',
            (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.copyChildRow(req, res)
        ],
        [
            'delete',
            (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.deleteChildRow(req, res)
        ]
    ])('blocks canonical Matrix child %s through generic routes in single-system mode', async (_label, run) => {
        const structureId = '019f2000-0000-7000-8000-000000000010'
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'singleSystem',
            resolvedObjects: { Interpretation: objectCollectionId },
            contracts: {
                Interpretation: { fields: { ParentStructure: { column_name: 'parent_structure' } } },
                Structure: { object: { table_name: 'structure' }, fields: { SystemKey: { column_name: 'system_key' } } }
            }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation"')) return [{ parent_structure: structureId }]
            if (sql.includes('FROM runtime_schema."structure"')) return [{ system_key: 'primary' }]
            return []
        })
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await run(controller, createRequest({ expectedVersion: 1 }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'INTERPRETATION_NETWORK_CANONICAL_MATRIX_IMMUTABLE' })
        )
        const guardQueries = executor.query.mock.calls.map(([sql]) => String(sql))
        expect(guardQueries.some((sql) => sql.includes('_upl_deleted = false') && sql.includes('_app_deleted = false'))).toBe(true)
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it.each([
        [
            'copy',
            (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.copyChildRow(req, res)
        ],
        [
            'delete',
            (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.deleteChildRow(req, res)
        ]
    ])('fails closed for generic child %s when the runtime widget context is ambiguous', async (_label, run) => {
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ambiguous-widget',
            structureMode: 'multiple',
            resolvedObjects: {}
        })
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await run(controller, createRequest({ expectedVersion: 1 }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('marks a soft-deleted workspace seed child row as authored', async () => {
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            permissions: { createContent: true, editContent: true, deleteContent: true },
            currentWorkspaceId: '019f2000-0000-7000-8000-000000000010',
            workspacesEnabled: true
        })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'missing-widget',
            structureMode: 'multiple',
            resolvedObjects: {}
        })
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            lifecycleContract: resolveApplicationLifecycleContractFromConfig({
                systemFields: { lifecycleContract: { delete: { mode: 'soft' } } }
            })
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation"')) {
                return [{ id: recordId, _upl_locked: false }]
            }
            if (sql.includes('SELECT id, COALESCE(_upl_version, 1)::int AS version')) {
                return [{ id: childRowId, version: 1 }]
            }
            if (sql.includes('COUNT(*)::int AS cnt')) return [{ cnt: 1 }]
            if (sql.includes('UPDATE runtime_schema."interpretation_matrix_rows"')) return [{ id: childRowId }]
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()
        await controller.deleteChildRow(createRequest({ expectedVersion: 1 }), res)

        expect(res.json).toHaveBeenCalledWith({ status: 'deleted' })
        const deleteCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('UPDATE runtime_schema."interpretation_matrix_rows"')
        )
        expect(String(deleteCall?.[0])).toContain('_seed_source_owned = false')
    })
})
