import { Router } from 'express'
import { registerUser, loginUser, logoutUser, getCurrentUser } from '../../controllers/up-auth/auth'

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', logoutUser)
router.get('/me', getCurrentUser)

export default router
