import {
    calculateDefinitionChecksum,
    buildLogicalKey,
    createDefinitionArtifact,
    registerDefinition,
    listDefinitions,
    getDefinitionByLogicalKey,
    getActiveRevision,
    listRevisions,
    exportDefinitions,
    importDefinitions,
    recordDefinitionExport
} from '../DefinitionRegistryStore'
import type { DefinitionArtifact } from '../DefinitionRegistryStore'

// ---------------------------------------------------------------------------
// Knex mock helpers
// ---------------------------------------------------------------------------

type StoredRow = Record<string, unknown>

function createMockKnex() {
    const tables: Record<string, StoredRow[]> = {
        'upl_migrations.definition_registry': [],
        'upl_migrations.definition_revisions': [],
        'upl_migrations.definition_exports': []
    }

    const createQueryBuilderForTable = (tableName: string) => {
        let matchedRows: StoredRow[] = [...(tables[tableName] ?? [])]
        let limitValue: number | null = null
        let offsetValue: number | null = null

        const qb: Record<string, jest.Mock> = {
            where: jest.fn((criteria: Record<string, unknown> | string, val?: unknown) => {
                if (typeof criteria === 'string' && val !== undefined) {
                    if (val === 'like') {
                        // This is likely .where('col', 'like', 'pattern')
                        // Actually knex signature is .where(col, operator, value)
                        // The mock is imperfect for this case, skip filtering
                    } else {
                        matchedRows = matchedRows.filter((row) => row[criteria] === val)
                    }
                } else if (typeof criteria === 'object') {
                    matchedRows = matchedRows.filter((row) =>
                        Object.entries(criteria).every(([key, value]) => row[key] === value)
                    )
                }
                return qb
            }),
            whereNotNull: jest.fn((col: string) => {
                matchedRows = matchedRows.filter((row) => row[col] != null)
                return qb
            }),
            orderBy: jest.fn(() => qb),
            limit: jest.fn((n: number) => {
                limitValue = n
                return qb
            }),
            offset: jest.fn((n: number) => {
                offsetValue = n
                return qb
            }),
            clone: jest.fn(() => {
                const cloned = createQueryBuilderForTable(tableName)
                // Make cloned work on same matchedRows
                return cloned
            }),
            count: jest.fn(() => {
                const countQb = {
                    first: jest.fn(async () => ({ count: String(tables[tableName]?.length ?? 0) }))
                }
                return countQb
            }),
            first: jest.fn(async () => {
                return matchedRows[0] ?? undefined
            }),
            insert: jest.fn(async (row: StoredRow) => {
                if (!tables[tableName]) tables[tableName] = []
                tables[tableName].push(row)
            }),
            update: jest.fn(async (patch: StoredRow) => {
                for (const row of matchedRows) {
                    Object.assign(row, patch)
                }
            }),
            // Make the query builder thenable (for async iteration / select)
            then: jest.fn((resolve: (v: StoredRow[]) => void) => {
                let result = matchedRows
                if (offsetValue != null) result = result.slice(offsetValue)
                if (limitValue != null) result = result.slice(0, limitValue)
                return resolve(result)
            })
        }

        return qb
    }

    const knex = jest.fn((tableName: string) => createQueryBuilderForTable(tableName))

    return { knex, tables }
}

// ---------------------------------------------------------------------------
// Test artifacts
// ---------------------------------------------------------------------------

const testArtifact1: DefinitionArtifact = createDefinitionArtifact({
    kind: 'table',
    name: 'users',
    schemaQualifiedName: 'public.users',
    sql: 'CREATE TABLE public.users (id uuid PRIMARY KEY, name text NOT NULL)',
    dependencies: []
})

const testArtifact2: DefinitionArtifact = createDefinitionArtifact({
    kind: 'index',
    name: 'idx_users_name',
    schemaQualifiedName: 'public.idx_users_name',
    sql: 'CREATE INDEX idx_users_name ON public.users(name)',
    dependencies: ['public.users::table']
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateDefinitionChecksum', () => {
    it('returns a 64-character hex SHA-256 hash', () => {
        const checksum = calculateDefinitionChecksum('CREATE TABLE test (id int)')
        expect(checksum).toHaveLength(64)
        expect(checksum).toMatch(/^[0-9a-f]{64}$/)
    })

    it('returns stable checksums for identical SQL', () => {
        const a = calculateDefinitionChecksum('SELECT 1')
        const b = calculateDefinitionChecksum('SELECT 1')
        expect(a).toBe(b)
    })

    it('returns different checksums for different SQL', () => {
        const a = calculateDefinitionChecksum('SELECT 1')
        const b = calculateDefinitionChecksum('SELECT 2')
        expect(a).not.toBe(b)
    })
})

