import 'reflect-metadata'
import { LegacyChatflowsService } from '@/services/legacyChatflowsService'
import { Canvas } from '@/database/entities/Canvas'
import { Space } from '@/database/entities/Space'
import { SpaceCanvas } from '@/database/entities/SpaceCanvas'
import {
  createMockDataSource,
  createMockRepository,
  createMockQueryBuilder
} from '@testing/backend/typeormMocks'

describe('LegacyChatflowsService', () => {
  const createService = () => {
    const spaceQueryBuilder = createMockQueryBuilder<Space>({
      getCount: jest.fn().mockResolvedValue(0)
    })
    const spaceRepo = createMockRepository<Space>(
      {
        findOne: jest.fn(async () => null),
        create: jest.fn((data?: Partial<Space>) => ({
          id: data?.id ?? 'space-1',
          name: data?.name ?? 'Space',
          visibility: data?.visibility ?? 'private',
          unikId: (data as any)?.unikId ?? 'unik-1',
          unik: (data as any)?.unik ?? { id: 'unik-1' }
        }) as Space),
        save: jest.fn(async (entity?: Partial<Space>) => ({
          id: entity?.id ?? 'space-1',
          name: entity?.name ?? 'Space',
          visibility: entity?.visibility ?? 'private',
          unikId: (entity as any)?.unikId ?? 'unik-1',
          unik: (entity as any)?.unik ?? { id: 'unik-1' }
        }) as Space),
        createQueryBuilder: jest.fn(() => spaceQueryBuilder)
      }
    )

    const canvasQueryBuilder = createMockQueryBuilder<Canvas>({
      getMany: jest.fn().mockResolvedValue([])
    })
    const canvasRepo = createMockRepository<Canvas>(
      {
        createQueryBuilder: jest.fn(() => canvasQueryBuilder),
        insert: jest.fn(async () => ({ identifiers: [{ id: 'canvas-1' }] })),
        findOne: jest.fn(async ({ where: { id } }: any) => ({
          id,
          name: 'Imported',
          versionGroupId: 'vg-1',
          flowData: '{}'
        }) as Canvas)
      }
    )

    const spaceCanvasQueryBuilder = createMockQueryBuilder<SpaceCanvas>({
      getCount: jest.fn().mockResolvedValue(0)
    })
    const spaceCanvasRepo = createMockRepository<SpaceCanvas>(
      {
        createQueryBuilder: jest.fn(() => spaceCanvasQueryBuilder),
        create: jest.fn((data?: Partial<SpaceCanvas>) => ({
          id: 'sc-1',
          sortOrder: data?.sortOrder ?? 1,
          versionGroupId: data?.versionGroupId ?? 'vg-1',
          space: data?.space ?? ({ id: 'space-1' } as Space),
          canvas: data?.canvas ?? ({ id: 'canvas-1' } as Canvas)
        }) as SpaceCanvas),
        save: jest.fn(async (entity?: Partial<SpaceCanvas>) => ({
          id: 'sc-1',
          sortOrder: entity?.sortOrder ?? 1,
          versionGroupId: entity?.versionGroupId ?? 'vg-1',
          space: entity?.space ?? ({ id: 'space-1' } as Space),
          canvas: entity?.canvas ?? ({ id: 'canvas-1' } as Canvas)
        }) as SpaceCanvas)
      }
    )

    const dataSource = createMockDataSource({
      Space: spaceRepo,
      Canvas: canvasRepo,
      SpaceCanvas: spaceCanvasRepo
    })

    const service = new LegacyChatflowsService(
      () => dataSource as any,
      {
        chatMessage: class TestChatMessage {},
        chatMessageFeedback: class TestChatMessageFeedback {},
        upsertHistory: class TestUpsertHistory {}
      },
      {
        errorFactory: (status: number, message: string) => {
          const error = new Error(message)
          ;(error as any).status = status
          return error
        },
        removeFolderFromStorage: jest.fn().mockResolvedValue(undefined),
        updateDocumentStoreUsage: jest.fn().mockResolvedValue(undefined),
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
        logger: {
          warn: jest.fn(),
          error: jest.fn()
        },
        getUploadsConfig: jest.fn().mockResolvedValue({})
      }
    )

    return {
      service,
      repositories: {
        spaceRepo,
        canvasRepo,
        spaceCanvasRepo
      }
    }
  }

  it('links imported canvases to the default space when only unik scope is provided', async () => {
    const { service, repositories } = createService()

    await service.importChatflows(
      [
        {
          id: 'canvas-1',
          name: 'Imported',
          flowData: '{}'
        }
      ],
      { unikId: 'unik-1' }
    )

    expect(repositories.spaceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'canvas-1',
        unik: { id: 'unik-1' },
        unikId: 'unik-1'
      })
    )
    expect(repositories.spaceRepo.save).toHaveBeenCalled()
    expect(repositories.spaceCanvasRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        space: expect.objectContaining({ id: 'canvas-1' }),
        canvas: expect.objectContaining({ id: 'canvas-1' })
      })
    )
    expect(repositories.spaceCanvasRepo.save).toHaveBeenCalled()
  })

  it('creates a dedicated default space when an existing space belongs to another unik', async () => {
    const { service, repositories } = createService()

    repositories.spaceRepo.findOne.mockResolvedValueOnce({
      id: 'canvas-1',
      name: 'Other space',
      visibility: 'private',
      unikId: 'unik-2',
      unik: { id: 'unik-2' }
    } as unknown as Space)

    await service.importChatflows(
      [
        {
          id: 'canvas-1',
          name: 'Imported',
          flowData: '{}'
        }
      ],
      { unikId: 'unik-1' }
    )

    const [createdSpacePayload] = repositories.spaceRepo.create.mock.calls[0]
    expect(createdSpacePayload?.id).toBeUndefined()
    expect(repositories.spaceRepo.save).toHaveBeenCalled()

    const createdRelation = repositories.spaceCanvasRepo.create.mock.calls[0][0] as SpaceCanvas
    expect(createdRelation.space.id).not.toBe('canvas-1')
    expect(repositories.spaceCanvasRepo.save).toHaveBeenCalled()
  })
})
