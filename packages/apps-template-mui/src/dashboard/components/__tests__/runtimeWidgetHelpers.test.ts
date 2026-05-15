import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createClientScriptContext,
    fetchRuntimeScripts,
    filterRuntimeWidgetScripts,
    selectRuntimeWidgetScript
} from '../runtimeWidgetHelpers'

describe('runtimeWidgetHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters widget scripts down to unique client-capable widget entries', () => {
        const filtered = filterRuntimeWidgetScripts([
            {
                id: 'script-1',
                codename: 'module-a',
                moduleRole: 'widget',
                manifest: { methods: [{ name: 'mount', target: 'client' }] }
            },
            {
                id: 'script-1',
                codename: 'module-a-duplicate',
                moduleRole: 'widget',
                manifest: { methods: [{ name: 'mount', target: 'client' }] }
            },
            {
                id: 'script-2',
                codename: 'server-only',
                moduleRole: 'widget',
                manifest: { methods: [{ name: 'mount', target: 'server' }] }
            },
            {
                id: 'script-3',
                codename: 'not-widget',
                moduleRole: 'automation',
                manifest: { methods: [{ name: 'mount', target: 'client' }] }
            }
        ] as never)

        expect(filtered).toHaveLength(1)
        expect(filtered[0]?.codename).toBe('module-a')
    })

    it('selects a named runtime widget script or falls back to the first one', () => {
        const scripts = [
            { id: 'script-1', codename: 'module-a' },
            { id: 'script-2', codename: 'module-b' }
        ] as never

        expect(selectRuntimeWidgetScript(scripts, 'module-b')?.id).toBe('script-2')
        expect(selectRuntimeWidgetScript(scripts, null)?.id).toBe('script-1')
    })

    it('fetches runtime scripts with the attached entity in the query string', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                items: [{ id: 'script-1', codename: 'widget-runtime' }]
            })
        }))

        vi.stubGlobal('fetch', fetchMock)

        const items = await fetchRuntimeScripts({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            attachedToKind: 'object',
            attachedToId: 'object-1'
        })

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/api/v1/applications/app-1/runtime/scripts?attachedToKind=object&attachedToId=object-1'),
            { credentials: 'include' }
        )
        expect(items).toEqual([{ id: 'script-1', codename: 'widget-runtime' }])
    })

    it('creates a client context that exposes metadata only when the capability is enabled', async () => {
        const context = createClientScriptContext({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            script: {
                id: 'script-1',
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
        await expect(context.callServerMethod('mount', [])).rejects.toThrow('Script capability "rpc.client" is not enabled for this module')
    })
})
