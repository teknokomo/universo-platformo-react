import { qSchemaTable } from '@universo-react/database'
import type {
    PackageAttachmentConfig,
    PackageAuthoringSurfaceDescriptor,
    MetahubPackageAttachment,
    MetahubPackageCatalogItem,
    MetahubPackageRegistryItem,
    PackageSourceDescriptor,
    VersionedLocalizedContent
} from '@universo-react/types'
import type { SqlQueryable, PackageRow } from './types'
import { appFieldAliases, uplFieldAliases } from './types'
import {
    resolvePackageAuthoringSurface,
    resolveCompatiblePackageAttachmentConfig,
    resolveCompatiblePackageAttachmentConfigOrThrow,
    resolveDefaultPackageAttachmentConfig,
    resolvePackageAttachmentConfig,
    resolveStoredPackageAttachmentConfig
} from '../domains/packages/services/packageConfigValidation'

const PACKAGES_TABLE = qSchemaTable('metahubs', 'obj_packages')
const METAHUB_PACKAGES_TABLE = qSchemaTable('metahubs', 'rel_metahub_packages')

type AttachmentResultRow = Omit<MetahubPackageAttachment, 'attachedAt'> & { attachedAt: Date | string }
type SelectedPackageRow = Pick<PackageRow, 'id' | 'packageName' | 'version' | 'authoringSurface' | 'source'>
type SnapshotPackageInput = {
    packageName: string
    version: string
    source?: PackageSourceDescriptor
    config?: PackageAttachmentConfig
}
type PreparedSnapshotPackage = { selectedPackage: SelectedPackageRow; config: PackageAttachmentConfig }

const DEFAULT_AUTHORING_SURFACE: PackageAuthoringSurfaceDescriptor = {
    schemaVersion: '1',
    kind: 'none',
    supportedDisplayModes: [],
    defaultConfig: {
        schemaVersion: '1',
        kind: 'none'
    }
}

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
    ${alias}.authoring_surface AS "authoringSurface",
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
    authoringSurface?: PackageAuthoringSurfaceDescriptor
    userId?: string | null
}

const normalizeAuthoringSurface = (value: unknown): PackageAuthoringSurfaceDescriptor => resolvePackageAuthoringSurface(value)

const normalizeAttachmentConfig = (
    value: PackageAttachmentConfig | null | undefined,
    authoringSurface: PackageAuthoringSurfaceDescriptor = DEFAULT_AUTHORING_SURFACE
): PackageAttachmentConfig => {
    if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
        return resolveDefaultPackageAttachmentConfig(authoringSurface)
    }
    return value
}

const selectActivePackageBySnapshotItem = async (
    exec: SqlQueryable,
    item: { packageName: string; version: string; source?: PackageSourceDescriptor }
): Promise<SelectedPackageRow | null> => {
    const rows = await exec.query<SelectedPackageRow>(
        `SELECT p.id,
                p.package_name AS "packageName",
                p.version,
                p.source,
                p.authoring_surface AS "authoringSurface"
         FROM ${PACKAGES_TABLE} p
         WHERE p.package_name = $1
           AND p.version = $2
           AND ($3::jsonb IS NULL OR p.source = $3::jsonb)
           AND ${activePackagePredicate('p')}
         LIMIT 1`,
        [item.packageName, item.version, item.source ? JSON.stringify(item.source) : null]
    )
    return rows[0] ? { ...rows[0], authoringSurface: normalizeAuthoringSurface(rows[0].authoringSurface) } : null
}

const normalizeAttachmentRow = (row: AttachmentResultRow): MetahubPackageAttachment => ({
    ...row,
    authoringSurface: normalizeAuthoringSurface(row.authoringSurface),
    config: normalizeAttachmentConfig(row.config, normalizeAuthoringSurface(row.authoringSurface)),
    attachedAt: row.attachedAt instanceof Date ? row.attachedAt.toISOString() : String(row.attachedAt)
})

export async function prepareMetahubPackagesFromSnapshot(
    exec: SqlQueryable,
    packages: SnapshotPackageInput[]
): Promise<PreparedSnapshotPackage[]> {
    const packageNames = new Set<string>()
    for (const item of packages) {
        if (packageNames.has(item.packageName)) {
            throw new Error(`Duplicate package in metahub snapshot: ${item.packageName}`)
        }
        packageNames.add(item.packageName)
    }

    const restoredPackages: PreparedSnapshotPackage[] = []
    for (const item of packages) {
        const selectedPackage = await selectActivePackageBySnapshotItem(exec, item)
        if (!selectedPackage) {
            throw new Error(`Package from metahub snapshot is not registered: ${item.packageName}@${item.version}`)
        }
        const restoredConfig =
            item.config === undefined
                ? resolveDefaultPackageAttachmentConfig(selectedPackage.authoringSurface)
                : resolveStoredPackageAttachmentConfig(item.config, selectedPackage.authoringSurface)
        restoredPackages.push({ selectedPackage, config: restoredConfig })
    }

    return restoredPackages
}

