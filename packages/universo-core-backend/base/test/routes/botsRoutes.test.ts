import express from 'express'
import request from 'supertest'

jest.mock('../../src/controllers/bots/chat-streaming', () => {
  return {
    __esModule: true,
    default: {
      getStreamingResponse: jest.fn((req, res) => {
        res.status(204).end()
        return Promise.resolve()
      })
    }
  }
})

jest.mock('../../src/utils/getRunningExpressApp', () => ({
  getRunningExpressApp: jest.fn(() => ({
    AppDataSource: {
      isInitialized: true,
      getRepository: jest.fn(() => ({
        findOneBy: jest.fn().mockResolvedValue({ id: 'bot-1', chatbotConfig: '{}' })
      })),
      query: jest.fn().mockResolvedValue([])
    }
  }))
}))

jest.mock('../../src/services/access-control', () => ({
  workspaceAccessService: {
    getUnikIdForCanvas: jest.fn().mockResolvedValue(null),
    hasUnikAccess: jest.fn()
  },
  resolveRequestUserId: jest.fn().mockReturnValue('user-1')
}))

const chatStreamingController = require('../../src/controllers/bots/chat-streaming').default as {
  getStreamingResponse: jest.Mock
}

import botsRouter from '../../src/routes/bots'

describe('bots routes - streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('делегирует потоковые запросы в chatStreamingController', async () => {
    const app = express()
    app.use('/api/v1/bots', botsRouter)

    const response = await request(app).get('/api/v1/bots/bot-1/stream')

    expect(response.status).toBe(204)
    expect(chatStreamingController.getStreamingResponse).toHaveBeenCalledTimes(1)
    expect(chatStreamingController.getStreamingResponse.mock.calls[0][0].params.id).toBe('bot-1')
  })
})
