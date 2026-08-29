import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('modulesApi source metadata boundary', () => {
    it('does not retain absolute filesystem paths in browser-facing module records', async () => {
        const get = vi.fn().mockResolvedValue({
            data: {
                items: [
                    {
                        id: 'module-1',
                        sourceStorage: {
                            mode: 'file',
                            path: 'modules/general/example.ts',
                            absolutePath: '/srv/app/metahubs/metahub-1/branches/main/modules/general/example.ts',
                            checksum: 'source-checksum',
                            status: 'ready'
                        }
                    }
                ]
            }
        })

        vi.doMock('../../../shared', () => ({
            apiClient: { get }
        }))

        const { modulesApi } = await import('../modulesApi')
        const [module] = await modulesApi.list('metahub-1', { attachedToKind: 'general', attachedToId: null })

        expect(module.sourceStorage).toEqual({
            mode: 'file',
            path: 'modules/general/example.ts',
            checksum: 'source-checksum',
            status: 'ready'
        })
        expect(module.sourceStorage).not.toHaveProperty('absolutePath')
    })
})
