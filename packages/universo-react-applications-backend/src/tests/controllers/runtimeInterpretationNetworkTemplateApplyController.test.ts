import express from 'express'
import request from 'supertest'
import { createRuntimeInterpretationNetworkTemplateApplyController } from '../../controllers/runtimeInterpretationNetworkTemplateApplyController'
import { InterpretationNetworkCommandError } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMockDbExecutor } from '../utils/dbMocks'
import { makeCtx, makeSurface } from '../utils/interpretationNetworkTemplateFixtures'

const mockResolveRuntimeSchema = jest.fn()
const mockResolveSurface = jest.fn()
const mockApplyTemplate = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => ({
    ...jest.requireActual('../../shared/runtimeHelpers'),
    resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
}))
jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkService', () => ({
    ...jest.requireActual('../../services/interpretationNetwork/runtimeInterpretationNetworkService'),
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => mockResolveSurface(...args),
    applyTableTemplateToMatrix: (...args: unknown[]) => mockApplyTemplate(...args)
}))

const templateId = '019f2000-0000-7000-8000-000000000201'
const interpretationId = '019f2000-0000-7000-8000-000000000203'
const targetCellId = '019f2000-0000-7000-8000-000000000301'
const insertedRootCellId = '019f2000-0000-7000-8000-000000000401'
const applicationId = '019f2000-0000-7000-8000-000000000202'
const body = {
    interpretationId,
    targetCellId,
    expectedTemplateVersion: 2,
    expectedTargetVersion: 3
}
const path =
    '/applications/' +
    applicationId +
    '/runtime/interpretation-network/templates/' +
    templateId +
    '/apply?widgetId=019f2000-0000-7000-8000-000000000204&layoutId=019f2000-0000-7000-8000-000000000205&instanceKey=matrix-placement'

describe('apply-template HTTP boundary', () => {
    const { executor } = createMockDbExecutor()
    const ctx = makeCtx(executor)
    const surface = makeSurface('multiple')
    const app = express()
    app.use(express.json())
    const controller = createRuntimeInterpretationNetworkTemplateApplyController(() => executor)
    app.post(
        '/applications/:applicationId/runtime/interpretation-network/templates/:templateId/apply',
        asyncHandler(controller.applyTemplate)
    )
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
        res.status(500).json({ error: error.message })
    )

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRuntimeSchema.mockResolvedValue(ctx)
        mockResolveSurface.mockResolvedValue(surface)
        mockApplyTemplate.mockResolvedValue({
            templateId,
            templateVersion: 2,
            interpretationId,
            targetCellId,
            targetCellVersion: 3,
            insertedRootCellId,
            insertedCellCount: 2,
            insertedMaterialCount: 0
        })
    })

    it('passes the route template id, request-scoped context, and strict versions to the service', async () => {
        const response = await request(app).post(path).send(body)

        expect(response.status).toBe(201)
        expect(response.body).toEqual({
            templateId,
            templateVersion: 2,
            interpretationId,
            targetCellId,
            targetCellVersion: 3,
            insertedRootCellId,
            insertedCellCount: 2,
            insertedMaterialCount: 0
        })
        expect(mockResolveSurface).toHaveBeenCalledWith(
            ctx.manager,
            expect.objectContaining({
                applicationId,
                workspaceId: ctx.currentWorkspaceId,
                widgetId: '019f2000-0000-7000-8000-000000000204',
                layoutId: '019f2000-0000-7000-8000-000000000205',
                workspaceSettings: expect.objectContaining({
                    instanceKey: 'matrix-placement',
                    authContext: expect.objectContaining({ userId: ctx.userId, role: ctx.role }),
                    runtimeTarget: expect.objectContaining({ applicationId, workspaceId: ctx.currentWorkspaceId, targetKind: null })
                })
            })
        )
        expect(mockApplyTemplate).toHaveBeenCalledWith(
            ctx,
            surface,
            templateId,
            body,
            expect.objectContaining({
                applicationId,
                schemaName: ctx.schemaName,
                workspaceId: ctx.currentWorkspaceId,
                workspaceSettings: expect.objectContaining({ instanceKey: 'matrix-placement' })
            })
        )
    })

    it.each([
        { workspaceId: 'client-selected-workspace' },
        { expectedTemplateVersion: undefined },
        { expectedTargetVersion: 0 },
        { expectedVersion: 2 },
        { targetCellId: '019f2000-0000-4000-8000-000000000301' }
    ])('rejects non-strict or invalid request bodies before runtime resolution: %j', async (patch) => {
        const response = await request(app)
            .post(path)
            .send({ ...body, ...patch })

        expect(response.status).toBe(400)
        expect(response.body.code).toBe('INTERPRETATION_NETWORK_INVALID_REQUEST_BODY')
        expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
        expect(mockApplyTemplate).not.toHaveBeenCalled()
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('rejects template application when createContent is false before resolving the surface', async () => {
        mockResolveRuntimeSchema.mockResolvedValue({
            ...ctx,
            permissions: { ...ctx.permissions, createContent: false }
        })

        const response = await request(app).post(path).send(body)

        expect(response.status).toBe(403)
        expect(mockResolveSurface).not.toHaveBeenCalled()
        expect(mockApplyTemplate).not.toHaveBeenCalled()
    })

    it('rejects template application when editContent is false before resolving the surface', async () => {
        mockResolveRuntimeSchema.mockResolvedValue({
            ...ctx,
            permissions: { ...ctx.permissions, editContent: false }
        })

        const response = await request(app).post(path).send(body)

        expect(response.status).toBe(403)
        expect(mockResolveSurface).not.toHaveBeenCalled()
        expect(mockApplyTemplate).not.toHaveBeenCalled()
    })

    it('requires an active workspace placement before applying a template', async () => {
        const response = await request(app)
            .post(`/applications/${applicationId}/runtime/interpretation-network/templates/${templateId}/apply`)
            .send(body)

        expect(response.status).toBe(400)
        expect(response.body.code).toBe('INTERPRETATION_NETWORK_INVALID_RUNTIME_CONTEXT')
        expect(mockResolveSurface).not.toHaveBeenCalled()
        expect(mockApplyTemplate).not.toHaveBeenCalled()
    })

    it('preserves domain errors from the transactional service', async () => {
        mockApplyTemplate.mockRejectedValue(
            new InterpretationNetworkCommandError(409, 'INTERPRETATION_NETWORK_VERSION_CONFLICT', 'Target version conflict')
        )

        const response = await request(app).post(path).send(body)

        expect(response.status).toBe(409)
        expect(response.body).toMatchObject({
            code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT',
            error: 'Target version conflict'
        })
    })
})
