import { Request } from 'express'
import { validateChatflowAPIKey } from '../../src/utils/validateKey'
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

describe('validateChatflowAPIKey', () => {
    let req: Partial<Request> & { headers: Record<string, string> }
    let chatflow: CanvasFlowResult
    const mockedApiKeyService = apikeyService as jest.Mocked<typeof apikeyService>
    const mockedCompareKeys = compareKeys as jest.Mock

    beforeEach(() => {
        req = {
            headers: {}
        }
        chatflow = {
            apikeyid: null
        } as unknown as CanvasFlowResult
        jest.clearAllMocks()
    })

    it('should return true if chatflow.apikeyid is not set', async () => {
        const result = await validateChatflowAPIKey(req as Request, chatflow)
        expect(result).toBe(true)
    })

    it('should return false if chatflow.apikeyid is set but authorization header is missing', async () => {
        chatflow.apikeyid = 'some-api-key-id'
        const result = await validateChatflowAPIKey(req as Request, chatflow)
        expect(result).toBe(false)
    })

    it('should return false if supplied key does not match the expected key', async () => {
        chatflow.apikeyid = 'some-api-key-id'
        req.headers['authorization'] = 'Bearer invalid-key'
        mockedApiKeyService.getAllApiKeys.mockResolvedValue([
            { id: 'some-api-key-id', apiSecret: 'expected-secret-key' } as any
        ])
        mockedCompareKeys.mockImplementation((expected, supplied) => expected === supplied)

        const result = await validateChatflowAPIKey(req as Request, chatflow)
        expect(result).toBe(false)
    })

    it('should return true if supplied key matches the expected key', async () => {
        chatflow.apikeyid = 'some-api-key-id'
        req.headers['authorization'] = 'Bearer expected-secret-key'
        mockedApiKeyService.getAllApiKeys.mockResolvedValue([
            { id: 'some-api-key-id', apiSecret: 'expected-secret-key' } as any
        ])
        mockedCompareKeys.mockImplementation((expected, supplied) => expected === supplied)

        const result = await validateChatflowAPIKey(req as Request, chatflow)
        expect(result).toBe(true)
    })
})
