import type { Knex } from 'knex'
import { createKnexExecutor } from '@universo-react/database'
import type { ObjectSystemFieldState, PlatformSystemComponentsPolicy } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import {
    ensureObjectSystemComponentsSeed,
    readPlatformSystemComponentsPolicyWithKnex,
    type EnsureObjectSystemComponentsSeedOptions
} from '../templates/services/systemComponentSeed'

/**
 * The snapshot importer still uses Knex's query-builder vocabulary while the
 * rest of the runtime is being moved to DbExecutor stores.  Keep that
 * compatibility boundary in the DDL domain instead of leaking Knex types into
 * metahub or PlayCanvas domain services.
 */
export type SnapshotRestoreTransaction = Knex.Transaction

export interface SnapshotRestoreDatabase {
    executor: DbExecutor
    transaction<T>(callback: (transaction: SnapshotRestoreTransaction) => Promise<T>): Promise<T>
}

/**
 * Constructor input retained for callers that still provide the shared Knex
 * instance directly.  The Knex type is intentionally exported only through
 * this DDL boundary.
 */
export type SnapshotRestoreDatabaseInput = SnapshotRestoreDatabase | Pick<Knex, 'raw' | 'transaction'>

/**
 * Wraps the shared Knex instance for the legacy snapshot transaction.  This is
 * the only production construction site for the Knex-backed snapshot
 * database; domain services depend on SnapshotRestoreDatabase instead.
 */
export function createSnapshotRestoreDatabase(knex: Knex): SnapshotRestoreDatabase {
    return {
        executor: createKnexExecutor(knex),
        transaction: async <T>(callback: (transaction: SnapshotRestoreTransaction) => Promise<T>) =>
            knex.transaction((transaction) => callback(transaction as SnapshotRestoreTransaction))
    }
}

/**
 * Accepts the old constructor input for source/test compatibility while
 * normalising it to the explicit DDL adapter at the service boundary.
 */
export function normalizeSnapshotRestoreDatabase(input: SnapshotRestoreDatabaseInput): SnapshotRestoreDatabase {
    if (input && typeof input === 'object' && 'executor' in input) {
        const candidate = input as Partial<SnapshotRestoreDatabase>
        if (candidate.executor && typeof candidate.executor.query === 'function' && typeof candidate.transaction === 'function') {
            return candidate as SnapshotRestoreDatabase
        }
    }
    return createSnapshotRestoreDatabase(input as Knex)
}

/**
 * Convert a transaction exposed by the DDL adapter to the shared executor
 * contract for store-backed operations participating in the same transaction.
 */
export function createSnapshotRestoreExecutor(transaction: SnapshotRestoreTransaction): DbExecutor {
    return createKnexExecutor(transaction)
}

/**
 * Run work under a transaction-scoped advisory lock without opening a nested
 * pool transaction. The caller owns the DDL transaction, so acquiring the
 * lock through its executor keeps the lock and every restore query on the
 * same PostgreSQL connection and transaction.
 */
export async function withSnapshotRestoreAdvisoryLock<T>(
    transaction: SnapshotRestoreTransaction,
    lockKey: string,
    work: (executor: DbExecutor) => Promise<T>
): Promise<T> {
    const executor = createSnapshotRestoreExecutor(transaction)
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])
    return work(executor)
}

/**
 * Template system-component seeding is a Knex-only DDL operation. Keep the
 * adapter call here so snapshot domain services never import the Knex helper
 * directly.
 */
export function readSnapshotRestorePlatformSystemComponentsPolicy(
    transaction: SnapshotRestoreTransaction
): Promise<PlatformSystemComponentsPolicy> {
    return readPlatformSystemComponentsPolicyWithKnex(transaction)
}

export function ensureSnapshotRestoreObjectSystemComponentsSeed(
    transaction: SnapshotRestoreTransaction,
    schemaName: string,
    objectCollectionId: string,
    actorId: string | null,
    options: { states?: ObjectSystemFieldState[]; policy?: PlatformSystemComponentsPolicy }
): ReturnType<typeof ensureObjectSystemComponentsSeed> {
    const seedOptions: EnsureObjectSystemComponentsSeedOptions = options
    return ensureObjectSystemComponentsSeed(transaction, schemaName, objectCollectionId, actorId, seedOptions)
}

const PLAYCANVAS_SNAPSHOT_TABLES = [
    '_mhb_playcanvas_publication_manifests',
    '_mhb_playcanvas_generated_artifacts',
    '_mhb_playcanvas_scene_script_bindings',
    '_mhb_playcanvas_script_assets',
    '_mhb_playcanvas_assets',
    '_mhb_playcanvas_scenes',
    '_mhb_playcanvas_package_compatibility',
    '_mhb_playcanvas_projects',
    '_mhb_playcanvas_sourcefiles'
] as const

export type PlayCanvasSnapshotTable = (typeof PLAYCANVAS_SNAPSHOT_TABLES)[number]

const isPlayCanvasSnapshotTable = (tableName: string): tableName is PlayCanvasSnapshotTable =>
    (PLAYCANVAS_SNAPSHOT_TABLES as readonly string[]).includes(tableName)

/**
 * Delete all PlayCanvas snapshot rows in dependency order.  The table list is
 * deliberately closed so callers cannot turn this DDL boundary into an
 * arbitrary identifier query.
 */
export async function deletePlayCanvasSnapshotRows(transaction: SnapshotRestoreTransaction, schemaName: string): Promise<void> {
    const tables: PlayCanvasSnapshotTable[] = [
        '_mhb_playcanvas_publication_manifests',
        '_mhb_playcanvas_generated_artifacts',
        '_mhb_playcanvas_scene_script_bindings',
        '_mhb_playcanvas_script_assets',
        '_mhb_playcanvas_assets',
        '_mhb_playcanvas_scenes',
        '_mhb_playcanvas_sourcefiles',
        '_mhb_playcanvas_package_compatibility',
        '_mhb_playcanvas_projects'
    ]
    for (const tableName of tables) {
        await transaction.withSchema(schemaName).from(tableName).del()
    }
}

/**
 * Insert one restored PlayCanvas row through the DDL query-builder boundary.
 * Table names are restricted to the known snapshot schema tables above.
 */
export async function insertPlayCanvasSnapshotRow(
    transaction: SnapshotRestoreTransaction,
    schemaName: string,
    tableName: PlayCanvasSnapshotTable,
    row: Record<string, unknown>
): Promise<void> {
    if (!isPlayCanvasSnapshotTable(tableName)) {
        throw new Error(`Unsupported PlayCanvas snapshot table: ${tableName}`)
    }
    await transaction.withSchema(schemaName).into(tableName).insert(row)
}
