import { Router, Request, Response, RequestHandler, NextFunction } from 'express'
import { DataSource, In } from 'typeorm'
import { z, ZodError } from 'zod'
import type { RequestWithDbContext } from '@universo/auth-srv'
import { AuthUser } from '@universo/auth-srv'
import { Unik } from '../database/entities/Unik'
import { UnikUser } from '../database/entities/UnikUser'
import { Profile } from '@universo/profile-srv'
import { removeFolderFromStorage } from 'flowise-components'
import { purgeSpacesForUnik, cleanupCanvasStorage, createSpacesRoutes, type CreateSpacesRoutesOptions } from '@universo/spaces-srv'
import { ensureUnikAccess, assertNotOwner, ROLE_PERMISSIONS, type UnikRole } from './guards'
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

const asyncHandler =
    <T extends Request = Request, U extends Response = Response>(
        fn: (req: T, res: U) => Promise<void>
    ): RequestHandler =>
    (req, res, next) => {
        fn(req as T, res as U).catch(next)
    }

const getRepositories = (req: Request, getDataSource: () => DataSource) => {
    const dataSource = getDataSource()
    const manager = getRequestManager(req, dataSource)
    return {
        unikRepo: manager.getRepository(Unik),
        membershipRepo: manager.getRepository(UnikUser),
        dataSource
    }
}

const createUnikSchema = z.object({
    name: z.string().min(1, 'name is required'),
    description: z.string().max(1000).optional()
})

const addMemberSchema = z.object({
    unik_id: z.string(),
    user_id: z.string(),
    role: z.string().default('member')
})

const updateUnikSchema = z.object({
    name: z.string().min(1, 'name is required'),
    description: z.string().max(1000).optional()
})

/**
 * Map UnikUser membership to response format with email and nickname
 */
const mapMember = (
    member: UnikUser,
    email: string | null,
    nickname: string | null
): {
    id: string
    userId: string
    unikId: string
    email: string
    nickname: string
    role: string
    comment: string
    createdAt: Date
    updatedAt: Date
} => ({
    id: member.id,
    userId: member.user_id,
    unikId: member.unik_id,
    email: email || '',
    nickname: nickname || '',
    role: member.role,
    comment: member.comment || '',
    createdAt: member.created_at,
    updatedAt: member.updated_at
})

/**
 * Load members for a unik with pagination and search support
 * Based on metaverses-srv implementation
 * Uses separate queries to avoid TypeORM cross-schema JOIN issues
 */
