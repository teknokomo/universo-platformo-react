import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { ProjectRole } from '@universo/types'
import { Task } from '../database/entities/Task'
import { Milestone } from '../database/entities/Milestone'
import { TaskMilestone } from '../database/entities/TaskMilestone'
import { Project } from '../database/entities/Project'
import { ProjectUser } from '../database/entities/ProjectUser'
import { MilestoneProject } from '../database/entities/MilestoneProject'
import { TaskProject } from '../database/entities/TaskProject'
import { ensureProjectAccess, ensureMilestoneAccess, ensureTaskAccess, ROLE_PERMISSIONS } from './guards'
import { z } from 'zod'
import { validateListQuery } from '../schemas/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../utils'

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
        taskRepo: manager.getRepository(Task),
        milestoneRepo: manager.getRepository(Milestone),
        TaskmilestoneRepo: manager.getRepository(TaskMilestone),
        projectRepo: manager.getRepository(Project),
        projectUserRepo: manager.getRepository(ProjectUser),
        MilestoneprojectRepo: manager.getRepository(MilestoneProject),
        TaskprojectRepo: manager.getRepository(TaskProject)
    }
}

/**
 * Auto-sync Task-Project links based on Milestone-Project relationships
 * Ensures Tasks_Projects table always reflects which Projects contain this Task
 * through its Milestones
 */
async function syncTaskProjectLinks(taskId: string, repos: ReturnType<typeof getRepositories>) {
    const { TaskmilestoneRepo, MilestoneprojectRepo, TaskprojectRepo, taskRepo } = repos

    // Find all Milestones this Task belongs to
    const TaskMilestones = await TaskmilestoneRepo.find({
        where: { task: { id: taskId } },
        relations: ['milestone']
    })

    const milestoneIds = TaskMilestones.map((es) => es.milestone.id)

    if (milestoneIds.length === 0) {
        // Task has no Milestones - remove all Project links
        await TaskprojectRepo.delete({ task: { id: taskId } })
        return
    }

    // Find all Projects these Milestones belong to
    const MilestoneProjects = await MilestoneprojectRepo.find({
        where: { milestone: { id: In(milestoneIds) } },
        relations: ['project']
    })

    // Get unique Project IDs
    const projectIds = [...new Set(MilestoneProjects.map((sm) => sm.project.id))]

    // Get current Task-Project links
    const currentLinks = await TaskprojectRepo.find({
        where: { task: { id: taskId } },
        relations: ['project']
    })

    const currentprojectIds = new Set(currentLinks.map((link) => link.project.id))

    // Add missing links
    const Task = await taskRepo.findOne({ where: { id: taskId } })
    if (!Task) return

    for (const projectId of projectIds) {
        if (!currentprojectIds.has(projectId)) {
            const link = TaskprojectRepo.create({
                task: { id: taskId },
                project: { id: projectId }
            })
            await TaskprojectRepo.save(link)
        }
    }

    // Remove obsolete links
    const obsoleteLinks = currentLinks.filter((link) => !projectIds.includes(link.project.id))
    if (obsoleteLinks.length > 0) {
        await TaskprojectRepo.remove(obsoleteLinks)
    }
}