export async function upsertPackageRegistryItem(exec: SqlQueryable, input: UpsertPackageInput): Promise<PackageRow> {
    const authoringSurface = normalizeAuthoringSurface(input.authoringSurface)
    if (authoringSurface.kind === 'playcanvasEditor') {
        const slugConflicts = await exec.query<{ packageName: string }>(
            `SELECT p.package_name AS "packageName"
             FROM ${PACKAGES_TABLE} p
             WHERE p.authoring_surface ->> 'kind' = 'playcanvasEditor'
               AND p.authoring_surface ->> 'packageSlug' = $1
               AND p.package_name <> $2
               AND ${activePackagePredicate('p')}
             LIMIT 1`,
            [authoringSurface.packageSlug, input.packageName]
        )
        if (slugConflicts[0]?.packageName) {
            throw new Error(
                `Package authoring surface slug "${authoringSurface.packageSlug}" is already used by "${slugConflicts[0].packageName}"`
            )
        }
    }

    const rows = await exec.query<PackageRow>(
        `INSERT INTO ${PACKAGES_TABLE} AS p
            (package_name, version, display_name, description, source, authoring_surface, is_active, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, true, $7, $7)
         ON CONFLICT (package_name, version)
         WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true
         DO UPDATE SET
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            source = EXCLUDED.source,
            authoring_surface = EXCLUDED.authoring_surface,
            is_active = true,
            _upl_updated_at = now(),
            _upl_updated_by = EXCLUDED._upl_updated_by,
            _upl_version = CASE
                WHEN p.display_name IS DISTINCT FROM EXCLUDED.display_name
                  OR p.description IS DISTINCT FROM EXCLUDED.description
                  OR p.source IS DISTINCT FROM EXCLUDED.source
                  OR p.authoring_surface IS DISTINCT FROM EXCLUDED.authoring_surface
                  OR p.is_active IS DISTINCT FROM true
                THEN p._upl_version + 1
                ELSE p._upl_version
            END
         RETURNING ${PACKAGE_SELECT('p')}`,
        [
            input.packageName,
            input.version,
            JSON.stringify(input.displayName),
            JSON.stringify(input.description ?? null),
            JSON.stringify(input.source),
            JSON.stringify(authoringSurface),
            input.userId ?? null
        ]
    )
    return {
        ...rows[0],
        authoringSurface: normalizeAuthoringSurface(rows[0].authoringSurface)
    }
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
    return rows[0]
        ? {
              ...rows[0],
              authoringSurface: normalizeAuthoringSurface(rows[0].authoringSurface)
          }
        : null
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
        authoringSurface: normalizeAuthoringSurface(row.authoringSurface),
        isActive: row.isActive,
        attached: Boolean(row.attachmentId),
        attachmentId: row.attachmentId,
        attachedPackageId: row.attachedPackageId,
        attachedVersion: row.attachedVersion
    }))
}

export async function listMetahubPackages(exec: SqlQueryable, metahubId: string): Promise<MetahubPackageAttachment[]> {
    const rows =
        (await exec.query<{
            id: string
            metahubId: string
            packageId: string
            packageName: string
            version: string
            displayName: VersionedLocalizedContent<string>
            description: VersionedLocalizedContent<string> | null
            source: PackageSourceDescriptor
            authoringSurface: PackageAuthoringSurfaceDescriptor
            config: PackageAttachmentConfig
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
            p.authoring_surface AS "authoringSurface",
            a.config,
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
        )) ?? []

    return rows.map((row) => normalizeAttachmentRow(row))
}

export async function copyMetahubPackages(
    exec: SqlQueryable,
    input: { sourceMetahubId: string; targetMetahubId: string; userId: string }
): Promise<number> {
    const rows = await exec.query<{ id: string }>(
        `INSERT INTO ${METAHUB_PACKAGES_TABLE} AS target
            (metahub_id, package_id, package_name, expected_version, config, is_active, _upl_created_by, _upl_updated_by)
         SELECT
            $2,
            source.package_id,
            source.package_name,
            source.expected_version,
            source.config,
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
	            config = EXCLUDED.config,
	            is_active = true,
	            _upl_updated_at = now(),
	            _upl_updated_by = EXCLUDED._upl_updated_by,
	            _upl_version = target._upl_version + 1
	         RETURNING id`,
        [input.sourceMetahubId, input.targetMetahubId, input.userId]
    )

    return rows.length
}

