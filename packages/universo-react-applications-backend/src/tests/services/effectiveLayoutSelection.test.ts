import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { selectCanonicalLayoutCandidate, type CanonicalLayoutSelectionCandidate } from '../../services/effectiveLayoutSelection'

const globalLayout = (overrides: Partial<CanonicalLayoutSelectionCandidate> = {}): CanonicalLayoutSelectionCandidate => ({
    id: 'global-layout',
    scopeEntityId: null,
    isActive: true,
    isDefault: true,
    ...overrides
})

const scopedLayout = (scopeEntityId: string, overrides: Partial<CanonicalLayoutSelectionCandidate> = {}) =>
    globalLayout({ id: 'scoped-layout', scopeEntityId, ...overrides })

describe('selectCanonicalLayoutCandidate', () => {
    it('selects the active scoped default before the global default', () => {
        const result = selectCanonicalLayoutCandidate([globalLayout(), scopedLayout('entity-1')], 'entity-1')

        expect(result).toEqual({ layout: expect.objectContaining({ id: 'scoped-layout' }), scope: 'entity' })
    })

    it('falls back to the global default when a target has no scoped default', () => {
        const result = selectCanonicalLayoutCandidate([globalLayout(), scopedLayout('other-entity')], 'entity-1')

        expect(result).toEqual({ layout: expect.objectContaining({ id: 'global-layout' }), scope: 'global' })
    })

    it('fails closed when a scope contains duplicate active defaults', () => {
        expect(() => selectCanonicalLayoutCandidate([globalLayout({ id: 'global-1' }), globalLayout({ id: 'global-2' })], null)).toThrow(
            new EffectiveLayoutError('LAYOUT_DEFAULT_INVALID')
        )
    })

    it('returns no selection when no active default exists', () => {
        expect(selectCanonicalLayoutCandidate([globalLayout({ isActive: false })], null)).toBeNull()
    })
})