// Comments in English only
export function createTasksRouter(
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

    // GET / - List all Tasks with pagination, search, sorting
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

                // Get Tasks accessible to user through Milestone membership
                const { taskRepo } = getRepositories(req, getDataSource)
                const qb = taskRepo
                    .createQueryBuilder('e')
                    // Join with Task-Milestone link
                    .innerJoin(TaskMilestone, 'es', 'es.task_id = e.id')
                    // Join with Milestone
                    .innerJoin(Milestone, 's', 's.id = es.milestone_id')
                    // Join with Milestone-Project link
                    .innerJoin(MilestoneProject, 'sm', 'sm.milestone_id = s.id')
                    // Join with Project user to filter by user access
                    .innerJoin(ProjectUser, 'mu', 'mu.project_id = sm.project_id')
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
                console.error('[ERROR] GET /Tasks failed:', error)
                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // POST / (Create a new Task)
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { taskRepo, milestoneRepo, TaskmilestoneRepo, projectRepo, TaskprojectRepo } = getRepositories(req, getDataSource)
            const schema = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                milestoneId: z.string().uuid(),
                projectId: z.string().uuid().optional()
            })
            const parsed = schema.safeParse(req.body || {})
            if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
            const { name, description, projectId, milestoneId } = parsed.data
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            // Verify access to the Milestone
            await ensureMilestoneAccess(getDataSource(), userId, milestoneId, 'createContent')

            try {
                // Validate Milestone exists
                const Milestone = await milestoneRepo.findOne({ where: { id: milestoneId } })
                if (!Milestone) return res.status(400).json({ error: 'Invalid milestoneId' })

                const Task = taskRepo.create({ name, description })
                await taskRepo.save(Task)

                // Create mandatory Task-Milestone link
                const TaskMilestoneLink = TaskmilestoneRepo.create({ task: Task, milestone: Milestone })
                await TaskmilestoneRepo.save(TaskMilestoneLink)

                // CRITICAL: Auto-sync Task-Project links based on Milestone-Project links
                // This ensures TasksCount is always accurate in Project dashboard
                await syncTaskProjectLinks(Task.id, getRepositories(req, getDataSource))

                // Optional explicit Project link (kept for backwards compatibility)
                if (projectId) {
                    // Verify access to the Project
                    await ensureProjectAccess(getDataSource(), userId, projectId, 'createContent')

                    const Project = await projectRepo.findOne({ where: { id: projectId } })
                    if (!Project) return res.status(400).json({ error: 'Invalid projectId' })
                    const exists = await TaskprojectRepo.findOne({
                        where: { project: { id: projectId }, task: { id: Task.id } }
                    })
                    if (!exists) {
                        const link = TaskprojectRepo.create({ task: Task, project: Project })
                        await TaskprojectRepo.save(link)
                    }
                }

                res.status(201).json(Task)
            } catch (error) {
                console.error('POST /Tasks - Error:', error)
                res.status(500).json({
                    error: 'Failed to create Task',
                    details: error instanceof Error ? error.message : String(error)
                })
            }
        })
    )

    // GET /:taskId (Get a single Task)
    router.get(
        '/:taskId',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureTaskAccess(getDataSource(), userId, req.params.taskId)
            const { taskRepo } = getRepositories(req, getDataSource)
            const Task = await taskRepo.findOneBy({ id: req.params.taskId })
            if (!Task) {
                return res.status(404).json({ error: 'Task not found' })
            }
            res.json(Task)
        })
    )

    // PUT /:taskId (Update a Task)
    router.put(
        '/:taskId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureTaskAccess(getDataSource(), userId, req.params.taskId, 'editContent')
            const { taskRepo } = getRepositories(req, getDataSource)
            const Task = await taskRepo.findOneBy({ id: req.params.taskId })
            if (!Task) {
                return res.status(404).json({ error: 'Task not found' })
            }
            const { name, description } = req.body
            taskRepo.merge(Task, { name, description })
            await taskRepo.save(Task)
            res.json(Task)
        })
    )

    // DELETE /:taskId (Delete a Task)
    router.delete(
        '/:taskId',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureTaskAccess(getDataSource(), userId, req.params.taskId, 'deleteContent')
            const { taskRepo } = getRepositories(req, getDataSource)
            const result = await taskRepo.delete({ id: req.params.taskId })
            if (result.affected === 0) {
                return res.status(404).json({ error: 'Task not found' })
            }
            res.status(204).send()
        })
    )

    // PUT /:taskId/Milestone { milestoneId }
    router.put(
        '/:taskId/Milestone',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { taskRepo, milestoneRepo, TaskmilestoneRepo } = getRepositories(req, getDataSource)
            const taskId = req.params.taskId
            const { milestoneId } = req.body || {}
            if (!milestoneId) return res.status(400).json({ error: 'milestoneId is required' })
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureTaskAccess(getDataSource(), userId, taskId, 'editContent')
            await ensureMilestoneAccess(getDataSource(), userId, milestoneId, 'editContent')

            const Task = await taskRepo.findOneBy({ id: taskId })
            if (!Task) return res.status(404).json({ error: 'Task not found' })

            const Milestone = await milestoneRepo.findOneBy({ id: milestoneId })
            if (!Milestone) return res.status(404).json({ error: 'Milestone not found' })

            const exists = await TaskmilestoneRepo.findOne({ where: { task: { id: taskId }, milestone: { id: milestoneId } } })
            if (exists) return res.status(200).json(exists)

            const link = TaskmilestoneRepo.create({ task: Task, milestone: Milestone })
            const saved = await TaskmilestoneRepo.save(link)

            // Auto-sync Task-Project links after adding Milestone
            await syncTaskProjectLinks(taskId, getRepositories(req, getDataSource))

            res.status(201).json(saved)
        })
    )

    // DELETE /:taskId/Milestone � remove all Milestone links for the Task (simple semantics)
    router.delete(
        '/:taskId/Milestone',
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { taskRepo, TaskmilestoneRepo } = getRepositories(req, getDataSource)
            const taskId = req.params.taskId
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })
            await ensureTaskAccess(getDataSource(), userId, taskId, 'deleteContent')
            const Task = await taskRepo.findOneBy({ id: taskId })
            if (!Task) return res.status(404).json({ error: 'Task not found' })

            const links = await TaskmilestoneRepo.find({ where: { task: { id: taskId } } })
            if (links.length === 0) return res.status(404).json({ error: 'No Milestone links found' })

            await TaskmilestoneRepo.remove(links)

            // Auto-sync Task-Project links after removing Milestones
            await syncTaskProjectLinks(taskId, getRepositories(req, getDataSource))

            res.status(204).send()
        })
    )

    return router
}

export default createTasksRouter
