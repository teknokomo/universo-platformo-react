import { describe, expect, it } from 'vitest'
import { toAuthenticatedRuntimePlacementScopes, toMessengerZoneWidgets } from '../api'
import type { RuntimeEffectiveLayoutSuccess } from '../api'

const effectiveLayout = (zone: string): RuntimeEffectiveLayoutSuccess =>
    ({
        status: 'ok',
        layout: { id: 'layout-id', templateKey: 'messenger-app', config: {}, version: 1 },
        target: { targetKind: null, entityTypeId: null },
        resolvedEntityTypeId: null,
        effectiveHash: 'a'.repeat(64),
        widgets: [
            {
                id: 'widget-id',
                layoutId: 'layout-id',
                instanceKey: 'top-divider',
                widgetKey: 'divider',
                zone,
                sortOrder: 0,
                config: {},
                isActive: true,
                parentInstanceKey: null,
                slotKey: null
            }
        ]
    } as unknown as RuntimeEffectiveLayoutSuccess)

describe('Messenger effective-layout adapter', () => {
    it('projects the canonical three zones and keeps authenticated placement scopes', () => {
        const result = effectiveLayout('top')

        expect(toMessengerZoneWidgets(result)).toMatchObject({ top: [{ instanceKey: 'top-divider' }], center: [], bottom: [] })
        expect(toAuthenticatedRuntimePlacementScopes(result)?.['top-divider']).toEqual({ widgetId: 'widget-id', layoutId: 'layout-id' })
    })

    it('fails closed on a non-Messenger zone', () => {
        expect(() => toMessengerZoneWidgets(effectiveLayout('left'))).toThrow(/unsupported Messenger App zone/)
    })
})
