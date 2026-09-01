import { ApplicationMembershipState } from '@universo-react/types'
import type { Request, Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockRuntimeQuery = jest.fn()
const mockCreateQueryHelper = jest.fn(() => mockRuntimeQuery)
const mockResolveInterpretationNetworkRuntimeSurface = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => {
    const actual = jest.requireActual('../../shared/runtimeHelpers')
    return {
        __esModule: true,
        ...actual,
        createQueryHelper: (...args: unknown[]) => mockCreateQueryHelper(...args),
        resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
    }
})

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkSurface', () => ({
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => mockResolveInterpretationNetworkRuntimeSurface(...args)
}))

import {
    createRuntimeRowsController,
    partitionRuntimeMenuItems,
    resolvePreferredScopeEntityIdFromGlobalMenu
} from '../../controllers/runtimeRowsController'
import {
    UpdateFailure,
    coerceRuntimeValue,
    normalizeRuntimeTableChildInsertValue,
    resolveRequestedRuntimeWorkspaceId
} from '../../shared/runtimeHelpers'
import { createMockDbExecutor } from '../utils/dbMocks'

function createResponse() {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return {
        status,
        json
    } as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

function createRuntimeRequest(overrides: Partial<Request> = {}): Request {
    return {
        params: {
            applicationId: '019f2000-0000-7000-8000-000000000001',
            rowId: '019f2000-0000-7000-8000-000000000002'
        },
        body: {},
        query: {},
        method: 'POST',
        path: '',
        ...overrides
    } as Request
}

const mutableObjectCollectionId = '019f2000-0000-7000-8000-000000000100'
const staleOrPageObjectCollectionId = '019f2000-0000-7000-8000-000000000999'
const testApplicationId = '019f2000-0000-7000-8000-000000000001'

const runtimeObjectCollectionRows = [
    {
        id: mutableObjectCollectionId,
        kind: 'object',
        codename: { _primary: 'en', locales: { en: { content: 'Structure' } } },
        table_name: 'structure',
        config: {}
    }
]

const mutableRuntimeComponents = [
    {
        id: 'name-component',
        codename: 'Name',
        column_name: 'name',
        data_type: 'STRING',
        is_required: false,
        validation_rules: {},
        ui_config: {}
    },
    {
        id: 'system-key-component',
        codename: 'SystemKey',
        column_name: 'system_key',
        data_type: 'STRING',
        is_required: false,
        validation_rules: {},
        ui_config: { hidden: true, formHidden: true, serverOwned: true }
    }
]

function createRuntimeMutationHarness() {
    const { executor } = createMockDbExecutor()
    const controller = createRuntimeRowsController(() => executor)

    mockResolveRuntimeSchema.mockResolvedValue({
        schemaName: 'runtime_schema',
        schemaIdent: 'runtime_schema',
        manager: executor,
        userId: 'user-1',
        role: 'owner',
        permissions: {
            createContent: true,
            editContent: true,
            deleteContent: true,
            restoreContent: true,
            viewContent: true,
            manageContent: true,
            manageSettings: true,
            manageUsers: true
        },
        workflowCapabilities: {},
        currentWorkspaceId: null,
        workspacesEnabled: false,
        applicationSettings: {}
    })
    mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
        featureState: 'ready',
        structureMode: 'multiple',
        resolvedObjects: { Structure: mutableObjectCollectionId }
    })
    executor.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) {
            return runtimeObjectCollectionRows
        }
        throw new Error(`Unexpected SQL after object collection resolution: ${sql}`)
    })

    return { controller, executor }
}

