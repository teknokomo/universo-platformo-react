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
    resolveRuntimeInterpretationNetworkSurface: (...args: unknown[]) => mockResolveInterpretationNetworkSurface(...args)
}))

import { createRuntimeChildRowsController } from '../../controllers/runtimeChildRowsController'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { createMockDbExecutor } from '../utils/dbMocks'

const applicationId = '019f2000-0000-7000-8000-000000000001'
const parentId = '019f2000-0000-7000-8000-000000000002'
const componentId = '019f2000-0000-7000-8000-000000000003'
const objectCollectionId = '019f2000-0000-7000-8000-000000000004'
const childRowId = '019f2000-0000-7000-8000-000000000005'

const response = () => {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return { status, json } as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

const request = (body: unknown): Request =>
    ({
        params: { applicationId, recordId: parentId, componentId, childRowId },
        query: { objectCollectionId },
        body
    } as unknown as Request)

const childContext = (childAttrs: Array<Record<string, unknown>>) => ({
    error: null,
    object: { id: objectCollectionId, codename: 'Courses', table_name: 'courses', config: {} },
    lifecycleContract: resolveApplicationLifecycleContractFromConfig({}),
    tableAttr: { id: componentId, codename: 'Sections', column_name: 'sections', data_type: 'TABLE', validation_rules: {} },
    tabTableName: 'course_sections',
    tabTableIdent: 'runtime_schema."course_sections"',
    parentTableIdent: 'runtime_schema."courses"',
    childAttrs
})

describe('runtime child rows server-owned defaults', () => {
    const { executor, txExecutor } = createMockDbExecutor()

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'runtime_schema',
            schemaIdent: 'runtime_schema',
            manager: executor,
            userId: '019f2000-0000-7000-8000-000000000006',
            permissions: { createContent: true, editContent: true, deleteContent: true },
            currentWorkspaceId: null,
            workspacesEnabled: false
        })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            structureMode: 'multiple',
            resolvedObjects: {}
        })
        executor.transaction.mockImplementation(async (run: (manager: typeof txExecutor) => Promise<unknown>) => run(txExecutor))
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM runtime_schema."courses" AS parentRecord')) return [{ id: parentId, _upl_locked: false }]
            if (sql.includes('COUNT(*)::int AS cnt')) return [{ cnt: 0 }]
            if (sql.startsWith('INSERT INTO runtime_schema."course_sections"')) {
                return [{ id: childRowId, _tp_sort_order: 0, _upl_version: 1, title: 'Visible title' }]
            }
            return []
        })
    })

    it('binds trusted required and optional defaults while omitting optional fields for database defaults', async () => {
        mockResolveTabularContext.mockResolvedValue(
            childContext([
                { id: 'title', codename: 'Title', column_name: 'title', data_type: 'STRING', ui_config: {} },
                {
                    id: 'system-key',
                    codename: 'SystemKey',
                    column_name: 'system_key',
                    data_type: 'STRING',
                    is_required: true,
                    ui_config: { serverOwned: true, defaultValue: 'seeded-key' }
                },
                {
                    id: 'use-count',
                    codename: 'UseCount',
                    column_name: 'use_count',
                    data_type: 'NUMBER',
                    is_required: true,
                    ui_config: { serverOwned: true, defaultValue: 0 }
                },
                {
                    id: 'optional-default',
                    codename: 'OptionalMarker',
                    column_name: 'optional_marker',
                    data_type: 'STRING',
                    ui_config: { serverOwned: true, defaultValue: 'optional-seed' }
                },
                {
                    id: 'database-default',
                    codename: 'DatabaseDefault',
                    column_name: 'database_default',
                    data_type: 'STRING',
                    ui_config: { serverOwned: true }
                }
            ])
        )
        const controller = createRuntimeChildRowsController(() => executor)
        const res = response()

        await controller.createChildRow(request({ data: { Title: 'Visible title' } }), res)

        const insertCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).startsWith('INSERT INTO runtime_schema."course_sections"')
        )
        expect(insertCall?.[0]).toContain('"system_key"')
        expect(insertCall?.[0]).toContain('"use_count"')
        expect(insertCall?.[0]).toContain('"optional_marker"')
        expect(insertCall?.[0]).not.toContain('"database_default"')
        expect(insertCall?.[0]).not.toContain('seeded-key')
        expect(insertCall?.[0]).not.toContain('optional-seed')
        expect(insertCall?.[1]).toEqual([
            parentId,
            0,
            '019f2000-0000-7000-8000-000000000006',
            'Visible title',
            'seeded-key',
            0,
            'optional-seed'
        ])

        const createdItem = res.status.mock.results[0]?.value.json.mock.calls[0]?.[0]?.item
        expect(createdItem).toEqual({ id: childRowId, _tp_sort_order: 0, _upl_version: 1, title: 'Visible title', Title: 'Visible title' })
    })

    it('fails closed after parent authorization when a required server-owned field has no trusted value', async () => {
        mockResolveTabularContext.mockResolvedValue(
            childContext([
                {
                    id: 'required-reference',
                    codename: 'RequiredReference',
                    column_name: 'required_reference',
                    data_type: 'REF',
                    target_object_kind: 'object',
                    is_required: true,
                    ui_config: { serverOwned: true }
                }
            ])
        )
        const controller = createRuntimeChildRowsController(() => executor)
        const res = response()

        await controller.createChildRow(request({ data: {} }), res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'Required field missing: Sections.RequiredReference' })
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT INTO runtime_schema."course_sections"'))).toBe(
            false
        )
    })
})
