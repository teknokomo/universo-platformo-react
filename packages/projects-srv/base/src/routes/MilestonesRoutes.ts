import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-srv'
import type { ProjectRole } from '@universo/types'
import { Milestone } from '../database/entities/Milestone'
import { Project } from '../database/entities/Project'
import { ProjectUser } from '../database/entities/ProjectUser'
import { MilestoneProject } from '../database/entities/MilestoneProject'
import { Task } from '../database/entities/Task'
import { TaskMilestone } from '../database/entities/TaskMilestone'
import { ensureMilestoneAccess, ensureProjectAccess, ensureTaskAccess, ROLE_PERMISSIONS } from './guards'
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

// Comments in English only
export function createMilestonesRoutes(
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
            milestoneRepo: manager.getRepository(Milestone),
            projectRepo: manager.getRepository(Project),
            projectUserRepo: manager.getRepository(ProjectUser),
            MilestoneprojectRepo: manager.getRepository(MilestoneProject),
            taskRepo: manager.getRepository(Task),
            TaskmilestoneRepo: manager.getRepository(TaskMilestone)
        }
    }

    // GET /Milestones - with pagination, search, sorting
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

                // Get Milestones accessible to user through Project membership
                const { milestoneRepo } = repos(req)
                const qb = milestoneRepo
                    .createQueryBuilder('s')
                    // Join with Milestone-Project link
                    .innerJoin(MilestoneProject, 'sm', 'sm.milestone_id = s.id')
                    // Join with Project user to filter by user access
                    .innerJoin(ProjectUser, 'mu', 'mu.project_id = sm.project_id')
                    // Left join with Task-Milestone to count Tasks
                    .leftJoin(TaskMilestone, 'es', 'es.milestone_id = s.id')
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
                    .addSelect('COUNT(DISTINCT es.id)', 'TasksCount')
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
                    TasksCount: string
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                // Handle edge case: empty result set
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) : 0

                const response = raw.map((row) => {
                    const role = (row.user_role || 'member') as ProjectRole
                    const permissions = ROLE_PERMISSIONS[role]

                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description ?? undefined,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        TasksCount: parseInt(row.TasksCount || '0', 10) || 0,
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
                console.error('[ERROR] GET /Milestones failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST /Milestones
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                projectId: z.string().uuid()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, projectId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Validate required fields
            if (!name) return res.status(400).json({ error: 'name is required' })
            if (!projectId) return res.status(400).json({ error: 'projectId is required - Milestones must be associated with a Project' })

            await ensureProjectAccess(getDataSource(), userId, projectId, 'createContent')

            const { milestoneRepo, projectRepo, MilestoneprojectRepo } = repos(req)

            try {
                // Validate Project exists
                const Project = await projectRepo.findOne({ where: { id: projectId } })
                if (!Project) return res.status(400).json({ error: 'Invalid projectId' })

                const Task = milestoneRepo.create({ name, description })
                const saved = await milestoneRepo.save(Task)

                // Create mandatory Milestone-Project link
                const MilestoneProjectLink = MilestoneprojectRepo.create({ milestone: saved, project: Project })
                await MilestoneprojectRepo.save(MilestoneProjectLink)

                res.status(201).json(saved)
            } catch (error) {
                console.error('POST /Milestones - Error:', error)
                res.status(500).json({
                    error: 'Failed to create Milestone',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /Milestones/:milestoneId
    router.get(
        '/:milestoneId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { milestoneId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            await ensureMilestoneAccess(getDataSource(), userId, milestoneId)

            const { milestoneRepo, TaskmilestoneRepo } = repos(req)

            const Milestone = await milestoneRepo.findOne({ where: { id: milestoneId } })
            if (!Milestone) return res.status(404).json({ error: 'Milestone not found' })

            // Get Tasks count for this Milestone
            const TasksCount = await TaskmilestoneRepo.count({ where: { milestone: { id: milestoneId } } })

            const response = {
                id: Milestone.id,
                name: Milestone.name,
                description: Milestone.description ?? undefined,
                createdAt: Milestone.createdAt,
                updatedAt: Milestone.updatedAt,
                TasksCount
            }

            res.json(response)
        })
    )

    // PUT /Milestones/:milestoneId
    router.put(
        '/:milestoneId',
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

            const { milestoneId } = req.params
            const { name, description } = parsed.data
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMilestoneAccess(getDataSource(), userId, milestoneId, 'editContent')
            const { milestoneRepo } = repos(req)

            const Milestone = await milestoneRepo.findOne({ where: { id: milestoneId } })
            if (!Milestone) return res.status(404).json({ error: 'Milestone not found' })

            if (name !== undefined) Milestone.name = name
            if (description !== undefined) Milestone.description = description

            const updated = await milestoneRepo.save(Milestone)
            res.json(updated)
        })
    )

    // DELETE /Milestones/:milestoneId
    router.delete(
        '/:milestoneId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { milestoneId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMilestoneAccess(getDataSource(), userId, milestoneId, 'deleteContent')
            const { milestoneRepo } = repos(req)

            const Milestone = await milestoneRepo.findOne({ where: { id: milestoneId } })
            if (!Milestone) return res.status(404).json({ error: 'Milestone not found' })

            await milestoneRepo.remove(Milestone)
            res.status(204).send()
        })
    )

    // GET /Milestones/:milestoneId/Tasks
    router.get(
        '/:milestoneId/Tasks',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { milestoneId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureMilestoneAccess(getDataSource(), userId, milestoneId)
            const { milestoneRepo, TaskmilestoneRepo } = repos(req)

            // Validate Milestone exists
            const Milestone = await milestoneRepo.findOne({ where: { id: milestoneId } })
            if (!Milestone) return res.status(404).json({ error: 'Milestone not found' })

            // Get Tasks linked to this Milestone
            const links = await TaskmilestoneRepo.find({
                where: { milestone: { id: milestoneId } },
                relations: ['Task']
            })
            const Tasks = links.map((link) => link.task)
            res.json(Tasks)
        })
    )

    // POST /Milestones/:milestoneId/Tasks/:taskId (attach Task to Milestone)
    router.post(
        '/:milestoneId/Tasks/:taskId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { milestoneId, taskId } = req.params
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Ensure user has createContent permission for the Milestone
            await ensureMilestoneAccess(getDataSource(), userId, milestoneId, 'createContent')

            // SECURITY: Ensure user has access to the Task before attaching
            await ensureTaskAccess(getDataSource(), userId, taskId)

            const { milestoneRepo, taskRepo, TaskmilestoneRepo } = repos(req)

            // Validate Milestone exists
            const Milestone = await milestoneRepo.findOne({ where: { id: milestoneId } })
            if (!Milestone) return res.status(404).json({ error: 'Milestone not found' })

            // Validate Task exists
            const Task = await taskRepo.findOne({ where: { id: taskId } })
            if (!Task) return res.status(404).json({ error: 'Task not found' })

            // Check if link already exists (idempotent)
            const existing = await TaskmilestoneRepo.findOne({
                where: { milestone: { id: milestoneId }, task: { id: taskId } }
            })
            if (existing) return res.status(200).json(existing)

            // Create new link
            const link = TaskmilestoneRepo.create({ milestone: Milestone, task: Task })
            const saved = await TaskmilestoneRepo.save(link)
            res.status(201).json(saved)
        })
    )

    return router
}

export default createMilestonesRoutes
