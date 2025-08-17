import { Router, Request, Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { Metaverse } from '../database/entities/Metaverse'
import { UserMetaverse } from '../database/entities/UserMetaverse'

const CreateSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional()
})

export function createMetaverseRoutes(dataSource: any): ExpressRouter {
    const router: ExpressRouter = Router()

    // Helper to create repositories lazily after DataSource is ready
    const getRepositories = async () => {
        // Ensure DataSource is initialized before creating repository
        if (!dataSource.isInitialized) {
            await dataSource.initialize()
        }

        const metaverseRepo = dataSource.getRepository(Metaverse)
        const userMetaverseRepo = dataSource.getRepository(UserMetaverse)
        return { metaverseRepo, userMetaverseRepo }
    }

    // GET /metaverses — list metaverses for current user (by membership)
    router.get('/', async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user?.sub || (req as any).user?.id
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { userMetaverseRepo } = await getRepositories()
            
            // Get user's metaverses through user_metaverses table
            const userMetaverses = await userMetaverseRepo.find({
                where: { user_id: userId },
                relations: ['metaverse']
            })

            const list = userMetaverses.map((um: any) => ({
                ...um.metaverse,
                role: um.role,
                is_default: um.is_default
            }))

            return res.json(list)
        } catch (e) {
            console.error('[MetaverseRoutes] Failed to list metaverses:', e)
            return res.status(500).json({ error: 'Failed to list metaverses' })
        }
    })

    // POST /metaverses — create a new metaverse and owner membership
    router.post('/', async (req: Request, res: Response) => {
        const parsed = CreateSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })

        const userId = (req as any).user?.sub || (req as any).user?.id
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        try {
            const { metaverseRepo, userMetaverseRepo } = await getRepositories()

            // Create metaverse
            const metaverse = metaverseRepo.create({
                ...parsed.data,
                created_by_user_id: userId
            })
            const savedMetaverse = await metaverseRepo.save(metaverse)

            // Create owner membership
            const userMetaverse = userMetaverseRepo.create({
                user_id: userId,
                metaverse_id: savedMetaverse.id,
                role: 'owner'
            })
            await userMetaverseRepo.save(userMetaverse)

            return res.status(201).json(savedMetaverse)
        } catch (e) {
            console.error('[MetaverseRoutes] Failed to create metaverse:', e)
            return res.status(500).json({ error: 'Failed to create metaverse' })
        }
    })

    return router
}

export default createMetaverseRoutes
