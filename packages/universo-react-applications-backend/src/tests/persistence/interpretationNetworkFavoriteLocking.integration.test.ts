import type { Knex } from 'knex'
import { createKnexExecutor, qSchema, qSchemaTable } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import { isActiveFavoriteTarget } from '../../persistence/interpretationNetworkFavoritesStore'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { addInterpretationNetworkFavorite } from '../../services/interpretationNetwork/runtimeInterpretationNetworkFavorites'
import { deleteStructureAggregate } from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import type { RuntimeSurfaceReady } from '../../shared/interpretationNetworkRuntimeContracts'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Interpretation Network Favorite lock-order integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const schemaName = `app_${generateUuidV7().replaceAll('-', '')}`
const structureTable = 'obj_favorite_lock_structure'
const interpretationTable = 'obj_favorite_lock_interpretation'
const matrixTable = 'obj_favorite_lock_matrix'
const materialTable = 'obj_favorite_lock_material'
const favoriteTable = 'obj_favorite_lock_favorite'
const favoriteObjectId = generateUuidV7()
const favoriteOwnerComponentId = generateUuidV7()
const favoriteInterpretationComponentId = generateUuidV7()
const favoriteCellComponentId = generateUuidV7()
const structureId = generateUuidV7()
const interpretationId = generateUuidV7()
const cellId = generateUuidV7()
const workspaceId = generateUuidV7()
const userId = generateUuidV7()

const component = (codename: string, column_name: string) => ({ id: generateUuidV7(), codename, column_name, data_type: 'STRING' as const })

const surface = {
    applicationId: generateUuidV7(),
    schemaName,
    workspaceId,
    layoutId: generateUuidV7(),
    widgetId: generateUuidV7(),
    widgetKey: 'interpretationNetworkWorkspace',
    widgetConfig: {},
    structureMode: 'multiple',
    featureState: 'ready',
    missing: [],
    resolvedObjects: {
        Structure: generateUuidV7(),
        Interpretation: generateUuidV7(),
        Material: generateUuidV7(),
        TableTemplate: generateUuidV7()
    },
    contracts: {
        Structure: {
            object: { id: generateUuidV7(), codename: 'Structure', table_name: structureTable },
            fields: { Name: component('Name', 'name'), SystemKey: component('SystemKey', 'system_key') },
            childFields: {}
        },
        Interpretation: {
            object: { id: generateUuidV7(), codename: 'Interpretation', table_name: interpretationTable },
            fields: {
                Title: component('Title', 'title'),
                ParentStructure: component('ParentStructure', 'parent_structure_id')
            },
            childTableName: matrixTable,
            childFields: {
                CellId: component('CellId', 'cell_id'),
                ParentCellId: component('ParentCellId', 'parent_cell_id'),
                RowLabel: component('RowLabel', 'row_label'),
                ColLabel: component('ColLabel', 'col_label'),
                CellValue: component('CellValue', 'cell_value'),
                MaterialRef: component('MaterialRef', 'material_ref')
            }
        },
        Material: {
            object: { id: generateUuidV7(), codename: 'Material', table_name: materialTable },
            fields: {
                CellId: component('CellId', 'cell_id'),
                InterpretationId: component('InterpretationId', 'interpretation_id'),
                TemplateOwnerId: component('TemplateOwnerId', 'template_owner_id')
            },
            childFields: {}
        },
        TableTemplate: {
            object: { id: generateUuidV7(), codename: 'TableTemplate', table_name: 'obj_favorite_lock_template' },
            fields: {},
            childFields: {}
        }
    }
} as RuntimeSurfaceReady

const waitForDatabaseLockWait = async (executor: Knex, backendPid: number, lockDescription: string): Promise<void> => {
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
        const result = await executor.raw(
            'SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid = ?::int',
            [backendPid]
        )
        const activity = result.rows[0] as { wait_event_type: string | null; blockers: number[] } | undefined
        if (activity?.wait_event_type === 'Lock') return
        await new Promise((resolve) => setTimeout(resolve, 25))
    }
    throw new Error(`Favorite validation backend ${backendPid} did not block on ${lockDescription}`)
}

const waitForSignal = async (signal: Promise<void>, label: string, timeoutMs = 5_000): Promise<void> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
        await Promise.race([
            signal,
            new Promise<never>((_resolve, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs)
            })
        ])
    } finally {
        if (timeoutId) clearTimeout(timeoutId)
    }
}

