import { Router } from 'express'
import { ProfileController } from '../controllers/profileController'
import { ProfileService } from '../services/profileService'
import { Profile } from '../database/entities/Profile'

// Create function that will be called when DataSource is available
export function createProfileRoutes(dataSource: any): Router {
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

    // Routes
    router.get('/check-nickname/:nickname', async (req, res) => {
        const controller = await getController()
        return controller.checkNickname(req, res)
    })
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
