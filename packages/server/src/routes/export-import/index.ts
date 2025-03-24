import express from 'express'
import exportImportController from '../../controllers/export-import'
const router = express.Router({ mergeParams: true })

router.post('/export', exportImportController.exportData)

router.post('/import', exportImportController.importData)

export default router
