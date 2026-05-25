import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createClientModuleContext,
    fetchRuntimeModules,
    filterRuntimeWidgetModules,
    selectRuntimeWidgetModule
} from '../runtimeWidgetHelpers'

describe('runtimeWidgetHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters widget modules down to unique client-capable widget entries', () => {
        const filtered = filterRuntimeWidgetModules([
            {
                id: 'module-1',
                codename: 'widget-a',
                moduleRole: 'widget',
                manifest: { methods: [{ name: 'mount', target: 'client' }] }
            },
            {
                id: 'module-1',
                codename: 'widget-a-duplicate',
                moduleRole: 'widget',
                manifest: { methods: [{ name: 'mount', target: 'client' }] }
            },
            {
                id: 'module-2',
                codename: 'server-only',
                moduleRole: 'widget',
                manifest: { methods: [{ name: 'mount', target: 'server' }] }
            },
            {
                id: 'module-3',
                codename: 'not-widget',
                moduleRole: 'automation',
                manifest: { methods: [{ name: 'mount', target: 'client' }] }
            }
        ] as never)

        expect(filtered).toHaveLength(1)
        expect(filtered[0]?.codename).toBe('widget-a')
    })

    it('selects a named runtime widget module or falls back to the first one', () => {
        const modules = [
            { id: 'module-1', codename: 'widget-a' },
            { id: 'module-2', codename: 'widget-b' }
        ] as never

        expect(selectRuntimeWidgetModule(modules, 'widget-b')?.id).toBe('module-2')
        expect(selectRuntimeWidgetModule(modules, null)?.id).toBe('module-1')
    })

    it('fetches runtime modules with the attached entity in the query string', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                items: [{ id: 'module-1', codename: 'widget-runtime' }]
            })
        }))

        vi.stubGlobal('fetch', fetchMock)

        const items = await fetchRuntimeModules({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            attachedToKind: 'object',
            attachedToId: 'object-1'
        })

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/api/v1/applications/app-1/runtime/modules?attachedToKind=object&attachedToId=object-1'),
            { credentials: 'include' }
        )
        expect(items).toEqual([{ id: 'module-1', codename: 'widget-runtime' }])
    })

    it('creates a client context that exposes metadata only when the capability is enabled', async () => {
        const context = createClientModuleContext({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            module: {
                id: 'module-1',
                codename: 'widget-runtime',
                attachedToKind: 'object',
                attachedToId: 'object-1',
                manifest: {
                    capabilities: ['metadata.read'],
                    methods: []
                }
            } as never
        })

        await expect(context.metadata.getAttachedEntity()).resolves.toEqual({
            kind: 'object',
            id: 'object-1'
        })
        await expect(context.callServerMethod('mount', [])).rejects.toThrow('Module capability "rpc.client" is not enabled for this module')
    })
})
