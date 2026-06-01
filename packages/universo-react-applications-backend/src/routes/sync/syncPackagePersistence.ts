import stableStringify from 'json-stable-stringify'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import type { ApplicationPackageDefinition, PackageSourceDescriptor } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { type ApplicationSyncTransaction, getApplicationSyncDdlServices, getApplicationSyncKnex } from '../../ddl'

type PersistedAppPackageRowDb = {
    package_name: string
    version: string
    source?: unknown
    is_active: boolean
}

const buildPackageSortKey = (item: ApplicationPackageDefinition): string => `${item.packageName}:${item.version}`
const PACKAGE_REGISTRY_TABLE = qSchemaTable('metahubs', 'obj_packages')

const normalizeSource = (value: unknown): PackageSourceDescriptor => {
    const source = value && typeof value === 'object' ? (value as Partial<PackageSourceDescriptor>) : {}
    return {
        kind: 'workspace',
        packageName: typeof source.packageName === 'string' ? source.packageName : '',
        importName: typeof source.importName === 'string' ? source.importName : '',
        upstreamPackageName: typeof source.upstreamPackageName === 'string' ? source.upstreamPackageName : '',
        upstreamVersion: typeof source.upstreamVersion === 'string' ? source.upstreamVersion : '',
        runtimeTargets: Array.isArray(source.runtimeTargets)
            ? source.runtimeTargets.filter((target): target is 'server' | 'client' => target === 'server' || target === 'client')
            : []
    }
}

const normalizeSnapshotPackages = (snapshot: PublishedApplicationSnapshot): ApplicationPackageDefinition[] => {
    const rawPackages = Array.isArray(snapshot.packages) ? snapshot.packages : []
    const seenNames = new Set<string>()

    return rawPackages
        .map((item) => {
            if (!item || typeof item !== 'object' || typeof item.packageName !== 'string' || typeof item.version !== 'string') {
                throw new Error('[SchemaSync] Published package snapshot contains an invalid package entry')
            }

            if (seenNames.has(item.packageName)) {
                throw new Error(`[SchemaSync] Published package snapshot contains duplicate package ${item.packageName}`)
            }
            seenNames.add(item.packageName)

            return {
                packageName: item.packageName,
                version: item.version,
                source: normalizeSource(item.source),
                isActive: item.isActive !== false
            }
        })
        .sort((left, right) => buildPackageSortKey(left).localeCompare(buildPackageSortKey(right)))
}

const normalizePersistedPackages = (rows: PersistedAppPackageRowDb[]): ApplicationPackageDefinition[] =>
    rows
        .map((row) => ({
            packageName: row.package_name,
            version: row.version,
            source: normalizeSource(row.source),
            isActive: row.is_active
        }))
        .sort((left, right) => buildPackageSortKey(left).localeCompare(buildPackageSortKey(right)))

const createSyncExecutor = (trx?: ApplicationSyncTransaction): DbExecutor => createKnexExecutor(trx ?? getApplicationSyncKnex())

const getPackagesTable = (schemaName: string): string => qSchemaTable(schemaName, '_app_packages')

const validateSnapshotPackagesAgainstRegistry = async (
    exec: DbExecutor,
    snapshotPackages: ApplicationPackageDefinition[]
): Promise<void> => {
    if (snapshotPackages.length === 0) {
        return
    }

    const rows = await exec.query<{
        package_name: string
        version: string
        source: unknown
    }>(
        `SELECT package_name, version, source
         FROM ${PACKAGE_REGISTRY_TABLE}
         WHERE _upl_deleted = false
           AND _app_deleted = false
           AND is_active = true
           AND package_name = ANY($1::text[])`,
        [snapshotPackages.map((item) => item.packageName)]
    )
    const registryByKey = new Map(rows.map((row) => [`${row.package_name}:${row.version}`, normalizeSource(row.source)]))

    for (const item of snapshotPackages) {
        const registrySource = registryByKey.get(buildPackageSortKey(item))
        if (!registrySource) {
            throw new Error(`[SchemaSync] Published package ${item.packageName}@${item.version} is not registered`)
        }

        if (stableStringify(registrySource) !== stableStringify(item.source)) {
            throw new Error(`[SchemaSync] Published package ${item.packageName}@${item.version} does not match the package registry`)
        }
    }
}