const loadMembers = async (
    req: Request,
    getDataSource: () => DataSource,
    unikId: string,
    params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
    const { membershipRepo } = getRepositories(req, getDataSource)
    const ds = getDataSource()

    try {
        // Build base query WITHOUT JOINs to avoid TypeORM alias parsing issues for cross-schema tables
        const qb = membershipRepo.createQueryBuilder('mu').where('mu.unik_id = :unikId', { unikId })

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

            // Sorting (support created, role, email). Email via subselect expressions
            const ALLOWED_SORT_FIELDS: Record<string, string> = {
                created: 'mu.created_at',
                role: 'mu.role',
                email: '(SELECT u.email FROM auth.users u WHERE u.id = mu.user_id)'
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
        // eslint-disable-next-line no-console
        console.error('[loadMembers] ERROR', error)
        throw error
    }
}

// Router for collection operations (list, create) - mounted at /uniks
export function createUniksCollectionRouter(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    router.use(ensureAuth)

    router.get(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized: User not found' })

            try {
                // Validate and parse query parameters with Zod
                const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

                // Parse search parameter
                const normalizedSearch = search ? search.toLowerCase() : ''

                // Safe sorting with whitelist
                const ALLOWED_SORT_FIELDS = {
                    name: 'u.name',
                    created: 'u.created_at',
                    updated: 'u.updated_at'
                } as const

                const sortByField = ALLOWED_SORT_FIELDS[sortBy]
                const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

                const { unikRepo } = getRepositories(req, getDataSource)

                // Aggregate counts per unik in a single query filtered by current user membership
                const qb = unikRepo
                    .createQueryBuilder('u')
                    .innerJoin(UnikUser, 'm', 'm.unik_id = u.id')
                    .leftJoin('spaces', 's', 's.unik_id = u.id')
                    .where('m.user_id = :userId', { userId })

                // Add search filter if provided
                if (normalizedSearch) {
                    qb.andWhere('(LOWER(u.name) LIKE :search OR LOWER(u.description) LIKE :search)', {
                        search: `%${normalizedSearch}%`
                    })
                }

                qb.select([
                    'u.id as id',
                    'u.name as name',
                    'u.description as description',
                    'u.created_at as created_at',
                    'u.updated_at as updated_at'
                ])
                    .addSelect('COUNT(DISTINCT s.id)', 'spacesCount')
                    .addSelect('m.role', 'role')
                    // Use window function to get total count in single query
                    .addSelect('COUNT(*) OVER()', 'window_total')
                    .groupBy('u.id')
                    .addGroupBy('u.name')
                    .addGroupBy('u.description')
                    .addGroupBy('u.created_at')
                    .addGroupBy('u.updated_at')
                    .addGroupBy('m.role')
                    .orderBy(sortByField, sortDirection)
                    .limit(limit)
                    .offset(offset)

                const raw = await qb.getRawMany<{
                    id: string
                    name: string
                    description: string | null
                    created_at: Date
                    updated_at: Date
                    spacesCount: string
                    role: UnikRole | null
                    window_total?: string
                }>()

                // Extract total count from window function (same value in all rows)
                const total = raw.length > 0 ? Math.max(0, parseInt(String(raw[0].window_total || '0'), 10)) || 0 : 0

                const response = raw.map((row) => {
                    const role = (row.role || 'member') as UnikRole
                    const permissions = ROLE_PERMISSIONS[role]

                    return {
                        id: row.id,
                        name: row.name,
                        description: row.description || undefined,
                        role: row.role,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        spacesCount: parseInt(row.spacesCount || '0', 10) || 0,
                        permissions
                    }
                })

                // Add pagination metadata headers
                const hasMore = offset + raw.length < total
                res.setHeader('X-Pagination-Limit', limit.toString())
                res.setHeader('X-Pagination-Offset', offset.toString())
                res.setHeader('X-Pagination-Count', raw.length.toString())
                res.setHeader('X-Total-Count', total.toString())
                res.setHeader('X-Pagination-Has-More', hasMore.toString())

                res.json(response)
            } catch (error) {
                // Handle Zod validation errors
                if (error instanceof ZodError) {
                    return res.status(400).json({
                        error: 'Invalid query parameters',
                        details: error.errors.map((e) => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    })
                }
                throw error
            }
        })
    )

    router.post(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const parsed = createUnikSchema.safeParse(req.body || {})
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
                return
            }

            const { unikRepo, membershipRepo } = getRepositories(req, getDataSource)
            const unik = unikRepo.create({
                name: parsed.data.name,
                description: parsed.data.description
            })
            const savedUnik = await unikRepo.save(unik)

            const membership = membershipRepo.create({ user_id: userId, unik_id: savedUnik.id, role: 'owner' })
            await membershipRepo.save(membership)

            res.status(201).json(savedUnik)
        })
    )

    router.post(
        '/members',
        asyncHandler(async (req: Request, res: Response) => {
            const ownerId = resolveUserId(req)
            if (!ownerId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const parsed = addMemberSchema.safeParse(req.body || {})
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
                return
            }

            const { membershipRepo, dataSource } = getRepositories(req, getDataSource)

            // Check if requester has permission to manage members
            await ensureUnikAccess(dataSource, ownerId, parsed.data.unik_id, 'manageMembers')

            const membership = membershipRepo.create({
                unik_id: parsed.data.unik_id,
                user_id: parsed.data.user_id,
                role: parsed.data.role || 'member'
            })

            try {
                await membershipRepo.save(membership)
                res.status(201).json(membership)
            } catch (error: any) {
                if (error?.code === '23505') {
                    res.status(409).json({ error: 'User already linked to this Unik' })
                    return
                }
                throw error
            }
        })
    )

    return router
}

