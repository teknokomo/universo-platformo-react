import express from 'express'
import marketplacesController from '../../controllers/marketplaces'
const router = express.Router()

// READ
router.get('/', marketplacesController.getAllTemplates)

// Custom templates
router.post('/custom', marketplacesController.saveCustomTemplate)

// READ
router.get('/custom', marketplacesController.getAllCustomTemplates)

// DELETE
router.delete('/custom/:id', marketplacesController.deleteCustomTemplate)

export default router
