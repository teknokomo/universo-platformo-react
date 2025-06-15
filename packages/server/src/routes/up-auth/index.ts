import { Router } from 'express'
import { registerUser, loginUser, logoutUser, getCurrentUser, refreshToken, updateUserEmail, updateUserPassword } from '../../controllers/up-auth/auth'
import upAuth from '../../middlewares/up-auth'

const router = Router()

// Universo Platformo | Authentication routes
router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', logoutUser)
router.get('/me', getCurrentUser)
router.post('/refresh', refreshToken) // New route for token refresh
router.put('/email', upAuth.ensureAuth, updateUserEmail)
router.put('/password', upAuth.ensureAuth, updateUserPassword)

export default router