// Router for individual operations (get, update, delete) - mounted at /unik
export function createUnikIndividualRouter(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    router.use(ensureAuth)

    router.use('/:id/*', (req: Request, _res: Response, next: NextFunction) => {
        next('route')
    })

    router.get(
        '/:id',
        asyncHandler(async (req: Request, res: Response) => {
            const { unikRepo, membershipRepo, dataSource } = getRepositories(req, getDataSource)
            const unik = await unikRepo.findOne({ where: { id: req.params.id } })
            if (!unik) {
                res.status(404).json({ error: 'Unik not found' })
                return
            }

            // Count spaces (from public.spaces table)
            const spacesCount = await dataSource
                .createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from('spaces', 's')
                .where('s.unik_id = :unikId', { unikId: req.params.id })
                .getRawOne()
                .then((result) => parseInt(result?.count || '0', 10))

            // Count tools (from public.tool table)
            const toolsCount = await dataSource
                .createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from('tool', 't')
                .where('t.unik_id = :unikId', { unikId: req.params.id })
                .getRawOne()
                .then((result) => parseInt(result?.count || '0', 10))

            // Count credentials (from public.credential table)
            const credentialsCount = await dataSource
                .createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from('credential', 'c')
                .where('c.unik_id = :unikId', { unikId: req.params.id })
                .getRawOne()
                .then((result) => parseInt(result?.count || '0', 10))

            // Count variables (from public.variable table)
            const variablesCount = await dataSource
                .createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from('variable', 'v')
                .where('v.unik_id = :unikId', { unikId: req.params.id })
                .getRawOne()
                .then((result) => parseInt(result?.count || '0', 10))

            // Count API keys (from public.apikey table)
            const apiKeysCount = await dataSource
                .createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from('apikey', 'ak')
                .where('ak.unik_id = :unikId', { unikId: req.params.id })
                .getRawOne()
                .then((result) => parseInt(result?.count || '0', 10))

            // Count document stores (from public.document_store table)
            const documentStoresCount = await dataSource
                .createQueryBuilder()
                .select('COUNT(*)', 'count')
                .from('document_store', 'ds')
                .where('ds.unik_id = :unikId', { unikId: req.params.id })
                .getRawOne()
                .then((result) => parseInt(result?.count || '0', 10))

            // Count members
            const membersCount = await membershipRepo.count({
                where: { unik_id: req.params.id }
            })

            // Calculate permissions for current user
            const userId = resolveUserId(req)
            let permissions = undefined
            if (userId) {
                const membership = await membershipRepo.findOne({
                    where: { unik_id: req.params.id, user_id: userId }
                })
                if (membership) {
                    const role = (membership.role || 'member') as UnikRole
                    permissions = ROLE_PERMISSIONS[role]
                }
            }

            res.json({
                ...unik,
                spacesCount,
                toolsCount,
                credentialsCount,
                variablesCount,
                apiKeysCount,
                documentStoresCount,
                membersCount,
                permissions
            })
        })
    )

    router.put(
        '/:id',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const parsed = updateUnikSchema.safeParse(req.body || {})
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
                return
            }

            const { unikRepo, dataSource } = getRepositories(req, getDataSource)

            // Check if user has permission to edit content
            await ensureUnikAccess(dataSource, userId, req.params.id, 'editContent')

            const updateResult = await unikRepo
                .createQueryBuilder()
                .update(Unik)
                .set({
                    name: parsed.data.name,
                    description: parsed.data.description
                })
                .where('id = :id', { id: req.params.id })
                .returning('*')
                .execute()

            const updated = updateResult.raw?.[0]
            if (!updated) {
                res.status(404).json({ error: 'Unik not found' })
                return
            }

            res.json(updated)
        })
    )

    router.delete(
        '/:id',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const { dataSource } = getRepositories(req, getDataSource)

            // Check if user has permission to manage unik (owner only)
            await ensureUnikAccess(dataSource, userId, req.params.id, 'manageUnik')

            const unikId = req.params.id
            let deletedCanvasIds: string[] = []

            try {
                deletedCanvasIds = await dataSource.transaction(async (manager) => {
                    const existing = await manager.getRepository(Unik).findOne({ where: { id: unikId } })
                    if (!existing) {
                        throw new Error('UNIK_NOT_FOUND')
                    }

                    const { deletedCanvasIds: canvasesToDelete } = await purgeSpacesForUnik(manager, { unikId })

                    const deleteResult = await manager.getRepository(Unik).delete({ id: unikId })
                    if (!deleteResult.affected) {
                        throw new Error('UNIK_NOT_FOUND')
                    }

                    return canvasesToDelete
                })
            } catch (error: any) {
                if (error?.message === 'UNIK_NOT_FOUND') {
                    res.status(404).json({ error: 'Unik not found' })
                    return
                }
                throw error
            }

            if (deletedCanvasIds.length > 0) {
                await cleanupCanvasStorage(deletedCanvasIds, removeFolderFromStorage, { source: 'Uniks' })
            }

            res.status(204).send()
        })
    )

    return router
}

