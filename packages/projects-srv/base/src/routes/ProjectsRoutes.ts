import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import { AuthUser } from '@universo/auth-srv'
import { Project } from '../database/entities/Project'
import { ProjectUser } from '../database/entities/ProjectUser'
import { Task } from '../database/entities/Task'
import { TaskProject } from '../database/entities/TaskProject'
import { Milestone } from '../database/entities/Milestone'
import { MilestoneProject } from '../database/entities/MilestoneProject'
import { Profile } from '@universo/profile-srv'
import { ensureProjectAccess, ensureMilestoneAccess, ROLE_PERMISSIONS, ProjectRole, assertNotOwner } from './guards'
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
export function createProjectsRoutes(
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
            projectRepo: manager.getRepository(Project),
            projectUserRepo: manager.getRepository(ProjectUser),
            taskRepo: manager.getRepository(Task),
            linkRepo: manager.getRepository(TaskProject),
            milestoneRepo: manager.getRepository(Milestone),
            MilestoneLinkRepo: manager.getRepository(MilestoneProject),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    const mapMember = (member: ProjectUser, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.user_id,
        email,
        nickname,
        role: (member.role || 'member') as ProjectRole,
        comment: member.comment,
        createdAt: member.created_at
    })

    const loadMembers = async (
        req: Request,
        projectId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const { projectUserRepo } = repos(req)
        const ds = getDataSource()

        try {
            // Build base query WITHOUT JOINs to avoid TypeORM alias parsing issues for cross-schema tables
            const qb = projectUserRepo.createQueryBuilder('mu').where('mu.project_id = :projectId', { projectId })

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
    type RolePermissions = (typeof ROLE_PERMISSIONS)[ProjectRole]

    interface ProjectDetailsResponse {
        id: string
        name: string
        description?: string
        createdAt: Date
        updatedAt: Date
        MilestonesCount: number
        TasksCount: number
        membersCount: number
        role: ProjectRole
        permissions: RolePermissions
        members?: MembersList
    }

    const memberRoleSchema = z.enum(['admin', 'editor', 'member'])

    // GET /Projects
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

                // Aggregate counts per Project in a single query filtered by current user membership
                const { projectRepo } = repos(req)
                const qb = projectRepo
                    .createQueryBuilder('m')
                    // Join using Task classes to respect schema mapping and avoid alias parsing issues
                    .innerJoin(ProjectUser, 'mu', 'mu.project_id = m.id')
                    .leftJoin(MilestoneProject, 'sm', 'sm.project_id = m.id')
                    .leftJoin(TaskProject, 'em', 'em.project_id = m.id')
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
                    // Use Task property names; TypeORM will map to actual column names
                    'm.createdAt as created_at',
                    'm.updatedAt as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT sm.id)', 'MilestonesCount')
                    .addSelect('COUNT(DISTINCT em.id)', 'TasksCount')
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
                    MilestonesCount: string
                    TasksCount: string
                    role: ProjectRole | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) || 0 : 0

                const response = raw.map((row) => {
                    const role = (row.role ?? undefined) as ProjectRole | undefined
                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        MilestonesCount: parseInt(row.MilestonesCount || '0', 10) || 0,
                        TasksCount: parseInt(row.TasksCount || '0', 10) || 0,
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
                console.error('[ERROR] GET /Projects failed:', error)
                res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) })
            }
        })
    )

    // POST /Projects
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

            const { projectRepo, projectUserRepo } = repos(req)

            try {
                // Create Project
                // Creating Project
                const project = projectRepo.create({ name, description })
                const saved = await projectRepo.save(project)

                // Create Project-user relationship (user becomes owner)
                // Creating Project-user relationship
                const projectUser = projectUserRepo.create({
                    project_id: saved.id,
                    user_id: userId,
                    role: 'owner'
                })
                const _savedProjectUser = await projectUserRepo.save(projectUser)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /Projects - Error:', error)
                res.status(500).json({
                    error: 'Failed to create Project',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    router.get(
        '/:projectId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { projectRepo, projectUserRepo, MilestoneLinkRepo, linkRepo } = repos(req)

            const { membership } = await ensureProjectAccess(getDataSource(), userId, projectId)

            const project = await projectRepo.findOne({ where: { id: projectId } })
            if (!project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            const [MilestonesCount, TasksCount, membersCount] = await Promise.all([
                MilestoneLinkRepo.count({ where: { project: { id: projectId } } }),
                linkRepo.count({ where: { project: { id: projectId } } }),
                projectUserRepo.count({ where: { project_id: projectId } })
            ])

            const role = (membership.role || 'member') as ProjectRole
            const permissions = ROLE_PERMISSIONS[role]

            const membersPayload = permissions.manageMembers ? (await loadMembers(req, projectId)).members : undefined

            const response: ProjectDetailsResponse = {
                id: project.id,
                name: project.name,
                description: project.description ?? undefined,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                MilestonesCount,
                TasksCount,
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
        '/:projectId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureProjectAccess(getDataSource(), userId, projectId, 'manageMembers')

            // Add pagination support
            const { limit = 100, offset = 0, sortBy = 'created', sortOrder = 'desc', search } = validateListQuery(req.query)
            const { members, total } = await loadMembers(req, projectId, { limit, offset, sortBy, sortOrder, search })

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
        '/:projectId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureProjectAccess(getDataSource(), userId, projectId, 'manageMembers')

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
            const { authUserRepo, projectUserRepo } = repos(req)

            const targetUser = await authUserRepo
                .createQueryBuilder('user')
                // TODO: Add a functional index on LOWER(email) to keep this lookup performant.
                .where('LOWER(user.email) = LOWER(:email)', { email })
                .getOne()

            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            const existing = await projectUserRepo.findOne({
                where: { project_id: projectId, user_id: targetUser.id }
            })

            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'Project_MEMBER_EXISTS'
                })
            }

            const membership = projectUserRepo.create({
                project_id: projectId,
                user_id: targetUser.id,
                role,
                comment
            })
            const saved = await projectUserRepo.save(membership)

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: targetUser.id } })

            res.status(201).json(mapMember(saved, targetUser.email ?? null, profile?.nickname ?? null))
        })
    )

    router.patch(
        '/:projectId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureProjectAccess(getDataSource(), userId, projectId, 'manageMembers')

            const schema = z.object({
                role: memberRoleSchema,
                comment: z.string().trim().max(500).optional().or(z.literal(''))
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            }

            const { role, comment } = parsed.data
            const { projectUserRepo, authUserRepo } = repos(req)

            const membership = await projectUserRepo.findOne({
                where: { id: memberId, project_id: projectId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'modify')

            membership.role = role
            if (comment !== undefined) {
                membership.comment = comment
            }
            const saved = await projectUserRepo.save(membership)
            const authUser = await authUserRepo.findOne({ where: { id: membership.user_id } })

            // Load nickname from profiles table
            const ds = getDataSource()
            const profile = await ds.manager.findOne(Profile, { where: { user_id: membership.user_id } })

            res.json(mapMember(saved, authUser?.email ?? null, profile?.nickname ?? null))
        })
    )

    router.delete(
        '/:projectId/members/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId, memberId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            await ensureProjectAccess(getDataSource(), userId, projectId, 'manageMembers')

            const { projectUserRepo } = repos(req)
            const membership = await projectUserRepo.findOne({
                where: { id: memberId, project_id: projectId }
            })

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' })
            }

            assertNotOwner(membership, 'remove')

            await projectUserRepo.remove(membership)
            res.status(204).send()
        })
    )

    router.put(
        '/:projectId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params
            const { name, description } = req.body || {}
            if (!name) {
                return res.status(400).json({ error: 'name is required' })
            }

            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { projectRepo } = repos(req)
            await ensureProjectAccess(getDataSource(), userId, projectId, 'manageProject')

            const project = await projectRepo.findOne({ where: { id: projectId } })
            if (!project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            project.name = name
            project.description = description

            const saved = await projectRepo.save(project)
            res.json(saved)
        })
    )

    router.delete(
        '/:projectId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params
            const userId = resolveUserId(req)
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' })
            }

            const { projectRepo } = repos(req)
            await ensureProjectAccess(getDataSource(), userId, projectId, 'manageProject')

            const project = await projectRepo.findOne({ where: { id: projectId } })
            if (!project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            await projectRepo.remove(project)
            res.status(204).send()
        })
    )

    // GET /Projects/:projectId/Tasks
    router.get(
        '/:projectId/Tasks',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureProjectAccess(getDataSource(), userId, projectId)

            const { linkRepo } = repos(req)
            try {
                const links = await linkRepo.find({ where: { project: { id: projectId } }, relations: ['Task', 'Project'] })
                const Tasks = links.map((l) => ({ ...l.task, sortOrder: l.sortOrder }))
                // Debug log removed
                res.json(Tasks)
            } catch (error) {
                console.error(`GET /Projects/${projectId}/Tasks - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get Project Tasks',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /Projects/:projectId/Tasks/:taskId (attach)
    router.post(
        '/:projectId/Tasks/:taskId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId, taskId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureProjectAccess(getDataSource(), userId, projectId, 'createContent')
            const { linkRepo, projectRepo, taskRepo } = repos(req)
            const project = await projectRepo.findOne({ where: { id: projectId } })
            const task = await taskRepo.findOne({ where: { id: taskId } })
            if (!project || !task) return res.status(404).json({ error: 'Not found' })
            // Avoid duplicates at API level (no UNIQUE in DB as per requirements)
            const exists = await linkRepo.findOne({ where: { project: { id: projectId }, task: { id: taskId } } })
            if (exists) return res.status(200).json(exists)
            const link = linkRepo.create({ project, task })
            const saved = await linkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    // DELETE /Projects/:projectId/Tasks/:taskId (detach)
    router.delete(
        '/:projectId/Tasks/:taskId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId, taskId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureProjectAccess(getDataSource(), userId, projectId, 'deleteContent')
            const { linkRepo } = repos(req)
            const existing = await linkRepo.findOne({ where: { project: { id: projectId }, task: { id: taskId } } })
            if (!existing) return res.status(404).json({ error: 'Link not found' })
            await linkRepo.remove(existing)
            res.status(204).send()
        })
    )

    // POST /Projects/:projectId/Tasks/reorder { items: [{taskId, sortOrder}] }
    router.post(
        '/:projectId/Tasks/reorder',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params
            const { items } = req.body || {}
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureProjectAccess(getDataSource(), userId, projectId, 'editContent')
            const { linkRepo } = repos(req)
            for (const it of items) {
                if (!it?.taskId) continue
                const link = await linkRepo.findOne({ where: { project: { id: projectId }, task: { id: it.taskId } } })
                if (link) {
                    link.sortOrder = Number(it.sortOrder) || 1
                    await linkRepo.save(link)
                }
            }
            res.json({ success: true })
        })
    )

    // --- Milestones in Project ---

    // GET /Projects/:projectId/Milestones
    router.get(
        '/:projectId/Milestones',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { projectId } = req.params
            const userId = resolveUserId(req)
            // Debug log removed

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureProjectAccess(getDataSource(), userId, projectId)

            const { MilestoneLinkRepo } = repos(req)
            try {
                const links = await MilestoneLinkRepo.find({ where: { project: { id: projectId } }, relations: ['Milestone', 'Project'] })
                const Milestones = links.map((l) => l.milestone)
                // Debug log removed
                res.json(Milestones)
            } catch (error) {
                console.error(`GET /Projects/${projectId}/Milestones - Error:`, error)
                res.status(500).json({
                    error: 'Failed to get Project Milestones',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /Projects/:projectId/Milestones/:milestoneId (attach)
    router.post(
        '/:projectId/Milestones/:milestoneId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { projectId, milestoneId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            // Ensure the user can access both the Project and the Milestone
            await ensureProjectAccess(getDataSource(), userId, projectId, 'createContent')
            await ensureMilestoneAccess(getDataSource(), userId, milestoneId)
            const { projectRepo, milestoneRepo, MilestoneLinkRepo } = repos(req)
            const project = await projectRepo.findOne({ where: { id: projectId } })
            const milestone = await milestoneRepo.findOne({ where: { id: milestoneId } })
            if (!project || !milestone) return res.status(404).json({ error: 'Not found' })

            const exists = await MilestoneLinkRepo.findOne({ where: { project: { id: projectId }, milestone: { id: milestoneId } } })
            if (exists) return res.status(200).json(exists)

            const link = MilestoneLinkRepo.create({ project, milestone })
            const saved = await MilestoneLinkRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createProjectsRoutes
