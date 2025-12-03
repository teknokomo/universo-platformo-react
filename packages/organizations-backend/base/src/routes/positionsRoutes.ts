import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import type { OrganizationRole } from '@universo/types'
import { Position } from '../database/entities/Position'
import { Department } from '../database/entities/Department'
import { PositionDepartment } from '../database/entities/PositionDepartment'
import { Organization } from '../database/entities/Organization'
import { OrganizationUser } from '../database/entities/OrganizationUser'
import { DepartmentOrganization } from '../database/entities/DepartmentOrganization'
import { PositionOrganization } from '../database/entities/PositionOrganization'
import { ensureOrganizationAccess, ensureDepartmentAccess, ensurePositionAccess, ROLE_PERMISSIONS } from './guards'
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
        positionRepo: manager.getRepository(Position),
        departmentRepo: manager.getRepository(Department),
        positionDepartmentRepo: manager.getRepository(PositionDepartment),
        organizationRepo: manager.getRepository(Organization),
        organizationUserRepo: manager.getRepository(OrganizationUser),
        departmentOrganizationRepo: manager.getRepository(DepartmentOrganization),
        positionOrganizationRepo: manager.getRepository(PositionOrganization)
    }
}

/**
 * Auto-sync position-organization links based on department-organization relationships
 * Ensures positions_organizations table always reflects which organizations contain this position
 * through its departments
 */
async function syncPositionOrganizationLinks(positionId: string, repos: ReturnType<typeof getRepositories>) {
    const { positionDepartmentRepo, departmentOrganizationRepo, positionOrganizationRepo, positionRepo } = repos

    // Find all departments this position belongs to
    const positionDepartments = await positionDepartmentRepo.find({
        where: { position: { id: positionId } },
        relations: ['department']
    })

    const departmentIds = positionDepartments.map((es) => es.department.id)

    if (departmentIds.length === 0) {
        // Position has no departments - remove all organization links
        await positionOrganizationRepo.delete({ position: { id: positionId } })
        return
    }

    // Find all organizations these departments belong to
    const departmentOrganizations = await departmentOrganizationRepo.find({
        where: { department: { id: In(departmentIds) } },
        relations: ['organization']
    })

    // Get unique organization IDs
    const organizationIds = [...new Set(departmentOrganizations.map((sm) => sm.organization.id))]

    // Get current position-organization links
    const currentLinks = await positionOrganizationRepo.find({
        where: { position: { id: positionId } },
        relations: ['organization']
    })

    const currentOrganizationIds = new Set(currentLinks.map((link) => link.organization.id))

    // Add missing links
    const position = await positionRepo.findOne({ where: { id: positionId } })
    if (!position) return

    for (const organizationId of organizationIds) {
        if (!currentOrganizationIds.has(organizationId)) {
            const link = positionOrganizationRepo.create({
                position: { id: positionId },
                organization: { id: organizationId }
            })
            await positionOrganizationRepo.save(link)
        }
    }

    // Remove obsolete links
    const obsoleteLinks = currentLinks.filter((link) => !organizationIds.includes(link.organization.id))
    if (obsoleteLinks.length > 0) {
        await positionOrganizationRepo.remove(obsoleteLinks)
    }
}

