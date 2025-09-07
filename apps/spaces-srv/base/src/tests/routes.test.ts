import express from 'express'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { createSpacesRoutes } from '../routes/spacesRoutes'

// Mock DataSource
const mockDataSource = {
    getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => ({
            leftJoin: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            getRawAndEntities: jest.fn().mockResolvedValue({
                entities: [],
                raw: []
            }),
            getOne: jest.fn().mockResolvedValue(null),
            getMany: jest.fn().mockResolvedValue([])
        })),
        findOne: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        delete: jest.fn().mockResolvedValue({ affected: 0 })
    })),
    transaction: jest.fn()
} as unknown as DataSource

describe('Spaces Routes Integration', () => {
    let app: express.Application

    beforeEach(() => {
        app = express()
        app.use(express.json())
        app.use('/uniks/:unikId/spaces', createSpacesRoutes(mockDataSource))
    })

    describe('Canvas Routes', () => {
        it('should handle GET /uniks/:unikId/spaces/:spaceId/canvases', async () => {
            const response = await request(app)
                .get('/uniks/test-unik/spaces/test-space/canvases')
                .expect(200)

            expect(response.body).toHaveProperty('success', true)
            expect(response.body).toHaveProperty('data')
            expect(response.body.data).toHaveProperty('canvases')
        })

        it('should handle POST /uniks/:unikId/spaces/:spaceId/canvases', async () => {
            const canvasData = {
                name: 'Test Canvas',
                flowData: '{}'
            }

            const response = await request(app)
                .post('/uniks/test-unik/spaces/test-space/canvases')
                .send(canvasData)
                .expect(404) // Space not found in mock

            expect(response.body).toHaveProperty('success', false)
        })

        it('should handle PUT /uniks/:unikId/canvases/:canvasId', async () => {
            const updateData = {
                name: 'Updated Canvas'
            }

            const response = await request(app)
                .put('/uniks/test-unik/canvases/test-canvas')
                .send(updateData)
                .expect(404) // Canvas not found in mock

            expect(response.body).toHaveProperty('success', false)
        })

        it('should handle DELETE /uniks/:unikId/canvases/:canvasId', async () => {
            const response = await request(app)
                .delete('/uniks/test-unik/canvases/test-canvas')
                .expect(404) // Canvas not found in mock

            expect(response.body).toHaveProperty('success', false)
        })

        it('should validate required parameters', async () => {
            // Missing unikId
            await request(app)
                .get('/uniks//spaces/test-space/canvases')
                .expect(404) // Route not matched

            // Missing spaceId  
            await request(app)
                .get('/uniks/test-unik/spaces//canvases')
                .expect(404) // Route not matched
        })

        it('should validate canvas name length', async () => {
            const longName = 'a'.repeat(201) // Exceeds 200 character limit
            const canvasData = {
                name: longName,
                flowData: '{}'
            }

            const response = await request(app)
                .post('/uniks/test-unik/spaces/test-space/canvases')
                .send(canvasData)
                .expect(400)

            expect(response.body).toHaveProperty('success', false)
            expect(response.body.error).toContain('200 characters or less')
        })
    })

    describe('Route Structure', () => {
        it('should have all required Canvas routes', () => {
            const router = createSpacesRoutes(mockDataSource)
            const routes = router.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path
            }))

            // Check that Canvas routes exist
            expect(routes).toContainEqual({ method: 'GET', path: '/:spaceId/canvases' })
            expect(routes).toContainEqual({ method: 'POST', path: '/:spaceId/canvases' })
            expect(routes).toContainEqual({ method: 'PUT', path: '/canvases/:canvasId' })
            expect(routes).toContainEqual({ method: 'DELETE', path: '/canvases/:canvasId' })
        })
    })
})