describe('runtimeRowsController object collection target resolution', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRuntimeQuery.mockReset()
        mockRuntimeQuery.mockResolvedValue([])
    })

    it.each([
        {
            label: 'create',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.createRow(
                    createRuntimeRequest({
                        body: { objectCollectionId: staleOrPageObjectCollectionId, data: { name: 'Draft' } }
                    }),
                    res
                )
        },
        {
            label: 'update',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.bulkUpdateRow(
                    createRuntimeRequest({
                        method: 'PATCH',
                        body: { objectCollectionId: staleOrPageObjectCollectionId, data: { name: 'Draft' }, expectedVersion: 1 }
                    }),
                    res
                )
        },
        {
            label: 'delete',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.deleteRow(
                    createRuntimeRequest({
                        method: 'DELETE',
                        query: { objectCollectionId: staleOrPageObjectCollectionId, expectedVersion: '1' }
                    }),
                    res
                )
        },
        {
            label: 'copy',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.copyRow(
                    createRuntimeRequest({
                        body: { objectCollectionId: staleOrPageObjectCollectionId, expectedVersion: 1 }
                    }),
                    res
                )
        },
        {
            label: 'compensate-create',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.deleteRow(
                    createRuntimeRequest({
                        method: 'POST',
                        path: '/runtime/rows/019f2000-0000-7000-8000-000000000002/compensate-create',
                        body: { objectCollectionId: staleOrPageObjectCollectionId, expectedVersion: 1 }
                    }),
                    res
                )
        }
    ])('fails closed for $label when an explicit collection target is not mutable', async ({ run }) => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()

        await run(controller, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'Record collection not found' })
        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toMatch(/\bINSERT\b/i)
        expect(executedSql).not.toMatch(/\bUPDATE\b/i)
        expect(executedSql).not.toMatch(/\bDELETE\b/i)
        expect(executedSql).not.toContain('runtime_schema."structure"')
    })
})

describe('runtimeRowsController server-owned field enforcement', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRuntimeQuery.mockReset()
        mockRuntimeQuery.mockResolvedValue([])
    })

    it.each([
        {
            label: 'create',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.createRow(
                    createRuntimeRequest({
                        body: { objectCollectionId: mutableObjectCollectionId, data: { SystemKey: 'primary' } }
                    }),
                    res
                )
        },
        {
            label: 'bulk update',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.bulkUpdateRow(
                    createRuntimeRequest({
                        method: 'PATCH',
                        body: { objectCollectionId: mutableObjectCollectionId, data: { SystemKey: 'primary' }, expectedVersion: 1 }
                    }),
                    res
                )
        },
        {
            label: 'single-cell update',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.updateCell(
                    createRuntimeRequest({
                        method: 'PATCH',
                        body: { objectCollectionId: mutableObjectCollectionId, field: 'system_key', value: 'primary', expectedVersion: 1 }
                    }),
                    res
                )
        },
        {
            label: 'copy override',
            run: async (controller: ReturnType<typeof createRuntimeRowsController>, res: ReturnType<typeof createResponse>) =>
                controller.copyRow(
                    createRuntimeRequest({
                        body: { objectCollectionId: mutableObjectCollectionId, data: { SystemKey: 'primary' }, expectedVersion: 1 }
                    }),
                    res
                )
        }
    ])('rejects client-supplied server-owned fields for $label', async ({ run }) => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) {
                return runtimeObjectCollectionRows
            }
            if (sql.includes('FROM runtime_schema._app_components')) {
                return mutableRuntimeComponents
            }
            if (sql.includes('SELECT *')) {
                return [{ id: '019f2000-0000-7000-8000-000000000002', _upl_version: 1 }]
            }
            return []
        })

        await run(controller, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Field is server-owned: SystemKey'
        })
        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toMatch(/\bINSERT\s+INTO\s+runtime_schema\."structure"/i)
        expect(executedSql).not.toMatch(/\bUPDATE\s+runtime_schema\."structure"/i)
    })

    it('preserves generic copy behavior when no Interpretation Network widget is active', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        const insertId = '019f2000-0000-7000-8000-000000000003'
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'missing-widget',
            structureMode: 'multiple',
            resolvedObjects: {}
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('SELECT *')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Source',
                        system_key: 'primary',
                        _upl_version: 1
                    }
                ]
            }
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('AS protected')) return [{ protected: false }]
            if (sql.includes('INSERT INTO runtime_schema."structure"')) return [{ id: insertId }]
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.copyRow(
            createRuntimeRequest({
                body: { objectCollectionId: mutableObjectCollectionId, expectedVersion: 1 }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(201)
        const insertCall = executor.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))
        expect(String(insertCall?.[0])).toContain('("name", "system_key", _upl_created_by)')
        expect(insertCall?.[1]).toEqual(['Source', 'primary', 'user-1'])
    })
})

