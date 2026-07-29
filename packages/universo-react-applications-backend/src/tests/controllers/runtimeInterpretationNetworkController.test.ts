import type { Request, Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockResolveInterpretationNetworkRuntimeSurface = jest.fn()
const mockEnsureSingleSystemStructure = jest.fn()
const mockGetInterpretationNetworkTemplateDetail = jest.fn()
const mockGetSingleSystemStructure = jest.fn()
const mockCreateMaterialForCell = jest.fn()
const mockDeleteStructureAggregate = jest.fn()
const mockInstantiateStructureFromTemplate = jest.fn()
const mockListInterpretationNetworkTemplates = jest.fn()
const mockSaveStructureAsTemplate = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => ({
    __esModule: true,
    createQueryHelper: jest.fn(() => jest.fn()),
    ensureRuntimePermission: (...args: unknown[]) => {
        const [res, ctx, permission] = args as [Response, { permissions: Record<string, boolean> }, string]
        if (ctx.permissions[permission]) return true
        res.status(403).json({ error: 'Insufficient permissions for this action' })
        return false
    },
    resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkService', () => ({
    __esModule: true,
    InterpretationNetworkCommandError: class InterpretationNetworkCommandError extends Error {
        statusCode: number
        code: string
        details?: Record<string, unknown>

        constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
            super(message)
            this.name = 'InterpretationNetworkCommandError'
            this.statusCode = statusCode
            this.code = code
            this.details = details
        }
    },
    buildFeatureNotReadyError: jest.fn((surface: { featureState: string; missing: string[] }) => ({
        statusCode: 501,
        code: 'INTERPRETATION_NETWORK_FEATURE_NOT_READY',
        message: 'Interpretation Network runtime commands are not yet available',
        details: surface
    })),
    interpretationNetworkCommandErrorCodes: {
        featureNotReady: 'INTERPRETATION_NETWORK_FEATURE_NOT_READY',
        commandNotImplemented: 'INTERPRETATION_NETWORK_COMMAND_NOT_IMPLEMENTED',
        invalidBody: 'INTERPRETATION_NETWORK_INVALID_BODY',
        invalidParams: 'INTERPRETATION_NETWORK_INVALID_PARAMS',
        rowNotFound: 'INTERPRETATION_NETWORK_ROW_NOT_FOUND'
    },
    interpretationNetworkEnsureSystemStructureRequestSchema: {
        safeParse: jest.fn(() => ({ success: true, data: {} }))
    },
    interpretationNetworkTemplateInstantiateRequestSchema: {
        safeParse: jest.fn(() => ({ success: true, data: {} }))
    },
    interpretationNetworkTemplateSaveRequestSchema: {
        safeParse: jest.fn(() => ({ success: true, data: {} }))
    },
    interpretationNetworkMaterialCreateRequestSchema: {
        safeParse: jest.fn(() => ({ success: true, data: {} }))
    },
    interpretationNetworkStructureDeleteRequestSchema: {
        safeParse: jest.fn(() => ({ success: true, data: {} }))
    },
    interpretationNetworkStructureRouteParamsSchema: {
        safeParse: jest.fn((data) => ({ success: true, data }))
    },
    createMaterialForCell: (...args: unknown[]) => mockCreateMaterialForCell(...args),
    deleteStructureAggregate: (...args: unknown[]) => mockDeleteStructureAggregate(...args),
    ensureSingleSystemStructure: (...args: unknown[]) => mockEnsureSingleSystemStructure(...args),
    getInterpretationNetworkTemplateDetail: (...args: unknown[]) => mockGetInterpretationNetworkTemplateDetail(...args),
    getSingleSystemStructure: (...args: unknown[]) => mockGetSingleSystemStructure(...args),
    instantiateStructureFromTemplate: (...args: unknown[]) => mockInstantiateStructureFromTemplate(...args),
    listInterpretationNetworkTemplates: (...args: unknown[]) => mockListInterpretationNetworkTemplates(...args),
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => mockResolveInterpretationNetworkRuntimeSurface(...args),
    saveStructureAsTemplate: (...args: unknown[]) => mockSaveStructureAsTemplate(...args)
}))

import { createRuntimeInterpretationNetworkController } from '../../controllers/runtimeInterpretationNetworkController'

function createResponse() {
    const json = jest.fn()
    const send = jest.fn()
    const status = jest.fn().mockReturnValue({ json, send })
    return {
        status,
        json,
        send
    } as unknown as Response & { status: jest.Mock; json: jest.Mock; send: jest.Mock }
}

