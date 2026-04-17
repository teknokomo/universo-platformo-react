import { describe, expect, it } from 'vitest'

import { buildLinkedCollectionAuthoringPath } from '../entityMetadataRoutePaths'
import {
    buildOptionListAuthoringPath,
    buildTreeEntityAuthoringPath,
    buildValueGroupAuthoringPath,
    resolveEntityChildKindKey
} from '../entityMetadataRoutePaths'

describe('entityMetadataRoutePaths', () => {
    it('builds top-level entity-owned hub, set, and enumeration detail paths', () => {
        expect(
            buildTreeEntityAuthoringPath({
                metahubId: 'metahub-1',
                treeEntityId: 'hub-1',
                kindKey: 'hub',
                tab: 'treeEntities'
            })
        ).toBe('/metahub/metahub-1/entities/hub/instance/hub-1/instances')

        expect(
            buildValueGroupAuthoringPath({
                metahubId: 'metahub-1',
                valueGroupId: 'set-1',
                kindKey: 'set'
            })
        ).toBe('/metahub/metahub-1/entities/set/instance/set-1/fixed-values')

        expect(
            buildOptionListAuthoringPath({
                metahubId: 'metahub-1',
                optionListId: 'enumeration-1',
                kindKey: 'enumeration'
            })
        ).toBe('/metahub/metahub-1/entities/enumeration/instance/enumeration-1/values')
    })

    it('builds hub-scoped entity-owned child paths without dropping the entity shell', () => {
        expect(
            buildLinkedCollectionAuthoringPath({
                metahubId: 'metahub-1',
                treeEntityId: 'hub-1',
                linkedCollectionId: 'catalog-1',
                kindKey: 'hub',
                tab: 'fieldDefinitions'
            })
        ).toBe('/metahub/metahub-1/entities/catalog/instance/hub-1/instance/catalog-1/field-definitions')

        expect(
            buildValueGroupAuthoringPath({
                metahubId: 'metahub-1',
                treeEntityId: 'hub-1',
                valueGroupId: 'set-1',
                kindKey: 'hub'
            })
        ).toBe('/metahub/metahub-1/entities/set/instance/hub-1/instance/set-1/fixed-values')

        expect(
            buildOptionListAuthoringPath({
                metahubId: 'metahub-1',
                treeEntityId: 'hub-1',
                optionListId: 'enumeration-1',
                kindKey: 'hub'
            })
        ).toBe('/metahub/metahub-1/entities/enumeration/instance/hub-1/instance/enumeration-1/values')
    })

    it('resolves compatible child kind keys for delegated hub-owned routes', () => {
        expect(resolveEntityChildKindKey({ routeKindKey: 'hub', childObjectKind: 'catalog' })).toBe('catalog')
        expect(resolveEntityChildKindKey({ routeKindKey: 'hub', childObjectKind: 'set' })).toBe('set')
        expect(resolveEntityChildKindKey({ routeKindKey: 'hub', childObjectKind: 'enumeration' })).toBe('enumeration')
        expect(resolveEntityChildKindKey({ routeKindKey: 'catalog', childObjectKind: 'hub' })).toBe('hub')
        expect(resolveEntityChildKindKey({ routeKindKey: 'set', childObjectKind: 'set' })).toBe('set')
        expect(resolveEntityChildKindKey({ routeKindKey: 'custom.product', childObjectKind: 'set' })).toBe('custom.product')
        expect(resolveEntityChildKindKey({ routeKindKey: undefined, childObjectKind: 'set' })).toBeUndefined()
    })
})
