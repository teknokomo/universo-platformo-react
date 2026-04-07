import type { ApplicationScriptDefinition } from '@universo/types'
import type { PublishedApplicationSnapshot, SnapshotScriptDefinition } from '../../services/applicationSyncContracts'

const createCodenameVlc = (primary: string, secondary?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: primary, version: 1, isActive: true },
        ...(secondary ? { ru: { content: secondary, version: 1, isActive: true } } : {})
    }
})

type StoredScriptRow = Record<string, unknown>

type MockSyncKnex = {
    rows: StoredScriptRow[]
    hasTable: boolean
    indexDef: string
    schema: {
        withSchema: jest.Mock
    }
    withSchema: jest.Mock
    transaction: jest.Mock
    raw: jest.Mock
}

const mockEnsureSystemTables = jest.fn(async () => undefined)
let currentKnex: MockSyncKnex

jest.mock('../../ddl', () => ({
    getApplicationSyncKnex: () => currentKnex,
    getApplicationSyncDdlServices: () => ({
        generator: {
            ensureSystemTables: (...args: unknown[]) => mockEnsureSystemTables(...args)
        }
    })
}))

import { hasPublishedScriptsChanges, persistPublishedScripts } from '../../routes/sync/syncScriptPersistence'

const scopedIndexDefinition =
    "CREATE UNIQUE INDEX idx_app_scripts_codename_active ON _app_scripts (attached_to_kind, COALESCE(attached_to_id, '00000000-0000-0000-0000-000000000000'::uuid), module_role, codename) WHERE ((_upl_deleted = false) AND (_app_deleted = false))"

const createSnapshotScript = (overrides: Partial<SnapshotScriptDefinition> = {}): SnapshotScriptDefinition => ({
    id: overrides.id ?? 'script-1',
    codename: overrides.codename ?? 'quiz-widget',
    presentation: overrides.presentation ?? {
        name: {
            _schema: 'v1',
            _primary: 'en',
            locales: {
                en: { content: 'Quiz widget' }
            }
        }
    },
    attachedToKind: overrides.attachedToKind ?? 'catalog',
    attachedToId: overrides.attachedToId ?? 'catalog-1',
    moduleRole: overrides.moduleRole ?? 'widget',
    sourceKind: overrides.sourceKind ?? 'embedded',
    sdkApiVersion: overrides.sdkApiVersion ?? '1.0.0',
    manifest: overrides.manifest ?? {
        className: 'QuizWidgetScript',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['rpc.client'],
        methods: [{ name: 'mount', target: 'client' }],
        checksum: 'manifest-checksum'
    },
    serverBundle: overrides.serverBundle ?? 'module.exports = class ServerWidget {}',
    clientBundle: overrides.clientBundle ?? 'module.exports = class ClientWidget {}',
    checksum: overrides.checksum ?? 'bundle-checksum',
    isActive: overrides.isActive ?? true,
    config: overrides.config ?? {}
})

const createStoredScriptRow = (overrides: Partial<StoredScriptRow> = {}): StoredScriptRow => ({
    id: overrides.id ?? 'script-1',
    codename: overrides.codename ?? 'quiz-widget',
    presentation: overrides.presentation ?? {
        name: {
            _schema: 'v1',
            _primary: 'en',
            locales: {
                en: { content: 'Quiz widget' }
            }
        }
    },
    attached_to_kind: overrides.attached_to_kind ?? 'catalog',
    attached_to_id: overrides.attached_to_id ?? 'catalog-1',
    module_role: overrides.module_role ?? 'widget',
    source_kind: overrides.source_kind ?? 'embedded',
    sdk_api_version: overrides.sdk_api_version ?? '1.0.0',
    manifest: overrides.manifest ?? {
        className: 'QuizWidgetScript',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['rpc.client'],
        methods: [{ name: 'mount', target: 'client' }],
        checksum: 'manifest-checksum'
    },
    server_bundle: overrides.server_bundle ?? 'module.exports = class ServerWidget {}',
    client_bundle: overrides.client_bundle ?? 'module.exports = class ClientWidget {}',
    checksum: overrides.checksum ?? 'bundle-checksum',
    is_active: overrides.is_active ?? true,
    config: overrides.config ?? {},
    _upl_deleted: overrides._upl_deleted ?? false,
    _app_deleted: overrides._app_deleted ?? false,
    _upl_version: overrides._upl_version ?? 1
})

