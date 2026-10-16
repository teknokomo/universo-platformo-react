import type { Request, Response } from 'express'
import { createRuntimeRowsController } from '../../controllers/runtimeRowsController'
import { createMockDbExecutor } from '../utils/dbMocks'

const mockResolveRuntimeSchema = jest.fn()
const mockRuntimeQuery = jest.fn()
const mockCreateQueryHelper: jest.Mock = jest.fn(() => mockRuntimeQuery)
const mockResolveInterpretationNetworkRuntimeSurface = jest.fn()
const mockResolveEffectiveLayoutForRequest = jest.fn()

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

jest.mock('../../services/effectiveLayoutResolver', () => ({
    __esModule: true,
    resolveEffectiveLayoutForRequest: (...args: unknown[]) => mockResolveEffectiveLayoutForRequest(...args)
}))

jest.mock('../../services/effectiveLayoutResolverCore', () => ({
    __esModule: true,
    resolveEffectiveLayoutStructureForRequest: (...args: unknown[]) => mockResolveEffectiveLayoutForRequest(...args)
}))

const objectCollectionId = '019f2000-0000-7000-8000-000000000100'
const applicationId = '019f2000-0000-7000-8000-000000000001'
const policyCodenames = [
    'ShowFirstName',
    'RequireFirstName',
    'ShowLastName',
    'RequireLastName',
    'ShowEmail',
    'RequireEmail',
    'ShowPhone',
    'RequirePhone',
    'CaptchaEnabled'
]
const policyComponents = policyCodenames.map((codename, index) => ({
    id: `019f2000-0000-7000-8000-00000000030${index + 1}`,
    codename: {
        _primary: 'ru',
        locales: { en: { content: codename }, ru: { content: codename } }
    },
    column_name: `col_policy_${index}`,
    data_type: 'BOOLEAN',
    is_required: false,
    validation_rules: {},
    ui_config: { defaultValue: index < 4 }
}))

function createResponse() {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return { status, json } as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

function createRequest(overrides: Partial<Request> = {}): Request {
    return {
        params: { applicationId, rowId: '019f2000-0000-7000-8000-000000000002' },
        body: {},
        query: {},
        method: 'POST',
        path: '',
        ...overrides
    } as Request
}

function createAccessLinkMutationHarness(sourceRow: Record<string, unknown>) {
    const { executor } = createMockDbExecutor()
    const controller = createRuntimeRowsController(() => executor)
    const row = {
        id: '019f2000-0000-7000-8000-000000000002',
        _upl_version: 1,
        ...Object.fromEntries(policyComponents.map((component, index) => [component.column_name, index < 4])),
        ...sourceRow
    }

    mockResolveRuntimeSchema.mockResolvedValue({
        schemaName: 'runtime_schema',
        schemaIdent: 'runtime_schema',
        manager: executor,
        userId: '019f2000-0000-7000-8000-000000000010',
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
    mockResolveEffectiveLayoutForRequest.mockResolvedValue({
        status: 'ok',
        target: { applicationId, targetKind: 'object', entityTypeId: objectCollectionId, locale: 'en' },
        resolvedEntityTypeId: objectCollectionId,
        scope: 'global',
        layout: { id: '019f2000-0000-7000-8000-000000000400', templateKey: 'dashboard', config: {} },
        widgets: [],
        precedence: ['application-global'],
        effectiveHash: 'test-effective-layout-hash'
    })
    mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
        featureState: 'missing-widget',
        structureMode: 'multiple',
        resolvedObjects: {}
    })
    executor.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM runtime_schema._app_objects') && sql.includes('ORDER BY')) {
            return [
                {
                    id: objectCollectionId,
                    kind: 'object',
                    codename: 'AccessLinks',
                    table_name: 'obj_access_links',
                    config: {}
                }
            ]
        }
        if (sql.includes('FROM runtime_schema._app_components')) return policyComponents
        if (sql.includes('SELECT _upl_version FROM runtime_schema."obj_access_links"')) return [{ _upl_version: 1 }]
        if (sql.includes('SELECT *') && sql.includes('runtime_schema."obj_access_links"')) return [row]
        if (sql.includes('pg_advisory_xact_lock')) return []
        return []
    })
    executor.transaction.mockImplementation(async (fn: (manager: typeof executor) => Promise<unknown>) => fn(executor))
    return { controller, executor }
}

describe('runtimeRowsController guest intake policy', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRuntimeQuery.mockReset()
        mockRuntimeQuery.mockResolvedValue([])
    })

    it.each([
        {
            label: 'create',
            run: (controller: ReturnType<typeof createRuntimeRowsController>, response: ReturnType<typeof createResponse>) =>
                controller.createRow(
                    createRequest({
                        body: {
                            objectCollectionId,
                            data: {
                                ShowFirstName: false,
                                RequireFirstName: true,
                                ShowLastName: true,
                                RequireLastName: false,
                                ShowEmail: false,
                                RequireEmail: false,
                                ShowPhone: false,
                                RequirePhone: false,
                                CaptchaEnabled: false
                            }
                        }
                    }),
                    response
                )
        },
        {
            label: 'single-cell update',
            run: (controller: ReturnType<typeof createRuntimeRowsController>, response: ReturnType<typeof createResponse>) =>
                controller.updateCell(
                    createRequest({
                        method: 'PATCH',
                        body: { objectCollectionId, field: 'col_policy_0', value: false, expectedVersion: 1 }
                    }),
                    response
                )
        },
        {
            label: 'bulk update',
            run: (controller: ReturnType<typeof createRuntimeRowsController>, response: ReturnType<typeof createResponse>) =>
                controller.bulkUpdateRow(
                    createRequest({
                        method: 'PATCH',
                        body: { objectCollectionId, data: { ShowFirstName: false }, expectedVersion: 1 }
                    }),
                    response
                )
        },
        {
            label: 'copy override',
            run: (controller: ReturnType<typeof createRuntimeRowsController>, response: ReturnType<typeof createResponse>) =>
                controller.copyRow(
                    createRequest({ body: { objectCollectionId, data: { ShowFirstName: false }, expectedVersion: 1 } }),
                    response
                )
        },
        {
            label: 'restore',
            sourceRow: { col_policy_0: false, col_policy_1: true },
            run: (controller: ReturnType<typeof createRuntimeRowsController>, response: ReturnType<typeof createResponse>) =>
                controller.restoreRow(createRequest({ method: 'POST', body: { objectCollectionId, expectedVersion: 1 } }), response)
        }
    ])('rejects invalid policy on $label before writing AccessLinks', async ({ run, sourceRow }) => {
        const { controller, executor } = createAccessLinkMutationHarness(sourceRow ?? {})
        const response = createResponse()

        await run(controller, response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID' })
        )
        const writes = executor.query.mock.calls
            .map(([sql]) => String(sql))
            .filter((sql) => /\b(?:INSERT\s+INTO|UPDATE)\s+runtime_schema\."obj_access_links"/i.test(sql))
        expect(writes).toEqual([])
    })
})
