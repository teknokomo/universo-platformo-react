import type { PublishedApplicationSnapshot, SnapshotModuleDefinition } from '../../services/applicationSyncContracts'

const createCodenameVlc = (primary: string, secondary?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: primary, version: 1, isActive: true },
        ...(secondary ? { ru: { content: secondary, version: 1, isActive: true } } : {})
    }
})

type StoredModuleRow = Record<string, unknown>

type MockSyncKnex = {
    rows: StoredModuleRow[]
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

import { hasPublishedModulesChanges, persistPublishedModules } from '../../routes/sync/syncModulePersistence'

const scopedIndexDefinition =
    "CREATE UNIQUE INDEX idx_app_modules_codename_active ON _app_modules (attached_to_kind, COALESCE(attached_to_id, '00000000-0000-0000-0000-000000000000'::uuid), module_role, codename) WHERE ((_upl_deleted = false) AND (_app_deleted = false))"

const createSnapshotModule = (overrides: Partial<SnapshotModuleDefinition> = {}): SnapshotModuleDefinition => ({
    id: overrides.id ?? 'module-1',
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
    attachedToKind: overrides.attachedToKind ?? 'object',
    attachedToId: overrides.attachedToId ?? 'object-1',
    moduleRole: overrides.moduleRole ?? 'widget',
    sourceKind: overrides.sourceKind ?? 'embedded',
    sdkApiVersion: overrides.sdkApiVersion ?? '1.0.0',
    manifest: overrides.manifest ?? {
        className: 'QuizWidgetModule',
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

const createStoredModuleRow = (overrides: Partial<StoredModuleRow> = {}): StoredModuleRow => ({
    id: overrides.id ?? 'module-1',
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
    attached_to_kind: overrides.attached_to_kind ?? 'object',
    attached_to_id: overrides.attached_to_id ?? 'object-1',
    module_role: overrides.module_role ?? 'widget',
    source_kind: overrides.source_kind ?? 'embedded',
    sdk_api_version: overrides.sdk_api_version ?? '1.0.0',
    manifest: overrides.manifest ?? {
        className: 'QuizWidgetModule',
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

const createSnapshot = (modules: SnapshotModuleDefinition[]): PublishedApplicationSnapshot => ({
    entities: {},
    modules
})

const createLegacySnapshotWithoutModules = (): PublishedApplicationSnapshot =>
    ({
        entities: {}
    } as PublishedApplicationSnapshot)

const createMockSyncKnex = ({
    rows = [],
    hasTable = true,
    indexDef = scopedIndexDefinition
}: {
    rows?: StoredModuleRow[]
    hasTable?: boolean
    indexDef?: string
} = {}): MockSyncKnex => {
    const state = {
        rows: rows.map((row) => ({ ...row })),
        hasTable,
        indexDef
    }

    const matchesFilters = (row: StoredModuleRow, filters: Array<Record<string, unknown>>): boolean =>
        filters.every((filter) => Object.entries(filter).every(([key, value]) => row[key] === value))

    const pickColumns = (row: StoredModuleRow, columns: string[]): StoredModuleRow => {
        const result: StoredModuleRow = {}
        for (const column of columns) {
            result[column] = row[column]
        }
        return result
    }

    const executor = {
        get rows() {
            return state.rows
        },
        set rows(nextRows: StoredModuleRow[]) {
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

            if (sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_modules_codename_active')) {
                state.indexDef = sql
                return { rows: [] }
            }

            return { rows: [] }
        })
    } as MockSyncKnex

    return executor
}

describe('syncModulePersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        currentKnex = createMockSyncKnex()
    })

    it('upserts published runtime modules, prunes removed rows, and repairs the scoped index', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredModuleRow({
                    id: 'module-existing',
                    checksum: 'old-checksum',
                    client_bundle: 'old-client-bundle',
                    server_bundle: 'old-server-bundle',
                    _upl_version: 4
                }),
                createStoredModuleRow({
                    id: 'module-removed',
                    codename: 'removed-widget'
                })
            ],
            indexDef: 'CREATE UNIQUE INDEX idx_app_modules_codename_active ON _app_modules (attached_to_kind, module_role, codename)'
        })

        await persistPublishedModules({
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            userId: 'user-1',
            snapshot: createSnapshot([
                createSnapshotModule({
                    id: 'module-existing',
                    checksum: 'new-checksum',
                    clientBundle: 'new-client-bundle',
                    serverBundle: 'new-server-bundle'
                }),
                createSnapshotModule({
                    id: 'module-new',
                    codename: createCodenameVlc('score-widget', 'виджет-очки'),
                    attachedToId: 'object-2',
                    checksum: 'score-checksum'
                })
            ])
        })

        expect(mockEnsureSystemTables).toHaveBeenCalledWith('app_018f8a787b8f7c1da1112222333346aa', undefined)
        expect(currentKnex.transaction).toHaveBeenCalledTimes(1)
        expect(currentKnex.raw).toHaveBeenCalledWith(expect.stringContaining('SELECT indexdef'), [
            'app_018f8a787b8f7c1da1112222333346aa',
            'idx_app_modules_codename_active'
        ])
        expect(currentKnex.raw).toHaveBeenCalledWith(
            expect.stringContaining('DROP INDEX IF EXISTS "app_018f8a787b8f7c1da1112222333346aa"."idx_app_modules_codename_active"')
        )
        expect(currentKnex.raw).toHaveBeenCalledWith(
            expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_modules_codename_active"')
        )

        expect(currentKnex.rows).toHaveLength(2)
        expect(currentKnex.rows.map((row) => row.id)).toEqual(expect.arrayContaining(['module-existing', 'module-new']))
        expect(currentKnex.rows.find((row) => row.id === 'module-removed')).toBeUndefined()

        expect(currentKnex.rows.find((row) => row.id === 'module-existing')).toMatchObject({
            checksum: 'new-checksum',
            client_bundle: 'new-client-bundle',
            server_bundle: 'new-server-bundle',
            _upl_updated_by: 'user-1',
            _upl_version: 5
        })
        expect(currentKnex.rows.find((row) => row.id === 'module-new')).toMatchObject({
            codename: 'score-widget',
            checksum: 'score-checksum',
            _upl_created_by: 'user-1',
            _app_published: true,
            _upl_version: 1
        })
    })

    it('keeps the scoped runtime-module index when the required definition already exists', async () => {
        currentKnex = createMockSyncKnex()

        await persistPublishedModules({
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            userId: 'user-1',
            snapshot: createSnapshot([createSnapshotModule()])
        })

        expect(currentKnex.raw).toHaveBeenCalledWith(expect.stringContaining('SELECT indexdef'), [
            'app_018f8a787b8f7c1da1112222333346aa',
            'idx_app_modules_codename_active'
        ])
        expect(currentKnex.raw).not.toHaveBeenCalledWith(
            expect.stringContaining('DROP INDEX IF EXISTS "app_018f8a787b8f7c1da1112222333346aa"."idx_app_modules_codename_active"')
        )
        expect(currentKnex.raw).not.toHaveBeenCalledWith(
            expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_modules_codename_active')
        )
    })

    it('keeps shared-library snapshot sources out of runtime application modules', async () => {
        await persistPublishedModules({
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            userId: 'user-1',
            snapshot: createSnapshot([
                createSnapshotModule({
                    id: 'shared-library',
                    codename: createCodenameVlc('shared-library'),
                    attachedToKind: 'general',
                    attachedToId: null,
                    moduleRole: 'library',
                    manifest: {
                        className: 'SharedLibrary',
                        sdkApiVersion: '1.0.0',
                        moduleRole: 'library',
                        sourceKind: 'embedded',
                        capabilities: ['metadata.read'],
                        methods: []
                    },
                    serverBundle: null,
                    clientBundle: null,
                    checksum: 'shared-library-checksum'
                }),
                createSnapshotModule({
                    id: 'runtime-widget',
                    codename: createCodenameVlc('runtime-widget'),
                    checksum: 'runtime-widget-checksum'
                })
            ])
        })

        expect(currentKnex.rows).toHaveLength(1)
        expect(currentKnex.rows[0]).toMatchObject({
            id: 'runtime-widget',
            codename: 'runtime-widget',
            checksum: 'runtime-widget-checksum'
        })
    })

    it('fails closed when runtime system-table bootstrap for modules throws', async () => {
        mockEnsureSystemTables.mockRejectedValueOnce(new Error('bootstrap failed'))

        await expect(
            persistPublishedModules({
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                snapshot: createSnapshot([createSnapshotModule()])
            })
        ).rejects.toThrow('bootstrap failed')

        expect(currentKnex.transaction).not.toHaveBeenCalled()
    })

    it('treats legacy published snapshots without modules as an empty module set', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredModuleRow({
                    id: 'legacy-module',
                    codename: 'legacy-runtime-module'
                })
            ]
        })

        await expect(
            persistPublishedModules({
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                snapshot: createLegacySnapshotWithoutModules(),
                userId: 'user-1'
            })
        ).resolves.toBeUndefined()

        expect(currentKnex.transaction).toHaveBeenCalledTimes(1)
        expect(currentKnex.rows).toHaveLength(0)
    })

    it('fails closed when _app_modules is still missing after a successful bootstrap', async () => {
        currentKnex = createMockSyncKnex({ hasTable: false })

        await expect(
            persistPublishedModules({
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                snapshot: createSnapshot([createSnapshotModule()])
            })
        ).rejects.toThrow('Runtime modules table is unavailable after system table bootstrap')
    })

    it('rejects published runtime snapshots with unsupported sdkApiVersion metadata', async () => {
        await expect(
            persistPublishedModules({
                schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
                snapshot: createSnapshot([
                    createSnapshotModule({
                        sdkApiVersion: '2.0.0',
                        manifest: {
                            className: 'QuizWidgetModule',
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
        ).rejects.toThrow('Unsupported module sdkApiVersion "2.0.0". Supported versions: 1.0.0')
    })

    it('treats logically equivalent persisted and published module sets as unchanged after normalization', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredModuleRow({
                    id: 'module-2',
                    codename: 'beta-widget',
                    attached_to_kind: 'metahub',
                    attached_to_id: null,
                    checksum: 'beta-checksum'
                }),
                createStoredModuleRow({
                    id: 'module-1',
                    codename: 'alpha-widget',
                    attached_to_id: 'object-1',
                    checksum: 'alpha-checksum'
                })
            ]
        })

        const hasChanges = await hasPublishedModulesChanges({
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            snapshot: createSnapshot([
                createSnapshotModule({
                    id: 'module-1',
                    codename: 'alpha-widget',
                    attachedToId: 'object-1',
                    checksum: 'alpha-checksum'
                }),
                createSnapshotModule({
                    id: 'module-2',
                    codename: 'beta-widget',
                    attachedToKind: 'metahub',
                    attachedToId: null,
                    checksum: 'beta-checksum'
                })
            ])
        })

        expect(hasChanges).toBe(false)
    })

    it('ignores authoring source fields when comparing published modules with persisted runtime rows', async () => {
        currentKnex = createMockSyncKnex({
            rows: [createStoredModuleRow()]
        })

        const hasChanges = await hasPublishedModulesChanges({
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            snapshot: createSnapshot([
                {
                    ...createSnapshotModule(),
                    sourceCode: 'export default class AuthoringOnlySource {}',
                    sourceStorage: {
                        mode: 'file',
                        path: 'modules/general/authoring-only.ts',
                        checksum: 'authoring-only-source-checksum',
                        content: 'export default class AuthoringOnlySource {}'
                    }
                } as SnapshotModuleDefinition
            ])
        })

        expect(hasChanges).toBe(false)
    })

    it('reports a change when the published module checksum differs from the persisted runtime row', async () => {
        currentKnex = createMockSyncKnex({
            rows: [
                createStoredModuleRow({
                    id: 'module-1',
                    checksum: 'persisted-checksum'
                })
            ]
        })

        const hasChanges = await hasPublishedModulesChanges({
            schemaName: 'app_018f8a787b8f7c1da1112222333346aa',
            snapshot: createSnapshot([
                createSnapshotModule({
                    id: 'module-1',
                    checksum: 'published-checksum'
                })
            ])
        })

        expect(hasChanges).toBe(true)
    })
})
