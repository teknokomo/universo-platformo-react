import {
    areDefinitionArtifactsEquivalent,
    calculateDefinitionChecksum,
    buildLogicalKey,
    createDefinitionArtifact,
    createDefinitionBundle,
    createDefinitionDraft,
    ensureDefinitionExportRecorded,
    exportDefinitionBundle,
    registerDefinition,
    listDefinitions,
    listDefinitionDrafts,
    listDefinitionExports,
    exportDefinitions,
    importDefinitionBundle,
    importDefinitions,
    publishDefinitionDraft,
    recordApprovalEvent,
    recordDefinitionExport,
    requestDefinitionReview
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
        'upl_migrations.definition_exports': [],
        'upl_migrations.definition_drafts': [],
        'upl_migrations.approval_events': []
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
                    matchedRows = matchedRows.filter((row) => Object.entries(criteria).every(([key, value]) => row[key] === value))
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

describe('areDefinitionArtifactsEquivalent', () => {
    it('treats dependency-only changes as real artifact drift', () => {
        const withDependency = {
            ...testArtifact1,
            dependencies: ['public.roles::table']
        }

        expect(areDefinitionArtifactsEquivalent(testArtifact1, withDependency)).toBe(false)
    })
})

describe('registerDefinition', () => {
    it('creates a new registry entry and revision for a new artifact', async () => {
        const { knex } = createMockKnex()

        const result = await registerDefinition(knex as never, testArtifact1)

        expect(result.created).toBe(true)
        expect(result.changeType).toBe('created')
        expect(result.registry.logicalKey).toBe('public.users::table')
        expect(result.registry.kind).toBe('table')
        expect(result.revision.checksum).toBe(testArtifact1.checksum)
    })

    it('returns idempotently for the same artifact', async () => {
        const { knex } = createMockKnex()

        // First registration
        const first = await registerDefinition(knex as never, testArtifact1)
        expect(first.created).toBe(true)

        // Same artifact — should find existing
        const second = await registerDefinition(knex as never, testArtifact1)
        expect(second.created).toBe(false)
        expect(second.changeType).toBe('unchanged')
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
        expect(result.changeType).toBe('updated')
        expect(result.revision.checksum).toBe(modified.checksum)
    })

    it('rejects artifacts with mismatched checksums', async () => {
        const { knex } = createMockKnex()

        await expect(
            registerDefinition(knex as never, {
                ...testArtifact1,
                checksum: 'broken-checksum'
            })
        ).rejects.toThrow('Definition artifact checksum mismatch')
    })

    it('creates a new revision when dependencies change without SQL changes', async () => {
        const { knex } = createMockKnex()

        await registerDefinition(knex as never, testArtifact1)

        const dependencyDriftArtifact: DefinitionArtifact = {
            ...testArtifact1,
            dependencies: ['public.roles::table']
        }

        const result = await registerDefinition(knex as never, dependencyDriftArtifact)

        expect(result.created).toBe(false)
        expect(result.changeType).toBe('updated')
        expect(result.revision.payload.dependencies).toEqual(['public.roles::table'])
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
        const { knex, tables } = createMockKnex()

        // Import two artifacts
        const importResult = await importDefinitions(knex as never, [testArtifact1, testArtifact2])
        expect(importResult.created).toBe(2)
        expect(importResult.unchanged).toBe(0)
        expect(tables['upl_migrations.definition_drafts']).toHaveLength(2)
        expect(tables['upl_migrations.approval_events']).toHaveLength(4)

        // Export them back
        const exported = await exportDefinitions(knex as never)
        expect(exported).toHaveLength(2)
        expect(exported.map((a) => a.name)).toContain('users')
        expect(exported.map((a) => a.name)).toContain('idx_users_name')
    })

    it('reports unchanged items on re-import', async () => {
        const { knex, tables } = createMockKnex()

        await importDefinitions(knex as never, [testArtifact1])

        const reimport = await importDefinitions(knex as never, [testArtifact1])
        expect(reimport.created).toBe(0)
        expect(reimport.unchanged).toBe(1)
        expect(tables['upl_migrations.definition_drafts']).toHaveLength(1)
        expect(tables['upl_migrations.approval_events']).toHaveLength(2)
    })

    it('rejects import bundles with dependency cycles', async () => {
        const { knex } = createMockKnex()

        const cyclicArtifact = createDefinitionArtifact({
            kind: 'table',
            name: 'cyclic',
            schemaQualifiedName: 'public.cyclic',
            sql: 'CREATE TABLE public.cyclic (id uuid PRIMARY KEY)',
            dependencies: ['public.cyclic::table']
        })

        await expect(importDefinitions(knex as never, [cyclicArtifact])).rejects.toThrow('Definition artifact graph is invalid')
    })

    it('wraps imports in a single transaction when the executor exposes transaction()', async () => {
        const { knex } = createMockKnex()
        const raw = jest.fn(async () => ({ rows: [] }))
        const transactionKnex = Object.assign(((tableName: string) => knex(tableName)) as typeof knex, knex, {
            isTransaction: true,
            raw
        })
        const transaction = jest.fn(async (callback: (trx: typeof transactionKnex) => Promise<unknown>) => callback(transactionKnex))
        const executorWithTransaction = Object.assign(knex, { transaction, raw })

        const result = await importDefinitions(executorWithTransaction as never, [testArtifact1, testArtifact2], {
            sourceKind: 'file',
            provenance: { actor: 'jest' }
        })

        expect(transaction).toHaveBeenCalledTimes(1)
        expect(result).toEqual({
            created: 2,
            updated: 0,
            unchanged: 0
        })
    })
})

describe('definition draft lifecycle', () => {
    it('creates a draft backed by a registry shell row', async () => {
        const { knex, tables } = createMockKnex()

        const draft = await createDefinitionDraft(knex as never, testArtifact1, {
            sourceKind: 'file',
            authorId: 'user-1',
            compilerVersion: '1.2.3'
        })

        expect(draft.status).toBe('draft')
        expect(draft.registryId).toBeTruthy()
        expect(draft.authorId).toBe('user-1')
        expect(draft.provenance).toMatchObject({
            sourceKind: 'file',
            actorId: 'user-1',
            reviewState: 'draft',
            compilerVersion: '1.2.3',
            checksumFamily: 'sha256'
        })
        expect(tables['upl_migrations.definition_registry']).toHaveLength(1)
        expect(tables['upl_migrations.definition_revisions']).toHaveLength(0)
    })

    it('rejects attempts to create a draft directly in review status', async () => {
        const { knex } = createMockKnex()

        await expect(
            createDefinitionDraft(knex as never, testArtifact1, {
                authorId: 'user-1',
                status: 'review'
            } as never)
        ).rejects.toThrow('Definition drafts must be created in draft status')
    })

    it('moves a draft into review and records an approval event', async () => {
        const { knex, tables } = createMockKnex()
        const draft = await createDefinitionDraft(knex as never, testArtifact1, { authorId: 'user-1' })

        const reviewed = await requestDefinitionReview(knex as never, draft.id, {
            actorId: 'reviewer-1',
            payload: { reason: 'ready-for-review' }
        })

        expect(reviewed.status).toBe('review')
        expect(reviewed.provenance).toMatchObject({
            actorId: 'reviewer-1',
            reviewState: 'review'
        })
        expect(tables['upl_migrations.approval_events']).toHaveLength(1)
    })

    it('rejects review requests unless the draft is still in draft status', async () => {
        const { knex } = createMockKnex()
        const draft = await createDefinitionDraft(knex as never, testArtifact1, { authorId: 'user-1' })

        await requestDefinitionReview(knex as never, draft.id, { actorId: 'reviewer-1' })

        await expect(requestDefinitionReview(knex as never, draft.id, { actorId: 'reviewer-2' })).rejects.toThrow(
            'must be in draft status before review request'
        )
    })

    it('publishes a reviewed draft into active revisions and records approval metadata', async () => {
        const { knex, tables } = createMockKnex()
        const draft = await createDefinitionDraft(knex as never, testArtifact1, { authorId: 'user-1', sourceKind: 'file' })
        await requestDefinitionReview(knex as never, draft.id, { actorId: 'reviewer-1' })

        const published = await publishDefinitionDraft(knex as never, draft.id, {
            actorId: 'publisher-1',
            sourceKind: 'file',
            meta: { family: 'platform' }
        })

        expect(published.draft.status).toBe('published')
        expect(published.registry.activeRevisionId).toBe(published.revision.id)
        expect(published.revision.provenance).toMatchObject({
            sourceKind: 'file',
            actorId: 'publisher-1',
            reviewState: 'published'
        })
        expect(tables['upl_migrations.definition_revisions']).toHaveLength(1)
        expect(tables['upl_migrations.approval_events']).toHaveLength(2)

        const drafts = await listDefinitionDrafts(knex as never, { status: 'published' })
        expect(drafts).toHaveLength(1)
    })

    it('rejects publication until a draft has entered review status', async () => {
        const { knex } = createMockKnex()
        const draft = await createDefinitionDraft(knex as never, testArtifact1, { authorId: 'user-1', sourceKind: 'file' })

        await expect(
            publishDefinitionDraft(knex as never, draft.id, {
                actorId: 'publisher-1',
                sourceKind: 'file'
            })
        ).rejects.toThrow('must be in review status before publication')
    })
})

describe('definition bundle lifecycle', () => {
    it('exports a canonical bundle and reimports it', async () => {
        const { knex } = createMockKnex()
        await importDefinitions(knex as never, [testArtifact1, testArtifact2], { sourceKind: 'file' })

        const bundle = await exportDefinitionBundle(knex as never, undefined, {
            sourceKind: 'file',
            meta: { family: 'platform' },
            provenance: { exportedBy: 'jest' }
        })

        expect(bundle.kind).toBe('definition_bundle')
        expect(bundle.bundleVersion).toBe(1)
        expect(bundle.artifacts).toHaveLength(2)
        expect(bundle.meta).toMatchObject({ family: 'platform' })

        const { knex: targetKnex } = createMockKnex()
        const imported = await importDefinitionBundle(targetKnex as never, bundle, {
            provenance: { importedBy: 'jest' }
        })

        expect(imported).toEqual({
            created: 2,
            updated: 0,
            unchanged: 0
        })
    })

    it('creates bundles deterministically from raw artifacts', () => {
        const bundle = createDefinitionBundle({
            artifacts: [testArtifact2, testArtifact1],
            sourceKind: 'declarative'
        })

        expect(bundle.artifacts.map((artifact) => artifact.name)).toEqual(['users', 'idx_users_name'])
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

    it('deduplicates export records for the same revision and target', async () => {
        const { knex } = createMockKnex()

        const first = await ensureDefinitionExportRecorded(knex as never, {
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'registered-platform-sync'
        })
        const second = await ensureDefinitionExportRecorded(knex as never, {
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'registered-platform-sync'
        })

        expect(second.id).toBe(first.id)

        const records = await listDefinitionExports(knex as never, {
            registryId: 'reg-1',
            exportTarget: 'registered-platform-sync'
        })
        expect(records).toHaveLength(1)
    })

    it('returns the concurrently inserted export row after a unique-violation race', async () => {
        const existingRow = {
            id: 'exp-race',
            registry_id: 'reg-1',
            revision_id: 'rev-1',
            export_target: 'registered-platform-sync',
            file_checksum: null,
            meta: null,
            _upl_created_at: new Date().toISOString(),
            _upl_updated_at: new Date().toISOString()
        }

        const definitionExportsTable = {
            where: jest.fn().mockReturnValue({
                first: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingRow)
            }),
            insert: jest.fn().mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint' })
        }

        const trx = jest.fn((tableName: string) => {
            if (tableName === 'upl_migrations.definition_exports') {
                return definitionExportsTable
            }

            throw new Error(`Unexpected table lookup: ${tableName}`)
        })

        const result = await ensureDefinitionExportRecorded(trx as never, {
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'registered-platform-sync'
        })

        expect(result.id).toBe('exp-race')
        expect(definitionExportsTable.insert).toHaveBeenCalledTimes(1)
    })
})

describe('recordApprovalEvent', () => {
    it('stores approval event payloads', async () => {
        const { knex } = createMockKnex()

        const event = await recordApprovalEvent(knex as never, {
            eventKind: 'definition_review_requested',
            actorId: 'reviewer-1',
            payload: { draftId: 'draft-1' }
        })

        expect(event.eventKind).toBe('definition_review_requested')
        expect(event.actorId).toBe('reviewer-1')
        expect(event.payload).toEqual({ draftId: 'draft-1' })
    })
})
