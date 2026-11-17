const mockExec = {
    query: jest.fn(async (_sql: string, _params?: unknown[]): Promise<unknown[]> => [])
}

const mockEnsureSystemTables = jest.fn(async () => undefined)
const TEST_SCHEMA = 'app_018f8a787b8f7c1da111222233334555'

jest.mock('@universo-react/database', () => ({
    __esModule: true,
    createKnexExecutor: () => mockExec,
    qSchemaTable: jest.requireActual('@universo-react/database').qSchemaTable,
    qSchema: jest.requireActual('@universo-react/database').qSchema
}))

jest.mock('../../../ddl', () => ({
    __esModule: true,
    getApplicationSyncKnex: () => ({ transaction: jest.fn() }),
    getApplicationSyncDdlServices: () => ({
        generator: { ensureSystemTables: mockEnsureSystemTables }
    })
}))

import { syncSetConstants } from '../../../routes/sync/syncSeeding'
import { loadApplicationRuntimeConstants } from '../../../routes/sync/syncDataLoader'
import type { PublishedApplicationSnapshot, SnapshotConstantDefinition } from '../../../services/applicationSyncContracts'

/**
 * Minimal chainable knex query-builder stand-in for `_app_constants` sync:
 * records update/merge operations with their filters so the seeding contract
 * (upsert, revival columns, stale soft-delete) can be asserted at mock level,
 * mirroring the syncPackagePersistence test style.
 */
interface RecordedOperation {
    kind: 'update' | 'merge'
    patch?: Record<string, unknown>
    rows?: Array<Record<string, unknown>>
    mergeColumns?: string[]
    filters: string[]
}

const createFakeConstantsTable = () => {
    const operations: RecordedOperation[] = []

    const buildBuilder = (filters: string[] = []): unknown => {
        const filterWith = (label: string) => {
            filters.push(label)
            return buildBuilder(filters)
        }
        return {
            where: (arg: unknown) => {
                const label = typeof arg === 'function' ? 'where(fn)' : `where(${String(arg)})`
                return filterWith(label)
            },
            orWhere: () => filterWith('orWhere(fn)'),
            andWhere: () => filterWith('andWhere(fn)'),
            whereIn: (column: string, values: unknown[]) => filterWith(`whereIn(${column}:${values.length})`),
            whereNotIn: (column: string, values: unknown[]) => filterWith(`whereNotIn(${column}:${values.length})`),
            update: async (patch: Record<string, unknown>) => {
                operations.push({ kind: 'update', patch, filters })
                return undefined
            },
            insert: (rows: Array<Record<string, unknown>>) => {
                operations.push({ kind: 'merge', rows, filters })
                return {
                    onConflict: () => ({
                        merge: async (columns: string[]) => {
                            const pending = operations[operations.length - 1]
                            pending.mergeColumns = columns
                            return undefined
                        }
                    })
                }
            }
        }
    }

    return {
        operations,
        withSchema: (_schema: string) => ({
            table: (tableName: string) => {
                expect(tableName).toBe('_app_constants')
                return buildBuilder()
            }
        })
    }
}

const snapshotWithConstants = (values: SnapshotConstantDefinition[], groupId = '018f8a78-7b8f-7c1d-a111-222233334800') =>
    ({
        entities: {},
        constants: values.length > 0 ? { [groupId]: values } : {}
    } as PublishedApplicationSnapshot)

const economyConstant = (overrides: Partial<SnapshotConstantDefinition> = {}): SnapshotConstantDefinition => ({
    id: '018f8a78-7b8f-7c1d-a111-222233334801',
    codename: 'CurrencyCode',
    dataType: 'string',
    value: 'CR',
    sortOrder: 1,
    ...overrides
})

