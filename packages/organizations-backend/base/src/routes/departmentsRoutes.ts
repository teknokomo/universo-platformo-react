import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { OrganizationRole } from '@universo/types'
import { Department } from '../database/entities/Department'
import { Organization } from '../database/entities/Organization'
import { OrganizationUser } from '../database/entities/OrganizationUser'
import { DepartmentOrganization } from '../database/entities/DepartmentOrganization'
import { Position } from '../database/entities/Position'
import { PositionDepartment } from '../database/entities/PositionDepartment'
import { ensureDepartmentAccess, ensureOrganizationAccess, ensurePositionAccess, ROLE_PERMISSIONS } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../utils'

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

// Comments in English only
export function createDepartmentsRoutes(
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
            departmentRepo: manager.getRepository(Department),
            organizationRepo: manager.getRepository(Organization),
            organizationUserRepo: manager.getRepository(OrganizationUser),
            departmentOrganizationRepo: manager.getRepository(DepartmentOrganization),
            positionRepo: manager.getRepository(Position),
            positionDepartmentRepo: manager.getRepository(PositionDepartment)
        }
    }

    // GET /departments - with pagination, search, sorting
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

                // Get departments accessible to user through organization membership
                const { departmentRepo } = repos(req)
                const qb = departmentRepo
                    .createQueryBuilder('s')
                    // Join with department-organization link
                    .innerJoin(DepartmentOrganization, 'sm', 'sm.department_id = s.id')
                    // Join with organization user to filter by user access
                    .innerJoin(OrganizationUser, 'mu', 'mu.organization_id = sm.organization_id')
                    // Left join with position-department to count positions
                    .leftJoin(PositionDepartment, 'es', 'es.department_id = s.id')
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
                    .addSelect('COUNT(DISTINCT es.id)', 'positionsCount')
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
                    positionsCount: string
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

                const response = raw.map((row) => {
                    const role = (row.user_role || 'member') as OrganizationRole
                    const permissions = ROLE_PERMISSIONS[role]

                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        positionsCount: parseInt(row.positionsCount || '0', 10) || 0,
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
                console.error('[ERROR] GET /departments failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /departments
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                organizationId: z.string().uuid()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, organizationId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Validate required fields
            if (!name) return res.status(400).json({ error: 'name is required' })
            if (!organizationId)
                return res.status(400).json({ error: 'organizationId is required - departments must be associated with a organization' })

            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'createContent')

            const { departmentRepo, organizationRepo, departmentOrganizationRepo } = repos(req)

            try {
                // Validate organization exists
                const organization = await organizationRepo.findOne({ where: { id: organizationId } })
                if (!organization) return res.status(400).json({ error: 'Invalid organizationId' })

                const position = departmentRepo.create({ name, description })
                const saved = await departmentRepo.save(position)

                // Create mandatory department-organization link
                const departmentOrganizationLink = departmentOrganizationRepo.create({ department: saved, organization })
                await departmentOrganizationRepo.save(departmentOrganizationLink)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /departments - Error:', error)
                res.status(500).json({
                    error: 'Failed to create department',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /departments/:departmentId
    router.get(
        '/:departmentId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { departmentId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureDepartmentAccess(getDataSource(), userId, departmentId)

            const { departmentRepo, positionDepartmentRepo } = repos(req)

            const department = await departmentRepo.findOne({ where: { id: departmentId } })
            if (!department) return res.status(404).json({ error: 'Department not found' })

            // Get positions count for this department
            const positionsCount = await positionDepartmentRepo.count({ where: { department: { id: departmentId } } })

            const response = {
                id: department.id,
                name: department.name,
                description: department.description ?? undefined,
                createdAt: department.createdAt,
                updatedAt: department.updatedAt,
                positionsCount
            }

            res.json(response)
        })
    )

    // PUT /departments/:departmentId
    router.put(
        '/:departmentId',
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

            const { departmentId } = req.params
            const { name, description } = parsed.data
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDepartmentAccess(getDataSource(), userId, departmentId, 'editContent')
            const { departmentRepo } = repos(req)

            const department = await departmentRepo.findOne({ where: { id: departmentId } })
            if (!department) return res.status(404).json({ error: 'Department not found' })

            if (name !== undefined) department.name = name
            if (description !== undefined) department.description = description

            const updated = await departmentRepo.save(department)
            res.json(updated)
        })
    )

    // DELETE /departments/:departmentId
    router.delete(
        '/:departmentId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { departmentId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDepartmentAccess(getDataSource(), userId, departmentId, 'deleteContent')
            const { departmentRepo } = repos(req)

            const department = await departmentRepo.findOne({ where: { id: departmentId } })
            if (!department) return res.status(404).json({ error: 'Department not found' })

            await departmentRepo.remove(department)
            res.status(204).send()
        })
    )

    // GET /departments/:departmentId/positions
    router.get(
        '/:departmentId/positions',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { departmentId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureDepartmentAccess(getDataSource(), userId, departmentId)
            const { departmentRepo, positionDepartmentRepo } = repos(req)

            // Validate department exists
            const department = await departmentRepo.findOne({ where: { id: departmentId } })
            if (!department) return res.status(404).json({ error: 'Department not found' })

            // Get positions linked to this department
            const links = await positionDepartmentRepo.find({
                where: { department: { id: departmentId } },
                relations: ['position']
            })
            const positions = links.map((link) => link.position)
            res.json(positions)
        })
    )

    // POST /departments/:departmentId/positions/:positionId (attach position to department)
    router.post(
        '/:departmentId/positions/:positionId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { departmentId, positionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Ensure user has createContent permission for the department
            await ensureDepartmentAccess(getDataSource(), userId, departmentId, 'createContent')

            // SECURITY: Ensure user has access to the position before attaching
            await ensurePositionAccess(getDataSource(), userId, positionId)

            const { departmentRepo, positionRepo, positionDepartmentRepo } = repos(req)

            // Validate department exists
            const department = await departmentRepo.findOne({ where: { id: departmentId } })
            if (!department) return res.status(404).json({ error: 'Department not found' })

            // Validate position exists
            const position = await positionRepo.findOne({ where: { id: positionId } })
            if (!position) return res.status(404).json({ error: 'Position not found' })

            // Check if link already exists (idempotent)
            const existing = await positionDepartmentRepo.findOne({
                where: { department: { id: departmentId }, position: { id: positionId } }
            })
            if (existing) return res.status(200).json(existing)

            // Create new link
            const link = positionDepartmentRepo.create({ department, position })
            const saved = await positionDepartmentRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createDepartmentsRoutes
