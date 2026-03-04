import express from 'express'
import { Request, Response } from 'express'
const router = express.Router()

// GET /ping — health check
router.get('/', (_req: Request, res: Response) => {
    res.status(200).send('pong')
})

export default router
