// Universo Platformo | UPDL Routes
// Express routes for UPDL operations

import { Router } from 'express'
import UPDLController from '../controllers/UPDLController'
import path from 'path'
import fs from 'fs'

// Create router
const router = Router()

/**
 * Get UPDL scene
 * GET /api/updl/scenes/:id
 */
router.get('/scenes/:id', (req, res) => UPDLController.getUPDLScene(req, res))

/**
 * List UPDL scenes
 * GET /api/updl/scenes
 */
router.get('/scenes', (req, res) => UPDLController.listUPDLScenes(req, res))

/**
 * Publish AR.js project
 * POST /api/updl/publish/arjs
 */
router.post('/publish/arjs', (req, res) => UPDLController.publishARJS(req, res))

/**
 * List published AR.js projects
 * GET /api/updl/published/arjs
 */
router.get('/published/arjs', (req, res) => UPDLController.listPublishedARJS(req, res))

/**
 * Access published AR.js project
 * GET /p/:id
 */
router.get('/p/:id', (req, res) => {
    const { id } = req.params
    const publicationDir = path.resolve(process.cwd(), 'public', 'published')
    const filePath = path.join(publicationDir, `arjs_${id}.html`)

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath)
    } else {
        res.status(404).send('Published project not found')
    }
})

export default router
