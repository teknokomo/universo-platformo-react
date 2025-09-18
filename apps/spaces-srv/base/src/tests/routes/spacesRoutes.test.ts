import 'reflect-metadata'
import express = require('express')
import request = require('supertest')
import { EntityManager } from 'typeorm'
import { createSpacesRoutes } from '@/routes/spacesRoutes'
import { createCanvasFixture, createSpaceFixture, createSpaceCanvasFixture } from '@/tests/fixtures/spaces'
import { Canvas } from '@/database/entities/Canvas'
import { Space } from '@/database/entities/Space'
import { SpaceCanvas } from '@/database/entities/SpaceCanvas'
import {
  createMockDataSource,
  createMockRepository
} from '@testing/backend/typeormMocks'

jest.mock('@universo/uniks-srv', () => ({
  Unik: class Unik {}
}), { virtual: true })
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

    const app = express()
    app.use(express.json())
    app.use('/api/v1/uniks/:unikId', createSpacesRoutes(() => dataSource as any))

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
    const { app, manager } = createTestServer()
    manager.save
      .mockImplementationOnce(async () => createSpaceFixture({ name: 'New Space' }))
      .mockImplementationOnce(async () => createCanvasFixture())
      .mockImplementationOnce(async (entity: any) => ({ ...entity, id: 'space-canvas-1' }))

    const response = await request(app)
      .post('/api/v1/uniks/unik-1/spaces')
      .send({ name: 'New Space' })

    expect(manager.save).toHaveBeenCalledTimes(3)
    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        id: 'space-1',
        name: 'New Space',
        canvasCount: 1
      }),
      message: 'Space created successfully'
    })
  })
})
