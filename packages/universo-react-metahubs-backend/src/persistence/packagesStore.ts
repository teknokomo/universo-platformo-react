import { qSchemaTable } from '@universo-react/database'
import type {
    MetahubPackageAttachment,
    MetahubPackageCatalogItem,
    MetahubPackageRegistryItem,
    PackageSourceDescriptor,
    VersionedLocalizedContent
} from '@universo-react/types'
import type { SqlQueryable, PackageRow } from './types'
import { appFieldAliases, uplFieldAliases } from './types'

const PACKAGES_TABLE = qSchemaTable('metahubs', 'obj_packages')
const METAHUB_PACKAGES_TABLE = qSchemaTable('metahubs', 'rel_metahub_packages')

type AttachmentResultRow = Omit<MetahubPackageAttachment, 'attachedAt'> & { attachedAt: Date | string }

const activePackagePredicate = (alias: string): string =>
    `${alias}.is_active = true AND ${alias}._upl_deleted = false AND ${alias}._app_deleted = false`

const PACKAGE_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.package_name AS "packageName",
    ${alias}.version,
    ${alias}.display_name AS "displayName",
    ${alias}.description,
    ${alias}.source,
    ${alias}.is_active AS "isActive",
    ${uplFieldAliases(alias)},
    ${appFieldAliases(alias)}
