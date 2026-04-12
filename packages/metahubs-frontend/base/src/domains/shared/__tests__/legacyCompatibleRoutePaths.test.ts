import { describe, expect, it } from 'vitest'

import { buildCatalogAuthoringPath } from '../../catalogs/ui/catalogRoutePaths'
import {
    buildEnumerationAuthoringPath,
    buildHubAuthoringPath,
    buildSetAuthoringPath,
    resolveLegacyCompatibleChildKindKey
} from '../legacyCompatibleRoutePaths'

describe('legacyCompatibleRoutePaths', () => {
    it('builds top-level entity-owned hub, set, and enumeration detail paths', () => {
        expect(
            buildHubAuthoringPath({
                metahubId: 'metahub-1',
                hubId: 'hub-1',
                kindKey: 'custom.hub-v2',
                tab: 'hubs'
            })
        ).toBe('/metahub/metahub-1/entities/custom.hub-v2/instance/hub-1/hubs')

        expect(
            buildSetAuthoringPath({
                metahubId: 'metahub-1',
                setId: 'set-1',
                kindKey: 'custom.set-v2'
            })
        ).toBe('/metahub/metahub-1/entities/custom.set-v2/instance/set-1/constants')

        expect(
            buildEnumerationAuthoringPath({
                metahubId: 'metahub-1',
                enumerationId: 'enumeration-1',
                kindKey: 'custom.enumeration-v2'
            })
        ).toBe('/metahub/metahub-1/entities/custom.enumeration-v2/instance/enumeration-1/values')
    })

    it('builds hub-scoped entity-owned child paths without dropping the entity shell', () => {
        expect(
            buildCatalogAuthoringPath({
                metahubId: 'metahub-1',
                hubId: 'hub-1',
                catalogId: 'catalog-1',
                kindKey: 'custom.hub-v2',
                tab: 'attributes'
            })
        ).toBe('/metahub/metahub-1/entities/custom.hub-v2/instance/hub-1/catalog/catalog-1/attributes')

        expect(
            buildSetAuthoringPath({
                metahubId: 'metahub-1',
                hubId: 'hub-1',
                setId: 'set-1',
                kindKey: 'custom.hub-v2'
            })
        ).toBe('/metahub/metahub-1/entities/custom.hub-v2/instance/hub-1/set/set-1/constants')

        expect(
            buildEnumerationAuthoringPath({
                metahubId: 'metahub-1',
                hubId: 'hub-1',
                enumerationId: 'enumeration-1',
                kindKey: 'custom.hub-v2'
            })
        ).toBe('/metahub/metahub-1/entities/custom.hub-v2/instance/hub-1/enumeration/enumeration-1/values')
    })

    it('resolves compatible child kind keys for delegated hub-owned routes', () => {
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.hub-v2', childObjectKind: 'catalog' })).toBe(
            'custom.catalog-v2'
        )
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.hub-v2-demo', childObjectKind: 'catalog' })).toBe(
            'custom.catalog-v2'
        )
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.hub-v2', childObjectKind: 'set' })).toBe('custom.set-v2')
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.hub-v2-demo', childObjectKind: 'set' })).toBe('custom.set-v2')
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.hub-v2', childObjectKind: 'enumeration' })).toBe(
            'custom.enumeration-v2'
        )
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.hub-v2-demo', childObjectKind: 'enumeration' })).toBe(
            'custom.enumeration-v2'
        )
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.set-v2', childObjectKind: 'set' })).toBe('custom.set-v2')
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.set-v2-demo', childObjectKind: 'set' })).toBe('custom.set-v2-demo')
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: 'custom.product', childObjectKind: 'set' })).toBe('custom.product')
        expect(resolveLegacyCompatibleChildKindKey({ routeKindKey: undefined, childObjectKind: 'set' })).toBeUndefined()
    })
})