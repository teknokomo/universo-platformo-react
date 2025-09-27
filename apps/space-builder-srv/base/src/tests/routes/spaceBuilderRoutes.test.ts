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

jest.mock('../../services/SpaceBuilderService', () => ({
  spaceBuilderService: {
    normalizeManualQuiz: jest.fn()
  }
}))

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import router, { configureProviders } from '../../routes/space-builder'
import { spaceBuilderService } from '../../services/SpaceBuilderService'
import { ManualQuizParseError } from '../../services/parsers/manualQuiz'

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
    app.use(express.json())
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

  it('успешно нормализует ручной текст через маршрут /manual', async () => {
    ;(spaceBuilderService.normalizeManualQuiz as jest.Mock).mockResolvedValueOnce({
      items: [
        {
          question: 'Parsed question',
          answers: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false }
          ]
        }
      ]
    })

    const response = await request(buildApp())
      .post('/manual')
      .send({ rawText: '1. Q\n- A ✅\n- B', selectedChatModel: {}, fallbackToLLM: false })

    expect(response.status).toBe(200)
    expect(response.body.quizPlan.items[0].question).toBe('Parsed question')
    expect(spaceBuilderService.normalizeManualQuiz).toHaveBeenCalledWith({
      rawText: expect.any(String),
      selectedChatModel: {},
      fallbackToLLM: false
    })
  })

  it('возвращает 422 и issues при ошибке парсера', async () => {
    ;(spaceBuilderService.normalizeManualQuiz as jest.Mock).mockRejectedValueOnce(
      new ManualQuizParseError('Manual quiz parsing failed', ['Issue 1'])
    )

    const response = await request(buildApp())
      .post('/manual')
      .send({ rawText: 'broken', selectedChatModel: {}, fallbackToLLM: false })

    expect(response.status).toBe(422)
    expect(response.body.issues).toEqual(['Issue 1'])
  })

  it('валидация отклоняет fallback без модели', async () => {
    const response = await request(buildApp())
      .post('/manual')
      .send({ rawText: '1. Q\n- A ✅\n- B', fallbackToLLM: true })

    expect(response.status).toBe(400)
  })
})
