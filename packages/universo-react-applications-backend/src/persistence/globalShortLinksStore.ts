import { qSchemaTable } from '@universo-react/database'
import type { GlobalShortLinkCreateInput, GlobalShortLinkRecord, GlobalShortLinkTarget } from '@universo-react/types'
import { globalShortLinkCreateInputSchema, globalShortLinkRecordSchema, globalShortLinkTargetSchema } from '@universo-react/types'
import { generateUuidV7, isValidUuid, isUuidV7, type SqlQueryable } from '@universo-react/utils'

const GLOBAL_SHORT_LINKS_TABLE = qSchemaTable('applications', 'obj_global_short_links')

const GLOBAL_SHORT_LINK_RETURNING = `
    id,
    slug,
    target_kind AS "targetKind",
    application_id AS "applicationId",
    section_key AS "sectionKey",
    access_link_id AS "accessLinkId",
    access_link_slug AS "accessLinkSlug",
    access_link_workspace_id AS "workspaceId",
    resource_target_kind AS "resourceTargetKind",
    entity_type_codename AS "entityTypeCodename",
    released_at AS "releasedAt",
    _upl_created_at AS "createdAt",
    _upl_updated_at AS "updatedAt"
`

interface GlobalShortLinkDatabaseRow {
    id: string
    slug: string
    targetKind: string
    applicationId: string
    sectionKey: string | null
    accessLinkId: string | null
    accessLinkSlug: string | null
    workspaceId: string | null
    resourceTargetKind: string | null
    entityTypeCodename: string | null
    releasedAt: Date | string | null
    createdAt: Date | string
    updatedAt: Date | string
}

interface GlobalShortLinkResolvedRow {
    targetKind: string
    applicationId: string
    sectionKey: string | null
    accessLinkId: string | null
    accessLinkSlug: string | null
    workspaceId: string | null
    resourceTargetKind: string | null
    entityTypeCodename: string | null
}

type GlobalShortLinkTargetKind = GlobalShortLinkTarget['kind']
type GlobalShortLinkTargetColumns = Pick<
    GlobalShortLinkDatabaseRow,
    'sectionKey' | 'accessLinkId' | 'accessLinkSlug' | 'workspaceId' | 'resourceTargetKind' | 'entityTypeCodename'
>

export interface ListGlobalShortLinksInput {
    applicationId: string
    includeReleased?: boolean
    limit: number
    offset: number
}

const asIsoDate = (value: Date | string): string => (value instanceof Date ? value : new Date(value)).toISOString()

const assertUuidV7 = (value: string, label: string): void => {
    if (!isUuidV7(value)) throw new TypeError(`${label} must be a UUID v7`)
}

const assertUuid = (value: string, label: string): void => {
    if (!isValidUuid(value)) throw new TypeError(`${label} must be a UUID`)
}

const targetBuildersByKind = {
    'application-entry': (row: GlobalShortLinkResolvedRow) => ({ kind: row.targetKind, applicationId: row.applicationId }),
    'application-section': (row: GlobalShortLinkResolvedRow) => ({
        kind: row.targetKind,
        applicationId: row.applicationId,
        section: row.sectionKey
    }),
    'lms-access-link': (row: GlobalShortLinkResolvedRow) => ({
        kind: row.targetKind,
        applicationId: row.applicationId,
        accessLinkId: row.accessLinkId,
        accessLinkSlug: row.accessLinkSlug,
        workspaceId: row.workspaceId
    }),
    'application-resource': (row: GlobalShortLinkResolvedRow) => ({
        kind: row.targetKind,
        applicationId: row.applicationId,
        targetKind: row.resourceTargetKind,
        entityTypeCodename: row.entityTypeCodename
    })
} satisfies Record<GlobalShortLinkTargetKind, (row: GlobalShortLinkResolvedRow) => unknown>

const targetFromDatabaseRow = (row: GlobalShortLinkResolvedRow): GlobalShortLinkTarget => {
    if (!Object.prototype.hasOwnProperty.call(targetBuildersByKind, row.targetKind)) {
        throw new TypeError(`Unsupported persisted global short-link target kind: ${row.targetKind}`)
    }

    const targetBuilder = targetBuildersByKind[row.targetKind as GlobalShortLinkTargetKind]
    return globalShortLinkTargetSchema.parse(targetBuilder(row))
}

const toRecord = (row: GlobalShortLinkDatabaseRow): GlobalShortLinkRecord =>
    globalShortLinkRecordSchema.parse({
        id: row.id,
        slug: row.slug,
        target: targetFromDatabaseRow(row),
        releasedAt: row.releasedAt === null ? null : asIsoDate(row.releasedAt),
        createdAt: asIsoDate(row.createdAt),
        updatedAt: asIsoDate(row.updatedAt)
    })