const createSnapshot = (scripts: SnapshotScriptDefinition[]): PublishedApplicationSnapshot => ({
    entities: {},
    scripts
})

const createLegacySnapshotWithoutScripts = (): PublishedApplicationSnapshot =>
    ({
        entities: {}
    }) as PublishedApplicationSnapshot

const createMockSyncKnex = ({
    rows = [],
    hasTable = true,
    indexDef = scopedIndexDefinition
}: {
    rows?: StoredScriptRow[]
    hasTable?: boolean
    indexDef?: string
} = {}): MockSyncKnex => {
    const state = {
        rows: rows.map((row) => ({ ...row })),
        hasTable,
        indexDef
    }

    const matchesFilters = (row: StoredScriptRow, filters: Array<Record<string, unknown>>): boolean =>
        filters.every((filter) => Object.entries(filter).every(([key, value]) => row[key] === value))

    const pickColumns = (row: StoredScriptRow, columns: string[]): StoredScriptRow => {
        const result: StoredScriptRow = {}
        for (const column of columns) {
            result[column] = row[column]
        }
        return result
    }

    const executor = {
        get rows() {
            return state.rows
        },
        set rows(nextRows: StoredScriptRow[]) {
            state.rows = nextRows
        },
        get hasTable() {
            return state.hasTable
        },
        get indexDef() {
            return state.indexDef
        },
        set indexDef(nextIndexDef: string) {
            state.indexDef = nextIndexDef
        },
        schema: {
            withSchema: jest.fn((_schemaName: string) => ({
                hasTable: jest.fn(async (_tableName: string) => state.hasTable)
            }))
        },
        withSchema: jest.fn((_schemaName: string) => ({
            from: (_tableName: string) => {
                const filters: Array<Record<string, unknown>> = []
                let excludedIds: unknown[] | null = null

                const getMatchedRows = () =>
                    state.rows.filter((row) => {
                        if (!matchesFilters(row, filters)) {
                            return false
                        }
                        if (excludedIds && excludedIds.includes(row.id)) {
                            return false
                        }
                        return true
                    })

                return {
                    where(filter: Record<string, unknown>) {
                        filters.push(filter)
                        return this
                    },
                    whereNotIn(_column: string, ids: unknown[]) {
                        excludedIds = ids
                        return this
                    },
                    async select(columns: string[]) {
                        return getMatchedRows().map((row) => pickColumns(row, columns))
                    },
                    async update(payload: Record<string, unknown>) {
                        const matchedRows = getMatchedRows()
                        for (const row of matchedRows) {
                            for (const [key, value] of Object.entries(payload)) {
                                if (value && typeof value === 'object' && '__rawIncrement' in value) {
                                    row[key] = Number(row[key] ?? 0) + 1
                                } else {
                                    row[key] = value
                                }
                            }
                        }
                        return matchedRows.length
                    },
                    async del() {
                        const matchedRows = new Set(getMatchedRows())
                        state.rows = state.rows.filter((row) => !matchedRows.has(row))
                        return matchedRows.size
                    }
                }
            },
            into: (_tableName: string) => ({
                insert: async (payload: Record<string, unknown>) => {
                    state.rows.push({ ...payload })
                    return [payload]
                }
            })
        })),
        transaction: jest.fn(async (callback: (trx: MockSyncKnex) => Promise<unknown>) => callback(executor as MockSyncKnex)),
        raw: jest.fn((sql: string) => {
            if (sql === '_upl_version + 1') {
                return { __rawIncrement: true }
            }

            if (sql.includes('SELECT indexdef')) {
                return { rows: state.indexDef ? [{ indexdef: state.indexDef }] : [] }
            }

            if (sql.includes('DROP INDEX IF EXISTS')) {
                state.indexDef = ''
                return { rows: [] }
            }

            if (sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_scripts_codename_active')) {
                state.indexDef = sql
                return { rows: [] }
            }

            return { rows: [] }
        })
    } as MockSyncKnex

    return executor
}

