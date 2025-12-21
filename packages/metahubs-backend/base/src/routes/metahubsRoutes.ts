import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { AuthUser } from '@universo/auth-backend'
import { isSuperuserByDataSource, hasSubjectPermissionByDataSource, getGlobalRoleCodenameByDataSource } from '@universo/admin-backend'
import { Metahub } from '../database/entities/Metahub'
import { MetahubUser } from '../database/entities/MetahubUser'
import { SysEntity } from '../database/entities/SysEntity'
import { validateListQuery, CreateMetahubSchema, UpdateMetahubSchema } from '../schemas/queryParams'

/**
 * Get the appropriate manager for the request (RLS-enabled if available)
 */
const getRequestManager = (req: Request, dataSource: DataSource) => {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithDbContext).user
    if (!user) return undefined
    const claims = user as unknown as Record<string, unknown>
    return user.id ?? (claims.sub as string | undefined) ?? (claims.user_id as string | undefined)
}

// MetahubRole type for permissions
type MetahubRole = 'owner' | 'admin' | 'editor' | 'viewer'

const ROLE_PERMISSIONS: Record<MetahubRole, { canEdit: boolean; canManageMembers: boolean; canDelete: boolean }> = {
    owner: { canEdit: true, canManageMembers: true, canDelete: true },
    admin: { canEdit: true, canManageMembers: true, canDelete: false },
    editor: { canEdit: true, canManageMembers: false, canDelete: false },
    viewer: { canEdit: false, canManageMembers: false, canDelete: false }
}