describe('runtimeRowsController seeded-row delete ownership', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRuntimeQuery.mockReset()
        mockRuntimeQuery.mockResolvedValue([])
    })

    it('marks a soft-deleted workspace seed parent and its children as authored', async () => {
        const { executor } = createMockDbExecutor()
        const controller = createRuntimeRowsController(() => executor)
        const res = createResponse()

        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            role: 'owner',
            permissions: {
                createContent: true,
                editContent: true,
                deleteContent: true,
                restoreContent: true,
                viewContent: true,
                manageContent: true,
                manageSettings: true,
                manageUsers: true
            },
            workflowCapabilities: {},
            currentWorkspaceId: '019f2000-0000-7000-8000-000000000010',
            workspacesEnabled: true,
            applicationSettings: {}
        })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'missing-widget',
            structureMode: 'multiple',
            resolvedObjects: {}
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects')) {
                return [
                    {
                        id: mutableObjectCollectionId,
                        kind: 'object',
                        codename: { _primary: 'en', locales: { en: { content: 'Structure' } } },
                        table_name: 'structure',
                        config: { systemFields: { lifecycleContract: { delete: { mode: 'soft' } } } }
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema._app_components')) {
                return [
                    {
                        id: 'table-component',
                        codename: 'Items',
                        column_name: 'items',
                        data_type: 'TABLE',
                        is_required: false,
                        validation_rules: {},
                        ui_config: {}
                    }
                ]
            }
            if (sql.includes('SELECT *') && sql.includes('FROM runtime_schema."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000002', _upl_locked: false, _upl_version: 1 }]
            }
            if (sql.includes('UPDATE runtime_schema."structure"')) return [{ id: '019f2000-0000-7000-8000-000000000002' }]
            if (sql.includes('UPDATE runtime_schema."items"')) return [{ id: '019f2000-0000-7000-8000-000000000003' }]
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.deleteRow(
            createRuntimeRequest({
                method: 'DELETE',
                query: { objectCollectionId: mutableObjectCollectionId }
            }),
            res
        )

        expect(res.json).toHaveBeenCalledWith({ status: 'deleted' })
        const parentDeleteCall = executor.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE runtime_schema."structure"'))
        const childDeleteCall = executor.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE runtime_schema."items"'))
        expect(String(parentDeleteCall?.[0])).toContain('_seed_source_owned = false')
        expect(String(childDeleteCall?.[0])).toContain('_seed_source_owned = false')
    })
})

