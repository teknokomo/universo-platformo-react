import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { cloneSchemaWithExecutor, generateSchemaName, isValidSchemaName, generateTabularTableName } from '@universo/schema-ddl'
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

/**
 * Thrown inside `manager.transaction()` callbacks to signal a business-logic
 * failure that should trigger transaction rollback and a specific HTTP response.
 */
class UpdateFailure extends Error {
    constructor(public readonly statusCode: number, public readonly body: Record<string, unknown>) {
        super('Update failed')
    }
}

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

type RuntimeDataType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'DATE' | 'REF' | 'JSON' | 'TABLE'
type RuntimeRefOption = {
    id: string
    label: string
    codename?: string
    isDefault?: boolean
    sortOrder?: number
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
                      AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE')
                      AND parent_attribute_id IS NULL
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

            // Separate physical (non-TABLE) attributes from virtual TABLE attributes
            const physicalAttributes = safeAttributes.filter((a) => a.data_type !== 'TABLE')

            // Fetch child attributes for TABLE-type attributes
            const tableAttrs = safeAttributes.filter((a) => a.data_type === 'TABLE')
            const childAttrsByTableId = new Map<string, typeof attributes>()
            if (tableAttrs.length > 0) {
                const tableAttrIds = tableAttrs.map((a) => a.id)
                const childAttrs = (await manager.query(
                    `
                        SELECT id, codename, column_name, data_type, is_required,
                               presentation, validation_rules, sort_order, ui_config,
                               target_object_id, target_object_kind, parent_attribute_id
                        FROM ${schemaIdent}._app_attributes
                        WHERE parent_attribute_id = ANY($1::uuid[])
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
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
                        SELECT id, codename, table_name
                        FROM ${schemaIdent}._app_objects
                        WHERE id = ANY($1::uuid[])
                          AND kind = 'catalog'
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
                    `,
                    [catalogTargetObjectIds]
                )) as Array<{
                    id: string
                    codename: string
                    table_name: string
                }>

                const targetCatalogAttrs = (await manager.query(
                    `
                                                SELECT object_id, column_name, codename, data_type, is_display_attribute, sort_order
                        FROM ${schemaIdent}._app_attributes
                        WHERE object_id = ANY($1::uuid[])
                                                    AND parent_attribute_id IS NULL
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
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
                            WHERE COALESCE(_upl_deleted, false) = false
                              AND COALESCE(_app_deleted, false) = false
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
            // Use physicalAttributes for SQL — TABLE attrs have no physical column in parent table
            const selectColumns = ['id', ...physicalAttributes.map((attr) => quoteIdentifier(attr.column_name))]

            // Add correlated subqueries for TABLE attributes to include child row counts
            for (const tAttr of tableAttrs) {
                const fallbackTabTableName = generateTabularTableName(activeCatalog.table_name, tAttr.id)
                const tabTableName =
                    typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                        ? tAttr.column_name
                        : fallbackTabTableName
                if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
                selectColumns.push(
                    `(SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND COALESCE(_upl_deleted, false) = false AND COALESCE(_app_deleted, false) = false) AS ${quoteIdentifier(
                        tAttr.column_name
                    )}`
                )
            }

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
                    // TABLE attributes contain child row counts from subqueries
                    if (attribute.data_type === 'TABLE') {
                        mappedRow[attribute.column_name] = typeof row[attribute.column_name] === 'number' ? row[attribute.column_name] : 0
                        continue
                    }
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
                    refOptions:
                        attribute.data_type === 'REF' &&
                        typeof attribute.target_object_id === 'string' &&
                        (attribute.target_object_kind === 'enumeration' || attribute.target_object_kind === 'catalog')
                            ? attribute.target_object_kind === 'enumeration'
                                ? enumOptionsMap.get(attribute.target_object_id) ?? []
                                : catalogRefOptionsMap.get(attribute.target_object_id) ?? []
                            : undefined,
                    enumOptions:
                        attribute.data_type === 'REF' &&
                        attribute.target_object_kind === 'enumeration' &&
                        attribute.target_object_id &&
                        enumOptionsMap.has(attribute.target_object_id)
                            ? enumOptionsMap.get(attribute.target_object_id)
                            : undefined,
                    // Include child column definitions for TABLE attributes
                    childColumns:
                        attribute.data_type === 'TABLE'
                            ? (childAttrsByTableId.get(attribute.id) ?? []).map((child) => ({
                                  id: child.id,
                                  codename: child.codename,
                                  field: child.column_name,
                                  dataType: child.data_type,
                                  headerName: resolvePresentationName(child.presentation, requestedLocale, child.codename),
                                  isRequired: child.is_required ?? false,
                                  validationRules: child.validation_rules ?? {},
                                  uiConfig: child.ui_config ?? {},
                                  refTargetEntityId: child.target_object_id ?? null,
                                  refTargetEntityKind: child.target_object_kind ?? null,
                                  refOptions:
                                      child.data_type === 'REF' &&
                                      typeof child.target_object_id === 'string' &&
                                      (child.target_object_kind === 'enumeration' || child.target_object_kind === 'catalog')
                                          ? child.target_object_kind === 'enumeration'
                                              ? enumOptionsMap.get(child.target_object_id) ?? []
                                              : catalogRefOptionsMap.get(child.target_object_id) ?? []
                                          : undefined,
                                  enumOptions:
                                      child.data_type === 'REF' &&
                                      child.target_object_kind === 'enumeration' &&
                                      child.target_object_id &&
                                      enumOptionsMap.has(child.target_object_id)
                                          ? enumOptionsMap.get(child.target_object_id)
                                          : undefined
                              }))
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
                  AND parent_attribute_id IS NULL
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

            const { field, value, catalogId: requestedCatalogId, expectedVersion } = parsedBody.data
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
            const versionCheckClause = expectedVersion !== undefined ? 'AND COALESCE(_upl_version, 1) = $4' : ''
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
                      AND COALESCE(_upl_locked, false) = false
                      ${versionCheckClause}
                    RETURNING id
                `,
                expectedVersion !== undefined ? [coerced, ctx.userId, rowId, expectedVersion] : [coerced, ctx.userId, rowId]
            )) as Array<{ id: string }>

            if (updated.length === 0) {
                // Distinguish locked from not-found
                const exists = (await ctx.manager.query(
                    `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND COALESCE(_upl_deleted, false) = false AND COALESCE(_app_deleted, false) = false`,
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

            const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
            if (!parsedBody.success) {
                return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
            }

            const { catalogId: requestedCatalogId, data, expectedVersion } = parsedBody.data

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, requestedCatalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            const setClauses: string[] = []
            const values: unknown[] = []
            let paramIndex = 1

            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))
            const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
            const tableAttrs = safeAttrs.filter((a) => a.data_type === 'TABLE')

            for (const attr of nonTableAttrs) {
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

                const fallbackTabTableName = generateTabularTableName(catalog.table_name, tAttr.id)
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
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
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
            const performBulkUpdate = async (mgr: ReturnType<typeof getRequestManager>) => {
                const updated = (await mgr.query(
                    `
                        UPDATE ${dataTableIdent}
                        SET ${setClauses.join(', ')}
                        WHERE id = $${rowIdParamIndex}
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
                          AND COALESCE(_upl_locked, false) = false
                          ${versionCheckClause}
                        RETURNING id
                    `,
                    values
                )) as Array<{ id: string }>

                if (updated.length === 0) {
                    const exists = (await mgr.query(
                        `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND COALESCE(_upl_deleted, false) = false AND COALESCE(_app_deleted, false) = false`,
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
                    await mgr.query(
                        `
                            UPDATE ${tabTableIdent}
                            SET _upl_deleted = true,
                                _upl_deleted_at = NOW(),
                                _upl_deleted_by = $1,
                                _upl_updated_at = NOW(),
                                _upl_version = COALESCE(_upl_version, 1) + 1
                            WHERE _tp_parent_id = $2
                              AND COALESCE(_upl_deleted, false) = false
                              AND COALESCE(_app_deleted, false) = false
                        `,
                        [ctx.userId, rowId]
                    )

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
                    // Use TypeORM transaction management — creates savepoint when
                    // manager is already queryRunner-bound (RLS), or a new
                    // queryRunner with proper isolation otherwise.
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
                    const fallbackTabTableName = generateTabularTableName(catalog.table_name, tAttr.id)
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
                              AND COALESCE(_upl_deleted, false) = false
                              AND COALESCE(_app_deleted, false) = false
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
            const performCreate = async (mgr: ReturnType<typeof getRequestManager>): Promise<string> => {
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
            if (tableDataEntries.length > 0) {
                parentId = await ctx.manager.transaction(async (txManager) => {
                    return performCreate(txManager)
                })
            } else {
                parentId = await performCreate(ctx.manager)
            }
            return res.status(201).json({ id: parentId, status: 'created' })
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

            const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && a.data_type !== 'TABLE')
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

            const { catalog, attrs, error: catalogError } = await resolveRuntimeCatalog(ctx.manager, ctx.schemaIdent, catalogId)
            if (!catalog) return res.status(404).json({ error: catalogError })

            const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(catalog.table_name)}`

            // Cascade soft-delete to child tables if any TABLE attributes exist
            const tableAttrsForDelete = attrs.filter((a) => a.data_type === 'TABLE')
            const needsTransaction = tableAttrsForDelete.length > 0

            // Helper: soft-delete parent row + cascade to child tables
            const performDelete = async (mgr: ReturnType<typeof getRequestManager>) => {
                const deleted = (await mgr.query(
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
                          AND COALESCE(_upl_locked, false) = false
                        RETURNING id
                    `,
                    [ctx.userId, rowId]
                )) as Array<{ id: string }>

                if (deleted.length === 0) {
                    const exists = (await mgr.query(
                        `SELECT id, _upl_locked FROM ${dataTableIdent} WHERE id = $1 AND COALESCE(_upl_deleted, false) = false AND COALESCE(_app_deleted, false) = false`,
                        [rowId]
                    )) as Array<{ id: string; _upl_locked?: boolean }>
                    if (exists.length > 0 && exists[0]._upl_locked) {
                        throw new UpdateFailure(423, { error: 'Record is locked' })
                    }
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                // Soft-delete child rows in TABLE child tables
                for (const tAttr of tableAttrsForDelete) {
                    const fallbackTabTableName = generateTabularTableName(catalog.table_name, tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
                    await mgr.query(
                        `
                            UPDATE ${tabTableIdent}
                            SET _upl_deleted = true,
                                _upl_deleted_at = NOW(),
                                _upl_deleted_by = $1,
                                _upl_updated_at = NOW(),
                                _upl_version = COALESCE(_upl_version, 1) + 1
                            WHERE _tp_parent_id = $2
                              AND COALESCE(_upl_deleted, false) = false
                              AND COALESCE(_app_deleted, false) = false
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
    const resolveTabularContext = async (
        manager: ReturnType<typeof getRequestManager>,
        schemaIdent: string,
        catalogId: string,
        attributeId: string
    ) => {
        if (!UUID_REGEX.test(catalogId) || !UUID_REGEX.test(attributeId)) {
            return { error: 'Invalid catalog or attribute ID format' } as const
        }

        // Find the catalog
        const catalogs = (await manager.query(
            `
                SELECT id, codename, table_name
                FROM ${schemaIdent}._app_objects
                WHERE id = $1 AND kind = 'catalog'
                  AND COALESCE(_upl_deleted, false) = false
                  AND COALESCE(_app_deleted, false) = false
            `,
            [catalogId]
        )) as Array<{ id: string; codename: string; table_name: string }>

        if (catalogs.length === 0) return { error: 'Catalog not found' } as const

        const catalog = catalogs[0]
        if (!IDENTIFIER_REGEX.test(catalog.table_name)) return { error: 'Invalid table name' } as const

        // Find the TABLE attribute
        const tableAttrs = (await manager.query(
            `
                SELECT id, codename, column_name, data_type, validation_rules
                FROM ${schemaIdent}._app_attributes
                WHERE id = $1 AND object_id = $2 AND data_type = 'TABLE'
                  AND parent_attribute_id IS NULL
                  AND COALESCE(_upl_deleted, false) = false
                  AND COALESCE(_app_deleted, false) = false
            `,
            [attributeId, catalogId]
        )) as Array<{ id: string; codename: string; column_name: string; data_type: string; validation_rules?: Record<string, unknown> }>

        if (tableAttrs.length === 0) return { error: 'TABLE attribute not found' } as const

        const tableAttr = tableAttrs[0]
        const fallbackTabTableName = generateTabularTableName(catalog.table_name, tableAttr.id)
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
                  AND COALESCE(_upl_deleted, false) = false
                  AND COALESCE(_app_deleted, false) = false
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

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })

            const safeChildAttrs = tc.childAttrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
            const selectCols = ['id', '_tp_sort_order', ...safeChildAttrs.map((a) => quoteIdentifier(a.column_name))]

            // Get total count
            const countResult = (await ctx.manager.query(
                `
                    SELECT COUNT(*)::int AS total
                    FROM ${tc.tabTableIdent}
                    WHERE _tp_parent_id = $1
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                `,
                [recordId]
            )) as Array<{ total: number }>
            const total = countResult[0]?.total ?? 0

            const rows = (await ctx.manager.query(
                `
                    SELECT ${selectCols.join(', ')}
                    FROM ${tc.tabTableIdent}
                    WHERE _tp_parent_id = $1
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                    ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
                    LIMIT $2 OFFSET $3
                `,
                [recordId, limit, offset]
            )) as Array<Record<string, unknown>>

            const items = rows.map((row) => {
                const mapped: Record<string, unknown> & { id: string } = { id: String(row.id) }
                mapped._tp_sort_order = row._tp_sort_order ?? 0
                for (const attr of safeChildAttrs) {
                    mapped[attr.column_name] = row[attr.column_name] ?? null
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

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })
            const data = (req.body?.data ?? req.body) as Record<string, unknown>
            const sortOrder = typeof data._tp_sort_order === 'number' ? data._tp_sort_order : 0

            const colNames: string[] = ['_tp_parent_id', '_tp_sort_order']
            const placeholders: string[] = ['$1', '$2']
            const values: unknown[] = [recordId, sortOrder]
            let pIdx = 3

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
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
                        FOR UPDATE
                    `,
                    [recordId]
                )) as Array<{ id: string; _upl_locked?: boolean }>

                if (parentRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch(() => {})
                    return res.status(404).json({ error: 'Parent record not found' })
                }
                if (parentRows[0]._upl_locked) {
                    await ctx.manager.query('ROLLBACK').catch(() => {})
                    return res.status(423).json({ error: 'Parent record is locked' })
                }

                const { minRows, maxRows } = getTableRowLimits(tc.tableAttr.validation_rules)
                const activeCountRows = (await ctx.manager.query(
                    `
                        SELECT COUNT(*)::int AS cnt
                        FROM ${tc.tabTableIdent}
                        WHERE _tp_parent_id = $1
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
                    `,
                    [recordId]
                )) as Array<{ cnt: number }>
                const activeCount = Number(activeCountRows[0]?.cnt ?? 0)
                const maxRowsError = getTableRowCountError(activeCount + 1, tc.tableAttr.codename, { minRows, maxRows })
                if (maxRowsError && maxRows !== null) {
                    await ctx.manager.query('ROLLBACK').catch(() => {})
                    return res.status(400).json({ error: maxRowsError })
                }

                const [inserted] = (await ctx.manager.query(
                    `INSERT INTO ${tc.tabTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
                    values
                )) as Array<{ id: string }>

                await ctx.manager.query('COMMIT')
                return res.status(201).json({ id: inserted.id, status: 'created' })
            } catch (error) {
                await ctx.manager.query('ROLLBACK').catch(() => {})
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

            const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
            if (tc.error) return res.status(400).json({ error: tc.error })

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
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
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
                if (
                    cAttr.data_type === 'REF' &&
                    cAttr.target_object_kind === 'enumeration' &&
                    getEnumPresentationMode(cAttr.ui_config) === 'label'
                ) {
                    return res.status(400).json({ error: `Field is read-only: ${tc.tableAttr.codename}.${cAttr.codename}` })
                }
                if (raw === null && cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                    return res
                        .status(400)
                        .json({ error: `Required field cannot be set to null: ${tc.tableAttr.codename}.${cAttr.codename}` })
                }
                try {
                    const coerced = coerceRuntimeValue(raw, cAttr.data_type, cAttr.validation_rules)
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
                      AND COALESCE(_upl_deleted, false) = false
                      AND COALESCE(_app_deleted, false) = false
                      AND NOT EXISTS (SELECT 1 FROM ${
                          tc.parentTableIdent
                      } WHERE id = $${parentIdParam} AND COALESCE(_upl_locked, false) = true)
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
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
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
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
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

            await ctx.manager.query('BEGIN')
            try {
                const parentRows = (await ctx.manager.query(
                    `
                        SELECT id, _upl_locked
                        FROM ${tc.parentTableIdent}
                        WHERE id = $1
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
                        FOR UPDATE
                    `,
                    [recordId]
                )) as Array<{ id: string; _upl_locked?: boolean }>

                if (parentRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch(() => {})
                    return res.status(404).json({ error: 'Parent record not found' })
                }
                if (parentRows[0]._upl_locked) {
                    await ctx.manager.query('ROLLBACK').catch(() => {})
                    return res.status(423).json({ error: 'Parent record is locked' })
                }

                const childRows = (await ctx.manager.query(
                    `
                        SELECT id
                        FROM ${tc.tabTableIdent}
                        WHERE id = $1
                          AND _tp_parent_id = $2
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
                        LIMIT 1
                    `,
                    [childRowId, recordId]
                )) as Array<{ id: string }>

                if (childRows.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch(() => {})
                    return res.status(404).json({ error: 'Child row not found' })
                }

                const { minRows } = getTableRowLimits(tc.tableAttr.validation_rules)
                if (minRows !== null) {
                    const activeCountRows = (await ctx.manager.query(
                        `
                            SELECT COUNT(*)::int AS cnt
                            FROM ${tc.tabTableIdent}
                            WHERE _tp_parent_id = $1
                              AND COALESCE(_upl_deleted, false) = false
                              AND COALESCE(_app_deleted, false) = false
                        `,
                        [recordId]
                    )) as Array<{ cnt: number }>
                    const activeCount = Number(activeCountRows[0]?.cnt ?? 0)
                    const minRowsError = getTableRowCountError(activeCount - 1, tc.tableAttr.codename, { minRows, maxRows: null })
                    if (minRowsError) {
                        await ctx.manager.query('ROLLBACK').catch(() => {})
                        return res.status(400).json({ error: minRowsError })
                    }
                }

                const deleted = (await ctx.manager.query(
                    `
                        UPDATE ${tc.tabTableIdent}
                        SET _upl_deleted = true,
                            _upl_deleted_at = NOW(),
                            _upl_deleted_by = $1,
                            _upl_updated_at = NOW(),
                            _upl_version = COALESCE(_upl_version, 1) + 1
                        WHERE id = $2
                          AND _tp_parent_id = $3
                          AND COALESCE(_upl_deleted, false) = false
                          AND COALESCE(_app_deleted, false) = false
                        RETURNING id
                    `,
                    [ctx.userId, childRowId, recordId]
                )) as Array<{ id: string }>

                if (deleted.length === 0) {
                    await ctx.manager.query('ROLLBACK').catch(() => {})
                    return res.status(404).json({ error: 'Child row not found' })
                }

                await ctx.manager.query('COMMIT')
                return res.json({ status: 'deleted' })
            } catch (error) {
                await ctx.manager.query('ROLLBACK').catch(() => {})
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
