import { Request, Response, NextFunction } from 'express'
import assistantsService from '../../services/assistants'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { AssistantType } from '../../Interface'
import { ensureUnikMembershipResponse } from '../../services/access-control'

const createAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.createAssistant - body not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.createAssistant - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.createAssistant({ ...req.body, unikId })
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.deleteAssistant - id not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.deleteAssistant - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.deleteAssistant(req.params.id, req.query.isDeleteBoth, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllAssistants = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const type = req.query.type as AssistantType
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.getAllAssistants - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.getAllAssistants(type, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAssistantById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.getAssistantById - id not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.getAssistantById - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.getAssistantById(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.updateAssistant - id not provided!`
            )
        }
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.updateAssistant - body not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.updateAssistant - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.updateAssistant(req.params.id, req.body, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getChatModels = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.getChatModels - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.getChatModels()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getDocumentStores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.getDocumentStores - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.getDocumentStores()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getTools = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: assistantsController.getTools - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.getTools()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const generateAssistantInstruction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.generateAssistantInstruction - body not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.generateAssistantInstruction - unikId not provided!`
            )
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: 'Access denied: You do not have permission to access this Unik'
        })
        if (!userId) return

        const apiResponse = await assistantsService.generateAssistantInstruction(req.body.task, req.body.selectedChatModel)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createAssistant,
    deleteAssistant,
    getAllAssistants,
    getAssistantById,
    updateAssistant,
    getChatModels,
    getDocumentStores,
    getTools,
    generateAssistantInstruction
}