`.trim()

export interface UpsertPackageInput {
    packageName: string
    version: string
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    source: PackageSourceDescriptor
    userId?: string | null
}

export async function upsertPackageRegistryItem(exec: SqlQueryable, input: UpsertPackageInput): Promise<PackageRow> {
    const rows = await exec.query<PackageRow>(
        `INSERT INTO ${PACKAGES_TABLE} AS p
            (package_name, version, display_name, description, source, is_active, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, true, $6, $6)
         ON CONFLICT (package_name, version)
         WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true
         DO UPDATE SET
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            source = EXCLUDED.source,
            is_active = true,
            _upl_updated_at = now(),
            _upl_updated_by = EXCLUDED._upl_updated_by
         RETURNING ${PACKAGE_SELECT('p')}`,
        [
            input.packageName,
            input.version,
            JSON.stringify(input.displayName),
            JSON.stringify(input.description ?? null),
            JSON.stringify(input.source),
            input.userId ?? null
        ]
    )
    return rows[0]
}

export async function findPackageByNameVersion(
    exec: SqlQueryable,
    packageName: string,
    version: string
): Promise<MetahubPackageRegistryItem | null> {
    const rows = await exec.query<PackageRow>(
        `SELECT ${PACKAGE_SELECT('p')}
         FROM ${PACKAGES_TABLE} p
         WHERE p.package_name = $1
           AND p.version = $2
           AND ${activePackagePredicate('p')}
         LIMIT 1`,
        [packageName, version]
    )
    return rows[0] ?? null
}

export async function listPackageCatalog(exec: SqlQueryable, metahubId: string): Promise<MetahubPackageCatalogItem[]> {
    const rows = await exec.query<
        PackageRow & {
            attachmentId: string | null
            attachedPackageId: string | null
            attachedVersion: string | null
        }
    >(
        `SELECT
            ${PACKAGE_SELECT('p')},
            a.id AS "attachmentId",
            a.package_id AS "attachedPackageId",
            a.expected_version AS "attachedVersion"
         FROM ${PACKAGES_TABLE} p
         LEFT JOIN ${METAHUB_PACKAGES_TABLE} a
           ON a.metahub_id = $1
          AND a.package_id = p.id
          AND a.package_name = p.package_name
          AND a.is_active = true
          AND a._upl_deleted = false
          AND a._app_deleted = false
         WHERE ${activePackagePredicate('p')}
         ORDER BY p.package_name ASC, p.version ASC`,
        [metahubId]
    )

    return rows.map((row) => ({
        id: row.id,
        packageName: row.packageName,
        version: row.version,
        displayName: row.displayName,
        description: row.description,
        source: row.source,
        isActive: row.isActive,
        attached: Boolean(row.attachmentId),
        attachmentId: row.attachmentId,
        attachedPackageId: row.attachedPackageId,
        attachedVersion: row.attachedVersion
    }))
}

export async function listMetahubPackages(exec: SqlQueryable, metahubId: string): Promise<MetahubPackageAttachment[]> {
    const rows = await exec.query<{
        id: string
        metahubId: string
        packageId: string
        packageName: string
        version: string
        displayName: VersionedLocalizedContent<string>
        description: VersionedLocalizedContent<string> | null
        source: PackageSourceDescriptor
        attachedAt: Date | string
        isActive: boolean
    }>(
        `SELECT
            a.id,
            a.metahub_id AS "metahubId",
            a.package_id AS "packageId",
            a.package_name AS "packageName",
            a.expected_version AS "version",
            p.display_name AS "displayName",
            p.description,
            p.source,
            a._upl_created_at AS "attachedAt",
            a.is_active AS "isActive"
         FROM ${METAHUB_PACKAGES_TABLE} a
         JOIN ${PACKAGES_TABLE} p ON p.id = a.package_id
         WHERE a.metahub_id = $1
           AND a.is_active = true
           AND a._upl_deleted = false
           AND a._app_deleted = false
           AND ${activePackagePredicate('p')}
         ORDER BY a.package_name ASC`,
        [metahubId]
    )

    return rows.map((row) => ({
        ...row,
        attachedAt: row.attachedAt instanceof Date ? row.attachedAt.toISOString() : String(row.attachedAt)
    }))
}

export async function copyMetahubPackages(
    exec: SqlQueryable,
    input: { sourceMetahubId: string; targetMetahubId: string; userId: string }
): Promise<number> {
    const rows = await exec.query<{ id: string }>(
        `INSERT INTO ${METAHUB_PACKAGES_TABLE}
            (metahub_id, package_id, package_name, expected_version, is_active, _upl_created_by, _upl_updated_by)
         SELECT
            $2,
            source.package_id,
            source.package_name,
            source.expected_version,
            true,
            $3,
            $3
         FROM ${METAHUB_PACKAGES_TABLE} source
         JOIN ${PACKAGES_TABLE} p ON p.id = source.package_id
         WHERE source.metahub_id = $1
           AND source.is_active = true
           AND source._upl_deleted = false
           AND source._app_deleted = false
           AND ${activePackagePredicate('p')}
         ON CONFLICT (metahub_id, package_name)
         WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true
         DO UPDATE SET
            package_id = EXCLUDED.package_id,
            expected_version = EXCLUDED.expected_version,
            is_active = true,
            _upl_updated_at = now(),
            _upl_updated_by = EXCLUDED._upl_updated_by
         RETURNING id`,
        [input.sourceMetahubId, input.targetMetahubId, input.userId]
    )

    return rows.length
}

export async function replaceMetahubPackagesFromSnapshot(
    exec: SqlQueryable,
    input: {
        metahubId: string
        packages: Array<{ packageName: string; version: string; source?: PackageSourceDescriptor }>
        userId: string
    }
): Promise<number> {
    const packageNames = new Set<string>()
    for (const item of input.packages) {
        if (packageNames.has(item.packageName)) {
            throw new Error(`Duplicate package in metahub snapshot: ${item.packageName}`)
        }
        packageNames.add(item.packageName)
    }

    await exec.query(
        `UPDATE ${METAHUB_PACKAGES_TABLE}
         SET is_active = false,
             _upl_deleted = true,
             _upl_deleted_at = now(),
             _upl_deleted_by = $2,
             _upl_updated_at = now(),
             _upl_updated_by = $2
         WHERE metahub_id = $1
           AND is_active = true
           AND _upl_deleted = false
           AND _app_deleted = false
         RETURNING id`,
        [input.metahubId, input.userId]
    )

    let restored = 0
    for (const item of input.packages) {
        const rows = await exec.query<{ id: string }>(
            `WITH selected_package AS (
                SELECT p.id, p.package_name, p.version
                FROM ${PACKAGES_TABLE} p
                WHERE p.package_name = $2
                  AND p.version = $3
                  AND ($5::jsonb IS NULL OR p.source = $5::jsonb)
                  AND ${activePackagePredicate('p')}
                LIMIT 1
             ),
             inserted AS (
                INSERT INTO ${METAHUB_PACKAGES_TABLE}
                    (metahub_id, package_id, package_name, expected_version, is_active, _upl_created_by, _upl_updated_by)
                SELECT $1, id, package_name, version, true, $4, $4
                FROM selected_package
                RETURNING id
             )
             SELECT id FROM inserted`,
            [input.metahubId, item.packageName, item.version, input.userId, item.source ? JSON.stringify(item.source) : null]
        )

        if (rows.length === 0) {
            throw new Error(`Package from metahub snapshot is not registered: ${item.packageName}@${item.version}`)
        }
        restored += rows.length
    }

    return restored
}

export async function attachMetahubPackage(
    exec: SqlQueryable,
    input: { metahubId: string; packageName: string; version: string; userId: string }
): Promise<MetahubPackageAttachment | null> {
    const rows = await exec.query<AttachmentResultRow>(
        `WITH selected_package AS (
            SELECT p.id, p.package_name, p.version
            FROM ${PACKAGES_TABLE} p
            WHERE p.package_name = $2
              AND p.version = $3
              AND ${activePackagePredicate('p')}
            LIMIT 1
         ),
         upserted AS (
            INSERT INTO ${METAHUB_PACKAGES_TABLE}
                (metahub_id, package_id, package_name, expected_version, is_active, _upl_created_by, _upl_updated_by)
            SELECT $1, id, package_name, version, true, $4, $4
            FROM selected_package
            ON CONFLICT (metahub_id, package_name)
            WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true
            DO UPDATE SET
                package_id = EXCLUDED.package_id,
                expected_version = EXCLUDED.expected_version,
                is_active = true,
                _upl_updated_at = now(),
                _upl_updated_by = EXCLUDED._upl_updated_by
            RETURNING id, metahub_id, package_id, package_name, expected_version, is_active, _upl_created_at
         )
         SELECT
            u.id,
            u.metahub_id AS "metahubId",
            u.package_id AS "packageId",
            u.package_name AS "packageName",
            u.expected_version AS "version",
            p.display_name AS "displayName",
            p.description,
            p.source,
            u._upl_created_at AS "attachedAt",
            u.is_active AS "isActive"
         FROM upserted u
         JOIN ${PACKAGES_TABLE} p ON p.id = u.package_id`,
        [input.metahubId, input.packageName, input.version, input.userId]
    )

    const row = rows[0]
    return row
        ? {
              ...row,
              attachedAt: row.attachedAt instanceof Date ? row.attachedAt.toISOString() : String(row.attachedAt)
          }
        : null
}

export async function detachMetahubPackage(
    exec: SqlQueryable,
    input: { metahubId: string; attachmentId: string; userId: string }
): Promise<{ id: string } | null> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE ${METAHUB_PACKAGES_TABLE}
         SET is_active = false,
             _upl_deleted = true,
             _upl_deleted_at = now(),
             _upl_deleted_by = $3,
             _upl_updated_at = now(),
             _upl_updated_by = $3
         WHERE id = $2
           AND metahub_id = $1
           AND is_active = true
           AND _upl_deleted = false
           AND _app_deleted = false
         RETURNING id`,
        [input.metahubId, input.attachmentId, input.userId]
    )

    return rows[0] ?? null
}

