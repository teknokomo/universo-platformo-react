import express from 'express'
import variablesController from '../../controllers/variables'

const router = express.Router({ mergeParams: true })

// CREATE
router.post('/', variablesController.createVariable)

// READ
router.get('/', variablesController.getAllVariables)
router.get('/:id', variablesController.getVariableById)

// UPDATE
router.put('/:id', variablesController.updateVariable)

// DELETE
router.delete('/:id', variablesController.deleteVariable)

export default router
