import type { DbExecutor } from '@universo-react/utils'
import {
    deleteEditorDocumentBackupSet,
    insertEditorDocumentBackupSet,
    latestEditorDocumentBackupSetExists,
    listLatestEditorDocumentBackupRows,
    type EditorDocumentBackupRow
} from '../../domains/playcanvas-projects/services/editorDocumentBackupsStore'

const BACKUP_TABLE = '"metahubs"."playcanvas_editor_document_backups"'

interface TransactionalExecutorHarness {
    exec: DbExecutor
    statements: string[]
    txQuery: jest.Mock
}

/**
 * Mock executor mirroring the pinned-connection (RLS) transaction contract:
 * explicit BEGIN/COMMIT/ROLLBACK control statements wrap the work, so failure
 * injection can assert that no partial batch is committed.
 */
const createTransactionalExecutor = (handlers: {
    onInsert?: () => Promise<Array<{ id: string }>> | Array<{ id: string }>
}): TransactionalExecutorHarness => {
    const statements: string[] = []
    const txQuery = jest.fn(async (sql: string): Promise<unknown[]> => {
        if (sql.includes(`INSERT INTO ${BACKUP_TABLE}`)) {
            const inserted = handlers.onInsert ? await handlers.onInsert() : null
            if (inserted) return inserted
            throw new Error('Unexpected INSERT outcome')
        }
        if (sql.includes(`DELETE FROM ${BACKUP_TABLE} AS target`)) {
            return []
        }
        throw new Error(`Unexpected SQL: ${sql}`)
    })

    const exec = {
        query: jest.fn(async (): Promise<unknown[]> => []),
        transaction: async <T>(work: (executor: DbExecutor) => Promise<T>): Promise<T> => {
            statements.push('BEGIN')
            try {
                const result = await work({ query: txQuery } as unknown as DbExecutor)
                statements.push('COMMIT')
                return result
            } catch (error) {
                statements.push('ROLLBACK')
                throw error
            }
        }
    } as unknown as DbExecutor

    return { exec, statements, txQuery }
}

const backupRow = (overrides: Partial<EditorDocumentBackupRow> = {}): EditorDocumentBackupRow => ({
    collection: 'settings',
    documentId: 'project_123',
    data: { kind: 'project' },
    version: 2,
    ...overrides
})

