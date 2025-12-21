import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { isSuperuserByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { Metahub } from '../database/entities/Metahub'
import { MetahubUser } from '../database/entities/MetahubUser'
import { SysEntity } from '../database/entities/SysEntity'
import { SysField } from '../database/entities/SysField'
import { validateListQuery, CreateEntitySchema, CreateFieldSchema } from '../schemas/queryParams'

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

/**
 * Check if user has access to a metahub
 */
async function checkMetahubAccess(
    req: Request,
    ds: DataSource,
    metahubId: string,
    userId: string,
    requireEditRole = false
): Promise<{ hasAccess: boolean; role?: string; error?: string }> {
    const manager = getRequestManager(req, ds)
    const metahubUserRepo = manager.getRepository(MetahubUser)

    const membership = await metahubUserRepo.findOne({
        where: { metahub_id: metahubId, user_id: userId }
    })

    const isSuperuser = await isSuperuserByDataSource(ds, userId)
    const hasGlobalAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs')

    if (!membership && !isSuperuser && !hasGlobalAccess) {
        return { hasAccess: false, error: 'Access denied' }
    }

    const role = membership?.role ?? (isSuperuser ? 'admin' : 'viewer')

    if (requireEditRole && !['owner', 'admin'].includes(role) && !isSuperuser && !hasGlobalAccess) {
        return { hasAccess: false, role, error: 'Insufficient permissions' }
    }

    return { hasAccess: true, role }
}

export function createEntitiesRoutes(
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
            entityRepo: manager.getRepository(SysEntity),
            fieldRepo: manager.getRepository(SysField)
        }
    }

    // GET /metahubs/:metahubId/entities - List entities in a metahub
    router.get(
        '/:metahubId/entities',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkMetahubAccess(req, ds, metahubId, userId)
            if (!accessCheck.hasAccess) {
                return res.status(403).json({ error: accessCheck.error })
            }

            const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = validateListQuery(req.query)

            const { entityRepo, fieldRepo } = repos(req)

            const ALLOWED_SORT_FIELDS = {
                name: 'e.name',
                created: 'e.createdAt',
                updated: 'e.updatedAt'
            } as const

            const sortByField = ALLOWED_SORT_FIELDS[sortBy as keyof typeof ALLOWED_SORT_FIELDS] ?? 'e.updatedAt'
            const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

            const qb = entityRepo
                .createQueryBuilder('e')
                .leftJoin(SysField, 'f', 'f.entity_id = e.id')
                .where('e.metahub_id = :metahubId', { metahubId })

            if (search) {
                qb.andWhere('(LOWER(e.name) LIKE :search OR LOWER(e.codename) LIKE :search)', {
                    search: `%${search.toLowerCase()}%`
                })
            }

            qb.select([
                'e.id as id',
                'e.name as name',
                'e.codename as codename',
                'e.description as description',
                'e.createdAt as "createdAt"',
                'e.updatedAt as "updatedAt"',
                'COUNT(DISTINCT f.id) as "fieldsCount"'
            ])
                .groupBy('e.id')
                .orderBy(sortByField, sortDirection)
                .offset(offset)
                .limit(limit)

            const [items, total] = await Promise.all([
                qb.getRawMany(),
                entityRepo.count({ where: { metahub_id: metahubId } })
            ])

            return res.json({
                items: items.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    codename: item.codename,
                    description: item.description,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    fieldsCount: parseInt(item.fieldsCount, 10) || 0
                })),
                total,
                limit,
                offset
            })
        })
    )

    // POST /metahubs/:metahubId/entities - Create entity
    router.post(
        '/:metahubId/entities',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkMetahubAccess(req, ds, metahubId, userId, true)
            if (!accessCheck.hasAccess) {
                return res.status(403).json({ error: accessCheck.error })
            }

            const parsed = CreateEntitySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const { metahubRepo, entityRepo } = repos(req)

            // Check metahub exists
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            // Check codename uniqueness within metahub
            const existing = await entityRepo.findOne({
                where: { metahub_id: metahubId, codename: parsed.data.codename }
            })
            if (existing) {
                return res.status(409).json({ error: 'Entity with this codename already exists in this metahub' })
            }

            const entity = entityRepo.create({
                metahub_id: metahubId,
                name: parsed.data.name,
                codename: parsed.data.codename,
                description: parsed.data.description,
                displayConfig: parsed.data.displayConfig
            })

            const savedEntity = await entityRepo.save(entity)

            return res.status(201).json({
                id: savedEntity.id,
                name: savedEntity.name,
                codename: savedEntity.codename,
                description: savedEntity.description,
                displayConfig: savedEntity.displayConfig,
                createdAt: savedEntity.createdAt,
                updatedAt: savedEntity.updatedAt
            })
        })
    )

    // GET /metahubs/:metahubId/entities/:entityId - Get entity details
    router.get(
        '/:metahubId/entities/:entityId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkMetahubAccess(req, ds, metahubId, userId)
            if (!accessCheck.hasAccess) {
                return res.status(403).json({ error: accessCheck.error })
            }

            const { entityRepo, fieldRepo } = repos(req)

            const entity = await entityRepo.findOne({
                where: { id: entityId, metahub_id: metahubId }
            })

            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' })
            }

            const fields = await fieldRepo.find({
                where: { entity_id: entityId },
                order: { sortOrder: 'ASC', createdAt: 'ASC' }
            })

            return res.json({
                id: entity.id,
                name: entity.name,
                codename: entity.codename,
                description: entity.description,
                displayConfig: entity.displayConfig,
                createdAt: entity.createdAt,
                updatedAt: entity.updatedAt,
                fields: fields.map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    codename: f.codename,
                    fieldType: f.fieldType,
                    required: f.required,
                    fieldConfig: f.fieldConfig,
                    sortOrder: f.sortOrder
                }))
            })
        })
    )

    // DELETE /metahubs/:metahubId/entities/:entityId - Delete entity
    router.delete(
        '/:metahubId/entities/:entityId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkMetahubAccess(req, ds, metahubId, userId, true)
            if (!accessCheck.hasAccess) {
                return res.status(403).json({ error: accessCheck.error })
            }

            const { entityRepo } = repos(req)

            const entity = await entityRepo.findOne({
                where: { id: entityId, metahub_id: metahubId }
            })

            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' })
            }

            await entityRepo.remove(entity)

            return res.status(204).send()
        })
    )

    // POST /metahubs/:metahubId/entities/:entityId/fields - Create field
    router.post(
        '/:metahubId/entities/:entityId/fields',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkMetahubAccess(req, ds, metahubId, userId, true)
            if (!accessCheck.hasAccess) {
                return res.status(403).json({ error: accessCheck.error })
            }

            const parsed = CreateFieldSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const { entityRepo, fieldRepo } = repos(req)

            // Check entity exists
            const entity = await entityRepo.findOne({
                where: { id: entityId, metahub_id: metahubId }
            })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' })
            }

            // Check codename uniqueness within entity
            const existing = await fieldRepo.findOne({
                where: { entity_id: entityId, codename: parsed.data.codename }
            })
            if (existing) {
                return res.status(409).json({ error: 'Field with this codename already exists in this entity' })
            }

            const field = fieldRepo.create({
                entity_id: entityId,
                name: parsed.data.name,
                codename: parsed.data.codename,
                fieldType: parsed.data.fieldType,
                required: parsed.data.required,
                fieldConfig: parsed.data.fieldConfig,
                sortOrder: parsed.data.sortOrder
            })

            const savedField = await fieldRepo.save(field)

            return res.status(201).json({
                id: savedField.id,
                name: savedField.name,
                codename: savedField.codename,
                fieldType: savedField.fieldType,
                required: savedField.required,
                fieldConfig: savedField.fieldConfig,
                sortOrder: savedField.sortOrder,
                createdAt: savedField.createdAt
            })
        })
    )

    // DELETE /metahubs/:metahubId/entities/:entityId/fields/:fieldId - Delete field
    router.delete(
        '/:metahubId/entities/:entityId/fields/:fieldId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId, fieldId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkMetahubAccess(req, ds, metahubId, userId, true)
            if (!accessCheck.hasAccess) {
                return res.status(403).json({ error: accessCheck.error })
            }

            const { entityRepo, fieldRepo } = repos(req)

            // Check entity exists
            const entity = await entityRepo.findOne({
                where: { id: entityId, metahub_id: metahubId }
            })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found' })
            }

            const field = await fieldRepo.findOne({
                where: { id: fieldId, entity_id: entityId }
            })
            if (!field) {
                return res.status(404).json({ error: 'Field not found' })
            }

            await fieldRepo.remove(field)

            return res.status(204).send()
        })
    )

    return router
}
