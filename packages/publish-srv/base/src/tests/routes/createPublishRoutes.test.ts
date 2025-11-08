import express from 'express'
const request = require('supertest') as typeof import('supertest')
import { createMockDataSource } from '@testing/backend/typeormMocks'
import { createFlowDataServiceMock } from '@testing/backend/mocks'
import { createPublishRoutes } from '../../routes/createPublishRoutes'

jest.mock('express', () => {
    const actual = jest.requireActual('express')
    return {
        __esModule: true,
        default: actual,
        ...actual
    }
})

const controllerMethods = {
    publishARJS: jest.fn(),
    getPublicARJSPublication: jest.fn(),
    streamUPDL: jest.fn(),
    getGlobalSettings: jest.fn()
}

var PublishControllerMock: jest.Mock
const flowDataService = createFlowDataServiceMock({
    getFlowData: jest.fn().mockResolvedValue({ flowData: '{}', canvas: { id: '1', name: 'Canvas' } })
})
var FlowDataServiceMock: jest.Mock

jest.mock('../../controllers/publishController', () => {
    PublishControllerMock = jest.fn(() => controllerMethods)
    return {
        PublishController: PublishControllerMock
    }
})

jest.mock('../../services/FlowDataService', () => {
    FlowDataServiceMock = jest.fn(() => flowDataService)
    return {
        FlowDataService: FlowDataServiceMock
    }
})

describe('createPublishRoutes', () => {
    const buildApp = (dataSourceOverrides?: Partial<ReturnType<typeof createMockDataSource>>) => {
        const dataSource = createMockDataSource({}, dataSourceOverrides) as any
        dataSource.isInitialized = dataSourceOverrides?.isInitialized ?? true
        if (dataSourceOverrides?.initialize) {
            dataSource.initialize = dataSourceOverrides.initialize
        }

        const router = createPublishRoutes(dataSource)
        const app = express()
        app.use(express.json())
        app.use(router)

        return { app, dataSource }
    }

    beforeEach(() => {
        jest.clearAllMocks()

        controllerMethods.publishARJS.mockImplementation(async (_req, res) => {
            res.status(200).json({ ok: true })
        })
        controllerMethods.getPublicARJSPublication.mockImplementation(async (_req, res) => {
            res.status(200).json({ ok: true })
        })
        controllerMethods.streamUPDL.mockImplementation(async (_req, res) => {
            res.status(200).json({ ok: true })
        })
        controllerMethods.getGlobalSettings.mockImplementation(async (_req, res) => {
            res.status(200).json({ ok: true })
        })
    })

    it('инициализирует DataSource перед обработкой запросов', async () => {
        const initialize = jest.fn(async () => undefined)
        const { app, dataSource } = buildApp({ isInitialized: false, initialize })

        const response = await request(app).post('/arjs').send({ canvasId: 'canvas-1' })

        expect(response.status).toBe(200)
        expect(initialize).toHaveBeenCalled()
        expect(PublishControllerMock).toHaveBeenCalledTimes(1)
        expect(FlowDataServiceMock).toHaveBeenCalledTimes(1)
    })

    it('повторно использует уже инициализированный источник данных и вызывает контроллер', async () => {
        const { app } = buildApp({ isInitialized: true })

        const response = await request(app).get('/canvas/public/flow-1')

        expect(response.status).toBe(200)
        expect(controllerMethods.getPublicARJSPublication).toHaveBeenCalled()
        expect(PublishControllerMock).toHaveBeenCalledTimes(1)
        expect(FlowDataServiceMock).toHaveBeenCalledTimes(1)
    })
})
