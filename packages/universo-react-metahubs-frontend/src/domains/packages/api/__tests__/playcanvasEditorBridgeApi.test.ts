import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('playcanvasEditorBridgeApi', () => {
    it('maps global CSRF rejection to a typed PlayCanvas Editor bridge error', async () => {
        const post = vi.fn().mockRejectedValue({ response: { status: 419, data: { message: 'CSRF token expired' } } })

        vi.doMock('../../../shared', () => ({
            apiClient: { post }
        }))

        const { playcanvasEditorBridgeApi } = await import('../playcanvasEditorBridgeApi')
        const command = {
            type: 'bridge.capabilities',
            requestId: '019e8afa-0000-7000-8000-000000000001',
            sessionId: '019e8afa-0000-7000-8000-000000000002',
            nonce: 'n'.repeat(32)
        } as const

        await expect(
            playcanvasEditorBridgeApi.sendCommand('metahub-1', {
                sessionToken: 's'.repeat(64),
                command
            })
        ).rejects.toMatchObject({
            response: {
                status: 419,
                data: {
                    ok: false,
                    requestId: command.requestId,
                    code: 'csrfRequired',
                    status: 419
                }
            }
        })
    })
})
