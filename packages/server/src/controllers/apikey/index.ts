import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import apikeyService from '../../services/apikey'
import { ensureUnikMembershipResponse } from '../../services/access-control'

const ACCESS_DENIED_MESSAGE = 'Access denied: You do not have permission to access this Unik'

// Get api keys
const getAllApiKeys = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('Params from request:', req.params)
        const unikId = req.params.unikId as string
        console.log('unikId:', unikId)

        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.getAllApiKeys - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        const apiResponse = await apikeyService.getAllApiKeys(unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const createApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.createApiKey - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        if (typeof req.body === 'undefined' || !req.body.keyName) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.createApiKey - keyName not provided!`)
        }
        const apiResponse = await apikeyService.createApiKey(req.body.keyName, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Update api key
const updateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.updateApiKey - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.updateApiKey - id not provided!`)
        }
        if (typeof req.body === 'undefined' || !req.body.keyName) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.updateApiKey - keyName not provided!`)
        }
        const apiResponse = await apikeyService.updateApiKey(req.params.id, req.body.keyName, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Import Keys from JSON file
const importKeys = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.importKeys - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        if (typeof req.body === 'undefined' || !req.body.jsonFile) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.importKeys - body not provided!`)
        }
        const apiResponse = await apikeyService.importKeys(req.body, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Delete api key
const deleteApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.deleteApiKey - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.deleteApiKey - id not provided!`)
        }
        const apiResponse = await apikeyService.deleteApiKey(req.params.id, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Verify api key
const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.verifyApiKey - unikId not provided!`)
        }

        const userId = await ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: ACCESS_DENIED_MESSAGE
        })
        if (!userId) return

        if (typeof req.params === 'undefined' || !req.params.apikey) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: apikeyController.verifyApiKey - apikey not provided!`)
        }
        const apiResponse = await apikeyService.verifyApiKey(req.params.apikey, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createApiKey,
    deleteApiKey,
    getAllApiKeys,
    updateApiKey,
    verifyApiKey,
    importKeys
}
