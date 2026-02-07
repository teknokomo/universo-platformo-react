import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { AuthUser, RequestWithDbContext } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubUser } from '../../../database/entities/MetahubUser'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { Publication } from '../../../database/entities/Publication'
// Hub entity removed - hubs are now in isolated schemas (_mhb_hubs)
import { Profile } from '@universo/profile-backend'
import { ensureMetahubAccess, ROLE_PERMISSIONS, assertNotOwner, MetahubRole } from '../../shared/guards'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { normalizeCodename, isValidCodename } from '@universo/utils/validation/codename'
import { OptimisticLockError } from '@universo/utils'
import { isValidSchemaName } from '@universo/schema-ddl'
import { escapeLikeWildcards, getRequestManager } from '../../../utils'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { MetahubObjectsService } from '../services/MetahubObjectsService'
import { MetahubHubsService } from '../services/MetahubHubsService'
import { MetahubBranchesService } from '../../branches/services/MetahubBranchesService'
import { getDDLServices } from '../../ddl'

const getRequestQueryRunner = (req: Request) => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
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

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
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

export function createMetahubsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        const schemaService = new MetahubSchemaService(ds)
        const objectsService = new MetahubObjectsService(schemaService)
        const branchesService = new MetahubBranchesService(ds, manager)
        return {
            metahubRepo: manager.getRepository(Metahub),
            metahubUserRepo: manager.getRepository(MetahubUser),
            // hubRepo removed - hubs are in isolated schemas now
            authUserRepo: manager.getRepository(AuthUser),
            schemaService,
            objectsService,
            branchesService
        }
    }

    const mapMember = (member: MetahubUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.userId,
        email,
        nickname,
        role: (member.role || 'member') as MetahubRole,
        comment: member.comment,
        createdAt: member._uplCreatedAt
    })

    const loadMembers = async (
        req: Request,
        metahubId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { metahubUserRepo } = repos(req)
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)

        try {
            const qb = metahubUserRepo.createQueryBuilder('mu').where('mu.metahubId = :metahubId', { metahubId })

            if (params) {
                const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = params

                if (search) {
                    const escapedSearch = escapeLikeWildcards(search.toLowerCase())
                    qb.andWhere(
                        `(
                            EXISTS (SELECT 1 FROM auth.users u WHERE u.id = mu.userId AND LOWER(u.email) LIKE :search)
                         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = mu.userId AND LOWER(p.nickname) LIKE :search)
                        )`,
                        { search: `%${escapedSearch}%` }
                    )
                }

                const orderColumn =
                    sortBy === 'email'
                        ? '(SELECT u.email FROM auth.users u WHERE u.id = mu.userId)'
                        : sortBy === 'role'
                        ? 'mu.role'
                        : 'mu._upl_created_at'
                qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                qb.skip(offset).take(limit)
            }

            const [rawMembers, total] = await qb.getManyAndCount()
            const userIds = rawMembers.map((m) => m.userId)

            if (userIds.length === 0) {
                return { members: [], total }
            }

            // Load users and profiles data using proper entities (not raw queries)
            const users = userIds.length ? await manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await manager.find(Profile, { where: { user_id: In(userIds) } }) : []

            const usersMap = new Map(users.map((user) => [user.id, user.email ?? null]))
            const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile.nickname]))

            const members = rawMembers.map((m) => mapMember(m, usersMap.get(m.userId) ?? null, profilesMap.get(m.userId) ?? null))

            return { members, total }
        } catch (error) {
            console.error('[loadMembers] Error loading metahub members:', error)
            throw error
        }
    }

    // ============ LIST METAHUBS ============
    router.get(
        '/metahubs',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubRepo, metahubUserRepo } = repos(req)
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

            // Check if user has global access
            const isSuperuser = await isSuperuserByDataSource(ds, userId, rlsRunner)
            const hasGlobalMetahubsAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs', 'read', rlsRunner)

            let qb = metahubRepo.createQueryBuilder('m')

            // Apply access filter
            if (showAll && (isSuperuser || hasGlobalMetahubsAccess)) {
                // Show all metahubs for superusers/global admins
            } else {
                // Show only metahubs user is member of
                qb = qb.where(`m.id IN (SELECT mu.metahub_id FROM metahubs.metahubs_users mu WHERE mu.user_id = :userId)`, { userId })
            }

            // Search - search in JSONB name and description fields
            if (search) {
                qb = qb.andWhere(
                    "(m.name::text ILIKE :search OR COALESCE(m.description::text, '') ILIKE :search OR COALESCE(m.slug, '') ILIKE :search OR COALESCE(m.codename, '') ILIKE :search)",
                    { search: `%${search}%` }
                )
            }

            // Sorting - use JSONB extraction with dynamic primary locale for name sorting
            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(m.name->>(m.name->>'_primary'), m.name->>'en', '')"
                    : sortBy === 'codename'
                    ? 'm.codename'
                    : sortBy === 'created'
                    ? 'm._upl_created_at'
                    : 'm._upl_updated_at'
            qb = qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')

            // Pagination
            qb = qb.skip(offset).take(limit)

            const [metahubs, total] = await qb.getManyAndCount()
            const metahubIds = metahubs.map((m) => m.id)

            // Load counters and membership info
            const memberships =
                metahubIds.length > 0
                    ? await metahubUserRepo.find({
                          where: { metahubId: In(metahubIds), userId }
                      })
                    : []
            const membershipMap = new Map(memberships.map((m) => [m.metahubId, m]))

            // Count hubs per metahub
            // TODO: Implement schema-based hub counting via Knex (_mhb_hubs in isolated schemas)
            // For now, return empty map (hubs are in isolated schemas, not metahubs.hubs)
            const hubCountMap = new Map<string, number>()

            // Count members per metahub
            const memberCounts =
                metahubIds.length > 0
                    ? await metahubUserRepo
                          .createQueryBuilder('mu')
                          .select('mu.metahub_id', 'metahubId')
                          .addSelect('COUNT(*)', 'count')
                          .where('mu.metahub_id IN (:...ids)', { ids: metahubIds })
                          .groupBy('mu.metahub_id')
                          .getRawMany<{ metahubId: string; count: string }>()
                    : []
            const memberCountMap = new Map(memberCounts.map((c) => [c.metahubId, parseInt(c.count, 10)]))

            // Determine access type for each metahub
            const globalRoleName =
                isSuperuser || hasGlobalMetahubsAccess ? await getGlobalRoleCodenameByDataSource(ds, userId, rlsRunner) : null

            const result = metahubs.map((m) => {
                const membership = membershipMap.get(m.id)
                const role = membership ? (membership.role as MetahubRole) : globalRoleName ? 'owner' : 'member'
                const accessType = membership ? 'member' : globalRoleName ?? 'member'
                const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

                return {
                    id: m.id,
                    name: m.name,
                    description: m.description,
                    codename: m.codename,
                    slug: m.slug,
                    isPublic: m.isPublic,
                    version: m._uplVersion || 1,
                    createdAt: m._uplCreatedAt,
                    updatedAt: m._uplUpdatedAt,
                    hubsCount: hubCountMap.get(m.id) ?? 0,
                    catalogsCount: 0, // Cannot count efficiently across dynamic schemas
                    membersCount: memberCountMap.get(m.id) ?? 0,
                    role,
                    accessType,
                    permissions
                }
            })

            return res.json({ items: result, total, limit, offset })
        })
    )

    // ============ GET SINGLE METAHUB ============
    router.get(
        '/metahub/:metahubId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { metahubRepo, objectsService } = repos(req)
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            // Load counts from active branch (user-specific)
            const hubsService = new MetahubHubsService(new MetahubSchemaService(ds))
            let hubsCount = 0
            try {
                const { total } = await hubsService.findAll(metahubId, { limit: 1, offset: 0 }, userId)
                hubsCount = total
            } catch (e) {
                // Ignore errors (e.g. schema not found yet)
            }

            // Count catalogs by active branch schema
            let catalogsCount = 0
            try {
                catalogsCount = await objectsService.countByKind(metahubId, 'CATALOG', userId)
            } catch (e) {
                // Ignore error (e.g. schema not found)
            }

            const { total: membersCount } = await loadMembers(req, metahubId, { limit: 1 })

            const role = ctx.membership.role as MetahubRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                codename: metahub.codename,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                version: metahub._uplVersion || 1,
                createdAt: metahub._uplCreatedAt,
                updatedAt: metahub._uplUpdatedAt,
                hubsCount,
                catalogsCount,
                membersCount,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
            })
        })
    )

    // ============ METAHUB BOARD SUMMARY ============
    router.get(
        '/metahub/:metahubId/board/summary',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { metahubRepo, metahubUserRepo } = repos(req)
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const branchesRepo = ds.getRepository(MetahubBranch)
            const publicationsRepo = ds.getRepository(Publication)

            const membership = await metahubUserRepo.findOne({ where: { metahubId, userId } })
            const activeBranchId = membership?.activeBranchId ?? metahub.defaultBranchId ?? null

            let hubsCount = 0
            let catalogsCount = 0

            if (activeBranchId) {
                const activeBranch = await branchesRepo.findOne({ where: { id: activeBranchId, metahubId } })
                const schemaName = activeBranch?.schemaName ?? null

                if (schemaName && /^mhb_[a-f0-9]+_b\d+$/i.test(schemaName)) {
                    const manager = getRequestManager(req, ds)
                    try {
                        const [hubsResult, catalogsResult] = await Promise.all([
                            manager.query(`SELECT COUNT(*)::int as count FROM "${schemaName}"._mhb_objects WHERE kind = 'HUB'`),
                            manager.query(`SELECT COUNT(*)::int as count FROM "${schemaName}"._mhb_objects WHERE kind = 'CATALOG'`)
                        ])
                        hubsCount = parseInt(hubsResult?.[0]?.count ?? '0', 10)
                        catalogsCount = parseInt(catalogsResult?.[0]?.count ?? '0', 10)
                    } catch (e) {
                        hubsCount = 0
                        catalogsCount = 0
                    }
                }
            }

            const [branchesCount, publicationsCount, membersCount] = await Promise.all([
                branchesRepo.count({ where: { metahubId } }),
                publicationsRepo.count({ where: { metahubId } }),
                metahubUserRepo.count({ where: { metahubId } })
            ])

            const manager = getRequestManager(req, ds)
            const versionsResult = await manager.query(
                `
                SELECT COUNT(*)::int as count
                FROM metahubs.publication_versions pv
                JOIN metahubs.publications p ON p.id = pv.publication_id
                WHERE p.metahub_id = $1
            `,
                [metahubId]
            )

            const applicationsResult = await manager.query(
                `
                SELECT COUNT(DISTINCT a.id)::int as count
                FROM applications.applications a
                JOIN applications.connectors c ON c.application_id = a.id
                JOIN applications.connectors_publications cp ON cp.connector_id = c.id
                JOIN metahubs.publications p ON p.id = cp.publication_id
                WHERE p.metahub_id = $1
            `,
                [metahubId]
            )

            return res.json({
                metahubId,
                activeBranchId,
                branchesCount,
                hubsCount,
                catalogsCount,
                membersCount,
                publicationsCount,
                publicationVersionsCount: parseInt(versionsResult?.[0]?.count ?? '0', 10),
                applicationsCount: parseInt(applicationsResult?.[0]?.count ?? '0', 10)
            })
        })
    )

    // ============ CREATE METAHUB ============
    router.post(
        '/metahubs',
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
                codename: z.string().min(1).max(100),
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

            const { metahubRepo, metahubUserRepo, branchesService } = repos(req)

            const normalizedCodename = normalizeCodename(result.data.codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Invalid input',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existingCodename = await metahubRepo.findOne({ where: { codename: normalizedCodename } })
            if (existingCodename) {
                return res.status(409).json({ error: 'Codename already in use' })
            }

            // Check slug uniqueness if provided
            if (result.data.slug) {
                const existing = await metahubRepo.findOne({ where: { slug: result.data.slug } })
                if (existing) {
                    return res.status(409).json({ error: 'Slug already in use' })
                }
            }

            const sanitizedName = sanitizeLocalizedInput(result.data.name)
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, result.data.namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (result.data.description) {
                const sanitizedDescription = sanitizeLocalizedInput(result.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(
                        sanitizedDescription,
                        result.data.descriptionPrimaryLocale,
                        result.data.namePrimaryLocale ?? 'en'
                    )
                }
            }

            const metahub = metahubRepo.create({
                name: nameVlc,
                description: descriptionVlc,
                codename: normalizedCodename,
                slug: result.data.slug,
                isPublic: result.data.isPublic ?? false,
                _uplCreatedBy: userId,
                _uplUpdatedBy: userId
            })
            await metahubRepo.save(metahub)

            // Create owner membership
            const membership = metahubUserRepo.create({
                metahubId: metahub.id,
                userId,
                role: 'owner',
                _uplCreatedBy: userId,
                _uplUpdatedBy: userId
            })
            await metahubUserRepo.save(membership)

            const branchName = buildLocalizedContent({ en: 'Main', ru: 'Главная' }, 'en', 'en')
            const branchDescription = buildLocalizedContent({ en: 'Your first branch', ru: 'Ваша первая ветка' }, 'en', 'en')
            if (!branchName) {
                return res.status(500).json({ error: 'Failed to build default branch name' })
            }

            await branchesService.createInitialBranch({
                metahubId: metahub.id,
                name: branchName,
                description: branchDescription ?? null,
                createdBy: userId
            })

            return res.status(201).json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                codename: metahub.codename,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                version: metahub._uplVersion || 1,
                createdAt: metahub._uplCreatedAt,
                updatedAt: metahub._uplUpdatedAt,
                role: 'owner',
                accessType: 'member',
                permissions: ROLE_PERMISSIONS.owner
            })
        })
    )

    // ============ COPY METAHUB ============
    router.post(
        '/metahub/:metahubId/copy',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const manager = getRequestManager(req, ds)
            const rlsRunner = getRequestQueryRunner(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

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
                codename: z.string().min(1).max(100).optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional(),
                copyDefaultBranchOnly: z.boolean().optional().default(true),
                copyAccess: z.boolean().optional().default(false)
            })

            const parsed = schema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const sourceMetahubRepo = manager.getRepository(Metahub)
            const sourceBranchRepo = manager.getRepository(MetahubBranch)
            const sourceMemberRepo = manager.getRepository(MetahubUser)

            const sourceMetahub = await sourceMetahubRepo.findOne({ where: { id: metahubId } })
            if (!sourceMetahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const sourceBranches = await sourceBranchRepo.find({
                where: { metahubId },
                order: { branchNumber: 'ASC' }
            })
            if (sourceBranches.length === 0) {
                return res.status(409).json({ error: 'Metahub has no branches to copy' })
            }

            const defaultSourceBranch = sourceBranches.find((branch) => branch.id === sourceMetahub.defaultBranchId) ?? sourceBranches[0]

            const selectedSourceBranches = parsed.data.copyDefaultBranchOnly ? [defaultSourceBranch] : sourceBranches

            const requestedName = parsed.data.name
                ? sanitizeLocalizedInput(parsed.data.name)
                : buildDefaultCopyNameInput(sourceMetahub.name)
            if (Object.keys(requestedName).length === 0) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceMetahub.name?._primary ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = sourceMetahub.description
            if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(
                        sanitizedDescription,
                        parsed.data.descriptionPrimaryLocale,
                        parsed.data.namePrimaryLocale ?? sourceMetahub.description?._primary ?? sourceMetahub.name?._primary ?? 'en'
                    )
                } else {
                    descriptionVlc = undefined
                }
            }

            const normalizedCodename = normalizeCodename(parsed.data.codename ?? `${sourceMetahub.codename}-copy`)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Invalid input',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existingCodename = await sourceMetahubRepo.findOne({ where: { codename: normalizedCodename } })
            if (existingCodename) {
                return res.status(409).json({ error: 'Codename already in use' })
            }

            const slugCandidate = parsed.data.slug ?? (sourceMetahub.slug ? `${sourceMetahub.slug}-copy` : undefined)
            if (slugCandidate) {
                const existingSlug = await sourceMetahubRepo.findOne({ where: { slug: slugCandidate } })
                if (existingSlug) {
                    return res.status(409).json({ error: 'Slug already in use' })
                }
            }

            const [{ id: newMetahubId }] = (await manager.query(`SELECT public.uuid_generate_v7() AS id`)) as Array<{ id: string }>

            const cleanMetahubId = newMetahubId.replace(/-/g, '')
            const branchClonePlan = selectedSourceBranches.map((sourceBranch, index) => ({
                sourceBranch,
                branchNumber: index + 1,
                schemaName: `mhb_${cleanMetahubId}_b${index + 1}`
            }))

            for (const planItem of branchClonePlan) {
                if (!isValidSchemaName(planItem.schemaName) || !IDENTIFIER_REGEX.test(planItem.schemaName)) {
                    return res.status(400).json({ error: 'Invalid generated schema name for copied branch' })
                }
            }

            const { cloner, generator } = getDDLServices()
            const createdSchemas: string[] = []
            try {
                for (const planItem of branchClonePlan) {
                    await cloner.clone({
                        sourceSchema: planItem.sourceBranch.schemaName,
                        targetSchema: planItem.schemaName,
                        dropTargetSchemaIfExists: true,
                        createTargetSchema: true,
                        copyData: true
                    })
                    createdSchemas.push(planItem.schemaName)
                }
            } catch (error) {
                for (const schemaName of createdSchemas.slice().reverse()) {
                    await generator.dropSchema(schemaName).catch(() => undefined)
                }
                throw error
            }

            try {
                const copied = await ds.transaction(async (txManager) => {
                    const txMetahubRepo = txManager.getRepository(Metahub)
                    const txBranchRepo = txManager.getRepository(MetahubBranch)
                    const txMemberRepo = txManager.getRepository(MetahubUser)

                    const copiedMetahub = txMetahubRepo.create({
                        id: newMetahubId,
                        name: nameVlc,
                        description: descriptionVlc,
                        codename: normalizedCodename,
                        slug: slugCandidate,
                        isPublic: parsed.data.isPublic ?? sourceMetahub.isPublic,
                        defaultBranchId: null,
                        lastBranchNumber: branchClonePlan.length,
                        _uplCreatedBy: userId,
                        _uplUpdatedBy: userId
                    })
                    await txMetahubRepo.save(copiedMetahub)

                    const branchIdMap = new Map<string, string>()
                    for (const planItem of branchClonePlan) {
                        const savedBranch = await txBranchRepo.save(
                            txBranchRepo.create({
                                metahubId: copiedMetahub.id,
                                sourceBranchId: null,
                                name: planItem.sourceBranch.name,
                                description: planItem.sourceBranch.description ?? null,
                                codename: planItem.sourceBranch.codename,
                                branchNumber: planItem.branchNumber,
                                schemaName: planItem.schemaName,
                                _uplCreatedBy: userId,
                                _uplUpdatedBy: userId
                            })
                        )
                        branchIdMap.set(planItem.sourceBranch.id, savedBranch.id)
                    }

                    for (const planItem of branchClonePlan) {
                        if (!planItem.sourceBranch.sourceBranchId) continue
                        const branchId = branchIdMap.get(planItem.sourceBranch.id)
                        const mappedSourceId = branchIdMap.get(planItem.sourceBranch.sourceBranchId)
                        if (!branchId || !mappedSourceId) continue
                        await txBranchRepo.update({ id: branchId }, { sourceBranchId: mappedSourceId, _uplUpdatedBy: userId })
                    }

                    const copiedDefaultBranchId = branchIdMap.get(defaultSourceBranch.id) ?? null
                    await txMetahubRepo.update(
                        { id: copiedMetahub.id },
                        { defaultBranchId: copiedDefaultBranchId, lastBranchNumber: branchClonePlan.length, _uplUpdatedBy: userId }
                    )

                    await txMemberRepo.save(
                        txMemberRepo.create({
                            metahubId: copiedMetahub.id,
                            userId,
                            role: 'owner',
                            activeBranchId: copiedDefaultBranchId,
                            _uplCreatedBy: userId,
                            _uplUpdatedBy: userId
                        })
                    )

                    if (parsed.data.copyAccess) {
                        const sourceMembers = await sourceMemberRepo.find({
                            where: {
                                metahubId,
                                _uplDeleted: false,
                                _mhbDeleted: false
                            }
                        })
                        for (const sourceMember of sourceMembers) {
                            if (sourceMember.userId === userId) continue
                            await txMemberRepo.save(
                                txMemberRepo.create({
                                    metahubId: copiedMetahub.id,
                                    userId: sourceMember.userId,
                                    role: sourceMember.role,
                                    comment: sourceMember.comment,
                                    activeBranchId: sourceMember.activeBranchId
                                        ? branchIdMap.get(sourceMember.activeBranchId) ?? null
                                        : null,
                                    _uplCreatedBy: userId,
                                    _uplUpdatedBy: userId
                                })
                            )
                        }
                    }

                    return txMetahubRepo.findOneOrFail({ where: { id: copiedMetahub.id } })
                })

                return res.status(201).json({
                    id: copied.id,
                    name: copied.name,
                    description: copied.description,
                    codename: copied.codename,
                    slug: copied.slug,
                    isPublic: copied.isPublic,
                    version: copied._uplVersion || 1,
                    createdAt: copied._uplCreatedAt,
                    updatedAt: copied._uplUpdatedAt,
                    role: 'owner',
                    accessType: 'member',
                    permissions: ROLE_PERMISSIONS.owner
                })
            } catch (error) {
                for (const schemaName of createdSchemas.slice().reverse()) {
                    await generator.dropSchema(schemaName).catch(() => undefined)
                }
                throw error
            }
        })
    )

    // ============ UPDATE METAHUB ============
    router.put(
        '/metahub/:metahubId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const { metahubRepo } = repos(req)

            const rlsRunner = getRequestQueryRunner(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)

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
                codename: z.string().min(1).max(100).optional(),
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

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            if (result.data.codename !== undefined && result.data.codename !== metahub.codename) {
                const normalizedCodename = normalizeCodename(result.data.codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Invalid input',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                const existingCodename = await metahubRepo.findOne({ where: { codename: normalizedCodename } })
                if (existingCodename && existingCodename.id !== metahubId) {
                    return res.status(409).json({ error: 'Codename already in use' })
                }
                metahub.codename = normalizedCodename
            }

            // Check slug uniqueness if changing
            if (result.data.slug !== undefined && result.data.slug !== metahub.slug) {
                if (result.data.slug !== null) {
                    const existing = await metahubRepo.findOne({ where: { slug: result.data.slug } })
                    if (existing && existing.id !== metahubId) {
                        return res.status(409).json({ error: 'Slug already in use' })
                    }
                }
                metahub.slug = result.data.slug || undefined
            }

            if (result.data.name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(result.data.name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
                }
                const namePrimary = result.data.namePrimaryLocale ?? metahub.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, namePrimary, namePrimary)
                if (nameVlc) {
                    metahub.name = nameVlc
                }
            }
            if (result.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(result.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const descriptionPrimary =
                        result.data.descriptionPrimaryLocale ?? metahub.description?._primary ?? metahub.name?._primary ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimary, descriptionPrimary)
                    if (descriptionVlc) {
                        metahub.description = descriptionVlc
                    }
                } else {
                    metahub.description = undefined
                }
            }
            if (result.data.isPublic !== undefined) {
                metahub.isPublic = result.data.isPublic
            }

            const { expectedVersion } = result.data

            // Optimistic locking check
            if (expectedVersion !== undefined) {
                const currentVersion = metahub._uplVersion || 1
                if (currentVersion !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: metahubId,
                        entityType: 'metahub',
                        expectedVersion,
                        actualVersion: currentVersion,
                        updatedAt: metahub._uplUpdatedAt,
                        updatedBy: metahub._uplUpdatedBy ?? null
                    })
                }
            }

            metahub._uplUpdatedAt = new Date()
            metahub._uplUpdatedBy = userId

            await metahubRepo.save(metahub)

            return res.json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                codename: metahub.codename,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                version: metahub._uplVersion || 1,
                createdAt: metahub._uplCreatedAt,
                updatedAt: metahub._uplUpdatedAt
            })
        })
    )

    // ============ DELETE METAHUB ============
    router.delete(
        '/metahub/:metahubId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const { metahubRepo } = repos(req)
            const manager = getRequestManager(req, ds)
            const branchRepo = manager.getRepository(MetahubBranch)

            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureMetahubAccess(ds, userId, metahubId, 'deleteContent', rlsRunner)
            // Only owner can delete
            if (ctx.membership.role !== 'owner' && !ctx.isSynthetic) {
                return res.status(403).json({ error: 'Only the owner can delete this metahub' })
            }

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const branches = await branchRepo.find({ where: { metahubId } })
            const schemasToDrop = branches
                .map((branch) => branch.schemaName)
                .filter((schemaName): schemaName is string => Boolean(schemaName))

            for (const schemaName of schemasToDrop) {
                if (!schemaName.startsWith('mhb_') || !isValidSchemaName(schemaName) || !IDENTIFIER_REGEX.test(schemaName)) {
                    return res.status(400).json({ error: 'Invalid metahub schema name' })
                }
            }

            await ds.transaction(async (txManager) => {
                for (const schemaName of schemasToDrop) {
                    const schemaIdent = quoteIdentifier(schemaName)
                    await txManager.query(`DROP SCHEMA IF EXISTS ${schemaIdent} CASCADE`)
                }

                const txRepo = txManager.getRepository(Metahub)
                const txMetahub = await txRepo.findOne({ where: { id: metahubId } })
                if (!txMetahub) {
                    return
                }
                await txRepo.remove(txMetahub)
            })

            MetahubSchemaService.clearCache(metahubId)

            return res.status(204).send()
        })
    )

    // ============ GET MEMBERS ============
    // ... existing member routes ...
    router.get(
        '/metahub/:metahubId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }
            const { members, total } = await loadMembers(req, metahubId, validatedQuery)

            const role = ctx.membership.role as MetahubRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({ members, total, role, permissions })
        })
    )

    // ============ ADD MEMBER ============
    router.post(
        '/metahub/:metahubId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            // ... code snippet logic ...
            // Reusing previous logic, just ensuring no changes needed for members
            // ...
            // Shortening for file writing purposes to full content
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const { metahubUserRepo, authUserRepo } = repos(req)

            const rlsRunner = getRequestQueryRunner(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMembers', rlsRunner)

            const schema = z.object({
                email: z.string().email(),
                role: z.enum(['admin', 'editor', 'member']),
                comment: z
                    .string()
                    .trim()
                    .max(500)
                    .optional()
                    .transform((val) => (val && val.length > 0 ? val : undefined))
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid payload', details: result.error.flatten() })
            }

            // Find user by email
            const authUser = await authUserRepo
                .createQueryBuilder('u')
                .where('LOWER(u.email) = LOWER(:email)', { email: result.data.email })
                .getOne()

            if (!authUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            // Check if already a member
            const existing = await metahubUserRepo.findOne({
                where: { metahubId, userId: authUser.id }
            })
            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'METAHUB_MEMBER_EXISTS'
                })
            }

            const membership = metahubUserRepo.create({
                metahubId,
                userId: authUser.id,
                role: result.data.role,
                comment: result.data.comment,
                _uplCreatedBy: userId,
                _uplUpdatedBy: userId
            })
            await metahubUserRepo.save(membership)

            return res.status(201).json({
                id: membership.id,
                userId: authUser.id,
                email: authUser.email,
                role: membership.role,
                comment: membership.comment,
                createdAt: membership._uplCreatedAt
            })
        })
    )

    // ============ UPDATE MEMBER ============
    router.patch(
        '/metahub/:metahubId/member/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, memberId } = req.params
            const ds = getDataSource()
            const { metahubUserRepo } = repos(req)

            const rlsRunner = getRequestQueryRunner(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMembers', rlsRunner)

            const membership = await metahubUserRepo.findOne({
                where: { id: memberId, metahubId }
            })
            if (!membership) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(membership, 'modify')

            const schema = z.object({
                role: z.enum(['admin', 'editor', 'member']).optional(),
                comment: z
                    .string()
                    .trim()
                    .max(500)
                    .optional()
                    .transform((val) => (val && val.length > 0 ? val : undefined))
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid payload', details: result.error.flatten() })
            }

            if (result.data.role !== undefined) membership.role = result.data.role
            if (result.data.comment !== undefined) membership.comment = result.data.comment
            membership._uplUpdatedBy = userId

            await metahubUserRepo.save(membership)

            return res.json({
                id: membership.id,
                userId: membership.userId,
                role: membership.role,
                comment: membership.comment,
                createdAt: membership._uplCreatedAt
            })
        })
    )

    // ============ REMOVE MEMBER ============
    router.delete(
        '/metahub/:metahubId/member/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, memberId } = req.params
            const ds = getDataSource()
            const { metahubUserRepo } = repos(req)

            const rlsRunner = getRequestQueryRunner(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMembers', rlsRunner)

            const membership = await metahubUserRepo.findOne({
                where: { id: memberId, metahubId }
            })
            if (!membership) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(membership, 'remove')

            await metahubUserRepo.delete(memberId)

            return res.status(204).send()
        })
    )

    return router
}
