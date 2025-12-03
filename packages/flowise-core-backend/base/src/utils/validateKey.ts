import { Request } from 'express'
import { compareKeys, createApikeyService, type IApikeyService, type ApikeyStorageConfig } from '@flowise/apikey-backend'
import { getDataSource } from '../DataSource'
import { appConfig } from '../AppConfig'
import type { CanvasFlowResult } from '@universo/spaces-backend'

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
        // Use getApiKeyById to find key by canvas.apikeyid - works without unikId
        const apiKey = await apikeyService.getApiKeyById(canvasApiKeyId)
        if (!apiKey?.apiSecret) return false
        if (!compareKeys(apiKey.apiSecret, suppliedKey)) return false
        return true
    }
    return false
}

/**
 * Validate API Key
 * If req.user already has a user (i.e. JWT passed), return true.
 * Used as fallback authentication when JWT is missing or invalid.
 * @param {Request} req
 */
export const validateAPIKey = async (req: Request): Promise<boolean> => {
    if ((req as any).user) return true // Universo Platformo | If JWT authorization has already passed, skip the check

    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (!authorizationHeader) return false

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (suppliedKey) {
        const apikeyService = getApikeyService()
        // Try to extract unikId from request params for unik-scoped routes
        const unikId = (req.params?.unikId || req.params?.id) as string | undefined
        // Find API key by the supplied key value
        const apiKey = await apikeyService.getApiKey(suppliedKey, unikId)
        if (!apiKey) return false
        // Verify the supplied key matches the stored secret
        if (!compareKeys(apiKey.apiSecret, suppliedKey)) return false
        return true
    }
    return false
}
