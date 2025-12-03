import { Request, Response, NextFunction } from 'express'
import marketplacesService from '../../services/marketplaces'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

// Get all templates for marketplaces
const getAllTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Extract unikId from URL if not in params
        let unikId = req.params.unikId;
        if (!unikId) {
            // Match both /unik/:unikId/templates and /uniks/:unikId/templates patterns
            const urlMatch = req.originalUrl.match(/\/uniks?\/([^\/]+)\/templates/);
            if (urlMatch && urlMatch[1]) {
                unikId = urlMatch[1];
            }
        }
        const apiResponse = await marketplacesService.getAllTemplates(unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteCustomTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.deleteCustomTemplate - id not provided!`
            )
        }
        
        // Extract unikId from URL if not in params
        let unikId = req.params.unikId;
        if (!unikId) {
            // Match both /unik/:unikId/templates and /uniks/:unikId/templates patterns
            const urlMatch = req.originalUrl.match(/\/uniks?\/([^\/]+)\/templates/);
            if (urlMatch && urlMatch[1]) {
                unikId = urlMatch[1];
            }
        }
        
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.deleteCustomTemplate - unikId not provided!`
            )
        }
        const apiResponse = await marketplacesService.deleteCustomTemplate(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllCustomTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Extract unikId from URL if not in params
        let unikId = req.params.unikId;
        if (!unikId) {
            // Match both /unik/:unikId/templates and /uniks/:unikId/templates patterns
            const urlMatch = req.originalUrl.match(/\/uniks?\/([^\/]+)\/templates/);
            if (urlMatch && urlMatch[1]) {
                unikId = urlMatch[1];
            }
        }
        
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.getAllCustomTemplates - unikId not provided!`
            )
        }
        const apiResponse = await marketplacesService.getAllCustomTemplates(unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const saveCustomTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.saveCustomTemplate - request body is empty!`
            )
        }
        
        if (!req.body.name) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.saveCustomTemplate - 'name' field is required!`
            )
        }
        
        if (!req.body.canvasId && !req.body.tool) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.saveCustomTemplate - either 'canvasId' or 'tool' must be provided!`
            )
        }
        
        // Extract unikId from URL if not in params
        let unikId = req.params.unikId;
        if (!unikId) {
            // Match both /unik/:unikId/templates and /uniks/:unikId/templates patterns
            const urlMatch = req.originalUrl.match(/\/uniks?\/([^\/]+)\/templates/);
            if (urlMatch && urlMatch[1]) {
                unikId = urlMatch[1];
            }
        }
        
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: marketplacesService.saveCustomTemplate - unikId not provided!`
            )
        }
        const apiResponse = await marketplacesService.saveCustomTemplate({...req.body, unikId})
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getAllTemplates,
    getAllCustomTemplates,
    saveCustomTemplate,
    deleteCustomTemplate
}