export async function changeMetahubPackageVersion(
    exec: SqlQueryable,
    input: { metahubId: string; attachmentId: string; version: string; userId: string }
): Promise<MetahubPackageAttachment | null> {
    const rows = await exec.query<AttachmentResultRow>(
        `WITH current_attachment AS (
            SELECT id, package_name
            FROM ${METAHUB_PACKAGES_TABLE}
            WHERE id = $2
              AND metahub_id = $1
              AND is_active = true
              AND _upl_deleted = false
              AND _app_deleted = false
            LIMIT 1
         ),
         selected_package AS (
            SELECT p.id, p.package_name, p.version
            FROM ${PACKAGES_TABLE} p
            JOIN current_attachment a ON a.package_name = p.package_name
            WHERE p.version = $3
              AND ${activePackagePredicate('p')}
            LIMIT 1
         ),
         updated AS (
            UPDATE ${METAHUB_PACKAGES_TABLE} a
            SET package_id = p.id,
                expected_version = p.version,
                _upl_updated_at = now(),
                _upl_updated_by = $4
            FROM selected_package p
            WHERE a.id = $2
              AND a.metahub_id = $1
              AND a.is_active = true
              AND a._upl_deleted = false
              AND a._app_deleted = false
            RETURNING a.id, a.metahub_id, a.package_id, a.package_name, a.expected_version, a.is_active, a._upl_created_at
         )
         SELECT
            u.id,
            u.metahub_id AS "metahubId",
            u.package_id AS "packageId",
            u.package_name AS "packageName",
            u.expected_version AS "version",
            p.display_name AS "displayName",
            p.description,
            p.source,
            u._upl_created_at AS "attachedAt",
            u.is_active AS "isActive"
         FROM updated u
         JOIN ${PACKAGES_TABLE} p ON p.id = u.package_id`,
        [input.metahubId, input.attachmentId, input.version, input.userId]
    )

    const row = rows[0]
    return row
        ? {
              ...row,
              attachedAt: row.attachedAt instanceof Date ? row.attachedAt.toISOString() : String(row.attachedAt)
          }
        : null
}