export async function replaceMetahubPackagesFromSnapshot(
    exec: SqlQueryable,
    input: {
        metahubId: string
        packages: SnapshotPackageInput[]
        userId: string
    }
): Promise<number> {
    const restoredPackages = await prepareMetahubPackagesFromSnapshot(exec, input.packages)

    await exec.query(
        `UPDATE ${METAHUB_PACKAGES_TABLE}
         SET is_active = false,
             _upl_deleted = true,
             _upl_deleted_at = now(),
	             _upl_deleted_by = $2,
	             _upl_updated_at = now(),
	             _upl_updated_by = $2,
	             _upl_version = _upl_version + 1
	         WHERE metahub_id = $1
           AND is_active = true
           AND _upl_deleted = false
           AND _app_deleted = false
         RETURNING id`,
        [input.metahubId, input.userId]
    )

    let restored = 0
    for (const { selectedPackage, config } of restoredPackages) {
        const rows = await exec.query<{ id: string }>(
            `INSERT INTO ${METAHUB_PACKAGES_TABLE}
                (metahub_id, package_id, package_name, expected_version, config, is_active, _upl_created_by, _upl_updated_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, true, $6, $6)
             RETURNING id`,
            [
                input.metahubId,
                selectedPackage.id,
                selectedPackage.packageName,
                selectedPackage.version,
                JSON.stringify(config),
                input.userId
            ]
        )

        restored += rows.length
    }

    return restored
}

