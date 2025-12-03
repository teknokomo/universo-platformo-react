import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { Canvas } from '../database/entities/Canvas'
import { CanvasServiceAdapter } from '../services/canvasServiceFactory'
import { CanvasType } from '../types'

const DEFAULT_ACCESS_DENIED_MESSAGE = 'Access denied: You do not have permission to access this canvas'

export interface RateLimiterManagerLike {
    updateRateLimiter: (canvas: any) => Promise<void>
}

export interface CanvasControllerOptions {
    apiKeyService?: {
        getApiKey: (key: string) => Promise<{ id: string } | null | undefined>
    }
    membership?: {
        ensureUnikMembershipResponse: (
            req: Request,
            res: Response,
            unikId: string,
            options?: { errorMessage?: string }
        ) => Promise<string | undefined>
        accessDeniedMessage?: string
    }
}

export class CanvasController {
    constructor(
        private readonly canvasService: CanvasServiceAdapter,
        private readonly rateLimiterManager?: RateLimiterManagerLike,
        private readonly options?: CanvasControllerOptions
    ) {}

    private async ensureUnikMembership(req: Request, res: Response, unikId: string): Promise<string | undefined> {
        if (!this.options?.membership?.ensureUnikMembershipResponse) {
            return undefined
        }

        return this.options.membership.ensureUnikMembershipResponse(req, res, unikId, {
            errorMessage: this.options.membership.accessDeniedMessage ?? DEFAULT_ACCESS_DENIED_MESSAGE
        })
    }

    private resolveUnikId(req: Request): string | undefined {
        return (req.params.unikId || (req.params as any).id) as string | undefined
    }

    private resolveCanvasId(req: Request): string | undefined {
        return (req.params.canvasId || (req.params as any).id) as string | undefined
    }

    private resolveSpaceId(req: Request): string | undefined {
        return req.params.spaceId as string | undefined
    }

    private routeRequiresSpace(req: Request): boolean {
        return Object.prototype.hasOwnProperty.call(req.params, 'spaceId')
    }

    private resolveScope(req: Request): { unikId?: string; spaceId?: string } {
        const scope: { unikId?: string; spaceId?: string } = {}
        const unikId = this.resolveUnikId(req)
        const spaceId = this.resolveSpaceId(req)

        if (unikId) {
            scope.unikId = unikId
        }

        if (spaceId) {
            scope.spaceId = spaceId
        }

        return scope
    }

