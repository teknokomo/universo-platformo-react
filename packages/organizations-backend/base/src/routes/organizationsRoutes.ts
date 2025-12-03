import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { Organization } from '../database/entities/Organization'
import { OrganizationUser } from '../database/entities/OrganizationUser'
import { Position } from '../database/entities/Position'
import { PositionOrganization } from '../database/entities/PositionOrganization'
import { Department } from '../database/entities/Department'
import { DepartmentOrganization } from '../database/entities/DepartmentOrganization'
import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import { ensureOrganizationAccess, ensureDepartmentAccess, ROLE_PERMISSIONS, OrganizationRole, assertNotOwner } from './guards'
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
export function createOrganizationsRoutes(
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
            organizationRepo: manager.getRepository(Organization),
            organizationUserRepo: manager.getRepository(OrganizationUser),
            positionRepo: manager.getRepository(Position),
            linkRepo: manager.getRepository(PositionOrganization),
            departmentRepo: manager.getRepository(Department),
            departmentLinkRepo: manager.getRepository(DepartmentOrganization),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: OrganizationUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as OrganizationRole,
        comment: member.comment,
        createdAt: member.created_at
    })

    const loadMembers = async (
        req: Request,
        organizationId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { organizationUserRepo } = repos(req)
        const ds = getDataSource()

        try {
            // Build base query WITHOUT JOINs to avoid TypeORM alias parsing issues for cross-schema tables
            const qb = organizationUserRepo.createQueryBuilder('mu').where('mu.organization_id = :organizationId', { organizationId })

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
    type RolePermissions = (typeof ROLE_PERMISSIONS)[OrganizationRole]

    interface OrganizationDetailsResponse {
        id: string
        name: string
        description?: string
        createdAt: Date
        updatedAt: Date
        departmentsCount: number
        positionsCount: number
        membersCount: number
        role: OrganizationRole
        permissions: RolePermissions
        members?: MembersList
    }

    const memberRoleSchema = z.enum(['admin', 'editor', 'member'])

    // GET /organizations
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

                // Aggregate counts per organization in a single query filtered by current user membership
                const { organizationRepo } = repos(req)
                const qb = organizationRepo
                    .createQueryBuilder('m')
                    // Join using position classes to respect schema mapping and avoid alias parsing issues
                    .innerJoin(OrganizationUser, 'mu', 'mu.organization_id = m.id')
                    .leftJoin(DepartmentOrganization, 'sm', 'sm.organization_id = m.id')
                    .leftJoin(PositionOrganization, 'em', 'em.organization_id = m.id')
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
                    // Use position property names; TypeORM will map to actual column names
                    'm.createdAt as created_at',
                    'm.updatedAt as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT sm.id)', 'departmentsCount')
                    .addSelect('COUNT(DISTINCT em.id)', 'positionsCount')
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
                    departmentsCount: string
                    positionsCount: string
                    role: OrganizationRole | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) || 0 : 0

                const response = raw.map((row) => {
                    const role = (row.role ?? undefined) as OrganizationRole | undefined
                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        departmentsCount: parseInt(row.departmentsCount || '0', 10) || 0,
                        positionsCount: parseInt(row.positionsCount || '0', 10) || 0,
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
                console.error('[ERROR] GET /organizations failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /organizations
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

            const { organizationRepo, organizationUserRepo } = repos(req)

            try {
                // Create organization
                // Creating organization
                const position = organizationRepo.create({ name, description })
                const saved = await organizationRepo.save(position)

                // Create organization-user relationship (user becomes owner)
                // Creating organization-user relationship
                const organizationUser = organizationUserRepo.create({
                    organization_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                const _savedOrganizationUser = await organizationUserRepo.save(organizationUser)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /organizations - Error:', error)
                res.status(500).json({
                    error: 'Failed to create organization',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    router.get(
        '/:organizationId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { organizationRepo, organizationUserRepo, departmentLinkRepo, linkRepo } = repos(req)

            const { membership } = await ensureOrganizationAccess(getDataSource(), userId, organizationId)

            const organization = await organizationRepo.findOne({ where: { id: organizationId } })
            if (!organization) {
                return res.status(404).json({ error: 'Organization not found' })
            }

            const [departmentsCount, positionsCount, membersCount] = await Promise.all([
                departmentLinkRepo.count({ where: { organization: { id: organizationId } } }),
                linkRepo.count({ where: { organization: { id: organizationId } } }),
                organizationUserRepo.count({ where: { organization_id: organizationId } })
            ])

            const role = (membership.role || 'member') as OrganizationRole
            const permissions = ROLE_PERMISSIONS[role]

            const membersPayload = permissions.manageMembers ? (await loadMembers(req, organizationId)).members : undefined

            const response: OrganizationDetailsResponse = {
                id: organization.id,
                name: organization.name,
                description: organization.description ?? undefined,
                createdAt: organization.createdAt,
                updatedAt: organization.updatedAt,
                departmentsCount,
                positionsCount,
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
        '/:organizationId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'manageMembers')

            // Add pagination support
            const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = validateListQuery(req.query)
            const { members, total } = await loadMembers(req, organizationId, { limit, offset, sortBy, sortOrder, search })

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
        '/:organizationId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'manageMembers')

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
            const { authUserRepo, organizationUserRepo } = repos(req)

            const targetUser = await authUserRepo
                .createQueryBuilder('user')
                // TODO: Add a functional index on LOWER(email) to keep this lookup performant.
                .where('LOWER(user.email) = LOWER(:email)', { email })
                .getOne()

            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await organizationUserRepo.findOne({
                where: { organization_id: organizationId, user_id: targetUser.id }
            })

            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'ORGANIZATION_MEMBER_EXISTS'
                })
            }

            const membership = organizationUserRepo.create({
                organization_id: organizationId,
                user_id: targetUser.id,
                role,
                comment
            })
            const saved = await organizationUserRepo.save(membership)

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: targetUser.id } })

            res.status(201).json(mapMember(saved, targetUser.email ?? null, profile?.nickname ?? null))
        })
    )

    router.patch(
        '/:organizationId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'manageMembers')

            const schema = z.object({
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { role, comment } = parsed.data
            const { organizationUserRepo, authUserRepo } = repos(req)

            const membership = await organizationUserRepo.findOne({
                where: { id: memberId, organization_id: organizationId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'modify')

            membership.role = role
            if (comment !== undefined) {
                membership.comment = comment
            }
            const saved = await organizationUserRepo.save(membership)
            const authUser = await authUserRepo.findOne({ where: { id: membership.user_id } })

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: membership.user_id } })

            res.json(mapMember(saved, authUser?.email ?? null, profile?.nickname ?? null))
        })
    )

    router.delete(
        '/:organizationId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'manageMembers')

            const { organizationUserRepo } = repos(req)
            const membership = await organizationUserRepo.findOne({
                where: { id: memberId, organization_id: organizationId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'remove')

            await organizationUserRepo.remove(membership)
            res.status(204).send()
        })
    )

    router.put(
        '/:organizationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params
            const { name, description } = req.body || {}
            if (!name) {
                return res.status(400).json({ error: 'name is required' })
            }

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { organizationRepo } = repos(req)
            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'manageOrganization')

            const organization = await organizationRepo.findOne({ where: { id: organizationId } })
            if (!organization) {
                return res.status(404).json({ error: 'Organization not found' })
            }

            organization.name = name
            organization.description = description

            const saved = await organizationRepo.save(organization)
            res.json(saved)
        })
    )

    router.delete(
        '/:organizationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { organizationRepo } = repos(req)
            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'manageOrganization')

            const organization = await organizationRepo.findOne({ where: { id: organizationId } })
            if (!organization) {
                return res.status(404).json({ error: 'Organization not found' })
            }

            await organizationRepo.remove(organization)
            res.status(204).send()
        })
    )

    // GET /organizations/:organizationId/positions
    router.get(
        '/:organizationId/positions',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureOrganizationAccess(getDataSource(), userId, organizationId)

            const { linkRepo } = repos(req)
            try {
                const links = await linkRepo.find({
                    where: { organization: { id: organizationId } },
                    relations: ['position', 'organization']
                })
                const positions = links.map((l) => ({ ...l.position, sortOrder: l.sortOrder }))
                // Debug log removed
                res.json(positions)
            } catch (error) {
                console.error(`GET /organizations/${organizationId}/positions - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get organization positions',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /organizations/:organizationId/positions/:positionId (attach)
    router.post(
        '/:organizationId/positions/:positionId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId, positionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'createContent')
            const { linkRepo, organizationRepo, positionRepo } = repos(req)
            const organization = await organizationRepo.findOne({ where: { id: organizationId } })
            const position = await positionRepo.findOne({ where: { id: positionId } })
            if (!organization || !position) return res.status(404).json({ error: 'Not found' })
            // Avoid duplicates at API level (no UNIQUE in DB as per requirements)
            const exists = await linkRepo.findOne({ where: { organization: { id: organizationId }, position: { id: positionId } } })
            if (exists) return res.status(200).json(exists)
            const link = linkRepo.create({ organization, position })
            const saved = await linkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /organizations/:organizationId/positions/:positionId (detach)
    router.delete(
        '/:organizationId/positions/:positionId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId, positionId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'deleteContent')
            const { linkRepo } = repos(req)
            const existing = await linkRepo.findOne({ where: { organization: { id: organizationId }, position: { id: positionId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /organizations/:organizationId/positions/reorder { items: [{positionId, sortOrder}] }
    router.post(
        '/:organizationId/positions/reorder',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'editContent')
            const { linkRepo } = repos(req)
            for (const it of items) {
                if (!it?.positionId) continue
                const link = await linkRepo.findOne({ where: { organization: { id: organizationId }, position: { id: it.positionId } } })
                if (link) {
                    link.sortOrder = Number(it.sortOrder) || 1
                    await linkRepo.save(link)
                }
            }
            res.json({ success: true })
        })
    )

    // --- Departments in organization ---

    // GET /organizations/:organizationId/departments
    router.get(
        '/:organizationId/departments',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureOrganizationAccess(getDataSource(), userId, organizationId)

            const { departmentLinkRepo } = repos(req)
            try {
                const links = await departmentLinkRepo.find({
                    where: { organization: { id: organizationId } },
                    relations: ['department', 'organization']
                })
                const departments = links.map((l) => l.department)
                // Debug log removed
                res.json(departments)
            } catch (error) {
                console.error(`GET /organizations/${organizationId}/departments - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get organization departments',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /organizations/:organizationId/departments/:departmentId (attach)
    router.post(
        '/:organizationId/departments/:departmentId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { organizationId, departmentId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the organization and the department
            await ensureOrganizationAccess(getDataSource(), userId, organizationId, 'createContent')
            await ensureDepartmentAccess(getDataSource(), userId, departmentId)
            const { organizationRepo, departmentRepo, departmentLinkRepo } = repos(req)
            const organization = await organizationRepo.findOne({ where: { id: organizationId } })
            const department = await departmentRepo.findOne({ where: { id: departmentId } })
            if (!organization || !department) return res.status(404).json({ error: 'Not found' })

            const exists = await departmentLinkRepo.findOne({
                where: { organization: { id: organizationId }, department: { id: departmentId } }
            })
            if (exists) return res.status(200).json(exists)

            const link = departmentLinkRepo.create({ organization, department })
            const saved = await departmentLinkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createOrganizationsRoutes
