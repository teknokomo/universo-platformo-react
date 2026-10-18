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
import { buildChildRowUpdate, getSafeRuntimeChildAttrs } from '../../controllers/runtimeChildRowsValidation'
import { issueRuntimeRecordHandle } from '../../services/runtimeRecordHandle'
import { isUuidV7, resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
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

const createRequest = (body: unknown, parentRecordReference = recordId): Request =>
    ({
        params: { applicationId, recordId: parentRecordReference, componentId, childRowId },
        query: { objectCollectionId },
        body
    } as unknown as Request)

const sharedParentAccessConfig = {
    runtimeLibrary: {
        shared: {
            objectCodename: 'ContentAccessEntries',
            targetObjectFieldCodename: 'TargetObjectCodename',
            targetRecordFieldCodename: 'TargetRecordId',
            principalTypeFieldCodename: 'PrincipalType',
            principalIdFieldCodename: 'PrincipalId',
            accessLevelFieldCodename: 'AccessLevel',
            allowedPrincipalTypes: ['workspaceMember', 'user']
        }
    },
    runtimeRecordAccess: {
        mode: 'ownerOrShared',
        ownerColumnName: '_upl_created_by',
        sharedRelationKey: 'shared'
    }
}

const sharedAccessComponents = [
    { id: 'target-object', codename: 'TargetObjectCodename', column_name: 'target_object_codename', data_type: 'STRING' },
    { id: 'target-record', codename: 'TargetRecordId', column_name: 'target_record_id', data_type: 'STRING' },
    { id: 'principal-type', codename: 'PrincipalType', column_name: 'principal_type', data_type: 'STRING' },
    { id: 'principal-id', codename: 'PrincipalId', column_name: 'principal_id', data_type: 'STRING' },
    { id: 'access-level', codename: 'AccessLevel', column_name: 'access_level', data_type: 'STRING' }
]

const configureDeniedParentAccess = (executor: ReturnType<typeof createMockDbExecutor>['executor']) => {
    mockResolveTabularContext.mockResolvedValue({
        ...tabularContext,
        object: { ...tabularContext.object, config: sharedParentAccessConfig }
    })
    executor.query.mockImplementation(async (sql: string, values: unknown[] = []) => {
        if (sql.includes('FROM runtime_schema._app_objects')) {
            return [{ id: 'access-object-id', codename: 'ContentAccessEntries', table_name: 'content_access_entries', config: null }]
        }
        if (sql.includes('FROM runtime_schema._app_components')) {
            return values[0] === 'access-object-id' ? sharedAccessComponents : []
        }
        if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) return []
        return []
    })
    executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))
}

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

    it('regenerates configured UUID v7 keys and resets row ordering when copying a child row', async () => {
        const newChildRowId = '019f2000-0000-7000-8000-000000000008'
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            childAttrs: [
                {
                    id: 'block-key',
                    codename: 'BlockKey',
                    column_name: 'block_key',
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: {},
                    ui_config: { hidden: true, resetOnCopy: true, generateUuidV7: true }
                },
                {
                    id: 'block-title',
                    codename: 'Title',
                    column_name: 'block_title',
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: {},
                    ui_config: {}
                },
                {
                    id: 'block-order',
                    codename: 'SortOrder',
                    column_name: 'sort_order',
                    data_type: 'NUMBER',
                    is_required: false,
                    validation_rules: {},
                    ui_config: { hidden: true, resetOnCopy: true, defaultValue: 0 }
                }
            ]
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('SELECT *') && sql.includes('FROM runtime_schema."interpretation_matrix_rows"')) {
                return [
                    {
                        id: childRowId,
                        _tp_parent_id: recordId,
                        _tp_sort_order: 2,
                        block_key: '019f2000-0000-7000-8000-000000000009',
                        block_title: 'Opening',
                        sort_order: 2
                    }
                ]
            }
            if (sql.includes('COUNT(*)::int AS cnt')) return [{ cnt: 1 }]
            if (sql.includes('INSERT INTO runtime_schema."interpretation_matrix_rows"')) return [{ id: newChildRowId }]
            return []
        })

        const response = createResponse()
        await createRuntimeChildRowsController(() => executor).copyChildRow(createRequest({}), response)

        expect(response.status).toHaveBeenCalledWith(201)
        const insertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('INSERT INTO runtime_schema."interpretation_matrix_rows"')
        )
        const insertValues = insertCall?.[1] as unknown[] | undefined
        expect(insertValues?.[1]).toBe(3)
        expect(insertValues?.[3]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        expect(insertValues?.[3]).not.toBe('019f2000-0000-7000-8000-000000000009')
        expect(insertValues?.[5]).toBe(0)
    })

    it('rolls back a copied generated-key row when existing required sibling selections would become invalid', async () => {
        const newChildRowId = '019f2000-0000-7000-8000-00000000000a'
        const blockKey = '019f2000-0000-7000-8000-00000000000b'
        let copiedRowPersisted = false
        let transactionRolledBack = false
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            object: { ...tabularContext.object, codename: 'Quiz' },
            tableAttr: { ...tabularContext.tableAttr, id: 'blocks-table', codename: 'Blocks', column_name: 'blocks_rows' },
            tabTableName: 'blocks_rows',
            tabTableIdent: 'runtime_schema."blocks_rows"',
            parentTableIdent: 'runtime_schema."quiz"',
            childAttrs: [
                {
                    id: 'block-key',
                    codename: 'BlockKey',
                    column_name: 'block_key',
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: {},
                    ui_config: { serverOwned: true, siblingRowSelectKey: true, generateUuidV7: true }
                }
            ]
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => {
            try {
                return await fn(executor)
            } catch (error) {
                copiedRowPersisted = false
                transactionRolledBack = true
                throw error
            }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."quiz" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('SELECT *') && sql.includes('FROM runtime_schema."blocks_rows"')) {
                return [{ id: childRowId, _tp_parent_id: recordId, _tp_sort_order: 1, block_key: blockKey }]
            }
            if (sql.includes('COUNT(*)::int AS cnt')) return [{ cnt: 1 }]
            if (sql.includes('INSERT INTO runtime_schema."blocks_rows"')) {
                copiedRowPersisted = true
                return [{ id: newChildRowId }]
            }
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE object_id = $1')) {
                return [{ id: 'blocks-table', column_name: 'blocks_rows' }]
            }
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE parent_component_id = $1')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('AS required_with_rows')) {
                return [{ table_name: 'questions_rows', value_column: 'block_key', required_with_rows: 'true' }]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks_rows"')) return [{ block_key: blockKey }]
            if (sql.includes('SELECT "block_key" FROM runtime_schema."questions_rows"')) return [{ block_key: null }]
            return []
        })

        const response = createResponse()
        await createRuntimeChildRowsController(() => executor).copyChildRow(createRequest({}), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith({ error: 'A sibling row selection is required while target rows exist' })
        expect(transactionRolledBack).toBe(true)
        expect(copiedRowPersisted).toBe(false)
        const insertIndex = executor.query.mock.calls.findIndex(([sql]) => String(sql).includes('INSERT INTO runtime_schema."blocks_rows"'))
        const dependentRowsCheckIndex = executor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('SELECT "block_key" FROM runtime_schema."questions_rows"')
        )
        expect(insertIndex).toBeGreaterThanOrEqual(0)
        expect(dependentRowsCheckIndex).toBeGreaterThan(insertIndex)
    })

    it('rejects direct creation of a sibling block with no related questions and rolls back the row', async () => {
        const newChildRowId = '019f2000-0000-7000-8000-00000000000c'
        let generatedBlockKey = ''
        let blockPersisted = false
        let transactionRolledBack = false
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            object: { ...tabularContext.object, codename: 'Quiz' },
            tableAttr: { ...tabularContext.tableAttr, id: 'blocks-table', codename: 'Blocks', column_name: 'blocks_rows' },
            tabTableName: 'blocks_rows',
            tabTableIdent: 'runtime_schema."blocks_rows"',
            parentTableIdent: 'runtime_schema."quiz"',
            childAttrs: [
                {
                    id: 'block-key',
                    codename: 'BlockKey',
                    column_name: 'block_key',
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: {},
                    ui_config: { serverOwned: true, siblingRowSelectKey: true, generateUuidV7: true }
                },
                {
                    id: 'block-title',
                    codename: 'Title',
                    column_name: 'title',
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: {},
                    ui_config: {}
                }
            ]
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => {
            try {
                return await fn(executor)
            } catch (error) {
                blockPersisted = false
                transactionRolledBack = true
                throw error
            }
        })
        executor.query.mockImplementation(async (sql: string, values: unknown[] = []) => {
            if (sql.includes('FROM runtime_schema."quiz" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('AS require_each_target_referenced')) {
                return [
                    {
                        table_name: 'questions_rows',
                        value_column: 'block_key',
                        required_with_rows: 'true',
                        require_each_target_referenced: 'true'
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE object_id = $1')) {
                return [{ id: 'blocks-table', column_name: 'blocks_rows' }]
            }
            if (sql.includes('FROM runtime_schema._app_components') && sql.includes('WHERE parent_component_id = $1')) {
                return [
                    {
                        column_name: 'block_key',
                        data_type: 'STRING',
                        ui_config: { siblingRowSelectKey: true, generateUuidV7: true }
                    }
                ]
            }
            if (sql.includes('COUNT(*)::int AS cnt')) return [{ cnt: 0 }]
            if (sql.includes('INSERT INTO runtime_schema."blocks_rows"')) {
                generatedBlockKey = String(values[3])
                blockPersisted = true
                return [
                    {
                        id: newChildRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        block_key: generatedBlockKey,
                        title: 'Opening'
                    }
                ]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."blocks_rows"')) {
                return [{ block_key: generatedBlockKey }]
            }
            if (sql.includes('SELECT "block_key" FROM runtime_schema."questions_rows"')) return []
            return []
        })

        const response = createResponse()
        await createRuntimeChildRowsController(() => executor).createChildRow(createRequest({ data: { Title: 'Opening' } }), response)

        expect(isUuidV7(generatedBlockKey)).toBe(true)
        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith({
            code: 'RUNTIME_SIBLING_TARGET_UNREFERENCED',
            error: 'Every sibling target row must be referenced by at least one source row'
        })
        expect(transactionRolledBack).toBe(true)
        expect(blockPersisted).toBe(false)
        const insertIndex = executor.query.mock.calls.findIndex(([sql]) => String(sql).includes('INSERT INTO runtime_schema."blocks_rows"'))
        const dependentRowsCheckIndex = executor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('SELECT "block_key" FROM runtime_schema."questions_rows"')
        )
        expect(insertIndex).toBeGreaterThanOrEqual(0)
        expect(dependentRowsCheckIndex).toBeGreaterThan(insertIndex)
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
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await run(controller, createRequest({ expectedVersion: 1 }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'INTERPRETATION_NETWORK_CANONICAL_MATRIX_IMMUTABLE' })
        )
        const guardQueries = executor.query.mock.calls.map(([sql]) => String(sql))
        expect(guardQueries.some((sql) => sql.includes('_upl_deleted = false') && sql.includes('_app_deleted = false'))).toBe(true)
        expect(executor.transaction).toHaveBeenCalled()
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
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) {
                return [{ id: recordId, _upl_locked: false }]
            }
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await run(controller, createRequest({ expectedVersion: 1 }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
        expect(executor.transaction).toHaveBeenCalled()
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

describe('runtimeChildRowsController parent record access', () => {
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
    })

    it('denies a parent row outside owner/shared read access before querying child rows', async () => {
        configureDeniedParentAccess(executor)
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await controller.listChildRows(createRequest(undefined), res)

        expect(res.status).toHaveBeenCalledWith(404)
        const parentAccessCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('FROM runtime_schema."interpretation" AS parentRecord')
        )
        expect(String(parentAccessCall?.[0])).toContain('"_upl_created_by" = $2')
        expect(String(parentAccessCall?.[0])).toContain('EXISTS (')
        expect(String(parentAccessCall?.[0])).not.toContain("= 'canedit'")
        expect(parentAccessCall?.[1]).toContain('Interpretation')
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('FROM runtime_schema."interpretation_matrix_rows"'))).toBe(
            false
        )
    })

    it('caps child-row page size while preserving a valid offset', async () => {
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) {
                return [{ id: recordId, _upl_locked: false }]
            }
            if (sql.includes('COUNT(*)::int AS total')) return [{ total: 0 }]
            return []
        })
        const req = createRequest(undefined)
        req.query.limit = '50000'
        req.query.offset = '7'
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await controller.listChildRows(req, res)

        const childListCall = executor.query.mock.calls.find(([sql]) => String(sql).includes('LIMIT $2 OFFSET $3'))
        expect(childListCall?.[1]).toEqual([recordId, 1000, 7])
    })

    it.each([
        {
            action: 'create',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.createChildRow(req, res),
            body: { data: { CellValue: 'new' } }
        },
        {
            action: 'update',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.updateChildRow(req, res),
            body: { data: { CellValue: 'changed' } }
        },
        {
            action: 'batch update',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.batchUpdateChildRows(req, res),
            body: { updates: [{ childRowId, data: { CellValue: 'changed' } }] }
        },
        {
            action: 'copy',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.copyChildRow(req, res),
            body: {}
        },
        {
            action: 'delete',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.deleteChildRow(req, res),
            body: {}
        }
    ])('requires parent edit access before child $action', async ({ invoke, body }) => {
        configureDeniedParentAccess(executor)
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await invoke(controller, createRequest(body), res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(executor.transaction).toHaveBeenCalled()
        const parentAccessCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('FROM runtime_schema."interpretation" AS parentRecord')
        )
        expect(String(parentAccessCall?.[0])).toContain('LOWER(rel."access_level"::text) = \'canedit\'')
        expect(parentAccessCall?.[1]).toContain('Interpretation')
        const childWriteSql = executor.query.mock.calls.map(([sql]) => String(sql))
        expect(
            childWriteSql.some((sql) =>
                ['INSERT INTO', 'UPDATE', 'DELETE FROM'].some((operation) =>
                    sql.includes(`${operation} runtime_schema."interpretation_matrix_rows"`)
                )
            )
        ).toBe(false)
    })

    it('binds shared access to the canonical Object codename for a live parent record handle', async () => {
        configureDeniedParentAccess(executor)
        const parentHandle = issueRuntimeRecordHandle({
            applicationId,
            workspaceId: null,
            entityCodename: 'Interpretation',
            recordId
        })
        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()

        await controller.updateChildRow(createRequest({ data: { CellValue: 'changed' } }, parentHandle), res)

        expect(res.status).toHaveBeenCalledWith(404)
        const parentAccessCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('FROM runtime_schema."interpretation" AS parentRecord')
        )
        expect(parentAccessCall?.[1]?.[0]).toBe(recordId)
        expect(parentAccessCall?.[1]).toContain('Interpretation')
        expect(String(parentAccessCall?.[0])).toContain('LOWER(rel."access_level"::text) = \'canedit\'')
    })
})

