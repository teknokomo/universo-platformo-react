import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { cloneSchemaWithExecutor, generateSchemaName, isValidSchemaName } from '@universo/schema-ddl'
import { Application } from '../database/entities/Application'
import { ApplicationSchemaStatus } from '../database/entities/Application'
import { ApplicationUser } from '../database/entities/ApplicationUser'
import { Connector } from '../database/entities/Connector'
import { ConnectorPublication } from '../database/entities/ConnectorPublication'
import { Profile } from '@universo/profile-backend'
import { ensureApplicationAccess, ROLE_PERMISSIONS, assertNotOwner } from './guards'
import type { ApplicationRole } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { getVLCString } from '@universo/utils/vlc'
import { OptimisticLockError } from '@universo/utils'
import { escapeLikeWildcards, getRequestManager } from '../utils'

const getRequestQueryRunner = (req: Request) => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
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

const normalizeLocale = (locale?: string): string => {
    if (!locale) return 'en'
    return locale.split('-')[0].split('_')[0].toLowerCase()
}

const resolvePresentationName = (presentation: unknown, locale: string, fallback: string): string => {
    if (!presentation || typeof presentation !== 'object') return fallback

    const presentationObj = presentation as {
        name?: {
            _primary?: string
            locales?: Record<string, { content?: string }>
        }
    }

    const locales = presentationObj.name?.locales
    if (!locales || typeof locales !== 'object') return fallback

    const normalized = normalizeLocale(locale)
    const direct = locales[normalized]?.content
    if (typeof direct === 'string' && direct.trim().length > 0) return direct

    const primary = presentationObj.name?._primary
    const primaryValue = primary ? locales[primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.trim().length > 0) return primaryValue

    const first = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    return first?.content ?? fallback
}

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

type RuntimeDataType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'DATE' | 'REF' | 'JSON'

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

    // NUMBER, BOOLEAN, DATE, REF, JSON — return as-is
    return value
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

