import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import type { StorageRole } from '@universo/types'
import { Slot } from '../database/entities/Slot'
import { Container } from '../database/entities/Container'
import { SlotContainer } from '../database/entities/SlotContainer'
import { Storage } from '../database/entities/Storage'
import { StorageUser } from '../database/entities/StorageUser'
import { ContainerStorage } from '../database/entities/ContainerStorage'
import { SlotStorage } from '../database/entities/SlotStorage'
import { ensureStorageAccess, ensureContainerAccess, ensureSlotAccess, ROLE_PERMISSIONS } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
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

// Helper to get repositories from the data source
function getRepositories(req: Request, getDataSource: () => DataSource) {
    const dataSource = getDataSource()
    const manager = getRequestManager(req, dataSource)
    return {
        slotRepo: manager.getRepository(Slot),
        containerRepo: manager.getRepository(Container),
        slotContainerRepo: manager.getRepository(SlotContainer),
        storageRepo: manager.getRepository(Storage),
        storageUserRepo: manager.getRepository(StorageUser),
        containerStorageRepo: manager.getRepository(ContainerStorage),
        slotStorageRepo: manager.getRepository(SlotStorage)
    }
}

/**
 * Auto-sync slot-storage links based on container-storage relationships
 * Ensures slots_storages table always reflects which storages contain this slot
 * through its containers
 */
async function syncSlotStorageLinks(slotId: string, repos: ReturnType<typeof getRepositories>) {
    const { slotContainerRepo, containerStorageRepo, slotStorageRepo, slotRepo } = repos

    // Find all containers this slot belongs to
    const slotContainers = await slotContainerRepo.find({
        where: { slot: { id: slotId } },
        relations: ['container']
    })

    const containerIds = slotContainers.map((es) => es.container.id)

    if (containerIds.length === 0) {
        // Slot has no containers - remove all storage links
        await slotStorageRepo.delete({ slot: { id: slotId } })
        return
    }

    // Find all storages these containers belong to
    const containerStorages = await containerStorageRepo.find({
        where: { container: { id: In(containerIds) } },
        relations: ['storage']
    })

    // Get unique storage IDs
    const storageIds = [...new Set(containerStorages.map((sm) => sm.storage.id))]

    // Get current slot-storage links
    const currentLinks = await slotStorageRepo.find({
        where: { slot: { id: slotId } },
        relations: ['storage']
    })

    const currentStorageIds = new Set(currentLinks.map((link) => link.storage.id))

    // Add missing links
    const slot = await slotRepo.findOne({ where: { id: slotId } })
    if (!slot) return

    for (const storageId of storageIds) {
        if (!currentStorageIds.has(storageId)) {
            const link = slotStorageRepo.create({
                slot: { id: slotId },
                storage: { id: storageId }
            })
            await slotStorageRepo.save(link)
        }
    }

    // Remove obsolete links
    const obsoleteLinks = currentLinks.filter((link) => !storageIds.includes(link.storage.id))
    if (obsoleteLinks.length > 0) {
        await slotStorageRepo.remove(obsoleteLinks)
    }
}