describe('runtimeChildRowsController safe child field projection', () => {
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
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            childAttrs: [
                childAttrs[1],
                { id: 'hidden', codename: 'HiddenValue', column_name: 'hidden_value', data_type: 'STRING', ui_config: { hidden: true } },
                {
                    id: 'grid-hidden',
                    codename: 'GridHidden',
                    column_name: 'grid_hidden',
                    data_type: 'STRING',
                    ui_config: { gridHidden: true }
                },
                {
                    id: 'form-hidden',
                    codename: 'FormHidden',
                    column_name: 'form_hidden',
                    data_type: 'STRING',
                    ui_config: { formHidden: true }
                },
                { id: 'sensitive', codename: 'Email', column_name: 'email', data_type: 'STRING', ui_config: {} },
                {
                    id: 'private',
                    codename: 'PrivateValue',
                    column_name: 'private_value',
                    data_type: 'STRING',
                    ui_config: { private: true }
                },
                { id: 'owned', codename: 'OwnedValue', column_name: 'owned_value', data_type: 'STRING', ui_config: { serverOwned: true } },
                { id: 'technical', codename: 'RecordId', column_name: 'record_id', data_type: 'STRING', ui_config: {} },
                { id: 'json', codename: 'JsonValue', column_name: 'json_value', data_type: 'JSON', ui_config: {} },
                { id: 'table', codename: 'NestedRows', column_name: 'nested_rows', data_type: 'TABLE', ui_config: {} },
                {
                    id: 'resource',
                    codename: 'ResourceValue',
                    column_name: 'resource_value',
                    data_type: 'STRING',
                    ui_config: { widget: 'resourceSource' }
                }
            ]
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))
    })

    it('filters hidden, private, sensitive, server-owned, technical, JSON, TABLE, and resource values from list and create responses', async () => {
        const controller = createRuntimeChildRowsController(() => executor)
        const unsafeValues = {
            id: childRowId,
            _tp_sort_order: 2,
            _upl_version: 3,
            cell_value: 'safe',
            hidden_value: 'hidden',
            grid_hidden: 'grid-hidden',
            form_hidden: 'form-hidden',
            email: 'private@example.test',
            private_value: 'private',
            owned_value: 'server-owned',
            record_id: 'technical',
            json_value: { secret: true },
            nested_rows: [{ id: childRowId }],
            resource_value: { url: 'private-resource' },
            unselected_driver_column: 'must not leak'
        }
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('COUNT(*)::int AS total')) return [{ total: 1 }]
            if (sql.includes('COUNT(*)::int AS cnt')) return [{ cnt: 0 }]
            if (sql.includes('FROM runtime_schema."interpretation_matrix_rows"') && sql.includes('ORDER BY')) return [unsafeValues]
            if (sql.includes('INSERT INTO runtime_schema."interpretation_matrix_rows"')) return [unsafeValues]
            return []
        })

        const listResponse = createResponse()
        await controller.listChildRows(createRequest(undefined), listResponse)
        expect(listResponse.json).toHaveBeenCalledWith({
            items: [{ id: childRowId, _tp_sort_order: 2, _upl_version: 3, cell_value: 'safe' }],
            total: 1
        })

        const createResponseValue = createResponse()
        await controller.createChildRow(createRequest({ data: { CellValue: 'safe' } }), createResponseValue)
        const createdItem = createResponseValue.status.mock.results[0]?.value.json.mock.calls[0]?.[0]?.item
        expect(createdItem).toEqual({
            id: childRowId,
            _tp_sort_order: 2,
            _upl_version: 3,
            cell_value: 'safe',
            CellValue: 'safe'
        })
        expect(JSON.stringify(createdItem)).not.toMatch(
            /hidden|email|private|owned|record_id|json_value|nested_rows|resource_value|unselected_driver_column/
        )
    })

    it('exposes only the typed assessment-options JSON field to users allowed to edit content', async () => {
        const optionsValue = [
            {
                id: '019f2000-0000-7000-8000-000000000006',
                label: { _schema: '1', _primary: 'en', locales: { en: { content: 'Safe option' } } },
                isCorrect: true
            }
        ]
        const typedAssessmentOptions = {
            id: 'assessment-options',
            codename: 'Options',
            column_name: 'assessment_options',
            data_type: 'JSON',
            is_required: false,
            validation_rules: {},
            ui_config: { widget: 'assessmentOptions' }
        }
        const arbitraryJson = {
            id: 'private-json',
            codename: 'PrivatePayload',
            column_name: 'private_payload',
            data_type: 'JSON',
            is_required: false,
            validation_rules: {},
            ui_config: {}
        }
        const sensitiveAssessmentOptions = {
            ...typedAssessmentOptions,
            id: 'sensitive-assessment-options',
            codename: 'SensitiveOptions',
            column_name: 'sensitive_options',
            ui_config: { widget: 'assessmentOptions', sensitive: true }
        }
        const context = {
            ...tabularContext,
            childAttrs: [typedAssessmentOptions, arbitraryJson, sensitiveAssessmentOptions]
        }

        expect(getSafeRuntimeChildAttrs(context, { allowAssessmentOptions: false })).toEqual([])
        expect(getSafeRuntimeChildAttrs(context, { allowAssessmentOptions: true })).toEqual([typedAssessmentOptions])

        mockResolveTabularContext.mockResolvedValue(context)
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('COUNT(*)::int AS total')) return [{ total: 1 }]
            if (sql.includes('FROM runtime_schema."interpretation_matrix_rows"') && sql.includes('ORDER BY')) {
                return [
                    {
                        id: childRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        assessment_options: optionsValue,
                        private_payload: { token: 'must-not-be-read' },
                        sensitive_options: optionsValue
                    }
                ]
            }
            return []
        })

        const memberResponse = createResponse()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            permissions: { createContent: false, editContent: false, deleteContent: false, manageApplication: false },
            currentWorkspaceId: null,
            workspacesEnabled: false
        })
        await createRuntimeChildRowsController(() => executor).listChildRows(createRequest(undefined), memberResponse)
        expect(memberResponse.json).toHaveBeenCalledWith({
            items: [{ id: childRowId, _tp_sort_order: 0, _upl_version: 1 }],
            total: 1
        })
        const memberSelect = executor.query.mock.calls.find(([sql]) => String(sql).includes('ORDER BY _tp_sort_order'))
        expect(String(memberSelect?.[0])).not.toContain('"assessment_options"')

        jest.clearAllMocks()
        executor = createMockDbExecutor().executor
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'owner-1',
            permissions: { createContent: true, editContent: true, deleteContent: true, manageApplication: true },
            currentWorkspaceId: null,
            workspacesEnabled: false
        })
        mockResolveTabularContext.mockResolvedValue(context)
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('COUNT(*)::int AS total')) return [{ total: 1 }]
            if (sql.includes('FROM runtime_schema."interpretation_matrix_rows"') && sql.includes('ORDER BY')) {
                return [
                    {
                        id: childRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        assessment_options: optionsValue,
                        private_payload: { token: 'must-not-be-read' },
                        sensitive_options: optionsValue
                    }
                ]
            }
            return []
        })

        const editorResponse = createResponse()
        await createRuntimeChildRowsController(() => executor).listChildRows(createRequest(undefined), editorResponse)
        expect(editorResponse.json).toHaveBeenCalledWith({
            items: [{ id: childRowId, _tp_sort_order: 0, _upl_version: 1, assessment_options: optionsValue }],
            total: 1
        })
        const editorSelect = executor.query.mock.calls.find(([sql]) => String(sql).includes('ORDER BY _tp_sort_order'))
        expect(String(editorSelect?.[0])).toContain('"assessment_options"')
        expect(String(editorSelect?.[0])).not.toContain('"private_payload"')
        expect(String(editorSelect?.[0])).not.toContain('"sensitive_options"')
    })

    it('returns hidden generated sibling keys only to editors who need to resolve human-readable labels', async () => {
        const blockKey = '019f2000-0000-7000-8000-000000000011'
        const siblingKeyAttr = {
            id: 'block-key',
            codename: 'BlockKey',
            column_name: 'block_key',
            data_type: 'STRING',
            is_required: true,
            validation_rules: {},
            ui_config: { hidden: true, generateUuidV7: true, siblingRowSelectKey: true }
        }
        const titleAttr = {
            id: 'block-title',
            codename: 'Title',
            column_name: 'block_title',
            data_type: 'STRING',
            is_required: true,
            validation_rules: {},
            ui_config: {}
        }
        const context = { ...tabularContext, childAttrs: [siblingKeyAttr, titleAttr] }

        expect(getSafeRuntimeChildAttrs(context)).toEqual([titleAttr])
        expect(getSafeRuntimeChildAttrs(context, { allowSiblingRowSelectKeys: true })).toEqual([siblingKeyAttr, titleAttr])
        mockResolveTabularContext.mockResolvedValue(context)
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('COUNT(*)::int AS total')) return [{ total: 1 }]
            if (sql.includes('FROM runtime_schema."interpretation_matrix_rows"') && sql.includes('ORDER BY')) {
                return [{ id: childRowId, _tp_sort_order: 1, _upl_version: 1, block_key: blockKey, block_title: 'Opening' }]
            }
            return []
        })

        const response = createResponse()
        await createRuntimeChildRowsController(() => executor).listChildRows(createRequest(undefined), response)

        expect(response.json).toHaveBeenCalledWith({
            items: [{ id: childRowId, _tp_sort_order: 1, _upl_version: 1, block_key: blockKey, block_title: 'Opening' }],
            total: 1
        })
        const selectCall = executor.query.mock.calls.find(([sql]) => String(sql).includes('ORDER BY _tp_sort_order'))
        expect(String(selectCall?.[0])).toContain('"block_key"')
    })

    it('projects hidden server-owned hierarchy identities only as matrix structure metadata', async () => {
        const cellId = '019f2000-0000-7000-8000-000000000006'
        const parentCellId = '019f2000-0000-7000-8000-000000000007'
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            childAttrs: [
                {
                    id: 'cell-id',
                    codename: 'CellId',
                    column_name: 'cell_id',
                    data_type: 'STRING',
                    is_required: true,
                    validation_rules: {},
                    ui_config: { hidden: true, formHidden: true, gridHidden: true, serverOwned: true }
                },
                {
                    id: 'parent-cell-id',
                    codename: 'ParentCellId',
                    column_name: 'parent_cell_id',
                    data_type: 'STRING',
                    is_required: false,
                    validation_rules: {},
                    ui_config: {
                        hidden: true,
                        formHidden: true,
                        gridHidden: true,
                        serverOwned: true,
                        hierarchyIdentityField: 'CellId'
                    }
                },
                {
                    id: 'cell-value',
                    codename: 'CellValue',
                    column_name: 'cell_value',
                    data_type: 'STRING',
                    is_required: false,
                    ui_config: {}
                }
            ]
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation" AS parentRecord')) return [{ id: recordId, _upl_locked: false }]
            if (sql.includes('COUNT(*)::int AS total')) return [{ total: 1 }]
            if (sql.includes('FROM runtime_schema."interpretation_matrix_rows"') && sql.includes('ORDER BY')) {
                return [
                    {
                        id: childRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        cell_id: cellId,
                        parent_cell_id: parentCellId,
                        cell_value: 'Nested cell'
                    }
                ]
            }
            return []
        })

        const response = createResponse()
        await createRuntimeChildRowsController(() => executor).listChildRows(createRequest(undefined), response)

        expect(response.json).toHaveBeenCalledWith({
            items: [
                {
                    id: childRowId,
                    _tp_sort_order: 0,
                    _upl_version: 1,
                    cell_value: 'Nested cell',
                    matrixHierarchy: { cellId, parentCellId }
                }
            ],
            total: 1
        })
        const listQuery = executor.query.mock.calls.find(([sql]) => String(sql).includes('ORDER BY _tp_sort_order'))
        expect(String(listQuery?.[0])).toContain('"cell_id"')
        expect(String(listQuery?.[0])).toContain('"parent_cell_id"')
        const serializedResponse = JSON.stringify(response.json.mock.calls[0]?.[0])
        expect(serializedResponse).not.toContain('cell_id')
        expect(serializedResponse).not.toContain('parent_cell_id')
    })
})