export function createApplicationsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
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

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            applicationRepo: manager.getRepository(Application),
            applicationUserRepo: manager.getRepository(ApplicationUser),
            connectorRepo: manager.getRepository(Connector),
            connectorPublicationRepo: manager.getRepository(ConnectorPublication),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: ApplicationUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.userId,
        email,
        nickname,
        role: (member.role || 'member') as ApplicationRole,
        comment: member.comment,
        createdAt: member._uplCreatedAt
    })

    const loadMembers = async (
        req: Request,
        applicationId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { applicationUserRepo } = repos(req)
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)

        try {
            const qb = applicationUserRepo.createQueryBuilder('au').where('au.application_id = :applicationId', { applicationId })

            if (params) {
                const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = params

                if (search) {
                    const escapedSearch = escapeLikeWildcards(search.toLowerCase())
                    qb.andWhere(
                        `(
                            EXISTS (SELECT 1 FROM auth.users u WHERE u.id = au.user_id AND LOWER(u.email) LIKE :search)
                         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = au.user_id AND LOWER(p.nickname) LIKE :search)
                        )`,
                        { search: `%${escapedSearch}%` }
                    )
                }

                const orderColumn =
                    sortBy === 'email'
                        ? '(SELECT u.email FROM auth.users u WHERE u.id = au.user_id)'
                        : sortBy === 'role'
                        ? 'au.role'
                        : 'au._upl_created_at'
                qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                qb.skip(offset).take(limit)
            }

            const [rawMembers, total] = await qb.getManyAndCount()
            const userIds = rawMembers.map((m) => m.userId)

            if (userIds.length === 0) {
                return { members: [], total }
            }

            const users = userIds.length ? await manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await manager.find(Profile, { where: { user_id: In(userIds) } }) : []

            const usersMap = new Map(users.map((user) => [user.id, user.email ?? null]))
            const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile.nickname]))

            const members = rawMembers.map((m) => mapMember(m, usersMap.get(m.userId) ?? null, profilesMap.get(m.userId) ?? null))

            return { members, total }
        } catch (error) {
            console.error('[loadMembers] Error loading application members:', error)
            throw error
        }
    }

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

            const { applicationRepo, applicationUserRepo } = repos(req)
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

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

            const isSuperuser = await isSuperuserByDataSource(ds, userId, rlsRunner)
            const hasGlobalApplicationsAccess = await hasSubjectPermissionByDataSource(ds, userId, 'applications', 'read', rlsRunner)

            let qb = applicationRepo.createQueryBuilder('a')

            if (showAll && (isSuperuser || hasGlobalApplicationsAccess)) {
                // Show all applications for superusers/global admins
            } else {
                qb = qb.where(`a.id IN (SELECT au.application_id FROM applications.applications_users au WHERE au.user_id = :userId)`, {
                    userId
                })
            }

            if (search) {
                qb = qb.andWhere(
                    "(a.name::text ILIKE :search OR COALESCE(a.description::text, '') ILIKE :search OR COALESCE(a.slug, '') ILIKE :search)",
                    { search: `%${search}%` }
                )
            }

            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(a.name->>(a.name->>'_primary'), a.name->>'en', '')"
                    : sortBy === 'created'
                    ? 'a._upl_created_at'
                    : 'a._upl_updated_at'
            qb = qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
            qb = qb.skip(offset).take(limit)

            const [applications, total] = await qb.getManyAndCount()
            const applicationIds = applications.map((a) => a.id)

            const memberships =
                applicationIds.length > 0
                    ? await applicationUserRepo.find({
                          where: { applicationId: In(applicationIds), userId }
                      })
                    : []
            const membershipMap = new Map(memberships.map((m) => [m.applicationId, m]))

            const { connectorRepo } = repos(req)
            const connectorCounts =
                applicationIds.length > 0
                    ? await connectorRepo
                          .createQueryBuilder('s')
                          .select('s.application_id', 'applicationId')
                          .addSelect('COUNT(*)', 'count')
                          .where('s.application_id IN (:...ids)', { ids: applicationIds })
                          .groupBy('s.application_id')
                          .getRawMany<{ applicationId: string; count: string }>()
                    : []
            const connectorCountMap = new Map(connectorCounts.map((c) => [c.applicationId, parseInt(c.count, 10)]))

            const memberCounts =
                applicationIds.length > 0
                    ? await applicationUserRepo
                          .createQueryBuilder('au')
                          .select('au.application_id', 'applicationId')
                          .addSelect('COUNT(*)', 'count')
                          .where('au.application_id IN (:...ids)', { ids: applicationIds })
                          .groupBy('au.application_id')
                          .getRawMany<{ applicationId: string; count: string }>()
                    : []
            const memberCountMap = new Map(memberCounts.map((c) => [c.applicationId, parseInt(c.count, 10)]))

            const globalRoleName =
                isSuperuser || hasGlobalApplicationsAccess ? await getGlobalRoleCodenameByDataSource(ds, userId, rlsRunner) : null

            const result = applications.map((a) => {
                const membership = membershipMap.get(a.id)
                const role = membership ? (membership.role as ApplicationRole) : globalRoleName ? 'owner' : 'member'
                const accessType = membership ? 'member' : globalRoleName ?? 'member'
                const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

                return {
                    id: a.id,
                    name: a.name,
                    description: a.description,
                    slug: a.slug,
                    isPublic: a.isPublic,
                    version: a._uplVersion || 1,
                    createdAt: a._uplCreatedAt,
                    updatedAt: a._uplUpdatedAt,
                    connectorsCount: connectorCountMap.get(a.id) ?? 0,
                    membersCount: memberCountMap.get(a.id) ?? 0,
                    role,
                    accessType,
                    permissions
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
            const { applicationRepo } = repos(req)
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

            const application = await applicationRepo.findOne({ where: { id: applicationId } })
            if (!application) return res.status(404).json({ error: 'Application not found' })

            const { connectorRepo } = repos(req)
            const connectorsCount = await connectorRepo.count({ where: { applicationId } })
            const { total: membersCount } = await loadMembers(req, applicationId, { limit: 1 })

            const role = ctx.membership.role as ApplicationRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: application.id,
                name: application.name,
                description: application.description,
                slug: application.slug,
                isPublic: application.isPublic,
                version: application._uplVersion || 1,
                createdAt: application._uplCreatedAt,
                updatedAt: application._uplUpdatedAt,
                schemaName: application.schemaName,
                schemaStatus: application.schemaStatus,
                schemaSyncedAt: application.schemaSyncedAt,
                schemaError: application.schemaError,
                connectorsCount,
                membersCount,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

            const parsedQuery = runtimeQuerySchema.safeParse(req.query)
            if (!parsedQuery.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
            }

            const { limit, offset, locale } = parsedQuery.data
            const requestedLocale = normalizeLocale(locale)
            const requestedCatalogId = parsedQuery.data.catalogId ?? null
            const { applicationRepo } = repos(req)
            const application = await applicationRepo.findOne({ where: { id: applicationId } })
            if (!application) return res.status(404).json({ error: 'Application not found' })

            if (!application.schemaName) {
                return res.status(400).json({ error: 'Application schema is not configured' })
            }

            const schemaName = application.schemaName
            if (!IDENTIFIER_REGEX.test(schemaName)) {
                return res.status(400).json({ error: 'Invalid application schema name' })
            }

            const schemaIdent = quoteIdentifier(schemaName)
            const manager = getRequestManager(req, ds)

            const catalogs = await manager.query(
                `
                    SELECT id, codename, table_name, presentation
                    FROM ${schemaIdent}._app_objects
                    WHERE kind = 'catalog'
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
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
            }>
            const activeCatalog =
                (requestedCatalogId ? typedCatalogs.find((catalogRow) => catalogRow.id === requestedCatalogId) : undefined) ??
                typedCatalogs[0]
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
                    SELECT id, codename, column_name, data_type, is_required,
                           presentation, validation_rules, sort_order, ui_config,
                           target_object_id, target_object_kind
                    FROM ${schemaIdent}._app_attributes
                    WHERE object_id = $1
                      AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON')
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
                `,
                [activeCatalog.id]
            )) as Array<{
                id: string
                codename: string
                column_name: string
                data_type: RuntimeDataType
                is_required: boolean
                presentation?: unknown
                validation_rules?: Record<string, unknown>
                sort_order?: number
                ui_config?: Record<string, unknown>
                target_object_id?: string | null
                target_object_kind?: string | null
            }>

            const safeAttributes = attributes.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name))

            const enumTargetObjectIds = Array.from(
                new Set(
                    safeAttributes
                        .filter((attr) => attr.data_type === 'REF' && attr.target_object_kind === 'enumeration' && attr.target_object_id)
                        .map((attr) => String(attr.target_object_id))
                )
            )

            const enumOptionsMap = new Map<
                string,
                Array<{ id: string; label: string; codename: string; isDefault: boolean; sortOrder: number }>
            >()
            if (enumTargetObjectIds.length > 0) {
                const enumRows = (await manager.query(
                    `
                        SELECT id, object_id, codename, presentation, sort_order, is_default
                        FROM ${schemaIdent}._app_enum_values
                        WHERE object_id = ANY($1::uuid[])
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
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

            const dataTableIdent = `${schemaIdent}.${quoteIdentifier(activeCatalog.table_name)}`
            const selectColumns = ['id', ...safeAttributes.map((attr) => quoteIdentifier(attr.column_name))]

            const [{ total }] = (await manager.query(
                `
                    SELECT COUNT(*)::int AS total
                    FROM ${dataTableIdent}
                    WHERE COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                `
            )) as Array<{ total: number }>

            const rawRows = (await manager.query(
                `
                    SELECT ${selectColumns.join(', ')}
                    FROM ${dataTableIdent}
                    WHERE COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
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
                    mappedRow[attribute.column_name] = resolveRuntimeValue(row[attribute.column_name], attribute.data_type, requestedLocale)
                }

                return mappedRow
            })

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
                              AND COALESCE(_upl_deleted, false) = false
                              AND COALESCE(_app_deleted, false) = false
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
                                  AND COALESCE(_upl_deleted, false) = false
                                  AND COALESCE(_app_deleted, false) = false
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

            const catalogsForRuntime = typedCatalogs.map((catalogRow) => ({
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
                              AND COALESCE(_upl_deleted, false) = false
                              AND COALESCE(_app_deleted, false) = false
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
                                  AND COALESCE(_upl_deleted, false) = false
                                  AND COALESCE(_app_deleted, false) = false
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
            let menus: Array<{
                id: string
                widgetId: string
                showTitle: boolean
                title: string
                autoShowAllCatalogs: boolean
                items: Array<{
                    id: string
                    kind: string
                    title: string
                    icon: string | null
                    href: string | null
                    catalogId: string | null
                    sortOrder: number
                    isActive: boolean
                }>
            }> = []
            let activeMenuId: string | null = null

            try {
                for (const widget of zoneWidgets.left) {
                    if (widget.widgetKey !== 'menuWidget') continue
                    const cfg = widget.config as Record<string, unknown>
                    const rawItems = Array.isArray(cfg.items) ? cfg.items : []
                    const menuEntry = {
                        id: widget.id,
                        widgetId: widget.id,
                        showTitle: Boolean(cfg.showTitle),
                        title: resolveLocalizedContent(cfg.title, requestedLocale, ''),
                        autoShowAllCatalogs: Boolean(cfg.autoShowAllCatalogs),
                        items: rawItems
                            .filter((item: any) => item && Boolean(item.isActive !== false))
                            .map((item: any) => ({
                                id: String(item.id ?? ''),
                                kind: String(item.kind ?? 'link'),
                                title: resolveLocalizedContent(item.title, requestedLocale, String(item.kind ?? 'link')),
                                icon: typeof item.icon === 'string' ? item.icon : null,
                                href: typeof item.href === 'string' ? item.href : null,
                                catalogId: typeof item.catalogId === 'string' ? item.catalogId : null,
                                sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
                                isActive: Boolean(item.isActive !== false)
                            }))
                            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                    }
                    menus.push(menuEntry)
                }
                activeMenuId = menus[0]?.id ?? null
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[ApplicationsRuntime] Failed to build menus from widget config (ignored)', e)
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
                columns: safeAttributes.map((attribute) => ({
                    id: attribute.id,
                    codename: attribute.codename,
                    field: attribute.column_name,
                    dataType: attribute.data_type,
                    isRequired: attribute.is_required ?? false,
                    headerName: resolvePresentationName(attribute.presentation, requestedLocale, attribute.codename),
                    validationRules: attribute.validation_rules ?? {},
                    uiConfig: attribute.ui_config ?? {},
                    refTargetEntityId: attribute.target_object_id ?? null,
                    refTargetEntityKind: attribute.target_object_kind ?? null,
                    enumOptions:
                        attribute.data_type === 'REF' &&
                        attribute.target_object_kind === 'enumeration' &&
                        attribute.target_object_id &&
                        enumOptionsMap.has(attribute.target_object_id)
                            ? enumOptionsMap.get(attribute.target_object_id)
                            : undefined
                })),
                rows,
                pagination: {
                    total: typeof total === 'number' ? total : Number(total) || 0,
                    limit,
                    offset
                },
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
        catalogId: z.string().uuid().optional()
    })

    /** Supported runtime data types for write operations */
    const RUNTIME_WRITABLE_TYPES = new Set(['BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON'])

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
            case 'NUMBER':
                if (typeof value !== 'number') throw new Error('Expected number value')
                return value
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
            default:
                throw new Error(`Unsupported data type: ${dataType}`)
        }
    }

    /**
     * Shared helper: resolve catalog and load its attributes from a runtime schema.
     */
    const resolveRuntimeCatalog = async (
        manager: ReturnType<typeof getRequestManager>,
        schemaIdent: string,
        requestedCatalogId?: string
    ) => {
        const catalogs = (await manager.query(
            `
                SELECT id, codename, table_name
                FROM ${schemaIdent}._app_objects
                WHERE kind = 'catalog'
                  AND COALESCE(_upl_deleted, false) = false
                  AND COALESCE(_app_deleted, false) = false
                ORDER BY codename ASC
            `
        )) as Array<{ id: string; codename: string; table_name: string }>

        if (catalogs.length === 0) return { catalog: null, attrs: [], error: 'No catalogs available' }

        const catalog = (requestedCatalogId ? catalogs.find((c) => c.id === requestedCatalogId) : undefined) ?? catalogs[0]
        if (!catalog) return { catalog: null, attrs: [], error: 'Catalog not found' }
        if (!IDENTIFIER_REGEX.test(catalog.table_name)) return { catalog: null, attrs: [], error: 'Invalid table name' }

        const attrs = (await manager.query(
            `
                SELECT id, codename, column_name, data_type, is_required, validation_rules
                       , target_object_id, target_object_kind, ui_config
                FROM ${schemaIdent}._app_attributes
                WHERE object_id = $1
                  AND COALESCE(_upl_deleted, false) = false
                  AND COALESCE(_app_deleted, false) = false
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
    ): Promise<{ schemaIdent: string; manager: ReturnType<typeof getRequestManager>; userId: string } | null> => {
        if (!UUID_REGEX.test(applicationId)) {
            res.status(400).json({ error: 'Invalid application ID format' })
            return null
        }

        const ds = getDataSource()
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        const rlsRunner = getRequestQueryRunner(req)
        await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

        const { applicationRepo } = repos(req)
        const application = await applicationRepo.findOne({ where: { id: applicationId } })
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

        return {
            schemaIdent: quoteIdentifier(schemaName),
            manager: getRequestManager(req, ds),
            userId
        }
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

    const ensureEnumerationValueBelongsToTarget = async (
        manager: ReturnType<typeof getRequestManager>,
        schemaIdent: string,
        enumValueId: string,
        targetEnumerationId: string
    ): Promise<void> => {
        const rows = (await manager.query(
            `
                SELECT id
                FROM ${schemaIdent}._app_enum_values
                WHERE id = $1
                  AND object_id = $2
                  AND COALESCE(_upl_deleted, false) = false
                  AND COALESCE(_app_deleted, false) = false
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

            const { field, value, catalogId: requestedCatalogId } = parsedBody.data
            if (!IDENTIFIER_REGEX.test(field)) {
                return res.status(400).json({ error: 'Invalid field name' })
            }

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            const attr = attrs.find((a) => a.column_name === field)
            if (!attr) return res.status(404).json({ error: 'Attribute not found' })
            if (!RUNTIME_WRITABLE_TYPES.has(attr.data_type)) {
                return res.status(400).json({ error: `Field type ${attr.data_type} is not editable` })
            }

            if (
                attr.data_type === 'REF' &&
                attr.target_object_kind === 'enumeration' &&
                getEnumPresentationMode(attr.ui_config) === 'label'
            ) {
                return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
            }

            let coerced: unknown
            try {
                coerced = coerceRuntimeValue(value, attr.data_type, attr.validation_rules)
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
            const updated = (await ctx.manager.query(
                `
                    UPDATE ${dataTableIdent}
                    SET ${quoteIdentifier(field)} = $1,
                        _upl_updated_at = NOW(),
                        _upl_updated_by = $2,
                        _upl_version = COALESCE(_upl_version, 1) + 1
                    WHERE id = $3
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    RETURNING id
                `,
                [coerced, ctx.userId, rowId]
            )) as Array<{ id: string }>

            if (updated.length === 0) {
                return res.status(404).json({ error: 'Row not found' })
            }

            return res.json({ status: 'ok' })
        })
    )

    // ============ APPLICATION RUNTIME ROW BULK UPDATE ============
    const runtimeBulkUpdateBodySchema = z.object({
        catalogId: z.string().uuid().optional(),
        data: z.record(z.unknown())
    })

    router.patch(
        '/:applicationId/runtime/rows/:rowId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId, rowId } = req.params
            if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return

            const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const { catalogId: requestedCatalogId, data } = parsedBody.data

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            const setClauses: string[] = []
            const values: unknown[] = []
            let paramIndex = 1

            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))

            for (const attr of safeAttrs) {
                const raw = data[attr.column_name] ?? data[attr.codename]
                if (raw === undefined) continue

                if (
                    attr.data_type === 'REF' &&
                    attr.target_object_kind === 'enumeration' &&
                    getEnumPresentationMode(attr.ui_config) === 'label'
                ) {
                    return res.status(400).json({ error: `Field is read-only: ${attr.codename}` })
                }

                try {
                    const coerced = coerceRuntimeValue(raw, attr.data_type, attr.validation_rules)
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

            if (setClauses.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' })
            }

            setClauses.push('_upl_updated_at = NOW()')
            setClauses.push(`_upl_updated_by = $${paramIndex}`)
            values.push(ctx.userId)
            paramIndex++
            setClauses.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            values.push(rowId)

            const updated = (await ctx.manager.query(
                `
                    UPDATE ${dataTableIdent}
                    SET ${setClauses.join(', ')}
                    WHERE id = $${paramIndex}
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    RETURNING id
                `,
                values
            )) as Array<{ id: string }>

            if (updated.length === 0) {
                return res.status(404).json({ error: 'Row not found' })
            }

            return res.json({ status: 'ok' })
        })
    )

    // ============ APPLICATION RUNTIME ROW CREATE ============
    const runtimeCreateBodySchema = z.object({
        catalogId: z.string().uuid().optional(),
        data: z.record(z.unknown())
    })

    router.post(
        '/:applicationId/runtime/rows',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { applicationId } = req.params

            const ctx = await resolveRuntimeSchema(req, res, applicationId)
            if (!ctx) return

            const parsedBody = runtimeCreateBodySchema.safeParse(req.body)
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const { catalogId: requestedCatalogId, data } = parsedBody.data

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            // Build column→value pairs from input data
            const columnValues: Array<{ column: string; value: unknown }> = []
            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))

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
                        } catch {
                            raw = undefined
                        }
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

            const [inserted] = (await ctx.manager.query(insertSql, values)) as Array<{ id: string }>

            return res.status(201).json({ id: inserted.id, status: 'created' })
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

            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
            const selectColumns = ['id', ...safeAttrs.map((a) => quoteIdentifier(a.column_name))]
            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`

            const rows = (await ctx.manager.query(
                `
                    SELECT ${selectColumns.join(', ')}
                    FROM ${dataTableIdent}
                    WHERE id = $1
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                `,
                [rowId]
            )) as Array<Record<string, unknown>>

            if (rows.length === 0) return res.status(404).json({ error: 'Row not found' })

            const row = rows[0]
            const rawData: Record<string, unknown> = {}
            for (const attr of safeAttrs) {
                rawData[attr.column_name] = row[attr.column_name] ?? null
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

            const { catalog, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, catalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            const deleted = (await ctx.manager.query(
                `
                    UPDATE ${dataTableIdent}
                    SET _upl_deleted = true,
                        _upl_deleted_at = NOW(),
                        _upl_deleted_by = $1,
                        _upl_updated_at = NOW(),
                        _upl_version = COALESCE(_upl_version, 1) + 1
                    WHERE id = $2
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    RETURNING id
                `,
                [ctx.userId, rowId]
            )) as Array<{ id: string }>

            if (deleted.length === 0) return res.status(404).json({ error: 'Row not found' })

            return res.json({ status: 'deleted' })
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
                isPublic: z.boolean().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { applicationRepo, applicationUserRepo } = repos(req)
            const { name, description, slug, isPublic, namePrimaryLocale, descriptionPrimaryLocale } = result.data

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
                const existing = await applicationRepo.findOne({ where: { slug } })
                if (existing) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
            }

            const application = applicationRepo.create({
                name: nameVlc,
                description: descriptionVlc,
                slug: slug || undefined,
                isPublic: isPublic ?? false,
                _uplCreatedBy: userId,
                _uplUpdatedBy: userId
            })

            const saved = await applicationRepo.save(application)

            // Generate schemaName based on Application UUID
            saved.schemaName = generateSchemaName(saved.id)
            saved._uplUpdatedBy = userId
            await applicationRepo.save(saved)

            // Add creator as owner
            const member = applicationUserRepo.create({
                applicationId: saved.id,
                userId,
                role: 'owner',
                _uplCreatedBy: userId,
                _uplUpdatedBy: userId
            })
            await applicationUserRepo.save(member)

            return res.status(201).json({
                id: saved.id,
                name: saved.name,
                description: saved.description,
                slug: saved.slug,
                isPublic: saved.isPublic,
                version: saved._uplVersion || 1,
                createdAt: saved._uplCreatedAt,
                updatedAt: saved._uplUpdatedAt,
                connectorsCount: 0,
                membersCount: 1,
                role: 'owner',
                accessType: 'member',
                permissions: ROLE_PERMISSIONS.owner
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, ['owner', 'admin'], rlsRunner)

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
                copyAccess: z.boolean().optional().default(false)
            })

            const parsed = schema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const manager = getRequestManager(req, ds)
            const sourceApplicationRepo = manager.getRepository(Application)
            const sourceApplicationUserRepo = manager.getRepository(ApplicationUser)
            const sourceConnectorRepo = manager.getRepository(Connector)
            const sourceConnectorPublicationRepo = manager.getRepository(ConnectorPublication)

            const sourceApplication = await sourceApplicationRepo.findOne({ where: { id: applicationId } })
            if (!sourceApplication) {
                return res.status(404).json({ error: 'Application not found' })
            }

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

            let descriptionVlc = sourceApplication.description
            if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(
                        sanitizedDescription,
                        parsed.data.descriptionPrimaryLocale,
                        parsed.data.namePrimaryLocale ?? sourceApplication.description?._primary ?? sourceApplication.name?._primary ?? 'en'
                    )
                } else {
                    descriptionVlc = undefined
                }
            }

            const slugCandidate = parsed.data.slug ?? (sourceApplication.slug ? `${sourceApplication.slug}-copy` : undefined)
            if (slugCandidate) {
                const existing = await sourceApplicationRepo.findOne({ where: { slug: slugCandidate } })
                if (existing) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
            }

            const [{ id: newApplicationId }] = (await manager.query(`SELECT public.uuid_generate_v7() AS id`)) as Array<{ id: string }>
            const newSchemaName = generateSchemaName(newApplicationId)

            if (!newSchemaName.startsWith('app_') || !isValidSchemaName(newSchemaName) || !IDENTIFIER_REGEX.test(newSchemaName)) {
                return res.status(400).json({ error: 'Invalid generated application schema name' })
            }

            let schemaCloned = false
            if (sourceApplication.schemaName) {
                if (
                    !sourceApplication.schemaName.startsWith('app_') ||
                    !isValidSchemaName(sourceApplication.schemaName) ||
                    !IDENTIFIER_REGEX.test(sourceApplication.schemaName)
                ) {
                    return res.status(400).json({ error: 'Invalid source application schema name' })
                }

                await cloneSchemaWithExecutor(
                    {
                        query: async <T>(sql: string, params: unknown[] = []) => {
                            const rows = await manager.query(sql, params)
                            return rows as T[]
                        }
                    },
                    {
                        sourceSchema: sourceApplication.schemaName,
                        targetSchema: newSchemaName,
                        dropTargetSchemaIfExists: true,
                        createTargetSchema: true,
                        copyData: true
                    }
                )
                schemaCloned = true
            }

            try {
                const copied = await ds.transaction(async (txManager) => {
                    const txApplicationRepo = txManager.getRepository(Application)
                    const txApplicationUserRepo = txManager.getRepository(ApplicationUser)
                    const txConnectorRepo = txManager.getRepository(Connector)
                    const txConnectorPublicationRepo = txManager.getRepository(ConnectorPublication)

                    const copiedApplication = await txApplicationRepo.save(
                        txApplicationRepo.create({
                            id: newApplicationId,
                            name: nameVlc,
                            description: descriptionVlc,
                            slug: slugCandidate,
                            isPublic: parsed.data.isPublic ?? sourceApplication.isPublic,
                            schemaName: newSchemaName,
                            // Reset transient statuses so the copy starts in a safe state.
                            // MAINTENANCE/ERROR/UPDATE_AVAILABLE must not be inherited.
                            schemaStatus:
                                sourceApplication.schemaStatus === ApplicationSchemaStatus.SYNCED
                                    ? ApplicationSchemaStatus.SYNCED
                                    : ApplicationSchemaStatus.OUTDATED,
                            schemaSyncedAt: sourceApplication.schemaSyncedAt,
                            schemaError: null,
                            schemaSnapshot: sourceApplication.schemaSnapshot,
                            appStructureVersion: sourceApplication.appStructureVersion,
                            lastSyncedPublicationVersionId: null,
                            _uplCreatedBy: userId,
                            _uplUpdatedBy: userId
                        })
                    )

                    await txApplicationUserRepo.save(
                        txApplicationUserRepo.create({
                            applicationId: copiedApplication.id,
                            userId,
                            role: 'owner',
                            _uplCreatedBy: userId,
                            _uplUpdatedBy: userId
                        })
                    )

                    if (parsed.data.copyAccess) {
                        const sourceMembers = await sourceApplicationUserRepo.find({
                            where: {
                                applicationId,
                                _uplDeleted: false,
                                _appDeleted: false
                            }
                        })
                        for (const sourceMember of sourceMembers) {
                            if (sourceMember.userId === userId) continue
                            await txApplicationUserRepo.save(
                                txApplicationUserRepo.create({
                                    applicationId: copiedApplication.id,
                                    userId: sourceMember.userId,
                                    role: sourceMember.role,
                                    comment: sourceMember.comment,
                                    _uplCreatedBy: userId,
                                    _uplUpdatedBy: userId
                                })
                            )
                        }
                    }

                    const sourceConnectors = await sourceConnectorRepo.find({
                        where: { applicationId },
                        order: { sortOrder: 'ASC' }
                    })

                    const connectorIdMap = new Map<string, string>()
                    for (const sourceConnector of sourceConnectors) {
                        const savedConnector = await txConnectorRepo.save(
                            txConnectorRepo.create({
                                applicationId: copiedApplication.id,
                                name: sourceConnector.name,
                                description: sourceConnector.description,
                                sortOrder: sourceConnector.sortOrder,
                                isSingleMetahub: sourceConnector.isSingleMetahub,
                                isRequiredMetahub: sourceConnector.isRequiredMetahub,
                                _uplCreatedBy: userId,
                                _uplUpdatedBy: userId
                            })
                        )
                        connectorIdMap.set(sourceConnector.id, savedConnector.id)
                    }

                    const sourceConnectorIds = sourceConnectors.map((connector) => connector.id)
                    if (sourceConnectorIds.length > 0) {
                        const sourceLinks = await sourceConnectorPublicationRepo.find({
                            where: { connectorId: In(sourceConnectorIds) }
                        })
                        for (const sourceLink of sourceLinks) {
                            const copiedConnectorId = connectorIdMap.get(sourceLink.connectorId)
                            if (!copiedConnectorId) continue
                            await txConnectorPublicationRepo.save(
                                txConnectorPublicationRepo.create({
                                    connectorId: copiedConnectorId,
                                    publicationId: sourceLink.publicationId,
                                    sortOrder: sourceLink.sortOrder,
                                    _uplCreatedBy: userId,
                                    _uplUpdatedBy: userId
                                })
                            )
                        }
                    }

                    return copiedApplication
                })

                return res.status(201).json({
                    id: copied.id,
                    name: copied.name,
                    description: copied.description,
                    slug: copied.slug,
                    isPublic: copied.isPublic,
                    version: copied._uplVersion || 1,
                    createdAt: copied._uplCreatedAt,
                    updatedAt: copied._uplUpdatedAt,
                    connectorsCount: undefined,
                    membersCount: undefined,
                    role: 'owner',
                    accessType: 'member',
                    permissions: ROLE_PERMISSIONS.owner
                })
            } catch (error) {
                if (schemaCloned) {
                    const schemaIdent = quoteIdentifier(newSchemaName)
                    await manager.query(`DROP SCHEMA IF EXISTS ${schemaIdent} CASCADE`).catch(() => undefined)
                }
                throw error
            }
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const { applicationRepo } = repos(req)
            const application = await applicationRepo.findOne({ where: { id: applicationId } })
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
                expectedVersion: z.number().int().positive().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { name, description, slug, isPublic, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } = result.data

            // Optimistic locking check
            if (expectedVersion !== undefined) {
                const currentVersion = application._uplVersion || 1
                if (currentVersion !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: applicationId,
                        entityType: 'application',
                        expectedVersion,
                        actualVersion: currentVersion,
                        updatedAt: application._uplUpdatedAt,
                        updatedBy: application._uplUpdatedBy ?? null
                    })
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? application.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    application.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ??
                        application.description?._primary ??
                        application.name?._primary ??
                        namePrimaryLocale ??
                        'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        application.description = descriptionVlc
                    }
                } else {
                    application.description = undefined
                }
            }

            if (slug !== undefined) {
                if (slug !== null && slug !== application.slug) {
                    const existing = await applicationRepo.findOne({ where: { slug } })
                    if (existing && existing.id !== applicationId) {
                        return res.status(409).json({ error: 'Application with this slug already exists' })
                    }
                }
                application.slug = slug ?? undefined
            }

            if (isPublic !== undefined) {
                application.isPublic = isPublic
            }

            application._uplUpdatedBy = userId

            const saved = await applicationRepo.save(application)
            const role = ctx.membership.role as ApplicationRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: saved.id,
                name: saved.name,
                description: saved.description,
                slug: saved.slug,
                isPublic: saved.isPublic,
                version: saved._uplVersion || 1,
                createdAt: saved._uplCreatedAt,
                updatedAt: saved._uplUpdatedAt,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, ['owner'], rlsRunner)

            const { applicationRepo } = repos(req)
            const application = await applicationRepo.findOne({ where: { id: applicationId } })
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

            await ds.transaction(async (txManager) => {
                if (schemaName) {
                    const schemaIdent = quoteIdentifier(schemaName)
                    await txManager.query(`DROP SCHEMA IF EXISTS ${schemaIdent} CASCADE`)
                }

                const txRepo = txManager.getRepository(Application)
                const txApplication = await txRepo.findOne({ where: { id: applicationId } })
                if (!txApplication) {
                    // If the application disappeared concurrently, treat as not found.
                    return
                }
                await txRepo.remove(txApplication)
            })
            return res.status(204).send()
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { members, total } = await loadMembers(req, applicationId, validatedQuery)
            return res.json({ items: members, total, limit: validatedQuery.limit, offset: validatedQuery.offset })
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const schema = z.object({
                email: z.string().email(),
                role: z.enum(['member', 'editor', 'admin', 'owner']).default('member'),
                comment: z.string().max(500).optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { email, role, comment } = result.data
            const { applicationUserRepo, authUserRepo } = repos(req)

            const user = await authUserRepo.findOne({ where: { email: email.toLowerCase() } })
            if (!user) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await applicationUserRepo.findOne({
                where: { applicationId, userId: user.id }
            })
            if (existing) {
                return res.status(409).json({ error: 'User is already a member' })
            }

            const member = applicationUserRepo.create({
                applicationId,
                userId: user.id,
                role,
                comment,
                _uplCreatedBy: userId,
                _uplUpdatedBy: userId
            })
            await applicationUserRepo.save(member)

            const manager = getRequestManager(req, ds)
            const profiles = await manager.find(Profile, { where: { user_id: user.id } })
            const nickname = profiles.length > 0 ? profiles[0].nickname : null

            return res.status(201).json(mapMember(member, user.email, nickname))
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const { applicationUserRepo, authUserRepo } = repos(req)
            const member = await applicationUserRepo.findOne({
                where: { id: memberId, applicationId }
            })
            if (!member) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(member, 'Cannot modify owner role')

            const schema = z.object({
                role: z.enum(['member', 'editor', 'admin', 'owner']).optional(),
                comment: z.string().max(500).nullable().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { role, comment } = result.data

            if (role !== undefined) {
                if (role === 'owner' && ctx.membership.role !== 'owner') {
                    return res.status(403).json({ error: 'Only owner can transfer ownership' })
                }
                member.role = role
            }

            if (comment !== undefined) {
                member.comment = comment ?? undefined
            }

            member._uplUpdatedBy = userId

            await applicationUserRepo.save(member)

            const user = await authUserRepo.findOne({ where: { id: member.userId } })
            const manager = getRequestManager(req, ds)
            const profiles = await manager.find(Profile, { where: { user_id: member.userId } })
            const nickname = profiles.length > 0 ? profiles[0].nickname : null

            return res.json(mapMember(member, user?.email ?? null, nickname))
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'], rlsRunner)

            const { applicationUserRepo } = repos(req)
            const member = await applicationUserRepo.findOne({
                where: { id: memberId, applicationId }
            })
            if (!member) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(member, 'Cannot remove owner')

            await applicationUserRepo.remove(member)
            return res.status(204).send()
        })
    )

    return router
}
