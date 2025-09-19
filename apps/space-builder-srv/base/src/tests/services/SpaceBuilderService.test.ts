import { SpaceBuilderService } from '../../services/SpaceBuilderService'
import { callProvider } from '../../services/providers/ModelFactory'

jest.mock('../../services/providers/ModelFactory', () => ({
  callProvider: jest.fn()
}))

describe('SpaceBuilderService', () => {
  const service = new SpaceBuilderService()
  const callProviderMock = callProvider as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('генерирует граф при валидном JSON от провайдера', async () => {
    callProviderMock.mockResolvedValueOnce(
      JSON.stringify({
        nodes: [
          { id: 'node-1', data: { name: 'Data', label: 'Node', inputs: {} } }
        ],
        edges: []
      })
    )

    const result = await service.generate({
      question: 'Build quiz',
      selectedChatModel: { provider: 'openai', modelName: 'gpt', credentialId: 'cred-1' }
    })

    expect(callProviderMock).toHaveBeenCalledWith({
      provider: 'openai',
      model: 'gpt',
      credentialId: 'cred-1',
      prompt: expect.stringContaining('Build quiz')
    })
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toEqual([])
    expect(result.nodes[0]).toMatchObject({ id: 'node-1', data: { name: 'Data' } })
  })

  it('конвертирует план викторины в граф с предсказуемой структурой', async () => {
    const plan = {
      items: [
        {
          question: 'Q1',
          answers: [
            { text: 'A1', isCorrect: true },
            { text: 'A2', isCorrect: false }
          ]
        }
      ]
    }

    const result = await service.generateFromPlan({
      quizPlan: plan,
      selectedChatModel: { provider: 'openai', modelName: 'gpt' }
    })

    expect(result.nodes.some(node => node.data.inputs?.dataType === 'question')).toBe(true)
    expect(result.edges.length).toBeGreaterThan(0)
  })
})
