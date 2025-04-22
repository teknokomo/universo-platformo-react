import { Router } from 'express'
import { registerUser, loginUser, logoutUser, getCurrentUser, refreshToken } from '../../controllers/up-auth/auth'

const router = Router()

// Universo Platformo | Authentication routes
router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', logoutUser)
router.get('/me', getCurrentUser)
router.post('/refresh', refreshToken) // New route for token refresh

export default router
