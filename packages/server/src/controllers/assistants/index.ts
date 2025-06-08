import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { AssistantType } from '../../Interface'
import assistantsService from '../../services/assistants'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { checkUsageLimit } from '../../utils/quotaUsage'

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
        const body = req.body
        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.createAssistant - organization ${orgId} not found!`
            )
        }

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: assistantsController.createAssistant - workspace ${workspaceId} not found!`
            )
        }
        const subscriptionId = req.user?.activeOrganizationSubscriptionId || ''

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]
        const existingAssistantCount = await assistantsService.getAssistantsCountByOrganization(body.type, orgId)
        const newAssistantCount = 1
        await checkUsageLimit('flows', subscriptionId, getRunningExpressApp().usageCacheManager, existingAssistantCount + newAssistantCount)

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }
        body.workspaceId = workspaceId
        const apiResponse = await assistantsService.createAssistant(body, orgId)

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

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

        const apiResponse = await assistantsService.deleteAssistant(req.params.id, req.query.isDeleteBoth, unikId)
        const apiResponse = await assistantsService.deleteAssistant(req.params.id, req.query.isDeleteBoth)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllAssistants = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const type = req.query.type as AssistantType
        const apiResponse = await assistantsService.getAllAssistants(type, req.user?.activeWorkspaceId)
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: assistantsController.getAllAssistants - unikId not provided!`
            )
        }

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

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

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

        const apiResponse = await assistantsService.getAssistantById(req.params.id, unikId)
        const apiResponse = await assistantsService.getAssistantById(req.params.id)
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

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

        const apiResponse = await assistantsService.updateAssistant(req.params.id, req.body, unikId)
        const apiResponse = await assistantsService.updateAssistant(req.params.id, req.body)
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

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

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

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

        const apiResponse = await assistantsService.getDocumentStores()
        const apiResponse = await assistantsService.getDocumentStores(req.user?.activeWorkspaceId)
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

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

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

        // Universo Platformo | Check user access to this Unik
        const userId = (req as any).user?.sub
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' })
        }

        // Get auth token from request
        const authToken = (req as any).headers?.authorization?.split(' ')?.[1]

        // Check if user has access to this Unik using AccessControlService
        const hasAccess = await accessControlService.checkUnikAccess(userId, unikId, authToken)
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access this Unik' })
        }

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