const targetColumnResolvers: Record<GlobalShortLinkTargetKind, (target: GlobalShortLinkTarget) => GlobalShortLinkTargetColumns> = {
    'application-entry': () => ({
        sectionKey: null,
        accessLinkId: null,
        accessLinkSlug: null,
        workspaceId: null,
        resourceTargetKind: null,
        entityTypeCodename: null
    }),
    'application-section': (target) => {
        if (target.kind !== 'application-section') throw new TypeError('Global short-link target adapter mismatch')
        return {
            sectionKey: target.section,
            accessLinkId: null,
            accessLinkSlug: null,
            workspaceId: null,
            resourceTargetKind: null,
            entityTypeCodename: null
        }
    },
    'lms-access-link': (target) => {
        if (target.kind !== 'lms-access-link') throw new TypeError('Global short-link target adapter mismatch')
        return {
            sectionKey: null,
            accessLinkId: target.accessLinkId,
            accessLinkSlug: target.accessLinkSlug,
            workspaceId: target.workspaceId,
            resourceTargetKind: null,
            entityTypeCodename: null
        }
    },
    'application-resource': (target) => {
        if (target.kind !== 'application-resource') throw new TypeError('Global short-link target adapter mismatch')
        return {
            sectionKey: null,
            accessLinkId: null,
            accessLinkSlug: null,
            workspaceId: null,
            resourceTargetKind: target.targetKind,
            entityTypeCodename: target.entityTypeCodename
        }
    }
}

const targetColumns = (target: GlobalShortLinkTarget): GlobalShortLinkTargetColumns => targetColumnResolvers[target.kind](target)

/** Locks a live target application so link creation is serialized with application deletion. */
export async function lockActiveGlobalShortLinkApplication(executor: SqlQueryable, applicationId: string): Promise<boolean> {
    assertUuidV7(applicationId, 'applicationId')

    const rows = await executor.query<{ locked: boolean }>(
        `
        SELECT applications.lock_active_global_short_link_application($1) AS locked
        `,
        [applicationId]
    )

    return rows[0]?.locked === true
}

/** Releases all active links in the same transaction as their application's soft deletion. */
export async function releaseActiveGlobalShortLinksForApplication(
    executor: SqlQueryable,
    applicationId: string,
    actorUserId: string | null
): Promise<void> {
    assertUuidV7(applicationId, 'applicationId')

    await executor.query(
        `
        UPDATE ${GLOBAL_SHORT_LINKS_TABLE}
        SET released_at = now(),
            released_by = $2,
            _upl_updated_at = now(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE application_id = $1
          AND released_at IS NULL
          AND _upl_archived = false
          AND _upl_deleted = false
          AND _app_archived = false
          AND _app_deleted = false
        `,
        [applicationId, actorUserId]
    )
}

/** Releases quiz URLs in the same transaction as their AccessLink deletion. */
export async function releaseActiveGlobalShortLinksForAccessLink(
    executor: SqlQueryable,
    applicationId: string,
    accessLinkId: string,
    actorUserId: string
): Promise<void> {
    assertUuidV7(applicationId, 'applicationId')
    assertUuidV7(accessLinkId, 'accessLinkId')
    assertUuid(actorUserId, 'actorUserId')

    await executor.query(
        `
        UPDATE ${GLOBAL_SHORT_LINKS_TABLE}
        SET released_at = now(),
            released_by = $3,
            _upl_updated_at = now(),
            _upl_updated_by = $3,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE application_id = $1
          AND target_kind = 'lms-access-link'
          AND access_link_id = $2
          AND released_at IS NULL
          AND _upl_archived = false
          AND _upl_deleted = false
          AND _app_archived = false
          AND _app_deleted = false
        `,
        [applicationId, accessLinkId, actorUserId]
    )
}

