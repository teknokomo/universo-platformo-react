import { Router, Request, Response, RequestHandler } from 'express'
import { getRequestDbExecutor, type DbExecutor } from '@universo/utils'
import type { IPermissionService } from '@universo/auth-backend'
import type { GlobalAccessService } from '../services/globalAccessService'
import { escapeLikeWildcards } from '../utils'
import { createEnsureGlobalAccess } from '../guards/ensureGlobalAccess'
import { listInstances, findInstanceById, updateInstance, getInstanceStats } from '../persistence/instancesStore'
import { z } from 'zod'
import { LocalizedStringSchema } from '../schemas'

/**
 * Validation schemas for instances API
 */
const UpdateInstanceSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: LocalizedStringSchema.optional(),
    description: LocalizedStringSchema.optional().nullable(),
    url: z.string().url().max(255).optional().nullable(),
    status: z.enum(['active', 'inactive', 'maintenance']).optional()
})

const ListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().optional(),
    sortBy: z.enum(['codename', 'created', 'status']).default('created'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export interface InstancesRoutesConfig {
    globalAccessService: GlobalAccessService
    permissionService: IPermissionService
    getDbExecutor: () => DbExecutor
}

export function createInstancesRoutes({ globalAccessService, permissionService, getDbExecutor }: InstancesRoutesConfig): Router {
    const router = Router()
    const ensureGlobalAccess = createEnsureGlobalAccess({ globalAccessService, permissionService })

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    router.get(
        '/',
        ensureGlobalAccess('instances', 'read'),
        asyncHandler(async (req, res) => {
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
            const exec = getRequestDbExecutor(req, getDbExecutor())

            const { items, total } = await listInstances(exec, {
                limit,
                offset,
                search: search ? escapeLikeWildcards(search.toLowerCase()) : undefined,
                sortBy,
                sortOrder
            })

            const hasMore = offset + items.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', items.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            res.json({ success: true, data: items })
        })
    )

    router.get(
        '/:id',
        ensureGlobalAccess('instances', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const exec = getRequestDbExecutor(req, getDbExecutor())
            const instance = await findInstanceById(exec, id)

            if (!instance) {
                res.status(404).json({ success: false, error: 'Instance not found' })
                return
            }

            res.json({ success: true, data: instance })
        })
    )

    router.put(
        '/:id',
        ensureGlobalAccess('instances', 'update'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const exec = getRequestDbExecutor(req, getDbExecutor())
            const instance = await findInstanceById(exec, id)

            if (!instance) {
                res.status(404).json({ success: false, error: 'Instance not found' })
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

            if ('is_local' in req.body) {
                res.status(400).json({ success: false, error: 'Cannot modify is_local flag' })
                return
            }

            const updateData = parsed.data
            const updated = await updateInstance(exec, id, {
                codename: updateData.codename,
                name: updateData.name,
                description: updateData.description,
                url: updateData.url,
                status: updateData.status
            })

            res.json({ success: true, data: updated ?? instance })
        })
    )

    router.get(
        '/:id/stats',
        ensureGlobalAccess('instances', 'read'),
        asyncHandler(async (req, res) => {
            const { id } = req.params
            const exec = getRequestDbExecutor(req, getDbExecutor())
            const instance = await findInstanceById(exec, id)

            if (!instance) {
                res.status(404).json({ success: false, error: 'Instance not found' })
                return
            }

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

            const stats = await getInstanceStats(exec)

            res.json({
                success: true,
                data: {
                    instanceId: id,
                    available: true,
                    totalUsers: stats.totalUsers,
                    globalAccessUsers: stats.globalAccessUsers,
                    totalRoles: stats.totalRoles,
                    instanceName: instance.name,
                    instanceStatus: instance.status
                }
            })
        })
    )

    return router
}
