import express from 'express'
import leadsController from '../../controllers/leads'
const router = express.Router()

// CREATE
router.post('/', leadsController.createLeadForCanvas)

// READ
router.get(['/', '/:id'], leadsController.getAllLeadsForCanvas)

export default router
