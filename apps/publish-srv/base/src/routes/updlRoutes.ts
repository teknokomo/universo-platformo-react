// Universo Platformo | UPDL Routes
// Express routes for UPDL functionality

import express from 'express'
import * as path from 'path'
import * as fs from 'fs'
import { UPDLController } from '../controllers/UPDLController'

const router = express.Router()
const updlController = new UPDLController()

// Get a UPDL scene
router.get('/scene/:id', updlController.getUPDLScene)

// Publish UPDL project to AR.js
router.post('/publish/arjs', updlController.publishUPDLToARJS)

// Get a published AR.js project
router.get('/publication/arjs/:publishId', updlController.getARJSPublication)

// List all published AR.js projects
router.get('/publications/arjs', updlController.listARJSPublications)

// Static route for published AR.js projects
router.get('/p/arjs/:id', (req, res) => {
    const id = req.params.id
    const publishPath = path.join(process.cwd(), 'public', 'published', id, 'index.html')

    if (fs.existsSync(publishPath)) {
        res.sendFile(publishPath)
    } else {
        res.status(404).send('AR.js publication not found')
    }
})

export default router
