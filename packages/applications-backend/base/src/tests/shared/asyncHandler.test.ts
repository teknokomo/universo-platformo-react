import type { Request, Response } from 'express'
import { asyncHandler } from '../../shared/asyncHandler'

describe('asyncHandler', () => {
    const mockReq = {} as Request
    let mockRes: Response
    let mockNext: ReturnType<typeof jest.fn>

    beforeEach(() => {
        mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response
        mockNext = jest.fn()
    })

    it('calls the handler function', async () => {
        const handler = jest.fn().mockResolvedValue(undefined)
        const wrapped = asyncHandler(handler)

        await wrapped(mockReq, mockRes, mockNext)

        expect(handler).toHaveBeenCalledWith(mockReq, mockRes)
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('forwards errors to next()', async () => {
        const error = new Error('test error')
        const handler = jest.fn().mockRejectedValue(error)
        const wrapped = asyncHandler(handler)

        await wrapped(mockReq, mockRes, mockNext)

        expect(mockNext).toHaveBeenCalledWith(error)
    })

    it('does not call next when handler succeeds', async () => {
        const handler = jest.fn().mockResolvedValue(mockRes)
        const wrapped = asyncHandler(handler)

        await wrapped(mockReq, mockRes, mockNext)

        expect(mockNext).not.toHaveBeenCalled()
    })
})
