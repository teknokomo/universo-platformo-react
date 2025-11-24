import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import { Storage } from '../database/entities/Storage'
import { StorageUser } from '../database/entities/StorageUser'
import { Slot } from '../database/entities/Slot'
import { SlotStorage } from '../database/entities/SlotStorage'
import { Container } from '../database/entities/Container'
import { ContainerStorage } from '../database/entities/ContainerStorage'
import { AuthUser } from '@universo/auth-srv'
import { Profile } from '@universo/profile-srv'
import { ensureStorageAccess, ensureContainerAccess, ROLE_PERMISSIONS, StorageRole, assertNotOwner } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'

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

// Comments in English only
export function createStoragesRoutes(
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
            storageRepo: manager.getRepository(Storage),
            storageUserRepo: manager.getRepository(StorageUser),
            slotRepo: manager.getRepository(Slot),
            linkRepo: manager.getRepository(SlotStorage),
            containerRepo: manager.getRepository(Container),
            containerLinkRepo: manager.getRepository(ContainerStorage),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: StorageUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as StorageRole,
        comment: member.comment,
        createdAt: member.created_at
    })

    const loadMembers = async (
        req: Request,
        storageId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { storageUserRepo } = repos(req)
        const ds = getDataSource()

        try {
            // Build base query WITHOUT JOINs to avoid TypeORM alias parsing issues for cross-schema tables
            const qb = storageUserRepo.createQueryBuilder('mu').where('mu.storage_id = :storageId', { storageId })

            if (params) {
                const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = params

                // Search by email OR nickname via EXISTS subqueries (no joins)
                if (search) {
                    const escapedSearch = search.toLowerCase()
                    qb.andWhere(
                        `(
                            EXISTS (SELECT 1 FROM auth.users u WHERE u.id = mu.user_id AND LOWER(u.email) LIKE :search)
                         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = mu.user_id AND LOWER(p.nickname) LIKE :search)
                        )`,
                        { search: `%${escapedSearch}%` }
                    )
                }

                // Sorting (support created, role, email, nickname). Email/nickname via subselect expressions
                const ALLOWED_SORT_FIELDS: Record<string, string> = {
                    created: 'mu.created_at',
                    role: 'mu.role',
                    email: '(SELECT u.email FROM auth.users u WHERE u.id = mu.user_id)',
                    nickname: '(SELECT p.nickname FROM public.profiles p WHERE p.user_id = mu.user_id)'
                }
                const sortExpr = ALLOWED_SORT_FIELDS[sortBy] || 'mu.created_at'
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                qb.orderBy(sortExpr, sortDirection).skip(offset).take(limit)
            } else {
                // Default order when no params
                qb.orderBy('mu.created_at', 'ASC')
            }

            // Get members and total count
            const [members, total] = await qb.getManyAndCount()

            // Extract email and nickname from joined data
            const userIds = members.map((member) => member.user_id)

            // Load users and profiles data
            const users = userIds.length ? await ds.manager.find(AuthUser, { where: { id: In(userIds) } }) : []
            const profiles = userIds.length ? await ds.manager.find(Profile, { where: { user_id: In(userIds) } }) : []

            const usersMap = new Map(users.map((user) => [user.id, user.email ?? null]))
            const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile.nickname]))

            const result = {
                members: members.map((member) =>
                    mapMember(member, usersMap.get(member.user_id) ?? null, profilesMap.get(member.user_id) ?? null)
                ),
                total
            }
            return result
        } catch (error) {
            console.error('[loadMembers] ERROR', error)
            throw error
        }
    }

    type MembersList = Awaited<ReturnType<typeof loadMembers>>['members']
    type RolePermissions = (typeof ROLE_PERMISSIONS)[StorageRole]

    interface StorageDetailsResponse {
        id: string
        name: string
        description?: string
        createdAt: Date
        updatedAt: Date
        containersCount: number
        slotsCount: number
        membersCount: number
        role: StorageRole
        permissions: RolePermissions
        members?: MembersList
    }

    const memberRoleSchema = z.enum(['admin', 'editor', 'member'])

    // GET /storages
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                // Validate and parse query parameters with Zod
                const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

                // Parse search parameter
                const normalizedSearch = search ? search.toLowerCase() : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'm.name',
                    created: 'm.createdAt',
                    updated: 'm.updatedAt'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Aggregate counts per storage in a single query filtered by current user membership
                const { storageRepo } = repos(req)
                const qb = storageRepo
                    .createQueryBuilder('m')
                    // Join using slot classes to respect schema mapping and avoid alias parsing issues
                    .innerJoin(StorageUser, 'mu', 'mu.storage_id = m.id')
                    .leftJoin(ContainerStorage, 'sm', 'sm.storage_id = m.id')
                    .leftJoin(SlotStorage, 'em', 'em.storage_id = m.id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided
                if (normalizedSearch) {
                    qb.andWhere('(LOWER(m.name) LIKE :search OR LOWER(m.description) LIKE :search)', {
                        search: `%${normalizedSearch}%`
                    })
                }

                qb.select([
                    'm.id as id',
                    'm.name as name',
                    'm.description as description',
                    // Use slot property names; TypeORM will map to actual column names
                    'm.createdAt as created_at',
                    'm.updatedAt as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT sm.id)', 'containersCount')
                    .addSelect('COUNT(DISTINCT em.id)', 'slotsCount')
                    .addSelect('mu.role', 'role')
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('m.id')
                    .addGroupBy('m.name')
                    .addGroupBy('m.description')
                    .addGroupBy('m.createdAt')
                    .addGroupBy('m.updatedAt')
                    .addGroupBy('mu.role')
                    .orderBy(sortByField, sortDirection)
                    .limit(limit)
                    .offset(offset)

                const raw = await qb.getRawMany<{
                    id: string
                    name: string
                    description: string | null
                    created_at: Date
                    updated_at: Date
                    containersCount: string
                    slotsCount: string
                    role: StorageRole | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) || 0 : 0

                const response = raw.map((row) => {
                    const role = (row.role ?? undefined) as StorageRole | undefined
                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        containersCount: parseInt(row.containersCount || '0', 10) || 0,
                        slotsCount: parseInt(row.slotsCount || '0', 10) || 0,
                        role,
                        permissions: role ? ROLE_PERMISSIONS[role] : undefined
                    }
                })

                // Add pagination metadata headers for client awareness
                const hasMore = offset + raw.length < total
                res.setHeader('X-Pagination-Limit', limit.toString())
                res.setHeader('X-Pagination-Offset', offset.toString())
                res.setHeader('X-Pagination-Count', raw.length.toString())
                res.setHeader('X-Total-Count', total.toString())
                res.setHeader('X-Pagination-Has-More', hasMore.toString())

                res.json(response)
            } catch (error) {
                // Handle Zod validation errors
                if (error instanceof z.ZodError) {
                    return res.status(400).json({
                        error: 'Invalid query parameters',
                        details: error.errors.map((e) => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    })
                }
                console.error('[ERROR] GET /storages failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /storages
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            // Debug logs removed to keep production logs clean

            const { name, description } = req.body || {}
            if (!name) return res.status(400).json({ error: 'name is required' })

            // Get user ID from middleware (req.user should be set by ensureAuth)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { storageRepo, storageUserRepo } = repos(req)

            try {
                // Create storage
                // Creating storage
                const slot = storageRepo.create({ name, description })
                const saved = await storageRepo.save(slot)

                // Create storage-user relationship (user becomes owner)
                // Creating storage-user relationship
                const storageUser = storageUserRepo.create({
                    storage_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                const _savedStorageUser = await storageUserRepo.save(storageUser)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /storages - Error:', error)
                res.status(500).json({
                    error: 'Failed to create storage',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    router.get(
        '/:storageId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { storageRepo, storageUserRepo, containerLinkRepo, linkRepo } = repos(req)

            const { membership } = await ensureStorageAccess(getDataSource(), userId, storageId)

            const storage = await storageRepo.findOne({ where: { id: storageId } })
            if (!storage) {
                return res.status(404).json({ error: 'Storage not found' })
            }

            const [containersCount, slotsCount, membersCount] = await Promise.all([
                containerLinkRepo.count({ where: { storage: { id: storageId } } }),
                linkRepo.count({ where: { storage: { id: storageId } } }),
                storageUserRepo.count({ where: { storage_id: storageId } })
            ])

            const role = (membership.role || 'member') as StorageRole
            const permissions = ROLE_PERMISSIONS[role]

            const membersPayload = permissions.manageMembers ? (await loadMembers(req, storageId)).members : undefined

            const response: StorageDetailsResponse = {
                id: storage.id,
                name: storage.name,
                description: storage.description ?? undefined,
                createdAt: storage.createdAt,
                updatedAt: storage.updatedAt,
                containersCount,
                slotsCount,
                membersCount,
                role,
                permissions
            }

            if (membersPayload) {
                response.members = membersPayload
            }

            res.json(response)
        })
    )

    router.get(
        '/:storageId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureStorageAccess(getDataSource(), userId, storageId, 'manageMembers')

            // Add pagination support
            const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = validateListQuery(req.query)
            const { members, total } = await loadMembers(req, storageId, { limit, offset, sortBy, sortOrder, search })

            // Return paginated response structure
            const hasMore = offset + members.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', members.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json(members)
        })
    )

    router.post(
        '/:storageId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureStorageAccess(getDataSource(), userId, storageId, 'manageMembers')

            const schema = z.object({
                email: z.string().email(),
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { email, role, comment } = parsed.data
            const { authUserRepo, storageUserRepo } = repos(req)

            const targetUser = await authUserRepo
                .createQueryBuilder('user')
                // TODO: Add a functional index on LOWER(email) to keep this lookup performant.
                .where('LOWER(user.email) = LOWER(:email)', { email })
                .getOne()

            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await storageUserRepo.findOne({
                where: { storage_id: storageId, user_id: targetUser.id }
            })

            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'STORAGE_MEMBER_EXISTS'
                })
            }

            const membership = storageUserRepo.create({
                storage_id: storageId,
                user_id: targetUser.id,
                role,
                comment
            })
            const saved = await storageUserRepo.save(membership)

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: targetUser.id } })

            res.status(201).json(mapMember(saved, targetUser.email ?? null, profile?.nickname ?? null))
        })
    )

    router.patch(
        '/:storageId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureStorageAccess(getDataSource(), userId, storageId, 'manageMembers')

            const schema = z.object({
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { role, comment } = parsed.data
            const { storageUserRepo, authUserRepo } = repos(req)

            const membership = await storageUserRepo.findOne({
                where: { id: memberId, storage_id: storageId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'modify')

            membership.role = role
            if (comment !== undefined) {
                membership.comment = comment
            }
            const saved = await storageUserRepo.save(membership)
            const authUser = await authUserRepo.findOne({ where: { id: membership.user_id } })

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: membership.user_id } })

            res.json(mapMember(saved, authUser?.email ?? null, profile?.nickname ?? null))
        })
    )

    router.delete(
        '/:storageId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureStorageAccess(getDataSource(), userId, storageId, 'manageMembers')

            const { storageUserRepo } = repos(req)
            const membership = await storageUserRepo.findOne({
                where: { id: memberId, storage_id: storageId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'remove')

            await storageUserRepo.remove(membership)
            res.status(204).send()
        })
    )

    router.put(
        '/:storageId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params
            const { name, description } = req.body || {}
            if (!name) {
                return res.status(400).json({ error: 'name is required' })
            }

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { storageRepo } = repos(req)
            await ensureStorageAccess(getDataSource(), userId, storageId, 'manageStorage')

            const storage = await storageRepo.findOne({ where: { id: storageId } })
            if (!storage) {
                return res.status(404).json({ error: 'Storage not found' })
            }

            storage.name = name
            storage.description = description

            const saved = await storageRepo.save(storage)
            res.json(saved)
        })
    )

    router.delete(
        '/:storageId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { storageRepo } = repos(req)
            await ensureStorageAccess(getDataSource(), userId, storageId, 'manageStorage')

            const storage = await storageRepo.findOne({ where: { id: storageId } })
            if (!storage) {
                return res.status(404).json({ error: 'Storage not found' })
            }

            await storageRepo.remove(storage)
            res.status(204).send()
        })
    )

    // GET /storages/:storageId/slots
    router.get(
        '/:storageId/slots',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureStorageAccess(getDataSource(), userId, storageId)

            const { linkRepo } = repos(req)
            try {
                const links = await linkRepo.find({ where: { storage: { id: storageId } }, relations: ['slot', 'storage'] })
                const slots = links.map((l) => ({ ...l.slot, sortOrder: l.sortOrder }))
                // Debug log removed
                res.json(slots)
            } catch (error) {
                console.error(`GET /storages/${storageId}/slots - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get storage slots',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /storages/:storageId/slots/:slotId (attach)
    router.post(
        '/:storageId/slots/:slotId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId, slotId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureStorageAccess(getDataSource(), userId, storageId, 'createContent')
            const { linkRepo, storageRepo, slotRepo } = repos(req)
            const storage = await storageRepo.findOne({ where: { id: storageId } })
            const slot = await slotRepo.findOne({ where: { id: slotId } })
            if (!storage || !slot) return res.status(404).json({ error: 'Not found' })
            // Avoid duplicates at API level (no UNIQUE in DB as per requirements)
            const exists = await linkRepo.findOne({ where: { storage: { id: storageId }, slot: { id: slotId } } })
            if (exists) return res.status(200).json(exists)
            const link = linkRepo.create({ storage, slot })
            const saved = await linkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /storages/:storageId/slots/:slotId (detach)
    router.delete(
        '/:storageId/slots/:slotId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId, slotId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureStorageAccess(getDataSource(), userId, storageId, 'deleteContent')
            const { linkRepo } = repos(req)
            const existing = await linkRepo.findOne({ where: { storage: { id: storageId }, slot: { id: slotId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /storages/:storageId/slots/reorder { items: [{slotId, sortOrder}] }
    router.post(
        '/:storageId/slots/reorder',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureStorageAccess(getDataSource(), userId, storageId, 'editContent')
            const { linkRepo } = repos(req)
            for (const it of items) {
                if (!it?.slotId) continue
                const link = await linkRepo.findOne({ where: { storage: { id: storageId }, slot: { id: it.slotId } } })
                if (link) {
                    link.sortOrder = Number(it.sortOrder) || 1
                    await linkRepo.save(link)
                }
            }
            res.json({ success: true })
        })
    )

    // --- Containers in storage ---

    // GET /storages/:storageId/containers
    router.get(
        '/:storageId/containers',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { storageId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureStorageAccess(getDataSource(), userId, storageId)

            const { containerLinkRepo } = repos(req)
            try {
                const links = await containerLinkRepo.find({ where: { storage: { id: storageId } }, relations: ['container', 'storage'] })
                const containers = links.map((l) => l.container)
                // Debug log removed
                res.json(containers)
            } catch (error) {
                console.error(`GET /storages/${storageId}/containers - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get storage containers',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /storages/:storageId/containers/:containerId (attach)
    router.post(
        '/:storageId/containers/:containerId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { storageId, containerId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the storage and the container
            await ensureStorageAccess(getDataSource(), userId, storageId, 'createContent')
            await ensureContainerAccess(getDataSource(), userId, containerId)
            const { storageRepo, containerRepo, containerLinkRepo } = repos(req)
            const storage = await storageRepo.findOne({ where: { id: storageId } })
            const container = await containerRepo.findOne({ where: { id: containerId } })
            if (!storage || !container) return res.status(404).json({ error: 'Not found' })

            const exists = await containerLinkRepo.findOne({ where: { storage: { id: storageId }, container: { id: containerId } } })
            if (exists) return res.status(200).json(exists)

            const link = containerLinkRepo.create({ storage, container })
            const saved = await containerLinkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createStoragesRoutes