describe('runtimeChildRowsController nested child row version preconditions', () => {
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
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))
    })

    it('uses the transaction row version as a CAS precondition and preserves a concurrent winner', async () => {
        const initialVersion = 7
        let storedVersion = initialVersion
        let storedConfig = 'before update'
        executor.query.mockImplementation(async (sql: string, values: unknown[] = []) => {
            if (sql.includes('FROM runtime_schema."interpretation"')) {
                return [{ id: recordId, _upl_locked: false }]
            }
            if (sql.includes('SELECT COALESCE(_upl_version, 1)::int AS version')) {
                return [{ version: initialVersion }]
            }
            if (sql.includes('UPDATE runtime_schema."interpretation_matrix_rows"')) {
                storedVersion = initialVersion + 1
                storedConfig = 'winning config'

                const hasVersionPrecondition = sql.includes('AND COALESCE(_upl_version, 1) = $')
                const versionPrecondition = hasVersionPrecondition ? values[values.length - 1] : undefined
                if (!hasVersionPrecondition || versionPrecondition === storedVersion) {
                    storedConfig = 'losing config'
                    storedVersion += 1
                    return [{ id: childRowId }]
                }
                return []
            }
            if (sql.includes('SELECT id, _upl_version')) {
                return [{ id: childRowId, _upl_version: storedVersion }]
            }
            return []
        })

        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()
        await controller.updateChildRow(createRequest({ data: { CellValue: 'losing config' } }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Record version conflict',
            code: 'RUNTIME_RECORD_VERSION_CONFLICT',
            expectedVersion: initialVersion,
            actualVersion: initialVersion + 1
        })
        const updateCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('UPDATE runtime_schema."interpretation_matrix_rows"')
        )
        expect(String(updateCall?.[0])).toContain('AND COALESCE(_upl_version, 1) = $')
        const updateValues = updateCall?.[1] as unknown[] | undefined
        expect(updateValues?.[updateValues.length - 1]).toBe(initialVersion)
        expect(storedConfig).toBe('winning config')
    })

    it('keeps a client-supplied expectedVersion as the CAS precondition', async () => {
        const expectedVersion = 4
        const actualVersion = 5
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."interpretation"')) {
                return [{ id: recordId, _upl_locked: false }]
            }
            if (sql.includes('UPDATE runtime_schema."interpretation_matrix_rows"')) return []
            if (sql.includes('SELECT id, _upl_version')) {
                return [{ id: childRowId, _upl_version: actualVersion }]
            }
            return []
        })

        const controller = createRuntimeChildRowsController(() => executor)
        const res = createResponse()
        await controller.updateChildRow(createRequest({ data: { CellValue: 'changed' }, expectedVersion }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Record version conflict',
            code: 'RUNTIME_RECORD_VERSION_CONFLICT',
            expectedVersion,
            actualVersion
        })
        const updateCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes('UPDATE runtime_schema."interpretation_matrix_rows"')
        )
        const updateValues = updateCall?.[1] as unknown[] | undefined
        expect(updateValues?.[updateValues.length - 1]).toBe(expectedVersion)
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('SELECT COALESCE(_upl_version, 1)::int AS version'))).toBe(
            false
        )
    })
})

