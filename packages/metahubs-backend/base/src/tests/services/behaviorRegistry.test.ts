import { clearBehaviorRegistry, getBehaviorService } from '../../domains/entities/services/behaviorRegistry'
import {
    ensureStandardKindBehaviorsRegistered,
    getEntityBehaviorService
} from '../../domains/entities/services/builtinKindBehaviorRegistry'

describe('behaviorRegistry', () => {
    beforeEach(() => {
        clearBehaviorRegistry()
    })

    it('registers standard-kind behaviors on demand', () => {
        expect(getBehaviorService('catalog')).toBeNull()

        ensureStandardKindBehaviorsRegistered()

        expect(getEntityBehaviorService('catalog')).toMatchObject({
            kindKey: 'catalog',
            entityLabel: 'Catalog',
            aclEntityType: 'catalog'
        })
        expect(getEntityBehaviorService('hub')).toMatchObject({
            kindKey: 'hub',
            entityLabel: 'Hub',
            aclEntityType: 'hub'
        })
        expect(getEntityBehaviorService('custom.kind')).toBeNull()
    })
})
