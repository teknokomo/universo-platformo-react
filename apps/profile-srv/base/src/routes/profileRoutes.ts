import { Router } from 'express'
import { ProfileController } from '../controllers/profileController'

export function createProfileRoutes(profileController: ProfileController): Router {
    const router = Router()

    // GET /api/profile/:userId - Get user profile
    router.get('/profile/:userId', (req, res) => profileController.getProfile(req, res))

    // POST /api/profile - Create new profile
    router.post('/profile', (req, res) => profileController.createProfile(req, res))

    // PUT /api/profile/:userId - Update user profile
    router.put('/profile/:userId', (req, res) => profileController.updateProfile(req, res))

    // DELETE /api/profile/:userId - Delete user profile
    router.delete('/profile/:userId', (req, res) => profileController.deleteProfile(req, res))

    // GET /api/profiles - Get all profiles (admin endpoint)
    router.get('/profiles', (req, res) => profileController.getAllProfiles(req, res))

    return router
}
