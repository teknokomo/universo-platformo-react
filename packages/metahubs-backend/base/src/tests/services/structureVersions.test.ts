import { CURRENT_STRUCTURE_VERSION, getStructureVersion } from '../../domains/metahubs/services/structureVersions'

describe('structureVersions registry', () => {
    it('exposes v1 as current structure revision', () => {
        expect(CURRENT_STRUCTURE_VERSION).toBe(1)
    })

    it('exposes enumeration values table in current structure version', () => {
        const current = getStructureVersion(CURRENT_STRUCTURE_VERSION)
        expect(current.tables).toContain('_mhb_values')
        expect(current.tables).toContain('_mhb_constants')
    })
})
