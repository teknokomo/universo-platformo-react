import { Request } from 'express'
import { validateCanvasApiKey } from '../../src/utils/validateKey'
import { compareKeys } from '../../src/utils/apiKey'
import apikeyService from '../../src/services/apikey'
import type { CanvasFlowResult } from '@universo/spaces-srv'

jest.mock('../../src/utils/apiKey')
jest.mock('../../src/services/apikey', () => ({
    __esModule: true,
    default: {
        getAllApiKeys: jest.fn()
    }
}))

describe('validateCanvasApiKey', () => {
    let req: Partial<Request> & { headers: Record<string, string> }
    let canvas: CanvasFlowResult
    const mockedApiKeyService = apikeyService as jest.Mocked<typeof apikeyService>
    const mockedCompareKeys = compareKeys as jest.Mock

    beforeEach(() => {
        req = {
            headers: {}
        }
        canvas = {
            apikeyid: null
        } as unknown as CanvasFlowResult
        jest.clearAllMocks()
    })

    it('should return true if canvas.apikeyid is not set', async () => {
        const result = await validateCanvasApiKey(req as Request, canvas)
        expect(result).toBe(true)
    })

    it('should return false if canvas.apikeyid is set but authorization header is missing', async () => {
        canvas.apikeyid = 'some-api-key-id'
        const result = await validateCanvasApiKey(req as Request, canvas)
        expect(result).toBe(false)
    })

    it('should return false if supplied key does not match the expected key', async () => {
        canvas.apikeyid = 'some-api-key-id'
        req.headers['authorization'] = 'Bearer invalid-key'
        mockedApiKeyService.getAllApiKeys.mockResolvedValue([
            { id: 'some-api-key-id', apiSecret: 'expected-secret-key' } as any
        ])
        mockedCompareKeys.mockImplementation((expected, supplied) => expected === supplied)

        const result = await validateCanvasApiKey(req as Request, canvas)
        expect(result).toBe(false)
    })

    it('should return true if supplied key matches the expected key', async () => {
        canvas.apikeyid = 'some-api-key-id'
        req.headers['authorization'] = 'Bearer expected-secret-key'
        mockedApiKeyService.getAllApiKeys.mockResolvedValue([
            { id: 'some-api-key-id', apiSecret: 'expected-secret-key' } as any
        ])
        mockedCompareKeys.mockImplementation((expected, supplied) => expected === supplied)

        const result = await validateCanvasApiKey(req as Request, canvas)
        expect(result).toBe(true)
    })
})