describe('editorDocumentBackupsStore', () => {
    describe('insertEditorDocumentBackupSet', () => {
        it('commits the whole set as one transactional multi-row batch and prunes inside the same transaction', async () => {
            const rows = [
                backupRow({ collection: 'scenes', documentId: '42', data: { entities: {} }, version: 7 }),
                backupRow({ documentId: 'user_9', data: { priority_scripts: [] }, version: 1 })
            ]
            const harness = createTransactionalExecutor({
                onInsert: () => [{ id: 'id-1' }, { id: 'id-2' }]
            })

            const count = await insertEditorDocumentBackupSet(harness.exec, {
                metahubId: '019e8afa-0000-7000-8000-000000000010',
                projectId: '019e8afa-0000-7000-8000-000000000011',
                openedAt: new Date('2026-08-22T10:00:00.000Z'),
                rows
            })

            expect(count).toBe(2)
            expect(harness.statements[0]).toBe('BEGIN')
            expect(harness.statements[harness.statements.length - 1]).toBe('COMMIT')

            expect(harness.txQuery).toHaveBeenCalledTimes(2)
            const [insertSql, insertParams] = jest.mocked(harness.txQuery).mock.calls[0]
            expect(insertSql).toContain(`INSERT INTO ${BACKUP_TABLE}`)
            expect(insertSql).toContain('unnest(')
            expect(insertSql).toContain('RETURNING id')

            expect(insertParams?.[1]).toBe('019e8afa-0000-7000-8000-000000000010')
            expect(insertParams?.[2]).toBe('019e8afa-0000-7000-8000-000000000011')
            expect(insertParams?.[3]).toBe('2026-08-22T10:00:00.000Z')
            expect(insertParams?.[4]).toEqual(['scenes', 'settings'])
            expect(insertParams?.[5]).toEqual(['42', 'user_9'])
            expect(insertParams?.[6]).toEqual([JSON.stringify({ entities: {} }), JSON.stringify({ priority_scripts: [] })])
            expect(insertParams?.[7]).toEqual([7, 1])
            expect((insertParams?.[0] as string[]).every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true)

            const [pruneSql, pruneParams] = jest.mocked(harness.txQuery).mock.calls[1]
            expect(pruneSql).toContain(`DELETE FROM ${BACKUP_TABLE} AS target`)
            expect(pruneSql).toContain('NOT IN')
            expect(pruneSql).toContain('LIMIT $3')
            expect(pruneParams).toEqual(['019e8afa-0000-7000-8000-000000000010', '019e8afa-0000-7000-8000-000000000011', 5])
        })

        it('skips the database entirely for an empty backup set', async () => {
            const harness = createTransactionalExecutor()

            const count = await insertEditorDocumentBackupSet(harness.exec, {
                metahubId: '019e8afa-0000-7000-8000-000000000010',
                projectId: '019e8afa-0000-7000-8000-000000000011',
                openedAt: new Date(),
                rows: []
            })

            expect(count).toBe(0)
            expect(harness.txQuery).not.toHaveBeenCalled()
            expect(harness.statements).toEqual([])
        })
    })

    describe('failure injection', () => {
        it('rolls back the whole batch when the INSERT fails so no partial rows are committed', async () => {
            const harness = createTransactionalExecutor({
                onInsert: () => [{ id: 'id-1' }]
            })

            await expect(
                insertEditorDocumentBackupSet(harness.exec, {
                    metahubId: '019e8afa-0000-7000-8000-000000000010',
                    projectId: '019e8afa-0000-7000-8000-000000000011',
                    openedAt: new Date(),
                    rows: [backupRow(), backupRow()]
                })
            ).rejects.toThrow('backup set insert was incomplete')

            expect(harness.statements).toEqual(['BEGIN', 'ROLLBACK'])
            expect(harness.txQuery).toHaveBeenCalledTimes(1)
        })
    })

    describe('latestEditorDocumentBackupSetExists', () => {
        it('checks the exact session marker with schema-qualified parameterized SQL', async () => {
            const query = jest.fn(async () => [{ exists: true }])
            const exec = { query } as unknown as DbExecutor

            const exists = await latestEditorDocumentBackupSetExists(exec, {
                metahubId: 'metahub-1',
                projectId: 'project-1',
                openedAtMarker: new Date('2026-08-22T10:00:00.000Z')
            })

            expect(exists).toBe(true)
            const [sql, params] = jest.mocked(query).mock.calls[0]
            expect(sql).toContain('SELECT EXISTS(')
            expect(sql).toContain(BACKUP_TABLE)
            expect(params).toEqual(['metahub-1', 'project-1', '2026-08-22T10:00:00.000Z'])
        })

        it('returns false when no row exists', async () => {
            const query = jest.fn(async () => [] as unknown[])
            const exists = await latestEditorDocumentBackupSetExists({ query } as unknown as DbExecutor, {
                metahubId: 'metahub-1',
                projectId: 'project-1',
                openedAtMarker: new Date()
            })
            expect(exists).toBe(false)
        })
    })

    describe('listLatestEditorDocumentBackupRows', () => {
        it('loads the newest set in stored insertion order', async () => {
            const openedAt = new Date('2026-08-22T10:00:00.000Z')
            const query = jest.fn(async () => [
                {
                    collection: 'scenes',
                    documentId: '42',
                    data: { entities: {} },
                    version: 7,
                    openedAt
                },
                {
                    collection: 'assets',
                    documentId: '99',
                    data: { name: 'script' },
                    version: 3,
                    openedAt
                }
            ])

            const rows = await listLatestEditorDocumentBackupRows({ query } as unknown as DbExecutor, {
                metahubId: 'metahub-1',
                projectId: 'project-1'
            })

            expect(rows.map((row) => row.documentId)).toEqual(['42', '99'])
            const [sql, params] = jest.mocked(query).mock.calls[0]
            expect(sql).toContain('MAX(latest.opened_at)')
            expect(sql).toContain('ORDER BY backup.id')
            expect(params).toEqual(['metahub-1', 'project-1'])
        })
    })

    describe('deleteEditorDocumentBackupSet', () => {
        it('fails closed when the targeted set does not exist', async () => {
            const statements: string[] = []
            const exec = {
                query: jest.fn(async (): Promise<unknown[]> => []),
                transaction: async <T>(work: (executor: DbExecutor) => Promise<T>): Promise<T> => {
                    statements.push('BEGIN')
                    try {
                        const result = await work({
                            query: jest.fn(async () => [])
                        } as unknown as DbExecutor)
                        statements.push('COMMIT')
                        return result
                    } catch (error) {
                        statements.push('ROLLBACK')
                        throw error
                    }
                }
            } as unknown as DbExecutor

            await expect(
                deleteEditorDocumentBackupSet(exec, {
                    metahubId: 'metahub-1',
                    projectId: 'project-1',
                    openedAt: new Date('2026-08-22T10:00:00.000Z')
                })
            ).rejects.toThrow('was not found for deletion')

            expect(statements).toEqual(['BEGIN', 'ROLLBACK'])
        })
    })
})