describe('syncScriptPersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        currentKnex = createMockSyncKnex()
    })

    it('upserts published runtime scripts, prunes removed rows, and repairs the scoped index', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredScriptRow({
                    id: 'script-existing',
                    checksum: 'old-checksum',
                    client_bundle: 'old-client-bundle',
                    server_bundle: 'old-server-bundle',
                    _upl_version: 4
                }),
                createStoredScriptRow({
                    id: 'script-removed',
                    codename: 'removed-widget'
                })
            ],
            indexDef:
                'CREATE UNIQUE INDEX idx_app_scripts_codename_active ON _app_scripts (attached_to_kind, module_role, codename)'
        })

        await persistPublishedScripts({
            schemaName: 'app_runtime_test',
            userId: 'user-1',
            snapshot: createSnapshot([
                createSnapshotScript({
                    id: 'script-existing',
                    checksum: 'new-checksum',
                    clientBundle: 'new-client-bundle',
                    serverBundle: 'new-server-bundle'
                }),
                createSnapshotScript({
                    id: 'script-new',
                    codename: createCodenameVlc('score-widget', 'виджет-очки'),
                    attachedToId: 'catalog-2',
                    checksum: 'score-checksum'
                })
            ])
        })

        expect(mockEnsureSystemTables).toHaveBeenCalledWith('app_runtime_test', undefined)
        expect(currentKnex.transaction).toHaveBeenCalledTimes(1)
        expect(currentKnex.raw).toHaveBeenCalledWith(expect.stringContaining('SELECT indexdef'), [
            'app_runtime_test',
            'idx_app_scripts_codename_active'
        ])
        expect(currentKnex.raw).toHaveBeenCalledWith(
            expect.stringContaining('DROP INDEX IF EXISTS "app_runtime_test"."idx_app_scripts_codename_active"')
        )
        expect(currentKnex.raw).toHaveBeenCalledWith(
            expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_scripts_codename_active')
        )

        expect(currentKnex.rows).toHaveLength(2)
        expect(currentKnex.rows.map((row) => row.id)).toEqual(expect.arrayContaining(['script-existing', 'script-new']))
        expect(currentKnex.rows.find((row) => row.id === 'script-removed')).toBeUndefined()

        expect(currentKnex.rows.find((row) => row.id === 'script-existing')).toMatchObject({
            checksum: 'new-checksum',
            client_bundle: 'new-client-bundle',
            server_bundle: 'new-server-bundle',
            _upl_updated_by: 'user-1',
            _upl_version: 5
        })
        expect(currentKnex.rows.find((row) => row.id === 'script-new')).toMatchObject({
            codename: 'score-widget',
            checksum: 'score-checksum',
            _upl_created_by: 'user-1',
            _app_published: true,
            _upl_version: 1
        })
    })

    it('keeps the scoped runtime-script index when the required definition already exists', async () => {
        currentKnex = createMockSyncKnex()

        await persistPublishedScripts({
            schemaName: 'app_runtime_test',
            userId: 'user-1',
            snapshot: createSnapshot([createSnapshotScript()])
        })

        expect(currentKnex.raw).toHaveBeenCalledWith(expect.stringContaining('SELECT indexdef'), [
            'app_runtime_test',
            'idx_app_scripts_codename_active'
        ])
        expect(currentKnex.raw).not.toHaveBeenCalledWith(
            expect.stringContaining('DROP INDEX IF EXISTS "app_runtime_test"."idx_app_scripts_codename_active"')
        )
        expect(currentKnex.raw).not.toHaveBeenCalledWith(
            expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_scripts_codename_active')
        )
    })

    it('fails closed when runtime system-table bootstrap for scripts throws', async () => {
        mockEnsureSystemTables.mockRejectedValueOnce(new Error('bootstrap failed'))

        await expect(
            persistPublishedScripts({
                schemaName: 'app_runtime_test',
                snapshot: createSnapshot([createSnapshotScript()])
            })
        ).rejects.toThrow('bootstrap failed')

        expect(currentKnex.transaction).not.toHaveBeenCalled()
    })

    it('treats legacy published snapshots without scripts as an empty script set', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredScriptRow({
                    id: 'legacy-script',
                    codename: 'legacy-runtime-script'
                })
            ]
        })

        await expect(
            persistPublishedScripts({
                schemaName: 'app_runtime_test',
                snapshot: createLegacySnapshotWithoutScripts(),
                userId: 'user-1'
            })
        ).resolves.toBeUndefined()

        expect(currentKnex.transaction).toHaveBeenCalledTimes(1)
        expect(currentKnex.rows).toHaveLength(0)
    })

    it('fails closed when _app_scripts is still missing after a successful bootstrap', async () => {
        currentKnex = createMockSyncKnex({ hasTable: false })

        await expect(
            persistPublishedScripts({
                schemaName: 'app_runtime_test',
                snapshot: createSnapshot([createSnapshotScript()])
            })
        ).rejects.toThrow('Runtime scripts table is unavailable after system table bootstrap')
    })

    it('rejects published runtime snapshots with unsupported sdkApiVersion metadata', async () => {
        await expect(
            persistPublishedScripts({
                schemaName: 'app_runtime_test',
                snapshot: createSnapshot([
                    createSnapshotScript({
                        sdkApiVersion: '2.0.0',
                        manifest: {
                            className: 'QuizWidgetScript',
                            sdkApiVersion: '2.0.0',
                            moduleRole: 'widget',
                            sourceKind: 'embedded',
                            capabilities: ['rpc.client'],
                            methods: [{ name: 'mount', target: 'client' }],
                            checksum: 'manifest-checksum'
                        }
                    })
                ])
            })
        ).rejects.toThrow('Unsupported script sdkApiVersion "2.0.0". Supported versions: 1.0.0')
    })

    it('treats logically equivalent persisted and published script sets as unchanged after normalization', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredScriptRow({
                    id: 'script-2',
                    codename: 'beta-widget',
                    attached_to_kind: 'metahub',
                    attached_to_id: null,
                    checksum: 'beta-checksum'
                }),
                createStoredScriptRow({
                    id: 'script-1',
                    codename: 'alpha-widget',
                    attached_to_id: 'catalog-1',
                    checksum: 'alpha-checksum'
                })
            ]
        })

        const hasChanges = await hasPublishedScriptsChanges({
            schemaName: 'app_runtime_test',
            snapshot: createSnapshot([
                createSnapshotScript({
                    id: 'script-1',
                    codename: 'alpha-widget',
                    attachedToId: 'catalog-1',
                    checksum: 'alpha-checksum'
                }),
                createSnapshotScript({
                    id: 'script-2',
                    codename: 'beta-widget',
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    checksum: 'beta-checksum'
                })
            ])
        })

        expect(hasChanges).toBe(false)
    })

    it('reports a change when the published script checksum differs from the persisted runtime row', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredScriptRow({
                    id: 'script-1',
                    checksum: 'persisted-checksum'
                })
            ]
        })

        const hasChanges = await hasPublishedScriptsChanges({
            schemaName: 'app_runtime_test',
            snapshot: createSnapshot([
                createSnapshotScript({
                    id: 'script-1',
                    checksum: 'published-checksum'
                })
            ])
        })

        expect(hasChanges).toBe(true)
    })
})
