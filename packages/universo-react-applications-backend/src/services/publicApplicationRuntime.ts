import {
    applicationAliasRoutingModeSchema,
    applicationPublicRouteResolutionSchema,
    normalizeApplicationAlias,
    type ApplicationAliasRoutingMode,
    type ApplicationPublicRouteResolution
} from '@universo-react/types'
import { isValidSchemaName } from '@universo-react/schema-ddl'
import { isUuidV7, type DbExecutor } from '@universo-react/utils'

const SHA256_RE = /^[0-9a-f]{64}$/iu

export type PublicApplicationUnavailableReason =
    | 'reference_invalid'
    | 'reference_not_found'
    | 'reference_ambiguous'
    | 'application_deleted'
    | 'application_archived'
    | 'application_private'
    | 'application_unpublished'
    | 'schema_invalid'
    | 'schema_status_unavailable'
    | 'materialization_invalid'
    | 'routing_policy_invalid'
    | 'primary_alias_invalid'

export class PublicApplicationUnavailableError extends Error {
    readonly reason: PublicApplicationUnavailableReason

    constructor(reason: PublicApplicationUnavailableReason) {
        super('Public application is not available')
        this.name = 'PublicApplicationUnavailableError'
        this.reason = reason
    }
}

const unavailable = (reason: PublicApplicationUnavailableReason): never => {
    throw new PublicApplicationUnavailableError(reason)
}

type PublicApplicationRef = { kind: 'uuid'; value: string } | { kind: 'alias'; value: string }

export interface PublicRuntimeApplicationRow {
    id: string
    schemaName: string | null
    schemaStatus: string | null
    isPublic: boolean
    workspacesEnabled: boolean
    aliasRoutingMode: string
    installedReleaseMetadata: unknown
    lastSyncedPublicationVersionId: string | null
    uplArchived: boolean
    uplDeleted: boolean
    appPublished: boolean
    appArchived: boolean
    appDeleted: boolean
    hasActiveAlias: boolean
    matchedAlias: string | null
    primaryAlias: string | null
}

