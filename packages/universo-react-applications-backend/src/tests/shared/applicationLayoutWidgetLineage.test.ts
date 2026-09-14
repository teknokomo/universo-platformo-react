import { stableLineageUuidV7 } from '../../shared/applicationLayoutWidgetLineage'

describe('stableLineageUuidV7', () => {
    it('does not collide for layouts that share the same UUID v7 timestamp prefix', () => {
        const firstLayoutId = '0190a9b5-3cde-7abc-8def-012345678901'
        const secondLayoutId = '0190a9b5-3cde-7def-8def-012345678901'

        const first = stableLineageUuidV7(firstLayoutId, 'workspaceSwitcher')
        const second = stableLineageUuidV7(secondLayoutId, 'workspaceSwitcher')

        expect(first).not.toBe(second)
        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
        expect(second).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    })

    it('is deterministic while separating different lineage keys', () => {
        const layoutId = '0190a9b5-3cde-7abc-8def-012345678901'

        expect(stableLineageUuidV7(layoutId, 'workspaceSwitcher')).toBe(stableLineageUuidV7(layoutId, 'workspaceSwitcher'))
        expect(stableLineageUuidV7(layoutId, 'workspaceSwitcher')).not.toBe(stableLineageUuidV7(layoutId, 'themeSwitcher'))
    })

    it('keeps same-millisecond layout lineage identities unique across a batch', () => {
        const lineageIds = Array.from({ length: 64 }, (_, index) => {
            const suffix = index.toString(16).padStart(12, '0')
            return stableLineageUuidV7(`0190a9b5-3cde-7000-8000-${suffix}`, 'workspaceSwitcher')
        })

        expect(new Set(lineageIds).size).toBe(lineageIds.length)
    })
})