describe('runtimeRowsController single-system Structure protection', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRuntimeQuery.mockReset()
        mockRuntimeQuery.mockResolvedValue([])
    })

    it('blocks generic Structure creation while single-system mode is active', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'singleSystem',
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('pg_advisory_xact_lock')) return []
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.createRow(
            createRuntimeRequest({
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Hidden duplicate' } }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Structure aggregates are managed by Interpretation Network single-structure mode',
            code: 'INTERPRETATION_NETWORK_GENERIC_CREATE_FORBIDDEN'
        })
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))).toBe(false)
    })

    it('fails closed when generic Structure creation resolves an ambiguous runtime widget', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ambiguous-widget',
            structureMode: 'multiple',
            resolvedObjects: {}
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('pg_advisory_xact_lock')) return []
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.createRow(
            createRuntimeRequest({
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Ambiguous create' } }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))).toBe(false)
    })

    it('fails closed when generic Structure creation finds incomplete single-system metadata', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'missing-metadata',
            structureMode: 'singleSystem',
            missing: ['Interpretation.InterpretationMatrix.MaterialRef'],
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('pg_advisory_xact_lock')) return []
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.createRow(
            createRuntimeRequest({
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Incomplete metadata create' } }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network runtime metadata is incomplete for single-structure mode',
            code: 'INTERPRETATION_NETWORK_MISSING_METADATA'
        })
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))).toBe(false)
    })

    it('uses workspace-scoped runtime surface resolution for generic Structure creation protection', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            role: 'owner',
            permissions: {
                createContent: true,
                editContent: true,
                deleteContent: true,
                restoreContent: true,
                viewContent: true,
                manageContent: true,
                manageSettings: true,
                manageUsers: true
            },
            workflowCapabilities: {},
            currentWorkspaceId: '019f2000-0000-7000-8000-000000000777',
            workspacesEnabled: false,
            applicationSettings: {}
        })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'multiple',
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('INSERT INTO runtime_schema."structure"')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Allowed in workspace B',
                        system_key: null,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.createRow(
            createRuntimeRequest({
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Allowed in workspace B' } }
            }),
            res
        )

        expect(mockResolveInterpretationNetworkRuntimeSurface).toHaveBeenCalledWith(executor, {
            applicationId: testApplicationId,
            schemaName: 'runtime_schema',
            workspaceId: '019f2000-0000-7000-8000-000000000777'
        })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))).toBe(true)
    })

    it('lets workspace-scoped multi-structure mode override a global single-system generic create guard', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: 'user-1',
            role: 'owner',
            permissions: {
                createContent: true,
                editContent: true,
                deleteContent: true,
                restoreContent: true,
                viewContent: true,
                manageContent: true,
                manageSettings: true,
                manageUsers: true
            },
            workflowCapabilities: {},
            currentWorkspaceId: '019f2000-0000-7000-8000-000000000777',
            workspacesEnabled: false,
            applicationSettings: {}
        })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'multiple',
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('INSERT INTO runtime_schema."structure"')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000003',
                        name: 'Workspace scoped structure',
                        system_key: null,
                        _upl_version: 1
                    }
                ]
            }
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.createRow(
            createRuntimeRequest({
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Workspace scoped structure' } }
            }),
            res
        )

        expect(mockResolveInterpretationNetworkRuntimeSurface).toHaveBeenCalledWith(executor, {
            applicationId: testApplicationId,
            schemaName: 'runtime_schema',
            workspaceId: '019f2000-0000-7000-8000-000000000777'
        })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))).toBe(true)
    })

    it('fails closed when multiple active Interpretation Network widgets make a Structure update ambiguous', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ambiguous-widget',
            structureMode: 'multiple',
            resolvedObjects: {}
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('SELECT *')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Main',
                        system_key: 'primary',
                        _upl_version: 1
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.bulkUpdateRow(
            createRuntimeRequest({
                method: 'PATCH',
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Renamed' }, expectedVersion: 1 }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
    })

    it('blocks updates of the primary Structure only while single-system mode is active', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'singleSystem',
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('SELECT *')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Main',
                        system_key: 'primary',
                        _upl_version: 1
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.bulkUpdateRow(
            createRuntimeRequest({
                method: 'PATCH',
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Renamed' }, expectedVersion: 1 }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'INTERPRETATION_NETWORK_SYSTEM_STRUCTURE_IMMUTABLE' })
        )
    })

    it('fails closed before updating single-system Structure rows when runtime metadata is incomplete', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'missing-metadata',
            structureMode: 'singleSystem',
            missing: ['TableTemplate.TemplateMatrix.MaterialRef'],
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('SELECT *')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Main',
                        system_key: 'primary',
                        _upl_version: 1
                    }
                ]
            }
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.bulkUpdateRow(
            createRuntimeRequest({
                method: 'PATCH',
                body: { objectCollectionId: mutableObjectCollectionId, data: { Name: 'Renamed' }, expectedVersion: 1 }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network runtime metadata is incomplete for single-structure mode',
            code: 'INTERPRETATION_NETWORK_MISSING_METADATA'
        })
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE runtime_schema."structure"'))).toBe(false)
    })

    it('rechecks Interpretation Network copy protection inside the transaction', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface
            .mockResolvedValueOnce({
                featureState: 'ready',
                structureMode: 'multiple',
                resolvedObjects: { Structure: mutableObjectCollectionId }
            })
            .mockResolvedValue({
                featureState: 'ready',
                structureMode: 'singleSystem',
                resolvedObjects: { Structure: mutableObjectCollectionId }
            })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('SELECT *')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Main',
                        system_key: 'primary',
                        _upl_version: 1
                    }
                ]
            }
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('AS protected')) return [{ protected: false }]
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.copyRow(createRuntimeRequest({ body: { objectCollectionId: mutableObjectCollectionId, expectedVersion: 1 } }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network aggregates must be copied with dedicated commands',
            code: 'INTERPRETATION_NETWORK_GENERIC_COPY_FORBIDDEN'
        })
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))).toBe(false)
    })

    it('requires dedicated commands to copy an Interpretation Network aggregate', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'multiple',
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) return runtimeObjectCollectionRows
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('SELECT *')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Source',
                        system_key: null,
                        _upl_version: 1
                    }
                ]
            }
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('AS protected')) return [{ protected: false }]
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.copyRow(createRuntimeRequest({ body: { objectCollectionId: mutableObjectCollectionId, expectedVersion: 1 } }), res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Interpretation Network aggregates must be copied with dedicated commands',
            code: 'INTERPRETATION_NETWORK_GENERIC_COPY_FORBIDDEN'
        })
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO runtime_schema."structure"'))).toBe(false)
    })

    it('blocks restoring the primary Structure while single-system mode is active', async () => {
        const { controller, executor } = createRuntimeMutationHarness()
        const res = createResponse()
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'singleSystem',
            resolvedObjects: { Structure: mutableObjectCollectionId }
        })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) {
                return runtimeObjectCollectionRows.map((row) => ({ ...row, lifecycle_contract: { deleteMode: 'soft' } }))
            }
            if (sql.includes('FROM runtime_schema._app_components')) return mutableRuntimeComponents
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('AS protected')) return [{ protected: false }]
            if (sql.includes('SELECT *')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000002',
                        name: 'Main',
                        system_key: 'primary',
                        _upl_version: 1,
                        _upl_deleted: true,
                        _app_deleted: false
                    }
                ]
            }
            return []
        })
        executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))

        await controller.restoreRow(
            createRuntimeRequest({
                body: { objectCollectionId: mutableObjectCollectionId, expectedVersion: 1 }
            }),
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'INTERPRETATION_NETWORK_SYSTEM_STRUCTURE_IMMUTABLE' })
        )
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE runtime_schema."structure"'))).toBe(false)
    })
})