describe('buildLogicalKey', () => {
    it('combines schemaQualifiedName and kind', () => {
        const key = buildLogicalKey({ schemaQualifiedName: 'public.users', kind: 'table' })
        expect(key).toBe('public.users::table')
    })
})

describe('createDefinitionArtifact', () => {
    it('computes the checksum from SQL content', () => {
        const artifact = createDefinitionArtifact({
            kind: 'table',
            name: 'test',
            schemaQualifiedName: 'public.test',
            sql: 'CREATE TABLE public.test (id int)',
            dependencies: []
        })
        expect(artifact.checksum).toBe(calculateDefinitionChecksum('CREATE TABLE public.test (id int)'))
    })
})

describe('registerDefinition', () => {
    it('creates a new registry entry and revision for a new artifact', async () => {
        const { knex } = createMockKnex()

        const result = await registerDefinition(knex as never, testArtifact1)

        expect(result.created).toBe(true)
        expect(result.registry.logicalKey).toBe('public.users::table')
        expect(result.registry.kind).toBe('table')
        expect(result.revision.checksum).toBe(testArtifact1.checksum)
    })

    it('returns idempotently for the same artifact', async () => {
        const { knex, tables } = createMockKnex()

        // First registration
        const first = await registerDefinition(knex as never, testArtifact1)
        expect(first.created).toBe(true)

        // Same artifact — should find existing
        const second = await registerDefinition(knex as never, testArtifact1)
        expect(second.created).toBe(false)
        expect(second.revision.checksum).toBe(testArtifact1.checksum)
    })

    it('creates a new revision when checksum changes', async () => {
        const { knex } = createMockKnex()

        // First registration
        await registerDefinition(knex as never, testArtifact1)

        // Modified artifact — different SQL/checksum
        const modified: DefinitionArtifact = createDefinitionArtifact({
            ...testArtifact1,
            sql: 'CREATE TABLE public.users (id uuid PRIMARY KEY, name text NOT NULL, email text)'
        })

        const result = await registerDefinition(knex as never, modified)
        expect(result.created).toBe(false)
        expect(result.revision.checksum).toBe(modified.checksum)
    })
})

describe('listDefinitions', () => {
    it('returns empty list when no definitions exist', async () => {
        const { knex } = createMockKnex()

        const result = await listDefinitions(knex as never)
        expect(result.total).toBe(0)
        expect(result.records).toEqual([])
    })
})

describe('exportDefinitions + importDefinitions round-trip', () => {
    it('exports and re-imports artifacts correctly', async () => {
        const { knex } = createMockKnex()

        // Import two artifacts
        const importResult = await importDefinitions(knex as never, [testArtifact1, testArtifact2])
        expect(importResult.created).toBe(2)
        expect(importResult.unchanged).toBe(0)

        // Export them back
        const exported = await exportDefinitions(knex as never)
        expect(exported).toHaveLength(2)
        expect(exported.map((a) => a.name)).toContain('users')
        expect(exported.map((a) => a.name)).toContain('idx_users_name')
    })

    it('reports unchanged items on re-import', async () => {
        const { knex } = createMockKnex()

        await importDefinitions(knex as never, [testArtifact1])

        const reimport = await importDefinitions(knex as never, [testArtifact1])
        expect(reimport.created).toBe(0)
        expect(reimport.unchanged).toBe(1)
    })
})

describe('recordDefinitionExport', () => {
    it('records an export event', async () => {
        const { knex } = createMockKnex()

        const result = await recordDefinitionExport(knex as never, {
            registryId: 'reg-1',
            exportTarget: 'file:///migrations/001.sql'
        })

        expect(result.registryId).toBe('reg-1')
        expect(result.exportTarget).toBe('file:///migrations/001.sql')
        expect(result.id).toMatch(/^[0-9a-f]{8}-/)
    })
})