export async function attachMetahubPackage(
    exec: SqlQueryable,
    input: { metahubId: string; packageName: string; version: string; userId: string }
): Promise<MetahubPackageAttachment | null> {
    const selectedRows = await exec.query<SelectedPackageRow>(
        `SELECT p.id,
                p.package_name AS "packageName",
                p.version,
                p.source,
                p.authoring_surface AS "authoringSurface"
         FROM ${PACKAGES_TABLE} p
         WHERE p.package_name = $1
           AND p.version = $2
           AND ${activePackagePredicate('p')}
         LIMIT 1`,
        [input.packageName, input.version]
    )
    const selectedPackage = selectedRows[0]
        ? { ...selectedRows[0], authoringSurface: normalizeAuthoringSurface(selectedRows[0].authoringSurface) }
        : null
    if (!selectedPackage) {
        return null
    }
    const currentRows = await exec.query<{ packageId: string; config: PackageAttachmentConfig }>(
        `SELECT a.package_id AS "packageId",
                a.config
         FROM ${METAHUB_PACKAGES_TABLE} a
         WHERE a.metahub_id = $1
           AND a.package_name = $2
           AND a.is_active = true
           AND a._upl_deleted = false
           AND a._app_deleted = false
         LIMIT 1`,
        [input.metahubId, selectedPackage.packageName]
    )
    const currentAttachment = currentRows[0]
    const nextConfig = currentAttachment
        ? resolveCompatiblePackageAttachmentConfig(currentAttachment.config, selectedPackage.authoringSurface)
        : resolveDefaultPackageAttachmentConfig(selectedPackage.authoringSurface)

    const rows = await exec.query<AttachmentResultRow>(
        `WITH upserted AS (
            INSERT INTO ${METAHUB_PACKAGES_TABLE} AS target
                (metahub_id, package_id, package_name, expected_version, config, is_active, _upl_created_by, _upl_updated_by)
            VALUES ($1, $2, $3, $4, $5::jsonb, true, $6, $6)
            ON CONFLICT (metahub_id, package_name)
            WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true
            DO UPDATE SET
	                package_id = EXCLUDED.package_id,
	                expected_version = EXCLUDED.expected_version,
	                config = EXCLUDED.config,
	                is_active = true,
	                _upl_updated_at = now(),
	                _upl_updated_by = EXCLUDED._upl_updated_by,
	                _upl_version = target._upl_version + 1
	            RETURNING id, metahub_id, package_id, package_name, expected_version, config, is_active, _upl_created_at
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
            p.authoring_surface AS "authoringSurface",
            u.config,
            u._upl_created_at AS "attachedAt",
            u.is_active AS "isActive"
         FROM upserted u
         JOIN ${PACKAGES_TABLE} p ON p.id = u.package_id`,
        [
            input.metahubId,
            selectedPackage.id,
            selectedPackage.packageName,
            selectedPackage.version,
            JSON.stringify(nextConfig),
            input.userId
        ]
    )

    const row = rows[0]
    return row ? normalizeAttachmentRow(row) : null
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
	             _upl_updated_by = $3,
	             _upl_version = _upl_version + 1
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
    input: { metahubId: string; attachmentId: string; version: string; userId: string; resetConfig?: boolean }
): Promise<MetahubPackageAttachment | null> {
    const candidates = await exec.query<{
        attachmentId: string
        packageName: string
        config: PackageAttachmentConfig
        currentPackageId: string
        selectedPackageId: string
        selectedVersion: string
        selectedAuthoringSurface: PackageAuthoringSurfaceDescriptor
    }>(
        `SELECT
            a.id AS "attachmentId",
            a.package_name AS "packageName",
            a.config,
            a.package_id AS "currentPackageId",
            p.id AS "selectedPackageId",
            p.version AS "selectedVersion",
            p.authoring_surface AS "selectedAuthoringSurface"
         FROM ${METAHUB_PACKAGES_TABLE} a
         JOIN ${PACKAGES_TABLE} p ON p.package_name = a.package_name
         WHERE a.id = $2
           AND a.metahub_id = $1
           AND a.is_active = true
           AND a._upl_deleted = false
           AND a._app_deleted = false
           AND p.version = $3
           AND ${activePackagePredicate('p')}
         LIMIT 1`,
        [input.metahubId, input.attachmentId, input.version]
    )
    const candidate = candidates[0]
    if (!candidate) {
        return null
    }
    const selectedAuthoringSurface = normalizeAuthoringSurface(candidate.selectedAuthoringSurface)
    const nextConfig =
        input.resetConfig === true
            ? resolveDefaultPackageAttachmentConfig(selectedAuthoringSurface)
            : resolveCompatiblePackageAttachmentConfigOrThrow(candidate.config, selectedAuthoringSurface)

    const rows = await exec.query<AttachmentResultRow>(
        `WITH updated AS (
            UPDATE ${METAHUB_PACKAGES_TABLE} a
            SET package_id = $3,
                expected_version = $4,
	                config = $5::jsonb,
	                _upl_updated_at = now(),
	                _upl_updated_by = $6,
	                _upl_version = a._upl_version + 1
	            WHERE a.id = $2
              AND a.metahub_id = $1
              AND a.is_active = true
              AND a._upl_deleted = false
              AND a._app_deleted = false
              AND a.package_id = $7
            RETURNING a.id, a.metahub_id, a.package_id, a.package_name, a.expected_version, a.config, a.is_active, a._upl_created_at
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
            p.authoring_surface AS "authoringSurface",
            u.config,
            u._upl_created_at AS "attachedAt",
            u.is_active AS "isActive"
         FROM updated u
         JOIN ${PACKAGES_TABLE} p ON p.id = u.package_id`,
        [
            input.metahubId,
            input.attachmentId,
            candidate.selectedPackageId,
            candidate.selectedVersion,
            JSON.stringify(nextConfig),
            input.userId,
            candidate.currentPackageId
        ]
    )

    const row = rows[0]
    return row ? normalizeAttachmentRow(row) : null
}

export async function updateMetahubPackageConfig(
    exec: SqlQueryable,
    input: { metahubId: string; attachmentId: string; config: PackageAttachmentConfig; userId: string; expectedPackageId?: string }
): Promise<MetahubPackageAttachment | null> {
    const rows = await exec.query<AttachmentResultRow>(
        `WITH updated AS (
            UPDATE ${METAHUB_PACKAGES_TABLE} a
	            SET config = $3::jsonb,
	                _upl_updated_at = now(),
	                _upl_updated_by = $4,
	                _upl_version = a._upl_version + 1
	            WHERE a.id = $2
              AND a.metahub_id = $1
              AND a.is_active = true
              AND a._upl_deleted = false
              AND a._app_deleted = false
              AND ($5::uuid IS NULL OR a.package_id = $5::uuid)
            RETURNING a.id, a.metahub_id, a.package_id, a.package_name, a.expected_version, a.config, a.is_active, a._upl_created_at
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
            p.authoring_surface AS "authoringSurface",
            u.config,
            u._upl_created_at AS "attachedAt",
            u.is_active AS "isActive"
         FROM updated u
         JOIN ${PACKAGES_TABLE} p ON p.id = u.package_id`,
        [input.metahubId, input.attachmentId, JSON.stringify(input.config), input.userId, input.expectedPackageId ?? null]
    )

    const row = rows[0]
    return row ? normalizeAttachmentRow(row) : null
}
