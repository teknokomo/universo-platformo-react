import { buildBaselineMigrationMeta, parseMetahubMigrationMeta } from '../../domains/metahubs/services/metahubMigrationMeta'
import { buildSystemStructureSnapshot } from '../../domains/metahubs/services/systemTableDefinitions'

describe('metahubMigrationMeta', () => {
    it('parses serialized baseline meta payload', () => {
        const meta = buildBaselineMigrationMeta(buildSystemStructureSnapshot(1), null, '019ccefc-2f7b-7b36-82f4-85cdb1312268')
        const parsed = parseMetahubMigrationMeta(JSON.stringify(meta))

        expect(parsed).toBeTruthy()
        expect(parsed?.kind).toBe('baseline')
        expect(parsed?.globalRunId).toBe('019ccefc-2f7b-7b36-82f4-85cdb1312268')
    })

    it('returns null for unknown payload shape', () => {
        const parsed = parseMetahubMigrationMeta({ kind: 'unknown' })
        expect(parsed).toBeNull()
    })
})
