import { Router, Request, Response, RequestHandler, NextFunction } from 'express'
import { DataSource } from 'typeorm'
import { z } from 'zod'
import type { RequestWithDbContext } from '@universo/auth-srv'
import { Unik } from '../database/entities/Unik'
import { UnikUser } from '../database/entities/UnikUser'
import { removeFolderFromStorage } from 'flowise-components'
import { purgeSpacesForUnik, cleanupCanvasStorage, createSpacesRoutes, type CreateSpacesRoutesOptions } from '@universo/spaces-srv'

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
    <T extends Request, U extends Response>(fn: (req: T, res: U) => Promise<void>) =>
    (req: T, res: U, next: NextFunction) => {
        Promise.resolve(fn(req, res)).catch(next)
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
    name: z.string().min(1, 'name is required')
})

const addMemberSchema = z.object({
    unik_id: z.string(),
    user_id: z.string(),
    role: z.string().default('member')
})

const updateUnikSchema = z.object({
    name: z.string().min(1, 'name is required')
})

// Router for collection operations (list, create) - mounted at /uniks
export function createUniksCollectionRouter(ensureAuth: RequestHandler, getDataSource: () => DataSource): Router {
    const router = Router()

    router.use(ensureAuth)

    router.get(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            const userId = resolveUserId(req)
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: User not found' })
                return
            }

            const { membershipRepo } = getRepositories(req, getDataSource)

            // Use QueryBuilder to aggregate spaces count per unik in a single query
            const qb = membershipRepo
                .createQueryBuilder('m')
                .leftJoin('m.unik', 'u')
                // spaces lives in public schema; join by FK unik_id
                .leftJoin('spaces', 's', 's.unik_id = u.id')
                .where('m.user_id = :userId', { userId })
                .select(['m.role as role', 'u.id as id', 'u.name as name', 'u.created_at as created_at', 'u.updated_at as updated_at'])
                .addSelect('COUNT(s.id)', 'spacesCount')
                .groupBy('m.id')
                .addGroupBy('u.id')
                .orderBy('m.role', 'ASC')

            const raw = await qb.getRawMany<{
                role: string
                id: string
                name: string
                created_at: Date
                updated_at: Date
                spacesCount: string
            }>()

            const response = raw.map(
                (row: { role: string; id: string; name: string; created_at: Date; updated_at: Date; spacesCount: string }) => ({
                    id: row.id,
                    name: row.name,
                    role: row.role,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    // expose camelCase for UI convenience as well
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    spacesCount: parseInt(row.spacesCount || '0', 10) || 0
                })
            )

            res.json(response)
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
            const unik = unikRepo.create({ name: parsed.data.name })
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

            const { membershipRepo } = getRepositories(req, getDataSource)
            const ownerMembership = await membershipRepo.findOne({
                where: { unik_id: parsed.data.unik_id, user_id: ownerId }
            })

            if (!ownerMembership || ownerMembership.role !== 'owner') {
                res.status(403).json({ error: 'Not authorized to manage members of this Unik' })
                return
            }

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
            const { unikRepo } = getRepositories(req, getDataSource)
            const unik = await unikRepo.findOne({ where: { id: req.params.id } })
            if (!unik) {
                res.status(404).json({ error: 'Unik not found' })
                return
            }
            res.json(unik)
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

            const { unikRepo, membershipRepo } = getRepositories(req, getDataSource)
            const membership = await membershipRepo.findOne({
                where: { unik_id: req.params.id, user_id: userId }
            })

            if (!membership || !['owner', 'editor'].includes(membership.role)) {
                res.status(403).json({ error: 'Not authorized to update this Unik' })
                return
            }

            const updateResult = await unikRepo
                .createQueryBuilder()
                .update(Unik)
                .set({ name: parsed.data.name })
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

            const { membershipRepo, dataSource } = getRepositories(req, getDataSource)
            const membership = await membershipRepo.findOne({
                where: { unik_id: req.params.id, user_id: userId }
            })

            if (!membership || membership.role !== 'owner') {
                res.status(403).json({ error: 'Not authorized to delete this Unik' })
                return
            }

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
    router.use('/:unikId', spacesRouter)

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
