import { createMockDataSource, createMockRepository } from '@testing/backend/typeormMocks'
import { FlowDataService } from '../../services/FlowDataService'

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))
jest.mock('@universo-platformo/utils', () => ({
  serialization: { safeParseJson: jest.fn() }
}), { virtual: true })

const { serialization } = require('@universo-platformo/utils') as { serialization: { safeParseJson: jest.Mock } }
const safeParseJson = serialization.safeParseJson

describe('FlowDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createDataSource = () => {
    const canvasRepo = createMockRepository<any>()
    const chatflowRepo = createMockRepository<any>()

    const dataSource = createMockDataSource({
      Canvas: canvasRepo,
      ChatFlow: chatflowRepo
    }) as any

    dataSource.getMetadata = jest.fn((name: string) => ({ target: name }))

    return { dataSource, canvasRepo, chatflowRepo }
  }

  it('загружает канвас и извлекает конфигурацию библиотеки', async () => {
    const { dataSource, canvasRepo, chatflowRepo } = createDataSource()
    const canvas = {
      id: 'canvas-1',
      name: 'Quiz',
      flowData: '{"nodes":[]}',
      chatbotConfig: '{"arjs":{"libraryConfig":{"source":"kiberplano"},"arDisplayType":"wallpaper"}}'
    }
    canvasRepo.findOne.mockResolvedValue(canvas)
    chatflowRepo.findOne.mockResolvedValue(null)
    safeParseJson.mockReturnValue({
      ok: true,
      value: {
        arjs: {
          libraryConfig: { source: 'kiberplano' },
          arDisplayType: 'wallpaper',
          wallpaperType: 'standard'
        }
      }
    })

    const service = new FlowDataService(dataSource as any)
    const result = await service.getFlowData('canvas-1')

    expect(canvasRepo.findOne).toHaveBeenCalledWith({ where: { id: 'canvas-1' } })
    expect(chatflowRepo.findOne).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      flowData: canvas.flowData,
      libraryConfig: { source: 'kiberplano' },
      canvas: { id: 'canvas-1', name: 'Quiz' }
    })
    expect(safeParseJson).toHaveBeenCalledWith(canvas.chatbotConfig)
  })

  it('переходит на ChatFlow при отсутствии канваса', async () => {
    const { dataSource, canvasRepo, chatflowRepo } = createDataSource()
    canvasRepo.findOne.mockResolvedValue(null)
    const chatflow = {
      id: 'chatflow-1',
      name: 'Legacy Flow',
      flowData: '{"nodes":[]}',
      chatbotConfig: '{"arjs":{}}'
    }
    chatflowRepo.findOne.mockResolvedValue(chatflow)
    safeParseJson.mockReturnValue({ ok: true, value: { arjs: {} } })

    const service = new FlowDataService(dataSource as any)
    const result = await service.getFlowData('chatflow-1')

    expect(canvasRepo.findOne).toHaveBeenCalled()
    expect(chatflowRepo.findOne).toHaveBeenCalledWith({ where: { id: 'chatflow-1' } })
    expect(result.canvas).toEqual({ id: 'chatflow-1', name: 'Legacy Flow' })
    expect(result.chatflow).toEqual({ id: 'chatflow-1', name: 'Legacy Flow' })
  })
})