    async checkIfCanvasIsValidForStreaming(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const canvasId = this.resolveCanvasId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)
            if (!canvasId) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'canvasId param is required'
                })
                return
            }

            if (expectsSpace && !spaceId) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'spaceId param is required'
                })
                return
            }

            const scope = this.resolveScope(req)
            const result = await this.canvasService.checkIfCanvasIsValidForStreaming(canvasId, scope)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    async checkIfCanvasIsValidForUploads(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const canvasId = this.resolveCanvasId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)
            if (!canvasId) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'canvasId param is required'
                })
                return
            }

            if (expectsSpace && !spaceId) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'spaceId param is required'
                })
                return
            }

            const scope = this.resolveScope(req)
            const result = await this.canvasService.checkIfCanvasIsValidForUploads(canvasId, scope)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    async deleteCanvas(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const canvasId = this.resolveCanvasId(req)
            const unikId = this.resolveUnikId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)

            if (!canvasId || !unikId || (expectsSpace && !spaceId)) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: expectsSpace ? 'canvasId, spaceId, and unikId params are required' : 'canvasId and unikId params are required'
                })
                return
            }

            const userId = await this.ensureUnikMembership(req, res, unikId)
            if (this.options?.membership?.ensureUnikMembershipResponse && !userId) {
                return
            }

            const scope = this.resolveScope(req)
            const response = await this.canvasService.deleteCanvas(canvasId, scope)
            res.json(response)
        } catch (error) {
            next(error)
        }
    }

    async getAllCanvases(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const unikId = this.resolveUnikId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)
            if (!unikId) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'unikId param is required'
                })
                return
            }

            if (expectsSpace && !spaceId) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'spaceId param is required'
                })
                return
            }

            const userId = await this.ensureUnikMembership(req, res, unikId)
            if (this.options?.membership?.ensureUnikMembershipResponse && !userId) {
                return
            }

            const type = (req.query?.type as CanvasType) || undefined
            const canvases = await this.canvasService.getAllCanvases({ unikId, spaceId, type })
            console.log('[CanvasController.getAllCanvases] Result:', {
                unikId,
                spaceId,
                type,
                canvasesCount: Array.isArray(canvases) ? canvases.length : (canvases as any)?.canvases?.length || 0,
                firstCanvasId: Array.isArray(canvases) && canvases.length > 0 ? canvases[0].id : null,
                responseKeys: canvases ? Object.keys(canvases) : [],
                isArray: Array.isArray(canvases),
                responseType: typeof canvases,
                firstCanvasName: Array.isArray(canvases) && canvases.length > 0 ? canvases[0].name : null
            })
            // Wrap array response to match CanvasListResponse type
            const response = Array.isArray(canvases) ? { canvases, total: canvases.length } : canvases
            res.json(response)
        } catch (error) {
            next(error)
        }
    }

    async getCanvasByApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { apikey } = req.params
            if (!apikey) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'apikey param is required'
                })
                return
            }

            const keyOnly = typeof req.query.keyonly === 'string' ? req.query.keyonly : undefined
            if (!this.options?.apiKeyService?.getApiKey) {
                res.status(StatusCodes.UNAUTHORIZED).send('Unauthorized')
                return
            }

            const apiKeyRecord = await this.options.apiKeyService.getApiKey(apikey)
            if (!apiKeyRecord) {
                res.status(StatusCodes.UNAUTHORIZED).send('Unauthorized')
                return
            }

            const canvases = await this.canvasService.getCanvasByApiKey(apiKeyRecord.id, keyOnly)
            res.json(canvases)
        } catch (error) {
            next(error)
        }
    }

    async getCanvasById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const canvasId = this.resolveCanvasId(req)
            const unikId = this.resolveUnikId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)
            if (!canvasId || !unikId || (expectsSpace && !spaceId)) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: expectsSpace ? 'canvasId, spaceId, and unikId params are required' : 'canvasId and unikId params are required'
                })
                return
            }

            const userId = await this.ensureUnikMembership(req, res, unikId)
            if (this.options?.membership?.ensureUnikMembershipResponse && !userId) {
                return
            }

            const scope = this.resolveScope(req)
            const canvas = await this.canvasService.getCanvasById(canvasId, scope)

            res.json(canvas)
        } catch (error) {
            next(error)
        }
    }

    async saveCanvas(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const body = req.body as Partial<Canvas>
            const unikId = this.resolveUnikId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)
            if (!body || !unikId || (expectsSpace && !spaceId)) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: expectsSpace
                        ? 'Request body, spaceId, and unikId params are required'
                        : 'Request body and unikId param are required'
                })
                return
            }

            const userId = await this.ensureUnikMembership(req, res, unikId)
            if (this.options?.membership?.ensureUnikMembershipResponse && !userId) {
                return
            }

            if (!(body as any).unik) {
                ;(body as any).unik = { id: unikId }
            }

            if (!(body as any).unik_id) {
                ;(body as any).unik_id = unikId
            }

            const scope = this.resolveScope(req)
            const saved = await this.canvasService.saveCanvas(body, scope)
            res.json(saved)
        } catch (error) {
            next(error)
        }
    }

    async importCanvases(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const unikId = this.resolveUnikId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)
            if (!unikId || (expectsSpace && !spaceId)) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: expectsSpace ? 'unikId and spaceId params are required' : 'unikId param is required'
                })
                return
            }

            const userId = await this.ensureUnikMembership(req, res, unikId)
            if (this.options?.membership?.ensureUnikMembershipResponse && !userId) {
                return
            }

            const canvases: Partial<Canvas>[] = req.body?.canvases || req.body?.Chatflows || []
            if (!Array.isArray(canvases)) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'Payload must include canvases array'
                })
                return
            }

            const scope = this.resolveScope(req)
            const result = await this.canvasService.importCanvases(canvases, scope)
            res.json(result)
        } catch (error) {
            next(error)
        }
    }

    async updateCanvas(req: Request, res: Response, next: NextFunction): Promise<void> {
        console.log('[CanvasController.updateCanvas] START', {
            path: req.path,
            method: req.method,
            params: req.params,
            bodyKeys: Object.keys(req.body || {}),
            hasFlowData: !!req.body?.flowData,
            flowDataLength: req.body?.flowData?.length
        })

        try {
            const canvasId = this.resolveCanvasId(req)
            const unikId = this.resolveUnikId(req)
            const expectsSpace = this.routeRequiresSpace(req)
            const spaceId = this.resolveSpaceId(req)

            console.log('[CanvasController.updateCanvas] Resolved params', {
                canvasId,
                unikId,
                spaceId,
                expectsSpace
            })

            if (!canvasId || !unikId || (expectsSpace && !spaceId)) {
                console.error('[CanvasController.updateCanvas] Missing required params', {
                    hasCanvasId: !!canvasId,
                    hasUnikId: !!unikId,
                    hasSpaceId: !!spaceId,
                    expectsSpace
                })
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: expectsSpace ? 'canvasId, spaceId, and unikId params are required' : 'canvasId and unikId params are required'
                })
                return
            }

            console.log('[CanvasController.updateCanvas] Ensuring unik membership')
            const userId = await this.ensureUnikMembership(req, res, unikId)
            if (this.options?.membership?.ensureUnikMembershipResponse && !userId) {
                console.error('[CanvasController.updateCanvas] Unik membership check failed')
                return
            }
            console.log('[CanvasController.updateCanvas] Unik membership confirmed, userId:', userId)

            const updateData = req.body as Partial<Canvas>
            const scope = this.resolveScope(req)
            console.log('[CanvasController.updateCanvas] Calling canvasService.updateCanvas', {
                canvasId,
                updateDataKeys: Object.keys(updateData),
                scope
            })

            const updated = await this.canvasService.updateCanvas(canvasId, updateData, scope)

            console.log('[CanvasController.updateCanvas] Canvas updated successfully', {
                updatedId: updated.id,
                updatedName: updated.name
            })

            if (this.rateLimiterManager) {
                console.log('[CanvasController.updateCanvas] Updating rate limiter')
                await this.rateLimiterManager.updateRateLimiter(updated)
            }

            console.log('[CanvasController.updateCanvas] Sending response')
            res.json(updated)
        } catch (error) {
            console.error('[CanvasController.updateCanvas] ERROR', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            })
            next(error)
        }
    }

    async getSinglePublicCanvas(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { canvasId } = req.params
            if (!canvasId) {
                res.status(StatusCodes.PRECONDITION_FAILED).json({
                    error: 'canvasId param is required'
                })
                return
            }

            const canvas = await this.canvasService.getSinglePublicCanvas(canvasId)
            res.json(canvas)
        } catch (error) {
            next(error)
        }
    }
}
