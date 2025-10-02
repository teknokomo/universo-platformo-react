import 'reflect-metadata'
import express = require('express')
import request = require('supertest')
import { EntityManager } from 'typeorm'
import { createSpacesRoutes } from '@/routes/spacesRoutes'
import { CanvasLegacyController } from '@/controllers/canvasLegacyController'
import { createCanvasFixture, createSpaceFixture, createSpaceCanvasFixture } from '@/tests/fixtures/spaces'
import { Canvas } from '@/database/entities/Canvas'
import { Space } from '@/database/entities/Space'
import { SpaceCanvas } from '@/database/entities/SpaceCanvas'
import {
  createMockDataSource,
  createMockRepository
} from '@testing/backend/typeormMocks'

jest.mock(
  'flowise-components',
  () => ({
    removeFolderFromStorage: jest.fn().mockResolvedValue(undefined)
  }),
  { virtual: true }
)

jest.mock('@/database/entities/Space', () => ({
  Space: class Space {}
}))
jest.mock('@/database/entities/Canvas', () => ({
  Canvas: class Canvas {}
}))
jest.mock('@/database/entities/SpaceCanvas', () => ({
  SpaceCanvas: class SpaceCanvas {}
}))

describe('spacesRoutes', () => {
  const createTestServer = () => {
    const spaceRepo = createMockRepository<Space>({
      create: jest.fn((data?: Partial<Space>) => ({
        ...createSpaceFixture(),
        ...data
      }))
    })
    const canvasRepo = createMockRepository<Canvas>({
      create: jest.fn((data?: Partial<Canvas>) => ({
        ...createCanvasFixture(),
        ...data
      }))
    })
    const spaceCanvasRepo = createMockRepository<SpaceCanvas>({
      create: jest.fn((data?: Partial<SpaceCanvas>) => ({
        ...createSpaceCanvasFixture(),
        ...data
      }))
    })

    const manager: any = {
      save: jest.fn(async (entity: any) => entity),
      delete: jest.fn(async () => undefined),
      count: jest.fn(async () => 0)
    }
    manager.getRepository = jest.fn((entity: unknown) => {
      if (entity === Space) return spaceRepo
      if (entity === Canvas) return canvasRepo
      if (entity === SpaceCanvas) return spaceCanvasRepo
      throw new Error('Unexpected entity in manager.getRepository test double')
    })
    manager.transaction = jest.fn(async (run: (mgr: EntityManager) => Promise<unknown> | unknown) => run(manager))

    spaceRepo.manager = manager
    canvasRepo.manager = manager
    spaceCanvasRepo.manager = manager

    const dataSource = createMockDataSource(
      {
        Space: spaceRepo,
        Canvas: canvasRepo,
        SpaceCanvas: spaceCanvasRepo
      },
      {
        manager,
        transaction: jest.fn(async (run) => run(manager))
      }
    )

    const canvasServiceOptions = {
      entities: {
        chatMessage: class TestChatMessage {},
        chatMessageFeedback: class TestChatMessageFeedback {},
        upsertHistory: class TestUpsertHistory {}
      },
      dependencies: {
        errorFactory: (status: number, message: string) => {
          const error = new Error(message)
          ;(error as any).status = status
          return error
        },
        removeFolderFromStorage: jest.fn().mockResolvedValue(undefined),
        updateDocumentStoreUsage: jest.fn().mockResolvedValue(undefined),
        containsBase64File: () => false,
        updateFlowDataWithFilePaths: jest.fn(async () => '{}'),
        constructGraphs: () => ({ graph: {}, nodeDependencies: {} }),
        getEndingNodes: () => [],
        isFlowValidForStream: () => true,
        getAppVersion: async () => 'test-version',
        getTelemetryFlowObj: () => ({}),
        telemetry: undefined,
        metricsProvider: undefined,
        metricsConfig: {
          canvasCreatedCounter: 'canvas_created',
          agentflowCreatedCounter: 'agentflow_created',
          successStatusLabel: 'success'
        },
        logger: {
          warn: jest.fn(),
          error: jest.fn()
        },
        getUploadsConfig: jest.fn().mockResolvedValue({})
      }
    }

    const app = express()
    app.use(express.json())
    app.use(
      '/api/v1/uniks/:unikId',
      createSpacesRoutes(() => dataSource as any, {
        canvasService: canvasServiceOptions as any
      })
    )

    return {
      app,
      dataSource,
      manager,
      repositories: {
        spaceRepo,
        canvasRepo,
        spaceCanvasRepo
      }
    }
  }

  it('возвращает список пространств через GET /spaces', async () => {
    const { app, repositories } = createTestServer()
    const sampleSpace = createSpaceFixture()
    repositories.spaceRepo.queryBuilder.getRawAndEntities.mockResolvedValue({
      raw: [{ canvasCount: '3' }],
      entities: [sampleSpace]
    })

    const response = await request(app).get('/api/v1/uniks/unik-1/spaces')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: {
        spaces: [
          expect.objectContaining({
            id: sampleSpace.id,
            name: sampleSpace.name,
            canvasCount: 3
          })
        ]
      }
    })
  })

  it('возвращает 400 при попытке создать пространство без имени', async () => {
    const { app } = createTestServer()

    const response = await request(app)
      .post('/api/v1/uniks/unik-1/spaces')
      .send({})

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      success: false,
      error: 'Space name is required'
    })
  })

  it('создаёт пространство и возвращает 201', async () => {
    const { app, repositories } = createTestServer()
    repositories.spaceRepo.save.mockImplementation(async (entity?: Partial<Space>) => ({
      ...createSpaceFixture(),
      ...entity
    }))
    repositories.canvasRepo.save.mockImplementation(async (entity?: Partial<Canvas>) => ({
      ...createCanvasFixture(),
      ...entity
    }))
    repositories.spaceCanvasRepo.save.mockImplementation(async (entity?: Partial<SpaceCanvas>) => ({
      ...createSpaceCanvasFixture(),
      ...entity,
      id: 'space-canvas-1'
    }))

    const response = await request(app)
      .post('/api/v1/uniks/unik-1/spaces')
      .send({ name: ' New Space ', defaultCanvasName: ' Основной холст ', defaultCanvasFlowData: '{}' })

    expect(repositories.spaceRepo.save).toHaveBeenCalled()
    expect(repositories.canvasRepo.save).toHaveBeenCalled()
    expect(repositories.spaceCanvasRepo.save).toHaveBeenCalled()
    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        id: 'space-1',
        name: 'New Space',
        canvasCount: 1,
        defaultCanvas: expect.objectContaining({
          id: 'canvas-1',
          name: 'Основной холст',
          flowData: '{}'
        })
      }),
      message: 'Space created successfully'
    })
  })

  it('проксирует GET /spaces/:spaceId/canvases/:canvasId в контроллер', async () => {
    const getSpy = jest
      .spyOn(CanvasLegacyController.prototype, 'getCanvasById')
      .mockImplementation(async (_req, res) => {
        res.json({ ok: true })
      })

    const { app } = createTestServer()

    const response = await request(app).get(
      '/api/v1/uniks/unik-1/spaces/space-1/canvases/canvas-1'
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
    expect(getSpy).toHaveBeenCalledTimes(1)

    getSpy.mockRestore()
  })

  it('проксирует PUT /spaces/:spaceId/canvases/:canvasId в контроллер', async () => {
    const updateSpy = jest
      .spyOn(CanvasLegacyController.prototype, 'updateCanvas')
      .mockImplementation(async (_req, res) => {
        res.json({ updated: true })
      })

    const { app } = createTestServer()

    const response = await request(app)
      .put('/api/v1/uniks/unik-1/spaces/space-1/canvases/canvas-1')
      .send({ name: 'Updated' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ updated: true })
    expect(updateSpy).toHaveBeenCalledTimes(1)

    updateSpy.mockRestore()
  })

  it('проксирует DELETE /spaces/:spaceId/canvases/:canvasId в контроллер', async () => {
    const deleteSpy = jest
      .spyOn(CanvasLegacyController.prototype, 'deleteCanvas')
      .mockImplementation(async (_req, res) => {
        res.json({ removed: true })
      })

    const { app } = createTestServer()

    const response = await request(app).delete(
      '/api/v1/uniks/unik-1/spaces/space-1/canvases/canvas-1'
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ removed: true })
    expect(deleteSpy).toHaveBeenCalledTimes(1)

    deleteSpy.mockRestore()
  })

  it('проксирует GET /chatflows-streaming/:canvasId в контроллер', async () => {
    const streamingSpy = jest
      .spyOn(CanvasLegacyController.prototype, 'checkIfCanvasIsValidForStreaming')
      .mockImplementation(async (_req, res) => {
        res.json({ isStreaming: true })
      })

    const { app } = createTestServer()

    const response = await request(app).get(
      '/api/v1/uniks/unik-1/chatflows-streaming/canvas-1'
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ isStreaming: true })
    expect(streamingSpy).toHaveBeenCalledTimes(1)

    streamingSpy.mockRestore()
  })
})