describe('runtimeInterpretationNetworkController', () => {
    const executor = {
        query: jest.fn(),
        transaction: jest.fn(),
        isReleased: jest.fn(() => false)
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'app_test',
            schemaIdent: '"app_test"',
            manager: executor,
            userId: 'user-1',
            role: 'editor',
            permissions: {
                createContent: true,
                editContent: true,
                deleteContent: true
            },
            workflowCapabilities: {},
            currentWorkspaceId: 'workspace-1',
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            applicationId: 'app-1',
            schemaName: 'app_test',
            schemaIdent: '"app_test"',
            workspaceId: 'workspace-1',
            layoutId: 'layout-1',
            widgetId: 'widget-1',
            widgetKey: 'interpretationNetworkWorkspace',
            widgetConfig: { structureMode: 'singleSystem' },
            structureMode: 'singleSystem',
            featureState: 'ready',
            missing: [],
            resolvedObjects: {
                Structure: 'structure-1',
                Interpretation: 'interpretation-1',
                Material: 'material-1',
                TableTemplate: 'table-template-1'
            }
        })
        mockEnsureSingleSystemStructure.mockResolvedValue({
            structureId: '019f2000-0000-7000-8000-000000000101',
            interpretationId: '019f2000-0000-7000-8000-000000000102',
            rootCellId: '019f2000-0000-7000-8000-000000000103',
            created: false
        })
        mockGetSingleSystemStructure.mockResolvedValue(null)
        mockListInterpretationNetworkTemplates.mockResolvedValue([])
        mockGetInterpretationNetworkTemplateDetail.mockResolvedValue({
            id: '019f2000-0000-7000-8000-000000000999',
            name: { locales: { en: { content: 'Template' } }, _primary: 'en' },
            description: null,
            includesMaterials: false,
            version: 1,
            matrix: { cellCount: 0, rootCount: 0, maxDepth: 0 },
            materialCount: 0
        })
        mockSaveStructureAsTemplate.mockResolvedValue({
            id: '019f2000-0000-7000-8000-000000000201',
            name: { locales: { en: { content: 'Saved' } }, _primary: 'en' },
            description: null,
            includesMaterials: false,
            version: 1
        })
        mockInstantiateStructureFromTemplate.mockResolvedValue({
            structureId: '019f2000-0000-7000-8000-000000000301',
            interpretationId: '019f2000-0000-7000-8000-000000000302'
        })
        mockCreateMaterialForCell.mockResolvedValue({
            id: '019f2000-0000-7000-8000-000000000401',
            matrixRowId: '019f2000-0000-7000-8000-000000000402'
        })
        mockDeleteStructureAggregate.mockResolvedValue(undefined)
    })

    it('rejects extra request body keys for the ensure command', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()

        const service = jest.requireMock('../../services/interpretationNetwork/runtimeInterpretationNetworkService')
        service.interpretationNetworkEnsureSystemStructureRequestSchema.safeParse.mockReturnValueOnce({
            success: false,
            error: { flatten: () => ({ fieldErrors: { extra: ['Unrecognized key(s)'] } }) }
        })

        await controller.ensureSystemStructure(
            {
                params: { applicationId: 'app-1' },
                body: { extra: true }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'INTERPRETATION_NETWORK_INVALID_REQUEST_BODY'
            })
        )
        expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
    })

    it('returns command errors from ensure without exposing raw metadata', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        const service = jest.requireMock('../../services/interpretationNetwork/runtimeInterpretationNetworkService')
        mockEnsureSingleSystemStructure.mockRejectedValueOnce(
            new service.InterpretationNetworkCommandError(
                501,
                'INTERPRETATION_NETWORK_FEATURE_NOT_READY',
                'Interpretation Network runtime commands are not available',
                { missing: ['Structure.SystemKey'] }
            )
        )

        await controller.ensureSystemStructure(
            {
                params: { applicationId: 'app-1' },
                body: {}
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(501)
        expect(res.status.mock.results[0]?.value.json.mock.calls[0][0]).toMatchObject({
            code: 'INTERPRETATION_NETWORK_FEATURE_NOT_READY',
            details: { missing: ['Structure.SystemKey'] }
        })
    })

    it('returns a safe runtime surface without raw metadata details', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()

        await controller.getRuntime(
            {
                params: { applicationId: 'app-1' }
            } as unknown as Request,
            res
        )

        expect(res.json).toHaveBeenCalledWith({
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            featureState: 'ready',
            missing: [],
            structureMode: 'singleSystem',
            widgetKey: 'interpretationNetworkWorkspace'
        })
    })

    it('blocks save template without content permissions', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        mockResolveRuntimeSchema.mockResolvedValueOnce({
            schemaName: 'app_test',
            schemaIdent: '"app_test"',
            manager: executor,
            userId: 'user-1',
            role: 'member',
            permissions: {
                createContent: false,
                editContent: false
            },
            workflowCapabilities: {},
            currentWorkspaceId: 'workspace-1',
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })

        await controller.saveTemplate(
            {
                params: { applicationId: 'app-1' },
                body: {
                    sourceStructureId: '019f2000-0000-7000-8000-000000000001',
                    templateName: 'Saved',
                    includeMaterials: false
                }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'Insufficient permissions for this action'
        })
    })

    it('returns an existing system structure for read-only users without creating content', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        mockResolveRuntimeSchema.mockResolvedValueOnce({
            schemaName: 'app_test',
            schemaIdent: '"app_test"',
            manager: executor,
            userId: 'user-1',
            role: 'member',
            permissions: {
                createContent: false,
                editContent: false
            },
            workflowCapabilities: {},
            currentWorkspaceId: 'workspace-1',
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })
        mockGetSingleSystemStructure.mockResolvedValueOnce({
            structureId: '019f2000-0000-7000-8000-000000000101',
            interpretationId: '019f2000-0000-7000-8000-000000000102',
            rootCellId: '019f2000-0000-7000-8000-000000000103',
            created: false
        })

        await controller.ensureSystemStructure(
            {
                params: { applicationId: 'app-1' },
                body: {}
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({
                structureId: '019f2000-0000-7000-8000-000000000101',
                created: false,
                canCreate: false
            })
        )
        expect(mockEnsureSingleSystemStructure).not.toHaveBeenCalled()
    })

    it('allows read-only users to bootstrap the system aggregate without granting generic mutation permissions', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        mockResolveRuntimeSchema.mockResolvedValueOnce({
            schemaName: 'app_test',
            schemaIdent: '"app_test"',
            manager: executor,
            userId: 'user-1',
            role: 'member',
            permissions: {
                createContent: false,
                editContent: false
            },
            workflowCapabilities: {},
            currentWorkspaceId: 'workspace-1',
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })
        mockGetSingleSystemStructure.mockResolvedValueOnce(null)

        await controller.ensureSystemStructure(
            {
                params: { applicationId: 'app-1' },
                body: {}
            } as unknown as Request,
            res
        )

        expect(mockEnsureSingleSystemStructure).toHaveBeenCalledWith(
            expect.objectContaining({ permissions: expect.objectContaining({ createContent: false, editContent: false }) }),
            expect.objectContaining({ structureMode: 'singleSystem' }),
            {}
        )
        expect(res.status).toHaveBeenCalledWith(200)
    })

    it('delegates the ensure command to the service and returns 200 for existing aggregate', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()

        await controller.ensureSystemStructure(
            {
                params: { applicationId: 'app-1' },
                body: {}
            } as unknown as Request,
            res
        )

        expect(mockEnsureSingleSystemStructure).toHaveBeenCalledWith(
            expect.objectContaining({ schemaName: 'app_test' }),
            expect.objectContaining({ featureState: 'ready' }),
            {}
        )
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({
                structureId: '019f2000-0000-7000-8000-000000000101',
                created: false
            })
        )
    })

    it('passes the verified runtime layout and widget identity to surface resolution', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()

        await controller.getRuntime(
            {
                params: { applicationId: 'app-1' },
                query: {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1'
                }
            } as unknown as Request,
            res
        )

        expect(mockResolveInterpretationNetworkRuntimeSurface).toHaveBeenCalledWith(executor, {
            applicationId: 'app-1',
            schemaName: 'app_test',
            workspaceId: 'workspace-1',
            layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1'
        })
    })

    it('rejects malformed runtime widget identity before resolving the surface', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()

        await controller.getRuntime(
            {
                params: { applicationId: 'app-1' },
                query: { widgetId: 'not-a-uuid' }
            } as unknown as Request,
            res
        )

        expect(mockResolveInterpretationNetworkRuntimeSurface).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
    })

    it('delegates save template after permissions', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        const service = jest.requireMock('../../services/interpretationNetwork/runtimeInterpretationNetworkService')
        service.interpretationNetworkTemplateSaveRequestSchema.safeParse.mockReturnValueOnce({
            success: true,
            data: {
                sourceStructureId: '019f2000-0000-7000-8000-000000000001',
                templateName: 'Saved',
                includeMaterials: false
            }
        })

        await controller.saveTemplate(
            {
                params: { applicationId: 'app-1' },
                body: {
                    sourceStructureId: '019f2000-0000-7000-8000-000000000001',
                    templateName: 'Saved',
                    includeMaterials: false
                }
            } as unknown as Request,
            res
        )

        expect(mockSaveStructureAsTemplate).toHaveBeenCalledWith(
            expect.objectContaining({ schemaName: 'app_test' }),
            expect.objectContaining({ featureState: 'ready' }),
            expect.objectContaining({ templateName: 'Saved', includeMaterials: false })
        )
        expect(res.status).toHaveBeenCalledWith(201)
    })

    it('delegates instantiate template after permissions', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        const service = jest.requireMock('../../services/interpretationNetwork/runtimeInterpretationNetworkService')
        service.interpretationNetworkTemplateInstantiateRequestSchema.safeParse.mockReturnValueOnce({
            success: true,
            data: { structureName: 'From template' }
        })

        await controller.instantiateTemplate(
            {
                params: {
                    applicationId: 'app-1',
                    templateId: '019f2000-0000-7000-8000-000000000999'
                },
                body: {
                    structureName: 'From template'
                }
            } as unknown as Request,
            res
        )

        expect(mockInstantiateStructureFromTemplate).toHaveBeenCalledWith(
            expect.objectContaining({ schemaName: 'app_test' }),
            expect.objectContaining({ featureState: 'ready' }),
            {
                structureName: 'From template',
                templateId: '019f2000-0000-7000-8000-000000000999'
            }
        )
        expect(res.status).toHaveBeenCalledWith(201)
    })

    it('delegates material creation after create and edit permissions', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        const service = jest.requireMock('../../services/interpretationNetwork/runtimeInterpretationNetworkService')
        service.interpretationNetworkMaterialCreateRequestSchema.safeParse.mockReturnValueOnce({
            success: true,
            data: {
                interpretationId: '019f2000-0000-7000-8000-000000000503',
                matrixRowId: '019f2000-0000-7000-8000-000000000505',
                cellId: 'cell-1',
                data: { Title: 'Material' },
                expectedVersion: 7
            }
        })

        await controller.createMaterial(
            {
                params: { applicationId: 'app-1' },
                body: {
                    interpretationId: '019f2000-0000-7000-8000-000000000503',
                    matrixRowId: '019f2000-0000-7000-8000-000000000505',
                    cellId: 'cell-1',
                    data: { Title: 'Material' },
                    expectedVersion: 7
                }
            } as unknown as Request,
            res
        )

        expect(mockCreateMaterialForCell).toHaveBeenCalledWith(
            expect.objectContaining({ schemaName: 'app_test' }),
            expect.objectContaining({ featureState: 'ready' }),
            expect.objectContaining({
                cellId: 'cell-1',
                expectedVersion: 7
            })
        )
        expect(res.status).toHaveBeenCalledWith(201)
    })

    it('blocks material creation without edit permissions', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        mockResolveRuntimeSchema.mockResolvedValueOnce({
            schemaName: 'app_test',
            schemaIdent: '"app_test"',
            manager: executor,
            userId: 'user-1',
            role: 'member',
            permissions: {
                createContent: true,
                editContent: false
            },
            workflowCapabilities: {},
            currentWorkspaceId: 'workspace-1',
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })

        await controller.createMaterial(
            {
                params: { applicationId: 'app-1' },
                body: {}
            } as unknown as Request,
            res
        )

        expect(mockCreateMaterialForCell).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })

    it('delegates transactional aggregate structure deletion after delete permission', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        const service = jest.requireMock('../../services/interpretationNetwork/runtimeInterpretationNetworkService')
        service.interpretationNetworkStructureDeleteRequestSchema.safeParse.mockReturnValueOnce({
            success: true,
            data: { expectedVersion: 3 }
        })

        await controller.deleteStructure(
            {
                params: {
                    applicationId: 'app-1',
                    structureId: '019f2000-0000-7000-8000-000000000801'
                },
                body: { expectedVersion: 3 }
            } as unknown as Request,
            res
        )

        expect(mockDeleteStructureAggregate).toHaveBeenCalledWith(
            expect.objectContaining({ schemaName: 'app_test' }),
            expect.objectContaining({ featureState: 'ready' }),
            '019f2000-0000-7000-8000-000000000801',
            { expectedVersion: 3 }
        )
        expect(res.status).toHaveBeenCalledWith(204)
    })

    it('blocks aggregate structure deletion without delete permission', async () => {
        const controller = createRuntimeInterpretationNetworkController(() => executor as never)
        const res = createResponse()
        mockResolveRuntimeSchema.mockResolvedValueOnce({
            schemaName: 'app_test',
            schemaIdent: '"app_test"',
            manager: executor,
            userId: 'user-1',
            role: 'member',
            permissions: { deleteContent: false },
            workflowCapabilities: {},
            currentWorkspaceId: 'workspace-1',
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        })

        await controller.deleteStructure(
            {
                params: {
                    applicationId: 'app-1',
                    structureId: '019f2000-0000-7000-8000-000000000801'
                },
                body: {}
            } as unknown as Request,
            res
        )

        expect(mockDeleteStructureAggregate).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })
})