/** Releases LMS URLs for an archived workspace without deleting their reporting data. */
export async function releaseActiveGlobalShortLinksForWorkspace(
    executor: SqlQueryable,
    applicationId: string,
    workspaceId: string,
    actorUserId: string
): Promise<number> {
    assertUuidV7(applicationId, 'applicationId')
    assertUuidV7(workspaceId, 'workspaceId')
    assertUuid(actorUserId, 'actorUserId')

    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${GLOBAL_SHORT_LINKS_TABLE}
        SET released_at = now(),
            released_by = $3,
            _upl_updated_at = now(),
            _upl_updated_by = $3,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE application_id = $1
          AND target_kind = 'lms-access-link'
          AND access_link_workspace_id = $2
          AND released_at IS NULL
          AND _upl_archived = false
          AND _upl_deleted = false
          AND _app_archived = false
          AND _app_deleted = false
        RETURNING id
        `,
        [applicationId, workspaceId, actorUserId]
    )

    return rows.length
}

/** Returns null when another unreleased active link already owns the normalized slug. */
export async function createGlobalShortLink(
    executor: SqlQueryable,
    input: GlobalShortLinkCreateInput,
    actorUserId: string
): Promise<GlobalShortLinkRecord | null> {
    const parsed = globalShortLinkCreateInputSchema.parse(input)
    assertUuid(actorUserId, 'actorUserId')
    const id = generateUuidV7()
    const columns = targetColumns(parsed.target)

    const rows = await executor.query<GlobalShortLinkDatabaseRow>(
        `
        INSERT INTO ${GLOBAL_SHORT_LINKS_TABLE} (
            id, slug, target_kind, application_id, section_key, access_link_id, access_link_slug, access_link_workspace_id,
            resource_target_kind, entity_type_codename,
            _upl_created_by, _upl_updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        ON CONFLICT (slug)
            WHERE released_at IS NULL
              AND _upl_archived = false
              AND _upl_deleted = false
              AND _app_archived = false
              AND _app_deleted = false
        DO NOTHING
        RETURNING ${GLOBAL_SHORT_LINK_RETURNING}
        `,
        [
            id,
            parsed.slug,
            parsed.target.kind,
            parsed.target.applicationId,
            columns.sectionKey,
            columns.accessLinkId,
            columns.accessLinkSlug,
            columns.workspaceId,
            columns.resourceTargetKind,
            columns.entityTypeCodename,
            actorUserId
        ]
    )

    return rows[0] ? toRecord(rows[0]) : null
}

/** Resolves only unreleased, active slugs through the restricted SQL resolver. */
export async function findActiveGlobalShortLinkTarget(executor: SqlQueryable, inputSlug: string): Promise<GlobalShortLinkTarget | null> {
    const rows = await executor.query<GlobalShortLinkResolvedRow>(
        `
        SELECT
            target_kind AS "targetKind",
            application_id AS "applicationId",
            section_key AS "sectionKey",
            access_link_id AS "accessLinkId",
            access_link_slug AS "accessLinkSlug",
            access_link_workspace_id AS "workspaceId",
            resource_target_kind AS "resourceTargetKind",
            entity_type_codename AS "entityTypeCodename"
        FROM applications.resolve_global_short_link($1)
        `,
        [globalShortLinkRecordSchema.shape.slug.parse(inputSlug)]
    )

    return rows[0] ? targetFromDatabaseRow(rows[0]) : null
}

/** Finds an active link's application only when the caller can read that application-scoped row. */
export async function findActiveGlobalShortLinkApplicationId(executor: SqlQueryable, linkId: string): Promise<string | null> {
    assertUuidV7(linkId, 'linkId')

    const rows = await executor.query<{ applicationId: string }>(
        `
        SELECT application_id AS "applicationId"
        FROM ${GLOBAL_SHORT_LINKS_TABLE}
        WHERE id = $1
          AND released_at IS NULL
          AND _upl_archived = false
          AND _upl_deleted = false
          AND _app_archived = false
          AND _app_deleted = false
        LIMIT 1
        `,
        [linkId]
    )

    return rows[0]?.applicationId ?? null
}

/** Lists active, non-deleted links with parameterized application and lifecycle filters. */
export async function listGlobalShortLinks(executor: SqlQueryable, input: ListGlobalShortLinksInput): Promise<GlobalShortLinkRecord[]> {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
        throw new RangeError('limit must be an integer between 1 and 100')
    }
    if (!Number.isSafeInteger(input.offset) || input.offset < 0) throw new RangeError('offset must be a non-negative integer')
    assertUuidV7(input.applicationId, 'applicationId')

    const conditions = ['_upl_archived = false', '_upl_deleted = false', '_app_archived = false', '_app_deleted = false']
    const parameters: unknown[] = []

    if (!input.includeReleased) conditions.push('released_at IS NULL')
    parameters.push(input.applicationId)
    conditions.push(`application_id = $${parameters.length}`)

    parameters.push(input.limit)
    const limitPlaceholder = `$${parameters.length}`
    parameters.push(input.offset)
    const offsetPlaceholder = `$${parameters.length}`

    const rows = await executor.query<GlobalShortLinkDatabaseRow>(
        `
        SELECT ${GLOBAL_SHORT_LINK_RETURNING}
        FROM ${GLOBAL_SHORT_LINKS_TABLE}
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY _upl_created_at DESC, id ASC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
        `,
        parameters
    )

    return rows.map(toRecord)
}

/** Releases an active slug atomically; a missing or already released row returns null. */
export async function releaseGlobalShortLink(
    executor: SqlQueryable,
    linkId: string,
    applicationId: string,
    actorUserId: string
): Promise<GlobalShortLinkRecord | null> {
    assertUuidV7(linkId, 'linkId')
    assertUuidV7(applicationId, 'applicationId')
    assertUuid(actorUserId, 'actorUserId')

    const rows = await executor.query<GlobalShortLinkDatabaseRow>(
        `
        UPDATE ${GLOBAL_SHORT_LINKS_TABLE}
        SET released_at = now(),
            released_by = $3,
            _upl_updated_at = now(),
            _upl_updated_by = $3,
            _upl_version = _upl_version + 1
        WHERE id = $1
          AND application_id = $2
          AND released_at IS NULL
          AND _upl_archived = false
          AND _upl_deleted = false
          AND _app_archived = false
          AND _app_deleted = false
        RETURNING ${GLOBAL_SHORT_LINK_RETURNING}
        `,
        [linkId, applicationId, actorUserId]
    )

    return rows[0] ? toRecord(rows[0]) : null
}
