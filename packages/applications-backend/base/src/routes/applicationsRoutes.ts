import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { isSuperuser as isSuperuserCheck, getGlobalRoleCodename, hasSubjectPermission } from '@universo/admin-backend'
import { generateSchemaName, isValidSchemaName, generateChildTableName } from '@universo/schema-ddl'
import { ApplicationSchemaStatus } from '../persistence/contracts'
import { ensureApplicationAccess, ROLE_PERMISSIONS, assertNotOwner } from './guards'
import type { ApplicationRole, RolePermission } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { getVLCString } from '@universo/utils/vlc'
import { ApplicationMembershipState, type ApplicationLifecycleContract, type VersionedLocalizedContent } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import {
    database,
    normalizeApplicationCopyOptions,
    OptimisticLockError,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig
} from '@universo/utils'
import { escapeLikeWildcards, getRequestDbExecutor, getRequestDbSession } from '../utils'
import {
    type ApplicationMemberRecord,
    copyApplicationWithOptions,
    createApplicationWithOwner,
    deleteApplicationMember,
    deleteApplicationWithSchema,
    findApplicationBySlug,
    findApplicationCopySource,
    findApplicationDetails,
    findApplicationMemberById,
    findApplicationMemberByUserId,
    findApplicationSchemaInfo,
    findAuthUserByEmail,
    insertApplicationMember,
    listApplicationMembers,
    listApplications,
    updateApplicationMember,
    updateApplication
} from '../persistence/applicationsStore'
import {
    archivePersonalWorkspaceForUser,
    enforceCatalogWorkspaceLimit,
    getCatalogWorkspaceLimit,
    ensurePersonalWorkspaceForUser,
    getCatalogWorkspaceUsage,
    listCatalogWorkspaceLimits,
    resolveRuntimeWorkspaceAccess,
    runtimeWorkspaceTablesExist,
    setRuntimeWorkspaceContext,
    upsertCatalogWorkspaceLimits
} from '../services/applicationWorkspaces'

/**
 * Thrown inside `executor.transaction()` callbacks to signal a business-logic
 * failure that should trigger transaction rollback and a specific HTTP response.
 */
class UpdateFailure extends Error {
    constructor(public readonly statusCode: number, public readonly body: Record<string, unknown>) {
        super('Update failed')
    }
}

const NO_APPLICATION_PERMISSIONS: Record<RolePermission, boolean> = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false
}

interface RequestUser {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as Request & { user?: RequestUser }).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const quoteIdentifier = (identifier: string): string => {
    if (!IDENTIFIER_REGEX.test(identifier)) {
        throw new Error(`Unsafe identifier: ${identifier}`)
    }
    return `"${identifier}"`
}

const quoteUuidLiteral = (value: string): string => {
    if (!UUID_REGEX.test(value)) {
        throw new Error(`Unsafe UUID literal: ${value}`)
    }
    return `'${value.toLowerCase()}'::uuid`
}

const normalizeLocale = (locale?: string): string => {
    if (!locale) return 'en'
    return locale.split('-')[0].split('_')[0].toLowerCase()
}

const resolvePresentationLocalizedField = (presentation: unknown, field: 'name' | 'codename', locale: string, fallback: string): string => {
    if (!presentation || typeof presentation !== 'object') return fallback

    const presentationObj = presentation as {
        name?: {
            _primary?: string
            locales?: Record<string, { content?: string }>
        }
        codename?: {
            _primary?: string
            locales?: Record<string, { content?: string }>
        }
    }

    const localizedField = presentationObj[field]
    const locales = localizedField?.locales
    if (!locales || typeof locales !== 'object') return fallback

    const normalized = normalizeLocale(locale)
    const direct = locales[normalized]?.content
    if (typeof direct === 'string' && direct.trim().length > 0) return direct

    const primary = localizedField?._primary
    const primaryValue = primary ? locales[primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.trim().length > 0) return primaryValue

    const first = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    return first?.content ?? fallback
}

const resolvePresentationName = (presentation: unknown, locale: string, fallback: string): string =>
    resolvePresentationLocalizedField(presentation, 'name', locale, fallback)

const resolvePresentationCodename = (presentation: unknown, locale: string, fallback: string): string =>
    resolvePresentationLocalizedField(presentation, 'codename', locale, fallback)

const resolveLocalizedContent = (value: unknown, locale: string, fallback: string): string => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : fallback
    }

    if (value && typeof value === 'object') {
        const normalizedLocale = normalizeLocale(locale)
        const localized = getVLCString(value as Record<string, unknown>, normalizedLocale)
        if (localized && localized.trim().length > 0) {
            return localized
        }

        const plain = value as Record<string, unknown>
        const direct = plain[normalizedLocale]
        if (typeof direct === 'string' && direct.trim().length > 0) {
            return direct
        }
        const en = plain.en
        if (typeof en === 'string' && en.trim().length > 0) {
            return en
        }
    }

    return fallback
}

type RuntimeDataType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'DATE' | 'REF' | 'JSON' | 'TABLE'
type RuntimeRefOption = {
    id: string
    label: string
    codename?: string
    isDefault?: boolean
    sortOrder?: number
}

/**
 * pg returns NUMERIC columns as strings to avoid JS floating-point precision loss.
 * This helper coerces such values back to JS numbers for API responses.
 */
const pgNumericToNumber = (value: unknown): unknown => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const num = Number(value)
        return Number.isFinite(num) ? num : value
    }
    return value
}

const resolveRuntimeValue = (value: unknown, dataType: RuntimeDataType, locale: string): unknown => {
    if (value === null || value === undefined) {
        // BOOLEAN null → false for correct checkbox rendering (no indeterminate state)
        return dataType === 'BOOLEAN' ? false : null
    }

    if (dataType === 'STRING') {
        if (typeof value === 'string') return value
        if (typeof value === 'object') {
            const localized = getVLCString(value as Record<string, unknown>, locale)
            if (localized) return localized
            try {
                return JSON.stringify(value)
            } catch {
                return ''
            }
        }
        return String(value)
    }

    // NUMBER: pg returns NUMERIC as string — coerce to JS number
    if (dataType === 'NUMBER') return pgNumericToNumber(value)

    // BOOLEAN, DATE, REF, JSON — return as-is
    return value
}

const isSoftDeleteLifecycle = (contract: ApplicationLifecycleContract): boolean => contract.delete.mode === 'soft'

const buildRuntimeActiveRowCondition = (
    contract: ApplicationLifecycleContract,
    platformConfig?: unknown,
    alias?: string,
    workspaceId?: string | null
): string => {
    const prefix = alias ? `${alias}.` : ''
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)
    const clauses: string[] = []

    if (platformContract.delete.enabled) {
        clauses.push(`${prefix}_upl_deleted = false`)
    }

    if (isSoftDeleteLifecycle(contract)) {
        clauses.push(`${prefix}_app_deleted = false`)
    }

    if (workspaceId) {
        clauses.push(`${prefix}workspace_id = ${quoteUuidLiteral(workspaceId)}`)
    }

    return clauses.length > 0 ? clauses.join(' AND ') : 'TRUE'
}

