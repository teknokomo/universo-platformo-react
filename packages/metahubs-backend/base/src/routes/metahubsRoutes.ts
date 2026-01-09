import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { Metahub } from '../database/entities/Metahub'
import { MetahubUser } from '../database/entities/MetahubUser'
import { Hub } from '../database/entities/Hub'
import { Attribute } from '../database/entities/Attribute'
import { Profile } from '@universo/profile-backend'
import { ensureMetahubAccess, ROLE_PERMISSIONS, assertNotOwner } from './guards'
import type { MetahubRole } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { escapeLikeWildcards } from '../utils'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
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
        return {
            metahubRepo: manager.getRepository(Metahub),
            metahubUserRepo: manager.getRepository(MetahubUser),
            hubRepo: manager.getRepository(Hub),
            attributeRepo: manager.getRepository(Attribute),
            authUserRepo: manager.getRepository(AuthUser)
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
            const users = userIds.length ? await ds.manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await ds.manager.find(Profile, { where: { user_id: In(userIds) } }) : []

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
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubRepo, metahubUserRepo } = repos(req)
            const ds = getDataSource()

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
            const isSuperuser = await isSuperuserByDataSource(ds, userId)
            const hasGlobalMetahubsAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs')

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
                    "(m.name::text ILIKE :search OR COALESCE(m.description::text, '') ILIKE :search OR COALESCE(m.slug, '') ILIKE :search)",
                    { search: `%${search}%` }
                )
            }

            // Sorting - use JSONB extraction with dynamic primary locale for name sorting
            const orderColumn =
                sortBy === 'name'
                    ? "COALESCE(m.name->>(m.name->>'_primary'), m.name->>'en', '')"
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
            const { hubRepo } = repos(req)
            const hubCounts =
                metahubIds.length > 0
                    ? await hubRepo
                          .createQueryBuilder('h')
                          .select('h.metahub_id', 'metahubId')
                          .addSelect('COUNT(*)', 'count')
                          .where('h.metahub_id IN (:...ids)', { ids: metahubIds })
                          .groupBy('h.metahub_id')
                          .getRawMany<{ metahubId: string; count: string }>()
                    : []
            const hubCountMap = new Map(hubCounts.map((c) => [c.metahubId, parseInt(c.count, 10)]))

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
            const globalRoleName = isSuperuser || hasGlobalMetahubsAccess ? await getGlobalRoleCodenameByDataSource(ds, userId) : null

            const result = metahubs.map((m) => {
                const membership = membershipMap.get(m.id)
                const role = membership ? (membership.role as MetahubRole) : globalRoleName ? 'owner' : 'member'
                const accessType = membership ? 'member' : globalRoleName ?? 'member'
                const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

                return {
                    id: m.id,
                    name: m.name,
                    description: m.description,
                    slug: m.slug,
                    isPublic: m.isPublic,
                    createdAt: m.createdAt,
                    updatedAt: m.updatedAt,
                    hubsCount: hubCountMap.get(m.id) ?? 0,
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
        '/:metahubId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { metahubRepo } = repos(req)
            const ds = getDataSource()

            const ctx = await ensureMetahubAccess(ds, userId, metahubId)

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            // Load counts - now counting hubs instead of entities
            const { hubRepo } = repos(req)
            const hubsCount = await hubRepo.count({ where: { metahubId } })

            const { total: membersCount } = await loadMembers(req, metahubId, { limit: 1 })

            const role = ctx.membership.role as MetahubRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                createdAt: metahub.createdAt,
                updatedAt: metahub.updatedAt,
                hubsCount,
                membersCount,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
            })
        })
    )

    // ============ CREATE METAHUB ============
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

            const { metahubRepo, metahubUserRepo } = repos(req)

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

            return res.status(201).json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
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
        '/:metahubId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const { metahubRepo } = repos(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub')

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
                isPublic: z.boolean().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

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
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                createdAt: metahub.createdAt,
                updatedAt: metahub.updatedAt
            })
        })
    )

    // ============ DELETE METAHUB ============
    router.delete(
        '/:metahubId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const { metahubRepo } = repos(req)

            const ctx = await ensureMetahubAccess(ds, userId, metahubId, 'deleteContent')
            // Only owner can delete
            if (ctx.membership.role !== 'owner' && !ctx.isSynthetic) {
                return res.status(403).json({ error: 'Only the owner can delete this metahub' })
            }

            await metahubRepo.delete(metahubId)

            return res.status(204).send()
        })
    )

    // ============ GET MEMBERS ============
    router.get(
        '/:metahubId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()

            const ctx = await ensureMetahubAccess(ds, userId, metahubId)

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
        '/:metahubId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const { metahubUserRepo, authUserRepo } = repos(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMembers')

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
        '/:metahubId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, memberId } = req.params
            const ds = getDataSource()
            const { metahubUserRepo } = repos(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMembers')

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
        '/:metahubId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, memberId } = req.params
            const ds = getDataSource()
            const { metahubUserRepo } = repos(req)

            await ensureMetahubAccess(ds, userId, metahubId, 'manageMembers')

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