const createFavoriteRuntimeContext = (manager: DbExecutor): RuntimeSchemaContext => ({
    schemaName,
    schemaIdent: qSchema(schemaName),
    manager,
    userId,
    role: 'editor',
    permissions: {
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true,
        manageApplication: false,
        manageMembers: false
    },
    workflowCapabilities: {},
    currentWorkspaceId: workspaceId,
    workspacesEnabled: true,
    baseApplicationSettings: {},
    applicationSettings: {}
})

describeIntegration('Interpretation Network Favorite lock order PostgreSQL integration', () => {
    let knex: Knex
    let competingKnex: Knex

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 3 } })
        competingKnex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 2 } })
        await knex.raw(`CREATE SCHEMA ${qSchema(schemaName)}`)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, structureTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                name TEXT NULL,
                system_key TEXT NULL,
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                _upl_version INTEGER NOT NULL DEFAULT 1,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ NULL,
                _upl_deleted_by UUID NULL,
                _app_deleted_at TIMESTAMPTZ NULL,
                _app_deleted_by UUID NULL,
                _upl_updated_at TIMESTAMPTZ NULL,
                _upl_updated_by UUID NULL
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, interpretationTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                parent_structure_id UUID NOT NULL,
                title TEXT NULL,
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                _upl_version INTEGER NOT NULL DEFAULT 1,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ NULL,
                _upl_deleted_by UUID NULL,
                _app_deleted_at TIMESTAMPTZ NULL,
                _app_deleted_by UUID NULL,
                _upl_updated_at TIMESTAMPTZ NULL,
                _upl_updated_by UUID NULL
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, matrixTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                _tp_parent_id UUID NOT NULL,
                _tp_sort_order INTEGER NOT NULL DEFAULT 0,
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                cell_id TEXT NOT NULL,
                parent_cell_id TEXT NULL,
                row_label TEXT NULL,
                col_label TEXT NULL,
                cell_value TEXT NULL,
                material_ref UUID NULL,
                _upl_version INTEGER NOT NULL DEFAULT 1,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ NULL,
                _upl_deleted_by UUID NULL,
                _app_deleted_at TIMESTAMPTZ NULL,
                _app_deleted_by UUID NULL,
                _upl_updated_at TIMESTAMPTZ NULL,
                _upl_updated_by UUID NULL
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, materialTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                cell_id TEXT NULL,
                interpretation_id UUID NULL,
                template_owner_id UUID NULL,
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                _upl_version INTEGER NOT NULL DEFAULT 1,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ NULL,
                _upl_deleted_by UUID NULL,
                _app_deleted_at TIMESTAMPTZ NULL,
                _app_deleted_by UUID NULL,
                _upl_updated_at TIMESTAMPTZ NULL,
                _upl_updated_by UUID NULL
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_objects')} (
                id UUID PRIMARY KEY,
                kind TEXT NOT NULL,
                codename JSONB NOT NULL,
                table_name TEXT NOT NULL,
                config JSONB NOT NULL DEFAULT '{}'::jsonb,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_components')} (
                id UUID PRIMARY KEY,
                object_id UUID NOT NULL,
                parent_component_id UUID NULL,
                codename JSONB NOT NULL,
                data_type TEXT NOT NULL,
                column_name TEXT NOT NULL,
                is_required BOOLEAN NOT NULL DEFAULT false,
                validation_rules JSONB NULL,
                target_object_id UUID NULL,
                target_object_kind TEXT NULL,
                ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
                sort_order INTEGER NOT NULL DEFAULT 0,
                _upl_created_at TIMESTAMPTZ NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, favoriteTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                owner_user_id UUID NOT NULL,
                target_interpretation_id UUID NOT NULL,
                target_cell_id TEXT NOT NULL,
                _upl_version INTEGER NOT NULL DEFAULT 1,
                _upl_created_by UUID NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _upl_deleted_at TIMESTAMPTZ NULL,
                _upl_deleted_by UUID NULL,
                _app_deleted_at TIMESTAMPTZ NULL,
                _app_deleted_by UUID NULL,
                _upl_updated_at TIMESTAMPTZ NULL,
                _upl_updated_by UUID NULL
            )
        `)
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_objects')} (id, kind, codename, table_name, config)
             VALUES (?, 'OBJECT', ?::jsonb, ?, ?::jsonb)`,
            [
                favoriteObjectId,
                JSON.stringify('Favorite'),
                favoriteTable,
                JSON.stringify({
                    runtimeRecordAccess: { mode: 'ownerOnly', ownerFieldCodename: 'OwnerUserId' },
                    recordPolicy: { version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' }
                })
            ]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name, ui_config)
             VALUES
                (?, ?, ?::jsonb, 'STRING', 'owner_user_id', '{"serverOwned":true}'::jsonb),
                (?, ?, ?::jsonb, 'STRING', 'target_interpretation_id', '{"serverOwned":true}'::jsonb),
                (?, ?, ?::jsonb, 'STRING', 'target_cell_id', '{"serverOwned":true}'::jsonb)`,
            [
                favoriteOwnerComponentId,
                favoriteObjectId,
                JSON.stringify('OwnerUserId'),
                favoriteInterpretationComponentId,
                favoriteObjectId,
                JSON.stringify('TargetInterpretationId'),
                favoriteCellComponentId,
                favoriteObjectId,
                JSON.stringify('TargetCellId')
            ]
        )
    })

    beforeEach(async () => {
        await knex.raw(
            `TRUNCATE TABLE ${qSchemaTable(schemaName, favoriteTable)}, ${qSchemaTable(schemaName, materialTable)},
             ${qSchemaTable(schemaName, matrixTable)}, ${qSchemaTable(schemaName, interpretationTable)}, ${qSchemaTable(
                schemaName,
                structureTable
            )}`
        )
        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, structureTable)} (id, workspace_id, name) VALUES (?, ?, ?)`, [
            structureId,
            workspaceId,
            'Favorite lock-order structure'
        ])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(
                schemaName,
                interpretationTable
            )} (id, workspace_id, parent_structure_id, title) VALUES (?, ?, ?, ?)`,
            [interpretationId, workspaceId, structureId, 'Favorite lock-order interpretation']
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, matrixTable)} (id, workspace_id, _tp_parent_id, cell_id) VALUES (?, ?, ?, ?)`,
            [generateUuidV7(), workspaceId, interpretationId, cellId]
        )
    })

    afterAll(async () => {
        try {
            if (knex) await knex.raw(`DROP SCHEMA IF EXISTS ${qSchema(schemaName)} CASCADE`)
        } finally {
            if (knex) await knex.destroy()
            if (competingKnex) await competingKnex.destroy()
        }
    })

    it('serializes concurrent duplicate Favorite adds through PostgreSQL transactions', async () => {
        const firstExecutor = createKnexExecutor(knex)
        const competingExecutor = createKnexExecutor(competingKnex)
        let firstBackendPid = 0
        let competingBackendPid = 0
        let signalFirstFavoriteLock: () => void = () => undefined
        const firstFavoriteLock = new Promise<void>((resolve) => {
            signalFirstFavoriteLock = resolve
        })
        let releaseFirstAdd: () => void = () => undefined
        const firstAddGate = new Promise<void>((resolve) => {
            releaseFirstAdd = resolve
        })
        let signalCompetingLockAttempt: () => void = () => undefined
        const competingLockAttempt = new Promise<void>((resolve) => {
            signalCompetingLockAttempt = resolve
        })
        let firstAddPaused = false
        let competingAdd: ReturnType<typeof addInterpretationNetworkFavorite> | undefined
        const gatedFirstExecutor: DbExecutor = {
            query: (sql, parameters) => firstExecutor.query(sql, parameters),
            transaction: (callback) =>
                firstExecutor.transaction(async (transaction) => {
                    const pidRows = await transaction.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                    firstBackendPid = Number(pidRows[0]?.pid)
                    const gatedTransaction: DbExecutor = {
                        query: async <T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]> => {
                            const rows = await transaction.query<T>(sql, parameters)
                            if (!firstAddPaused && sql.includes('SELECT pg_advisory_xact_lock')) {
                                firstAddPaused = true
                                signalFirstFavoriteLock()
                                await firstAddGate
                            }
                            return rows
                        },
                        transaction: (nestedCallback) => transaction.transaction(nestedCallback),
                        isReleased: () => false
                    }
                    return callback(gatedTransaction)
                }),
            isReleased: () => false
        }
        const observedCompetingExecutor: DbExecutor = {
            query: (sql, parameters) => competingExecutor.query(sql, parameters),
            transaction: (callback) =>
                competingExecutor.transaction(async (transaction) => {
                    const pidRows = await transaction.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                    competingBackendPid = Number(pidRows[0]?.pid)
                    const observedTransaction: DbExecutor = {
                        query: (sql, parameters) => {
                            if (sql.includes('SELECT pg_advisory_xact_lock')) signalCompetingLockAttempt()
                            return transaction.query(sql, parameters)
                        },
                        transaction: (nestedCallback) => transaction.transaction(nestedCallback),
                        isReleased: () => false
                    }
                    return callback(observedTransaction)
                }),
            isReleased: () => false
        }

        const firstAdd = addInterpretationNetworkFavorite(createFavoriteRuntimeContext(gatedFirstExecutor), surface, {
            interpretationId,
            cellId
        })

        try {
            await waitForSignal(firstFavoriteLock, 'the first Favorite owner-target lock')
            expect(firstBackendPid).toBeGreaterThan(0)

            competingAdd = addInterpretationNetworkFavorite(createFavoriteRuntimeContext(observedCompetingExecutor), surface, {
                interpretationId,
                cellId
            })
            await waitForSignal(competingLockAttempt, 'the competing Favorite owner-target lock attempt')
            expect(competingBackendPid).toBeGreaterThan(0)
            await waitForDatabaseLockWait(knex, competingBackendPid, 'the Favorite owner-target advisory lock')
            const blockers = await knex.raw('SELECT pg_blocking_pids(?::int) AS blockers', [competingBackendPid])
            expect((blockers.rows[0] as { blockers: number[] }).blockers).toContain(firstBackendPid)

            releaseFirstAdd()
            const [firstResult, competingResult] = await Promise.all([firstAdd, competingAdd])
            expect([firstResult.created, competingResult.created].sort()).toEqual([false, true])

            const persistedFavorites = await knex.raw(
                `SELECT id, workspace_id, owner_user_id, target_interpretation_id, target_cell_id
                 FROM ${qSchemaTable(schemaName, favoriteTable)}
                 WHERE workspace_id = ? AND owner_user_id = ? AND target_interpretation_id = ?
                   AND target_cell_id = ? AND _upl_deleted = false AND _app_deleted = false`,
                [workspaceId, userId, interpretationId, cellId]
            )
            expect(persistedFavorites.rows).toHaveLength(1)
            expect(persistedFavorites.rows[0]).toMatchObject({
                workspace_id: workspaceId,
                owner_user_id: userId,
                target_interpretation_id: interpretationId,
                target_cell_id: cellId
            })
        } finally {
            releaseFirstAdd()
            await Promise.allSettled([firstAdd, ...(competingAdd ? [competingAdd] : [])])
        }
    })

    it('does not deadlock Favorite validation against a Structure aggregate deletion', async () => {
        const favoriteId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, favoriteTable)}
                (id, workspace_id, owner_user_id, target_interpretation_id, target_cell_id)
             VALUES (?, ?, ?, ?, ?)`,
            [favoriteId, workspaceId, userId, interpretationId, cellId]
        )

        let signalStructureLocked: () => void = () => undefined
        const structureLocked = new Promise<void>((resolve) => {
            signalStructureLocked = resolve
        })
        let releaseDelete: () => void = () => undefined
        const deleteGate = new Promise<void>((resolve) => {
            releaseDelete = resolve
        })
        const baseDeleteManager = createKnexExecutor(knex)
        const deleteRowLockQueries: string[] = []
        let writerBackendPid = 0
        let structureRowLockHeld = false
        const deleteManager: DbExecutor = {
            query: (sql, parameters) => baseDeleteManager.query(sql, parameters),
            transaction: (callback) =>
                baseDeleteManager.transaction(async (transaction) => {
                    const pidRows = await transaction.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                    writerBackendPid = Number(pidRows[0]?.pid)
                    const trackedExecutor: DbExecutor = {
                        query: async <T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]> => {
                            const rows = await transaction.query<T>(sql, parameters)
                            if (sql.includes('FOR UPDATE')) deleteRowLockQueries.push(sql)
                            if (
                                !structureRowLockHeld &&
                                sql.includes(`FROM ${qSchemaTable(schemaName, structureTable)}`) &&
                                sql.includes('FOR UPDATE')
                            ) {
                                structureRowLockHeld = true
                                signalStructureLocked()
                                await deleteGate
                            }
                            return rows
                        },
                        transaction: (nestedCallback) => transaction.transaction(nestedCallback),
                        isReleased: () => false
                    }
                    return callback(trackedExecutor)
                }),
            isReleased: () => false
        }
        const deleteContext: RuntimeSchemaContext = {
            schemaName,
            schemaIdent: qSchema(schemaName),
            manager: deleteManager,
            userId,
            role: 'editor',
            permissions: {
                createContent: true,
                editContent: true,
                deleteContent: true,
                readReports: true,
                manageApplication: false,
                manageMembers: false
            },
            workflowCapabilities: {},
            currentWorkspaceId: workspaceId,
            workspacesEnabled: true,
            baseApplicationSettings: {},
            applicationSettings: {}
        }
        let lifecycleDispatchCount = 0
        let resolveAfterCommitDispatches: () => void = () => undefined
        const afterCommitDispatches = new Promise<void>((resolve) => {
            resolveAfterCommitDispatches = resolve
        })
        const lifecycleSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockImplementation(async () => {
            lifecycleDispatchCount += 1
            if (lifecycleDispatchCount >= 2) resolveAfterCommitDispatches()
            return []
        })
        const deleteTransaction = deleteStructureAggregate(deleteContext, surface, structureId, { expectedVersion: 1 })

        let signalFavoriteStructureLock: () => void = () => undefined
        const favoriteStructureLockStarted = new Promise<void>((resolve) => {
            signalFavoriteStructureLock = resolve
        })
        let favoriteBackendPid = 0
        let favoriteTransaction: Promise<boolean> | undefined
        try {
            await waitForSignal(structureLocked, 'the production Structure row lock')
            expect(writerBackendPid).toBeGreaterThan(0)
            favoriteTransaction = competingKnex.transaction(async (transaction) => {
                const pidResult = await transaction.raw('SELECT pg_backend_pid() AS pid')
                favoriteBackendPid = Number((pidResult.rows[0] as { pid: number }).pid)
                const baseExecutor = createKnexExecutor(transaction)
                const trackedExecutor: DbExecutor = {
                    query: (sql, parameters) => {
                        if (sql.includes(`FROM ${qSchemaTable(schemaName, structureTable)} s`) && sql.includes('FOR SHARE')) {
                            signalFavoriteStructureLock()
                        }
                        return baseExecutor.query(sql, parameters)
                    },
                    transaction: (callback) => baseExecutor.transaction(callback),
                    isReleased: () => false
                }
                return isActiveFavoriteTarget(trackedExecutor, workspaceId, true, surface, { interpretationId, cellId })
            })

            await waitForSignal(favoriteStructureLockStarted, 'Favorite validation to reach the Structure lock')
            await waitForDatabaseLockWait(knex, favoriteBackendPid, 'the Structure row lock')
            const blockers = await knex.raw('SELECT pg_blocking_pids(?::int) AS blockers', [favoriteBackendPid])
            expect((blockers.rows[0] as { blockers: number[] }).blockers).toContain(writerBackendPid)
            releaseDelete()
            await deleteTransaction
            await expect(favoriteTransaction).resolves.toBe(false)
            await waitForSignal(afterCommitDispatches, 'both committed aggregate lifecycle dispatches')

            const lockOrder = deleteRowLockQueries.map((sql) => {
                if (sql.includes(qSchemaTable(schemaName, structureTable))) return 'structure'
                if (sql.includes(qSchemaTable(schemaName, interpretationTable))) return 'interpretation'
                if (sql.includes(qSchemaTable(schemaName, matrixTable))) return 'matrix'
                if (sql.includes(qSchemaTable(schemaName, materialTable))) return 'material'
                return 'other'
            })
            expect(lockOrder.indexOf('structure')).toBeGreaterThanOrEqual(0)
            expect(lockOrder.indexOf('interpretation')).toBeGreaterThan(lockOrder.indexOf('structure'))
            expect(lockOrder.indexOf('matrix')).toBeGreaterThan(lockOrder.indexOf('interpretation'))

            const deletedRows = await knex.raw(
                `SELECT
                    (SELECT _app_deleted FROM ${qSchemaTable(schemaName, structureTable)} WHERE id = ?) AS structure_deleted,
                    (SELECT _app_deleted FROM ${qSchemaTable(schemaName, interpretationTable)} WHERE id = ?) AS interpretation_deleted,
                    (SELECT _app_deleted FROM ${qSchemaTable(schemaName, matrixTable)} WHERE cell_id = ?) AS matrix_deleted,
                    (SELECT _app_deleted FROM ${qSchemaTable(schemaName, favoriteTable)} WHERE id = ?) AS favorite_deleted`,
                [structureId, interpretationId, cellId, favoriteId]
            )
            expect(deletedRows.rows[0]).toEqual({
                structure_deleted: true,
                interpretation_deleted: true,
                matrix_deleted: true,
                favorite_deleted: true
            })
        } finally {
            releaseDelete()
            await Promise.allSettled([deleteTransaction, ...(favoriteTransaction ? [favoriteTransaction] : [])])
            lifecycleSpy.mockRestore()
        }
    })
})
