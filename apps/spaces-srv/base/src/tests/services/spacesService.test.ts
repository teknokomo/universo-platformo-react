import 'reflect-metadata'
import { EntityManager } from 'typeorm'
import { SpacesService } from '@/services/spacesService'

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
import { createCanvasFixture, createSpaceCanvasFixture, createSpaceFixture } from '@/tests/fixtures/spaces'
import { Canvas } from '@/database/entities/Canvas'
import { Space } from '@/database/entities/Space'
import { SpaceCanvas } from '@/database/entities/SpaceCanvas'
import {
  createMockDataSource,
  createMockRepository
} from '@testing/backend/typeormMocks'

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

    const managerBase: Partial<EntityManager> = {
      save: jest.fn(async (entity: any) => entity),
      delete: jest.fn(async () => undefined),
      count: jest.fn(async () => 0)
    }

    const manager = {
      transaction: jest.fn(async (run) => run(manager as unknown as EntityManager)),
      ...managerBase,
      ...options?.manager
    } as unknown as EntityManager & {
      save: jest.Mock
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
    const { service, repositories, manager, dataSource } = createService({
      manager: {
        save: jest.fn(async (entity: any) => {
          if ('sortOrder' in entity && 'canvas' in entity) {
            return { ...entity, id: 'space-canvas-1' }
          }

          if ('flowData' in entity) {
            return { ...entity, id: 'canvas-1' }
          }

          return { ...entity, id: 'space-1' }
        })
      }
    })

    const result = await service.createSpace('unik-1', { name: 'Space One', description: 'desc', visibility: 'private' })

    expect(dataSource.transaction).toHaveBeenCalled()
    expect(manager.save).toHaveBeenCalledTimes(3)
    expect(repositories.spaceRepo.create).toHaveBeenCalledWith({
      name: 'Space One',
      description: 'desc',
      visibility: 'private',
      unik: { id: 'unik-1' }
    })
    expect(result).toEqual({
      id: 'space-1',
      name: 'Space One',
      description: 'desc',
      visibility: 'private',
      canvasCount: 1,
      createdDate: expect.anything(),
      updatedDate: expect.anything()
    })
  })

  it('прокидывает ошибку при неудаче во время транзакции и не продолжает сохранение', async () => {
    const failingManager: Partial<EntityManager> = {
      save: jest
        .fn()
        .mockImplementationOnce(async (entity: any) => ({ ...entity, id: 'space-1' }))
        .mockRejectedValueOnce(new Error('failed to persist canvas'))
    }

    const { service, manager, dataSource } = createService({ manager: failingManager })

    await expect(
      service.createSpace('unik-1', { name: 'Broken Space' })
    ).rejects.toThrow('failed to persist canvas')

    expect(dataSource.transaction).toHaveBeenCalled()
    expect(manager.save).toHaveBeenCalledTimes(2)
  })
})
