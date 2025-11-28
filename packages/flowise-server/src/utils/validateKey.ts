import { Request } from 'express'
import { compareKeys, createApikeyService, type IApikeyService, type ApikeyStorageConfig } from '@universo/flowise-apikey-srv'
import { getDataSource } from '../DataSource'
import { appConfig } from '../AppConfig'
import type { CanvasFlowResult } from '@universo/spaces-srv'

/**
 * Lazy-initialized ApiKey service singleton for validation utilities
 */
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

/**
 * Validate Canvas API Key
 * If req.user already has a user, return true immediately.
 * @param {Request} req
 * @param {CanvasFlowResult} canvas
 */
export const validateCanvasApiKey = async (req: Request, canvas: CanvasFlowResult): Promise<boolean> => {
    if ((req as any).user) return true // Universo Platformo | If JWT authorization has already passed, skip the check

    const canvasApiKeyId = canvas?.apikeyid
    if (!canvasApiKeyId) return true

    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (canvasApiKeyId && !authorizationHeader) return false

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (suppliedKey) {
        const apikeyService = getApikeyService()
        const keys = await apikeyService.getAllApiKeys()
        const apiSecret = keys.find((key: any) => key.id === canvasApiKeyId)?.apiSecret
        if (!apiSecret) return false
        if (!compareKeys(apiSecret, suppliedKey)) return false
        return true
    }
    return false
}

// Legacy alias for backward compatibility
export const validateChatflowAPIKey = validateCanvasApiKey

/**
 * Validate API Key
 * If req.user already has a user (i.e. JWT passed), return true.
 * @param {Request} req
 */
export const validateAPIKey = async (req: Request): Promise<boolean> => {
    if ((req as any).user) return true // Universo Platformo | If JWT authorization has already passed, skip the check

    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (!authorizationHeader) return false

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (suppliedKey) {
        const apikeyService = getApikeyService()
        const keys = await apikeyService.getAllApiKeys()
        const apiSecret = keys.find((key: any) => key.apiKey === suppliedKey)?.apiSecret
        if (!apiSecret) return false
        if (!compareKeys(apiSecret, suppliedKey)) return false
        return true
    }
    return false
}