describe('runtimeChildRowsController Entity runtime mutation policy', () => {
    it.each([
        {
            label: 'create child row',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.createChildRow(req, res)
        },
        {
            label: 'update child row',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.updateChildRow(req, res)
        },
        {
            label: 'batch update child rows',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.batchUpdateChildRows(req, res)
        },
        {
            label: 'copy child row',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.copyChildRow(req, res)
        },
        {
            label: 'delete child row',
            invoke: (controller: ReturnType<typeof createRuntimeChildRowsController>, req: Request, res: Response) =>
                controller.deleteChildRow(req, res)
        }
    ])('denies $label before a transaction or write for a protected parent Entity', async ({ label, invoke }) => {
        const { executor } = createMockDbExecutor()
        executor.query.mockReset()
        executor.transaction.mockReset()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            permissions: { createContent: true, editContent: true, deleteContent: true },
            currentWorkspaceId: null,
            workspacesEnabled: false
        })
        mockResolveTabularContext.mockResolvedValue({
            ...tabularContext,
            object: {
                ...tabularContext.object,
                config: {
                    recordPolicy: {
                        version: 1,
                        denyDeleteWhenBound: false,
                        immutableSemanticKeyWhenBound: false,
                        runtimeMutation: 'deny'
                    }
                }
            }
        })
        const controller = createRuntimeChildRowsController(() => executor)
        const body =
            label === 'create child row'
                ? { data: { CellValue: 'new' } }
                : label === 'update child row'
                ? { data: { CellValue: 'changed' }, expectedVersion: 1 }
                : label === 'batch update child rows'
                ? { updates: [{ childRowId, data: { CellValue: 'changed' }, expectedVersion: 1 }] }
                : {}
        const res = createResponse()

        await invoke(controller, createRequest(body), res)

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Runtime mutation is disabled for this Entity.',
            code: 'RUNTIME_ENTITY_MUTATION_DENIED'
        })
        expect(executor.transaction).not.toHaveBeenCalled()
        expect(executor.query).not.toHaveBeenCalled()
    })
})
