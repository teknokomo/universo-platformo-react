import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ProfileController } from '../controllers/profileController'
import { ProfileService } from '../services/profileService'
import type { DbExecutor } from '@universo/utils/database'

export interface ProfileRouteDeps {
    getDbExecutor: () => DbExecutor
    getRequestDbExecutor: (req: unknown) => DbExecutor
}

export function createProfileRoutes(deps: ProfileRouteDeps, authMiddleware?: any): Router {
    const router = Router()

    // Public route: check nickname availability (with basic rate limiting)
    const checkNicknameLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true })
    router.get('/check-nickname/:nickname', checkNicknameLimiter, async (req, res) => {
        const nickname = (req.params.nickname || '').trim()
        // Basic validation: allow letters, numbers, underscore; 3-30 chars
        const isValid = /^[a-zA-Z0-9_]{3,30}$/.test(nickname)
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid nickname format' })
        }
        const exec = deps.getDbExecutor()
        const service = new ProfileService(exec)
        const controller = new ProfileController(service)
        return controller.checkNickname(req, res)
    })

    // Apply auth middleware for all routes below, if provided
    if (authMiddleware) {
        router.use(authMiddleware)
    }

    // Helper to get controller with RLS-aware executor from request context
    const getController = (req: unknown) => {
        const exec = deps.getRequestDbExecutor(req)
        const service = new ProfileService(exec)
        return new ProfileController(service)
    }

    // Settings routes (must be before /:userId to avoid conflict)
    router.get('/settings', async (req, res) => {
        return getController(req).getSettings(req, res)
    })
    router.put('/settings', async (req, res) => {
        return getController(req).updateSettings(req, res)
    })

    // Get or create current user's profile (auto-creates if not exists)
    router.get('/me', async (req, res) => {
        return getController(req).getOrCreateCurrentProfile(req, res)
    })

    // Protected routes
    router.get('/:userId', async (req, res) => {
        return getController(req).getProfile(req, res)
    })
    router.post('/', async (req, res) => {
        return getController(req).createProfile(req, res)
    })
    router.put('/:userId', async (req, res) => {
        return getController(req).updateProfile(req, res)
    })
    router.delete('/:userId', async (req, res) => {
        return getController(req).deleteProfile(req, res)
    })
    router.get('/', async (req, res) => {
        return getController(req).getAllProfiles(req, res)
    })

    return router
}

export default createProfileRoutes
