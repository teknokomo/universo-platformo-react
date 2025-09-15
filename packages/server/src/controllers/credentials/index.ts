import { Request, Response, NextFunction } from 'express'
import credentialsService from '../../services/credentials'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import { accessControlService } from '../../services/access-control'

const createCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.createCredential - body not provided!`
            )
        }
    const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.createCredential - unikId not provided!`
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

        const apiResponse = await credentialsService.createCredential({ ...req.body, unikId })
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteCredentials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.deleteCredentials - unikId not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.deleteCredentials - unikId not provided!`
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

        const apiResponse = await credentialsService.deleteCredentials(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllCredentials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.getAllCredentials - unikId not provided!`
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

        const apiResponse = await credentialsService.getAllCredentials(req.query.credentialName, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getCredentialById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.getCredentialById - unikId not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.getCredentialById - unikId not provided!`
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

        const apiResponse = await credentialsService.getCredentialById(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.updateCredential - unikId not provided!`
            )
        }
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.updateCredential - body not provided!`
            )
        }
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.updateCredential - unikId not provided!`
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

        const apiResponse = await credentialsService.updateCredential(req.params.id, { ...req.body, unikId }, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createCredential,
    deleteCredentials,
    getAllCredentials,
    getCredentialById,
    updateCredential
}
