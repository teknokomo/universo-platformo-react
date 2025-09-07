import { SpacesController } from '../controllers/spacesController'
import { SpacesService } from '../services/spacesService'
import { Request, Response } from 'express'
import { DataSource } from 'typeorm'

// Mock DataSource for testing
const mockDataSource = {
    getRepository: jest.fn(),
    transaction: jest.fn()
} as unknown as DataSource

// Mock SpacesService
const mockSpacesService = {
    getCanvasesForSpace: jest.fn(),
    createCanvas: jest.fn(),
    updateCanvas: jest.fn(),
    deleteCanvas: jest.fn()
} as unknown as SpacesService

describe('SpacesController Canvas API', () => {
    let controller: SpacesController
    let mockRequest: Partial<Request>
    let mockResponse: Partial<Response>

    beforeEach(() => {
        controller = new SpacesController(mockSpacesService)
        mockRequest = {
            params: {},
            body: {}
        }
        mockResponse = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn()
        }
    })

    describe('GET /api/v1/spaces/:id/canvases', () => {
        it('should return canvases for a space', async () => {
            const mockCanvases = [
                {
                    id: 'canvas-1',
                    name: 'Canvas 1',
                    sortOrder: 1,
                    flowData: '{}',
                    deployed: false,
                    isPublic: false,
                    createdDate: new Date(),
                    updatedDate: new Date()
                }
            ]

            mockRequest.params = { unikId: 'unik-1', spaceId: 'space-1' }
                ; (mockSpacesService.getCanvasesForSpace as jest.Mock).mockResolvedValue(mockCanvases)

            await controller.getCanvases(mockRequest as Request, mockResponse as Response)

            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: { canvases: mockCanvases }
            })
        })

        it('should return 400 if unikId or spaceId is missing', async () => {
            mockRequest.params = { unikId: 'unik-1' } // Missing spaceId

            await controller.getCanvases(mockRequest as Request, mockResponse as Response)

            expect(mockResponse.status).toHaveBeenCalledWith(400)
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Unik ID and Space ID are required'
            })
        })
    })

    describe('POST /api/v1/spaces/:id/canvases', () => {
        it('should create a new canvas', async () => {
            const mockCanvas = {
                id: 'canvas-1',
                name: 'New Canvas',
                sortOrder: 1,
                flowData: '{}',
                deployed: false,
                isPublic: false,
                createdDate: new Date(),
                updatedDate: new Date()
            }

            mockRequest.params = { unikId: 'unik-1', spaceId: 'space-1' }
            mockRequest.body = { name: 'New Canvas' }
                ; (mockSpacesService.createCanvas as jest.Mock).mockResolvedValue(mockCanvas)

            await controller.createCanvas(mockRequest as Request, mockResponse as Response)

            expect(mockResponse.status).toHaveBeenCalledWith(201)
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockCanvas,
                message: 'Canvas created successfully'
            })
        })
    })

    describe('PUT /api/v1/canvases/:id', () => {
        it('should update a canvas', async () => {
            const mockCanvas = {
                id: 'canvas-1',
                name: 'Updated Canvas',
                sortOrder: 1,
                flowData: '{}',
                deployed: false,
                isPublic: false,
                createdDate: new Date(),
                updatedDate: new Date()
            }

            mockRequest.params = { unikId: 'unik-1', canvasId: 'canvas-1' }
            mockRequest.body = { name: 'Updated Canvas' }
                ; (mockSpacesService.updateCanvas as jest.Mock).mockResolvedValue(mockCanvas)

            await controller.updateCanvas(mockRequest as Request, mockResponse as Response)

            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockCanvas,
                message: 'Canvas updated successfully'
            })
        })
    })

    describe('DELETE /api/v1/canvases/:id', () => {
        it('should delete a canvas', async () => {
            mockRequest.params = { unikId: 'unik-1', canvasId: 'canvas-1' }
                ; (mockSpacesService.deleteCanvas as jest.Mock).mockResolvedValue(true)

            await controller.deleteCanvas(mockRequest as Request, mockResponse as Response)

            expect(mockResponse.status).toHaveBeenCalledWith(204)
            expect(mockResponse.send).toHaveBeenCalled()
        })

        it('should return 404 if canvas not found', async () => {
            mockRequest.params = { unikId: 'unik-1', canvasId: 'canvas-1' }
                ; (mockSpacesService.deleteCanvas as jest.Mock).mockResolvedValue(false)

            await controller.deleteCanvas(mockRequest as Request, mockResponse as Response)

            expect(mockResponse.status).toHaveBeenCalledWith(404)
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Canvas not found'
            })
        })
    })
})