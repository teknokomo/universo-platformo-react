import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { isSuperuserByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { MetahubUser } from '../database/entities/MetahubUser'
import { SysEntity } from '../database/entities/SysEntity'
import { UserDataStore } from '../database/entities/UserDataStore'
import { validateListQuery, CreateRecordSchema, UpdateRecordSchema } from '../schemas/queryParams'

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
 * Check if user has access to a metahub (via entity relationship)
 */
async function checkEntityAccess(
    req: Request,
    ds: DataSource,
    entityId: string,
    userId: string,
    requireEditRole = false
): Promise<{ hasAccess: boolean; role?: string; error?: string; metahubId?: string }> {
    const manager = getRequestManager(req, ds)
    const entityRepo = manager.getRepository(SysEntity)
    const metahubUserRepo = manager.getRepository(MetahubUser)

    const entity = await entityRepo.findOne({ where: { id: entityId } })
    if (!entity) {
        return { hasAccess: false, error: 'Entity not found' }
    }

    const membership = await metahubUserRepo.findOne({
        where: { metahub_id: entity.metahub_id, user_id: userId }
    })

    const isSuperuser = await isSuperuserByDataSource(ds, userId)
    const hasGlobalAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs')

    if (!membership && !isSuperuser && !hasGlobalAccess) {
        return { hasAccess: false, error: 'Access denied' }
    }

    const role = membership?.role ?? (isSuperuser ? 'admin' : 'viewer')

    if (requireEditRole && !['owner', 'admin', 'editor'].includes(role) && !isSuperuser && !hasGlobalAccess) {
        return { hasAccess: false, role, error: 'Insufficient permissions' }
    }

    return { hasAccess: true, role, metahubId: entity.metahub_id }
}

export function createRecordsRoutes(
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
            entityRepo: manager.getRepository(SysEntity),
            recordRepo: manager.getRepository(UserDataStore)
        }
    }

    // GET /metahubs/:metahubId/entities/:entityId/records - List records
    router.get(
        '/:metahubId/entities/:entityId/records',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkEntityAccess(req, ds, entityId, userId)
            if (!accessCheck.hasAccess) {
                return res.status(accessCheck.error === 'Entity not found' ? 404 : 403).json({ error: accessCheck.error })
            }

            // Verify entity belongs to the metahub
            const { entityRepo, recordRepo } = repos(req)
            const entity = await entityRepo.findOne({ where: { id: entityId, metahub_id: metahubId } })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found in this metahub' })
            }

            const { limit = 100, offset = 0, sortOrder = 'desc' } = validateListQuery(req.query)
            const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

            const [items, total] = await recordRepo.findAndCount({
                where: { entity_id: entityId },
                order: { createdAt: sortDirection },
                skip: offset,
                take: limit
            })

            return res.json({
                items: items.map((item: any) => ({
                    id: item.id,
                    data: item.data,
                    createdBy: item.createdBy,
                    updatedBy: item.updatedBy,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                })),
                total,
                limit,
                offset
            })
        })
    )

    // POST /metahubs/:metahubId/entities/:entityId/records - Create record
    router.post(
        '/:metahubId/entities/:entityId/records',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkEntityAccess(req, ds, entityId, userId, true)
            if (!accessCheck.hasAccess) {
                return res.status(accessCheck.error === 'Entity not found' ? 404 : 403).json({ error: accessCheck.error })
            }

            // Verify entity belongs to the metahub
            const { entityRepo, recordRepo } = repos(req)
            const entity = await entityRepo.findOne({ where: { id: entityId, metahub_id: metahubId } })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found in this metahub' })
            }

            const parsed = CreateRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const record = recordRepo.create({
                entity_id: entityId,
                data: parsed.data.data,
                createdBy: userId,
                updatedBy: userId
            })

            const savedRecord = await recordRepo.save(record)

            return res.status(201).json({
                id: savedRecord.id,
                data: savedRecord.data,
                createdBy: savedRecord.createdBy,
                updatedBy: savedRecord.updatedBy,
                createdAt: savedRecord.createdAt,
                updatedAt: savedRecord.updatedAt
            })
        })
    )

    // GET /metahubs/:metahubId/entities/:entityId/records/:recordId - Get record
    router.get(
        '/:metahubId/entities/:entityId/records/:recordId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId, recordId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkEntityAccess(req, ds, entityId, userId)
            if (!accessCheck.hasAccess) {
                return res.status(accessCheck.error === 'Entity not found' ? 404 : 403).json({ error: accessCheck.error })
            }

            const { entityRepo, recordRepo } = repos(req)
            const entity = await entityRepo.findOne({ where: { id: entityId, metahub_id: metahubId } })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found in this metahub' })
            }

            const record = await recordRepo.findOne({
                where: { id: recordId, entity_id: entityId }
            })

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            return res.json({
                id: record.id,
                data: record.data,
                createdBy: record.createdBy,
                updatedBy: record.updatedBy,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt
            })
        })
    )

    // PUT /metahubs/:metahubId/entities/:entityId/records/:recordId - Update record
    router.put(
        '/:metahubId/entities/:entityId/records/:recordId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId, recordId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkEntityAccess(req, ds, entityId, userId, true)
            if (!accessCheck.hasAccess) {
                return res.status(accessCheck.error === 'Entity not found' ? 404 : 403).json({ error: accessCheck.error })
            }

            const { entityRepo, recordRepo } = repos(req)
            const entity = await entityRepo.findOne({ where: { id: entityId, metahub_id: metahubId } })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found in this metahub' })
            }

            const record = await recordRepo.findOne({
                where: { id: recordId, entity_id: entityId }
            })

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            const parsed = UpdateRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            record.data = parsed.data.data
            record.updatedBy = userId

            const savedRecord = await recordRepo.save(record)

            return res.json({
                id: savedRecord.id,
                data: savedRecord.data,
                createdBy: savedRecord.createdBy,
                updatedBy: savedRecord.updatedBy,
                createdAt: savedRecord.createdAt,
                updatedAt: savedRecord.updatedAt
            })
        })
    )

    // DELETE /metahubs/:metahubId/entities/:entityId/records/:recordId - Delete record
    router.delete(
        '/:metahubId/entities/:entityId/records/:recordId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'User not authenticated' })

            const { metahubId, entityId, recordId } = req.params
            const ds = getDataSource()

            const accessCheck = await checkEntityAccess(req, ds, entityId, userId, true)
            if (!accessCheck.hasAccess) {
                return res.status(accessCheck.error === 'Entity not found' ? 404 : 403).json({ error: accessCheck.error })
            }

            const { entityRepo, recordRepo } = repos(req)
            const entity = await entityRepo.findOne({ where: { id: entityId, metahub_id: metahubId } })
            if (!entity) {
                return res.status(404).json({ error: 'Entity not found in this metahub' })
            }

            const record = await recordRepo.findOne({
                where: { id: recordId, entity_id: entityId }
            })

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            await recordRepo.remove(record)

            return res.status(204).send()
        })
    )

    return router
}