describe('syncSetConstants persistence contract', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('materializes snapshot constants with the full upsert column list (revival included)', async () => {
        const fakeTrx = createFakeConstantsTable()

        await syncSetConstants(
            TEST_SCHEMA,
            snapshotWithConstants([
                economyConstant(),
                economyConstant({ id: '018f8a78-7b8f-7c1d-a111-222233334802', codename: 'StartingOreKg', dataType: 'number', value: 10 })
            ]),
            'sync-user',
            fakeTrx as never
        )

        const mergeOp = fakeTrx.operations.find((operation) => operation.kind === 'merge')
        expect(mergeOp).toBeDefined()
        expect(mergeOp?.rows).toHaveLength(2)
        expect(mergeOp?.rows?.[0]).toMatchObject({
            id: '018f8a78-7b8f-7c1d-a111-222233334801',
            group_id: '018f8a78-7b8f-7c1d-a111-222233334800',
            data_type: 'string',
            value_json: '"CR"',
            sort_order: 1,
            _upl_created_by: 'sync-user',
            _upl_deleted: false,
            _app_deleted: false
        })
        // The merge list must revive soft-deleted rows by restoring both delete flags.
        for (const column of [
            'group_id',
            'codename',
            'data_type',
            'value_json',
            'sort_order',
            '_upl_deleted',
            '_app_deleted',
            '_upl_updated_by'
        ]) {
            expect(mergeOp?.mergeColumns).toContain(column)
        }

        // Stale rows inside desired groups get soft-deleted before the upsert.
        const staleUpdate = fakeTrx.operations.find(
            (operation) => operation.kind === 'update' && operation.filters.some((filter) => filter.startsWith('whereIn(group_id:1)'))
        )
        expect(staleUpdate?.patch).toMatchObject({ _upl_deleted: true, _app_deleted: true, _upl_deleted_by: 'sync-user' })
        expect(staleUpdate?.filters.some((filter) => filter.startsWith('whereNotIn(id:2)'))).toBe(true)

        // Rows outside desired groups are soft-deleted too.
        const outsideUpdate = fakeTrx.operations.find(
            (operation) => operation.kind === 'update' && operation.filters.some((filter) => filter.startsWith('whereNotIn(group_id:1)'))
        )
        expect(outsideUpdate?.patch).toMatchObject({ _upl_deleted: true, _app_deleted: true })
    })

    it('soft-deletes every constant when the snapshot carries no constant groups', async () => {
        const fakeTrx = createFakeConstantsTable()

        await syncSetConstants(TEST_SCHEMA, snapshotWithConstants([]), 'sync-user', fakeTrx as never)

        expect(fakeTrx.operations).toHaveLength(1)
        const update = fakeTrx.operations[0]
        expect(update.kind).toBe('update')
        expect(update.patch).toMatchObject({ _upl_deleted: true, _app_deleted: true })
        expect(update.filters).toContain('where(fn)')
        expect(mockExec.query).not.toHaveBeenCalled()
    })

    it('rejects non-uuid-v7 and duplicate constant ids before any SQL runs', async () => {
        const invalidIdTrx = createFakeConstantsTable()
        await expect(
            syncSetConstants(
                TEST_SCHEMA,
                snapshotWithConstants([economyConstant({ id: 'not-a-uuid' })]),
                'sync-user',
                invalidIdTrx as never
            )
        ).rejects.toThrow('Snapshot constant id must be a UUID v7')
        expect(invalidIdTrx.operations).toHaveLength(0)

        const duplicateId = '018f8a78-7b8f-7c1d-a111-222233334801'
        const duplicateTrx = createFakeConstantsTable()
        await expect(
            syncSetConstants(
                TEST_SCHEMA,
                snapshotWithConstants([economyConstant({ id: duplicateId }), economyConstant({ id: duplicateId, codename: 'Other' })]),
                'sync-user',
                duplicateTrx as never
            )
        ).rejects.toThrow(`Duplicate constant id in snapshot: ${duplicateId}`)
        expect(duplicateTrx.operations).toHaveLength(0)
    })

    it('reads materialized constants back through loadApplicationRuntimeConstants', async () => {
        mockExec.query.mockResolvedValueOnce([
            {
                id: '018f8a78-7b8f-7c1d-a111-222233334801',
                group_id: '018f8a78-7b8f-7c1d-a111-222233334800',
                codename: { _schema: '1', _primary: 'en', locales: { en: { content: 'CurrencyCode' } } },
                data_type: 'string',
                value_json: 'CR',
                sort_order: 1
            },
            {
                id: '018f8a78-7b8f-7c1d-a111-222233334802',
                group_id: '018f8a78-7b8f-7c1d-a111-222233334800',
                codename: 'StartingOreKg',
                data_type: 'number',
                value_json: 10,
                sort_order: 2
            }
        ])

        const constants = await loadApplicationRuntimeConstants(mockExec, TEST_SCHEMA)

        expect(mockExec.query).toHaveBeenCalledWith(expect.stringContaining(`FROM "${TEST_SCHEMA}"._app_constants`))
        expect(String((mockExec.query as jest.Mock).mock.calls[0][0])).toContain('_upl_deleted = false')
        expect(String((mockExec.query as jest.Mock).mock.calls[0][0])).toContain('_app_deleted = false')
        expect(constants).toHaveLength(2)
        expect(constants[0]).toMatchObject({
            id: '018f8a78-7b8f-7c1d-a111-222233334801',
            groupId: '018f8a78-7b8f-7c1d-a111-222233334800',
            codenameText: 'CurrencyCode',
            dataType: 'string',
            value: 'CR'
        })
        expect(constants[1]).toMatchObject({ codenameText: 'StartingOreKg', value: 10, sortOrder: 2 })
    })

    it('degrades to an empty constant list when the schema has no _app_constants table yet', async () => {
        mockExec.query.mockRejectedValueOnce(new Error('relation "app_x._app_constants" does not exist'))

        const constants = await loadApplicationRuntimeConstants(mockExec, TEST_SCHEMA)

        expect(constants).toEqual([])
    })
})
