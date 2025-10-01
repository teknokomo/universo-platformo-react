import { Request } from 'express'
import { compareKeys } from './apiKey'
import apikeyService from '../services/apikey'
import type { CanvasFlowResult } from '@universo/spaces-srv'

/**
 * Validate Chatflow API Key
 * If req.user already has a user, return true immediately.
 * @param {Request} req
 * @param {CanvasFlowResult} chatflow
 */
export const validateChatflowAPIKey = async (req: Request, chatflow: CanvasFlowResult): Promise<boolean> => {
    if ((req as any).user) return true // Universo Platformo | If JWT authorization has already passed, skip the check

    const chatFlowApiKeyId = chatflow?.apikeyid
    if (!chatFlowApiKeyId) return true

    const authorizationHeader = (req.headers['Authorization'] as string) ?? (req.headers['authorization'] as string) ?? ''
    if (chatFlowApiKeyId && !authorizationHeader) return false

    const suppliedKey = authorizationHeader.split(`Bearer `).pop()
    if (suppliedKey) {
        const keys = await apikeyService.getAllApiKeys()
        const apiSecret = keys.find((key: any) => key.id === chatFlowApiKeyId)?.apiSecret
        if (!apiSecret) return false
        if (!compareKeys(apiSecret, suppliedKey)) return false
        return true
    }
    return false
}

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
        const keys = await apikeyService.getAllApiKeys()
        const apiSecret = keys.find((key: any) => key.apiKey === suppliedKey)?.apiSecret
        if (!apiSecret) return false
        if (!compareKeys(apiSecret, suppliedKey)) return false
        return true
    }
    return false
}
