import { createMockDataSource, createMockRepository } from '@testing/backend/typeormMocks'
import { PublishLinkService } from '../../services/PublishLinkService'
import { PublishCanvas } from '../../database/entities'

describe('PublishLinkService', () => {
  it('обновляет group-ссылки при переключении активного канваса', async () => {
    const publishRepo = createMockRepository<PublishCanvas>()
    const dataSource = createMockDataSource({ PublishCanvas: publishRepo }) as any

    const { queryBuilder } = publishRepo
    queryBuilder.execute.mockResolvedValue(undefined)

    const service = new PublishLinkService(dataSource as any)

    await service.updateGroupTarget('vg-1', 'canvas-2')

    expect(publishRepo.createQueryBuilder).toHaveBeenCalled()
    expect(queryBuilder.update).toHaveBeenCalledWith(PublishCanvas)
    expect(queryBuilder.set).toHaveBeenCalledWith({ targetCanvasId: 'canvas-2' })
    expect(queryBuilder.where).toHaveBeenCalledWith('versionGroupId = :versionGroupId', { versionGroupId: 'vg-1' })
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('targetType = :targetType', { targetType: 'group' })
    expect(queryBuilder.execute).toHaveBeenCalled()
  })
})