const ensurePackagesTable = async (exec: DbExecutor, schemaName: string): Promise<void> => {
    const rows = await exec.query<{ exists: boolean }>(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = '_app_packages'
        ) AS "exists"`,
        [schemaName]
    )

    if (!rows[0]?.exists) {
        throw new Error('Runtime packages table is unavailable after system table bootstrap')
    }
}

export async function persistPublishedPackages(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const nextRows = normalizeSnapshotPackages(snapshot)

    const { generator } = getApplicationSyncDdlServices()
    await generator.ensureSystemTables(schemaName, trx)

    const now = new Date()

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        const exec = createSyncExecutor(activeTrx)
        const table = getPackagesTable(schemaName)
        await validateSnapshotPackagesAgainstRegistry(exec, nextRows)
        await ensurePackagesTable(exec, schemaName)

        const existingRows = await exec.query<{ package_name: string }>(
            `SELECT package_name
             FROM ${table}
             WHERE _upl_deleted = false
               AND _app_deleted = false`
        )
        const existingNames = new Set(existingRows.map((row) => String(row.package_name)))

        for (const item of nextRows) {
            if (existingNames.has(item.packageName)) {
                const rows = await exec.query<{ package_name: string }>(
                    `UPDATE ${table}
                     SET version = $2,
                         source = $3::jsonb,
                         is_active = $4,
                         config = '{}'::jsonb,
                         _upl_updated_at = $5,
                         _upl_updated_by = $6,
                         _upl_version = _upl_version + 1,
                         _upl_deleted = false,
                         _app_deleted = false
                     WHERE package_name = $1
                       AND _upl_deleted = false
                       AND _app_deleted = false
                     RETURNING package_name`,
                    [item.packageName, item.version, JSON.stringify(item.source), item.isActive, now, userId ?? null]
                )
                if (rows.length === 0) {
                    throw new Error(`[SchemaSync] Failed to update runtime package ${item.packageName}`)
                }
            } else {
                const rows = await exec.query<{ package_name: string }>(
                    `INSERT INTO ${table}
                        (package_name, version, source, is_active, config,
                         _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                         _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                         _app_published, _app_archived, _app_deleted)
                     VALUES
                        ($1, $2, $3::jsonb, $4, '{}'::jsonb,
                         $5, $6, $5, $6,
                         1, false, false, false,
                         true, false, false)
                     RETURNING package_name`,
                    [item.packageName, item.version, JSON.stringify(item.source), item.isActive, now, userId ?? null]
                )
                if (rows.length === 0) {
                    throw new Error(`[SchemaSync] Failed to insert runtime package ${item.packageName}`)
                }
            }
        }

        const nextNames = nextRows.map((row) => row.packageName)
        await exec.query(
            `UPDATE ${table}
             SET is_active = false,
                 _upl_deleted = true,
                 _upl_deleted_at = $2,
                 _upl_deleted_by = $3,
                 _upl_updated_at = $2,
                 _upl_updated_by = $3,
                 _upl_version = _upl_version + 1
             WHERE _upl_deleted = false
               AND _app_deleted = false
               AND package_name <> ALL($1::text[])
             RETURNING package_name`,
            [nextNames, now, userId ?? null]
        )
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

export async function hasPublishedPackagesChanges(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
}): Promise<boolean> {
    const { schemaName, snapshot } = options
    const exec = createSyncExecutor()
    const nextRows = normalizeSnapshotPackages(snapshot)
    await validateSnapshotPackagesAgainstRegistry(exec, nextRows)
    const hasPackagesRows = await exec.query<{ exists: boolean }>(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = '_app_packages'
        ) AS "exists"`,
        [schemaName]
    )
    const hasPackages = hasPackagesRows[0]?.exists === true
    if (!hasPackages) {
        return nextRows.length > 0
    }

    const persistedRows = await exec.query<PersistedAppPackageRowDb>(
        `SELECT package_name, version, source, is_active
         FROM ${getPackagesTable(schemaName)}
         WHERE _upl_deleted = false
           AND _app_deleted = false`
    )

    return stableStringify(normalizePersistedPackages(persistedRows)) !== stableStringify(nextRows)
}