// Comments in English only
export function createPositionsRouter(
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

    // GET / - List all positions with pagination, search, sorting
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

                // Get positions accessible to user through department membership
                const { positionRepo } = getRepositories(req, getDataSource)
                const qb = positionRepo
                    .createQueryBuilder('e')
                    // Join with position-department link
                    .innerJoin(PositionDepartment, 'es', 'es.position_id = e.id')
                    // Join with department
                    .innerJoin(Department, 's', 's.id = es.department_id')
                    // Join with department-organization link
                    .innerJoin(DepartmentOrganization, 'sm', 'sm.department_id = s.id')
                    // Join with organization user to filter by user access
                    .innerJoin(OrganizationUser, 'mu', 'mu.organization_id = sm.organization_id')
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
                console.error('[ERROR] GET /positions failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST / (Create a new position)
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { positionRepo, departmentRepo, positionDepartmentRepo, organizationRepo, positionOrganizationRepo } = getRepositories(req, getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                departmentId: z.string().uuid(),
                organizationId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, organizationId, departmentId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the department
            await ensureDepartmentAccess(getDataSource(), userId, departmentId, 'createContent')

            try {
                // Validate department exists
                const department = await departmentRepo.findOne({ where: { id: departmentId } })
                if (!department) return res.status(400).json({ error: 'Invalid departmentId' })

                const position = positionRepo.create({ name, description })
                await positionRepo.save(position)

                // Create mandatory position-department link
                const positionDepartmentLink = positionDepartmentRepo.create({ position, department })
                await positionDepartmentRepo.save(positionDepartmentLink)

                // CRITICAL: Auto-sync position-organization links based on department-organization links
                // This ensures positionsCount is always accurate in organization dashboard
                await syncPositionOrganizationLinks(position.id, getRepositories(req, getDataSource))

                // Optional explicit organization link (kept for backwards compatibility)
                if (organizationId) {
                    // Verify access to the organization
                    await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'createContent')

                    const organization = await organizationRepo.findOne({ where: { id: organizationId } })
                    if (!organization) return res.status(400).json({ error: 'Invalid organizationId' })
                    const exists = await positionOrganizationRepo.findOne({
                        where: { organization: { id: organizationId }, position: { id: position.id } }
                    })
                    if (!exists) {
                        const link = positionOrganizationRepo.create({ organization, position })
                        await positionOrganizationRepo.save(link)
                    }
                }

                res.status(201).json(position)
            } catch (error) {
                console.error('POST /positions - Error:', error)
                res.status(500).json({
                    error: 'Failed to create position',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /:positionId (Get a single position)
    router.get(
        '/:positionId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensurePositionAccess(getDataSource(), userId, req.params.positionId)
            const { positionRepo } = getRepositories(req, getDataSource)
            const position = await positionRepo.findOneBy({ id: req.params.positionId })
            if (!position) {
                return res.status(404).json({ error: 'Position not found' })
            }
            res.json(position)
        })
    )

    // PUT /:positionId (Update a position)
    router.put(
        '/:positionId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensurePositionAccess(getDataSource(), userId, req.params.positionId, 'editContent')
            const { positionRepo } = getRepositories(req, getDataSource)
            const position = await positionRepo.findOneBy({ id: req.params.positionId })
            if (!position) {
                return res.status(404).json({ error: 'Position not found' })
            }
            const { name, description } = req.body
            positionRepo.merge(position, { name, description })
            await positionRepo.save(position)
            res.json(position)
        })
    )

    // DELETE /:positionId (Delete a position)
    router.delete(
        '/:positionId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensurePositionAccess(getDataSource(), userId, req.params.positionId, 'deleteContent')
            const { positionRepo } = getRepositories(req, getDataSource)
            const result = await positionRepo.delete({ id: req.params.positionId })
            if (result.affected === 0) {
                return res.status(404).json({ error: 'Position not found' })
            }
            res.status(204).send()
        })
    )

    // PUT /:positionId/department { departmentId }
    router.put(
        '/:positionId/department',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { positionRepo, departmentRepo, positionDepartmentRepo } = getRepositories(req, getDataSource)
            const positionId = req.params.positionId
            const { departmentId } = req.body || {}
            if (!departmentId) return res.status(400).json({ error: 'departmentId is required' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensurePositionAccess(getDataSource(), userId, positionId, 'editContent')
            await ensureDepartmentAccess(getDataSource(), userId, departmentId, 'editContent')

            const position = await positionRepo.findOneBy({ id: positionId })
            if (!position) return res.status(404).json({ error: 'Position not found' })

            const department = await departmentRepo.findOneBy({ id: departmentId })
            if (!department) return res.status(404).json({ error: 'Department not found' })

            const exists = await positionDepartmentRepo.findOne({ where: { position: { id: positionId }, department: { id: departmentId } } })
            if (exists) return res.status(200).json(exists)

            const link = positionDepartmentRepo.create({ position, department })
            const saved = await positionDepartmentRepo.save(link)

            // Auto-sync position-organization links after adding department
            await syncPositionOrganizationLinks(positionId, getRepositories(req, getDataSource))

            res.status(201).json(saved)
        })
    )

    // DELETE /:positionId/department � remove all department links for the position (simple semantics)
    router.delete(
        '/:positionId/department',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { positionRepo, positionDepartmentRepo } = getRepositories(req, getDataSource)
            const positionId = req.params.positionId
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensurePositionAccess(getDataSource(), userId, positionId, 'deleteContent')
            const position = await positionRepo.findOneBy({ id: positionId })
            if (!position) return res.status(404).json({ error: 'Position not found' })

            const links = await positionDepartmentRepo.find({ where: { position: { id: positionId } } })
            if (links.length === 0) return res.status(404).json({ error: 'No department links found' })

            await positionDepartmentRepo.remove(links)

            // Auto-sync position-organization links after removing departments
            await syncPositionOrganizationLinks(positionId, getRepositories(req, getDataSource))

            res.status(204).send()
        })
    )

    return router
}

export default createPositionsRouter
