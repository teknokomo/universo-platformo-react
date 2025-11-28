import express, { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { createApikeyService, type IApikeyService } from '@universo/flowise-apikey-srv'
import { getDataSource } from '../../DataSource'
import { appConfig } from '../../AppConfig'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

const router = express.Router()

// Lazy-initialized ApiKey service singleton for verify route
let _apikeyService: IApikeyService | null = null

function getApikeyService(): IApikeyService {
    if (!_apikeyService) {
        _apikeyService = createApikeyService({
            getDataSource,
            storageConfig: {
                type: appConfig.apiKeys.storageType as 'json' | 'db'
            }
        })
    }
    return _apikeyService
}

// Verify api key
const verifyApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unikId = req.params.unikId as string
        if (!unikId) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: verifyApiKey - unikId not provided!`)
        }

        if (typeof req.params === 'undefined' || !req.params.apikey) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: verifyApiKey - apikey not provided!`)
        }
        
        const apikeyService = getApikeyService()
        const apiResponse = await apikeyService.verifyApiKey(req.params.apikey, unikId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// READ - Route requires unikId for DB mode isolation
router.get(['/unik/:unikId/apikey/', '/unik/:unikId/apikey/:apikey'], verifyApiKey)

export default router
