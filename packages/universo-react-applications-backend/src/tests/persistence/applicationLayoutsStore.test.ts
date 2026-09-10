import {
    createApplicationLayout,
    copyApplicationLayout,
    deleteApplicationLayoutWidget,
    deleteApplicationLayout,
    listApplicationLayouts,
    listApplicationLayoutWidgetObject,
    moveApplicationLayoutWidget,
    resetApplicationLayoutConfig,
    resetApplicationLayoutWidgetConfigsBatch,
    toggleApplicationLayoutWidget,
    updateApplicationLayout,
    updateApplicationLayoutWidgetConfig,
    updateApplicationLayoutWidgetConfigsBatch,
    upsertApplicationLayoutWidget
} from '../../persistence/applicationLayoutsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationLayoutsStore', () => {
    const scopedBatchLayoutIdA = '018f8a78-7b8f-7c1d-a111-2222333345a1'
    const scopedBatchLayoutIdB = '018f8a78-7b8f-7c1d-a111-2222333345a2'

    const primeLockedLayout = (
        txExecutor: ReturnType<typeof createMockDbExecutor>['txExecutor'],
        options: {
            layoutId: string
            scopeEntityId?: string | null
            templateKey: 'dashboard' | 'marketing-page'
            version?: number
            config?: Record<string, unknown>
            widgets?: Array<Record<string, unknown>>
            includeStructureLock?: boolean
        }
    ) => {
        const layoutId = options.layoutId
        const scopeEntityId = options.scopeEntityId ?? null
        const layoutRow = {
            id: layoutId,
            scope_entity_id: scopeEntityId,
            template_key: options.templateKey,
            name: { en: 'Test layout' },
            description: null,
            config: options.config ?? {},
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'application',
            source_layout_id: null,
            source_snapshot_hash: null,
            source_content_hash: null,
            local_content_hash: 'hash-local',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: options.version ?? 1
        }

        if (options.includeStructureLock !== false) txExecutor.query.mockResolvedValueOnce([])
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: scopeEntityId }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([layoutRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(options.widgets ?? [])

        return layoutRow
    }

    it('returns complete localized metadata for application layout widgets', () => {
        const items = listApplicationLayoutWidgetObject()
        const marketingItems = items.filter((item) => item.templateKey === 'marketing-page')

        expect(marketingItems).toHaveLength(5)
        expect(marketingItems.every((item) => item.labelKey && item.defaultLabel)).toBe(true)
        expect(marketingItems.map((item) => item.labelKey)).toEqual([
            'layouts.widgets.marketing.navigation',
            'layouts.widgets.marketing.hero',
            'layouts.widgets.marketing.collection',
            'layouts.widgets.marketing.pricing',
            'layouts.widgets.marketing.footer'
        ])
    })

    it('does not bind an unused scope parameter when listing global layouts', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: '0' }])

        await listApplicationLayouts(executor, 'app_018f8a787b8f7c1da111222233334444', {
            limit: 100,
            offset: 0,
            scopeEntityId: null
        })

        expect(executor.query).toHaveBeenCalledTimes(2)
        expect(executor.query.mock.calls[0]?.[0]).toContain('scope_entity_id IS NULL')
        expect(executor.query.mock.calls[0]?.[1]).toEqual([100, 0])
        expect(executor.query.mock.calls[1]?.[0]).toContain('scope_entity_id IS NULL')
        expect(executor.query.mock.calls[1]?.[1]).toEqual([])
    })

    it('rejects a scoped layout when the application object is not layout-capable', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])

        await expect(
            createApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    name: { en: 'Scoped layout' },
                    scopeEntityId: '0190a9b5-3cde-7abc-8def-0123456789c2',
                    templateKey: 'marketing-page'
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_SCOPE_INVALID')

        expect(txExecutor.query.mock.calls[2]?.[0]).toContain("config->'capabilities'->'layoutConfig'->>'enabled'")
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain("COALESCE(kind, '') = 'page'")
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain("NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')")
        expect(txExecutor.query).toHaveBeenCalledTimes(3)
    })

    it('rejects scope changes through the application layout update contract', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            updateApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '018f8a78-7b8f-7c1d-a111-2222333344a1',
                { scopeEntityId: 'object-1' } as never,
                'user-1'
            )
        ).rejects.toThrow()
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('normalizes a concurrent default unique violation instead of returning a stale layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const conflict = Object.assign(new Error('duplicate default'), {
            code: '23505',
            constraint: 'idx_app_layouts_default_active'
        })
        txExecutor.query
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([{ count: '0' }]) // active layouts
            .mockResolvedValueOnce([]) // demote current default
            .mockRejectedValueOnce(conflict) // insert races with another default writer

        await expect(
            createApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                { name: { en: 'Main' }, templateKey: 'dashboard', isDefault: true },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_DEFAULT_CONFLICT')
    })

    it('takes scope, layout, and widget locks before rejecting a stale layout update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: 'scope-1',
            template_key: 'dashboard',
            name: { en: 'Main' },
            description: null,
            config: {},
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'application',
            source_layout_id: null,
            source_snapshot_hash: null,
            source_content_hash: null,
            local_content_hash: 'hash-local',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 8
        }
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: 'scope-1' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([layoutRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        await expect(
            updateApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', layoutId, { expectedVersion: 7 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')

        expect(txExecutor.query).toHaveBeenCalledTimes(7)
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual(['app_018f8a787b8f7c1da111222233334444:application-layout-mutations'])
        expect(txExecutor.query.mock.calls[2]?.[1]).toEqual(['app_018f8a787b8f7c1da111222233334444:layout-scope:scope-1'])
        expect(txExecutor.query.mock.calls[3]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1'
        ])
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[5]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1:widgets'
        ])
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('FOR UPDATE')
    })

    it('resets only marketing layout appearance and records an optimistic versioned update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            template_key: 'marketing-page',
            name: { en: 'Marketing' },
            description: null,
            config: {
                themeMode: 'dark',
                primaryColor: '#1976d2'
            },
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'application',
            source_layout_id: null,
            source_snapshot_hash: null,
            source_content_hash: null,
            local_content_hash: 'before-reset',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 4
        }
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }]) // safe scope lookup
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([]) // layout advisory lock
            .mockResolvedValueOnce([layoutRow]) // locked current layout
            .mockResolvedValueOnce([]) // widgets advisory lock
            .mockResolvedValueOnce([]) // locked current widgets
            .mockResolvedValueOnce([{ ...layoutRow, config: {}, version: 5 }]) // updated layout

        const saved = await resetApplicationLayoutConfig(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            layoutId,
            { expectedVersion: 4 },
            'user-1'
        )

        expect(saved).toEqual(
            expect.objectContaining({
                templateKey: 'marketing-page',
                version: 5,
                config: expect.objectContaining({
                    themeMode: 'system',
                    allowEmailActions: true,
                    allowTelephoneActions: true,
                    externalLinkTarget: 'new-tab'
                })
            })
        )
        expect(txExecutor.query).toHaveBeenCalledTimes(8)
        expect(txExecutor.query.mock.calls[2]?.[1]).toEqual(['app_018f8a787b8f7c1da111222233334444:layout-scope:global'])
        expect(txExecutor.query.mock.calls[3]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1'
        ])
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[5]?.[1]).toEqual([
            'app_018f8a787b8f7c1da111222233334444:layout:018f8a78-7b8f-7c1d-a111-2222333344a1:widgets'
        ])
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[7]?.[0]).toContain('SET config = $2::jsonb')
        expect(txExecutor.query.mock.calls[7]?.[0]).toContain('_upl_updated_by = $5')
        expect(txExecutor.query.mock.calls[7]?.[1]?.slice(0, 2)).toEqual([layoutId, expect.any(String)])
        expect(txExecutor.query.mock.calls[7]?.[1]?.[4]).toBe('user-1')
        expect(txExecutor.query.mock.calls[7]?.[1]?.[5]).toBe(4)
    })

    it('rejects a stale marketing appearance reset before issuing an update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    scope_entity_id: null,
                    template_key: 'marketing-page',
                    name: { en: 'Marketing' },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 8
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        await expect(
            resetApplicationLayoutConfig(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '018f8a78-7b8f-7c1d-a111-2222333344a1',
                { expectedVersion: 7 },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
    })

    it('does not reset a dashboard layout through the marketing endpoint store contract', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Dashboard' },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 2
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        await expect(
            resetApplicationLayoutConfig(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '018f8a78-7b8f-7c1d-a111-2222333344a1',
                { expectedVersion: 2 },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_MARKETING_RESET_NOT_SUPPORTED')
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
    })

    it('reassigns the default layout when deleting the current default layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }]) // safe scope lookup
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([]) // layout advisory lock
            .mockResolvedValueOnce([
                {
                    id: 'layout-1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 4
                }
            ]) // locked layout row
            .mockResolvedValueOnce([]) // widgets advisory lock
            .mockResolvedValueOnce([]) // locked widgets
            .mockResolvedValueOnce([{ count: '1' }]) // other active rows
            .mockResolvedValueOnce([
                {
                    id: 'layout-1',
                    is_active: false,
                    is_default: false,
                    _upl_deleted: true,
                    _app_deleted: true
                }
            ]) // application-owned layout tombstone
            .mockResolvedValueOnce([
                {
                    id: 'widget-1',
                    layout_id: 'layout-1',
                    is_active: false,
                    _upl_deleted: true,
                    _app_deleted: true
                }
            ]) // dependent application-owned widget tombstone
            .mockResolvedValueOnce([{ id: 'layout-2' }]) // next default candidate
            .mockResolvedValueOnce([]) // assign next default

        const deleted = await deleteApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', 'layout-1', 'user-1', 4)

        expect(deleted).toBe(true)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(12)
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('SET is_active = false')
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('is_default = false')
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('RETURNING id, is_active, is_default, _upl_deleted, _app_deleted')
        expect(txExecutor.query.mock.calls[8]?.[1]).toEqual(['layout-1', 'user-1', 4])
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('UPDATE')
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('_app_widgets')
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('_app_deleted_by = CASE WHEN $3 THEN $2::uuid ELSE NULL::uuid END')
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('RETURNING id, layout_id, is_active, _upl_deleted, _app_deleted')
        expect(txExecutor.query.mock.calls[9]?.[1]).toEqual(['layout-1', 'user-1', true])
        expect(txExecutor.query.mock.calls[10]?.[0]).toContain('SELECT id')
        expect(txExecutor.query.mock.calls[11]?.[0]).toContain('CASE WHEN id = $2 THEN true ELSE false END')
        expect(txExecutor.query.mock.calls[11]?.[1]).toEqual([null, 'layout-2', 'user-1'])
    })

    it('fails closed when the application-owned delete does not return a valid tombstone', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 'layout-1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 4
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ count: '1' }])
            .mockResolvedValueOnce([
                {
                    id: 'layout-1',
                    is_active: true,
                    is_default: false,
                    _upl_deleted: true,
                    _app_deleted: true
                }
            ])

        await expect(deleteApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', 'layout-1', 'user-1', 4)).rejects.toThrow(
            'APPLICATION_LAYOUT_DELETE_INVARIANT_VIOLATION'
        )

        expect(txExecutor.query).toHaveBeenCalledTimes(9)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SELECT id\n'))).toBe(false)
    })

    it('serializes two store transactions and prevents a stale second delete from mutating the row', async () => {
        // This Jest suite has only the DbExecutor contract, not a live PostgreSQL
        // server. The two independent mock executors below model the production
        // transaction boundary: the second caller waits on the application
        // advisory lock, then re-reads the row with FOR UPDATE and cannot issue
        // a second version-guarded update after the first caller tombstones it.
        const schemaName = 'app_018f8a787b8f7c1da111222233334444'
        const layoutId = 'layout-concurrency'
        const state = {
            deleted: false,
            deleteMutations: 0,
            lockOwner: null as ReturnType<typeof createMockDbExecutor>['txExecutor'] | null,
            waiters: [] as Array<() => void>
        }
        const layoutRow = {
            id: layoutId,
            scope_entity_id: null,
            template_key: 'dashboard',
            name: { en: 'Concurrent layout' },
            description: null,
            config: {},
            is_active: true,
            is_default: false,
            sort_order: 0,
            source_kind: 'application',
            source_layout_id: null,
            source_snapshot_hash: null,
            source_content_hash: null,
            local_content_hash: 'hash-local',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 4
        }
        let releaseFirstLock: (() => void) | undefined
        const firstLockAcquired = new Promise<void>((resolve) => {
            releaseFirstLock = resolve
        })
        let releaseFirstTransaction: (() => void) | undefined
        const firstTransactionMayContinue = new Promise<void>((resolve) => {
            releaseFirstTransaction = resolve
        })

        const createConnection = () => {
            const db = createMockDbExecutor()
            db.executor.transaction.mockImplementation(async (callback: (executor: typeof db.txExecutor) => Promise<unknown>) => {
                try {
                    return await callback(db.txExecutor)
                } finally {
                    if (state.lockOwner === db.txExecutor) {
                        state.lockOwner = null
                        state.waiters.shift()?.()
                    }
                }
            })
            db.txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT scope_entity_id')) {
                    return state.deleted ? [] : [{ scope_entity_id: null }]
                }

                if (sql.includes('pg_advisory_xact_lock')) {
                    if (params?.[0] === `${schemaName}:application-layout-mutations`) {
                        if (state.lockOwner && state.lockOwner !== db.txExecutor) {
                            await new Promise<void>((resolve) => state.waiters.push(resolve))
                        }
                        state.lockOwner = db.txExecutor
                        if (!releaseFirstLock) {
                            await firstTransactionMayContinue
                        } else {
                            releaseFirstLock()
                            releaseFirstLock = undefined
                        }
                    }
                    return []
                }

                if (sql.includes('FOR UPDATE') && sql.includes('template_key')) {
                    return state.deleted ? [] : [layoutRow]
                }
                if (sql.includes('FOR UPDATE')) return []
                if (sql.includes('SELECT COUNT(*)::text AS count')) return [{ count: '1' }]

                if (sql.includes('SET is_active = false')) {
                    if (state.deleted) return []
                    state.deleted = true
                    state.deleteMutations += 1
                    return [
                        {
                            id: layoutId,
                            is_active: false,
                            is_default: false,
                            _upl_deleted: true,
                            _app_deleted: true
                        }
                    ]
                }

                return []
            })
            return db.executor
        }

        const first = deleteApplicationLayout(createConnection(), schemaName, layoutId, 'user-1', 4)
        await firstLockAcquired
        const second = deleteApplicationLayout(createConnection(), schemaName, layoutId, 'user-2', 4)
        await Promise.resolve()

        expect(state.waiters).toHaveLength(1)
        expect(state.deleteMutations).toBe(0)
        releaseFirstTransaction?.()
        await expect(first).resolves.toBe(true)
        await expect(second).resolves.toBe(false)
        expect(state.deleteMutations).toBe(1)
    })

    it('rejects nested columnsContainer widgets through the shared widget-config schema', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                'layout-1',
                {
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    expectedVersion: 1,
                    config: {
                        columns: [
                            {
                                id: 'col-1',
                                width: 6,
                                widgets: [{ widgetKey: 'columnsContainer' }]
                            }
                        ]
                    }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
    })

    it('rejects a valid dashboard widget when the parent layout is marketing-page', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, { layoutId: 'marketing-layout', templateKey: 'marketing-page' })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                'marketing-layout',
                {
                    zone: 'top',
                    widgetKey: 'header',
                    expectedVersion: 1,
                    config: {}
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expect(txExecutor.query.mock.calls.map(([sql]) => String(sql)).some((sql) => sql.includes('INSERT INTO'))).toBe(false)
    })

    it('fails closed when a marketing widget reuses an existing instance key', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: 'marketing-layout',
            templateKey: 'marketing-page',
            widgets: [
                {
                    id: 'hero-existing',
                    layout_id: 'marketing-layout',
                    zone: 'marketing-main',
                    widget_key: 'marketing.hero',
                    sort_order: 0,
                    config: {
                        instanceKey: 'hero',
                        source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' },
                        showLeadForm: true
                    },
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 2
                }
            ]
        })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                'marketing-layout',
                {
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    expectedVersion: 1,
                    config: {
                        instanceKey: 'hero',
                        source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' },
                        showLeadForm: false
                    }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('creates a new application widget instance when the widget key already exists', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const existingWidget = {
            id: 'hero-existing',
            layout_id: 'marketing-layout',
            zone: 'marketing-main',
            widget_key: 'marketing.hero',
            sort_order: 0,
            config: {
                instanceKey: 'hero',
                source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' },
                showLeadForm: true
            },
            source_config: null,
            source_widget_id: null,
            source_base_widget_id: null,
            is_customized: false,
            is_active: true,
            version: 2
        }
        const layoutRow = primeLockedLayout(txExecutor, {
            layoutId: 'marketing-layout',
            templateKey: 'marketing-page',
            widgets: [existingWidget]
        })
        const insertedWidget = {
            ...existingWidget,
            id: 'hero-second',
            sort_order: 1,
            config: {
                ...existingWidget.config,
                instanceKey: 'hero-second',
                showLeadForm: false
            },
            version: 1
        }
        txExecutor.query
            .mockResolvedValueOnce([insertedWidget])
            .mockResolvedValueOnce([layoutRow])
            .mockResolvedValueOnce([existingWidget, insertedWidget])
            .mockResolvedValueOnce([{ id: 'marketing-layout' }])

        const result = await upsertApplicationLayoutWidget(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            'marketing-layout',
            {
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                expectedVersion: 1,
                config: {
                    source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' },
                    showLeadForm: false
                }
            },
            'user-1'
        )

        expect(result.id).toBe('hero-second')
        expect(result.widgetKey).toBe('marketing.hero')
        expect(result.instanceKey).toBe('hero-second')
        const insertCalls = txExecutor.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO'))
        expect(insertCalls).toHaveLength(1)
        expect(insertCalls[0]?.[1]?.[3]).toBeNull()
        const insertedConfig = JSON.parse(String(insertCalls[0]?.[1]?.[4])) as { instanceKey?: string }
        expect(insertedConfig.instanceKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        expect(insertedConfig.instanceKey).not.toBe('hero')
    })

    it('rejects a second Dashboard appNavbar instance under the locked layout mutation', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: 'dashboard-layout',
            templateKey: 'dashboard',
            widgets: [
                {
                    id: 'navbar-existing',
                    layout_id: 'dashboard-layout',
                    zone: 'top',
                    widget_key: 'appNavbar',
                    sort_order: 1,
                    config: {},
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                'dashboard-layout',
                { zone: 'top', widgetKey: 'appNavbar', expectedVersion: 1, config: {} },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SINGLETON_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('fails closed on an already-persisted duplicate Dashboard singleton before copying', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: 'dashboard-layout',
            templateKey: 'dashboard',
            includeStructureLock: false,
            widgets: [
                {
                    id: 'navbar-one',
                    layout_id: 'dashboard-layout',
                    zone: 'top',
                    widget_key: 'appNavbar',
                    sort_order: 1,
                    config: {},
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                },
                {
                    id: 'navbar-two',
                    layout_id: 'dashboard-layout',
                    zone: 'top',
                    widget_key: 'appNavbar',
                    sort_order: 2,
                    config: {},
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })

        await expect(
            copyApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', 'dashboard-layout', { expectedVersion: 1 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SINGLETON_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('rejects unknown widget mutation fields before opening a transaction', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                'dashboard-layout',
                { zone: 'top', widgetKey: 'header', expectedVersion: 1, config: {}, unknownField: true } as never,
                'user-1'
            )
        ).rejects.toThrow()
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('rejects a duplicate marketing instance key before insertion', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: 'marketing-layout',
            templateKey: 'marketing-page',
            widgets: [
                {
                    id: 'collection-existing',
                    layout_id: 'marketing-layout',
                    zone: 'marketing-main',
                    widget_key: 'marketing.collection',
                    sort_order: 0,
                    config: {
                        instanceKey: 'features',
                        variant: 'features',
                        source: { entityCodename: 'MarketingPageFeature', entityKind: 'object' }
                    },
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                'marketing-layout',
                {
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    expectedVersion: 1,
                    config: {
                        instanceKey: 'features',
                        variant: 'features',
                        source: { entityCodename: 'MarketingPageFeature', entityKind: 'object' }
                    }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('copies a marketing layout with validated placement and a fresh UUID v7 instance key', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutRow = {
            id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
            scope_entity_id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
            template_key: 'marketing-page',
            name: { en: 'Marketing' },
            description: null,
            config: {
                themeMode: 'light',
                compositionMode: 'overlay',
                baseLayoutId: '018f8a78-7b8f-7c1d-a111-2222333344a3'
            },
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'metahub',
            source_layout_id: '018f8a78-7b8f-7c1d-a111-2222333344a3',
            source_snapshot_hash: 'a'.repeat(64),
            source_content_hash: null,
            local_content_hash: 'hash-local',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 1
        }
        const widgetRow = {
            id: '018f8a78-7b8f-7c1d-a111-2222333344a4',
            layout_id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
            zone: 'marketing-main',
            widget_key: 'marketing.hero',
            sort_order: 0,
            config: {
                instanceKey: 'hero',
                source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
            },
            source_config: null,
            source_widget_id: null,
            source_base_widget_id: '018f8a78-7b8f-7c1d-a111-2222333344a5',
            is_customized: false,
            is_active: true,
            version: 1
        }
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: layoutRow.scope_entity_id }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([layoutRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([widgetRow])
            .mockResolvedValueOnce([{ ...layoutRow, id: 'copied-marketing-layout', is_default: false, version: 1 }])
            .mockResolvedValueOnce([])

        const copied = await copyApplicationLayout(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            '018f8a78-7b8f-7c1d-a111-2222333344a1',
            { expectedVersion: 1 },
            'user-1'
        )

        expect(copied).toEqual(
            expect.objectContaining({
                id: 'copied-marketing-layout',
                isDefault: false,
                compositionMode: 'independent',
                baseLayoutId: null
            })
        )
        const copiedConfigUpdate = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes('SET config = $2::jsonb') && String(sql).includes('_app_layouts')
        )
        expect(JSON.parse(String(copiedConfigUpdate?.[1]?.[1]))).toMatchObject({
            compositionMode: 'independent',
            baseLayoutId: null
        })
        const insertWidgetCall = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_app_widgets')
        )
        const insertedConfig = JSON.parse(String(insertWidgetCall?.[1]?.[4])) as { instanceKey?: string; showLeadForm?: boolean }
        expect(insertedConfig).toMatchObject({ showLeadForm: true })
        expect(insertedConfig.instanceKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('preserves an explicit overlay after deleting its last inherited widget', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344b1'
        const baseLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344b2'
        const inheritedWidgetId = '018f8a78-7b8f-7c1d-a111-2222333344b3'
        const layoutRow = primeLockedLayout(txExecutor, {
            layoutId,
            scopeEntityId: '018f8a78-7b8f-7c1d-a111-2222333344b4',
            templateKey: 'dashboard',
            config: { compositionMode: 'overlay', baseLayoutId },
            widgets: [
                {
                    id: inheritedWidgetId,
                    layout_id: layoutId,
                    zone: 'top',
                    widget_key: 'languageSwitcher',
                    sort_order: 1,
                    config: {},
                    source_config: {},
                    source_widget_id: baseLayoutId,
                    source_base_widget_id: baseLayoutId,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })
        const updatedLayoutRow = { ...layoutRow, version: 2 }
        txExecutor.query
            .mockResolvedValueOnce([{ id: inheritedWidgetId, layout_id: layoutId }])
            .mockResolvedValueOnce([updatedLayoutRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: layoutId }])

        await expect(
            deleteApplicationLayoutWidget(executor, 'app_018f8a787b8f7c1da111222233334444', layoutId, inheritedWidgetId, 'user-1', 1)
        ).resolves.toBe(true)

        const refreshedConfigCall = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes('SET config = $2::jsonb') && String(sql).includes('_app_layouts')
        )
        expect(JSON.parse(String(refreshedConfigCall?.[1]?.[1]))).toMatchObject({
            compositionMode: 'overlay',
            baseLayoutId
        })
    })

    it('does not copy a marketing layout containing an invalid widget placement', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 'marketing-layout',
                    scope_entity_id: null,
                    template_key: 'marketing-page',
                    name: { en: 'Marketing' },
                    description: null,
                    config: { themeMode: 'light' },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 1
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 'marketing-invalid-row',
                    layout_id: 'marketing-layout',
                    zone: 'center',
                    widget_key: 'marketing.hero',
                    sort_order: 0,
                    config: {
                        instanceKey: 'hero',
                        source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
                    },
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ])

        await expect(
            copyApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', 'marketing-layout', { expectedVersion: 1 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('rejects a stale marketing layout copy before creating any rows', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }]) // safe scope lookup
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([]) // layout advisory lock
            .mockResolvedValueOnce([
                {
                    id: 'marketing-layout',
                    scope_entity_id: null,
                    template_key: 'marketing-page',
                    name: { en: 'Marketing' },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 9
                }
            ])
            .mockResolvedValueOnce([]) // widgets advisory lock
            .mockResolvedValueOnce([]) // locked widgets

        await expect(
            copyApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', 'marketing-layout', { expectedVersion: 8 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('binds direct widget mutations to the route layout and fails closed for an id mismatch', async () => {
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const routeLayoutId = '018f8a78-7b8f-7c1d-a111-2222333345a1'

        const updateDb = createMockDbExecutor()
        primeLockedLayout(updateDb.txExecutor, { layoutId: routeLayoutId, templateKey: 'dashboard' })
        const updateResult = await updateApplicationLayoutWidgetConfig(
            updateDb.executor,
            'app_018f8a787b8f7c1da111222233334444',
            routeLayoutId,
            widgetId,
            { expectedVersion: 2, config: {} },
            'user-1'
        )
        expect(updateResult).toBeNull()
        expect(updateDb.txExecutor.query.mock.calls).toHaveLength(8)

        const toggleDb = createMockDbExecutor()
        primeLockedLayout(toggleDb.txExecutor, { layoutId: routeLayoutId, templateKey: 'dashboard' })
        const toggleResult = await toggleApplicationLayoutWidget(
            toggleDb.executor,
            'app_018f8a787b8f7c1da111222233334444',
            routeLayoutId,
            widgetId,
            { expectedVersion: 2, isActive: false },
            'user-1'
        )
        expect(toggleResult).toBeNull()
        expect(toggleDb.txExecutor.query.mock.calls).toHaveLength(8)

        const deleteDb = createMockDbExecutor()
        primeLockedLayout(deleteDb.txExecutor, { layoutId: routeLayoutId, templateKey: 'dashboard' })
        await expect(
            deleteApplicationLayoutWidget(deleteDb.executor, 'app_018f8a787b8f7c1da111222233334444', routeLayoutId, widgetId, 'user-1', 2)
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')
        const deleteMutation = deleteDb.txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('id = $1 AND layout_id = $3'))
        expect(deleteMutation).toBeUndefined()
    })

    it('reorders widgets with a single batch update query', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        primeLockedLayout(txExecutor, {
            layoutId: 'layout-1',
            templateKey: 'dashboard',
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 1,
                    config: { items: [] },
                    is_active: true,
                    version: 3
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c4',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 2,
                    config: { items: [] },
                    is_active: true,
                    version: 2
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c5',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'productTree',
                    sort_order: 1,
                    config: { items: [] },
                    is_active: true,
                    version: 4
                }
            ]
        })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c4',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 1,
                    config: { items: [] },
                    is_active: true,
                    version: 3
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'spacer',
                    sort_order: 2,
                    config: {},
                    is_active: true,
                    version: 4
                }
            ]) // batch widget update
            .mockResolvedValueOnce([
                {
                    id: 'layout-1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 5
                }
            ]) // detail layout row for refresh hash
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c4',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    version: 3
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c5',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'productTree',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    version: 4
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'spacer',
                    sort_order: 2,
                    config: {},
                    is_active: true,
                    version: 4
                }
            ]) // detail widgets for refresh hash
            .mockResolvedValueOnce([{ id: 'layout-1' }]) // refresh hash update

        const moved = await moveApplicationLayoutWidget(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            'layout-1',
            {
                widgetId: '0190a9b5-3cde-7abc-8def-0123456789c3',
                targetZone: 'right',
                targetIndex: 1,
                expectedVersion: 3
            },
            'user-1'
        )

        expect(moved).toEqual(
            expect.objectContaining({
                id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                zone: 'right',
                sortOrder: 2,
                version: 4
            })
        )
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(12)
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('WITH updates AS')
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('unnest($3::uuid[], $4::text[], $5::int[])')
        expect(txExecutor.query.mock.calls[8]?.[1]).toEqual([
            'layout-1',
            'user-1',
            ['0190a9b5-3cde-7abc-8def-0123456789c4', '0190a9b5-3cde-7abc-8def-0123456789c3'],
            ['left', 'right'],
            [1, 2]
        ])
    })

    it('rejects stale batch widget configs before applying any update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdB, templateKey: 'dashboard', includeStructureLock: false })
        txExecutor.query.mockResolvedValueOnce([
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                layout_id: scopedBatchLayoutIdA,
                zone: 'main',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 0,
                config: {},
                is_active: true,
                version: 7
            },
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                layout_id: scopedBatchLayoutIdB,
                zone: 'main',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 0,
                config: {},
                is_active: true,
                version: 5
            }
        ])

        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    updates: [
                        {
                            layoutId: scopedBatchLayoutIdA,
                            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                            expectedVersion: 7,
                            config: { matrixMode: 'hierarchicalCells' }
                        },
                        {
                            layoutId: scopedBatchLayoutIdB,
                            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                            expectedVersion: 6,
                            config: { matrixMode: 'hierarchicalCells' }
                        }
                    ]
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[0]?.[1]).toEqual(['app_018f8a787b8f7c1da111222233334444:interpretation-network:structure-mode'])
        expect(txExecutor.query).toHaveBeenCalledTimes(16)
        expect(txExecutor.query.mock.calls[15]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[15]?.[0]).toContain('UNNEST($1::uuid[], $2::uuid[])')
        expect(txExecutor.query.mock.calls[15]?.[1]).toEqual([
            [scopedBatchLayoutIdA, scopedBatchLayoutIdB],
            ['018f8a78-7b8f-7c1d-a111-2222333344a1', '018f8a78-7b8f-7c1d-a111-2222333344a2']
        ])
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })

    it('rejects batch widget configs when the widget is not owned by the requested layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query.mockResolvedValueOnce([
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                layout_id: scopedBatchLayoutIdB,
                zone: 'main',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 0,
                config: {},
                is_active: true,
                version: 7
            }
        ])

        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    updates: [
                        {
                            layoutId: scopedBatchLayoutIdA,
                            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                            expectedVersion: 7,
                            config: { matrixMode: 'hierarchicalCells' }
                        }
                    ]
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('(layout_id, id)')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })

    it('atomically blocks a single-system transition while ordinary Structures exist', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'main',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 0,
                    config: { structureMode: 'multiple', conceptCodename: 'Structure' },
                    is_active: true,
                    version: 7
                }
            ])
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 2 }])

        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    updates: [
                        {
                            layoutId: scopedBatchLayoutIdA,
                            widgetId,
                            expectedVersion: 7,
                            config: { structureMode: 'singleSystem', conceptCodename: 'Structure' }
                        }
                    ]
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock')
        expect(txExecutor.query.mock.calls[11]?.[0]).toContain('COUNT(*)::int AS count')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })

    it('blocks a direct widget-config transition before updating the widget', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, {
            layoutId: scopedBatchLayoutIdA,
            templateKey: 'dashboard',
            widgets: [
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 0,
                    config: { structureMode: 'multiple' },
                    is_active: true,
                    version: 7
                }
            ]
        })
        txExecutor.query
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 1 }])

        await expect(
            updateApplicationLayoutWidgetConfig(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                scopedBatchLayoutIdA,
                widgetId,
                { expectedVersion: 7, config: { structureMode: 'singleSystem' } },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })

    it('guards activation of a preconfigured single-system widget', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, {
            layoutId: scopedBatchLayoutIdA,
            templateKey: 'dashboard',
            widgets: [
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 0,
                    config: { structureMode: 'singleSystem' },
                    is_active: false,
                    version: 7
                }
            ]
        })
        txExecutor.query
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 1 }])

        await expect(
            toggleApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                scopedBatchLayoutIdA,
                widgetId,
                { expectedVersion: 7, isActive: true },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET is_active = $2'))).toBe(false)
    })

    it('atomically restores the current metahub widget config with optimistic concurrency', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const sourceConfig = { structureMode: 'multiple', templatePanel: { showInStructureList: true, showInMatrix: true } }

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 1,
                    config: { structureMode: 'singleSystem' },
                    source_config: sourceConfig,
                    is_customized: true,
                    is_active: true,
                    version: 7
                }
            ])
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 1,
                    config: sourceConfig,
                    source_config: sourceConfig,
                    is_customized: false,
                    is_active: true,
                    version: 8
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        const saved = await resetApplicationLayoutWidgetConfigsBatch(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            { updates: [{ layoutId: scopedBatchLayoutIdA, widgetId, expectedVersion: 7 }] },
            'user-1'
        )

        expect(saved[0]).toEqual(expect.objectContaining({ id: widgetId, config: sourceConfig, isCustomized: false, version: 8 }))
        expect(txExecutor.query.mock.calls[9]?.[0]).toContain('SET config = source_config')
    })

    it('blocks a reset that would enter single-system mode while ordinary Structures exist', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: widgetId,
                    layout_id: scopedBatchLayoutIdA,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 1,
                    config: { structureMode: 'multiple', conceptCodename: 'Structure' },
                    source_config: { structureMode: 'singleSystem', conceptCodename: 'Structure' },
                    is_customized: true,
                    is_active: true,
                    version: 7
                }
            ])
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 1 }])

        await expect(
            resetApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                { updates: [{ layoutId: scopedBatchLayoutIdA, widgetId, expectedVersion: 7 }] },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = source_config'))).toBe(false)
    })

    it('rejects a stale metahub widget reset before applying changes', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query.mockResolvedValueOnce([
            {
                id: widgetId,
                layout_id: scopedBatchLayoutIdA,
                zone: 'center',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 1,
                config: { structureMode: 'singleSystem' },
                source_config: { structureMode: 'multiple' },
                is_customized: true,
                is_active: true,
                version: 8
            }
        ])

        await expect(
            resetApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                { updates: [{ layoutId: scopedBatchLayoutIdA, widgetId, expectedVersion: 7 }] },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = source_config'))).toBe(false)
    })
})
