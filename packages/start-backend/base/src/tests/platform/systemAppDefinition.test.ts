import { startSystemAppDefinition } from '../../platform/systemAppDefinition'

describe('startSystemAppDefinition', () => {
    it('has key "start" and fixed schema name "start"', () => {
        expect(startSystemAppDefinition.key).toBe('start')
        expect(startSystemAppDefinition.schemaTarget).toEqual({
            kind: 'fixed',
            schemaName: 'start'
        })
    })

    it('declares 4 business tables with correct kinds', () => {
        const tables = startSystemAppDefinition.currentBusinessTables
        expect(tables).toHaveLength(4)

        const objectTables = tables.filter((t) => t.kind === 'object')
        const relationTables = tables.filter((t) => t.kind === 'relation')
        expect(objectTables).toHaveLength(3)
        expect(relationTables).toHaveLength(1)

        const codenames = tables.map((t) => t.codename)
        expect(codenames).toEqual(['goals', 'topics', 'features', 'user_selections'])
    })

    it('has 3 migration entries with correct bootstrap phases', () => {
        expect(startSystemAppDefinition.migrations).toHaveLength(3)

        const [prepare, finalize, policies] = startSystemAppDefinition.migrations
        expect(prepare.bootstrapPhase).toBe('pre_schema_generation')
        expect(prepare.kind).toBe('sql')
        expect(finalize.bootstrapPhase).toBe('post_schema_generation')
        expect(finalize.kind).toBe('sql')
        expect(policies.bootstrapPhase).toBe('post_schema_generation')
        expect(policies.kind).toBe('sql')
    })

    it('uses application_like storage model', () => {
        expect(startSystemAppDefinition.currentStorageModel).toBe('application_like')
        expect(startSystemAppDefinition.targetStorageModel).toBe('application_like')
    })

    it('enables object and relation structure capabilities', () => {
        const caps = startSystemAppDefinition.currentStructureCapabilities
        expect(caps.objectTables).toBe(true)
        expect(caps.relationTables).toBe(true)
        expect(caps.documentTables).toBe(false)
    })

    it('current and target business tables are identical', () => {
        expect(startSystemAppDefinition.currentBusinessTables).toBe(startSystemAppDefinition.targetBusinessTables)
    })
})