export interface ResolvedPublicApplication {
    application: PublicRuntimeApplicationRow & { aliasRoutingMode: ApplicationAliasRoutingMode; schemaName: string }
    route: ApplicationPublicRouteResolution
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const parsePublicApplicationRef = (rawRef: string): PublicApplicationRef => {
    if (!rawRef || rawRef !== rawRef.trim() || rawRef.length > 63) return unavailable('reference_invalid')

    if (isUuidV7(rawRef)) {
        if (rawRef !== rawRef.toLowerCase()) return unavailable('reference_invalid')
        return { kind: 'uuid', value: rawRef }
    }

    try {
        const alias = normalizeApplicationAlias(rawRef)
        if (alias !== rawRef) return unavailable('reference_invalid')
        return { kind: 'alias', value: alias }
    } catch {
        return unavailable('reference_invalid')
    }
}

const readNullableUuidV7 = (value: unknown): string | null | undefined => {
    if (value === null || value === undefined) return null
    return typeof value === 'string' && isUuidV7(value) ? value : undefined
}

/**
 * Verifies that the installed release metadata represents one coherent,
 * immutable materialization. This is intentionally stricter than the frontend
 * "schema exists" heuristic because anonymous runtime must never serve a
 * transitional or partially installed state.
 */
export const hasCoherentInstalledMaterialization = (application: PublicRuntimeApplicationRow): boolean => {
    if (!isRecord(application.installedReleaseMetadata)) return false
    const metadata = application.installedReleaseMetadata
    if (metadata.kind !== 'application_release_installation' || metadata.bundleVersion !== 1) return false
    if (metadata.sourceKind !== 'publication' && metadata.sourceKind !== 'release_bundle') return false
    if (typeof metadata.snapshotHash !== 'string' || !SHA256_RE.test(metadata.snapshotHash)) return false

    const publicationId = readNullableUuidV7(metadata.publicationId)
    const publicationVersionId = readNullableUuidV7(metadata.publicationVersionId)
    const lastSyncedPublicationVersionId = readNullableUuidV7(application.lastSyncedPublicationVersionId)
    if (publicationId === undefined || publicationVersionId === undefined || lastSyncedPublicationVersionId === undefined) return false
    if (Boolean(publicationId) !== Boolean(publicationVersionId)) return false
    if (metadata.sourceKind === 'publication' && (!publicationId || !publicationVersionId)) return false
    if (publicationVersionId !== lastSyncedPublicationVersionId) return false
    return true
}

export const classifyPublicApplicationReadiness = (
    application: PublicRuntimeApplicationRow
): { ready: true } | { ready: false; reason: PublicApplicationUnavailableReason } => {
    if (application.uplDeleted || application.appDeleted) return { ready: false, reason: 'application_deleted' }
    if (application.uplArchived || application.appArchived) return { ready: false, reason: 'application_archived' }
    if (!application.isPublic) return { ready: false, reason: 'application_private' }
    if (!application.appPublished) return { ready: false, reason: 'application_unpublished' }
    if (!application.schemaName || !isValidSchemaName(application.schemaName)) return { ready: false, reason: 'schema_invalid' }

    if (!['synced', 'outdated', 'update_available'].includes(application.schemaStatus ?? '')) {
        return { ready: false, reason: 'schema_status_unavailable' }
    }
    if (!hasCoherentInstalledMaterialization(application)) {
        return { ready: false, reason: 'materialization_invalid' }
    }
    return { ready: true }
}

const APPLICATION_RUNTIME_SELECT = `
    a.id,
    a.schema_name AS "schemaName",
    a.schema_status::text AS "schemaStatus",
    a.is_public AS "isPublic",
    a.workspaces_enabled AS "workspacesEnabled",
    a.alias_routing_mode AS "aliasRoutingMode",
    a.installed_release_metadata AS "installedReleaseMetadata",
    a.last_synced_publication_version_id AS "lastSyncedPublicationVersionId",
    a._upl_archived AS "uplArchived",
    a._upl_deleted AS "uplDeleted",
    a._app_published AS "appPublished",
    a._app_archived AS "appArchived",
    a._app_deleted AS "appDeleted"
`

const selectPublicApplicationByUuid = async (executor: DbExecutor, applicationId: string): Promise<PublicRuntimeApplicationRow[]> =>
    executor.query<PublicRuntimeApplicationRow>(
        `
        SELECT
            ${APPLICATION_RUNTIME_SELECT},
            NULL::text AS "matchedAlias",
            primary_alias.alias AS "primaryAlias",
            EXISTS (
                SELECT 1
                FROM applications.obj_application_aliases active_alias
                WHERE active_alias.application_id = a.id
                  AND active_alias.released_at IS NULL
                  AND active_alias._upl_deleted = false
                  AND active_alias._app_deleted = false
                  AND active_alias._upl_archived = false
                  AND active_alias._app_archived = false
            ) AS "hasActiveAlias"
        FROM applications.obj_applications a
        LEFT JOIN LATERAL (
            SELECT aa.alias
            FROM applications.obj_application_aliases aa
            WHERE aa.application_id = a.id
              AND aa.released_at IS NULL
              AND aa.is_primary = true
              AND aa._upl_deleted = false
              AND aa._app_deleted = false
              AND aa._upl_archived = false
              AND aa._app_archived = false
            ORDER BY aa.id ASC
            LIMIT 2
        ) primary_alias ON true
        WHERE a.id = $1
        LIMIT 2
        `,
        [applicationId]
    )

const selectPublicApplicationByAlias = async (executor: DbExecutor, alias: string): Promise<PublicRuntimeApplicationRow[]> =>
    executor.query<PublicRuntimeApplicationRow>(
        `
        SELECT
            ${APPLICATION_RUNTIME_SELECT},
            matched.alias AS "matchedAlias",
            primary_alias.alias AS "primaryAlias",
            true AS "hasActiveAlias"
        FROM applications.obj_application_aliases matched
        INNER JOIN applications.obj_applications a ON a.id = matched.application_id
        LEFT JOIN LATERAL (
            SELECT aa.alias
            FROM applications.obj_application_aliases aa
            WHERE aa.application_id = a.id
              AND aa.released_at IS NULL
              AND aa.is_primary = true
              AND aa._upl_deleted = false
              AND aa._app_deleted = false
              AND aa._upl_archived = false
              AND aa._app_archived = false
            ORDER BY aa.id ASC
            LIMIT 2
        ) primary_alias ON true
        WHERE matched.alias = $1
          AND matched.released_at IS NULL
          AND matched._upl_deleted = false
          AND matched._app_deleted = false
          AND matched._upl_archived = false
          AND matched._app_archived = false
        LIMIT 2
        `,
        [alias]
    )

export const resolvePublicApplication = async (executor: DbExecutor, rawRef: string): Promise<ResolvedPublicApplication> => {
    const reference = parsePublicApplicationRef(rawRef)
    const rows =
        reference.kind === 'uuid'
            ? await selectPublicApplicationByUuid(executor, reference.value)
            : await selectPublicApplicationByAlias(executor, reference.value)
    if (rows.length === 0) return unavailable('reference_not_found')
    if (rows.length > 1) return unavailable('reference_ambiguous')

    const application = rows[0]
    if (!isUuidV7(application.id)) return unavailable('reference_not_found')
    const readiness = classifyPublicApplicationReadiness(application)
    if (!readiness.ready) return unavailable(readiness.reason)

    const routingMode = applicationAliasRoutingModeSchema.safeParse(application.aliasRoutingMode)
    if (!routingMode.success) return unavailable('routing_policy_invalid')

    const aliasesExist = application.hasActiveAlias
    if (routingMode.data === 'canonical' && aliasesExist && !application.primaryAlias) {
        return unavailable('primary_alias_invalid')
    }

    const canonicalAlias =
        reference.kind === 'alias' &&
        routingMode.data === 'canonical' &&
        application.primaryAlias &&
        application.primaryAlias !== application.matchedAlias
            ? application.primaryAlias
            : null

    const routeCandidate = applicationPublicRouteResolutionSchema.safeParse({
        applicationId: application.id,
        matchedBy: reference.kind,
        matchedAlias: application.matchedAlias,
        routingMode: routingMode.data,
        primaryAlias: application.primaryAlias,
        canonicalAlias
    })
    if (!routeCandidate.success) return unavailable('routing_policy_invalid')

    const route = routeCandidate.data

    return {
        application: {
            ...application,
            aliasRoutingMode: routingMode.data,
            schemaName: application.schemaName!
        },
        route
    }
}