describe('runtimeRowsController startup section resolution', () => {
    it('prefers the menu startPage section before bound hub fallback', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [
                    {
                        config: {
                            bindToHub: true,
                            boundHubId: 'hub-1',
                            startPage: 'LearningResources',
                            items: [{ id: 'section', kind: 'section', sectionId: 'LearningResources' }]
                        }
                    }
                ]
            }

            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('id::text = $1')) {
                expect(params).toEqual(['LearningResources'])
                expect(sql).toContain("config->'capabilities'->'layoutConfig'->>'enabled'")
                expect(sql).not.toContain("COALESCE(kind, '') NOT IN")
                expect(sql).not.toContain("= 'page'")
                return [{ id: 'modules-object-id' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredScopeEntityIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('modules-object-id')

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toContain("config->'hubs' @>")
    })

    it('limits startup scope tokens to layout-capable runtime sections', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [{ config: { startPage: 'CustomLanding' } }]
            }

            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('id::text = $1')) {
                expect(params).toEqual(['CustomLanding'])
                expect(sql).toContain("config->'capabilities'->'layoutConfig'->>'enabled'")
                expect(sql).not.toContain("COALESCE(kind, '') NOT IN")
                expect(sql).not.toContain("= 'page'")
                return [{ id: 'custom-layout-capable-entity-id' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredScopeEntityIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('custom-layout-capable-entity-id')
    })

    it('prefers UUID-backed startTarget over an unresolved startPage token', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [
                    {
                        config: {
                            startPage: 'legacy-codename',
                            startTarget: {
                                kind: 'objectCollection',
                                objectCollectionId: '019f15a0-0000-7000-8000-000000000001'
                            }
                        }
                    }
                ]
            }

            if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('id::text = $1')) {
                expect(params).toEqual(['019f15a0-0000-7000-8000-000000000001'])
                return [{ id: '019f15a0-0000-7000-8000-000000000001' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredScopeEntityIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('019f15a0-0000-7000-8000-000000000001')
    })

    it('derives startup section bindings from the global default or active layout only with config-aware section filtering', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('information_schema.tables')) {
                return [{ layoutsExists: true, widgetsExists: true }]
            }

            if (sql.includes('FROM runtime_schema._app_layouts')) {
                expect(sql).toContain('scope_entity_id IS NULL')
                return [{ id: 'global-layout-1' }]
            }

            if (sql.includes('FROM runtime_schema._app_widgets')) {
                return [{ config: { bindToHub: true, boundHubId: 'hub-1' } }]
            }

            if (sql.includes("config->'hubs' @>")) {
                expect(sql).toContain("COALESCE(kind, '') NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')")
                expect(sql).not.toContain('custom.')
                return [{ id: 'object-1' }]
            }

            throw new Error(`Unexpected SQL: ${sql}`)
        })

        await expect(
            resolvePreferredScopeEntityIdFromGlobalMenu({
                manager: executor,
                schemaName: 'runtime_schema',
                schemaIdent: 'runtime_schema'
            })
        ).resolves.toBe('object-1')

        expect(executor.query).toHaveBeenCalled()
    })
})

