import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { cloneSchemaWithExecutor, generateSchemaName, isValidSchemaName } from '@universo/schema-ddl'
import { Application } from '../database/entities/Application'
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

const resolveRuntimeValue = (value: unknown, dataType: 'BOOLEAN' | 'STRING' | 'NUMBER', locale: string): unknown => {
    if (value === null || value === undefined) {
        return null
    }

    if (dataType !== 'STRING') {
        return value
    }

    if (typeof value === 'string') {
        return value
    }

    if (typeof value === 'object') {
        const localized = getVLCString(value as Record<string, unknown>, locale)
        if (localized) {
            return localized
        }

        try {
            return JSON.stringify(value)
        } catch {
            return ''
        }
    }

    return String(value)
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
        locale: z.string().min(2).max(10).optional().default('en')
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
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

            const parsedQuery = runtimeQuerySchema.safeParse(req.query)
            if (!parsedQuery.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
            }

            const { limit, offset, locale } = parsedQuery.data
            const requestedLocale = normalizeLocale(locale)
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
            if (catalogs.length > 1) {
                return res.status(409).json({
                    error: 'Multiple catalogs are not supported in runtime MVP',
                    details: { catalogs: catalogs.length }
                })
            }

            const catalog = catalogs[0] as {
                id: string
                codename: string
                table_name: string
                presentation?: unknown
            }

            if (!IDENTIFIER_REGEX.test(catalog.table_name)) {
                return res.status(400).json({ error: 'Invalid runtime table name' })
            }

            const attributes = (await manager.query(
                `
                    SELECT id, codename, column_name, data_type, presentation, sort_order
                    FROM ${schemaIdent}._app_attributes
                    WHERE object_id = $1
                      AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER')
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
                `,
                [catalog.id]
            )) as Array<{
                id: string
                codename: string
                column_name: string
                data_type: 'BOOLEAN' | 'STRING' | 'NUMBER'
                presentation?: unknown
                sort_order?: number
            }>

            const safeAttributes = attributes.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name))

            const dataTableIdent = `${schemaIdent}.${quoteIdentifier(catalog.table_name)}`
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

            return res.json({
                catalog: {
                    id: catalog.id,
                    codename: catalog.codename,
                    tableName: catalog.table_name,
                    name: resolvePresentationName(catalog.presentation, requestedLocale, catalog.codename)
                },
                columns: safeAttributes.map((attribute) => ({
                    id: attribute.id,
                    codename: attribute.codename,
                    field: attribute.column_name,
                    dataType: attribute.data_type,
                    headerName: resolvePresentationName(attribute.presentation, requestedLocale, attribute.codename)
                })),
                rows,
                pagination: {
                    total: typeof total === 'number' ? total : Number(total) || 0,
                    limit,
                    offset
                },
                layoutConfig
            })
        })
    )

    // ============ APPLICATION RUNTIME CELL UPDATE (BOOLEAN MVP) ============
    const runtimeUpdateBodySchema = z.object({
        field: z.string().min(1),
        value: z.boolean().nullable()
    })

    router.patch(
        '/:applicationId/runtime/:rowId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId, rowId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureApplicationAccess(ds, userId, applicationId, undefined, rlsRunner)

            const parsedBody = runtimeUpdateBodySchema.safeParse(req.body)
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const { field, value } = parsedBody.data
            if (!IDENTIFIER_REGEX.test(field)) {
                return res.status(400).json({ error: 'Invalid field name' })
            }

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
                    SELECT id, codename, table_name
                    FROM ${schemaIdent}._app_objects
                    WHERE kind = 'catalog'
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    ORDER BY codename ASC
                `
            )

            if (catalogs.length !== 1) {
                return res.status(409).json({ error: 'Runtime update supports single catalog MVP only' })
            }

            const catalog = catalogs[0] as { id: string; table_name: string }
            if (!IDENTIFIER_REGEX.test(catalog.table_name)) {
                return res.status(400).json({ error: 'Invalid runtime table name' })
            }

            const attrs = (await manager.query(
                `
                    SELECT column_name, data_type
                    FROM ${schemaIdent}._app_attributes
                    WHERE object_id = $1
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                `,
                [catalog.id]
            )) as Array<{ column_name: string; data_type: string }>

            const attr = attrs.find((a) => a.column_name === field)
            if (!attr) {
                return res.status(404).json({ error: 'Attribute not found' })
            }
            if (attr.data_type !== 'BOOLEAN') {
                return res.status(400).json({ error: 'Only BOOLEAN fields are editable in runtime MVP' })
            }

            const dataTableIdent = `${schemaIdent}.${quoteIdentifier(catalog.table_name)}`
            const updated = (await manager.query(
                `
                    UPDATE ${dataTableIdent}
                    SET ${quoteIdentifier(field)} = $1,
                        _upl_updated_at = NOW(),
                        _upl_version = COALESCE(_upl_version, 1) + 1
                    WHERE id = $2
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    RETURNING id
                `,
                [value, rowId]
            )) as Array<{ id: string }>

            if (updated.length === 0) {
                return res.status(404).json({ error: 'Row not found' })
            }

            return res.json({ status: 'ok' })
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
                            schemaStatus: sourceApplication.schemaStatus,
                            schemaSyncedAt: sourceApplication.schemaSyncedAt,
                            schemaError: sourceApplication.schemaError,
                            schemaSnapshot: sourceApplication.schemaSnapshot,
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
