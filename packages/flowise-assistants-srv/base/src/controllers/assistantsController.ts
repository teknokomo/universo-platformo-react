import { Request, Response, NextFunction, RequestHandler } from 'express'
import { StatusCodes } from 'http-status-codes'
import type { IAssistantsService } from '../services'
import type { AssistantType } from '../Interface'

/**
 * Error class for controller errors
 */
export class AssistantsControllerError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message)
        this.name = 'AssistantsControllerError'
    }
}

/**
 * Access control function type
 */
export type EnsureUnikMembershipFn = (
    req: Request,
    res: Response,
    unikId: string,
    options: { errorMessage: string }
) => Promise<string | null>

/**
 * Configuration for assistants controller
 */
export interface AssistantsControllerConfig {
    assistantsService: IAssistantsService
    ensureUnikMembership?: EnsureUnikMembershipFn
}

/**
 * Assistants controller interface
 */
export interface IAssistantsController {
    createAssistant: RequestHandler
    deleteAssistant: RequestHandler
    getAllAssistants: RequestHandler
    getAssistantById: RequestHandler
    updateAssistant: RequestHandler
    getChatModels: RequestHandler
    getDocumentStores: RequestHandler
    getTools: RequestHandler
    generateAssistantInstruction: RequestHandler
}

/**
 * Factory function to create assistants controller with dependency injection
 */
export function createAssistantsController(config: AssistantsControllerConfig): IAssistantsController {
    const { assistantsService, ensureUnikMembership } = config

    const checkUnikMembership = async (req: Request, res: Response, unikId: string): Promise<boolean> => {
        if (ensureUnikMembership) {
            const userId = await ensureUnikMembership(req, res, unikId, {
                errorMessage: 'Access denied: You do not have permission to access this Unik'
            })
            return userId !== null
        }
        return true
    }

    const createAssistant: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.body) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.createAssistant - body not provided!'
                )
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.createAssistant - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.createAssistant({ ...req.body, unikId })
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const deleteAssistant: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.deleteAssistant - id not provided!'
                )
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.deleteAssistant - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.deleteAssistant(req.params.id, req.query.isDeleteBoth, unikId)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getAllAssistants: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const type = req.query.type as AssistantType
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.getAllAssistants - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.getAllAssistants(type, unikId)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getAssistantById: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.getAssistantById - id not provided!'
                )
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.getAssistantById - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.getAssistantById(req.params.id, unikId)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const updateAssistant: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (typeof req.params === 'undefined' || !req.params.id) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.updateAssistant - id not provided!'
                )
            }
            if (!req.body) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.updateAssistant - body not provided!'
                )
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.updateAssistant - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.updateAssistant(req.params.id, req.body, unikId)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getChatModels: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.getChatModels - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.getChatModels()
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getDocumentStores: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.getDocumentStores - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.getDocumentStores()
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const getTools: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.getTools - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.getTools()
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    const generateAssistantInstruction: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.body) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.generateAssistantInstruction - body not provided!'
                )
            }
            const unikId = req.params.unikId as string
            if (!unikId) {
                throw new AssistantsControllerError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Error: assistantsController.generateAssistantInstruction - unikId not provided!'
                )
            }

            if (!(await checkUnikMembership(req, res, unikId))) return

            const apiResponse = await assistantsService.generateAssistantInstruction(req.body.task, req.body.selectedChatModel)
            return res.json(apiResponse)
        } catch (error) {
            next(error)
        }
    }

    return {
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
}
