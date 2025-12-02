import { Request, Response } from 'express'
import { ZodError } from 'zod'
import { SpacesService } from '../services/spacesService'
import { ApiResponse } from '../types'
import {
    CreateSpaceSchema,
    UpdateSpaceSchema,
    CreateCanvasSchema,
    UpdateCanvasSchema,
    CreateCanvasVersionSchema,
    UpdateCanvasVersionSchema,
    ReorderCanvasesSchema,
    extractUnikId,
    formatZodError
} from '../schemas'

export class SpacesController {
    constructor(private spacesService: SpacesService) {}

    /**
     * GET /uniks/:unikId/spaces - Get all spaces for unik
     */
    async getSpaces(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)

            if (!unikId) {
                res.status(400).json({ success: false, error: 'Unik ID is required' } as ApiResponse)
                return
            }

            console.log('[SpacesController.getSpaces] unikId:', unikId)
            const spaces = await this.spacesService.getSpacesForUnik(unikId)
            console.log('[SpacesController.getSpaces] spaces count:', Array.isArray(spaces) ? spaces.length : 'not array')

            res.json({ success: true, data: { spaces } } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error fetching spaces:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * GET /uniks/:unikId/canvases/:canvasId - Get single canvas by id
     */
    async getCanvasById(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { canvasId } = req.params

            if (!unikId || !canvasId) {
                res.status(400).json({ success: false, error: 'Unik ID and Canvas ID are required' } as ApiResponse)
                return
            }

            const canvas = await this.spacesService.getCanvasById(unikId, canvasId)

            if (!canvas) {
                res.status(404).json({ success: false, error: 'Canvas not found' } as ApiResponse)
                return
            }

            res.json(canvas)
        } catch (error) {
            console.error('[SpacesController] Error fetching canvas by id:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces - Create new space
     */
    async createSpace(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)

            if (!unikId) {
                res.status(400).json({
                    success: false,
                    error: 'Valid Unik ID is required'
                } as ApiResponse)
                return
            }

            // Validate request body with Zod
            const validatedData = CreateSpaceSchema.parse(req.body)

            const space = await this.spacesService.createSpace(unikId, validatedData)

            res.status(201).json({
                success: true,
                data: space,
                message: 'Space created successfully'
            } as ApiResponse)
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    success: false,
                    error: formatZodError(error)
                } as ApiResponse)
                return
            }
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
            const unikId = extractUnikId(req.params)
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({ success: false, error: 'Unik ID and Space ID are required' } as ApiResponse)
                return
            }

            const space = await this.spacesService.getSpaceDetails(unikId, spaceId)

            if (!space) {
                res.status(404).json({ success: false, error: 'Space not found' } as ApiResponse)
                return
            }

            res.json({ success: true, data: space } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error fetching space details:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * PUT /uniks/:unikId/spaces/:spaceId - Update space
     */
    async updateSpace(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({ success: false, error: 'Unik ID and Space ID are required' } as ApiResponse)
                return
            }

            const validatedData = UpdateSpaceSchema.parse(req.body)
            const space = await this.spacesService.updateSpace(unikId, spaceId, validatedData)

            if (!space) {
                res.status(404).json({ success: false, error: 'Space not found' } as ApiResponse)
                return
            }

            res.json({ success: true, data: space, message: 'Space updated successfully' } as ApiResponse)
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ success: false, error: formatZodError(error) } as ApiResponse)
                return
            }
            console.error('[SpacesController] Error updating space:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * DELETE /uniks/:unikId/spaces/:spaceId - Delete space
     */
    async deleteSpace(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({ success: false, error: 'Unik ID and Space ID are required' } as ApiResponse)
                return
            }

            const deleted = await this.spacesService.deleteSpace(unikId, spaceId)

            if (!deleted) {
                res.status(404).json({ success: false, error: 'Space not found' } as ApiResponse)
                return
            }

            res.json({ success: true, message: 'Space deleted successfully' } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error deleting space:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * GET /uniks/:unikId/spaces/:spaceId/canvases - Get canvases for space
     */
    async getCanvases(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({ success: false, error: 'Unik ID and Space ID are required' } as ApiResponse)
                return
            }

            const canvases = await this.spacesService.getCanvasesForSpace(unikId, spaceId)
            res.json(canvases)
        } catch (error) {
            console.error('[SpacesController] Error fetching canvases:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces/:spaceId/canvases - Create new canvas in space
     */
    async createCanvas(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({ success: false, error: 'Unik ID and Space ID are required' } as ApiResponse)
                return
            }

            const validatedData = CreateCanvasSchema.parse(req.body)
            const canvas = await this.spacesService.createCanvas(unikId, spaceId, validatedData)

            if (!canvas) {
                res.status(404).json({ success: false, error: 'Space not found' } as ApiResponse)
                return
            }

            res.status(201).json(canvas)
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ success: false, error: formatZodError(error) } as ApiResponse)
                return
            }
            console.error('[SpacesController] Error creating canvas:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * PUT /uniks/:unikId/canvases/:canvasId - Update canvas
     */
    async updateCanvas(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { canvasId } = req.params

            if (!unikId || !canvasId) {
                res.status(400).json({ success: false, error: 'Unik ID and Canvas ID are required' } as ApiResponse)
                return
            }

            const validatedData = UpdateCanvasSchema.parse(req.body)
            const canvas = await this.spacesService.updateCanvas(unikId, canvasId, validatedData)

            if (!canvas) {
                res.status(404).json({ success: false, error: 'Canvas not found' } as ApiResponse)
                return
            }

            res.json(canvas)
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ success: false, error: formatZodError(error) } as ApiResponse)
                return
            }
            console.error('[SpacesController] Error updating canvas:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * DELETE /uniks/:unikId/canvases/:canvasId - Delete canvas
     */
    async deleteCanvas(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { canvasId } = req.params

            if (!unikId || !canvasId) {
                res.status(400).json({ success: false, error: 'Unik ID and Canvas ID are required' } as ApiResponse)
                return
            }

            const deleted = await this.spacesService.deleteCanvas(unikId, canvasId)

            if (!deleted) {
                res.status(404).json({ success: false, error: 'Canvas not found' } as ApiResponse)
                return
            }

            res.status(204).send()
        } catch (error) {
            if (error instanceof Error && error.message.includes('Cannot delete the last canvas')) {
                res.status(400).json({ success: false, error: error.message } as ApiResponse)
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
            const unikId = extractUnikId(req.params)
            const { spaceId, canvasId } = req.params

            if (!unikId || !spaceId || !canvasId) {
                res.status(400).json({ success: false, error: 'Unik ID, Space ID, and Canvas ID are required' } as ApiResponse)
                return
            }

            const versions = await this.spacesService.getCanvasVersions(unikId, spaceId, canvasId)

            if (!versions) {
                res.status(404).json({ success: false, error: 'Canvas not found' } as ApiResponse)
                return
            }

            res.json({ success: true, data: { versions } } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error fetching canvas versions:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions - Create a new canvas version
     */
    async createCanvasVersion(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId, canvasId } = req.params

            if (!unikId || !spaceId || !canvasId) {
                res.status(400).json({ success: false, error: 'Unik ID, Space ID, and Canvas ID are required' } as ApiResponse)
                return
            }

            const validatedData = CreateCanvasVersionSchema.parse(req.body)
            const version = await this.spacesService.createCanvasVersion(unikId, spaceId, canvasId, validatedData)

            if (!version) {
                res.status(404).json({ success: false, error: 'Canvas not found' } as ApiResponse)
                return
            }

            res.status(201).json({ success: true, data: version, message: 'Canvas version created successfully' } as ApiResponse)
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ success: false, error: formatZodError(error) } as ApiResponse)
                return
            }
            console.error('[SpacesController] Error creating canvas version:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * PUT /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId - Update version metadata
     */
    async updateCanvasVersion(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId, canvasId, versionId } = req.params

            if (!unikId || !spaceId || !canvasId || !versionId) {
                res.status(400).json({ success: false, error: 'Unik ID, Space ID, Canvas ID, and Version ID are required' } as ApiResponse)
                return
            }

            const validatedData = UpdateCanvasVersionSchema.parse(req.body)
            
            if (Object.keys(validatedData).length === 0) {
                res.status(400).json({ success: false, error: 'No fields provided for update' } as ApiResponse)
                return
            }

            const version = await this.spacesService.updateCanvasVersion(unikId, spaceId, canvasId, versionId, validatedData)

            if (!version) {
                res.status(404).json({ success: false, error: 'Canvas version not found' } as ApiResponse)
                return
            }

            res.json({ success: true, data: version, message: 'Canvas version updated successfully' } as ApiResponse)
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ success: false, error: formatZodError(error) } as ApiResponse)
                return
            }
            console.error('[SpacesController] Error updating canvas version:', error)
            const status = error instanceof Error ? 400 : 500
            res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * POST /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId/activate - Activate a version
     */
    async activateCanvasVersion(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId, canvasId, versionId } = req.params

            if (!unikId || !spaceId || !canvasId || !versionId) {
                res.status(400).json({ success: false, error: 'Unik ID, Space ID, Canvas ID, and Version ID are required' } as ApiResponse)
                return
            }

            const canvas = await this.spacesService.activateCanvasVersion(unikId, spaceId, canvasId, versionId)

            if (!canvas) {
                res.status(404).json({ success: false, error: 'Canvas version not found' } as ApiResponse)
                return
            }

            res.json({ success: true, data: canvas, message: 'Canvas version activated successfully' } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error activating canvas version:', error)
            const status = error instanceof Error ? 400 : 500
            res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * DELETE /uniks/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId - Delete a version
     */
    async deleteCanvasVersion(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId, canvasId, versionId } = req.params

            if (!unikId || !spaceId || !canvasId || !versionId) {
                res.status(400).json({ success: false, error: 'Unik ID, Space ID, Canvas ID, and Version ID are required' } as ApiResponse)
                return
            }

            const deleted = await this.spacesService.deleteCanvasVersion(unikId, spaceId, canvasId, versionId)

            if (!deleted) {
                res.status(404).json({ success: false, error: 'Canvas version not found' } as ApiResponse)
                return
            }

            res.json({ success: true, message: 'Canvas version deleted successfully' } as ApiResponse)
        } catch (error) {
            console.error('[SpacesController] Error deleting canvas version:', error)
            const status = error instanceof Error ? 400 : 500
            res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }

    /**
     * PUT /uniks/:unikId/spaces/:spaceId/canvases/reorder - Reorder canvases
     */
    async reorderCanvases(req: Request, res: Response): Promise<void> {
        try {
            const unikId = extractUnikId(req.params)
            const { spaceId } = req.params

            if (!unikId || !spaceId) {
                res.status(400).json({ success: false, error: 'Unik ID and Space ID are required' } as ApiResponse)
                return
            }

            const validatedData = ReorderCanvasesSchema.parse(req.body)
            const success = await this.spacesService.reorderCanvases(unikId, spaceId, validatedData)

            if (!success) {
                res.status(404).json({ success: false, error: 'Space not found' } as ApiResponse)
                return
            }

            res.json({ message: 'Canvases reordered successfully' })
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ success: false, error: formatZodError(error) } as ApiResponse)
                return
            }
            console.error('[SpacesController] Error reordering canvases:', error)
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' } as ApiResponse)
        }
    }
}
