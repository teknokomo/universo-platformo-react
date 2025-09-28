import 'reflect-metadata'
import { EntityManager } from 'typeorm'
import { SpacesService } from '@/services/spacesService'

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
jest.mock('@/services/purgeUnikSpaces', () => ({
  purgeSpacesForUnik: jest.fn(),
  cleanupCanvasStorage: jest.fn().mockResolvedValue(undefined)
}))
import { createCanvasFixture, createSpaceCanvasFixture, createSpaceFixture } from '@/tests/fixtures/spaces'
import { Canvas } from '@/database/entities/Canvas'
import { Space } from '@/database/entities/Space'
import { SpaceCanvas } from '@/database/entities/SpaceCanvas'
import {
  createMockDataSource,
  createMockRepository
} from '@testing/backend/typeormMocks'

const { removeFolderFromStorage } = require('flowise-components') as {
  removeFolderFromStorage: jest.Mock
}
const { purgeSpacesForUnik, cleanupCanvasStorage } = require('@/services/purgeUnikSpaces') as {
  purgeSpacesForUnik: jest.Mock
  cleanupCanvasStorage: jest.Mock
}

describe('SpacesService', () => {
  const createService = (options?: {
    manager?: Partial<EntityManager>
  }) => {
    const spaceRepo = createMockRepository<Space>({
      create: jest.fn((data?: Partial<Space>) => ({
        ...createSpaceFixture(),
        ...data
      }))
    })
    spaceRepo.save.mockImplementation(async (entity?: Partial<Space>) => ({
      ...createSpaceFixture(),
      ...entity
    }))

    const canvasRepo = createMockRepository<Canvas>({
      create: jest.fn((data?: Partial<Canvas>) => ({
        ...createCanvasFixture(),
        ...data
      }))
    })
    canvasRepo.save.mockImplementation(async (entity?: Partial<Canvas>) => ({
      ...createCanvasFixture(),
      ...entity
    }))

    const spaceCanvasRepo = createMockRepository<SpaceCanvas>({
      create: jest.fn((data?: Partial<SpaceCanvas>) => ({
        ...createSpaceCanvasFixture(),
        ...data
      }))
    })
    spaceCanvasRepo.save.mockImplementation(async (entity?: Partial<SpaceCanvas>) => ({
      ...createSpaceCanvasFixture(),
      ...entity
    }))

    const managerBase: Partial<EntityManager> & { getRepository?: jest.Mock } = {
      save: jest.fn(async (entity: any) => entity),
      delete: jest.fn(async () => undefined),
      count: jest.fn(async () => 0)
    }

    const manager = {
      transaction: jest.fn(async (run) => run(manager as unknown as EntityManager)),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Space) return spaceRepo
        if (entity === Canvas) return canvasRepo
        if (entity === SpaceCanvas) return spaceCanvasRepo
        throw new Error('Unexpected entity request in test double')
      }),
      ...managerBase,
      ...options?.manager
    } as unknown as EntityManager & {
      save: jest.Mock
      getRepository: jest.Mock
    }

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

    const service = new SpacesService(() => dataSource as any)

    return {
      service,
      repositories: {
        spaceRepo,
        canvasRepo,
        spaceCanvasRepo
      },
      manager,
      dataSource
    }
  }

  beforeEach(() => {
    purgeSpacesForUnik.mockReset()
    cleanupCanvasStorage.mockReset()
    removeFolderFromStorage.mockClear()
  })

  it('возвращает агрегированные пространства с подсчитанным количеством канвасов', async () => {
    const space = createSpaceFixture()
    const spaceRepo = createMockRepository<Space>({}, {
      getRawAndEntities: jest.fn().mockResolvedValue({
        raw: [{ canvasCount: '2' }],
        entities: [space]
      })
    })
    const dataSource = createMockDataSource({
      Space: spaceRepo,
      Canvas: createMockRepository<Canvas>(),
      SpaceCanvas: createMockRepository<SpaceCanvas>()
    })
    const service = new SpacesService(() => dataSource as any)

    const result = await service.getSpacesForUnik('unik-1')

    expect(spaceRepo.createQueryBuilder).toHaveBeenCalledWith('sp')
    expect(result).toEqual([
      {
        id: space.id,
        name: space.name,
        description: space.description,
        visibility: space.visibility,
        canvasCount: 2,
        createdDate: space.createdDate,
        updatedDate: space.updatedDate
      }
    ])
  })

  it('создаёт пространство и привязывает канвас в одной транзакции', async () => {
    const { service, repositories, dataSource, manager } = createService()

    const result = await service.createSpace('unik-1', {
      name: '  Space One  ',
      description: 'desc',
      visibility: 'private',
      defaultCanvasName: ' Основной холст ',
      defaultCanvasFlowData: '{"nodes":[]}'
    })

    expect(dataSource.transaction).toHaveBeenCalled()
    expect(manager.getRepository).toHaveBeenCalledTimes(3)
    expect(repositories.spaceRepo.save).toHaveBeenCalled()
    expect(repositories.canvasRepo.save).toHaveBeenCalled()
    expect(repositories.spaceCanvasRepo.save).toHaveBeenCalled()
    expect(repositories.spaceRepo.create).toHaveBeenCalledWith({
      name: 'Space One',
      description: 'desc',
      visibility: 'private',
      unik: { id: 'unik-1' }
    })
    expect(repositories.canvasRepo.create).toHaveBeenCalledWith({
      name: 'Основной холст',
      flowData: '{"nodes":[]}'
    })
    expect(result).toEqual({
      id: 'space-1',
      name: 'Space One',
      description: 'desc',
      visibility: 'private',
      canvasCount: 1,
      createdDate: expect.anything(),
      updatedDate: expect.anything(),
      defaultCanvas: {
        id: 'canvas-1',
        name: 'Основной холст',
        sortOrder: 1,
        flowData: '{"nodes":[]}',
        deployed: false,
        isPublic: false,
        apikeyid: undefined,
        chatbotConfig: undefined,
        apiConfig: undefined,
        analytic: undefined,
        speechToText: undefined,
        followUpPrompts: undefined,
        category: undefined,
        type: 'CHATFLOW',
        createdDate: expect.anything(),
        updatedDate: expect.anything()
      }
    })
  })

  it('прокидывает ошибку при неудаче во время транзакции и не продолжает сохранение', async () => {
    const { service, repositories, dataSource } = createService()
    repositories.spaceRepo.save.mockResolvedValue({ ...createSpaceFixture(), id: 'space-1' })
    repositories.canvasRepo.save.mockRejectedValueOnce(new Error('failed to persist canvas'))

    await expect(service.createSpace('unik-1', { name: 'Broken Space' })).rejects.toThrow(
      'failed to persist canvas'
    )

    expect(dataSource.transaction).toHaveBeenCalled()
    expect(repositories.canvasRepo.save).toHaveBeenCalled()
  })

  it('делегирует удаление пространства helper-у и возвращает true', async () => {
    const { service, repositories, dataSource } = createService()
    repositories.spaceRepo.findOne.mockResolvedValue({ id: 'space-1', unikId: 'unik-1' })
    purgeSpacesForUnik.mockResolvedValue({
      deletedSpaceIds: ['space-1'],
      deletedCanvasIds: ['canvas-1']
    })

    const result = await service.deleteSpace('unik-1', 'space-1')

    expect(result).toBe(true)
    expect(dataSource.transaction).toHaveBeenCalled()
    expect(purgeSpacesForUnik).toHaveBeenCalledWith(expect.anything(), {
      unikId: 'unik-1',
      spaceIds: ['space-1']
    })
    expect(cleanupCanvasStorage).toHaveBeenCalledWith(
      ['canvas-1'],
      removeFolderFromStorage,
      { source: 'SpacesService' }
    )
  })

  it('возвращает false если пространство не принадлежит юнику', async () => {
    const { service, repositories } = createService()
    repositories.spaceRepo.findOne.mockResolvedValue(null)

    const result = await service.deleteSpace('unik-1', 'space-missing')

    expect(result).toBe(false)
    expect(purgeSpacesForUnik).not.toHaveBeenCalled()
    expect(cleanupCanvasStorage).not.toHaveBeenCalled()
  })

  it('не вызывает очистку хранилища если канвасы не удалены', async () => {
    const { service, repositories, dataSource } = createService()
    repositories.spaceRepo.findOne.mockResolvedValue({ id: 'space-1', unikId: 'unik-1' })
    purgeSpacesForUnik.mockResolvedValue({
      deletedSpaceIds: ['space-1'],
      deletedCanvasIds: []
    })

    const result = await service.deleteSpace('unik-1', 'space-1')

    expect(result).toBe(true)
    expect(dataSource.transaction).toHaveBeenCalled()
    expect(cleanupCanvasStorage).not.toHaveBeenCalled()
  })
})
