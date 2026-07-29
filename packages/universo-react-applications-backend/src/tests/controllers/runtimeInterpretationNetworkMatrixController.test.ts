import type { Request, Response } from 'express'
import { InterpretationNetworkCommandError } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'

const mockResolveRuntimeSchema = jest.fn()
const mockResolveRuntimeSurface = jest.fn()
const mockCreateMatrixCell = jest.fn()
const mockMoveMatrixCells = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => ({
    createQueryHelper: () => jest.fn(),
    resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkSurface', () => ({
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => mockResolveRuntimeSurface(...args)
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands', () => ({
    createInterpretationNetworkMatrixCell: (...args: unknown[]) => mockCreateMatrixCell(...args),
    moveInterpretationNetworkMatrixCells: (...args: unknown[]) => mockMoveMatrixCells(...args)
}))

import { createRuntimeInterpretationNetworkMatrixController } from '../../controllers/runtimeInterpretationNetworkMatrixController'

const applicationId = '019f2000-0000-7000-8000-000000000001'
const workspaceId = '019f2000-0000-7000-8000-000000000002'
const widgetId = '019f2000-0000-7000-8000-000000000003'
const layoutId = '019f2000-0000-7000-8000-000000000004'
const interpretationId = '019f2000-0000-7000-8000-000000000005'

const createResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn()
    }
    response.status.mockReturnValue(response)
    return response as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

describe('runtimeInterpretationNetworkMatrixController', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRuntimeSchema.mockResolvedValue({
            schemaName: 'app_019f2000000070008000000000000001',
            currentWorkspaceId: workspaceId,
            manager: { query: jest.fn(), transaction: jest.fn() }
        })
        mockResolveRuntimeSurface.mockResolvedValue({ featureState: 'ready' })
    })

    it('passes the explicit widget scope into the dedicated create command', async () => {
        const controller = createRuntimeInterpretationNetworkMatrixController(() => ({} as never))
        const res = createResponse()
        const request = {
            params: { applicationId },
            query: { widgetId, layoutId },
            body: { interpretationId, data: { CellValue: 'Value' }, placement: { parentCellId: null } }
        } as unknown as Request
        mockCreateMatrixCell.mockResolvedValue({
            id: '019f2000-0000-7000-8000-000000000006',
            status: 'created',
            item: { CellId: '019f2000-0000-7000-8000-000000000007' }
        })

        await controller.createCell(request, res)

        expect(mockResolveRuntimeSurface).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ applicationId, workspaceId, widgetId, layoutId })
        )
        expect(mockCreateMatrixCell).toHaveBeenCalledWith(
            expect.objectContaining({ currentWorkspaceId: workspaceId }),
            { featureState: 'ready' },
            request.body
        )
        expect(res.status).toHaveBeenCalledWith(201)
    })

    it('returns only the stable command error contract for rejected cells', async () => {
        const controller = createRuntimeInterpretationNetworkMatrixController(() => ({} as never))
        const res = createResponse()
        mockCreateMatrixCell.mockRejectedValue(
            new InterpretationNetworkCommandError(409, 'INTERPRETATION_NETWORK_INVALID_MATRIX', 'Matrix coordinates conflict', {
                rowKey: 'row-1'
            })
        )

        await controller.createCell(
            {
                params: { applicationId },
                query: { widgetId, layoutId },
                body: { interpretationId, data: {}, placement: {} }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith({
            error: 'Matrix coordinates conflict',
            code: 'INTERPRETATION_NETWORK_INVALID_MATRIX',
            details: { rowKey: 'row-1' }
        })
    })

    it('rejects malformed widget scope before resolving runtime metadata', async () => {
        const controller = createRuntimeInterpretationNetworkMatrixController(() => ({} as never))
        const res = createResponse()

        await controller.createCell(
            {
                params: { applicationId },
                query: { widgetId: 'raw-widget-id' },
                body: { interpretationId, data: {}, placement: {} }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid runtime widget context' }))
        expect(mockResolveRuntimeSurface).not.toHaveBeenCalled()
        expect(mockCreateMatrixCell).not.toHaveBeenCalled()
    })
})