const buildRuntimeSoftDeleteSetClause = (
    deletedByParam: string,
    contract: ApplicationLifecycleContract,
    platformConfig?: unknown
): string => {
    if (!isSoftDeleteLifecycle(contract)) {
        throw new Error('Soft delete clause requested for hard-delete lifecycle')
    }

    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)
    const clauses = ['_upl_updated_at = now()', `_upl_updated_by = ${deletedByParam}`, '_app_deleted = true']

    if (platformContract.delete.enabled) {
        clauses.unshift('_upl_deleted = true')
        if (platformContract.delete.trackAt) {
            clauses.push('_upl_deleted_at = now()')
        }
        if (platformContract.delete.trackBy) {
            clauses.push(`_upl_deleted_by = ${deletedByParam}`)
        }
    }

    if (contract.delete.trackAt) {
        clauses.push('_app_deleted_at = now()')
    }
    if (contract.delete.trackBy) {
        clauses.push(`_app_deleted_by = ${deletedByParam}`)
    }

    return clauses.join(', ')
}

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocale(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return {
            en: 'Copy (copy)'
        }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

const hasGlobalApplicationAdminAccess = async (executor: DbExecutor, userId: string): Promise<boolean> => {
    const [canUpdate, canDelete] = await Promise.all([
        hasSubjectPermission(executor, userId, 'applications', 'update'),
        hasSubjectPermission(executor, userId, 'applications', 'delete')
    ])

    return canUpdate || canDelete
}

const buildCopiedApplicationSlugCandidate = (sourceSlug: string, attempt: number): string => {
    const copySuffix = '-copy'
    const maxBaseLength = Math.max(1, 100 - copySuffix.length)
    const baseSlug = `${sourceSlug.slice(0, maxBaseLength)}${copySuffix}`
    const attemptSuffix = attempt <= 1 ? '' : `-${attempt}`
    const maxSlugLength = Math.max(1, 100 - attemptSuffix.length)
    return `${baseSlug.slice(0, maxSlugLength)}${attemptSuffix}`
}

export function createApplicationsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const query = <TRow = unknown>(req: Request, sql: string, parameters: unknown[] = []): Promise<TRow[]> => {
        const session = getRequestDbSession(req)
        if (session && !session.isReleased()) {
            return session.query<TRow>(sql, parameters)
        }

        return getDbExecutor().query<TRow>(sql, parameters)
    }

    const isCommentVlc = (value: unknown): value is VersionedLocalizedContent<string> =>
        Boolean(value && typeof value === 'object' && 'locales' in value && '_primary' in value)

    const resolveLocalizedCommentText = (commentValue: unknown): string | undefined => {
        if (typeof commentValue === 'string') {
            const trimmed = commentValue.trim()
            return trimmed.length > 0 ? trimmed : undefined
        }
        if (!isCommentVlc(commentValue)) return undefined

        const primary = commentValue._primary
        const primaryContent = commentValue.locales[primary]?.content
        if (typeof primaryContent === 'string' && primaryContent.trim().length > 0) {
            return primaryContent.trim()
        }

        for (const entry of Object.values(commentValue.locales) as Array<{ content?: string }>) {
            if (typeof entry?.content === 'string' && entry.content.trim().length > 0) {
                return entry.content.trim()
            }
        }

        return undefined
    }

    const normalizeCommentVlcOutput = (commentValue: unknown): VersionedLocalizedContent<string> | null =>
        isCommentVlc(commentValue) ? commentValue : null

    const normalizeMemberCommentInput = (
        comment: Record<string, string | undefined> | null | undefined,
        primaryLocale?: string
    ): { commentVlc: VersionedLocalizedContent<string> | null; error?: string } => {
        if (comment === null) {
            return { commentVlc: null }
        }

        const sanitized = sanitizeLocalizedInput(comment ?? {})
        for (const value of Object.values(sanitized)) {
            if (value.length > 500) {
                return { commentVlc: null, error: 'Comment must be 500 characters or less' }
            }
        }

        const commentVlc = buildLocalizedContent(sanitized, primaryLocale, 'en')
        return { commentVlc: commentVlc ?? null }
    }

    const memberCommentInputSchema = z
        .union([z.string(), z.record(z.string(), z.string().optional())])
        .transform((value) => (typeof value === 'string' ? { en: value } : value))

    const mapMember = (member: ApplicationMemberRecord) => ({
        id: member.id,
        userId: member.userId,
        email: member.email,
        nickname: member.nickname,
        role: (member.role || 'member') as ApplicationRole,
        comment: resolveLocalizedCommentText(member.comment),
        commentVlc: normalizeCommentVlcOutput(member.comment),
        createdAt: member.createdAt
    })

    const runtimeQuerySchema = z.object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        locale: z.string().min(2).max(10).optional().default('en'),
        catalogId: z.string().uuid().optional()
    })

    // ============ LIST APPLICATIONS ============
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const ds = getRequestDbExecutor(req, getDbExecutor())

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }
            const { limit, offset, sortBy, sortOrder, search, showAll } = validatedQuery

            const isSuperuser = await isSuperuserCheck(ds, userId)
            const hasGlobalApplicationsReadAccess = await hasSubjectPermission(ds, userId, 'applications', 'read')
            const hasGlobalApplicationsAdminAccess = isSuperuser ? true : await hasGlobalApplicationAdminAccess(ds, userId)
            const escapedSearch = search ? escapeLikeWildcards(search) : undefined
            const { items: applications, total } = await listApplications(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                {
                    userId,
                    showAll: showAll && (isSuperuser || hasGlobalApplicationsReadAccess),
                    limit,
                    offset,
                    sortBy: sortBy === 'name' || sortBy === 'created' || sortBy === 'updated' ? sortBy : 'updated',
                    sortOrder,
                    search: escapedSearch
                }
            )

            const elevatedGlobalRoleName = hasGlobalApplicationsAdminAccess ? await getGlobalRoleCodename(ds, userId) : null

            const result = applications.map((a) => {
                const membershipState = a.membershipRole ? ApplicationMembershipState.JOINED : ApplicationMembershipState.NOT_JOINED
                const role = a.membershipRole ? (a.membershipRole as ApplicationRole) : elevatedGlobalRoleName ? 'owner' : null
                const accessType = a.membershipRole
                    ? 'member'
                    : elevatedGlobalRoleName
                    ? isSuperuser
                        ? 'superadmin'
                        : 'supermoderator'
                    : 'public'
                const permissions = role ? ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member : NO_APPLICATION_PERMISSIONS

                return {
                    id: a.id,
                    name: a.name,
                    description: a.description,
                    slug: a.slug,
                    isPublic: a.isPublic,
                    workspacesEnabled: a.workspacesEnabled,
                    version: a.version || 1,
                    createdAt: a.createdAt,
                    updatedAt: a.updatedAt,
                    connectorsCount: a.connectorsCount ?? 0,
                    membersCount: a.membersCount ?? 0,
                    role,
                    accessType,
                    permissions,
                    membershipState,
                    canJoin: membershipState === ApplicationMembershipState.NOT_JOINED && a.isPublic === true && !elevatedGlobalRoleName,
                    canLeave: membershipState === ApplicationMembershipState.JOINED && role !== 'owner'
                }
            })

            return res.json({ items: result, total, limit, offset })
        })
    )

    // ============ GET SINGLE APPLICATION ============
    router.get(
        '/:applicationId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            const ctx = await ensureApplicationAccess(ds, userId, applicationId)

            const application = await findApplicationDetails(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (!application) return res.status(404).json({ error: 'Application not found' })

            const role = ctx.membership.role as ApplicationRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: application.id,
                name: application.name,
                description: application.description,
                slug: application.slug,
                isPublic: application.isPublic,
                workspacesEnabled: application.workspacesEnabled,
                version: application.version || 1,
                createdAt: application.createdAt,
                updatedAt: application.updatedAt,
                schemaName: application.schemaName,
                schemaStatus: application.schemaStatus,
                schemaSyncedAt: application.schemaSyncedAt,
                schemaError: application.schemaError,
                connectorsCount: application.connectorsCount,
                membersCount: application.membersCount,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions,
                membershipState: ApplicationMembershipState.JOINED,
                canJoin: false,
                canLeave: role !== 'owner'
            })
        })
    )

    // ============ APPLICATION RUNTIME TABLE (SINGLE CATALOG MVP) ============
    router.get(
        '/:applicationId/runtime',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            if (!UUID_REGEX.test(applicationId)) return res.status(400).json({ error: 'Invalid application ID format' })

            const parsedQuery = runtimeQuerySchema.safeParse(req.query)
            if (!parsedQuery.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
            }

            const { limit, offset, locale } = parsedQuery.data
            const requestedLocale = normalizeLocale(locale)
            const requestedCatalogId = parsedQuery.data.catalogId ?? null
            const runtimeContext = await resolveRuntimeSchema(req, res, applicationId)
            if (!runtimeContext) return

            const { schemaName, schemaIdent } = runtimeContext
            const manager = runtimeContext.manager
            const currentWorkspaceId = runtimeContext.currentWorkspaceId

            const catalogs = await manager.query(
                `
                                        SELECT id, codename, table_name, presentation, config
                    FROM ${schemaIdent}._app_objects
                    WHERE kind = 'catalog'
                      AND _upl_deleted = false
                      AND _app_deleted = false
                    ORDER BY codename ASC
                `
            )

            if (catalogs.length === 0) {
                return res.status(404).json({ error: 'No catalogs available in application runtime schema' })
            }

            const typedCatalogs = catalogs as Array<{
                id: string
                codename: string
                table_name: string
                presentation?: unknown
                config?: Record<string, unknown> | null
            }>

            const runtimeCatalogs = typedCatalogs.map((catalogRow) => ({
                ...catalogRow,
                lifecycleContract: resolveApplicationLifecycleContractFromConfig(catalogRow.config)
            }))

            let preferredCatalogIdFromMenu: string | null = null
            if (!requestedCatalogId) {
                try {
                    const [{ layoutsExists, widgetsExists }] = (await manager.query(
                        `
                            SELECT
                                EXISTS (
                                    SELECT 1 FROM information_schema.tables
                                    WHERE table_schema = $1 AND table_name = '_app_layouts'
                                ) AS "layoutsExists",
                                EXISTS (
                                    SELECT 1 FROM information_schema.tables
                                    WHERE table_schema = $1 AND table_name = '_app_widgets'
                                ) AS "widgetsExists"
                        `,
                        [schemaName]
                    )) as Array<{ layoutsExists: boolean; widgetsExists: boolean }>

                    if (layoutsExists && widgetsExists) {
                        const defaultLayoutRows = (await manager.query(
                            `
                                SELECT id
                                FROM ${schemaIdent}._app_layouts
                                WHERE (is_default = true OR is_active = true)
                                  AND _upl_deleted = false
                                  AND _app_deleted = false
                                ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
                                LIMIT 1
                            `
                        )) as Array<{ id: string }>
                        const activeLayoutId = defaultLayoutRows[0]?.id

                        if (activeLayoutId) {
                            const menuWidgets = (await manager.query(
                                `
                                    SELECT config
                                    FROM ${schemaIdent}._app_widgets
                                    WHERE layout_id = $1
                                      AND zone = 'left'
                                      AND widget_key = 'menuWidget'
                                      AND _upl_deleted = false
                                      AND _app_deleted = false
                                    ORDER BY sort_order ASC, _upl_created_at ASC
                                `,
                                [activeLayoutId]
                            )) as Array<{ config?: unknown }>

                            const boundMenuConfig = menuWidgets
                                .map((row) =>
                                    row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : null
                                )
                                .find((cfg) => Boolean(cfg?.bindToHub) && typeof cfg?.boundHubId === 'string')

                            const boundHubId = typeof boundMenuConfig?.boundHubId === 'string' ? boundMenuConfig.boundHubId : null
                            if (boundHubId) {
                                const preferredCatalogRows = (await manager.query(
                                    `
                                        SELECT id
                                        FROM ${schemaIdent}._app_objects
                                        WHERE kind = 'catalog'
                                          AND _upl_deleted = false
                                          AND _app_deleted = false
                                          AND config->'hubs' @> $1::jsonb
                                        ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC, codename ASC
                                        LIMIT 1
                                    `,
                                    [JSON.stringify([boundHubId])]
                                )) as Array<{ id: string }>
                                preferredCatalogIdFromMenu = preferredCatalogRows[0]?.id ?? null
                            }
                        }
                    }
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn('[ApplicationsRuntime] Failed to resolve preferred startup catalog from menu binding (ignored)', e)
                }
            }

            const activeCatalog =
                (requestedCatalogId ? runtimeCatalogs.find((catalogRow) => catalogRow.id === requestedCatalogId) : undefined) ??
                (preferredCatalogIdFromMenu
                    ? runtimeCatalogs.find((catalogRow) => catalogRow.id === preferredCatalogIdFromMenu)
                    : undefined) ??
                runtimeCatalogs[0]
            if (!activeCatalog) {
                return res
                    .status(404)
                    .json({ error: 'Requested catalog not found in runtime schema', details: { catalogId: requestedCatalogId } })
            }

            if (!IDENTIFIER_REGEX.test(activeCatalog.table_name)) {
                return res.status(400).json({ error: 'Invalid runtime table name' })
            }

            const attributes = (await manager.query(
                `
                    SELECT id, codename, column_name, data_type, is_required, is_display_attribute,
                           presentation, validation_rules, sort_order, ui_config,
                           target_object_id, target_object_kind
                    FROM ${schemaIdent}._app_attributes
                    WHERE object_id = $1
                      AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE')
                      AND parent_attribute_id IS NULL
                      AND _upl_deleted = false
                      AND _app_deleted = false
                    ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
                `,
                [activeCatalog.id]
            )) as Array<{
                id: string
                codename: string
                column_name: string
                data_type: RuntimeDataType
                is_required: boolean
                is_display_attribute?: boolean
                presentation?: unknown
                validation_rules?: Record<string, unknown>
                sort_order?: number
                ui_config?: Record<string, unknown>
                target_object_id?: string | null
                target_object_kind?: string | null
            }>

            const safeAttributes = attributes.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name))

            // Separate physical (non-TABLE) attributes from virtual TABLE attributes
            const physicalAttributes = safeAttributes.filter((a) => a.data_type !== 'TABLE')

            // Fetch child attributes for TABLE-type attributes
            const tableAttrs = safeAttributes.filter((a) => a.data_type === 'TABLE')
            const childAttrsByTableId = new Map<string, typeof attributes>()
            if (tableAttrs.length > 0) {
                const tableAttrIds = tableAttrs.map((a) => a.id)
                const childAttrs = (await manager.query(
                    `
                        SELECT id, codename, column_name, data_type, is_required, is_display_attribute,
                               presentation, validation_rules, sort_order, ui_config,
                               target_object_id, target_object_kind, parent_attribute_id
                        FROM ${schemaIdent}._app_attributes
                        WHERE parent_attribute_id = ANY($1::uuid[])
                          AND _upl_deleted = false
                          AND _app_deleted = false
                        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
                    `,
                    [tableAttrIds]
                )) as Array<(typeof attributes)[number] & { parent_attribute_id: string }>

                for (const child of childAttrs) {
                    const list = childAttrsByTableId.get(child.parent_attribute_id) ?? []
                    list.push(child)
                    childAttrsByTableId.set(child.parent_attribute_id, list)
                }
            }

            // Collect all child attributes (across all TABLE attributes) for REF target resolution
            const allChildAttributes = Array.from(childAttrsByTableId.values()).flat()

            const enumTargetObjectIds = Array.from(
                new Set([
                    ...safeAttributes
                        .filter((attr) => attr.data_type === 'REF' && attr.target_object_kind === 'enumeration' && attr.target_object_id)
                        .map((attr) => String(attr.target_object_id)),
                    ...allChildAttributes
                        .filter((attr) => attr.data_type === 'REF' && attr.target_object_kind === 'enumeration' && attr.target_object_id)
                        .map((attr) => String(attr.target_object_id))
                ])
            )

            const enumOptionsMap = new Map<
                string,
                Array<{ id: string; label: string; codename: string; isDefault: boolean; sortOrder: number }>
            >()
            if (enumTargetObjectIds.length > 0) {
                const enumRows = (await manager.query(
                    `
                        SELECT id, object_id, codename, presentation, sort_order, is_default
                        FROM ${schemaIdent}._app_values
                        WHERE object_id = ANY($1::uuid[])
                          AND _upl_deleted = false
                          AND _app_deleted = false
                        ORDER BY object_id ASC, sort_order ASC, codename ASC
                    `,
                    [enumTargetObjectIds]
                )) as Array<{
                    id: string
                    object_id: string
                    codename: string
                    presentation?: unknown
                    sort_order?: number
                    is_default?: boolean
                }>

                for (const row of enumRows) {
                    const list = enumOptionsMap.get(row.object_id) ?? []
                    list.push({
                        id: row.id,
                        codename: row.codename,
                        label: resolvePresentationName(row.presentation, requestedLocale, row.codename),
                        isDefault: row.is_default === true,
                        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
                    })
                    enumOptionsMap.set(row.object_id, list)
                }
            }

            const catalogTargetObjectIds = Array.from(
                new Set([
                    ...safeAttributes
                        .filter((attr) => attr.data_type === 'REF' && attr.target_object_kind === 'catalog' && attr.target_object_id)
                        .map((attr) => String(attr.target_object_id)),
                    ...allChildAttributes
                        .filter((attr) => attr.data_type === 'REF' && attr.target_object_kind === 'catalog' && attr.target_object_id)
                        .map((attr) => String(attr.target_object_id))
                ])
            )

            const catalogRefOptionsMap = new Map<string, RuntimeRefOption[]>()
            if (catalogTargetObjectIds.length > 0) {
                const targetCatalogs = (await manager.query(
                    `
                                                SELECT id, codename, table_name, config
                        FROM ${schemaIdent}._app_objects
                        WHERE id = ANY($1::uuid[])
                          AND kind = 'catalog'
                          AND _upl_deleted = false
                          AND _app_deleted = false
                    `,
                    [catalogTargetObjectIds]
                )) as Array<{
                    id: string
                    codename: string
                    table_name: string
                    config?: Record<string, unknown> | null
                }>

                const targetCatalogAttrs = (await manager.query(
                    `
                                                SELECT object_id, column_name, codename, data_type, is_display_attribute, sort_order
                        FROM ${schemaIdent}._app_attributes
                        WHERE object_id = ANY($1::uuid[])
                                                    AND parent_attribute_id IS NULL
                          AND _upl_deleted = false
                          AND _app_deleted = false
                        ORDER BY object_id ASC, is_display_attribute DESC, sort_order ASC, codename ASC
                    `,
                    [catalogTargetObjectIds]
                )) as Array<{
                    object_id: string
                    column_name: string
                    codename: string
                    data_type: RuntimeDataType
                    is_display_attribute: boolean
                    sort_order?: number
                }>

                const attrsByCatalogId = new Map<string, typeof targetCatalogAttrs>()
                for (const row of targetCatalogAttrs) {
                    const list = attrsByCatalogId.get(row.object_id) ?? []
                    list.push(row)
                    attrsByCatalogId.set(row.object_id, list)
                }

                for (const targetCatalog of targetCatalogs) {
                    if (!IDENTIFIER_REGEX.test(targetCatalog.table_name)) {
                        continue
                    }

                    const targetCatalogActiveRowCondition = buildRuntimeActiveRowCondition(
                        resolveApplicationLifecycleContractFromConfig(targetCatalog.config),
                        targetCatalog.config,
                        undefined,
                        currentWorkspaceId
                    )

                    const targetAttrs = attrsByCatalogId.get(targetCatalog.id) ?? []
                    const preferredDisplayAttr =
                        targetAttrs.find((attr) => attr.is_display_attribute) ??
                        targetAttrs.find((attr) => attr.data_type === 'STRING') ??
                        targetAttrs[0]

                    const selectLabelSql =
                        preferredDisplayAttr && IDENTIFIER_REGEX.test(preferredDisplayAttr.column_name)
                            ? `${quoteIdentifier(preferredDisplayAttr.column_name)} AS label_value`
                            : 'NULL AS label_value'

                    const targetRows = (await manager.query(
                        `
                            SELECT id, ${selectLabelSql}
                            FROM ${schemaIdent}.${quoteIdentifier(targetCatalog.table_name)}
                                                        WHERE ${targetCatalogActiveRowCondition}
                            ORDER BY _upl_created_at ASC NULLS LAST, id ASC
                            LIMIT 1000
                        `
                    )) as Array<{
                        id: string
                        label_value?: unknown
                    }>

                    const options: RuntimeRefOption[] = targetRows.map((row, index) => {
                        const rawLabel = row.label_value
                        const localizedLabel =
                            preferredDisplayAttr?.data_type === 'STRING'
                                ? resolveRuntimeValue(rawLabel, 'STRING', requestedLocale)
                                : rawLabel
                        const label =
                            typeof localizedLabel === 'string' && localizedLabel.trim().length > 0 ? localizedLabel : String(row.id)

                        return {
                            id: row.id,
                            label,
                            codename: targetCatalog.codename,
                            isDefault: false,
                            sortOrder: index
                        }
                    })

                    catalogRefOptionsMap.set(targetCatalog.id, options)
                }
            }

            const dataTableIdent = `${schemaIdent}.${quoteIdentifier(activeCatalog.table_name)}`
            const activeCatalogRowCondition = buildRuntimeActiveRowCondition(
                activeCatalog.lifecycleContract,
                activeCatalog.config,
                undefined,
                currentWorkspaceId
            )
            // Use physicalAttributes for SQL — TABLE attrs have no physical column in parent table
            const selectColumns = ['id', ...physicalAttributes.map((attr) => quoteIdentifier(attr.column_name))]

            // Add correlated subqueries for TABLE attributes to include child row counts
            for (const tAttr of tableAttrs) {
                const fallbackTabTableName = generateChildTableName(tAttr.id)
                const tabTableName =
                    typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                        ? tAttr.column_name
                        : fallbackTabTableName
                if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
                selectColumns.push(
                    `(SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeCatalogRowCondition}) AS ${quoteIdentifier(
                        tAttr.column_name
                    )}`
                )
            }

            const [{ total }] = (await manager.query(
                `
                    SELECT COUNT(*)::int AS total
                    FROM ${dataTableIdent}
                    WHERE ${activeCatalogRowCondition}
                `
            )) as Array<{ total: number }>

            const rawRows = (await manager.query(
                `
                    SELECT ${selectColumns.join(', ')}
                    FROM ${dataTableIdent}
                                        WHERE ${activeCatalogRowCondition}
                    ORDER BY _upl_created_at ASC NULLS LAST, id ASC
                    LIMIT $1 OFFSET $2
                `,
                [limit, offset]
            )) as Array<Record<string, unknown>>

            const rows = rawRows.map((row) => {
                const mappedRow: Record<string, unknown> & { id: string } = {
                    id: String(row.id)
                }

                for (const attribute of safeAttributes) {
                    // TABLE attributes contain child row counts from subqueries
                    if (attribute.data_type === 'TABLE') {
                        mappedRow[attribute.column_name] = typeof row[attribute.column_name] === 'number' ? row[attribute.column_name] : 0
                        continue
                    }
                    mappedRow[attribute.column_name] = resolveRuntimeValue(row[attribute.column_name], attribute.data_type, requestedLocale)
                }

                return mappedRow
            })

            let workspaceLimit: { maxRows: number | null; currentRows: number; canCreate: boolean } | undefined
            if (runtimeContext.workspacesEnabled && currentWorkspaceId) {
                const maxRows = await getCatalogWorkspaceLimit(manager, {
                    schemaName,
                    objectId: activeCatalog.id
                })
                const currentRows = await getCatalogWorkspaceUsage(manager, {
                    schemaName,
                    tableName: activeCatalog.table_name,
                    workspaceId: currentWorkspaceId,
                    runtimeRowCondition: activeCatalogRowCondition
                })
                workspaceLimit = {
                    maxRows,
                    currentRows,
                    canCreate: maxRows === null ? true : currentRows < maxRows
                }
            }

            // Optional layout config for runtime UI (Dashboard sections show/hide).
            // Source of truth: _app_layouts (default active layout). Kept in dynamic schema with migrations.
            let layoutConfig: Record<string, unknown> = {}
            try {
                const [{ layoutsExists }] = (await manager.query(
                    `
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = $1 AND table_name = '_app_layouts'
                        ) AS "layoutsExists"
                    `,
                    [schemaName]
                )) as Array<{ layoutsExists: boolean }>

                if (layoutsExists) {
                    const layoutRows = (await manager.query(
                        `
                            SELECT config
                            FROM ${schemaIdent}._app_layouts
                            WHERE (is_default = true OR is_active = true)
                              AND _upl_deleted = false
                              AND _app_deleted = false
                            ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
                            LIMIT 1
                        `
                    )) as Array<{ config: Record<string, unknown> | null }>

                    layoutConfig = layoutRows?.[0]?.config ?? {}
                } else {
                    // Backward compatibility for old schemas.
                    const [{ settingsExists }] = (await manager.query(
                        `
                            SELECT EXISTS (
                                SELECT 1
                                FROM information_schema.tables
                                WHERE table_schema = $1 AND table_name = '_app_settings'
                            ) AS "settingsExists"
                        `,
                        [schemaName]
                    )) as Array<{ settingsExists: boolean }>

                    if (!settingsExists) {
                        layoutConfig = {}
                    } else {
                        const uiRows = (await manager.query(
                            `
                                SELECT value
                                FROM ${schemaIdent}._app_settings
                                WHERE key = 'layout'
                                  AND _upl_deleted = false
                                  AND _app_deleted = false
                                LIMIT 1
                            `
                        )) as Array<{ value: Record<string, unknown> | null }>
                        layoutConfig = uiRows?.[0]?.value ?? {}
                    }
                }
            } catch (e) {
                // Backward compatibility: older schemas may not have UI settings tables yet.
                // eslint-disable-next-line no-console
                console.warn('[ApplicationsRuntime] Failed to load layout config (ignored)', e)
            }

            const catalogsForRuntime = runtimeCatalogs.map((catalogRow) => ({
                id: catalogRow.id,
                codename: catalogRow.codename,
                tableName: catalogRow.table_name,
                name: resolvePresentationName(catalogRow.presentation, requestedLocale, catalogRow.codename)
            }))

            // Zone widgets for runtime UI (sidebar + center composition).
            type ZoneWidgetItem = {
                id: string
                widgetKey: string
                sortOrder: number
                config: Record<string, unknown>
            }
            let zoneWidgets: {
                left: ZoneWidgetItem[]
                right: ZoneWidgetItem[]
                center: ZoneWidgetItem[]
            } = { left: [], right: [], center: [] }

            try {
                const [{ zoneWidgetsExists }] = (await manager.query(
                    `
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = $1 AND table_name = '_app_widgets'
                        ) AS "zoneWidgetsExists"
                    `,
                    [schemaName]
                )) as Array<{ zoneWidgetsExists: boolean }>

                if (zoneWidgetsExists) {
                    // Get the default/active layout id
                    const defaultLayoutRows = (await manager.query(
                        `
                            SELECT id
                            FROM ${schemaIdent}._app_layouts
                            WHERE (is_default = true OR is_active = true)
                              AND _upl_deleted = false
                              AND _app_deleted = false
                            ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
                            LIMIT 1
                        `
                    )) as Array<{ id: string }>
                    const activeLayoutId = defaultLayoutRows[0]?.id

                    if (activeLayoutId) {
                        const widgetRows = (await manager.query(
                            `
                                SELECT id, widget_key, sort_order, config, zone
                                FROM ${schemaIdent}._app_widgets
                                WHERE layout_id = $1
                                  AND zone IN ('left', 'right', 'center')
                                  AND _upl_deleted = false
                                  AND _app_deleted = false
                                ORDER BY sort_order ASC, _upl_created_at ASC
                            `,
                            [activeLayoutId]
                        )) as Array<{
                            id: string
                            widget_key: string
                            sort_order: number
                            config: Record<string, unknown> | null
                            zone: string
                        }>

                        for (const row of widgetRows) {
                            const mapped = {
                                id: row.id,
                                widgetKey: row.widget_key,
                                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
                                config: row.config && typeof row.config === 'object' ? row.config : {}
                            }
                            if (row.zone === 'right') {
                                zoneWidgets.right.push(mapped)
                            } else if (row.zone === 'center') {
                                zoneWidgets.center.push(mapped)
                            } else {
                                zoneWidgets.left.push(mapped)
                            }
                        }
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[ApplicationsRuntime] Failed to load zone widgets (ignored)', e)
            }

            // Build menus from menuWidget config stored in zone widgets.
            // Menu data is now embedded inside widget config (JSONB) rather than separate _app_menus/_app_menu_items tables.
            type RuntimeMenuItem = {
                id: string
                kind: string
                title: string
                icon: string | null
                href: string | null
                catalogId: string | null
                hubId: string | null
                sortOrder: number
                isActive: boolean
            }

            type RuntimeMenuEntry = {
                id: string
                widgetId: string
                showTitle: boolean
                title: string
                autoShowAllCatalogs: boolean
                items: RuntimeMenuItem[]
            }

            type RuntimeHubMeta = {
                id: string
                codename: string
                title: string
                parentHubId: string | null
                sortOrder: number
            }

            type RuntimeCatalogMeta = {
                id: string
                codename: string
                title: string
                sortOrder: number
                hubIds: string[]
            }

            let hubMetaById = new Map<string, RuntimeHubMeta>()
            let childHubIdsByParent = new Map<string, string[]>()
            let catalogsByHub = new Map<string, RuntimeCatalogMeta[]>()

            try {
                const objectRows = (await manager.query(
                    `
                        SELECT id, kind, codename, presentation, config
                        FROM ${schemaIdent}._app_objects
                        WHERE kind IN ('hub', 'catalog')
                          AND _upl_deleted = false
                          AND _app_deleted = false
                    `
                )) as Array<{
                    id: string
                    kind: 'hub' | 'catalog'
                    codename: string
                    presentation?: unknown
                    config?: unknown
                }>

                for (const row of objectRows) {
                    const config = row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
                    const rawSortOrder = config.sortOrder
                    const sortOrder = typeof rawSortOrder === 'number' ? rawSortOrder : 0
                    const title = resolvePresentationName(row.presentation, requestedLocale, row.codename)

                    if (row.kind === 'hub') {
                        const parentHubId = typeof config.parentHubId === 'string' ? config.parentHubId : null
                        hubMetaById.set(row.id, {
                            id: row.id,
                            codename: row.codename,
                            title,
                            parentHubId,
                            sortOrder
                        })
                        continue
                    }

                    const hubIds = Array.isArray(config.hubs)
                        ? config.hubs.filter((value): value is string => typeof value === 'string')
                        : []
                    const catalogMeta: RuntimeCatalogMeta = {
                        id: row.id,
                        codename: row.codename,
                        title,
                        sortOrder,
                        hubIds
                    }
                    for (const hubId of hubIds) {
                        const list = catalogsByHub.get(hubId) ?? []
                        list.push(catalogMeta)
                        catalogsByHub.set(hubId, list)
                    }
                }

                const hubSortComparator = (a: RuntimeHubMeta, b: RuntimeHubMeta) => {
                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                    return a.codename.localeCompare(b.codename)
                }
                const catalogSortComparator = (a: RuntimeCatalogMeta, b: RuntimeCatalogMeta) => {
                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                    return a.codename.localeCompare(b.codename)
                }

                const hubs = Array.from(hubMetaById.values()).sort(hubSortComparator)
                childHubIdsByParent = new Map<string, string[]>()
                for (const hub of hubs) {
                    if (!hub.parentHubId) continue
                    const childIds = childHubIdsByParent.get(hub.parentHubId) ?? []
                    childIds.push(hub.id)
                    childHubIdsByParent.set(hub.parentHubId, childIds)
                }

                for (const [hubId, hubCatalogs] of catalogsByHub.entries()) {
                    catalogsByHub.set(hubId, [...hubCatalogs].sort(catalogSortComparator))
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[ApplicationsRuntime] Failed to build hub/catalog runtime map for menuWidget (ignored)', e)
                hubMetaById = new Map()
                childHubIdsByParent = new Map()
                catalogsByHub = new Map()
            }

            const normalizeMenuItem = (item: unknown): RuntimeMenuItem | null => {
                if (!item || typeof item !== 'object') return null
                const typed = item as Record<string, unknown>
                if (typed.isActive === false) return null

                const kind = typeof typed.kind === 'string' && typed.kind.trim().length > 0 ? typed.kind : 'link'
                return {
                    id: String(typed.id ?? ''),
                    kind,
                    title: resolveLocalizedContent(typed.title, requestedLocale, kind),
                    icon: typeof typed.icon === 'string' ? typed.icon : null,
                    href: typeof typed.href === 'string' ? typed.href : null,
                    catalogId: typeof typed.catalogId === 'string' ? typed.catalogId : null,
                    hubId: typeof typed.hubId === 'string' ? typed.hubId : null,
                    sortOrder: typeof typed.sortOrder === 'number' ? typed.sortOrder : 0,
                    isActive: true
                }
            }

            const buildHubMenuItems = (baseItem: RuntimeMenuItem): RuntimeMenuItem[] => {
                if (!baseItem.hubId) return []
                if (!hubMetaById.has(baseItem.hubId)) return []

                const items: RuntimeMenuItem[] = []
                const visited = new Set<string>()
                const hubSortComparator = (aId: string, bId: string) => {
                    const a = hubMetaById.get(aId)
                    const b = hubMetaById.get(bId)
                    if (!a || !b) return aId.localeCompare(bId)
                    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                    return a.codename.localeCompare(b.codename)
                }

                const walkHub = (hubId: string, depth: number) => {
                    if (visited.has(hubId)) return
                    visited.add(hubId)

                    const hubMeta = hubMetaById.get(hubId)
                    if (!hubMeta) return
                    const indent = depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}• ` : ''

                    items.push({
                        id: `${baseItem.id}:hub:${hubMeta.id}`,
                        kind: 'hub',
                        title: `${indent}${hubMeta.title}`,
                        icon: baseItem.icon,
                        href: null,
                        catalogId: null,
                        hubId: hubMeta.id,
                        sortOrder: baseItem.sortOrder,
                        isActive: true
                    })

                    const hubCatalogs = catalogsByHub.get(hubMeta.id) ?? []
                    for (const catalog of hubCatalogs) {
                        items.push({
                            id: `${baseItem.id}:hub:${hubMeta.id}:catalog:${catalog.id}`,
                            kind: 'catalog',
                            title: `${'\u00A0\u00A0'.repeat(depth + 1)}${catalog.title}`,
                            icon: baseItem.icon,
                            href: null,
                            catalogId: catalog.id,
                            hubId: hubMeta.id,
                            sortOrder: baseItem.sortOrder,
                            isActive: true
                        })
                    }

                    const childIds = [...(childHubIdsByParent.get(hubMeta.id) ?? [])].sort(hubSortComparator)
                    for (const childId of childIds) {
                        walkHub(childId, depth + 1)
                    }
                }

                walkHub(baseItem.hubId, 0)
                return items
            }

            const buildBoundHubCatalogItems = (widgetId: string, boundHubId: string): RuntimeMenuItem[] => {
                if (!hubMetaById.has(boundHubId)) return []
                const directCatalogs = catalogsByHub.get(boundHubId) ?? []
                return directCatalogs.map((catalog, index) => ({
                    id: `${widgetId}:bound-hub:${boundHubId}:catalog:${catalog.id}`,
                    kind: 'catalog',
                    title: catalog.title,
                    icon: 'database',
                    href: null,
                    catalogId: catalog.id,
                    hubId: boundHubId,
                    sortOrder: index + 1,
                    isActive: true
                }))
            }

            const buildAllCatalogMenuItems = (widgetId: string): RuntimeMenuItem[] => {
                return catalogsForRuntime.map((catalog, index) => ({
                    id: `${widgetId}:all-catalogs:${catalog.id}`,
                    kind: 'catalog',
                    title: catalog.name,
                    icon: 'database',
                    href: null,
                    catalogId: catalog.id,
                    hubId: null,
                    sortOrder: index + 1,
                    isActive: true
                }))
            }

            let menus: RuntimeMenuEntry[] = []
            let activeMenuId: string | null = null

            try {
                for (const widget of zoneWidgets.left) {
                    if (widget.widgetKey !== 'menuWidget') continue
                    const cfg = widget.config as Record<string, unknown>
                    const bindToHub = Boolean(cfg.bindToHub)
                    const boundHubId = typeof cfg.boundHubId === 'string' ? cfg.boundHubId : null
                    const autoShowAllCatalogs = Boolean(cfg.autoShowAllCatalogs) && !bindToHub

                    let resolvedItems: RuntimeMenuItem[] = []
                    if (bindToHub && boundHubId) {
                        resolvedItems = buildBoundHubCatalogItems(widget.id, boundHubId)
                    } else if (autoShowAllCatalogs) {
                        resolvedItems = buildAllCatalogMenuItems(widget.id)
                    } else {
                        const rawItems = Array.isArray(cfg.items) ? cfg.items : []
                        const normalizedItems = rawItems
                            .map((item) => normalizeMenuItem(item))
                            .filter((item): item is RuntimeMenuItem => item !== null)
                            .filter((item) => item.kind !== 'catalogs_all')
                            .sort((a, b) => a.sortOrder - b.sortOrder)

                        for (const item of normalizedItems) {
                            if (item.kind === 'hub') {
                                const expanded = buildHubMenuItems(item)
                                if (expanded.length > 0) {
                                    resolvedItems.push(...expanded)
                                }
                                continue
                            }
                            resolvedItems.push(item)
                        }
                    }

                    const menuEntry = {
                        id: widget.id,
                        widgetId: widget.id,
                        showTitle: Boolean(cfg.showTitle),
                        title: resolveLocalizedContent(cfg.title, requestedLocale, ''),
                        autoShowAllCatalogs,
                        items: resolvedItems
                    } satisfies RuntimeMenuEntry
                    menus.push(menuEntry)
                }
                activeMenuId = menus[0]?.id ?? null
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[ApplicationsRuntime] Failed to build menus from widget config (ignored)', e)
            }

            type RuntimeColumnDefinition = {
                id: string
                codename: string
                field: string
                dataType: RuntimeDataType
                isRequired: boolean
                isDisplayAttribute: boolean
                headerName: string
                validationRules: Record<string, unknown>
                uiConfig: Record<string, unknown>
                refTargetEntityId: string | null
                refTargetEntityKind: string | null
                refTargetConstantId: string | null
                refOptions?: RuntimeRefOption[]
                enumOptions?: RuntimeRefOption[]
                childColumns?: RuntimeColumnDefinition[]
            }

            const buildSetConstantOption = (setConstantConfig: SetConstantUiConfig | null): RuntimeRefOption[] | undefined => {
                if (!setConstantConfig) return undefined
                return [
                    {
                        id: setConstantConfig.id,
                        label: resolveSetConstantLabel(setConstantConfig, requestedLocale),
                        codename: setConstantConfig.codename ?? 'setConstant',
                        isDefault: true,
                        sortOrder: 0
                    }
                ]
            }

            const resolveRefOptions = (
                attribute: (typeof safeAttributes)[number],
                setConstantOption: RuntimeRefOption[] | undefined
            ): RuntimeRefOption[] | undefined => {
                if (
                    attribute.data_type !== 'REF' ||
                    typeof attribute.target_object_id !== 'string' ||
                    (attribute.target_object_kind !== 'enumeration' &&
                        attribute.target_object_kind !== 'catalog' &&
                        attribute.target_object_kind !== 'set')
                ) {
                    return undefined
                }

                if (attribute.target_object_kind === 'enumeration') {
                    return enumOptionsMap.get(attribute.target_object_id) ?? []
                }
                if (attribute.target_object_kind === 'catalog') {
                    return catalogRefOptionsMap.get(attribute.target_object_id) ?? []
                }
                return setConstantOption ?? []
            }

            const mapAttributeToColumnDefinition = (
                attribute: (typeof safeAttributes)[number],
                includeChildColumns: boolean
            ): RuntimeColumnDefinition => {
                const setConstantConfig =
                    attribute.data_type === 'REF' && attribute.target_object_kind === 'set'
                        ? getSetConstantConfig(attribute.ui_config)
                        : null
                const setConstantOption = buildSetConstantOption(setConstantConfig)
                const refOptions = resolveRefOptions(attribute, setConstantOption)
                const enumOptions =
                    attribute.data_type === 'REF' &&
                    attribute.target_object_kind === 'enumeration' &&
                    attribute.target_object_id &&
                    enumOptionsMap.has(attribute.target_object_id)
                        ? enumOptionsMap.get(attribute.target_object_id)
                        : undefined

                return {
                    id: attribute.id,
                    codename: attribute.codename,
                    field: attribute.column_name,
                    dataType: attribute.data_type,
                    isRequired: attribute.is_required ?? false,
                    isDisplayAttribute: attribute.is_display_attribute === true,
                    headerName: resolvePresentationName(attribute.presentation, requestedLocale, attribute.codename),
                    validationRules: attribute.validation_rules ?? {},
                    uiConfig: {
                        ...(attribute.ui_config ?? {}),
                        ...(setConstantConfig?.dataType ? { setConstantDataType: setConstantConfig.dataType } : {})
                    },
                    refTargetEntityId: attribute.target_object_id ?? null,
                    refTargetEntityKind: attribute.target_object_kind ?? null,
                    refTargetConstantId: setConstantConfig?.id ?? null,
                    refOptions,
                    enumOptions,
                    ...(includeChildColumns && attribute.data_type === 'TABLE'
                        ? {
                              // Include child column definitions for TABLE attributes.
                              childColumns: (childAttrsByTableId.get(attribute.id) ?? []).map((child) =>
                                  mapAttributeToColumnDefinition(child, false)
                              )
                          }
                        : {})
                }
            }

            return res.json({
                catalog: {
                    id: activeCatalog.id,
                    codename: activeCatalog.codename,
                    tableName: activeCatalog.table_name,
                    name: resolvePresentationName(activeCatalog.presentation, requestedLocale, activeCatalog.codename)
                },
                catalogs: catalogsForRuntime,
                activeCatalogId: activeCatalog.id,
                columns: safeAttributes.map((attribute) => mapAttributeToColumnDefinition(attribute, true)),
                rows,
                pagination: {
                    total: typeof total === 'number' ? total : Number(total) || 0,
                    limit,
                    offset
                },
                ...(workspaceLimit ? { workspaceLimit } : {}),
                layoutConfig,
                zoneWidgets,
                menus,
                activeMenuId
            })
        })
    )

    // ============ APPLICATION RUNTIME CELL UPDATE ============
    const runtimeUpdateBodySchema = z.object({
        field: z.string().min(1),
        value: z.unknown(),
        catalogId: z.string().uuid().optional(),
        expectedVersion: z.number().int().positive().optional()
    })

    /** Supported runtime data types for write operations */
    const RUNTIME_WRITABLE_TYPES = new Set(['BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE'])

    /**
     * Validates and coerces a value to match the expected runtime column type.
     * Returns the value to store or throws on type mismatch.
     */
    const coerceRuntimeValue = (value: unknown, dataType: string, validationRules?: Record<string, unknown>): unknown => {
        if (value === null || value === undefined) return null

        switch (dataType) {
            case 'BOOLEAN':
                if (typeof value !== 'boolean') throw new Error('Expected boolean value')
                return value
            case 'NUMBER': {
                // Accept both JS numbers and numeric strings (pg returns NUMERIC as string)
                let num: number
                if (typeof value === 'number') {
                    num = value
                } else if (typeof value === 'string') {
                    num = Number(value)
                    if (!Number.isFinite(num)) throw new Error('Expected number value')
                } else {
                    throw new Error('Expected number value')
                }
                if (validationRules) {
                    if (validationRules.nonNegative === true && num < 0) {
                        throw new Error('Value must be non-negative')
                    }
                    if (typeof validationRules.min === 'number' && num < validationRules.min) {
                        throw new Error(`Value must be >= ${validationRules.min}`)
                    }
                    if (typeof validationRules.max === 'number' && num > validationRules.max) {
                        throw new Error(`Value must be <= ${validationRules.max}`)
                    }
                }
                return num
            }
            case 'STRING': {
                const isVLC = Boolean(validationRules?.versioned) || Boolean(validationRules?.localized)
                if (isVLC) {
                    // VLC: accept object with locales structure, or plain string
                    if (typeof value === 'string') return value
                    if (typeof value === 'object') {
                        const vlc = value as Record<string, unknown>
                        if (!vlc.locales || typeof vlc.locales !== 'object') {
                            throw new Error('VLC object must contain a locales property')
                        }
                        return value
                    }
                    throw new Error('Expected object or string value for VLC field')
                }
                if (typeof value !== 'string') throw new Error('Expected string value')
                return value
            }
            case 'DATE': {
                if (typeof value !== 'string') throw new Error('Expected ISO date string')
                const d = new Date(value)
                if (Number.isNaN(d.getTime())) throw new Error('Invalid date value')
                return value
            }
            case 'REF': {
                if (typeof value !== 'string') throw new Error('Expected UUID value')
                if (!UUID_REGEX.test(value)) throw new Error('Invalid UUID value')
                return value
            }
            case 'JSON':
                // Accept any serializable value for JSONB columns
                return typeof value === 'object' ? value : JSON.stringify(value)
            case 'TABLE':
                // TABLE is a virtual type — no physical column in parent table.
                // Data lives in a separate child table. Skip coercion.
                return null
            default:
                throw new Error(`Unsupported data type: ${dataType}`)
        }
    }

    const parseRowLimit = (value: unknown): number | null => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null
        const normalized = Math.floor(value)
        return normalized >= 0 ? normalized : null
    }

    const getTableRowLimits = (validationRules?: Record<string, unknown>): { minRows: number | null; maxRows: number | null } => {
        const minRows = parseRowLimit(validationRules?.minRows)
        const maxRows = parseRowLimit(validationRules?.maxRows)
        return { minRows, maxRows }
    }

    const getTableRowCountError = (
        rowCount: number,
        tableCodename: string,
        limits: { minRows: number | null; maxRows: number | null }
    ): string | null => {
        if (limits.minRows !== null && rowCount < limits.minRows) {
            return `TABLE ${tableCodename} requires at least ${limits.minRows} row(s)`
        }
        if (limits.maxRows !== null && rowCount > limits.maxRows) {
            return `TABLE ${tableCodename} allows at most ${limits.maxRows} row(s)`
        }
        return null
    }

    /**
     * Shared helper: resolve catalog and load its attributes from a runtime schema.
     */
    const resolveRuntimeCatalog = async (manager: DbExecutor, schemaIdent: string, requestedCatalogId?: string) => {
        const catalogs = (await manager.query(
            `
                SELECT id, codename, table_name, config
                FROM ${schemaIdent}._app_objects
                WHERE kind = 'catalog'
                  AND _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY codename ASC
            `
        )) as Array<{ id: string; codename: string; table_name: string; config?: Record<string, unknown> | null }>

        if (catalogs.length === 0) return { catalog: null, attrs: [], error: 'No catalogs available' }

        const selectedCatalog = (requestedCatalogId ? catalogs.find((c) => c.id === requestedCatalogId) : undefined) ?? catalogs[0]
        const catalog = selectedCatalog
            ? { ...selectedCatalog, lifecycleContract: resolveApplicationLifecycleContractFromConfig(selectedCatalog.config) }
            : null
        if (!catalog) return { catalog: null, attrs: [], error: 'Catalog not found' }
        if (!IDENTIFIER_REGEX.test(catalog.table_name)) return { catalog: null, attrs: [], error: 'Invalid table name' }

        const attrs = (await manager.query(
            `
                SELECT id, codename, column_name, data_type, is_required, validation_rules
                       , target_object_id, target_object_kind, ui_config
                FROM ${schemaIdent}._app_attributes
                WHERE object_id = $1
                  AND parent_attribute_id IS NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
            `,
            [catalog.id]
        )) as Array<{
            id: string
            codename: string
            column_name: string
            data_type: string
            is_required: boolean
            validation_rules?: Record<string, unknown>
            target_object_id?: string | null
            target_object_kind?: string | null
            ui_config?: Record<string, unknown>
        }>

        return { catalog, attrs, error: null }
    }

    /**
     * Shared helper: validate application and schema, return identifiers.
     */
    const resolveRuntimeSchema = async (
        req: Request,
        res: Response,
        applicationId: string
    ): Promise<{
        schemaName: string
        schemaIdent: string
        manager: DbExecutor
        userId: string
        role: ApplicationRole
        permissions: Record<RolePermission, boolean>
        currentWorkspaceId: string | null
        workspacesEnabled: boolean
    } | null> => {
        if (!UUID_REGEX.test(applicationId)) {
            res.status(400).json({ error: 'Invalid application ID format' })
            return null
        }

        const ds = getRequestDbExecutor(req, getDbExecutor())
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        const accessContext = await ensureApplicationAccess(ds, userId, applicationId)
        const role = (accessContext.membership.role || 'member') as ApplicationRole
        const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

        const application = await findApplicationSchemaInfo(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            applicationId
        )
        if (!application) {
            res.status(404).json({ error: 'Application not found' })
            return null
        }
        if (!application.schemaName) {
            res.status(400).json({ error: 'Application schema is not configured' })
            return null
        }

        const schemaName = application.schemaName
        if (!IDENTIFIER_REGEX.test(schemaName)) {
            res.status(400).json({ error: 'Invalid application schema name' })
            return null
        }

        let currentWorkspaceId: string | null = null
        if (application.workspacesEnabled) {
            const workspaceAccess = await resolveRuntimeWorkspaceAccess(ds, {
                schemaName,
                workspacesEnabled: application.workspacesEnabled,
                userId,
                actorUserId: userId
            })

            currentWorkspaceId = workspaceAccess.defaultWorkspaceId
            if (!currentWorkspaceId) {
                res.status(403).json({ error: 'No active workspace is available for the current user' })
                return null
            }

            await setRuntimeWorkspaceContext(ds, currentWorkspaceId)
        }

        return {
            schemaName,
            schemaIdent: quoteIdentifier(schemaName),
            manager: ds,
            userId,
            role,
            permissions,
            currentWorkspaceId,
            workspacesEnabled: application.workspacesEnabled
        }
    }

    const ensureRuntimePermission = (
        res: Response,
        ctx: { permissions: Record<RolePermission, boolean> },
        permission: RolePermission
    ): boolean => {
        if (ctx.permissions[permission]) {
            return true
        }

        res.status(403).json({ error: 'Insufficient permissions for this action' })
        return false
    }

    const getEnumPresentationMode = (uiConfig?: Record<string, unknown>): 'select' | 'radio' | 'label' => {
        const mode = uiConfig?.enumPresentationMode
        if (mode === 'radio' || mode === 'label') return mode
        return 'select'
    }

    const getDefaultEnumValueId = (uiConfig?: Record<string, unknown>): string | null => {
        const defaultValueId = uiConfig?.defaultEnumValueId
        if (typeof defaultValueId === 'string' && UUID_REGEX.test(defaultValueId)) {
            return defaultValueId
        }
        return null
    }

    type SetConstantUiConfig = {
        id: string
        codename?: string
        dataType?: string
        value?: unknown
        name?: unknown
    }

    const getSetConstantConfig = (uiConfig?: Record<string, unknown>): SetConstantUiConfig | null => {
        if (!uiConfig || typeof uiConfig !== 'object') return null
        const candidate = uiConfig.setConstantRef
        if (!candidate || typeof candidate !== 'object') return null
        const typed = candidate as Record<string, unknown>
        if (typeof typed.id !== 'string' || !UUID_REGEX.test(typed.id)) return null
        return {
            id: typed.id,
            codename: typeof typed.codename === 'string' ? typed.codename : undefined,
            dataType: typeof typed.dataType === 'string' ? typed.dataType : undefined,
            value: typed.value,
            name: typed.name
        }
    }

    const resolveSetConstantLabel = (config: SetConstantUiConfig, locale: string): string => {
        if (config.value === null || config.value === undefined) {
            return config.codename ?? config.id
        }

        if (config.dataType === 'STRING' && typeof config.value === 'object') {
            const localized = resolveLocalizedContent(config.value, locale, '')
            if (localized.trim().length > 0) return localized
        }

        if (config.dataType === 'DATE' && typeof config.value === 'string') {
            const parsed = new Date(config.value)
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toLocaleString(locale)
            }
        }

        if (typeof config.value === 'string' || typeof config.value === 'number' || typeof config.value === 'boolean') {
            return String(config.value)
        }

        const localizedName = resolveLocalizedContent(config.name, locale, '')
        if (localizedName.trim().length > 0) return localizedName

        if (config.value && typeof config.value === 'object') {
            try {
                return JSON.stringify(config.value)
            } catch {
                return config.codename ?? config.id
            }
        }

        return config.codename ?? config.id
    }

    const resolveRefId = (value: unknown): string | null => {
        if (typeof value === 'string' && value.trim().length > 0) return value.trim()
        if (!value || typeof value !== 'object') return null
        const typed = value as Record<string, unknown>
        const direct = typed.id
        if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim()
        const nested = typed.value
        if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim()
        if (nested && typeof nested === 'object') {
            const nestedId = (nested as Record<string, unknown>).id
            if (typeof nestedId === 'string' && nestedId.trim().length > 0) return nestedId.trim()
        }
        return null
    }

    const ensureEnumerationValueBelongsToTarget = async (
        manager: DbExecutor,
        schemaIdent: string,
        enumValueId: string,
        targetEnumerationId: string
    ): Promise<void> => {
        const rows = (await manager.query(
            `
                SELECT id
                FROM ${schemaIdent}._app_values
                WHERE id = $1
                  AND object_id = $2
                  AND _upl_deleted = false
                  AND _app_deleted = false
                LIMIT 1
            `,
            [enumValueId, targetEnumerationId]
        )) as Array<{ id: string }>

        if (rows.length === 0) {
            throw new Error('Enumeration value does not belong to target enumeration')
        }
    }

    router.patch(
        '/:applicationId/runtime/:rowId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, rowId } = req.params
            if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return

            const parsedBody = runtimeUpdateBodySchema.safeParse(req.body)
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const { field, value, catalogId: requestedCatalogId, expectedVersion } = parsedBody.data
            if (!IDENTIFIER_REGEX.test(field)) {
                return res.status(400).json({ error: 'Invalid field name' })
            }

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                catalog.lifecycleContract,
                catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )

            const attr = attrs.find((a) => a.column_name === field)
            if (!attr) return res.status(404).json({ error: 'Attribute not found' })
            if (!RUNTIME_WRITABLE_TYPES.has(attr.data_type)) {
                return res.status(400).json({ error: `Field type ${attr.data_type} is not editable` })
            }

            if (attr.data_type === 'TABLE') {
                return res.status(400).json({ error: `Field type ${attr.data_type} must be edited via tabular endpoints` })
            }

            if (
                attr.data_type === 'REF' &&
                attr.target_object_kind === 'enumeration' &&
                getEnumPresentationMode(attr.ui_config) === 'label'
            ) {
                return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
            }

            const setConstantConfig =
                attr.data_type === 'REF' && attr.target_object_kind === 'set' ? getSetConstantConfig(attr.ui_config) : null
            let rawValue = value
            if (setConstantConfig) {
                const providedRefId = resolveRefId(rawValue)
                if (!providedRefId) {
                    rawValue = setConstantConfig.id
                } else if (providedRefId !== setConstantConfig.id) {
                    return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
                } else {
                    rawValue = setConstantConfig.id
                }
            }

            let coerced: unknown
            try {
                coerced = coerceRuntimeValue(rawValue, attr.data_type, attr.validation_rules)
            } catch (e) {
                return res.status(400).json({ error: (e as Error).message })
            }

            if (attr.is_required && attr.data_type !== 'BOOLEAN' && coerced === null) {
                return res.status(400).json({ error: `Required field cannot be set to null: ${attr.codename}` })
            }

            if (
                attr.data_type === 'REF' &&
                attr.target_object_kind === 'enumeration' &&
                typeof attr.target_object_id === 'string' &&
                coerced
            ) {
                try {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), attr.target_object_id)
                } catch (error) {
                    return res.status(400).json({ error: (error as Error).message })
                }
            }

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            const versionCheckClause = expectedVersion !== undefined ? 'AND COALESCE(_upl_version, 1) = $4' : ''
            const updated = (await ctx.manager.query(
                `
                    UPDATE ${dataTableIdent}
                    SET ${quoteIdentifier(field)} = $1,
                        _upl_updated_at = NOW(),
                        _upl_updated_by = $2,
                        _upl_version = COALESCE(_upl_version, 1) + 1
                    WHERE id = $3
                                            AND ${runtimeRowCondition}
                      AND COALESCE(_upl_locked, false) = false
                      ${versionCheckClause}
                    RETURNING id
                `,
                expectedVersion !== undefined ? [coerced, ctx.userId, rowId, expectedVersion] : [coerced, ctx.userId, rowId]
            )) as Array<{ id: string }>

            if (updated.length === 0) {
                // Distinguish locked from not-found
                const exists = (await ctx.manager.query(
                    `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                    [rowId]
                )) as Array<{ id: string; _upl_locked?: boolean; _upl_version?: number }>
                if (exists.length > 0 && exists[0]._upl_locked) {
                    return res.status(423).json({ error: 'Record is locked' })
                }
                if (exists.length > 0 && expectedVersion !== undefined) {
                    const actualVersion = Number(exists[0]._upl_version ?? 1)
                    if (actualVersion !== expectedVersion) {
                        return res.status(409).json({
                            error: 'Version mismatch',
                            expectedVersion,
                            actualVersion
                        })
                    }
                }
                return res.status(404).json({ error: 'Row not found' })
            }

            return res.json({ status: 'ok' })
        })
    )

    // ============ APPLICATION RUNTIME ROW BULK UPDATE ============
    const runtimeBulkUpdateBodySchema = z.object({
        catalogId: z.string().uuid().optional(),
        data: z.record(z.unknown()),
        expectedVersion: z.number().int().positive().optional()
    })

    router.patch(
        '/:applicationId/runtime/rows/:rowId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, rowId } = req.params
            if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'editContent')) return

            const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const { catalogId: requestedCatalogId, data, expectedVersion } = parsedBody.data

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                catalog.lifecycleContract,
                catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )
            const runtimeDeleteSetClause = isSoftDeleteLifecycle(catalog.lifecycleContract)
                ? buildRuntimeSoftDeleteSetClause('$1', catalog.lifecycleContract, catalog.config)
                : null

            const setClauses: string[] = []
            const values: unknown[] = []
            let paramIndex = 1

            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))
            const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
            const tableAttrs = safeAttrs.filter((a) => a.data_type === 'TABLE')

            for (const attr of nonTableAttrs) {
                const raw = data[attr.column_name] ?? data[attr.codename]
                if (raw === undefined) continue
                let normalizedRaw = raw

                if (
                    attr.data_type === 'REF' &&
                    attr.target_object_kind === 'enumeration' &&
                    getEnumPresentationMode(attr.ui_config) === 'label'
                ) {
                    return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
                }

                const setConstantConfig =
                    attr.data_type === 'REF' && attr.target_object_kind === 'set' ? getSetConstantConfig(attr.ui_config) : null
                if (setConstantConfig) {
                    const providedRefId = resolveRefId(raw)
                    if (!providedRefId) {
                        normalizedRaw = setConstantConfig.id
                    } else if (providedRefId !== setConstantConfig.id) {
                        return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
                    } else {
                        normalizedRaw = setConstantConfig.id
                    }
                }

                try {
                    const coerced = coerceRuntimeValue(normalizedRaw, attr.data_type, attr.validation_rules)
                    // M1: Prevent required fields from being set to null
                    if (attr.is_required && attr.data_type !== 'BOOLEAN' && coerced === null) {
                        return res.status(400).json({ error: `Required field cannot be set to null: ${attr.codename}` })
                    }

                    if (
                        attr.data_type === 'REF' &&
                        attr.target_object_kind === 'enumeration' &&
                        typeof attr.target_object_id === 'string' &&
                        coerced
                    ) {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), attr.target_object_id)
                    }

                    setClauses.push(`${quoteIdentifier(attr.column_name)} = $${paramIndex}`)
                    values.push(coerced)
                    paramIndex++
                } catch (e) {
                    return res.status(400).json({ error: `Invalid value for ${attr.codename}: ${(e as Error).message}` })
                }
            }

            const tableDataEntries: Array<{ tabTableName: string; rows: Array<Record<string, unknown>> }> = []

            for (const tAttr of tableAttrs) {
                const hasUserValue =
                    Object.prototype.hasOwnProperty.call(data, tAttr.column_name) ||
                    Object.prototype.hasOwnProperty.call(data, tAttr.codename)
                if (!hasUserValue) continue

                const raw = data[tAttr.column_name] ?? data[tAttr.codename]
                if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
                    return res.status(400).json({ error: `Invalid value for ${tAttr.codename}: TABLE value must be an array` })
                }

                const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
                const rowCountError = getTableRowCountError(childRows.length, tAttr.codename, getTableRowLimits(tAttr.validation_rules))
                if (rowCountError) {
                    return res.status(400).json({ error: rowCountError })
                }

                const fallbackTabTableName = generateChildTableName(tAttr.id)
                const tabTableName =
                    typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                        ? tAttr.column_name
                        : fallbackTabTableName
                if (!IDENTIFIER_REGEX.test(tabTableName)) {
                    return res.status(400).json({ error: `Invalid tabular table name for ${tAttr.codename}` })
                }

                const childAttrsResult = (await ctx.manager.query(
                    `
                        SELECT id, codename, column_name, data_type, is_required, validation_rules,
                               target_object_id, target_object_kind, ui_config
                        FROM ${ctx.schemaIdent}._app_attributes
                        WHERE parent_attribute_id = $1
                          AND _upl_deleted = false
                          AND _app_deleted = false
                        ORDER BY sort_order ASC
                    `,
                    [tAttr.id]
                )) as Array<{
                    id: string
                    codename: string
                    column_name: string
                    data_type: string
                    is_required: boolean
                    validation_rules?: Record<string, unknown>
                    target_object_id?: string | null
                    target_object_kind?: string | null
                    ui_config?: Record<string, unknown>
                }>

                const preparedRows: Array<Record<string, unknown>> = []

                for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                    const rowData = childRows[rowIdx]
                    if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
                        return res.status(400).json({ error: `Invalid row ${rowIdx + 1} for ${tAttr.codename}: row must be an object` })
                    }

                    const preparedRow: Record<string, unknown> = {}

                    for (const cAttr of childAttrsResult) {
                        if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue

                        const isEnumRef = cAttr.data_type === 'REF' && cAttr.target_object_kind === 'enumeration'
                        const hasChildUserValue =
                            Object.prototype.hasOwnProperty.call(rowData, cAttr.column_name) ||
                            Object.prototype.hasOwnProperty.call(rowData, cAttr.codename)
                        let cRaw = rowData[cAttr.column_name] ?? rowData[cAttr.codename]

                        if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasChildUserValue) {
                            return res.status(400).json({ error: `Field is read-only: ${tAttr.codename}.${cAttr.codename}` })
                        }

                        if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                            const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                            if (defaultEnumValueId) {
                                try {
                                    await ensureEnumerationValueBelongsToTarget(
                                        ctx.manager,
                                        ctx.schemaIdent,
                                        defaultEnumValueId,
                                        cAttr.target_object_id
                                    )
                                    cRaw = defaultEnumValueId
                                } catch (error) {
                                    if (
                                        error instanceof Error &&
                                        error.message === 'Enumeration value does not belong to target enumeration'
                                    ) {
                                        cRaw = undefined
                                    } else {
                                        throw error
                                    }
                                }
                            }
                        }

                        const childSetConstantConfig =
                            cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set' ? getSetConstantConfig(cAttr.ui_config) : null
                        if (childSetConstantConfig) {
                            const providedRefId = resolveRefId(cRaw)
                            if (!providedRefId) {
                                cRaw = childSetConstantConfig.id
                            } else if (providedRefId !== childSetConstantConfig.id) {
                                return res.status(400).json({ error: `Field is read-only: ${tAttr.codename}.${cAttr.codename}` })
                            } else {
                                cRaw = childSetConstantConfig.id
                            }
                        }

                        if (cRaw === undefined || cRaw === null) {
                            if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                                let defaultValue: unknown
                                switch (cAttr.data_type) {
                                    case 'STRING':
                                        defaultValue = ''
                                        break
                                    case 'NUMBER':
                                        defaultValue = 0
                                        break
                                    default:
                                        defaultValue = ''
                                }
                                preparedRow[cAttr.column_name] = defaultValue
                            }
                            continue
                        }

                        try {
                            const cCoerced = coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules)

                            if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                                await ensureEnumerationValueBelongsToTarget(
                                    ctx.manager,
                                    ctx.schemaIdent,
                                    String(cCoerced),
                                    cAttr.target_object_id
                                )
                            }

                            preparedRow[cAttr.column_name] = cCoerced
                        } catch (err) {
                            return res.status(400).json({
                                error: `Invalid value for ${tAttr.codename}.${cAttr.codename}: ${
                                    err instanceof Error ? err.message : String(err)
                                }`
                            })
                        }
                    }

                    preparedRows.push(preparedRow)
                }

                tableDataEntries.push({ tabTableName, rows: preparedRows })
            }

            if (setClauses.length === 0 && tableDataEntries.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' })
            }

            setClauses.push('_upl_updated_at = NOW()')
            setClauses.push(`_upl_updated_by = $${paramIndex}`)
            values.push(ctx.userId)
            paramIndex++
            setClauses.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            values.push(rowId)
            const rowIdParamIndex = paramIndex
            let versionCheckClause = ''

            if (expectedVersion !== undefined) {
                values.push(expectedVersion)
                versionCheckClause = `AND COALESCE(_upl_version, 1) = $${rowIdParamIndex + 1}`
            }

            const hasTableUpdates = tableDataEntries.length > 0

            // Helper: execute the UPDATE + optional child row replace.
            // Throws UpdateFailure on business errors so the wrapping
            // transaction (if any) is rolled back automatically.
            const performBulkUpdate = async (mgr: DbExecutor) => {
                const updated = (await mgr.query(
                    `
                        UPDATE ${dataTableIdent}
                        SET ${setClauses.join(', ')}
                        WHERE id = $${rowIdParamIndex}
                                                    AND ${runtimeRowCondition}
                          AND COALESCE(_upl_locked, false) = false
                          ${versionCheckClause}
                        RETURNING id
                    `,
                    values
                )) as Array<{ id: string }>

                if (updated.length === 0) {
                    const exists = (await mgr.query(
                        `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                        [rowId]
                    )) as Array<{ id: string; _upl_locked?: boolean; _upl_version?: number }>

                    if (exists.length > 0 && exists[0]._upl_locked) {
                        throw new UpdateFailure(423, { error: 'Record is locked' })
                    }
                    if (exists.length > 0 && expectedVersion !== undefined) {
                        const actualVersion = Number(exists[0]._upl_version ?? 1)
                        if (actualVersion !== expectedVersion) {
                            throw new UpdateFailure(409, {
                                error: 'Version mismatch',
                                expectedVersion,
                                actualVersion
                            })
                        }
                    }
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                // Replace child rows for each TABLE attribute using batch INSERT
                for (const { tabTableName, rows: childRows } of tableDataEntries) {
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                    // Soft-delete existing child rows
                    if (runtimeDeleteSetClause) {
                        await mgr.query(
                            `
                                UPDATE ${tabTableIdent}
                                SET ${runtimeDeleteSetClause},
                                    _upl_version = COALESCE(_upl_version, 1) + 1
                                WHERE _tp_parent_id = $2
                                  AND ${runtimeRowCondition}
                            `,
                            [ctx.userId, rowId]
                        )
                    } else {
                        await mgr.query(
                            `
                                DELETE FROM ${tabTableIdent}
                                WHERE _tp_parent_id = $1
                                  AND ${runtimeRowCondition}
                            `,
                            [rowId]
                        )
                    }

                    // Batch insert new child rows (single INSERT with multi-VALUES)
                    if (childRows.length > 0) {
                        const dataColSet = new Set<string>()
                        for (const rd of childRows) {
                            for (const cn of Object.keys(rd)) {
                                if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
                            }
                        }
                        const dataColumns = [...dataColSet]
                        const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
                        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                            headerCols.push(quoteIdentifier('workspace_id'))
                        }
                        if (ctx.userId) headerCols.push('_upl_created_by')
                        const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
                        const allValues: unknown[] = []
                        const valueTuples: string[] = []
                        let pIdx = 1

                        for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                            const rowData = childRows[rowIdx]
                            const ph: string[] = []
                            ph.push(`$${pIdx++}`)
                            allValues.push(rowId)
                            ph.push(`$${pIdx++}`)
                            allValues.push(rowIdx)
                            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                                ph.push(`$${pIdx++}`)
                                allValues.push(ctx.currentWorkspaceId)
                            }
                            if (ctx.userId) {
                                ph.push(`$${pIdx++}`)
                                allValues.push(ctx.userId)
                            }
                            for (const cn of dataColumns) {
                                ph.push(`$${pIdx++}`)
                                allValues.push(rowData[cn] ?? null)
                            }
                            valueTuples.push(`(${ph.join(', ')})`)
                        }

                        await mgr.query(
                            `INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`,
                            allValues
                        )
                    }
                }
            }

            try {
                if (hasTableUpdates) {
                    // Use DbExecutor transaction — creates savepoint when
                    // executor is already RLS-bound, or a new
                    // connection with proper isolation otherwise.
                    await ctx.manager.transaction(async (txManager) => {
                        await performBulkUpdate(txManager)
                    })
                } else {
                    await performBulkUpdate(ctx.manager)
                }
                return res.json({ status: 'ok' })
            } catch (e) {
                if (e instanceof UpdateFailure) {
                    return res.status(e.statusCode).json(e.body)
                }
                throw e
            }
        })
    )

    // ============ APPLICATION RUNTIME ROW CREATE ============
    const runtimeCreateBodySchema = z.object({
        catalogId: z.string().uuid().optional(),
        data: z.record(z.unknown())
    })

    const runtimeCopyBodySchema = z.object({
        catalogId: z.string().uuid().optional(),
        copyChildTables: z.boolean().optional()
    })

    router.post(
        '/:applicationId/runtime/rows',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId } = req.params

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

            const parsedBody = runtimeCreateBodySchema.safeParse(req.body)
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const { catalogId: requestedCatalogId, data } = parsedBody.data

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                catalog.lifecycleContract,
                catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )
            // Build column→value pairs from input data
            const columnValues: Array<{ column: string; value: unknown }> = []
            const safeAttrs = attrs.filter(
                (a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type) && a.data_type !== 'TABLE'
            )

            for (const attr of safeAttrs) {
                const hasUserValue =
                    Object.prototype.hasOwnProperty.call(data, attr.column_name) ||
                    Object.prototype.hasOwnProperty.call(data, attr.codename)
                let raw = data[attr.column_name] ?? data[attr.codename]

                const isEnumRef = attr.data_type === 'REF' && attr.target_object_kind === 'enumeration'
                const enumMode = getEnumPresentationMode(attr.ui_config)

                if (isEnumRef && enumMode === 'label' && hasUserValue) {
                    return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
                }

                if (raw === undefined && isEnumRef && typeof attr.target_object_id === 'string') {
                    const defaultEnumValueId = getDefaultEnumValueId(attr.ui_config)
                    if (defaultEnumValueId) {
                        try {
                            await ensureEnumerationValueBelongsToTarget(
                                ctx.manager,
                                ctx.schemaIdent,
                                defaultEnumValueId,
                                attr.target_object_id
                            )
                            raw = defaultEnumValueId
                        } catch (error) {
                            if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                                raw = undefined
                            } else {
                                throw error
                            }
                        }
                    }
                }

                const setConstantConfig =
                    attr.data_type === 'REF' && attr.target_object_kind === 'set' ? getSetConstantConfig(attr.ui_config) : null
                if (setConstantConfig) {
                    const providedRefId = resolveRefId(raw)
                    if (!providedRefId) {
                        raw = setConstantConfig.id
                    } else if (providedRefId !== setConstantConfig.id) {
                        return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
                    } else {
                        raw = setConstantConfig.id
                    }
                }

                if (raw === undefined) {
                    if (attr.is_required && attr.data_type !== 'BOOLEAN') {
                        return res.status(400).json({ error: `Required field missing: ${attr.codename}` })
                    }
                    continue
                }
                try {
                    const coerced = coerceRuntimeValue(raw, attr.data_type, attr.validation_rules)
                    if (attr.is_required && attr.data_type !== 'BOOLEAN' && coerced === null) {
                        return res.status(400).json({ error: `Required field cannot be set to null: ${attr.codename}` })
                    }

                    if (isEnumRef && typeof attr.target_object_id === 'string' && coerced) {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), attr.target_object_id)
                    }

                    columnValues.push({ column: attr.column_name, value: coerced })
                } catch (e) {
                    return res.status(400).json({ error: `Invalid value for ${attr.codename}: ${(e as Error).message}` })
                }
            }

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            const colNames = columnValues.map((cv) => quoteIdentifier(cv.column))
            const placeholders = columnValues.map((_, i) => `$${i + 1}`)
            const values = columnValues.map((cv) => cv.value)

            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                colNames.push(quoteIdentifier('workspace_id'))
                placeholders.push(`$${values.length + 1}`)
                values.push(ctx.currentWorkspaceId)
            }

            // Add audit field
            if (ctx.userId) {
                colNames.push('_upl_created_by')
                placeholders.push(`$${values.length + 1}`)
                values.push(ctx.userId)
            }

            const insertSql =
                colNames.length > 0
                    ? `INSERT INTO ${dataTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`
                    : `INSERT INTO ${dataTableIdent} DEFAULT VALUES RETURNING id`

            // Collect TABLE-type data from request body for child row insertion
            const tableAttrsForCreate = attrs.filter((a) => a.data_type === 'TABLE')
            const tableDataEntries: Array<{ attr: (typeof attrs)[number]; rows: Array<Record<string, unknown>>; tabTableName: string }> = []
            for (const tAttr of tableAttrsForCreate) {
                const raw = data[tAttr.column_name] ?? data[tAttr.codename]
                if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
                    return res.status(400).json({ error: `Invalid value for ${tAttr.codename}: TABLE value must be an array` })
                }

                const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
                const rowCountError = getTableRowCountError(childRows.length, tAttr.codename, getTableRowLimits(tAttr.validation_rules))
                if (rowCountError) {
                    return res.status(400).json({ error: rowCountError })
                }

                if (childRows.length > 0) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) {
                        return res.status(400).json({ error: `Invalid tabular table name for ${tAttr.codename}` })
                    }

                    const childAttrsResult = (await ctx.manager.query(
                        `
                                                        SELECT id, codename, column_name, data_type, is_required, validation_rules,
                                                                     target_object_id, target_object_kind, ui_config
                            FROM ${ctx.schemaIdent}._app_attributes
                            WHERE parent_attribute_id = $1
                              AND _upl_deleted = false
                              AND _app_deleted = false
                            ORDER BY sort_order ASC
                        `,
                        [tAttr.id]
                    )) as Array<{
                        id: string
                        codename: string
                        column_name: string
                        data_type: string
                        is_required: boolean
                        validation_rules?: Record<string, unknown>
                        target_object_id?: string | null
                        target_object_kind?: string | null
                        ui_config?: Record<string, unknown>
                    }>

                    const preparedRows: Array<Record<string, unknown>> = []

                    for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                        const rowData = childRows[rowIdx]
                        if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
                            return res.status(400).json({ error: `Invalid row ${rowIdx + 1} for ${tAttr.codename}: row must be an object` })
                        }

                        const preparedRow: Record<string, unknown> = {}
                        for (const cAttr of childAttrsResult) {
                            if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
                            const isEnumRef = cAttr.data_type === 'REF' && cAttr.target_object_kind === 'enumeration'
                            const hasUserValue =
                                Object.prototype.hasOwnProperty.call(rowData, cAttr.column_name) ||
                                Object.prototype.hasOwnProperty.call(rowData, cAttr.codename)
                            let cRaw = rowData[cAttr.column_name] ?? rowData[cAttr.codename]

                            if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasUserValue) {
                                return res.status(400).json({ error: `Field is read-only: ${tAttr.codename}.${cAttr.codename}` })
                            }

                            if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                                const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                                if (defaultEnumValueId) {
                                    try {
                                        await ensureEnumerationValueBelongsToTarget(
                                            ctx.manager,
                                            ctx.schemaIdent,
                                            defaultEnumValueId,
                                            cAttr.target_object_id
                                        )
                                        cRaw = defaultEnumValueId
                                    } catch (error) {
                                        if (
                                            error instanceof Error &&
                                            error.message === 'Enumeration value does not belong to target enumeration'
                                        ) {
                                            cRaw = undefined
                                        } else {
                                            throw error
                                        }
                                    }
                                }
                            }

                            const childSetConstantConfig =
                                cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set'
                                    ? getSetConstantConfig(cAttr.ui_config)
                                    : null
                            if (childSetConstantConfig) {
                                const providedRefId = resolveRefId(cRaw)
                                if (!providedRefId) {
                                    cRaw = childSetConstantConfig.id
                                } else if (providedRefId !== childSetConstantConfig.id) {
                                    return res.status(400).json({ error: `Field is read-only: ${tAttr.codename}.${cAttr.codename}` })
                                } else {
                                    cRaw = childSetConstantConfig.id
                                }
                            }

                            if (cRaw === undefined || cRaw === null) {
                                if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                                    return res.status(400).json({ error: `Required field missing: ${tAttr.codename}.${cAttr.codename}` })
                                }
                                continue
                            }

                            try {
                                const cCoerced = coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules)
                                if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                                    await ensureEnumerationValueBelongsToTarget(
                                        ctx.manager,
                                        ctx.schemaIdent,
                                        String(cCoerced),
                                        cAttr.target_object_id
                                    )
                                }
                                preparedRow[cAttr.column_name] = cCoerced
                            } catch (err) {
                                return res.status(400).json({
                                    error: `Invalid value for ${tAttr.codename}.${cAttr.codename}: ${
                                        err instanceof Error ? err.message : String(err)
                                    }`
                                })
                            }
                        }

                        preparedRows.push(preparedRow)
                    }

                    tableDataEntries.push({ attr: tAttr, rows: preparedRows, tabTableName })
                }
            }

            // Use transaction if TABLE data is present to ensure atomicity
            // Helper: insert parent row + batch-insert child rows
            const performCreate = async (mgr: DbExecutor): Promise<string> => {
                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    const limitState = await enforceCatalogWorkspaceLimit(mgr, {
                        schemaName: ctx.schemaName,
                        objectId: catalog.id,
                        tableName: catalog.table_name,
                        workspaceId: ctx.currentWorkspaceId,
                        runtimeRowCondition
                    })

                    if (!limitState.canCreate) {
                        throw new UpdateFailure(409, {
                            error: 'Workspace catalog row limit reached',
                            code: 'WORKSPACE_LIMIT_REACHED',
                            details: limitState
                        })
                    }
                }

                const [inserted] = (await mgr.query(insertSql, values)) as Array<{ id: string }>
                const parentId = inserted.id

                for (const { rows: childRows, tabTableName } of tableDataEntries) {
                    if (childRows.length === 0) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                    // Collect union of all data columns for batch INSERT
                    const dataColSet = new Set<string>()
                    for (const rd of childRows) {
                        for (const cn of Object.keys(rd)) {
                            if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
                        }
                    }
                    const dataColumns = [...dataColSet]
                    const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
                    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                        headerCols.push(quoteIdentifier('workspace_id'))
                    }
                    if (ctx.userId) headerCols.push('_upl_created_by')
                    const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
                    const allValues: unknown[] = []
                    const valueTuples: string[] = []
                    let pIdx = 1

                    for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                        const rowData = childRows[rowIdx]
                        const ph: string[] = []
                        ph.push(`$${pIdx++}`)
                        allValues.push(parentId)
                        ph.push(`$${pIdx++}`)
                        allValues.push(rowIdx)
                        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(ctx.currentWorkspaceId)
                        }
                        if (ctx.userId) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(ctx.userId)
                        }
                        for (const cn of dataColumns) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(rowData[cn] ?? null)
                        }
                        valueTuples.push(`(${ph.join(', ')})`)
                    }

                    await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, allValues)
                }

                return parentId
            }

            let parentId: string
            if (tableDataEntries.length > 0 || (ctx.workspacesEnabled && ctx.currentWorkspaceId)) {
                try {
                    parentId = await ctx.manager.transaction(async (txManager) => {
                        return performCreate(txManager)
                    })
                } catch (error) {
                    if (error instanceof UpdateFailure) {
                        return res.status(error.statusCode).json(error.body)
                    }
                    throw error
                }
            } else {
                try {
                    parentId = await performCreate(ctx.manager)
                } catch (error) {
                    if (error instanceof UpdateFailure) {
                        return res.status(error.statusCode).json(error.body)
                    }
                    throw error
                }
            }
            return res.status(201).json({ id: parentId, status: 'created' })
        })
    )

    // ============ APPLICATION RUNTIME ROW COPY ============
    router.post(
        '/:applicationId/runtime/rows/:rowId/copy',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, rowId } = req.params
            if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

            const parsedBody = runtimeCopyBodySchema.safeParse(req.body ?? {})
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

            const {
                catalog,
                attrs,
                error: catalogError
            } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, parsedBody.data.catalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
            const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
            const tableAttrs = safeAttrs.filter((a) => a.data_type === 'TABLE')

            const hasRequiredChildTables = tableAttrs.some((attr) => {
                const { minRows } = getTableRowLimits(attr.validation_rules)
                return Boolean(attr.is_required) || (minRows !== null && minRows > 0)
            })
            const copyChildTables = hasRequiredChildTables ? true : parsedBody.data.copyChildTables !== false
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                catalog.lifecycleContract,
                catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            const sourceRows = (await ctx.manager.query(
                `
                    SELECT *
                    FROM ${dataTableIdent}
                    WHERE id = $1
                      AND ${runtimeRowCondition}
                `,
                [rowId]
            )) as Array<Record<string, unknown>>

            if (sourceRows.length === 0) return res.status(404).json({ error: 'Row not found' })
            if (sourceRows[0]._upl_locked) return res.status(423).json({ error: 'Record is locked' })
            const sourceRow = sourceRows[0]

            const insertColumns = nonTableAttrs.map((attr) => quoteIdentifier(attr.column_name))
            const insertValues = nonTableAttrs.map((attr) => sourceRow[attr.column_name] ?? null)
            const placeholders = insertValues.map((_, index) => `$${index + 1}`)
            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                insertColumns.push(quoteIdentifier('workspace_id'))
                insertValues.push(ctx.currentWorkspaceId)
                placeholders.push(`$${insertValues.length}`)
            }
            if (ctx.userId) {
                insertColumns.push('_upl_created_by')
                insertValues.push(ctx.userId)
                placeholders.push(`$${insertValues.length}`)
            }

            const performCopy = async (mgr: DbExecutor) => {
                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    const limitState = await enforceCatalogWorkspaceLimit(mgr, {
                        schemaName: ctx.schemaName,
                        objectId: catalog.id,
                        tableName: catalog.table_name,
                        workspaceId: ctx.currentWorkspaceId,
                        runtimeRowCondition
                    })

                    if (!limitState.canCreate) {
                        throw new UpdateFailure(409, {
                            error: 'Workspace catalog row limit reached',
                            code: 'WORKSPACE_LIMIT_REACHED',
                            details: limitState
                        })
                    }
                }

                const [insertedParent] = (await mgr.query(
                    `INSERT INTO ${dataTableIdent} (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
                    insertValues
                )) as Array<{ id: string }>

                if (copyChildTables) {
                    for (const tableAttr of tableAttrs) {
                        const { minRows } = getTableRowLimits(tableAttr.validation_rules)
                        const fallbackTabTableName = generateChildTableName(tableAttr.id)
                        const tabTableName =
                            typeof tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tableAttr.column_name)
                                ? tableAttr.column_name
                                : fallbackTabTableName
                        if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                        const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                        const childAttrs = (await mgr.query(
                            `
                                SELECT codename, column_name
                                FROM ${ctx.schemaIdent}._app_attributes
                                WHERE parent_attribute_id = $1
                                  AND _upl_deleted = false
                                  AND _app_deleted = false
                                ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
                            `,
                            [tableAttr.id]
                        )) as Array<{ codename: string; column_name: string }>

                        const validChildColumns = childAttrs
                            .map((attr) => attr.column_name)
                            .filter((column) => IDENTIFIER_REGEX.test(column))
                        const sourceChildRows = (await mgr.query(
                            `
                                SELECT ${
                                    validChildColumns.length > 0
                                        ? validChildColumns.map((column) => quoteIdentifier(column)).join(', ') + ','
                                        : ''
                                }
                                       _tp_sort_order
                                FROM ${tabTableIdent}
                                WHERE _tp_parent_id = $1
                                                                    AND ${runtimeRowCondition}
                                ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
                            `,
                            [rowId]
                        )) as Array<Record<string, unknown>>

                        if (minRows !== null && sourceChildRows.length < minRows) {
                            throw new UpdateFailure(400, {
                                error: `TABLE ${tableAttr.codename} requires at least ${minRows} row(s)`
                            })
                        }

                        if (sourceChildRows.length === 0) continue

                        const headerColumns = [
                            '_tp_parent_id',
                            '_tp_sort_order',
                            ...(ctx.workspacesEnabled && ctx.currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
                            ...(ctx.userId ? ['_upl_created_by'] : [])
                        ]
                        const allColumns = [...headerColumns, ...validChildColumns.map((column) => quoteIdentifier(column))]
                        const values: unknown[] = []
                        const valueTuples: string[] = []
                        let paramIndex = 1
                        for (let index = 0; index < sourceChildRows.length; index++) {
                            const sourceChild = sourceChildRows[index]
                            const tuple: string[] = []
                            tuple.push(`$${paramIndex++}`)
                            values.push(insertedParent.id)
                            tuple.push(`$${paramIndex++}`)
                            values.push(index)
                            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                                tuple.push(`$${paramIndex++}`)
                                values.push(ctx.currentWorkspaceId)
                            }
                            if (ctx.userId) {
                                tuple.push(`$${paramIndex++}`)
                                values.push(ctx.userId)
                            }
                            for (const column of validChildColumns) {
                                tuple.push(`$${paramIndex++}`)
                                values.push(sourceChild[column] ?? null)
                            }
                            valueTuples.push(`(${tuple.join(', ')})`)
                        }
                        await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, values)
                    }
                }

                return insertedParent.id
            }

            try {
                const copiedId =
                    tableAttrs.length > 0 || (ctx.workspacesEnabled && ctx.currentWorkspaceId)
                        ? await ctx.manager.transaction((tx) => performCopy(tx))
                        : await performCopy(ctx.manager)
                return res.status(201).json({
                    id: copiedId,
                    status: 'created',
                    copyOptions: { copyChildTables },
                    hasRequiredChildTables
                })
            } catch (error) {
                if (error instanceof UpdateFailure) {
                    return res.status(error.statusCode).json(error.body)
                }
                throw error
            }
        })
    )

    // ============ APPLICATION RUNTIME ROW GET (raw for edit) ============
    router.get(
        '/:applicationId/runtime/rows/:rowId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, rowId } = req.params
            if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
            const catalogId = typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
            if (catalogId && !UUID_REGEX.test(catalogId)) return res.status(400).json({ error: 'Invalid catalog ID format' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, catalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                catalog.lifecycleContract,
                catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )

            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && a.data_type !== 'TABLE')
            const selectColumns = ['id', ...safeAttrs.map((a) => quoteIdentifier(a.column_name))]
            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`

            const rows = (await ctx.manager.query(
                `
                    SELECT ${selectColumns.join(', ')}
                    FROM ${dataTableIdent}
                    WHERE id = $1
                      AND ${runtimeRowCondition}
                `,
                [rowId]
            )) as Array<Record<string, unknown>>

            if (rows.length === 0) return res.status(404).json({ error: 'Row not found' })

            const row = rows[0]
            const rawData: Record<string, unknown> = {}
            for (const attr of safeAttrs) {
                const raw = row[attr.column_name] ?? null
                // pg returns NUMERIC as string — coerce NUMBER attrs to JS number
                rawData[attr.column_name] = attr.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
            }

            return res.json({ id: String(row.id), data: rawData })
        })
    )

    // ============ APPLICATION RUNTIME ROW DELETE (soft) ============
    router.delete(
        '/:applicationId/runtime/rows/:rowId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, rowId } = req.params
            if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
            const catalogId = typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
            if (catalogId && !UUID_REGEX.test(catalogId)) return res.status(400).json({ error: 'Invalid catalog ID format' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, catalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                catalog.lifecycleContract,
                catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )
            const runtimeDeleteSetClause = isSoftDeleteLifecycle(catalog.lifecycleContract)
                ? buildRuntimeSoftDeleteSetClause('$1', catalog.lifecycleContract, catalog.config)
                : null

            // Cascade soft-delete to child tables if any TABLE attributes exist
            const tableAttrsForDelete = attrs.filter((a) => a.data_type === 'TABLE')
            const needsTransaction = isSoftDeleteLifecycle(catalog.lifecycleContract) && tableAttrsForDelete.length > 0

            // Helper: soft-delete parent row + cascade to child tables
            const performDelete = async (mgr: DbExecutor) => {
                const deleted = runtimeDeleteSetClause
                    ? ((await mgr.query(
                          `
                              UPDATE ${dataTableIdent}
                              SET ${runtimeDeleteSetClause},
                                  _upl_version = COALESCE(_upl_version, 1) + 1
                              WHERE id = $2
                                AND ${runtimeRowCondition}
                                AND COALESCE(_upl_locked, false) = false
                              RETURNING id
                          `,
                          [ctx.userId, rowId]
                      )) as Array<{ id: string }>)
                    : ((await mgr.query(
                          `
                              DELETE FROM ${dataTableIdent}
                              WHERE id = $1
                                AND ${runtimeRowCondition}
                                AND COALESCE(_upl_locked, false) = false
                              RETURNING id
                          `,
                          [rowId]
                      )) as Array<{ id: string }>)

                if (deleted.length === 0) {
                    const exists = (await mgr.query(
                        `SELECT id, _upl_locked FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                        [rowId]
                    )) as Array<{ id: string; _upl_locked?: boolean }>
                    if (exists.length > 0 && exists[0]._upl_locked) {
                        throw new UpdateFailure(423, { error: 'Record is locked' })
                    }
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                if (!runtimeDeleteSetClause) {
                    return
                }

                // Soft-delete child rows in TABLE child tables
                for (const tAttr of tableAttrsForDelete) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
                    await mgr.query(
                        `
                            UPDATE ${tabTableIdent}
                            SET ${runtimeDeleteSetClause},
                                _upl_version = COALESCE(_upl_version, 1) + 1
                            WHERE _tp_parent_id = $2
                              AND ${runtimeRowCondition}
                        `,
                        [ctx.userId, rowId]
                    )
                }
            }

            try {
                if (needsTransaction) {
                    await ctx.manager.transaction(async (txManager) => {
                        await performDelete(txManager)
                    })
                } else {
                    await performDelete(ctx.manager)
                }
                return res.json({ status: 'deleted' })
            } catch (e) {
                if (e instanceof UpdateFailure) {
                    return res.status(e.statusCode).json(e.body)
                }
                throw e
            }
        })
    )

    // ============ APPLICATION RUNTIME TABULAR PART — SHARED HELPERS ============

    /**
     * Resolve a TABLE attribute and its child table for tabular CRUD operations.
     */
    const resolveTabularContext = async (manager: DbExecutor, schemaIdent: string, catalogId: string, attributeId: string) => {
        if (!UUID_REGEX.test(catalogId) || !UUID_REGEX.test(attributeId)) {
            return { error: 'Invalid catalog or attribute ID format' } as const
        }

        // Find the catalog
        const catalogs = (await manager.query(
            `
                SELECT id, codename, table_name, config
                FROM ${schemaIdent}._app_objects
                WHERE id = $1 AND kind = 'catalog'
                  AND _upl_deleted = false
                  AND _app_deleted = false
            `,
            [catalogId]
        )) as Array<{ id: string; codename: string; table_name: string; config?: Record<string, unknown> | null }>

        if (catalogs.length === 0) return { error: 'Catalog not found' } as const

        const catalog = catalogs[0]
        if (!IDENTIFIER_REGEX.test(catalog.table_name)) return { error: 'Invalid table name' } as const
        const lifecycleContract = resolveApplicationLifecycleContractFromConfig(catalog.config)

        // Find the TABLE attribute
        const tableAttrs = (await manager.query(
            `
                SELECT id, codename, column_name, data_type, validation_rules
                FROM ${schemaIdent}._app_attributes
                WHERE id = $1 AND object_id = $2 AND data_type = 'TABLE'
                  AND parent_attribute_id IS NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
            `,
            [attributeId, catalogId]
        )) as Array<{ id: string; codename: string; column_name: string; data_type: string; validation_rules?: Record<string, unknown> }>

        if (tableAttrs.length === 0) return { error: 'TABLE attribute not found' } as const

        const tableAttr = tableAttrs[0]
        const fallbackTabTableName = generateChildTableName(tableAttr.id)
        const tabTableName =
            typeof tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tableAttr.column_name)
                ? tableAttr.column_name
                : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) return { error: 'Invalid tabular table name' } as const

        // Fetch child attributes
        const childAttrs = (await manager.query(
            `
                                SELECT id, codename, column_name, data_type, is_required, validation_rules,
                                             target_object_id, target_object_kind, ui_config
                FROM ${schemaIdent}._app_attributes
                WHERE parent_attribute_id = $1
                  AND _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
            `,
            [attributeId]
        )) as Array<{
            id: string
            codename: string
            column_name: string
            data_type: string
            is_required: boolean
            validation_rules?: Record<string, unknown>
            target_object_id?: string | null
            target_object_kind?: string | null
            ui_config?: Record<string, unknown>
        }>

        return {
            error: null,
            catalog,
            lifecycleContract,
            tableAttr,
            tabTableName,
            tabTableIdent: `${schemaIdent}.${quoteIdentifier(tabTableName)}`,
            parentTableIdent: `${schemaIdent}.${quoteIdentifier(catalog.table_name)}`,
            childAttrs
        } as const
    }

    // ============ APPLICATION RUNTIME TABULAR — LIST CHILD ROWS ============
    router.get(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, recordId, attributeId } = req.params
            if (!UUID_REGEX.test(recordId)) return res.status(400).json({ error: 'Invalid record ID format' })
            const catalogId = typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
            if (!catalogId || !UUID_REGEX.test(catalogId)) return res.status(400).json({ error: 'catalogId query parameter is required' })

            // Server-side pagination (optional, defaults to all rows)
            const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
            const offsetParam = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined
            const limit = Number.isFinite(limitParam) && (limitParam as number) > 0 ? (limitParam as number) : 1000
            const offset = Number.isFinite(offsetParam) && (offsetParam as number) >= 0 ? (offsetParam as number) : 0

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'createContent')) return

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                tc.lifecycleContract,
                tc.catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )

            const safeChildAttrs = tc.childAttrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
            const selectCols = ['id', '_tp_sort_order', ...safeChildAttrs.map((a) => quoteIdentifier(a.column_name))]

            // Get total count
            const countResult = (await ctx.manager.query(
                `
                    SELECT COUNT(*)::int AS total
                    FROM ${tc.tabTableIdent}
                    WHERE _tp_parent_id = $1
                                            AND ${runtimeRowCondition}
                `,
                [recordId]
            )) as Array<{ total: number }>
            const total = countResult[0]?.total ?? 0

            const rows = (await ctx.manager.query(
                `
                    SELECT ${selectCols.join(', ')}
                    FROM ${tc.tabTableIdent}
                    WHERE _tp_parent_id = $1
                                            AND ${runtimeRowCondition}
                    ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
                    LIMIT $2 OFFSET $3
                `,
                [recordId, limit, offset]
            )) as Array<Record<string, unknown>>

            const items = rows.map((row) => {
                const mapped: Record<string, unknown> & { id: string } = { id: String(row.id) }
                mapped._tp_sort_order = row._tp_sort_order ?? 0
                for (const attr of safeChildAttrs) {
                    const raw = row[attr.column_name] ?? null
                    // pg returns NUMERIC as string — coerce NUMBER attrs to JS number
                    mapped[attr.column_name] = attr.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
                }
                return mapped
            })

            return res.json({ items, total })
        })
    )

    // ============ APPLICATION RUNTIME TABULAR — CREATE CHILD ROW ============
    router.post(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, recordId, attributeId } = req.params
            if (!UUID_REGEX.test(recordId)) return res.status(400).json({ error: 'Invalid record ID format' })
            const catalogId = typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
            if (!catalogId || !UUID_REGEX.test(catalogId)) return res.status(400).json({ error: 'catalogId query parameter is required' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'editContent')) return

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                tc.lifecycleContract,
                tc.catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )
            const data = (req.body?.data ?? req.body) as Record<string, unknown>
            const sortOrder = typeof data._tp_sort_order === 'number' ? data._tp_sort_order : 0

            const colNames: string[] = ['_tp_parent_id', '_tp_sort_order']
            const placeholders: string[] = ['$1', '$2']
            const values: unknown[] = [recordId, sortOrder]
            let pIdx = 3

            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                colNames.push(quoteIdentifier('workspace_id'))
                placeholders.push(`$${pIdx}`)
                values.push(ctx.currentWorkspaceId)
                pIdx++
            }

            if (ctx.userId) {
                colNames.push('_upl_created_by')
                placeholders.push(`$${pIdx}`)
                values.push(ctx.userId)
                pIdx++
            }

            for (const cAttr of tc.childAttrs) {
                if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
                const isEnumRef = cAttr.data_type === 'REF' && cAttr.target_object_kind === 'enumeration'
                const hasUserValue =
                    Object.prototype.hasOwnProperty.call(data, cAttr.column_name) ||
                    Object.prototype.hasOwnProperty.call(data, cAttr.codename)
                let raw = data[cAttr.column_name] ?? data[cAttr.codename]

                if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasUserValue) {
                    return res.status(400).json({ error: `Field is read-only: ${tc.tableAttr.codename}.${cAttr.codename}` })
                }

                if (raw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                    const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                    if (defaultEnumValueId) {
                        try {
                            await ensureEnumerationValueBelongsToTarget(
                                ctx.manager,
                                ctx.schemaIdent,
                                defaultEnumValueId,
                                cAttr.target_object_id
                            )
                            raw = defaultEnumValueId
                        } catch (error) {
                            if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                                raw = undefined
                            } else {
                                throw error
                            }
                        }
                    }
                }

                const setConstantConfig =
                    cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set' ? getSetConstantConfig(cAttr.ui_config) : null
                if (setConstantConfig) {
                    const providedRefId = resolveRefId(raw)
                    if (!providedRefId) {
                        raw = setConstantConfig.id
                    } else if (providedRefId !== setConstantConfig.id) {
                        return res.status(400).json({ error: `Field is read-only: ${tc.tableAttr.codename}.${cAttr.codename}` })
                    } else {
                        raw = setConstantConfig.id
                    }
                }

                if (raw === undefined || raw === null) {
                    // Inline editing: user adds an empty row, then fills fields.
                    // For required (NOT NULL) columns, insert a type-appropriate default
                    // to satisfy the DB constraint; user will edit the value afterwards.
                    if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                        let defaultValue: unknown
                        switch (cAttr.data_type) {
                            case 'STRING':
                                defaultValue = ''
                                break
                            case 'NUMBER':
                                defaultValue = 0
                                break
                            default:
                                defaultValue = ''
                        }
                        colNames.push(quoteIdentifier(cAttr.column_name))
                        placeholders.push(`$${pIdx}`)
                        values.push(defaultValue)
                        pIdx++
                    }
                    continue
                }
                try {
                    const coerced = coerceRuntimeValue(raw, cAttr.data_type, cAttr.validation_rules)
                    if (isEnumRef && typeof cAttr.target_object_id === 'string' && coerced) {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cAttr.target_object_id)
                    }
                    colNames.push(quoteIdentifier(cAttr.column_name))
                    placeholders.push(`$${pIdx}`)
                    values.push(coerced)
                    pIdx++
                } catch (err) {
                    return res.status(400).json({
                        error: `Invalid value for ${tc.tableAttr.codename}.${cAttr.codename}: ${
                            err instanceof Error ? err.message : String(err)
                        }`
                    })
                }
            }

            await ctx.manager.query('BEGIN')
            try {
                const parentRows = (await ctx.manager.query(
                    `
                        SELECT id, _upl_locked
                        FROM ${tc.parentTableIdent}
                        WHERE id = $1
                                                    AND ${runtimeRowCondition}
                        FOR UPDATE
                    `,
                    [recordId]
                )) as Array<{ id: string; _upl_locked?: boolean }>

                if (parentRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(404).json({ error: 'Parent record not found' })
                }
                if (parentRows[0]._upl_locked) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(423).json({ error: 'Parent record is locked' })
                }

                const { minRows, maxRows } = getTableRowLimits(tc.tableAttr.validation_rules)
                const activeCountRows = (await ctx.manager.query(
                    `
                        SELECT COUNT(*)::int AS cnt
                        FROM ${tc.tabTableIdent}
                        WHERE _tp_parent_id = $1
                                                    AND ${runtimeRowCondition}
                    `,
                    [recordId]
                )) as Array<{ cnt: number }>
                const activeCount = Number(activeCountRows[0]?.cnt ?? 0)
                const maxRowsError = getTableRowCountError(activeCount + 1, tc.tableAttr.codename, { minRows, maxRows })
                if (maxRowsError && maxRows !== null) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(400).json({ error: maxRowsError })
                }

                const [inserted] = (await ctx.manager.query(
                    `INSERT INTO ${tc.tabTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
                    values
                )) as Array<{ id: string }>

                await ctx.manager.query('COMMIT')
                return res.status(201).json({ id: inserted.id, status: 'created' })
            } catch (error) {
                await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                throw error
            }
        })
    )

    const tabularUpdateBodySchema = z
        .object({
            data: z.record(z.unknown()).optional(),
            expectedVersion: z.number().int().positive().optional()
        })
        .passthrough()

    // ============ APPLICATION RUNTIME TABULAR — UPDATE CHILD ROW ============
    router.patch(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId/:childRowId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, recordId, attributeId, childRowId } = req.params
            if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
                return res.status(400).json({ error: 'Invalid ID format' })
            }
            const catalogId = typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
            if (!catalogId || !UUID_REGEX.test(catalogId)) return res.status(400).json({ error: 'catalogId query parameter is required' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'createContent')) return

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                tc.lifecycleContract,
                tc.catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )

            const parsedBody = tabularUpdateBodySchema.safeParse(req.body ?? {})
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            // Check parent record is not locked
            const parentRows = (await ctx.manager.query(
                `
                    SELECT id, _upl_locked
                    FROM ${tc.parentTableIdent}
                    WHERE id = $1
                                            AND ${runtimeRowCondition}
                `,
                [recordId]
            )) as Array<{ id: string; _upl_locked?: boolean }>

            if (parentRows.length === 0) return res.status(404).json({ error: 'Parent record not found' })
            if (parentRows[0]._upl_locked) return res.status(423).json({ error: 'Parent record is locked' })

            const { expectedVersion } = parsedBody.data
            const data = (() => {
                if (parsedBody.data.data) {
                    return parsedBody.data.data
                }
                const bodyData = parsedBody.data as Record<string, unknown>
                const { expectedVersion: _ignoredExpectedVersion, ...raw } = bodyData
                return raw
            })() as Record<string, unknown>
            const setClauses: string[] = []
            const values: unknown[] = []
            let pIdx = 1

            for (const cAttr of tc.childAttrs) {
                if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
                const raw = data[cAttr.column_name] ?? data[cAttr.codename]
                if (raw === undefined) continue
                let normalizedRaw = raw
                if (
                    cAttr.data_type === 'REF' &&
                    cAttr.target_object_kind === 'enumeration' &&
                    getEnumPresentationMode(cAttr.ui_config) === 'label'
                ) {
                    return res.status(400).json({ error: `Field is read-only: ${tc.tableAttr.codename}.${cAttr.codename}` })
                }
                const setConstantConfig =
                    cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set' ? getSetConstantConfig(cAttr.ui_config) : null
                if (setConstantConfig) {
                    const providedRefId = resolveRefId(raw)
                    if (!providedRefId) {
                        normalizedRaw = setConstantConfig.id
                    } else if (providedRefId !== setConstantConfig.id) {
                        return res.status(400).json({ error: `Field is read-only: ${tc.tableAttr.codename}.${cAttr.codename}` })
                    } else {
                        normalizedRaw = setConstantConfig.id
                    }
                }
                if (normalizedRaw === null && cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                    return res
                        .status(400)
                        .json({ error: `Required field cannot be set to null: ${tc.tableAttr.codename}.${cAttr.codename}` })
                }
                try {
                    const coerced = coerceRuntimeValue(normalizedRaw, cAttr.data_type, cAttr.validation_rules)
                    if (
                        cAttr.data_type === 'REF' &&
                        cAttr.target_object_kind === 'enumeration' &&
                        typeof cAttr.target_object_id === 'string' &&
                        coerced
                    ) {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cAttr.target_object_id)
                    }
                    setClauses.push(`${quoteIdentifier(cAttr.column_name)} = $${pIdx}`)
                    values.push(coerced)
                    pIdx++
                } catch (err) {
                    return res.status(400).json({
                        error: `Invalid value for ${tc.tableAttr.codename}.${cAttr.codename}: ${
                            err instanceof Error ? err.message : String(err)
                        }`
                    })
                }
            }

            // Handle _tp_sort_order update
            if (typeof data._tp_sort_order === 'number') {
                setClauses.push(`_tp_sort_order = $${pIdx}`)
                values.push(data._tp_sort_order)
                pIdx++
            }

            if (setClauses.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' })
            }

            setClauses.push('_upl_updated_at = NOW()')
            setClauses.push(`_upl_updated_by = $${pIdx}`)
            values.push(ctx.userId)
            pIdx++
            setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

            values.push(childRowId)
            values.push(recordId)
            const childIdParam = pIdx
            const parentIdParam = pIdx + 1

            let expectedVersionClause = ''
            if (expectedVersion !== undefined) {
                values.push(expectedVersion)
                expectedVersionClause = `AND COALESCE(_upl_version, 1) = $${parentIdParam + 1}`
            }

            const updated = (await ctx.manager.query(
                `
                    UPDATE ${tc.tabTableIdent}
                    SET ${setClauses.join(', ')}
                    WHERE id = $${childIdParam}
                      AND _tp_parent_id = $${parentIdParam}
                                            AND ${runtimeRowCondition}
                                            AND NOT EXISTS (
                                                    SELECT 1 FROM ${tc.parentTableIdent}
                                                    WHERE id = $${parentIdParam} AND ${runtimeRowCondition} AND COALESCE(_upl_locked, false) = true
                                            )
                      ${expectedVersionClause}
                    RETURNING id
                `,
                values
            )) as Array<{ id: string }>

            if (updated.length === 0) {
                const parentLockRows = (await ctx.manager.query(
                    `
                        SELECT _upl_locked
                        FROM ${tc.parentTableIdent}
                        WHERE id = $1
                                                    AND ${runtimeRowCondition}
                        LIMIT 1
                    `,
                    [recordId]
                )) as Array<{ _upl_locked?: boolean }>

                if (parentLockRows.length > 0 && parentLockRows[0]._upl_locked) {
                    return res.status(423).json({ error: 'Parent record is locked' })
                }

                const childRows = (await ctx.manager.query(
                    `
                        SELECT id, _upl_version
                        FROM ${tc.tabTableIdent}
                        WHERE id = $1
                          AND _tp_parent_id = $2
                                                    AND ${runtimeRowCondition}
                        LIMIT 1
                    `,
                    [childRowId, recordId]
                )) as Array<{ id: string; _upl_version?: number }>

                if (childRows.length === 0) {
                    return res.status(404).json({ error: 'Child row not found' })
                }

                if (expectedVersion !== undefined) {
                    const actualVersion = Number(childRows[0]._upl_version ?? 1)
                    if (actualVersion !== expectedVersion) {
                        return res.status(409).json({
                            error: 'Version mismatch',
                            expectedVersion,
                            actualVersion
                        })
                    }
                }

                return res.status(404).json({ error: 'Child row not found' })
            }

            return res.json({ status: 'ok' })
        })
    )

    // ============ APPLICATION RUNTIME TABULAR — COPY CHILD ROW ============
    router.post(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId/:childRowId/copy',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, recordId, attributeId, childRowId } = req.params
            if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
                return res.status(400).json({ error: 'Invalid ID format' })
            }
            const catalogId = typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
            if (!catalogId || !UUID_REGEX.test(catalogId)) return res.status(400).json({ error: 'catalogId query parameter is required' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return
            if (!ensureRuntimePermission(res, ctx, 'createContent')) return

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                tc.lifecycleContract,
                tc.catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )

            await ctx.manager.query('BEGIN')
            try {
                const parentRows = (await ctx.manager.query(
                    `
                        SELECT id, _upl_locked
                        FROM ${tc.parentTableIdent}
                        WHERE id = $1
                                                    AND ${runtimeRowCondition}
                        FOR UPDATE
                    `,
                    [recordId]
                )) as Array<{ id: string; _upl_locked?: boolean }>

                if (parentRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(404).json({ error: 'Parent record not found' })
                }
                if (parentRows[0]._upl_locked) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(423).json({ error: 'Parent record is locked' })
                }

                const sourceRows = (await ctx.manager.query(
                    `
                        SELECT *
                        FROM ${tc.tabTableIdent}
                        WHERE id = $1
                          AND _tp_parent_id = $2
                                                    AND ${runtimeRowCondition}
                        LIMIT 1
                    `,
                    [childRowId, recordId]
                )) as Array<Record<string, unknown>>

                if (sourceRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(404).json({ error: 'Child row not found' })
                }
                const sourceRow = sourceRows[0]
                const sourceSortOrder = typeof sourceRow._tp_sort_order === 'number' ? sourceRow._tp_sort_order : 0

                const { minRows, maxRows } = getTableRowLimits(tc.tableAttr.validation_rules)
                const countRows = (await ctx.manager.query(
                    `
                        SELECT COUNT(*)::int AS cnt
                        FROM ${tc.tabTableIdent}
                        WHERE _tp_parent_id = $1
                                                    AND ${runtimeRowCondition}
                    `,
                    [recordId]
                )) as Array<{ cnt: number }>
                const activeCount = Number(countRows[0]?.cnt ?? 0)
                const maxRowsError = getTableRowCountError(activeCount + 1, tc.tableAttr.codename, { minRows, maxRows })
                if (maxRowsError && maxRows !== null) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(400).json({ error: maxRowsError })
                }

                await ctx.manager.query(
                    `
                        UPDATE ${tc.tabTableIdent}
                        SET _tp_sort_order = _tp_sort_order + 1,
                            _upl_updated_at = NOW(),
                            _upl_version = COALESCE(_upl_version, 1) + 1
                        WHERE _tp_parent_id = $1
                                                    AND ${runtimeRowCondition}
                          AND _tp_sort_order > $2
                    `,
                    [recordId, sourceSortOrder]
                )

                const copyColumns = tc.childAttrs.map((attr) => attr.column_name).filter((column) => IDENTIFIER_REGEX.test(column))
                const headerColumns = [
                    '_tp_parent_id',
                    '_tp_sort_order',
                    ...(ctx.workspacesEnabled && ctx.currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
                    ...(ctx.userId ? ['_upl_created_by'] : [])
                ]
                const allColumns = [...headerColumns, ...copyColumns.map((column) => quoteIdentifier(column))]
                const values: unknown[] = [recordId, sourceSortOrder + 1]
                const placeholders: string[] = ['$1', '$2']

                let paramIndex = 3
                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    placeholders.push(`$${paramIndex++}`)
                    values.push(ctx.currentWorkspaceId)
                }
                if (ctx.userId) {
                    placeholders.push(`$${paramIndex++}`)
                    values.push(ctx.userId)
                }
                for (const column of copyColumns) {
                    placeholders.push(`$${paramIndex++}`)
                    values.push(sourceRow[column] ?? null)
                }

                const [inserted] = (await ctx.manager.query(
                    `INSERT INTO ${tc.tabTableIdent} (${allColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
                    values
                )) as Array<{ id: string }>

                await ctx.manager.query('COMMIT')
                return res.status(201).json({ id: inserted.id, status: 'created' })
            } catch (error) {
                await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                throw error
            }
        })
    )

    // ============ APPLICATION RUNTIME TABULAR — DELETE CHILD ROW (soft) ============
    router.delete(
        '/:applicationId/runtime/rows/:recordId/tabular/:attributeId/:childRowId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, recordId, attributeId, childRowId } = req.params
            if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
                return res.status(400).json({ error: 'Invalid ID format' })
            }
            const catalogId = typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
            if (!catalogId || !UUID_REGEX.test(catalogId)) return res.status(400).json({ error: 'catalogId query parameter is required' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })
            const runtimeRowCondition = buildRuntimeActiveRowCondition(
                tc.lifecycleContract,
                tc.catalog.config,
                undefined,
                ctx.currentWorkspaceId
            )
            const runtimeDeleteSetClause = isSoftDeleteLifecycle(tc.lifecycleContract)
                ? buildRuntimeSoftDeleteSetClause('$1', tc.lifecycleContract, tc.catalog.config)
                : null

            await ctx.manager.query('BEGIN')
            try {
                const parentRows = (await ctx.manager.query(
                    `
                        SELECT id, _upl_locked
                        FROM ${tc.parentTableIdent}
                        WHERE id = $1
                                                    AND ${runtimeRowCondition}
                        FOR UPDATE
                    `,
                    [recordId]
                )) as Array<{ id: string; _upl_locked?: boolean }>

                if (parentRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(404).json({ error: 'Parent record not found' })
                }
                if (parentRows[0]._upl_locked) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(423).json({ error: 'Parent record is locked' })
                }

                const childRows = (await ctx.manager.query(
                    `
                        SELECT id
                        FROM ${tc.tabTableIdent}
                        WHERE id = $1
                          AND _tp_parent_id = $2
                                                    AND ${runtimeRowCondition}
                        LIMIT 1
                    `,
                    [childRowId, recordId]
                )) as Array<{ id: string }>

                if (childRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(404).json({ error: 'Child row not found' })
                }

                const { minRows } = getTableRowLimits(tc.tableAttr.validation_rules)
                if (minRows !== null) {
                    const activeCountRows = (await ctx.manager.query(
                        `
                            SELECT COUNT(*)::int AS cnt
                            FROM ${tc.tabTableIdent}
                            WHERE _tp_parent_id = $1
                                                            AND ${runtimeRowCondition}
                        `,
                        [recordId]
                    )) as Array<{ cnt: number }>
                    const activeCount = Number(activeCountRows[0]?.cnt ?? 0)
                    const minRowsError = getTableRowCountError(activeCount - 1, tc.tableAttr.codename, { minRows, maxRows: null })
                    if (minRowsError) {
                        await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                        return res.status(400).json({ error: minRowsError })
                    }
                }

                const deleted = runtimeDeleteSetClause
                    ? ((await ctx.manager.query(
                          `
                              UPDATE ${tc.tabTableIdent}
                              SET ${runtimeDeleteSetClause},
                                  _upl_version = COALESCE(_upl_version, 1) + 1
                              WHERE id = $2
                                AND _tp_parent_id = $3
                                AND ${runtimeRowCondition}
                              RETURNING id
                          `,
                          [ctx.userId, childRowId, recordId]
                      )) as Array<{ id: string }>)
                    : ((await ctx.manager.query(
                          `
                              DELETE FROM ${tc.tabTableIdent}
                              WHERE id = $1
                                AND _tp_parent_id = $2
                                AND ${runtimeRowCondition}
                              RETURNING id
                          `,
                          [childRowId, recordId]
                      )) as Array<{ id: string }>)

                if (deleted.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                    return res.status(404).json({ error: 'Child row not found' })
                }

                await ctx.manager.query('COMMIT')
                return res.json({ status: 'deleted' })
            } catch (error) {
                await ctx.manager.query('ROLLBACK').catch((e: unknown) => console.error('[applicationsRoutes] ROLLBACK failed:', e))
                throw error
            }
        })
    )

    // ============ CREATE APPLICATION ============
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema,
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional(),
                workspacesEnabled: z.boolean().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { name, description, slug, isPublic, workspacesEnabled, namePrimaryLocale, descriptionPrimaryLocale } = result.data
            const resolvedIsPublic = isPublic ?? false
            const resolvedWorkspacesEnabled = workspacesEnabled ?? false

            const sanitizedName = sanitizeLocalizedInput(name)
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }
            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            if (slug) {
                const existing = await findApplicationBySlug(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    slug
                )
                if (existing) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
            }

            let saved
            try {
                const provisionalSchemaName = generateSchemaName('00000000-0000-7000-8000-000000000000')
                if (
                    !provisionalSchemaName.startsWith('app_') ||
                    !isValidSchemaName(provisionalSchemaName) ||
                    !IDENTIFIER_REGEX.test(provisionalSchemaName)
                ) {
                    return res.status(400).json({ error: 'Invalid generated application schema name' })
                }

                saved = await createApplicationWithOwner(getRequestDbExecutor(req, getDbExecutor()), {
                    name: nameVlc,
                    description: descriptionVlc ?? null,
                    slug,
                    isPublic: resolvedIsPublic,
                    workspacesEnabled: resolvedWorkspacesEnabled,
                    userId,
                    resolveSchemaName: generateSchemaName,
                    validateSchemaName: (schemaName) =>
                        schemaName.startsWith('app_') && isValidSchemaName(schemaName) && IDENTIFIER_REGEX.test(schemaName)
                })
            } catch (error) {
                if (database.isSlugUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
                throw error
            }

            return res.status(201).json({
                id: saved.id,
                name: saved.name,
                description: saved.description,
                slug: saved.slug,
                isPublic: saved.isPublic,
                workspacesEnabled: saved.workspacesEnabled,
                version: saved.version || 1,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt,
                connectorsCount: 0,
                membersCount: 1,
                role: 'owner',
                accessType: 'member',
                permissions: ROLE_PERMISSIONS.owner,
                membershipState: ApplicationMembershipState.JOINED,
                canJoin: false,
                canLeave: false
            })
        })
    )

    // ============ COPY APPLICATION ============
    router.post(
        '/:applicationId/copy',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            await ensureApplicationAccess(ds, userId, applicationId, ['owner', 'admin'])

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema.optional(),
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional(),
                workspacesEnabled: z.boolean().optional(),
                copyConnector: z.boolean().optional(),
                copyAccess: z.boolean().optional().default(false)
            })

            const parsed = schema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const copyOptions = normalizeApplicationCopyOptions({
                copyConnector: parsed.data.copyConnector,
                copyAccess: parsed.data.copyAccess
            })
            const sourceApplication = await findApplicationCopySource(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (!sourceApplication) {
                return res.status(404).json({ error: 'Application not found' })
            }
            const resolvedIsPublic = parsed.data.isPublic ?? sourceApplication.isPublic
            const resolvedWorkspacesEnabled = parsed.data.workspacesEnabled ?? sourceApplication.workspacesEnabled

            const requestedName = parsed.data.name
                ? sanitizeLocalizedInput(parsed.data.name)
                : buildDefaultCopyNameInput(sourceApplication.name)
            if (Object.keys(requestedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceApplication.name?._primary ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc: VersionedLocalizedContent<string> | null = sourceApplication.description ?? null
            if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc =
                        buildLocalizedContent(
                            sanitizedDescription,
                            parsed.data.descriptionPrimaryLocale,
                            parsed.data.namePrimaryLocale ??
                                sourceApplication.description?._primary ??
                                sourceApplication.name?._primary ??
                                'en'
                        ) ?? null
                } else {
                    descriptionVlc = null
                }
            }

            const requestedSlug = parsed.data.slug
            const sourceSlug = sourceApplication.slug
            const maxSlugAttempts = 1000
            let slugCandidate: string | undefined
            let nextSlugAttempt = 1

            const assignNextAvailableGeneratedSlug = async (): Promise<boolean> => {
                if (!sourceSlug) return false
                for (; nextSlugAttempt <= maxSlugAttempts; nextSlugAttempt++) {
                    const candidate = buildCopiedApplicationSlugCandidate(sourceSlug, nextSlugAttempt)
                    const existing = await findApplicationBySlug(
                        {
                            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                        },
                        candidate
                    )
                    if (!existing) {
                        slugCandidate = candidate
                        nextSlugAttempt += 1
                        return true
                    }
                }
                return false
            }

            if (requestedSlug) {
                slugCandidate = requestedSlug
                const existing = await findApplicationBySlug(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    slugCandidate
                )
                if (existing) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
            } else if (sourceSlug) {
                const hasSlugCandidate = await assignNextAvailableGeneratedSlug()
                if (!hasSlugCandidate) {
                    return res.status(409).json({ error: 'Unable to generate unique slug for copied application' })
                }
            }

            const [{ id: newApplicationId }] = (await query<{ id: string }>(req, `SELECT public.uuid_generate_v7() AS id`)) as Array<{
                id: string
            }>
            const newSchemaName = generateSchemaName(newApplicationId)

            if (!newSchemaName.startsWith('app_') || !isValidSchemaName(newSchemaName) || !IDENTIFIER_REGEX.test(newSchemaName)) {
                return res.status(400).json({ error: 'Invalid generated application schema name' })
            }

            const runCopyTransaction = () =>
                copyApplicationWithOptions(ds, {
                    newApplicationId,
                    sourceApplicationId: applicationId,
                    sourceApplication,
                    copiedName: nameVlc,
                    copiedDescription: descriptionVlc ?? null,
                    slug: slugCandidate ?? null,
                    isPublic: resolvedIsPublic,
                    workspacesEnabled: resolvedWorkspacesEnabled,
                    schemaName: newSchemaName,
                    schemaStatus: copyOptions.copyConnector ? ApplicationSchemaStatus.OUTDATED : ApplicationSchemaStatus.DRAFT,
                    copyAccess: copyOptions.copyAccess,
                    copyConnector: copyOptions.copyConnector,
                    actorUserId: userId
                })

            let copied: Awaited<ReturnType<typeof copyApplicationWithOptions>> | null = null
            const maxCopyAttempts = requestedSlug ? 1 : sourceSlug ? maxSlugAttempts : 1
            for (let attempt = 0; attempt < maxCopyAttempts; attempt++) {
                try {
                    copied = await runCopyTransaction()
                    break
                } catch (error) {
                    if (!database.isSlugUniqueViolation(error)) {
                        throw error
                    }
                    if (requestedSlug) {
                        return res.status(409).json({ error: 'Application with this slug already exists' })
                    }
                    if (sourceSlug) {
                        const hasSlugCandidate = await assignNextAvailableGeneratedSlug()
                        if (hasSlugCandidate) {
                            continue
                        }
                        return res.status(409).json({ error: 'Unable to generate unique slug for copied application' })
                    }
                    throw error
                }
            }

            if (!copied) {
                return res.status(409).json({ error: 'Unable to generate unique slug for copied application' })
            }

            return res.status(201).json({
                id: copied.id,
                name: copied.name,
                description: copied.description,
                slug: copied.slug,
                isPublic: copied.isPublic,
                workspacesEnabled: copied.workspacesEnabled,
                version: copied.version || 1,
                createdAt: copied.createdAt,
                updatedAt: copied.updatedAt,
                connectorsCount: undefined,
                membersCount: undefined,
                role: 'owner',
                accessType: 'member',
                permissions: ROLE_PERMISSIONS.owner,
                membershipState: ApplicationMembershipState.JOINED,
                canJoin: false,
                canLeave: false
            })
        })
    )

    // ============ UPDATE APPLICATION ============
    router.patch(
        '/:applicationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            const ctx = await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

            const application = await findApplicationDetails(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (!application) return res.status(404).json({ error: 'Application not found' })

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema.optional(),
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .nullable()
                    .optional(),
                isPublic: z.boolean().optional(),
                workspacesEnabled: z.boolean().optional(),
                expectedVersion: z.number().int().positive().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { name, description, slug, isPublic, workspacesEnabled, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } =
                result.data

            if (isPublic !== undefined || workspacesEnabled !== undefined) {
                return res.status(400).json({
                    error: 'Immutable application parameters',
                    details: {
                        isPublic: ['Application visibility cannot be changed after creation'],
                        workspacesEnabled: ['Workspace mode cannot be changed after creation']
                    }
                })
            }

            // Optimistic locking check
            if (expectedVersion !== undefined) {
                const currentVersion = application.version || 1
                if (currentVersion !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: applicationId,
                        entityType: 'application',
                        expectedVersion,
                        actualVersion: currentVersion,
                        updatedAt: application.updatedAt,
                        updatedBy: application.updatedBy ?? null
                    })
                }
            }

            let nextName = application.name
            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? application.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    nextName = nameVlc
                }
            }

            let nextDescription = application.description
            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ?? application.description?._primary ?? nextName?._primary ?? namePrimaryLocale ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        nextDescription = descriptionVlc
                    }
                } else {
                    nextDescription = null
                }
            }

            let nextSlug = application.slug
            if (slug !== undefined) {
                if (slug !== null && slug !== application.slug) {
                    const existing = await findApplicationBySlug(
                        {
                            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                        },
                        slug
                    )
                    if (existing && existing.id !== applicationId) {
                        return res.status(409).json({ error: 'Application with this slug already exists' })
                    }
                }
                nextSlug = slug ?? null
            }

            let saved = await updateApplication(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                {
                    applicationId,
                    name: name !== undefined ? nextName : undefined,
                    description: description !== undefined ? nextDescription : undefined,
                    slug: slug !== undefined ? nextSlug : undefined,
                    userId,
                    expectedVersion
                }
            )

            if (!saved && expectedVersion !== undefined) {
                const latest = await findApplicationDetails(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    applicationId
                )
                if (latest && latest.version !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: applicationId,
                        entityType: 'application',
                        expectedVersion,
                        actualVersion: latest.version,
                        updatedAt: latest.updatedAt,
                        updatedBy: latest.updatedBy ?? null
                    })
                }
            }

            if (!saved) {
                saved = await findApplicationDetails(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    applicationId
                )
            }
            if (!saved) return res.status(404).json({ error: 'Application not found' })
            const role = ctx.membership.role as ApplicationRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: saved.id,
                name: saved.name,
                description: saved.description,
                slug: saved.slug,
                isPublic: saved.isPublic,
                workspacesEnabled: saved.workspacesEnabled,
                version: saved.version || 1,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions,
                membershipState: ApplicationMembershipState.JOINED,
                canJoin: false,
                canLeave: role !== 'owner'
            })
        })
    )

    // ============ DELETE APPLICATION ============
    router.delete(
        '/:applicationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            await ensureApplicationAccess(ds, userId, applicationId, ['owner'])

            const application = await findApplicationDetails(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (!application) return res.status(404).json({ error: 'Application not found' })

            // Drop application runtime schema together with the application record.
            // This prevents orphan schemas in PostgreSQL after deleting Applications.
            const schemaName = application.schemaName
            if (schemaName) {
                // Safety: only allow dropping schemas that match our generated naming convention.
                if (!schemaName.startsWith('app_') || !isValidSchemaName(schemaName) || !IDENTIFIER_REGEX.test(schemaName)) {
                    return res.status(400).json({ error: 'Invalid application schema name' })
                }
            }

            await deleteApplicationWithSchema(ds, { applicationId, schemaName, userId })
            return res.status(204).send()
        })
    )

    // ============ JOIN PUBLIC APPLICATION ============
    router.post(
        '/:applicationId/join',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())
            const executor = {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            }

            const application = await findApplicationDetails(executor, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }
            if (!application.isPublic) {
                return res.status(403).json({ error: 'Only public applications can be joined directly' })
            }

            const existingMember = await findApplicationMemberByUserId(executor, { applicationId, userId })
            if (existingMember) {
                return res.json({ status: 'joined', member: mapMember(existingMember) })
            }

            const joinedMember = await ds.transaction(async (trx) => {
                const member = await insertApplicationMember(trx, {
                    applicationId,
                    userId,
                    role: 'member',
                    comment: null,
                    createdBy: userId,
                    updatedBy: userId
                })

                if (!member) {
                    throw new Error('Failed to create application membership')
                }

                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    await ensurePersonalWorkspaceForUser(trx, {
                        schemaName: application.schemaName,
                        userId,
                        actorUserId: userId,
                        defaultRoleCodename: 'owner'
                    })
                }

                return member
            })

            return res.status(201).json({ status: 'joined', member: mapMember(joinedMember) })
        })
    )

    // ============ LEAVE APPLICATION ============
    router.post(
        '/:applicationId/leave',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())
            const executor = {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            }

            const member = await findApplicationMemberByUserId(executor, { applicationId, userId })
            if (!member) {
                return res.status(404).json({ error: 'Membership not found' })
            }
            assertNotOwner(member, 'Application owner cannot leave the application')

            const application = await findApplicationSchemaInfo(executor, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            await ds.transaction(async (trx) => {
                await deleteApplicationMember(trx, { applicationId, memberId: member.id, userId })

                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    await archivePersonalWorkspaceForUser(trx, {
                        schemaName: application.schemaName,
                        userId,
                        actorUserId: userId
                    })
                }
            })

            return res.json({ status: 'left' })
        })
    )

    // ============ APPLICATION SETTINGS: LIMITS ============
    router.get(
        '/:applicationId/settings/limits',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())
            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

            const application = await findApplicationSchemaInfo(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (!application) return res.status(404).json({ error: 'Application not found' })
            if (!application.schemaName) return res.status(400).json({ error: 'Application schema is not configured' })
            if (!application.workspacesEnabled) return res.status(400).json({ error: 'Workspace limits require workspace mode' })
            if (!IDENTIFIER_REGEX.test(application.schemaName)) return res.status(400).json({ error: 'Invalid application schema name' })
            if (!(await runtimeWorkspaceTablesExist(ds, application.schemaName))) {
                return res.status(400).json({ error: 'Workspace subsystem is not initialized yet' })
            }

            const schemaIdent = quoteIdentifier(application.schemaName)
            const catalogs = (await ds.query(
                `
                SELECT id, codename, table_name, presentation
                FROM ${schemaIdent}._app_objects
                WHERE kind = 'catalog'
                  AND _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY codename ASC
                `
            )) as Array<{ id: string; codename: string; table_name: string; presentation?: unknown }>

            const limits = await listCatalogWorkspaceLimits(ds, { schemaName: application.schemaName })
            const limitMap = new Map(limits.map((limit) => [limit.objectId, limit.maxRows]))

            return res.json({
                items: catalogs.map((catalog) => ({
                    objectId: catalog.id,
                    codename: catalog.codename,
                    codenameDisplay: resolvePresentationCodename(
                        catalog.presentation,
                        normalizeLocale(req.query.locale as string | undefined),
                        catalog.codename
                    ),
                    tableName: catalog.table_name,
                    name: resolvePresentationName(
                        catalog.presentation,
                        normalizeLocale(req.query.locale as string | undefined),
                        catalog.codename
                    ),
                    maxRows: limitMap.get(catalog.id) ?? null
                }))
            })
        })
    )

    router.put(
        '/:applicationId/settings/limits',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())
            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

            const payloadSchema = z.object({
                limits: z.array(
                    z.object({
                        objectId: z.string().uuid(),
                        maxRows: z.number().int().positive().nullable()
                    })
                )
            })

            const parsed = payloadSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() })
            }

            const application = await findApplicationSchemaInfo(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (!application) return res.status(404).json({ error: 'Application not found' })
            if (!application.schemaName) return res.status(400).json({ error: 'Application schema is not configured' })
            if (!application.workspacesEnabled) return res.status(400).json({ error: 'Workspace limits require workspace mode' })
            if (!IDENTIFIER_REGEX.test(application.schemaName)) return res.status(400).json({ error: 'Invalid application schema name' })
            if (!(await runtimeWorkspaceTablesExist(ds, application.schemaName))) {
                return res.status(400).json({ error: 'Workspace subsystem is not initialized yet' })
            }

            const uniqueObjectIds = new Set(parsed.data.limits.map((limit) => limit.objectId))
            if (uniqueObjectIds.size !== parsed.data.limits.length) {
                return res.status(400).json({ error: 'Duplicate catalog limit rows are not allowed' })
            }

            const limitsSchemaName = application.schemaName
            const updatedLimits = await ds.transaction(async (trx) => {
                const catalogRows = await trx.query<{ id: string }>(
                    `
                    SELECT id
                    FROM ${quoteIdentifier(limitsSchemaName)}._app_objects
                    WHERE kind = 'catalog'
                      AND _upl_deleted = false
                      AND _app_deleted = false
                      AND id = ANY($1::uuid[])
                    `,
                    [parsed.data.limits.map((limit) => limit.objectId)]
                )

                if (catalogRows.length !== uniqueObjectIds.size) {
                    throw new UpdateFailure(400, { error: 'Limits can only be updated for active catalogs' })
                }

                await upsertCatalogWorkspaceLimits(trx, {
                    schemaName: limitsSchemaName,
                    actorUserId: userId,
                    limits: parsed.data.limits
                })

                return listCatalogWorkspaceLimits(trx, { schemaName: limitsSchemaName })
            })
            return res.json({ items: updatedLimits })
        })
    )

    // ============ LIST MEMBERS ============
    router.get(
        '/:applicationId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { items: members, total } = await listApplicationMembers(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                {
                    applicationId,
                    limit: validatedQuery.limit,
                    offset: validatedQuery.offset,
                    sortBy: validatedQuery.sortBy,
                    sortOrder: validatedQuery.sortOrder,
                    search: validatedQuery.search ? escapeLikeWildcards(validatedQuery.search.toLowerCase()) : undefined
                }
            )
            return res.json({ items: members.map(mapMember), total, limit: validatedQuery.limit, offset: validatedQuery.offset })
        })
    )

    // ============ ADD MEMBER ============
    router.post(
        '/:applicationId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

            const schema = z.object({
                email: z.string().email(),
                role: z.enum(['member', 'editor', 'admin']).default('member'),
                comment: memberCommentInputSchema.nullable().optional(),
                commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const normalizedComment = normalizeMemberCommentInput(result.data.comment, result.data.commentPrimaryLocale)
            if (normalizedComment.error) {
                return res.status(400).json({
                    error: 'Invalid input',
                    details: { formErrors: [normalizedComment.error], fieldErrors: { comment: [normalizedComment.error] } }
                })
            }

            const { email, role } = result.data
            const executor = {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            }

            const user = await findAuthUserByEmail(executor, email.toLowerCase())
            if (!user) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await findApplicationMemberByUserId(executor, { applicationId, userId: user.id })
            if (existing) {
                return res.status(409).json({ error: 'User is already a member', code: 'APPLICATION_MEMBER_EXISTS' })
            }

            const application = await findApplicationSchemaInfo(executor, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            try {
                const member = await ds.transaction(async (trx) => {
                    const insertedMember = await insertApplicationMember(trx, {
                        applicationId,
                        userId: user.id,
                        role,
                        comment: normalizedComment.commentVlc,
                        createdBy: userId,
                        updatedBy: userId
                    })

                    if (!insertedMember) {
                        throw new Error('Failed to create application member')
                    }

                    if (
                        application.workspacesEnabled &&
                        application.schemaName &&
                        IDENTIFIER_REGEX.test(application.schemaName) &&
                        (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                    ) {
                        await ensurePersonalWorkspaceForUser(trx, {
                            schemaName: application.schemaName,
                            userId: user.id,
                            actorUserId: userId,
                            defaultRoleCodename: 'owner'
                        })
                    }

                    return insertedMember
                })

                return res.status(201).json(mapMember(member))
            } catch (error) {
                if (database.isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'User is already a member', code: 'APPLICATION_MEMBER_EXISTS' })
                }
                throw error
            }
        })
    )

    // ============ UPDATE MEMBER ============
    router.patch(
        '/:applicationId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId, memberId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

            const executor = {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            }

            const member = await findApplicationMemberById(executor, { applicationId, memberId })
            if (!member) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(member, 'Cannot modify owner role')

            const schema = z.object({
                role: z.enum(['member', 'editor', 'admin']).optional(),
                comment: memberCommentInputSchema.nullable().optional(),
                commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const normalizedComment: { commentVlc: VersionedLocalizedContent<string> | null | undefined; error?: string } =
                result.data.comment !== undefined
                    ? normalizeMemberCommentInput(result.data.comment, result.data.commentPrimaryLocale)
                    : { commentVlc: undefined }

            if (normalizedComment.error) {
                return res.status(400).json({
                    error: 'Invalid input',
                    details: { formErrors: [normalizedComment.error], fieldErrors: { comment: [normalizedComment.error] } }
                })
            }

            const { role } = result.data

            if (role !== undefined) member.role = role

            const updatedMember = await updateApplicationMember(executor, {
                applicationId,
                memberId,
                role: result.data.role,
                comment: result.data.comment !== undefined ? normalizedComment.commentVlc ?? null : undefined,
                updatedBy: userId
            })

            if (!updatedMember) {
                return res.status(404).json({ error: 'Member not found' })
            }

            return res.json(mapMember(updatedMember))
        })
    )

    // ============ REMOVE MEMBER ============
    router.delete(
        '/:applicationId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId, memberId } = req.params
            const ds = getRequestDbExecutor(req, getDbExecutor())

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

            const executor = {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            }

            const member = await findApplicationMemberById(executor, { applicationId, memberId })
            if (!member) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(member, 'Cannot remove owner')

            const application = await findApplicationSchemaInfo(executor, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            await ds.transaction(async (trx) => {
                await deleteApplicationMember(trx, { applicationId, memberId, userId })

                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    await archivePersonalWorkspaceForUser(trx, {
                        schemaName: application.schemaName,
                        userId: member.userId,
                        actorUserId: userId
                    })
                }
            })
            return res.status(204).send()
        })
    )

    return router
}
