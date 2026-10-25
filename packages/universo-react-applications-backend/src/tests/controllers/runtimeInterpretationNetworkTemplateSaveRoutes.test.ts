import express from 'express'
import request from 'supertest'
import { createRuntimeInterpretationNetworkController } from '../../controllers/runtimeInterpretationNetworkController'
import { InterpretationNetworkCommandError } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { asyncHandler } from '../../shared/asyncHandler'
import { createMockDbExecutor } from '../utils/dbMocks'
import { makeCtx, makeSurface } from '../utils/interpretationNetworkTemplateFixtures'

const mockResolveRuntimeSchema = jest.fn()
const mockResolveSurface = jest.fn()
const mockSave = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => ({
    ...jest.requireActual('../../shared/runtimeHelpers'),
    resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
}))
jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkService', () => ({
    ...jest.requireActual('../../services/interpretationNetwork/runtimeInterpretationNetworkService'),
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => mockResolveSurface(...args),
    saveStructureAsTemplate: (...args: unknown[]) => mockSave(...args)
}))

const rootCellId = '019f2000-0000-7000-8000-000000000302'
const body = {
    sourceStructureId: '019f2000-0000-7000-8000-000000000201',
    templateName: 'Branch template',
    includeMaterials: true,
    scope: { kind: 'selectedBranch', rootCellId },
    expectedVersion: 2
}
const path = '/applications/app-1/runtime/interpretation-network/templates'

describe('save-template HTTP boundary with real strict request schema', () => {
    const { executor } = createMockDbExecutor()
    const ctx = makeCtx(executor)
    const surface = makeSurface('multiple')
    const app = express()
    app.use(express.json())
    const controller = createRuntimeInterpretationNetworkController(() => executor)
    app.post('/applications/:applicationId/runtime/interpretation-network/templates', asyncHandler(controller.saveTemplate))

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRuntimeSchema.mockResolvedValue(ctx)
        mockResolveSurface.mockResolvedValue(surface)
        mockSave.mockResolvedValue({ id: rootCellId, version: 1, includesMaterials: true })
    })

    it.each([{ kind: 'wholeStructure' }, body.scope])('passes scope %j, materials and expectedVersion to the service', async (scope) => {
        const response = await request(app)
            .post(path)
            .send({ ...body, scope })
        expect(response.status).toBe(201)
        expect(mockSave).toHaveBeenCalledWith(ctx, surface, expect.objectContaining({ scope, expectedVersion: 2, includeMaterials: true }))
    })

    it('defaults an omitted scope to wholeStructure before calling the service', async () => {
        const { scope: _scope, ...bodyWithoutScope } = body
        const response = await request(app).post(path).send(bodyWithoutScope)

        expect(response.status).toBe(201)
        expect(mockSave).toHaveBeenCalledWith(
            ctx,
            surface,
            expect.objectContaining({ scope: { kind: 'wholeStructure' }, expectedVersion: 2, includeMaterials: true })
        )
    })

    it.each([
        { scope: { kind: 'selectedBranch' } },
        { scope: { kind: 'selectedBranch', rootCellId: '019f2000-0000-4000-8000-000000000302' } },
        { scope: { kind: 'wholeStructure', rootCellId } },
        { scope: { ...body.scope, descendants: [rootCellId] } },
        { rootCellId },
        { workspaceId: 'client-workspace' },
        { includeMaterials: undefined },
        { expectedVersion: 0 }
    ])('rejects invalid request %j before runtime resolution or mutation', async (patch) => {
        const response = await request(app)
            .post(path)
            .send({ ...body, ...patch })
        expect(response.status).toBe(400)
        expect(response.body.code).toBe('INTERPRETATION_NETWORK_INVALID_REQUEST_BODY')
        expect(mockResolveRuntimeSchema).not.toHaveBeenCalled()
        expect(mockSave).not.toHaveBeenCalled()
        expect(executor.query).not.toHaveBeenCalled()
    })

    it.each(['createContent', 'editContent'])('requires %s for selected-branch saves', async (permission) => {
        mockResolveRuntimeSchema.mockResolvedValue({ ...ctx, permissions: { ...ctx.permissions, [permission]: false } })
        const response = await request(app).post(path).send(body)
        expect(response.status).toBe(403)
        expect(mockSave).not.toHaveBeenCalled()
    })

    it.each([
        [404, 'INTERPRETATION_NETWORK_ROW_NOT_FOUND'],
        [409, 'INTERPRETATION_NETWORK_INVALID_MATRIX'],
        [409, 'INTERPRETATION_NETWORK_UNSUPPORTED_STRUCTURE_MODE'],
        [409, 'INTERPRETATION_NETWORK_VERSION_CONFLICT']
    ])('preserves service error HTTP %s and code %s', async (status, code) => {
        mockSave.mockRejectedValue(new InterpretationNetworkCommandError(status, code, 'Save rejected'))
        const response = await request(app).post(path).send(body)
        expect(response.status).toBe(status)
        expect(response.body).toMatchObject({ code, error: 'Save rejected' })
    })
})
