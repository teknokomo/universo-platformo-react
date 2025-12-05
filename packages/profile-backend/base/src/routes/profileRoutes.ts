import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ProfileController } from '../controllers/profileController'
import { ProfileService } from '../services/profileService'
import { Profile } from '../database/entities/Profile'

// Create function that will be called when DataSource is available
export function createProfileRoutes(dataSource: any, authMiddleware?: any): Router {
    const router = Router()

    // Helper to create controller lazily after DataSource is ready
    const getController = async () => {
        // Ensure DataSource is initialized before creating repository
        if (!dataSource.isInitialized) {
            await dataSource.initialize()
        }

        const repo = dataSource.getRepository(Profile)
        const service = new ProfileService(repo)
        return new ProfileController(service)
    }

    // Public route: check nickname availability (with basic rate limiting)
    const checkNicknameLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
    router.get('/check-nickname/:nickname', checkNicknameLimiter, async (req, res) => {
        const nickname = (req.params.nickname || '').trim()
        // Basic validation: allow letters, numbers, underscore; 3-30 chars
        const isValid = /^[a-zA-Z0-9_]{3,30}$/.test(nickname)
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid nickname format' })
        }
        const controller = await getController()
        return controller.checkNickname(req, res)
    })

    // Apply auth middleware for all routes below, if provided
    if (authMiddleware) {
        router.use(authMiddleware)
    }

    // Settings routes (must be before /:userId to avoid conflict)
    router.get('/settings', async (req, res) => {
        const controller = await getController()
        return controller.getSettings(req, res)
    })
    router.put('/settings', async (req, res) => {
        const controller = await getController()
        return controller.updateSettings(req, res)
    })

    // Get or create current user's profile (auto-creates if not exists)
    router.get('/me', async (req, res) => {
        const controller = await getController()
        return controller.getOrCreateCurrentProfile(req, res)
    })

    // Protected routes
    router.get('/:userId', async (req, res) => {
        const controller = await getController()
        return controller.getProfile(req, res)
    })
    router.post('/', async (req, res) => {
        const controller = await getController()
        return controller.createProfile(req, res)
    })
    router.put('/:userId', async (req, res) => {
        const controller = await getController()
        return controller.updateProfile(req, res)
    })
    router.delete('/:userId', async (req, res) => {
        const controller = await getController()
        return controller.deleteProfile(req, res)
    })
    router.get('/', async (req, res) => {
        const controller = await getController()
        return controller.getAllProfiles(req, res)
    })

    return router
}

export default createProfileRoutes
