import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RequestWithDbContext, IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { createEnsureGlobalAccess } from '../guards/ensureGlobalAccess'
import { Instance } from '../database/entities/Instance'
import { z } from 'zod'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

/**
 * Validation schemas for instances API
 */
const UpdateInstanceSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    display_name: z.record(z.string()).optional(),
    description: z.string().max(1000).optional().nullable(),
    url: z.string().url().max(255).optional().nullable(),
    status: z.enum(['active', 'inactive', 'maintenance']).optional()
})

const ListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().optional(),
    sortBy: z.enum(['name', 'created', 'status']).default('created'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export interface InstancesRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDataSource: () => DataSource
}

/**
 * Create routes for instances management
 * Requires global access for all operations
 */
export function createInstancesRoutes({ globalAccessService, permissionService, getDataSource }: InstancesRoutesConfig): Router {
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const getInstanceRepo = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return manager.getRepository(Instance)
    }

    /**
     * GET /api/v1/admin/instances
     * List all instances (global access required)
     */
    router.get(
        '/',
        ensureGlobalAccess('instances', 'read'),
        asyncHandler(async (req, res) => {
            const instanceRepo = getInstanceRepo(req)
            const parsed = ListQuerySchema.safeParse(req.query)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid query parameters',
                    details: parsed.error.errors
                })
                return
            }

            const { limit, offset, search, sortBy, sortOrder } = parsed.data

            const qb = instanceRepo.createQueryBuilder('i')

            if (search) {
                const searchLower = search.toLowerCase()
                qb.andWhere(
                    `(
                        LOWER(i.name) LIKE :search OR
                        i.display_name::text ILIKE :search
                    )`,
                    { search: `%${searchLower}%` }
                )
            }

            // Sorting
            const sortColumn = sortBy === 'created' ? 'i.created_at' : sortBy === 'status' ? 'i.status' : 'i.name'
            qb.orderBy(sortColumn, sortOrder.toUpperCase() as 'ASC' | 'DESC')

            const total = await qb.getCount()
            const instances = await qb.skip(offset).take(limit).getMany()

            const hasMore = offset + instances.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', instances.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json({ success: true, data: instances })
        })
    )

    /**
     * GET /api/v1/admin/instances/:id
     * Get instance by ID (global access required)
     */
    router.get(
        '/:id',
        ensureGlobalAccess('instances', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const instanceRepo = getInstanceRepo(req)

            const instance = await instanceRepo.findOne({ where: { id } })

            if (!instance) {
                res.status(404).json({
                    success: false,
                    error: 'Instance not found'
                })
                return
            }

            res.json({ success: true, data: instance })
        })
    )

    /**
     * PUT /api/v1/admin/instances/:id
     * Update instance (global access with manage permission required)
     */
    router.put(
        '/:id',
        ensureGlobalAccess('instances', 'update'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const instanceRepo = getInstanceRepo(req)

            const instance = await instanceRepo.findOne({ where: { id } })

            if (!instance) {
                res.status(404).json({
                    success: false,
                    error: 'Instance not found'
                })
                return
            }

            const parsed = UpdateInstanceSchema.safeParse(req.body)

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request body',
                    details: parsed.error.errors
                })
                return
            }

            const updateData = parsed.data

            // Prevent changing is_local flag
            if ('is_local' in req.body) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot modify is_local flag'
                })
                return
            }

            // Update only provided fields
            if (updateData.name !== undefined) instance.name = updateData.name
            if (updateData.display_name !== undefined) instance.display_name = updateData.display_name
            if (updateData.description !== undefined) instance.description = updateData.description ?? undefined
            if (updateData.url !== undefined) instance.url = updateData.url ?? undefined
            if (updateData.status !== undefined) instance.status = updateData.status

            // Note: updated_at is automatically handled by TypeORM @UpdateDateColumn

            const updated = await instanceRepo.save(instance)

            res.json({ success: true, data: updated })
        })
    )

    /**
     * GET /api/v1/admin/instances/:id/stats
     * Get instance statistics (global access required)
     * Returns user counts and system info for the instance
     */
    router.get(
        '/:id/stats',
        ensureGlobalAccess('instances', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const instanceRepo = getInstanceRepo(req)

            const instance = await instanceRepo.findOne({ where: { id } })

            if (!instance) {
                res.status(404).json({
                    success: false,
                    error: 'Instance not found'
                })
                return
            }

            // For MVP, only local instance stats are available
            if (!instance.is_local) {
                res.json({
                    success: true,
                    data: {
                        instanceId: id,
                        available: false,
                        message: 'Remote instance statistics not available in MVP'
                    }
                })
                return
            }

            // Get stats from globalAccessService for local instance
            const ds = getDataSource()

            // Count total users
            const totalUsersResult = await ds.query(`SELECT COUNT(*) as count FROM auth.users`)
            const totalUsers = parseInt(totalUsersResult[0]?.count || '0', 10)

            // Count global access users
            const globalUsersResult = await ds.query(`
                SELECT COUNT(DISTINCT ur.user_id) as count
                FROM admin.user_roles ur
                JOIN admin.roles r ON ur.role_id = r.id
                WHERE r.has_global_access = true
            `)
            const globalUsers = parseInt(globalUsersResult[0]?.count || '0', 10)

            res.json({
                success: true,
                data: {
                    instanceId: id,
                    available: true,
                    totalUsers,
                    globalAccessUsers: globalUsers,
                    instanceName: instance.name,
                    instanceStatus: instance.status
                }
            })
        })
    )

    return router
}
