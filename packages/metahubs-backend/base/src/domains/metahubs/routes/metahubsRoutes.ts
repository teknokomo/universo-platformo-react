import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { AuthUser, RequestWithDbContext } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubUser } from '../../../database/entities/MetahubUser'
// Hub entity removed - hubs are now in isolated schemas (_mhb_hubs)
import { Profile } from '@universo/profile-backend'
import { ensureMetahubAccess, ROLE_PERMISSIONS, assertNotOwner, MetahubRole } from '../../shared/guards'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { normalizeCodename, isValidCodename } from '@universo/utils/validation/codename'
import { escapeLikeWildcards, getRequestManager } from '../../../utils'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { MetahubObjectsService } from '../services/MetahubObjectsService'

const getRequestQueryRunner = (req: Request) => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
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
        return {
            metahubRepo: manager.getRepository(Metahub),
            metahubUserRepo: manager.getRepository(MetahubUser),
            // hubRepo removed - hubs are in isolated schemas now
            authUserRepo: manager.getRepository(AuthUser),
            schemaService,
            objectsService
        }
    }

    const mapMember = (member: MetahubUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as MetahubRole,
        comment: member.comment,
        createdAt: member.created_at
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
            const qb = metahubUserRepo.createQueryBuilder('mu').where('mu.metahub_id = :metahubId', { metahubId })

            if (params) {
                const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = params

                if (search) {
                    const escapedSearch = escapeLikeWildcards(search.toLowerCase())
                    qb.andWhere(
                        `(
                            EXISTS (SELECT 1 FROM auth.users u WHERE u.id = mu.user_id AND LOWER(u.email) LIKE :search)
                         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = mu.user_id AND LOWER(p.nickname) LIKE :search)
                        )`,
                        { search: `%${escapedSearch}%` }
                    )
                }

                const orderColumn =
                    sortBy === 'email'
                        ? '(SELECT u.email FROM auth.users u WHERE u.id = mu.user_id)'
                        : sortBy === 'role'
                            ? 'mu.role'
                            : 'mu.created_at'
                qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                qb.skip(offset).take(limit)
            }

            const [rawMembers, total] = await qb.getManyAndCount()
            const userIds = rawMembers.map((m) => m.user_id)

            if (userIds.length === 0) {
                return { members: [], total }
            }

            // Load users and profiles data using proper entities (not raw queries)
            const users = userIds.length ? await manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await manager.find(Profile, { where: { user_id: In(userIds) } }) : []

            const usersMap = new Map(users.map((user) => [user.id, user.email ?? null]))
            const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile.nickname]))

            const members = rawMembers.map((m) => mapMember(m, usersMap.get(m.user_id) ?? null, profilesMap.get(m.user_id) ?? null))

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
                            ? 'm.created_at'
                            : 'm.updated_at'
            qb = qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')

            // Pagination
            qb = qb.skip(offset).take(limit)

            const [metahubs, total] = await qb.getManyAndCount()
            const metahubIds = metahubs.map((m) => m.id)

            // Load counters and membership info
            const memberships =
                metahubIds.length > 0
                    ? await metahubUserRepo.find({
                        where: { metahub_id: In(metahubIds), user_id: userId }
                    })
                    : []
            const membershipMap = new Map(memberships.map((m) => [m.metahub_id, m]))

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
                    createdAt: m.createdAt,
                    updatedAt: m.updatedAt,
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

            // Load counts - counting hubs and catalogs
            // TODO: Implement schema-based hub counting via Knex (_mhb_hubs in isolated schema)
            // For now, return 0 (hubs are in isolated schemas, not metahubs.hubs)
            const hubsCount = 0

            // Count catalogs by fetching them from dynamic schema
            let catalogsCount = 0
            try {
                // This might fail if schema doesn't exist yet, which is fine (count 0)
                const catalogs = await objectsService.findAll(metahubId)
                catalogsCount = catalogs.length
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
                createdAt: metahub.createdAt,
                updatedAt: metahub.updatedAt,
                hubsCount,
                catalogsCount,
                membersCount,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
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

            const { metahubRepo, metahubUserRepo, schemaService } = repos(req)

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
                isPublic: result.data.isPublic ?? false
            })
            await metahubRepo.save(metahub)

            // Create owner membership
            const membership = metahubUserRepo.create({
                metahub_id: metahub.id,
                user_id: userId,
                role: 'owner'
            })
            await metahubUserRepo.save(membership)

            // Ensure schema is created
            await schemaService.ensureSchema(metahub.id)

            return res.status(201).json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                codename: metahub.codename,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                createdAt: metahub.createdAt,
                updatedAt: metahub.updatedAt,
                role: 'owner',
                accessType: 'member',
                permissions: ROLE_PERMISSIONS.owner
            })
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
                isPublic: z.boolean().optional()
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
            metahub.updatedAt = new Date()

            await metahubRepo.save(metahub)

            return res.json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                codename: metahub.codename,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                createdAt: metahub.createdAt,
                updatedAt: metahub.updatedAt
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
            const { metahubRepo, schemaService } = repos(req)

            const rlsRunner = getRequestQueryRunner(req)

            const ctx = await ensureMetahubAccess(ds, userId, metahubId, 'deleteContent', rlsRunner)
            // Only owner can delete
            if (ctx.membership.role !== 'owner' && !ctx.isSynthetic) {
                return res.status(403).json({ error: 'Only the owner can delete this metahub' })
            }

            await metahubRepo.delete(metahubId)

            // Drop schema
            await schemaService.dropSchema(metahubId)

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
                where: { metahub_id: metahubId, user_id: authUser.id }
            })
            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'METAHUB_MEMBER_EXISTS'
                })
            }

            const membership = metahubUserRepo.create({
                metahub_id: metahubId,
                user_id: authUser.id,
                role: result.data.role,
                comment: result.data.comment
            })
            await metahubUserRepo.save(membership)

            return res.status(201).json({
                id: membership.id,
                userId: authUser.id,
                email: authUser.email,
                role: membership.role,
                comment: membership.comment,
                createdAt: membership.created_at
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
                where: { id: memberId, metahub_id: metahubId }
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

            await metahubUserRepo.save(membership)

            return res.json({
                id: membership.id,
                userId: membership.user_id,
                role: membership.role,
                comment: membership.comment,
                createdAt: membership.created_at
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
                where: { id: memberId, metahub_id: metahubId }
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