describe('partitionRuntimeMenuItems', () => {
    const items = ['modules', 'knowledge', 'development', 'reports']
    const workspaceItem = 'workspaces'

    it('keeps the injected workspace item inside the primary menu limit', () => {
        const result = partitionRuntimeMenuItems(items, 3, workspaceItem, 'primary')

        expect(result.primaryItems).toEqual(['modules', 'knowledge', 'workspaces'])
        expect(result.overflowItems).toEqual(['development', 'reports'])
    })

    it('handles a primary workspace item when the limit leaves no room for regular items', () => {
        const result = partitionRuntimeMenuItems(items, 1, workspaceItem, 'primary')

        expect(result.primaryItems).toEqual(['workspaces'])
        expect(result.overflowItems).toEqual(items)
    })

    it('does not reserve primary capacity when the workspace item is in overflow or hidden', () => {
        expect(partitionRuntimeMenuItems(items, 2, workspaceItem, 'overflow')).toEqual({
            primaryItems: ['modules', 'knowledge'],
            overflowItems: ['development', 'reports', 'workspaces']
        })
        expect(partitionRuntimeMenuItems(items, 2, workspaceItem, 'hidden')).toEqual({
            primaryItems: ['modules', 'knowledge'],
            overflowItems: ['development', 'reports']
        })
    })

    it('does not mutate the source items when there is no primary limit', () => {
        const result = partitionRuntimeMenuItems(items, null, workspaceItem, 'primary')

        expect(result.primaryItems).toEqual(['modules', 'knowledge', 'development', 'reports', 'workspaces'])
        expect(result.overflowItems).toEqual([])
        expect(items).toEqual(['modules', 'knowledge', 'development', 'reports'])
    })
})

describe('normalizeRuntimeTableChildInsertValue', () => {
    it('stringifies JSON child values exactly once', () => {
        expect(normalizeRuntimeTableChildInsertValue({ ok: true }, 'JSON')).toBe('{"ok":true}')
        expect(normalizeRuntimeTableChildInsertValue('[1,2,3]', 'JSON')).toBe('[1,2,3]')
    })

    it('stringifies localized STRING child objects for json-backed VLC storage', () => {
        expect(
            normalizeRuntimeTableChildInsertValue({ _primary: 'en', locales: { en: { content: 'Hello' } } }, 'STRING', { localized: true })
        ).toBe('{"_primary":"en","locales":{"en":{"content":"Hello"}}}')
    })

    it('wraps plain strings into VLC objects before json-backed localized storage', () => {
        const coerced = coerceRuntimeValue('Hello', 'STRING', { localized: true, versioned: true })

        expect(coerced).toEqual(
            expect.objectContaining({
                _schema: '1',
                _primary: 'en',
                locales: expect.objectContaining({
                    en: expect.objectContaining({ content: 'Hello', version: 1, isActive: true })
                })
            })
        )
        expect(normalizeRuntimeTableChildInsertValue(coerced, 'STRING', { localized: true, versioned: true })).toContain(
            '"content":"Hello"'
        )
    })
})

describe('resolveRequestedRuntimeWorkspaceId', () => {
    it('prefers an allowed explicit workspace over the default workspace', () => {
        expect(
            resolveRequestedRuntimeWorkspaceId('workspace-shared', {
                membershipState: ApplicationMembershipState.JOINED,
                defaultWorkspaceId: 'workspace-personal',
                allowedWorkspaceIds: ['workspace-personal', 'workspace-shared']
            })
        ).toBe('workspace-shared')
    })

    it('falls back to the default workspace when no explicit workspace is requested', () => {
        expect(
            resolveRequestedRuntimeWorkspaceId(null, {
                membershipState: ApplicationMembershipState.JOINED,
                defaultWorkspaceId: 'workspace-personal',
                allowedWorkspaceIds: ['workspace-personal', 'workspace-shared']
            })
        ).toBe('workspace-personal')
    })

    it('rejects explicit workspaces that are not available to the current user', () => {
        expect(() =>
            resolveRequestedRuntimeWorkspaceId('workspace-foreign', {
                membershipState: ApplicationMembershipState.JOINED,
                defaultWorkspaceId: 'workspace-personal',
                allowedWorkspaceIds: ['workspace-personal', 'workspace-shared']
            })
        ).toThrow(UpdateFailure)
    })
})
