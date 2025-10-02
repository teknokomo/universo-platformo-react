jest.mock('typeorm', () => {
  const decorator = () => () => {}
  return {
    __esModule: true,
    Entity: decorator,
    PrimaryGeneratedColumn: decorator,
    Column: decorator,
    ManyToOne: decorator,
    JoinColumn: decorator,
    Unique: decorator
  }
}, { virtual: true })

jest.mock(
  'flowise-components',
  () => ({
    removeFolderFromStorage: jest.fn().mockResolvedValue(undefined)
  }),
  { virtual: true }
)

jest.mock(
  '@universo/spaces-srv',
  () => {
    const express = require('express') as typeof import('express')
    return {
      purgeSpacesForUnik: jest.fn(),
      cleanupCanvasStorage: jest.fn().mockResolvedValue(undefined),
      createSpacesRoutes: jest.fn(() => {
        const router = express.Router({ mergeParams: true })
        router.use((_req, _res, next) => next())
        return router
      })
    }
  },
  { virtual: true }
)

import type { Request, Response, NextFunction, Router } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import * as routes from '../../routes/uniksRoutes'
import { createMockRepository, createMockDataSource } from '../utils/typeormMocks'

const { createUniksCollectionRouter, createUnikIndividualRouter } = routes
const { removeFolderFromStorage } = require('flowise-components') as {
  removeFolderFromStorage: jest.Mock
}
const { purgeSpacesForUnik, cleanupCanvasStorage, createSpacesRoutes } = require('@universo/spaces-srv') as {
  purgeSpacesForUnik: jest.Mock
  cleanupCanvasStorage: jest.Mock
  createSpacesRoutes: jest.Mock
}


const ensureAuth = (userId: string) => (req: Request, _res: Response, next: NextFunction) => {
  ;(req as any).user = { id: userId }
  next()
}