// Comments in English only
export function createSlotsRouter(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })

    // All routes in this router require authentication
    router.use(ensureAuth)

    // Async handler to wrap async functions and catch errors
    const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>): RequestHandler => {
        return (req, res, next) => {
            fn(req, res).catch(next)
        }
    }

    // GET / - List all slots with pagination, search, sorting
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            try {
                // Validate and parse query parameters with Zod
                const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

                // Parse search parameter
                const escapedSearch = search ? escapeLikeWildcards(search) : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'e.name',
                    created: 'e.createdAt',
                    updated: 'e.updatedAt'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                // Get slots accessible to user through container membership
                const { slotRepo } = getRepositories(req, getDataSource)
                const qb = slotRepo
                    .createQueryBuilder('e')
                    // Join with slot-container link
                    .innerJoin(SlotContainer, 'es', 'es.slot_id = e.id')
                    // Join with container
                    .innerJoin(Container, 's', 's.id = es.container_id')
                    // Join with container-storage link
                    .innerJoin(ContainerStorage, 'sm', 'sm.container_id = s.id')
                    // Join with storage user to filter by user access
                    .innerJoin(StorageUser, 'mu', 'mu.storage_id = sm.storage_id')
                    .where('mu.user_id = :userId', { userId })

                // Add search filter if provided
                if (escapedSearch) {
                    qb.andWhere("(LOWER(e.name) LIKE :search OR LOWER(COALESCE(e.description, '')) LIKE :search)", {
                        search: `%${escapedSearch.toLowerCase()}%`
                    })
                }

                qb.select([
                    'e.id as id',
                    'e.name as name',
                    'e.description as description',
                    'e.createdAt as created_at',
                    'e.updatedAt as updated_at',
                    'mu.role as user_role'
                ])
                    // Use window function to get total count in single query (performance optimization)
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('e.id')
                    .addGroupBy('e.name')
                    .addGroupBy('e.description')
                    .addGroupBy('e.createdAt')
                    .addGroupBy('e.updatedAt')
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
                console.error('[ERROR] GET /slots failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST / (Create a new slot)
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slotRepo, containerRepo, slotContainerRepo, storageRepo, slotStorageRepo } = getRepositories(req, getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                containerId: z.string().uuid(),
                storageId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, storageId, containerId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the container
            await ensureContainerAccess(getDataSource(), userId, containerId, 'createContent')

            try {
                // Validate container exists
                const container = await containerRepo.findOne({ where: { id: containerId } })
                if (!container) return res.status(400).json({ error: 'Invalid containerId' })

                const slot = slotRepo.create({ name, description })
                await slotRepo.save(slot)

                // Create mandatory slot-container link
                const slotContainerLink = slotContainerRepo.create({ slot, container })
                await slotContainerRepo.save(slotContainerLink)

                // CRITICAL: Auto-sync slot-storage links based on container-storage links
                // This ensures slotsCount is always accurate in storage dashboard
                await syncSlotStorageLinks(slot.id, getRepositories(req, getDataSource))

                // Optional explicit storage link (kept for backwards compatibility)
                if (storageId) {
                    // Verify access to the storage
                    await ensureStorageAccess(getDataSource(), userId, storageId, 'createContent')

                    const storage = await storageRepo.findOne({ where: { id: storageId } })
                    if (!storage) return res.status(400).json({ error: 'Invalid storageId' })
                    const exists = await slotStorageRepo.findOne({
                        where: { storage: { id: storageId }, slot: { id: slot.id } }
                    })
                    if (!exists) {
                        const link = slotStorageRepo.create({ storage, slot })
                        await slotStorageRepo.save(link)
                    }
                }

                res.status(201).json(slot)
            } catch (error) {
                console.error('POST /slots - Error:', error)
                res.status(500).json({
                    error: 'Failed to create slot',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /:slotId (Get a single slot)
    router.get(
        '/:slotId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSlotAccess(getDataSource(), userId, req.params.slotId)
            const { slotRepo } = getRepositories(req, getDataSource)
            const slot = await slotRepo.findOneBy({ id: req.params.slotId })
            if (!slot) {
                return res.status(404).json({ error: 'Slot not found' })
            }
            res.json(slot)
        })
    )

    // PUT /:slotId (Update a slot)
    router.put(
        '/:slotId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSlotAccess(getDataSource(), userId, req.params.slotId, 'editContent')
            const { slotRepo } = getRepositories(req, getDataSource)
            const slot = await slotRepo.findOneBy({ id: req.params.slotId })
            if (!slot) {
                return res.status(404).json({ error: 'Slot not found' })
            }
            const { name, description } = req.body
            slotRepo.merge(slot, { name, description })
            await slotRepo.save(slot)
            res.json(slot)
        })
    )

    // DELETE /:slotId (Delete a slot)
    router.delete(
        '/:slotId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSlotAccess(getDataSource(), userId, req.params.slotId, 'deleteContent')
            const { slotRepo } = getRepositories(req, getDataSource)
            const result = await slotRepo.delete({ id: req.params.slotId })
            if (result.affected === 0) {
                return res.status(404).json({ error: 'Slot not found' })
            }
            res.status(204).send()
        })
    )

    // PUT /:slotId/container { containerId }
    router.put(
        '/:slotId/container',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slotRepo, containerRepo, slotContainerRepo } = getRepositories(req, getDataSource)
            const slotId = req.params.slotId
            const { containerId } = req.body || {}
            if (!containerId) return res.status(400).json({ error: 'containerId is required' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSlotAccess(getDataSource(), userId, slotId, 'editContent')
            await ensureContainerAccess(getDataSource(), userId, containerId, 'editContent')

            const slot = await slotRepo.findOneBy({ id: slotId })
            if (!slot) return res.status(404).json({ error: 'Slot not found' })

            const container = await containerRepo.findOneBy({ id: containerId })
            if (!container) return res.status(404).json({ error: 'Container not found' })

            const exists = await slotContainerRepo.findOne({ where: { slot: { id: slotId }, container: { id: containerId } } })
            if (exists) return res.status(200).json(exists)

            const link = slotContainerRepo.create({ slot, container })
            const saved = await slotContainerRepo.save(link)

            // Auto-sync slot-storage links after adding container
            await syncSlotStorageLinks(slotId, getRepositories(req, getDataSource))

            res.status(201).json(saved)
        })
    )

    // DELETE /:slotId/container � remove all container links for the slot (simple semantics)
    router.delete(
        '/:slotId/container',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { slotRepo, slotContainerRepo } = getRepositories(req, getDataSource)
            const slotId = req.params.slotId
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureSlotAccess(getDataSource(), userId, slotId, 'deleteContent')
            const slot = await slotRepo.findOneBy({ id: slotId })
            if (!slot) return res.status(404).json({ error: 'Slot not found' })

            const links = await slotContainerRepo.find({ where: { slot: { id: slotId } } })
            if (links.length === 0) return res.status(404).json({ error: 'No container links found' })

            await slotContainerRepo.remove(links)

            // Auto-sync slot-storage links after removing containers
            await syncSlotStorageLinks(slotId, getRepositories(req, getDataSource))

            res.status(204).send()
        })
    )

    return router
}

export default createSlotsRouter
