jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({ choices: [{ message: { content: '' } }] })
      }
    }
  }))
}))

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import router, { configureProviders } from '../../routes/space-builder'

describe('space-builder routes', () => {
  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.SPACE_BUILDER_TEST_MODE
    delete process.env.SPACE_BUILDER_TEST_ENABLE_OPENAI
    delete process.env.OPENAI_TEST_MODEL
    delete process.env.OPENAI_TEST_API_KEY
    delete process.env.OPENAI_TEST_BASE_URL
  })

  const buildApp = () => {
    const app = express()
    app.use(router)
    return app
  }

  it('возвращает тестовые провайдеры в конфигурации', async () => {
    process.env.SPACE_BUILDER_TEST_MODE = 'true'
    process.env.SPACE_BUILDER_TEST_ENABLE_OPENAI = 'true'
    process.env.OPENAI_TEST_MODEL = 'gpt-4o'
    process.env.OPENAI_TEST_API_KEY = 'test'

    const response = await request(buildApp()).get('/config')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      testMode: true,
      items: [expect.objectContaining({ id: 'openai', provider: 'openai' })]
    })
  })

  it('агрегирует провайдеров на основе зависимостей', async () => {
    const listChatModelNodes = jest.fn().mockResolvedValue([
      {
        name: 'chatOpenAI',
        label: 'OpenAI',
        credential: { credentialNames: ['openaiApi'] },
        icon: 'openai.png',
        inputs: [{ name: 'modelName', type: 'options' }]
      }
    ])
    const listComponentCredentials = jest.fn().mockResolvedValue([
      { name: 'openaiApi', icon: 'openai.png' }
    ])
    const listUserCredentials = jest.fn().mockResolvedValue([
      { id: 'cred-1', name: 'Default', credentialName: 'openaiApi' }
    ])

    configureProviders({ listChatModelNodes, listComponentCredentials, listUserCredentials })

    const response = await request(buildApp()).get('/providers?unikId=unik-1')

    expect(response.status).toBe(200)
    expect(response.body.providers).toHaveLength(1)
    expect(response.body.providers[0]).toMatchObject({
      id: 'chatOpenAI',
      credentials: [expect.objectContaining({ id: 'cred-1' })]
    })
    expect(listUserCredentials).toHaveBeenCalledWith('unik-1', 'openaiApi')
  })
})