describe('uniks routes (TypeORM)', () => {
  const buildCollectionApp = (userId: string, repos: { unikRepo: any; membershipRepo: any }) => {
    const dataSource = createMockDataSource({ Unik: repos.unikRepo, UnikUser: repos.membershipRepo })
    const router = createUniksCollectionRouter(ensureAuth(userId), () => dataSource as any)
    const app = express()
    app.use(express.json())
    app.use(router)
    return { app, dataSource }
  }

  const buildIndividualApp = (
    userId: string,
    repos: { unikRepo: any; membershipRepo: any },
    options?: { transaction?: jest.Mock }
  ) => {
    const dataSource = createMockDataSource({ Unik: repos.unikRepo, UnikUser: repos.membershipRepo }, options)
    const router = createUnikIndividualRouter(ensureAuth(userId), () => dataSource as any)
    const app = express()
    app.use(express.json())
    app.use(router)
    return { app, dataSource }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('возвращает список юников текущего пользователя', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.find.mockResolvedValue([
      { unik_id: 'unik-1', role: 'owner', unik: { id: 'unik-1', name: 'Main', created_at: '2025-01-01' } },
      { unik_id: 'unik-2', role: 'editor', unik: { id: 'unik-2', name: 'Side', created_at: '2025-01-02' } }
    ])

    const { app } = buildCollectionApp('user-1', { unikRepo, membershipRepo })
    const response = await request(app).get('/')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { id: 'unik-1', name: 'Main', created_at: '2025-01-01', role: 'owner' },
      { id: 'unik-2', name: 'Side', created_at: '2025-01-02', role: 'editor' }
    ])
    expect(membershipRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      relations: ['unik'],
      order: { role: 'ASC' }
    })
  })

  it('создаёт уник и связывает владельца', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    unikRepo.create.mockImplementation((payload) => ({ id: 'unik-3', created_at: new Date().toISOString(), ...payload }))
    unikRepo.save.mockResolvedValue({ id: 'unik-3', name: 'Workspace', created_at: '2025-01-05' })
    membershipRepo.create.mockImplementation((payload) => payload)
    membershipRepo.save.mockResolvedValue({})

    const { app } = buildCollectionApp('user-42', { unikRepo, membershipRepo })
    const response = await request(app).post('/').send({ name: 'Workspace' })

    expect(response.status).toBe(201)
    expect(unikRepo.create).toHaveBeenCalledWith({ name: 'Workspace' })
    expect(membershipRepo.create).toHaveBeenCalledWith({ user_id: 'user-42', unik_id: 'unik-3', role: 'owner' })
    expect(response.body).toEqual({ id: 'unik-3', name: 'Workspace', created_at: '2025-01-05' })
  })

  it('запрещает добавление участника без прав владельца', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'editor' })

    const { app } = buildCollectionApp('user-7', { unikRepo, membershipRepo })
    const response = await request(app)
      .post('/members')
      .send({ unik_id: 'unik-9', user_id: 'member-1', role: 'editor' })

    expect(response.status).toBe(403)
  })

  it('обновляет уник редактором (editor разрешён)', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'editor' })
    unikRepo.createQueryBuilder().execute.mockResolvedValue({ raw: [{ id: 'unik-1', name: 'Renamed' }] })

    const { app } = buildIndividualApp('user-55', { unikRepo, membershipRepo })
    const response = await request(app).put('/unik-1').send({ name: 'Renamed' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: 'unik-1', name: 'Renamed' })
  })

  it('удаляет уник владельцем с каскадной очисткой', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'owner' })
    const managerUnikRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'unik-1' }),
      delete: jest.fn().mockResolvedValue({ affected: 1 })
    }
    purgeSpacesForUnik.mockResolvedValue({
      deletedCanvasIds: ['canvas-1'],
      deletedSpaceIds: ['space-1']
    })
    const transaction = jest.fn(async (callback: any) => {
      return callback({
        getRepository: jest.fn(() => managerUnikRepo)
      })
    })

    const { app } = buildIndividualApp('user-99', { unikRepo, membershipRepo }, { transaction })
    const response = await request(app).delete('/123')

    expect(response.status).toBe(204)
    expect(transaction).toHaveBeenCalled()
    expect(managerUnikRepo.findOne).toHaveBeenCalledWith({ where: { id: '123' } })
    expect(managerUnikRepo.delete).toHaveBeenCalledWith({ id: '123' })
    expect(purgeSpacesForUnik).toHaveBeenCalledWith(expect.anything(), { unikId: '123' })
    expect(cleanupCanvasStorage).toHaveBeenCalledWith(
      ['canvas-1'],
      removeFolderFromStorage,
      { source: 'Uniks' }
    )
    purgeSpacesForUnik.mockReset()
    cleanupCanvasStorage.mockReset()
  })

  it('не вызывает очистку хранилища если helper не удалил канвасы', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'owner' })
    const managerUnikRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'unik-1' }),
      delete: jest.fn().mockResolvedValue({ affected: 1 })
    }
    purgeSpacesForUnik.mockResolvedValue({
      deletedCanvasIds: [],
      deletedSpaceIds: ['space-1']
    })
    const transaction = jest.fn(async (callback: any) =>
      callback({
        getRepository: jest.fn(() => managerUnikRepo)
      })
    )

    const { app } = buildIndividualApp('user-1', { unikRepo, membershipRepo }, { transaction })
    const response = await request(app).delete('/777')

    expect(response.status).toBe(204)
    expect(purgeSpacesForUnik).toHaveBeenCalledWith(expect.anything(), { unikId: '777' })
    expect(cleanupCanvasStorage).not.toHaveBeenCalled()
  })

  it('возвращает 404 если уник не найден внутри транзакции', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'owner' })

    const managerUnikRepo = {
      findOne: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn()
    }

    const transaction = jest.fn(async (callback: any) => {
      try {
        await callback({
          getRepository: jest.fn(() => managerUnikRepo)
        })
      } catch (error) {
        throw error
      }
    })

    const { app } = buildIndividualApp('user-11', { unikRepo, membershipRepo }, { transaction })
    const response = await request(app).delete('/missing')

    expect(response.status).toBe(404)
    expect(managerUnikRepo.delete).not.toHaveBeenCalled()
    expect(purgeSpacesForUnik).not.toHaveBeenCalled()
  })

  it('подключает spaces маршруты внутри createUniksRouter', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    const dataSource = createMockDataSource({ Unik: unikRepo, UnikUser: membershipRepo })

    const buildStubRouter = () => {
      const r: Router = express.Router({ mergeParams: true })
      r.use((_req, _res, next: NextFunction) => next())
      return r
    }

    const spacesRouter = express.Router({ mergeParams: true })
    spacesRouter.get('/spaces', (_req: Request, res: Response) => {
      res.json({ items: [] })
    })
    createSpacesRoutes.mockReturnValueOnce(spacesRouter)

    const router = routes.createUniksRouter(
      ensureAuth('user-spaces'),
      () => dataSource as any,
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      buildStubRouter(),
      {
        spacesLimiter: (_req, _res, next) => next(),
        spacesRoutes: {
          canvasService: {
            entities: {
              chatMessage: class {},
              chatMessageFeedback: class {},
              upsertHistory: class {}
            },
            dependencies: {
              errorFactory: jest.fn((status: number, message: string) => {
                const error = new Error(message)
                ;(error as any).status = status
                return error
              }),
              removeFolderFromStorage: jest.fn(),
              updateDocumentStoreUsage: jest.fn(),
              containsBase64File: jest.fn(() => false),
              updateFlowDataWithFilePaths: jest.fn(async () => '{}'),
              constructGraphs: jest.fn(() => ({ graph: {}, nodeDependencies: {} })),
              getEndingNodes: jest.fn(() => []),
              isFlowValidForStream: jest.fn(() => true),
              getAppVersion: jest.fn(async () => 'test'),
              getTelemetryFlowObj: jest.fn(() => ({})),
              telemetry: undefined,
              metricsProvider: undefined,
              metricsConfig: {
                canvasCreatedCounter: 'canvas_created',
                agentflowCreatedCounter: 'agentflow_created',
                successStatusLabel: 'success'
              },
              logger: { warn: jest.fn(), error: jest.fn() },
              getUploadsConfig: jest.fn(async () => ({}))
            }
          }
        }
      }
    )

    const app = express()
    app.use(express.json())
    app.use(router)

    const response = await request(app).get('/unik-1/spaces')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ items: [] })
    expect(createSpacesRoutes).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ canvasService: expect.any(Object) }))
  })

  it('проксирует canvas-маршруты с параметрами unikId и spaceId', async () => {
    const handled: Array<{ unikId: string; spaceId: string }> = []
    createSpacesRoutes.mockImplementationOnce(() => {
      const router = express.Router({ mergeParams: true })
      router.get('/spaces/:spaceId/canvases', (req, res) => {
        handled.push({ unikId: (req.params as any).unikId, spaceId: req.params.spaceId })
        res.json({ ok: true })
      })
      return router
    })

    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'owner' })

    const { app } = buildIndividualApp('user-1', { unikRepo, membershipRepo })
    const response = await request(app).get('/unik-1/spaces/space-7/canvases')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
    expect(handled).toEqual([{ unikId: 'unik-1', spaceId: 'space-7' }])
  })
})
