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
jest.mock(
    '@universo/utils',
    () => ({
        serialization: { safeParseJson: jest.fn() }
    }),
    { virtual: true }
)

const { serialization } = require('@universo/utils') as { serialization: { safeParseJson: jest.Mock } }
const safeParseJson = serialization.safeParseJson

describe('FlowDataService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const createDataSource = () => {
        const canvasRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Canvas: canvasRepo
        }) as any

        dataSource.getMetadata = jest.fn((name: string) => ({ target: name }))

        return { dataSource, canvasRepo }
    }

    it('загружает канвас и извлекает конфигурацию библиотеки', async () => {
        const { dataSource, canvasRepo } = createDataSource()
        const canvas = {
            id: 'canvas-1',
            name: 'Quiz',
            flowData: '{"nodes":[]}',
            chatbotConfig: '{"arjs":{"libraryConfig":{"source":"kiberplano"},"arDisplayType":"wallpaper"}}'
        }
        canvasRepo.findOne.mockResolvedValue(canvas)
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
        expect(result).toMatchObject({
            flowData: canvas.flowData,
            libraryConfig: { source: 'kiberplano' },
            canvas: { id: 'canvas-1', name: 'Quiz' }
        })
        expect(safeParseJson).toHaveBeenCalledWith(canvas.chatbotConfig)
    })
})