export function createMetahubsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            metahubRepo: manager.getRepository(Metahub),
            metahubUserRepo: manager.getRepository(MetahubUser),
            entityRepo: manager.getRepository(SysEntity),
            authUserRepo: manager.getRepository(AuthUser)
        }
    }

    // GET /metahubs - List all metahubs for the user
    router.get(
        '/',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const ds = getDataSource()
            const isSuperuser = await isSuperuserByDataSource(ds, userId)
            const hasMetahubsGlobalAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs')
            const globalRoleName = (isSuperuser || hasMetahubsGlobalAccess)
                ? await getGlobalRoleCodenameByDataSource(ds, userId)
                : null

            const showAllParam = req.query.showAll
            const showAll = (isSuperuser || hasMetahubsGlobalAccess) && showAllParam === 'true'

            const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

            const ALLOWED_SORT_FIELDS = {
                name: 'm.name',
                created: 'm.createdAt',
                updated: 'm.updatedAt'
            } as const

            const sortByField = ALLOWED_SORT_FIELDS[sortBy as keyof typeof ALLOWED_SORT_FIELDS] ?? 'm.updatedAt'
            const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

            const { metahubRepo, metahubUserRepo, entityRepo } = repos(req)
            const qb = metahubRepo
                .createQueryBuilder('m')
                .leftJoin(SysEntity, 'se', 'se.metahub_id = m.id')

            if (showAll) {
                qb.leftJoin(MetahubUser, 'mu', 'mu.metahub_id = m.id AND mu.user_id = :userId', { userId })
            } else {
                qb.innerJoin(MetahubUser, 'mu', 'mu.metahub_id = m.id')
                    .where('mu.user_id = :userId', { userId })
            }

            if (search) {
                qb.andWhere('LOWER(m.name) LIKE :search', { search: `%${search.toLowerCase()}%` })
            }

            qb.select([
                'm.id as id',
                'm.name as name',
                'm.description as description',
                'm.createdAt as "createdAt"',
                'm.updatedAt as "updatedAt"',
                'COUNT(DISTINCT se.id) as "entitiesCount"',
                showAll ? 'COALESCE(mu.role, :globalRole) as role' : 'mu.role as role'
            ])
                .groupBy('m.id')
                .addGroupBy('mu.role')
                .orderBy(sortByField, sortDirection)
                .offset(offset)
                .limit(limit)

            if (showAll) {
                qb.setParameter('globalRole', globalRoleName ?? 'viewer')
            }

            const [items, totalCount] = await Promise.all([
                qb.getRawMany(),
                showAll
                    ? metahubRepo.count()
                    : metahubUserRepo.count({ where: { user_id: userId } })
            ])

            return res.json({
                items: items.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    entitiesCount: parseInt(item.entitiesCount, 10) || 0,
                    role: item.role as MetahubRole,
                    permissions: ROLE_PERMISSIONS[item.role as MetahubRole] ?? ROLE_PERMISSIONS.viewer
                })),
                total: totalCount,
                limit,
                offset,
                hasGlobalAccess: isSuperuser || hasMetahubsGlobalAccess
            })
        })
    )

    // POST /metahubs - Create a new metahub
    router.post(
        '/',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const parsed = CreateMetahubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const { metahubRepo, metahubUserRepo } = repos(req)

            const metahub = metahubRepo.create({
                name: parsed.data.name,
                description: parsed.data.description
            })

            const savedMetahub = await metahubRepo.save(metahub)

            // Create owner membership
            const membership = metahubUserRepo.create({
                metahub_id: savedMetahub.id,
                user_id: userId,
                role: 'owner'
            })
            await metahubUserRepo.save(membership)

            return res.status(201).json({
                id: savedMetahub.id,
                name: savedMetahub.name,
                description: savedMetahub.description,
                createdAt: savedMetahub.createdAt,
                updatedAt: savedMetahub.updatedAt,
                role: 'owner' as MetahubRole,
                permissions: ROLE_PERMISSIONS.owner
            })
        })
    )

    // GET /metahubs/:id - Get metahub details
    router.get(
        '/:id',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { id } = req.params
            const { metahubRepo, metahubUserRepo, entityRepo } = repos(req)
            const ds = getDataSource()

            const metahub = await metahubRepo.findOne({ where: { id } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Check access
            const membership = await metahubUserRepo.findOne({
                where: { metahub_id: id, user_id: userId }
            })

            const isSuperuser = await isSuperuserByDataSource(ds, userId)
            const hasGlobalAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs')

            if (!membership && !isSuperuser && !hasGlobalAccess) {
                return res.status(403).json({ error: 'Access denied' })
            }

            const entitiesCount = await entityRepo.count({ where: { metahub_id: id } })
            const membersCount = await metahubUserRepo.count({ where: { metahub_id: id } })

            const role = membership?.role ?? (isSuperuser ? 'admin' : 'viewer')

            return res.json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                createdAt: metahub.createdAt,
                updatedAt: metahub.updatedAt,
                entitiesCount,
                membersCount,
                role: role as MetahubRole,
                permissions: ROLE_PERMISSIONS[role as MetahubRole] ?? ROLE_PERMISSIONS.viewer
            })
        })
    )

    // PUT /metahubs/:id - Update metahub
    router.put(
        '/:id',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { id } = req.params
            const { metahubRepo, metahubUserRepo } = repos(req)
            const ds = getDataSource()

            const metahub = await metahubRepo.findOne({ where: { id } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Check edit permission
            const membership = await metahubUserRepo.findOne({
                where: { metahub_id: id, user_id: userId }
            })

            const isSuperuser = await isSuperuserByDataSource(ds, userId)
            const hasGlobalAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs')
            const role = membership?.role ?? (isSuperuser ? 'admin' : null)

            if (!role || !ROLE_PERMISSIONS[role as MetahubRole]?.canEdit) {
                if (!isSuperuser && !hasGlobalAccess) {
                    return res.status(403).json({ error: 'Insufficient permissions to edit this metahub' })
                }
            }

            const parsed = UpdateMetahubSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            if (parsed.data.name !== undefined) {
                metahub.name = parsed.data.name
            }
            if (parsed.data.description !== undefined) {
                metahub.description = parsed.data.description ?? undefined
            }

            const savedMetahub = await metahubRepo.save(metahub)

            return res.json({
                id: savedMetahub.id,
                name: savedMetahub.name,
                description: savedMetahub.description,
                createdAt: savedMetahub.createdAt,
                updatedAt: savedMetahub.updatedAt
            })
        })
    )

    // DELETE /metahubs/:id - Delete metahub
    router.delete(
        '/:id',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { id } = req.params
            const { metahubRepo, metahubUserRepo } = repos(req)
            const ds = getDataSource()

            const metahub = await metahubRepo.findOne({ where: { id } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Check delete permission - only owner or superuser
            const membership = await metahubUserRepo.findOne({
                where: { metahub_id: id, user_id: userId }
            })

            const isSuperuser = await isSuperuserByDataSource(ds, userId)

            if (membership?.role !== 'owner' && !isSuperuser) {
                return res.status(403).json({ error: 'Only the owner can delete this metahub' })
            }

            await metahubRepo.remove(metahub)

            return res.status(204).send()
        })
    )

    return router
}
