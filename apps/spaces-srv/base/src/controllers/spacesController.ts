import { Request, Response } from 'express'
import { SpacesService } from '../services/spacesService'
import {
    CreateSpaceDto,
    UpdateSpaceDto,
    CreateCanvasDto,
    UpdateCanvasDto,
    ReorderCanvasesDto,
    ApiResponse,
    CreateCanvasVersionDto,
    ChatflowType
} from '../types'

export class SpacesController {
    constructor(private spacesService: SpacesService) { }

    /**
     * GET /uniks/:unikId/spaces - Get all spaces for unik
     */
    async getSpaces(req: Request, res: Response): Promise<void> {
        try {
            // Fallback: support either :unikId (preferred) or legacy :id param from mount
            const unikId = (req.params.unikId || req.params.id) as string

            if (!unikId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID is required'
                } as ApiResponse)
                return
            }

            console.log('[SpacesController.getSpaces] unikId:', unikId)
            const spaces = await this.spacesService.getSpacesForUnik(unikId)
            console.log('[SpacesController.getSpaces] spaces count:', Array.isArray(spaces) ? spaces.length : 'not array', 'sample:', spaces?.[0])

            res.json({
                success: true,
                data: { spaces }
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error fetching spaces:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * GET /uniks/:unikId/canvases/:canvasId - Get single canvas by id
     */
    async getCanvasById(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { canvasId } = req.params

            if (!unikId || !canvasId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Canvas ID are required'
                } as ApiResponse)
                return
            }

            const canvas = await this.spacesService.getCanvasById(unikId, canvasId)

            if (!canvas) {
                res.status(404).json({
                    success: false,
                    error: 'Canvas not found'
                } as ApiResponse)
                return
            }

            // Return canvas directly for compatibility with frontend expectations
            res.json(canvas)
        } catch (error) {
            console.error('[SpacesController] Error fetching canvas by id:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces - Create new space
     */
    async createSpace(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const spaceData: CreateSpaceDto = req.body

            if (!unikId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID is required'
                } as ApiResponse)
                return
            }

            const trimmedName = spaceData.name?.trim()
            if (!trimmedName || trimmedName.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Space name is required'
                } as ApiResponse)
                return
            }

            if (trimmedName.length > 200) {
                res.status(400).json({
                    success: false,
                    error: 'Space name must be 200 characters or less'
                } as ApiResponse)
                return
            }

            if (spaceData.description && spaceData.description.length > 2000) {
                res.status(400).json({
                    success: false,
                    error: 'Space description must be 2000 characters or less'
                } as ApiResponse)
                return
            }

            const trimmedCanvasName = typeof spaceData.defaultCanvasName === 'string' ? spaceData.defaultCanvasName.trim() : undefined
            if (trimmedCanvasName && trimmedCanvasName.length > 200) {
                res.status(400).json({
                    success: false,
                    error: 'Canvas name must be 200 characters or less'
                } as ApiResponse)
                return
            }

            const payload: CreateSpaceDto = {
                ...spaceData,
                name: trimmedName,
                defaultCanvasName: trimmedCanvasName,
                defaultCanvasFlowData: typeof spaceData.defaultCanvasFlowData === 'string' ? spaceData.defaultCanvasFlowData : undefined
            }

            const space = await this.spacesService.createSpace(unikId, payload)

            res.status(201).json({
                success: true,
                data: space,
                message: 'Space created successfully'
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error creating space:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * GET /uniks/:unikId/spaces/:spaceId - Get space details with canvases
     */
    async getSpaceDetails(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Space ID are required'
                } as ApiResponse)
                return
            }

            const space = await this.spacesService.getSpaceDetails(unikId, spaceId)

            if (!space) {
                res.status(404).json({
                    success: false,
                    error: 'Space not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                data: space
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error fetching space details:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * PUT /uniks/:unikId/spaces/:spaceId - Update space
     */
    async updateSpace(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId } = req.params
            const updateData: UpdateSpaceDto = req.body

            if (!unikId || !spaceId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Space ID are required'
                } as ApiResponse)
                return
            }

            if (updateData.name !== undefined) {
                if (!updateData.name || updateData.name.trim().length === 0) {
                    res.status(400).json({
                        success: false,
                        error: 'Space name cannot be empty'
                    } as ApiResponse)
                    return
                }

                if (updateData.name.length > 200) {
                    res.status(400).json({
                        success: false,
                        error: 'Space name must be 200 characters or less'
                    } as ApiResponse)
                    return
                }
            }

            if (updateData.description && updateData.description.length > 2000) {
                res.status(400).json({
                    success: false,
                    error: 'Space description must be 2000 characters or less'
                } as ApiResponse)
                return
            }

            const space = await this.spacesService.updateSpace(unikId, spaceId, updateData)

            if (!space) {
                res.status(404).json({
                    success: false,
                    error: 'Space not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                data: space,
                message: 'Space updated successfully'
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error updating space:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * DELETE /uniks/:unikId/spaces/:spaceId - Delete space
     */
    async deleteSpace(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Space ID are required'
                } as ApiResponse)
                return
            }

            const deleted = await this.spacesService.deleteSpace(unikId, spaceId)

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: 'Space not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                message: 'Space deleted successfully'
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error deleting space:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * GET /uniks/:unikId/spaces/:spaceId/canvases - Get canvases for space
     */
    async getCanvases(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Space ID are required'
                } as ApiResponse)
                return
            }

            const canvases = await this.spacesService.getCanvasesForSpace(unikId, spaceId)
            // Return plain array for simpler client handling
            res.json(canvases)
        } catch (error) {
            console.error('[SpacesController] Error fetching canvases:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces/:spaceId/canvases - Create new canvas in space
     */
    async createCanvas(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId } = req.params
            const canvasData: CreateCanvasDto = req.body

            if (!unikId || !spaceId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Space ID are required'
                } as ApiResponse)
                return
            }

            if (canvasData.name && canvasData.name.length > 200) {
                res.status(400).json({
                    success: false,
                    error: 'Canvas name must be 200 characters or less'
                } as ApiResponse)
                return
            }

            const canvas = await this.spacesService.createCanvas(unikId, spaceId, canvasData)

            if (!canvas) {
                res.status(404).json({
                    success: false,
                    error: 'Space not found'
                } as ApiResponse)
                return
            }

            // Return created canvas object directly
            res.status(201).json(canvas)
        } catch (error) {
            console.error('[SpacesController] Error creating canvas:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * PUT /uniks/:unikId/canvases/:canvasId - Update canvas
     */
    async updateCanvas(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { canvasId } = req.params
            const updateData: UpdateCanvasDto = req.body

            if (!unikId || !canvasId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Canvas ID are required'
                } as ApiResponse)
                return
            }

            if (updateData.name !== undefined) {
                if (!updateData.name || updateData.name.trim().length === 0) {
                    res.status(400).json({
                        success: false,
                        error: 'Canvas name cannot be empty'
                    } as ApiResponse)
                    return
                }

                if (updateData.name.length > 200) {
                    res.status(400).json({
                        success: false,
                        error: 'Canvas name must be 200 characters or less'
                    } as ApiResponse)
                    return
                }
            }

            const canvas = await this.spacesService.updateCanvas(unikId, canvasId, updateData)

            if (!canvas) {
                res.status(404).json({
                    success: false,
                    error: 'Canvas not found'
                } as ApiResponse)
                return
            }

            // Return updated canvas directly
            res.json(canvas)
        } catch (error) {
            console.error('[SpacesController] Error updating canvas:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * DELETE /uniks/:unikId/canvases/:canvasId - Delete canvas
     */
    async deleteCanvas(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { canvasId } = req.params

            if (!unikId || !canvasId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Canvas ID are required'
                } as ApiResponse)
                return
            }

            const deleted = await this.spacesService.deleteCanvas(unikId, canvasId)

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: 'Canvas not found'
                } as ApiResponse)
                return
            }

            res.status(204).send()
        } catch (error) {
            if (error instanceof Error && error.message.includes('Cannot delete the last canvas')) {
                res.status(400).json({
                    success: false,
                    error: error.message
                } as ApiResponse)
                return
            }

            console.error('[SpacesController] Error deleting canvas:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * GET /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions - List canvas versions
     */
    async getCanvasVersions(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId, canvasId } = req.params

            if (!unikId || !spaceId || !canvasId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID, Space ID, and Canvas ID are required'
                } as ApiResponse)
                return
            }

            const versions = await this.spacesService.getCanvasVersions(unikId, spaceId, canvasId)

            if (!versions) {
                res.status(404).json({
                    success: false,
                    error: 'Canvas not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                data: { versions }
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error fetching canvas versions:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions - Create a new canvas version
     */
    async createCanvasVersion(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId, canvasId } = req.params

            if (!unikId || !spaceId || !canvasId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID, Space ID, and Canvas ID are required'
                } as ApiResponse)
                return
            }

            const payload: CreateCanvasVersionDto = {
                label: typeof req.body?.label === 'string' ? req.body.label.trim() || undefined : undefined,
                description: typeof req.body?.description === 'string' ? req.body.description.trim() || undefined : undefined,
                activate: Boolean(req.body?.activate)
            }

            if (payload.label && payload.label.length > 200) {
                res.status(400).json({
                    success: false,
                    error: 'Version label must be 200 characters or less'
                } as ApiResponse)
                return
            }

            if (payload.description && payload.description.length > 2000) {
                res.status(400).json({
                    success: false,
                    error: 'Version description must be 2000 characters or less'
                } as ApiResponse)
                return
            }

            const version = await this.spacesService.createCanvasVersion(unikId, spaceId, canvasId, payload)

            if (!version) {
                res.status(404).json({
                    success: false,
                    error: 'Canvas not found'
                } as ApiResponse)
                return
            }

            res.status(201).json({
                success: true,
                data: version,
                message: 'Canvas version created successfully'
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error creating canvas version:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId/activate - Activate a version
     */
    async activateCanvasVersion(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId, canvasId, versionId } = req.params

            if (!unikId || !spaceId || !canvasId || !versionId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID, Space ID, Canvas ID, and Version ID are required'
                } as ApiResponse)
                return
            }

            const canvas = await this.spacesService.activateCanvasVersion(unikId, spaceId, canvasId, versionId)

            if (!canvas) {
                res.status(404).json({
                    success: false,
                    error: 'Canvas version not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                data: canvas,
                message: 'Canvas version activated successfully'
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error activating canvas version:', error)
            const status = error instanceof Error ? 400 : 500
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * DELETE /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId - Delete a version
     */
    async deleteCanvasVersion(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId, canvasId, versionId } = req.params

            if (!unikId || !spaceId || !canvasId || !versionId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID, Space ID, Canvas ID, and Version ID are required'
                } as ApiResponse)
                return
            }

            const deleted = await this.spacesService.deleteCanvasVersion(unikId, spaceId, canvasId, versionId)

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: 'Canvas version not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                message: 'Canvas version deleted successfully'
            } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error deleting canvas version:', error)
            const status = error instanceof Error ? 400 : 500
            res.status(status).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    /**
     * PUT /uniks/:unikId/spaces/:spaceId/canvases/reorder - Reorder canvases
     */
    async reorderCanvases(req: Request, res: Response): Promise<void> {
        try {
            const unikId = (req.params.unikId || req.params.id) as string
            const { spaceId } = req.params
            const reorderData: ReorderCanvasesDto = req.body

            if (!unikId || !spaceId) {
                res.status(400).json({
                    success: false,
                    error: 'Unik ID and Space ID are required'
                } as ApiResponse)
                return
            }

            if (!reorderData.canvasOrders || !Array.isArray(reorderData.canvasOrders)) {
                res.status(400).json({
                    success: false,
                    error: 'Canvas orders array is required'
                } as ApiResponse)
                return
            }

            // Validate canvas orders
            for (const order of reorderData.canvasOrders) {
                if (!order.canvasId || typeof order.sortOrder !== 'number' || order.sortOrder < 1) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid canvas order data'
                    } as ApiResponse)
                    return
                }
            }

            const success = await this.spacesService.reorderCanvases(unikId, spaceId, reorderData)

            if (!success) {
                res.status(404).json({
                    success: false,
                    error: 'Space not found'
                } as ApiResponse)
                return
            }

            res.json({ message: 'Canvases reordered successfully' })
        } catch (error) {
            console.error('[SpacesController] Error reordering canvases:', error)
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }
}
