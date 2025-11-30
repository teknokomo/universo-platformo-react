import express, { Router, Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import type { IAssistantsController } from '../controllers'
import { AssistantsServiceError } from '../services'
import { AssistantsControllerError } from '../controllers'

/**
 * Configuration for assistants router
 */
export interface AssistantsRouterConfig {
    assistantsController: IAssistantsController
}

/**
 * Error handler for assistants routes
 */
export const assistantsErrorHandler: ErrorRequestHandler = (err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AssistantsServiceError || err instanceof AssistantsControllerError) {
        return res.status(err.statusCode).json({
            error: err.message
        })
    }
    next(err)
}

/**
 * Factory function to create assistants router with dependency injection
 */
export function createAssistantsRouter(config: AssistantsRouterConfig): Router {
    const { assistantsController } = config
    const router = express.Router({ mergeParams: true })

    // CREATE
    router.post('/', assistantsController.createAssistant)

    // READ
    router.get('/', assistantsController.getAllAssistants)
    router.get('/:id', assistantsController.getAssistantById)

    // UPDATE
    router.put('/:id', assistantsController.updateAssistant)

    // DELETE
    router.delete('/:id', assistantsController.deleteAssistant)

    // Components endpoints
    router.get('/components/chatmodels', assistantsController.getChatModels)
    router.get('/components/docstores', assistantsController.getDocumentStores)
    router.get('/components/tools', assistantsController.getTools)

    // Generate Assistant Instruction
    router.post('/generate/instruction', assistantsController.generateAssistantInstruction)

    return router
}
