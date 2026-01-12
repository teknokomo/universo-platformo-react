import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { StorageRole } from '@universo/types'
import { Container } from '../database/entities/Container'
import { Storage } from '../database/entities/Storage'
import { StorageUser } from '../database/entities/StorageUser'
import { ContainerStorage } from '../database/entities/ContainerStorage'
import { Slot } from '../database/entities/Slot'
import { SlotContainer } from '../database/entities/SlotContainer'
import { ensureContainerAccess, ensureStorageAccess, ensureSlotAccess, ROLE_PERMISSIONS } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../utils'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createContainersRoutes(
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
            containerRepo: manager.getRepository(Container),
            storageRepo: manager.getRepository(Storage),
            storageUserRepo: manager.getRepository(StorageUser),
            containerStorageRepo: manager.getRepository(ContainerStorage),
            slotRepo: manager.getRepository(Slot),
            slotContainerRepo: manager.getRepository(SlotContainer)
        }
    }

    // GET /containers - with pagination, search, sorting
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
                const escapedSearch = search ? escapeLikeWildcards(search) : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 's.name',
                    created: 's.createdAt',
                    updated: 's.updatedAt'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Get containers accessible to user through storage membership
                const { containerRepo } = repos(req)
                const qb = containerRepo
                    .createQueryBuilder('s')
                    // Join with container-storage link
                    .innerJoin(ContainerStorage, 'sm', 'sm.container_id = s.id')
                    // Join with storage user to filter by user access
                    .innerJoin(StorageUser, 'mu', 'mu.storage_id = sm.storage_id')
                    // Left join with slot-container to count slots
                    .leftJoin(SlotContainer, 'es', 'es.container_id = s.id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided
                if (escapedSearch) {
                    qb.andWhere("(LOWER(s.name) LIKE :search OR LOWER(COALESCE(s.description, '')) LIKE :search)", {
                        search: `%${escapedSearch.toLowerCase()}%`
                    })
                }

                qb.select([
                    's.id as id',
                    's.name as name',
                    's.description as description',
                    's.createdAt as created_at',
                    's.updatedAt as updated_at',
                    'mu.role as user_role'
                ])
                    .addSelect('COUNT(DISTINCT es.id)', 'slotsCount')
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('s.id')
                    .addGroupBy('s.name')
                    .addGroupBy('s.description')
                    .addGroupBy('s.createdAt')
                    .addGroupBy('s.updatedAt')
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
                    user_role: string | null
                    slotsCount: string
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

                const response = raw.map((row) => {
                    const role = (row.user_role || 'member') as StorageRole
                    const permissions = ROLE_PERMISSIONS[role]

                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        slotsCount: parseInt(row.slotsCount || '0', 10) || 0,
                        role,
                        permissions
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
                console.error('[ERROR] GET /containers failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /containers
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                storageId: z.string().uuid()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, storageId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Validate required fields
            if (!name) return res.status(400).json({ error: 'name is required' })
            if (!storageId) return res.status(400).json({ error: 'storageId is required - containers must be associated with a storage' })

            await ensureStorageAccess(getDataSource(), userId, storageId, 'createContent')

            const { containerRepo, storageRepo, containerStorageRepo } = repos(req)

            try {
                // Validate storage exists
                const storage = await storageRepo.findOne({ where: { id: storageId } })
                if (!storage) return res.status(400).json({ error: 'Invalid storageId' })

                const slot = containerRepo.create({ name, description })
                const saved = await containerRepo.save(slot)

                // Create mandatory container-storage link
                const containerStorageLink = containerStorageRepo.create({ container: saved, storage })
                await containerStorageRepo.save(containerStorageLink)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /containers - Error:', error)
                res.status(500).json({
                    error: 'Failed to create container',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /containers/:containerId
    router.get(
        '/:containerId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { containerId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureContainerAccess(getDataSource(), userId, containerId)

            const { containerRepo, slotContainerRepo } = repos(req)

            const container = await containerRepo.findOne({ where: { id: containerId } })
            if (!container) return res.status(404).json({ error: 'Container not found' })

            // Get slots count for this container
            const slotsCount = await slotContainerRepo.count({ where: { container: { id: containerId } } })

            const response = {
                id: container.id,
                name: container.name,
                description: container.description ?? undefined,
                createdAt: container.createdAt,
                updatedAt: container.updatedAt,
                slotsCount
            }

            res.json(response)
        })
    )

    // PUT /containers/:containerId
    router.put(
        '/:containerId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z
                .object({
                    name: z.string().min(1).optional(),
                    description: z.string().optional()
                })
                .refine((data) => data.name !== undefined || data.description !== undefined, {
                    message: 'At least one field (name or description) must be provided'
                })

            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { containerId } = req.params
            const { name, description } = parsed.data
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureContainerAccess(getDataSource(), userId, containerId, 'editContent')
            const { containerRepo } = repos(req)

            const container = await containerRepo.findOne({ where: { id: containerId } })
            if (!container) return res.status(404).json({ error: 'Container not found' })

            if (name !== undefined) container.name = name
            if (description !== undefined) container.description = description

            const updated = await containerRepo.save(container)
            res.json(updated)
        })
    )

    // DELETE /containers/:containerId
    router.delete(
        '/:containerId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { containerId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureContainerAccess(getDataSource(), userId, containerId, 'deleteContent')
            const { containerRepo } = repos(req)

            const container = await containerRepo.findOne({ where: { id: containerId } })
            if (!container) return res.status(404).json({ error: 'Container not found' })

            await containerRepo.remove(container)
            res.status(204).send()
        })
    )

    // GET /containers/:containerId/slots
    router.get(
        '/:containerId/slots',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { containerId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureContainerAccess(getDataSource(), userId, containerId)
            const { containerRepo, slotContainerRepo } = repos(req)

            // Validate container exists
            const container = await containerRepo.findOne({ where: { id: containerId } })
            if (!container) return res.status(404).json({ error: 'Container not found' })

            // Get slots linked to this container
            const links = await slotContainerRepo.find({
                where: { container: { id: containerId } },
                relations: ['slot']
            })
            const slots = links.map((link) => link.slot)
            res.json(slots)
        })
    )

    // POST /containers/:containerId/slots/:slotId (attach slot to container)
    router.post(
        '/:containerId/slots/:slotId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { containerId, slotId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Ensure user has createContent permission for the container
            await ensureContainerAccess(getDataSource(), userId, containerId, 'createContent')

            // SECURITY: Ensure user has access to the slot before attaching
            await ensureSlotAccess(getDataSource(), userId, slotId)

            const { containerRepo, slotRepo, slotContainerRepo } = repos(req)

            // Validate container exists
            const container = await containerRepo.findOne({ where: { id: containerId } })
            if (!container) return res.status(404).json({ error: 'Container not found' })

            // Validate slot exists
            const slot = await slotRepo.findOne({ where: { id: slotId } })
            if (!slot) return res.status(404).json({ error: 'Slot not found' })

            // Check if link already exists (idempotent)
            const existing = await slotContainerRepo.findOne({
                where: { container: { id: containerId }, slot: { id: slotId } }
            })
            if (existing) return res.status(200).json(existing)

            // Create new link
            const link = slotContainerRepo.create({ container, slot })
            const saved = await slotContainerRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createContainersRoutes