// Main router for nested resources - mounted at /uniks/:unikId
export function createUniksRouter(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    flowConfigRouter: Router,
    toolsRouter: Router,
    variablesRouter: Router,
    exportImportRouter: Router,
    credentialsRouter: Router,
    assistantsRouter: Router,
    apikeyRouter: Router,
    documentStoreRouter: Router,
    marketplacesRouter: Router,
    options?: { spacesLimiter?: RequestHandler; spacesRoutes?: CreateSpacesRoutesOptions }
): Router {
    const router = Router()

    // Apply auth middleware - will use ensureAuthWithRls if passed from flowise-server
    router.use(ensureAuth)

    if (!options?.spacesRoutes) {
        throw new Error('createUniksRouter requires spacesRoutes configuration')
    }

    const spacesRouter = createSpacesRoutes(getDataSource, options.spacesRoutes)

    router.use('/:unikId', (req: Request, _res: Response, next: NextFunction) => {
        if (!req.params.unikId && (req.params as any).id) {
            req.params.unikId = (req.params as any).id
        }
        next()
    })
    if (options?.spacesLimiter) {
        router.use('/:unikId', (req: Request, res: Response, next: NextFunction) => {
            const path = req.path || ''
            if (path.startsWith('/spaces') || path.startsWith('/canvases')) {
                return options.spacesLimiter!(req, res, next)
            }
            return next()
        })
    }
    // Members management routes (place BEFORE nested spaces router to avoid accidental interception)
    router.get(
        '/:unikId/members',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const unikId = req.params.unikId
            const { dataSource } = getRepositories(req, getDataSource)

            // Check if user has permission to view members
            await ensureUnikAccess(dataSource, userId, unikId, 'manageMembers')

            // Parse pagination parameters
            const limit = parseInt(req.query.limit as string) || 20
            const offset = parseInt(req.query.offset as string) || 0
            const search = (req.query.search as string) || ''
            const sortBy = (req.query.sortBy as string) || 'created'
            const sortOrder = (req.query.sortOrder as string) || 'desc'

            // Load members using helper function
            const { members, total } = await loadMembers(req, getDataSource, unikId, {
                limit,
                offset,
                sortBy,
                sortOrder,
                search
            })

            // Diagnostic logs (temporary)
            // eslint-disable-next-line no-console
            console.log('[uniks][GET /uniks/:unikId/members] response summary', {
                unikId,
                params: { limit, offset, sortBy, sortOrder, search },
                total,
                count: members.length,
                sample: members.slice(0, 2)
            })

            // Set pagination headers (match metaverses pattern)
            const hasMore = offset + members.length < total
            res.setHeader('X-Pagination-Limit', limit.toString())
            res.setHeader('X-Pagination-Offset', offset.toString())
            res.setHeader('X-Pagination-Count', members.length.toString())
            res.setHeader('X-Total-Count', total.toString())
            res.setHeader('X-Pagination-Has-More', hasMore.toString())

            // Explicitly set Content-Type to ensure JSON parsing on client
            res.setHeader('Content-Type', 'application/json; charset=utf-8')

            // Diagnostic: log what headers are being sent
            // eslint-disable-next-line no-console
            console.log('[uniks][GET /uniks/:unikId/members] headers sent', {
                contentType: res.getHeader('Content-Type'),
                xPaginationLimit: res.getHeader('X-Pagination-Limit'),
                xTotalCount: res.getHeader('X-Total-Count')
            })

            res.json(members)
        })
    )

    // Keep nested spaces routes after members endpoints
    router.use('/:unikId', spacesRouter)

    router.post(
        '/:unikId/members',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const unikId = req.params.unikId
            const { email, role, comment } = req.body

            if (!email || !role) {
                res.status(400).json({ error: 'Email and role are required' })
                return
            }

            const { membershipRepo, dataSource } = getRepositories(req, getDataSource)

            // Check if requester has permission to manage members
            await ensureUnikAccess(dataSource, userId, unikId, 'manageMembers')

            // Find target user by email using AuthUser entity
            const targetUser = await dataSource.manager
                .getRepository(AuthUser)
                .createQueryBuilder('user')
                .where('LOWER(user.email) = LOWER(:email)', { email })
                .getOne()

            if (!targetUser) {
                res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' })
                return
            }

            // Check if user is already a member
            const existingMembership = await membershipRepo.findOne({
                where: { unik_id: unikId, user_id: targetUser.id }
            })

            if (existingMembership) {
                res.status(409).json({ error: 'UNIK_MEMBER_EXISTS', message: 'User is already a member' })
                return
            }

            // Create membership
            const membership = membershipRepo.create({
                unik_id: unikId,
                user_id: targetUser.id,
                role,
                comment: comment || null
            })

            const saved = await membershipRepo.save(membership)

            // Load nickname from profiles table
            const profile = await dataSource.manager.findOne(Profile, { where: { user_id: targetUser.id } })

            res.status(201).json(mapMember(saved, targetUser.email, profile?.nickname ?? null))
        })
    )

    router.patch(
        '/:unikId/members/:memberId',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const { unikId, memberId } = req.params
            const { role, comment } = req.body

            const { membershipRepo, dataSource } = getRepositories(req, getDataSource)

            // Check requester permissions
            await ensureUnikAccess(dataSource, userId, unikId, 'manageMembers')

            // Get target membership to check if owner
            const targetMembership = await membershipRepo.findOne({
                where: { id: memberId, unik_id: unikId }
            })

            if (!targetMembership) {
                res.status(404).json({ error: 'Member not found' })
                return
            }

            // Prevent modifying owner
            assertNotOwner(targetMembership, 'modify')

            // Update membership
            const updateResult = await membershipRepo
                .createQueryBuilder()
                .update(UnikUser)
                .set({
                    role: role || undefined,
                    comment: comment !== undefined ? comment : undefined
                })
                .where('id = :memberId AND unik_id = :unikId', { memberId, unikId })
                .returning('*')
                .execute()

            const updated = updateResult.raw?.[0]
            if (!updated) {
                res.status(404).json({ error: 'Member not found' })
                return
            }

            // Fetch user details for response
            const membership = await membershipRepo.findOne({
                where: { id: memberId }
            })

            if (!membership) {
                res.status(404).json({ error: 'Member not found' })
                return
            }

            const user = await dataSource.manager.findOne(AuthUser, { where: { id: membership.user_id } })
            const profile = await dataSource.manager.findOne(Profile, { where: { user_id: membership.user_id } })

            res.json(mapMember(membership, user?.email ?? null, profile?.nickname ?? null))
        })
    )

    router.delete(
        '/:unikId/members/:memberId',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const { unikId, memberId } = req.params
            const { membershipRepo, dataSource } = getRepositories(req, getDataSource)

            // Check requester permissions
            await ensureUnikAccess(dataSource, userId, unikId, 'manageMembers')

            // Get target membership and prevent removing the owner
            const targetMembership = await membershipRepo.findOne({
                where: { id: memberId, unik_id: unikId }
            })

            if (!targetMembership) {
                res.status(404).json({ error: 'Member not found' })
                return
            }

            // Prevent removing owner
            assertNotOwner(targetMembership, 'remove')

            await membershipRepo.delete({ id: memberId, unik_id: unikId })

            res.status(204).send()
        })
    )

    router.use('/:unikId/flow-config', flowConfigRouter)
    router.use('/:unikId/tools', toolsRouter)
    router.use('/:unikId/variables', variablesRouter)
    router.use('/:unikId/export-import', exportImportRouter)
    router.use('/:unikId/credentials', credentialsRouter)
    router.use('/:unikId/assistants', assistantsRouter)
    router.use('/:unikId/apikey', apikeyRouter)
    router.use('/:unikId/document-stores', documentStoreRouter)
    router.use('/:unikId/templates', marketplacesRouter)

    return router
}

export default createUniksRouter
